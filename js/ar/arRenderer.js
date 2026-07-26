import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { agentDebugLog } from "./agentDebugLog.js";
import { attachBambooNoticeText } from "./bambooNotice.js";
import { createPortalTestScene } from "./portalTestScene.js";

const POSE_LERP = 0.28;
const POSE_LERP_DT_SCALE = 0.025;
const REVEAL_DURATION_MS = 720;
const REVEAL_START_SCALE = 0.72;

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

function createPortalAnchor(anchor, mapId) {
  const [wallDepth = 0.4, apertureHeight = 0.26, apertureWidth = 0.2] = anchor.scale ?? [];
  const root = createPortalTestScene({
    mapId,
    wallDepth,
    apertureHeight,
    apertureWidth,
  });
  root.name = `anchor-${mapId}-${anchor.id}`;
  root.userData.arMapId = mapId;
  root.userData.arAnchorType = "portal";

  const pos = anchor.position ?? [0, 0, 0];
  const rot = anchor.rotation ?? [0, 0, 0];
  root.position.set(pos[0], pos[1], pos[2]);
  root.rotation.set(rot[0], rot[1], rot[2]);

  return root;
}

/**
 * Immersal 官方示例思路：模型固定在地图坐标，相机随设备 pose 移动。
 * 与摆放工具使用同一套地图坐标系，不做额外 scale 归一化。
 */
