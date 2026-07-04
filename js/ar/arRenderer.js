import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AR_ANCHORS } from "./arAnchors.js";
import { agentDebugLog } from "./agentDebugLog.js";

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
export function createArRenderer(cameraWrap, options = {}) {
  const { getCameraViewport = null } = options;
  const canvas = document.createElement("canvas");
  canvas.id = "ar-three-canvas";
  cameraWrap.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 10000);

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
  let renderTick = null;
  let afterRenderTick = null;
  let lastViewportWidth = 0;
  let lastViewportHeight = 0;
  let lastAppliedFov = camera.fov;

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
        model.updateMatrixWorld(true);
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        model.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
        const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion, "XYZ");
        const worldBox = new THREE.Box3().setFromObject(model);
        const worldBoxSize = worldBox.getSize(new THREE.Vector3());
        // #region agent log
        agentDebugLog("initial", "H3,H5", "js/ar/arRenderer.js:modelLoad", "Anchor model loaded with renderer world transform", {
          anchor: {
            id: anchor.id,
            position: pos,
            rotation: rot,
            scale: scl,
          },
          local: {
            position: model.position.toArray(),
            rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
            quaternion: model.quaternion.toArray(),
            scale: model.scale.toArray(),
          },
          world: {
            position: worldPosition.toArray(),
            quaternion: worldQuaternion.toArray(),
            euler: [worldEuler.x, worldEuler.y, worldEuler.z],
            scale: worldScale.toArray(),
            boxSize: worldBoxSize.toArray(),
          },
        });
        // #endregion
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

  function getViewportSize() {
    const source = getCameraViewport?.();
    if (source?.width && source?.height) {
      return {
        width: source.width,
        height: source.height,
      };
    }
    return {
      width: cameraWrap.clientWidth,
      height: cameraWrap.clientHeight,
    };
  }

  function resize() {
    const { width: w, height: h } = getViewportSize();
    if (!w || !h) return;
    if (w === lastViewportWidth && h === lastViewportHeight) return;
    lastViewportWidth = w;
    lastViewportHeight = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  function bringCanvasToFront() {
    cameraWrap.appendChild(canvas);
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

    camera.position.copy(targetPos);
    camera.quaternion.copy(targetQuat);
    firstPoseApplied = true;

    if (
      typeof vFov === "number" &&
      Number.isFinite(vFov) &&
      vFov > 10 &&
      vFov < 120 &&
      Math.abs(vFov - lastAppliedFov) > 0.01
    ) {
      camera.fov = vFov;
      lastAppliedFov = vFov;
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

  function setRenderTick(fn) {
    renderTick = typeof fn === "function" ? fn : null;
  }

  function setAfterRenderTick(fn) {
    afterRenderTick = typeof fn === "function" ? fn : null;
  }

  function start() {
    bringCanvasToFront();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(cameraWrap);
    resize();

    const tick = (now) => {
      renderTick?.(now);
      renderFrame();
      afterRenderTick?.(now);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
  }

  function dispose() {
    renderTick = null;
    afterRenderTick = null;
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
    resize,
    updateCameraFromPose,
    setRenderTick,
    setAfterRenderTick,
    renderFrame,
    getStatus,
    dispose,
  };
}
