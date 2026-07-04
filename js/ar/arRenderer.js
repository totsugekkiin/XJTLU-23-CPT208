import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AR_ANCHORS } from "./arAnchors.js";

const POSE_LERP = 0.22;

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

function normalizeModelScale(model, maxExtent = 8) {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= maxExtent) return;
  const factor = maxExtent / extent;
  model.scale.multiplyScalar(factor);
}

/**
 * 在摄像头画面上叠加 Three.js AR 内容。
 * 采用「固定相机 + 逆变换内容根节点」，与 Immersal Unity XR Space 思路一致。
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
  camera.position.set(0, 0, 0);
  camera.quaternion.set(0, 0, 0, 1);

  const contentRoot = new THREE.Group();
  contentRoot.name = "ar-content-root";
  scene.add(contentRoot);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4, 8, 3);
  scene.add(keyLight);

  const devicePos = new THREE.Vector3();
  const deviceQuat = new THREE.Quaternion();
  const invPos = new THREE.Vector3();
  const invQuat = new THREE.Quaternion();

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
        normalizeModelScale(model);
        model.visible = true;
        contentRoot.add(model);
      }),
    );
    modelsReady = true;
  })();

  loadPromise.catch((err) => {
    loadError = err?.message || String(err);
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

  function bringCanvasToFront() {
    if (canvas.parentElement !== mountEl) {
      mountEl.appendChild(canvas);
    } else {
      mountEl.appendChild(canvas);
    }
  }

  /**
   * @param {{ position: {x,y,z}, rotation: {x,y,z,w} }} pose
   * @param {{ x,y,z,w } | null} gyroQuat
   * @param {number | null} vFov
   */
  function updateCameraFromPose(pose, gyroQuat = null, vFov = null) {
    if (!pose?.position || !pose?.rotation) return;

    hasPose = true;
    devicePos.set(pose.position.x, pose.position.y, pose.position.z);
    deviceQuat.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);

    if (gyroQuat) {
      const qGyro = new THREE.Quaternion(gyroQuat.x, gyroQuat.y, gyroQuat.z, gyroQuat.w);
      deviceQuat.multiply(qGyro);
    }

    invQuat.copy(deviceQuat).invert();
    invPos.copy(devicePos).applyQuaternion(invQuat).negate();

    if (!firstPoseApplied) {
      contentRoot.position.copy(invPos);
      contentRoot.quaternion.copy(invQuat);
      firstPoseApplied = true;
    } else {
      contentRoot.position.lerp(invPos, POSE_LERP);
      contentRoot.quaternion.slerp(invQuat, POSE_LERP);
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
    bringCanvasToFront,
    updateCameraFromPose,
    renderFrame,
    getStatus,
    dispose,
  };
}
