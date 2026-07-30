import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { attachBambooNoticeText, getBambooNoticeContent } from "./bambooNotice.js";

const MODEL_URL = "/models/bamboo-notice-ar.glb";

function prepareMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  });
}

export function createBambooBackpackViewer(canvas, options = {}) {
  const { onStatusChange = null } = options;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);
  scene.add(new THREE.HemisphereLight(0xfff2d4, 0x3a2a20, 2.4));

  const keyLight = new THREE.DirectionalLight(0xffdfad, 4.2);
  keyLight.position.set(-2.5, 3.6, 4.5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xb9d6ca, 1.8);
  fillLight.position.set(3, 1.2, 2.5);
  scene.add(fillLight);

  let model = null;
  let noticeText = null;
  let modelSize = new THREE.Vector3(1, 1, 0.2);
  let requestedContentId = null;
  let frameId = 0;
  let disposed = false;
  let visible = true;

  function fitCamera() {
    const host = canvas.parentElement;
    const width = Math.max(1, host?.clientWidth ?? canvas.clientWidth ?? 1);
    const height = Math.max(1, host?.clientHeight ?? canvas.clientHeight ?? 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const widthDistance = modelSize.x / (2 * Math.tan(horizontalFov / 2));
    const heightDistance = modelSize.y / (2 * Math.tan(verticalFov / 2));
    const distance = Math.max(widthDistance, heightDistance, modelSize.z * 2) * 1.18;
    camera.position.set(0, 0, Math.max(0.8, distance));
    camera.near = Math.max(0.001, camera.position.z / 100);
    camera.far = Math.max(20, camera.position.z * 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function setContent(contentId) {
    requestedContentId = getBambooNoticeContent(contentId).id;
    const content = getBambooNoticeContent(requestedContentId);
    noticeText?.update(content.columns);
    onStatusChange?.({ state: model ? "ready" : "loading", content });
  }

  const ready = new GLTFLoader()
    .loadAsync(MODEL_URL)
    .then((gltf) => {
      if (disposed) return;
      model = gltf.scene;
      model.name = "bamboo-backpack-model";
      prepareMaterials(model);
      modelRoot.add(model);

      const initialBounds = new THREE.Box3().setFromObject(model);
      const center = initialBounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.updateMatrixWorld(true);
      modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());

      const content = getBambooNoticeContent(requestedContentId);
      noticeText = attachBambooNoticeText(model, {
        columns: content.columns,
        anisotropy: renderer.capabilities.getMaxAnisotropy(),
      });
      modelRoot.rotation.set(0, 0, 0);
      fitCamera();
      onStatusChange?.({ state: "ready", content });
    })
    .catch((error) => {
      if (disposed) return;
      onStatusChange?.({ state: "error", error });
      throw error;
    });

  const resizeObserver = new ResizeObserver(fitCamera);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  fitCamera();

  function render() {
    if (disposed) return;
    if (visible) {
      // The model never inherits device orientation or drag input: its front
      // face remains locked to this fixed viewer camera.
      modelRoot.rotation.set(0, 0, 0);
      renderer.render(scene, camera);
    }
    frameId = requestAnimationFrame(render);
  }
  frameId = requestAnimationFrame(render);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    noticeText?.dispose();
    scene.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => material?.dispose());
    });
    renderer.dispose();
  }

  return {
    ready,
    setContent,
    setVisible(nextVisible) {
      visible = Boolean(nextVisible);
      if (visible) fitCamera();
    },
    dispose,
  };
}
