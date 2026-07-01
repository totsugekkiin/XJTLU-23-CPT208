import * as THREE from "three";
import { Immersal, createOrientationSensor } from "./vendor/immersal/immersal.js";
import { immersalParams } from "./immersalConfig.js";

const USE_POSE_FILTERING = true;
const POSE_LERP_STEP = 0.025;

/**
 * @typedef {object} ImmersalRuntime
 * @property {() => void} startRenderLoop
 * @property {() => void} stopRenderLoop
 * @property {() => Promise<void>} destroy
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {InstanceType<typeof Immersal>} immersal
 * @property {number} mapHandle
 * @property {boolean} isLocalized
 */

/**
 * @param {HTMLElement} container
 * @returns {Promise<ImmersalRuntime>}
 */
export async function createImmersalRuntime(container) {
  await createOrientationSensor();

  const immersal = await Immersal.Initialize(container, immersalParams);
  const mapId = immersalParams.mapIds[0];
  const mapHandle = await immersal.loadMap(mapId);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.001,
    10000,
  );
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 1.2);
  directional.position.set(1, 2, 1);
  scene.add(directional);

  const P = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const QG = new THREE.Quaternion();
  let prevTime = 0;
  let renderLoopActive = false;

  function resize() {
    if (!immersal.camera) return;
    const w = immersal.camera.el.width;
    const h = immersal.camera.el.height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  resize();
  container.appendChild(renderer.domElement);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "2";
  renderer.domElement.style.pointerEvents = "none";

  immersal.addEventListener("resize", resize);

  function isLocalized() {
    return immersal.localization.counter > 1;
  }

  function render(time) {
    const timestamp = performance.now();
    const dt = timestamp - prevTime;
    prevTime = timestamp;

    if (mapHandle >= 0 && immersal.continuousLocalization) {
      immersal.localizeDevice(timestamp);
    }

    if (isLocalized()) {
      camera.fov = immersal.getVFov();
      camera.updateProjectionMatrix();

      if (immersal.continuousLocalization) {
        const { position, rotation } = immersal.getEstimatedPose(timestamp);
        P.set(position[0], position[1], position[2]);
        Q.set(rotation[0], rotation[1], rotation[2], rotation[3]);
        QG.set(
          immersal.gyroData.x,
          immersal.gyroData.y,
          immersal.gyroData.z,
          immersal.gyroData.w,
        );
        Q.multiply(QG);

        if (USE_POSE_FILTERING) {
          let step = POSE_LERP_STEP * dt;
          if (step > 1) step = 1;
          camera.position.lerp(P, step);
          camera.quaternion.set(Q.x, Q.y, Q.z, Q.w);
        } else {
          camera.position.copy(P);
          camera.quaternion.copy(Q);
        }
      } else {
        const { position, rotation } = immersal.localizeInfo;
        P.set(position.x, position.y, position.z);
        Q.set(rotation.x, rotation.y, rotation.z, rotation.w);
        QG.set(
          immersal.gyroData.x,
          immersal.gyroData.y,
          immersal.gyroData.z,
          immersal.gyroData.w,
        );
        Q.multiply(QG);
        camera.position.copy(P);
        camera.quaternion.copy(Q);
      }
    }

    renderer.render(scene, camera);
  }

  function startRenderLoop() {
    if (renderLoopActive) return;
    renderLoopActive = true;
    renderer.setAnimationLoop(render);
  }

  function stopRenderLoop() {
    renderLoopActive = false;
    renderer.setAnimationLoop(null);
  }

  async function tryStartWebXR() {
    return checkWebXRSupport();
  }

  const webxrSupported = await tryStartWebXR();

  async function destroy() {
    stopRenderLoop();
    renderer.domElement.remove();
    renderer.dispose();
    if (mapHandle >= 0) {
      try {
        await immersal.freeMap(mapHandle);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    startRenderLoop,
    stopRenderLoop,
    destroy,
    scene,
    camera,
    renderer,
    immersal,
    mapHandle,
    isLocalized,
    webxrSupported,
  };
}

export async function checkWebXRSupport() {
  if (!navigator.xr?.isSessionSupported) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}