export function createArRenderer(cameraWrap, options = {}) {
  const { getCameraViewport = null, mapProfiles = [], onAnchorTap = null } = options;
  const canvas = document.createElement("canvas");
  canvas.id = "ar-three-canvas";
  cameraWrap.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    stencil: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let modelsReady = false;
  let hasPose = false;
  let firstPoseApplied = false;
  let loadError = null;
  let frameId = 0;
  let renderCount = 0;
  let resizeObserver = null;
  let agentLastCameraLogAt = 0;
  let lastPoseUpdateTime = 0;
  let activeMapId = mapProfiles.length === 1 ? mapProfiles[0].mapId : null;
  let anchorCount = 0;
  let contentVisible = false;
  let revealStartedAt = 0;

  const loadPromise = (async () => {
    const loader = new GLTFLoader();
    const gltfCache = new Map();
    const loadTasks = [];

    function loadGltf(url) {
      if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url));
      return gltfCache.get(url);
    }

    for (const profile of mapProfiles) {
      for (const anchor of profile.anchors) {
        if (anchor.type === "portal") {
          const portal = createPortalAnchor(anchor, profile.mapId);
          portal.visible = false;
          scene.add(portal);
          loadTasks.push(Promise.resolve());
          continue;
        }
        loadTasks.push(
          loadGltf(anchor.url).then((gltf) => {
            const model = gltf.scene.clone(true);
            model.name = `anchor-${profile.mapId}-${anchor.id}`;
            model.userData.arMapId = profile.mapId;
            if (anchor.type === "bamboo-notice") {
              attachBambooNoticeText(model, {
                ...(Array.isArray(anchor.columns) ? { columns: anchor.columns } : {}),
                anisotropy: renderer.capabilities.getMaxAnisotropy(),
              });
            }
            const pos = anchor.position ?? [0, 0, 0];
            const rot = anchor.rotation ?? [0, 0, 0];
            const scl = anchor.scale ?? [1, 1, 1];
            model.position.set(pos[0], pos[1], pos[2]);
            model.rotation.set(rot[0], rot[1], rot[2]);
            model.scale.set(scl[0], scl[1], scl[2]);
            model.userData.arAnchorId = anchor.id;
            model.userData.arBaseScale = model.scale.clone();
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
              mapId: profile.mapId,
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
      }
    }

    await Promise.all(loadTasks);
    anchorCount = loadTasks.length;
    modelsReady = true;
  })();

  loadPromise.catch((err) => {
    loadError = err?.message || String(err);
    console.error("[AR] 模型加载失败", err);
  });

  function setModelsVisible(visible) {
    scene.children.forEach((child) => {
      if (child.isLight) return;
      if (child.userData?.arMapId == null) return;
      if (!visible) {
        child.visible = false;
        return;
      }
      child.visible = activeMapId == null || child.userData.arMapId === activeMapId;
    });
  }

  function setActiveMapId(mapId) {
    const nextMapId = Number(mapId);
    if (!Number.isFinite(nextMapId)) return;
    activeMapId = nextMapId;
    if (hasPose && contentVisible) setModelsVisible(true);
  }

  function setContentVisible(visible, options = {}) {
    const nextVisible = Boolean(visible);
    if (contentVisible === nextVisible && !options.restart) return;
    contentVisible = nextVisible;
    canvas.classList.toggle("is-interactive", contentVisible);

    if (!contentVisible) {
      setModelsVisible(false);
      return;
    }

    const shouldAnimate = options.animate !== false;
    revealStartedAt = shouldAnimate ? performance.now() : 0;
    setModelsVisible(hasPose);
    scene.children.forEach((child) => {
      if (!child.userData?.arBaseScale) return;
      child.scale.copy(child.userData.arBaseScale);
      if (shouldAnimate) child.scale.multiplyScalar(REVEAL_START_SCALE);
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

    resize();
    hasPose = true;
    if (contentVisible) setModelsVisible(true);

    const now = performance.now();
    const dt = lastPoseUpdateTime ? now - lastPoseUpdateTime : 16;
    lastPoseUpdateTime = now;

    targetPos.set(pose.position.x, pose.position.y, pose.position.z);
    targetQuat.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);

    const usesGyroBlend = Boolean(gyroQuatRaw);
    if (gyroQuatRaw) {
      gyroQuat.set(gyroQuatRaw.x, gyroQuatRaw.y, gyroQuatRaw.z, gyroQuatRaw.w);
      targetQuat.multiply(gyroQuat);
    }

    if (!firstPoseApplied) {
      camera.position.copy(targetPos);
      camera.quaternion.copy(targetQuat);
      firstPoseApplied = true;
    } else if (usesGyroBlend) {
      let step = POSE_LERP_DT_SCALE * dt;
      if (step > 1) step = 1;
      camera.position.lerp(targetPos, step);
      camera.quaternion.slerp(targetQuat, step);
    } else {
      camera.position.lerp(targetPos, POSE_LERP);
      camera.quaternion.slerp(targetQuat, POSE_LERP);
    }

    if (typeof vFov === "number" && Number.isFinite(vFov) && vFov > 10 && vFov < 120) {
      camera.fov = vFov;
      camera.updateProjectionMatrix();
    }

    const logNow = performance.now();
    if (logNow - agentLastCameraLogAt > 1000) {
      agentLastCameraLogAt = logNow;
      // #region agent log
      agentDebugLog("initial", "H1,H4", "js/ar/arRenderer.js:updateCameraFromPose", "Renderer camera transform after applying pose and gyro", {
        inputPose: pose,
        gyroQuatRaw,
        target: {
          position: targetPos.toArray(),
          quaternionAfterGyro: targetQuat.toArray(),
        },
        camera: {
          position: camera.position.toArray(),
          quaternion: camera.quaternion.toArray(),
          fov: camera.fov,
          aspect: camera.aspect,
          near: camera.near,
          far: camera.far,
        },
        viewport: {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          clientWidth: cameraWrap.clientWidth,
          clientHeight: cameraWrap.clientHeight,
          viewportSize: getViewportSize(),
          devicePixelRatio: window.devicePixelRatio,
        },
      });
      // #endregion
    }
  }

  function renderFrame() {
    if (!hasPose || !modelsReady) return;
    if (contentVisible && revealStartedAt) {
      const progress = Math.min(1, (performance.now() - revealStartedAt) / REVEAL_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const scaleFactor = THREE.MathUtils.lerp(REVEAL_START_SCALE, 1, eased);
      scene.children.forEach((child) => {
        if (!child.visible || !child.userData?.arBaseScale) return;
        child.scale.copy(child.userData.arBaseScale).multiplyScalar(scaleFactor);
      });
      if (progress >= 1) revealStartedAt = 0;
    }
    renderer.render(scene, camera);
    renderCount += 1;
  }

  function handleCanvasTap(event) {
    if (!contentVisible || !hasPose || typeof onAnchorTap !== "function") return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      let anchorRoot = hit.object;
      while (anchorRoot && anchorRoot.userData?.arMapId == null) anchorRoot = anchorRoot.parent;
      if (!anchorRoot) continue;
      onAnchorTap({
        mapId: anchorRoot.userData.arMapId,
        anchorId: anchorRoot.userData.arAnchorId ?? null,
      });
      return;
    }
  }

  function getStatus() {
    return {
      modelsReady,
      hasPose,
      loadError,
      renderCount,
      anchorCount,
      activeMapId,
      contentVisible,
    };
  }

  function start() {
    bringCanvasToFront();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(cameraWrap);
    resize();
    canvas.addEventListener("pointerup", handleCanvasTap);

    const tick = () => {
      renderFrame();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
  }

  function dispose() {
    cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    canvas.removeEventListener("pointerup", handleCanvasTap);
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
    setActiveMapId,
    setContentVisible,
    renderFrame,
    getStatus,
    dispose,
  };
}
