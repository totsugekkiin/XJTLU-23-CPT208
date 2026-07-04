import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AR_ANCHORS } from "./arAnchors.js";

const POSE_LERP = 0.14;

/**
 * 在摄像头画面上叠加 Three.js AR 内容。
 * 相机位姿由 Immersal 定位结果驱动，模型坐标来自 AR_ANCHORS。
 */
export function createArRenderer(cameraWrap) {
  const canvas = document.createElement("canvas");
  canvas.id = "ar-three-canvas";
  cameraWrap.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 500);
  const contentRoot = new THREE.Group();
  contentRoot.name = "ar-content-root";
  scene.add(contentRoot);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1);
  keyLight.position.set(3, 6, 2);
  scene.add(keyLight);

  let modelsReady = false;
  let hasPose = false;
  let frameId = 0;
  let resizeObserver = null;

  const loadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      AR_ANCHORS.map(async (anchor) => {
        const gltf = await loader.loadAsync(anchor.url);
        const model = gltf.scene;
        model.name = `anchor-${anchor.id}`;
        const pos = anchor.position ?? [0, 0, 0];
        const rot = anchor.rotation ?? [0, 0, 0];
        const scl = anchor.scale ?? [1, 1, 1];
        model.position.set(pos[0], pos[1], pos[2]);
        model.rotation.set(rot[0], rot[1], rot[2]);
        model.scale.set(scl[0], scl[1], scl[2]);
        model.visible = false;
        contentRoot.add(model);
      }),
    );
    modelsReady = true;
  })();

  loadPromise.catch((err) => {
    console.error("[AR] 模型加载失败", err);
  });

  function resize() {
    const w = cameraWrap.clientWidth;
    const h = cameraWrap.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function setModelsVisible(visible) {
    contentRoot.children.forEach((child) => {
      child.visible = visible;
    });
  }

  /**
   * @param {{ position: {x,y,z}, rotation: {x,y,z,w} }} pose
   * @param {{ x,y,z,w } | null} gyroQuat Immersal SDK gyroData，无则省略
   * @param {number | null} vFov 垂直 FOV（度）
   */
  function updateCameraFromPose(pose, gyroQuat = null, vFov = null) {
    if (!pose?.position || !pose?.rotation) return;

    hasPose = true;
    setModelsVisible(true);

    const targetPos = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);
    const targetQuat = new THREE.Quaternion(
      pose.rotation.x,
      pose.rotation.y,
      pose.rotation.z,
      pose.rotation.w,
    );

    if (gyroQuat) {
      const qGyro = new THREE.Quaternion(gyroQuat.x, gyroQuat.y, gyroQuat.z, gyroQuat.w);
      targetQuat.multiply(qGyro);
    }

    camera.position.lerp(targetPos, POSE_LERP);
    camera.quaternion.slerp(targetQuat, POSE_LERP);

    if (typeof vFov === "number" && Number.isFinite(vFov)) {
      camera.fov = vFov;
      camera.updateProjectionMatrix();
    }
  }

  function renderFrame() {
    if (hasPose && modelsReady) {
      renderer.render(scene, camera);
    }
  }

  function start() {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(cameraWrap);
    resize();

    const tick = () => {
      renderFrame();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
  }

  function dispose() {
    cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    contentRoot.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m?.dispose());
      }
    });
    renderer.dispose();
    canvas.remove();
  }

  return {
    ready: loadPromise,
    start,
    updateCameraFromPose,
    renderFrame,
    dispose,
  };
}
