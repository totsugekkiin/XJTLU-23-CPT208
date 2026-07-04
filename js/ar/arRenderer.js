import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AR_ANCHORS } from "./arAnchors.js";

const POSE_LERP = 0.28;

function prepareModelMaterials(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      material.side = THREE.DoubleSide;
      material.depthWrite = true;
      material.transparent = Boolean(material.transparent && material.opacity < 1);
      material.needsUpdate = true;
    });
  });
}

/**
 * Immersal 官方示例思路：模型固定在地图坐标，相机随设备 pose 移动。
 * 与摆放工具使用同一套地图坐标系，不做额外 scale 归一化。
 */
export function createArRenderer(mountEl, cameraWrap) {
  const canvas = document.createElement("canvas");
  canvas.id = "ar-three-canvas";
  mountEl.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 500);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4, 8, 3);
  scene.add(keyLight);

  const targetPos = new THREE.Vector3();
  const targetQuat = new THREE.Quaternion();
  const gyroQuat = new THREE.Quaternion();

  let modelsReady = false;
  let hasPose = false;
  let firstPoseApplied = false;
  let loadError = null;
  let frameId = 0;
  let renderCount = 0;
  let resizeObserver = null;

  const loadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      AR_ANCHORS.map(async (anchor) => {
        const gltf = await loader.loadAsync(anchor.url);
        const model = gltf.scene.clone(true);
        model.name = `anchor-${anchor.id}`;
        const pos = anchor.position ?? [0, 0, 0];
        const rot = anchor.rotation ?? [0, 0, 0];
        const scl = anchor.scale ?? [1, 1, 1];
        model.position.set(pos[0], pos[1], pos[2]);
        model.rotation.set(rot[0], rot[1], rot[2]);
        model.scale.set(scl[0], scl[1], scl[2]);
        prepareModelMaterials(model);
        model.visible = false;
        scene.add(model);
      }),
    );
    modelsReady = true;
  })();

  loadPromise.catch((err) => {
    loadError = err?.message || String(err);
    console.error("[AR] 模型加载失败", err);
  });

  function setModelsVisible(visible) {
    scene.children.forEach((child) => {
      if (child.isLight) return;
      child.visible = visible;
    });
  }

  function resize() {
    const w = cameraWrap.clientWidth;
    const h = cameraWrap.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function bringCanvasToFront() {
    mountEl.appendChild(canvas);
  }

  /**
   * @param {{ position: {x,y,z}, rotation: {x,y,z,w} }} pose
   * @param {{ x,y,z,w } | null} gyroQuatRaw Immersal gyroData（与官方示例一致，乘到 rotation 上）
   * @param {number | null} vFov
   */
  function updateCameraFromPose(pose, gyroQuatRaw = null, vFov = null) {
    if (!pose?.position || !pose?.rotation) return;

    hasPose = true;
    setModelsVisible(true);

    targetPos.set(pose.position.x, pose.position.y, pose.position.z);
    targetQuat.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);

    if (gyroQuatRaw) {
      gyroQuat.set(gyroQuatRaw.x, gyroQuatRaw.y, gyroQuatRaw.z, gyroQuatRaw.w);
      targetQuat.multiply(gyroQuat);
    }

    if (!firstPoseApplied) {
      camera.position.copy(targetPos);
      camera.quaternion.copy(targetQuat);
      firstPoseApplied = true;
    } else {
      camera.position.lerp(targetPos, POSE_LERP);
      camera.quaternion.slerp(targetQuat, POSE_LERP);
    }

    if (typeof vFov === "number" && Number.isFinite(vFov) && vFov > 10 && vFov < 120) {
      camera.fov = vFov;
      camera.updateProjectionMatrix();
    }
  }

  function renderFrame() {
    if (!hasPose || !modelsReady) return;
    renderer.render(scene, camera);
    renderCount += 1;
  }

  function getStatus() {
    return {
      modelsReady,
      hasPose,
      loadError,
      renderCount,
      anchorCount: AR_ANCHORS.length,
    };
  }

  function start() {
    bringCanvasToFront();
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
    scene.traverse((obj) => {
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
    bringCanvasToFront,
    updateCameraFromPose,
    renderFrame,
    getStatus,
    dispose,
  };
}
