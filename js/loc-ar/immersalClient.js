import * as THREE from "three";
import { Immersal, createOrientationSensor } from "./vendor/immersal/immersal.js";
import { immersalParams } from "./immersalConfig.js";

const USE_POSE_FILTERING = true;
const POSE_LERP_STEP = 0.025;

function waitForCameraFrames(camera, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const video = camera?.el;
      const ready =
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        camera.width > 0 &&
        camera.height > 0;
      if (ready) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("摄像头画面未就绪，请刷新后重试。"));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * @param {InstanceType<typeof Immersal>} immersal
 */
export function getImmersalDiagnostics(immersal) {
  const camera = immersal?.camera;
  const track = camera?.el?.srcObject?.getVideoTracks?.()[0];
  const settings = track?.getSettings?.();
  const trackSize =
    settings?.width && settings?.height
      ? ` · track ${settings.width}x${settings.height}`
      : "";
  return {
    mapHandle: immersal?.localizeInfo?.handle ?? -1,
    localizeCount: immersal?.localization?.counter ?? 0,
    localizing: immersal?.localization?.localizing ?? false,
    cameraSize:
      camera?.width && camera?.height
        ? `${camera.width}x${camera.height}${trackSize}`
        : "—",
    videoState: camera?.el?.readyState ?? 0,
  };
}

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
  if (mapHandle < 0) {
    throw new Error(`地图 ${mapId} 加载失败，请检查 Token 与 Map ID。`);
  }

  await waitForCameraFrames(immersal.camera);

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
    const video = immersal.camera.el;
    const w = video.width;
    const h = video.height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.domElement.style.left = video.style.left || "0";
    renderer.domElement.style.top = video.style.top || "0";
  }

  resize();
  container.appendChild(renderer.domElement);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.zIndex = "2";
  renderer.domElement.style.pointerEvents = "none";

  immersal.addEventListener("resize", resize);

  function isLocalized() {
    return immersal.localization.counter >= 1;
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
    immersal.removeEventListener("resize", resize);
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
