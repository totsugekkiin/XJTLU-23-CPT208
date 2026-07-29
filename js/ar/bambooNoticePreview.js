import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  attachBambooNoticeText,
  BAMBOO_NOTICE_LAYOUT,
  BAMBOO_NOTICE_SAMPLE_COLUMNS,
  getDefaultBambooColumnPositions,
} from "./bambooNotice.js";

const MODEL_URL = "/models/bamboo-notice-optimized.glb";
const COLUMN_SLOT_COUNT = BAMBOO_NOTICE_LAYOUT.slotCount;
const TOP_OFFSET = BAMBOO_NOTICE_LAYOUT.topOffset;

function bootstrapBambooNoticePreview() {
  const canvas = document.querySelector("#bamboo-canvas");
  const status = document.querySelector("#bamboo-status");
  const columnsInput = document.querySelector("#bamboo-columns");
  const resetButton = document.querySelector("#bamboo-reset");
  const rotateButton = document.querySelector("#bamboo-rotate");
  const columnControls = document.querySelector("#bamboo-column-controls");
  const resetColumnsButton = document.querySelector("#bamboo-column-reset");
  const copyDataButton = document.querySelector("#bamboo-copy-data");
  const copyFeedback = document.querySelector("#bamboo-copy-feedback");
  const root = document.querySelector("#bamboo-preview");
  if (!canvas || !root) return;

  columnsInput.value = BAMBOO_NOTICE_SAMPLE_COLUMNS.join("\n");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
  camera.position.set(0, 0.31, 1.72);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;
  controls.minDistance = 0.72;
  controls.maxDistance = 3.4;
  controls.target.set(0, 0.3, 0);

  scene.add(new THREE.HemisphereLight(0xfff3d5, 0x5d4538, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffe5bd, 4.4);
  keyLight.position.set(-2.4, 3.6, 4.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xb8d2c3, 2.1);
  rimLight.position.set(3.2, 1.4, -2.5);
  scene.add(rimLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 64),
    new THREE.ShadowMaterial({ color: 0x241710, opacity: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  scene.add(ground);

  let model = null;
  let noticeText = null;
  let columnPositions = getDefaultBambooColumnPositions(
    COLUMN_SLOT_COUNT,
  );

  function getColumns() {
    const lines = columnsInput.value
      .split(/\r?\n/)
      .map((column) => column.trim());
    return Array.from(
      { length: COLUMN_SLOT_COUNT },
      (_, index) => lines[index] ?? "",
    );
  }

  function ensureColumnPositions(columns) {
    const defaults = getDefaultBambooColumnPositions(columns.length);
    columnPositions = columns.map((_, index) =>
      Number.isFinite(columnPositions[index])
        ? columnPositions[index]
        : defaults[index],
    );
  }

  function createColumnControl(column, index) {
    const row = document.createElement("label");
    row.className = "bamboo-column-control";

    const heading = document.createElement("span");
    heading.className = "bamboo-column-control__heading";

    const name = document.createElement("b");
    const preview = Array.from(column).slice(0, 4).join("") || "空列";
    name.textContent = `第 ${index + 1} 列 · ${preview}`;

    const output = document.createElement("output");
    output.value = `${(columnPositions[index] * 100).toFixed(1)}%`;
    output.textContent = output.value;

    heading.append(name, output);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "5";
    slider.max = "95";
    slider.step = "0.1";
    slider.value = (columnPositions[index] * 100).toFixed(1);
    slider.setAttribute("aria-label", `第 ${index + 1} 列水平位置`);
    slider.addEventListener("input", () => {
      columnPositions[index] = Number(slider.value) / 100;
      output.value = `${Number(slider.value).toFixed(1)}%`;
      output.textContent = output.value;
      noticeText?.update(getColumns(), columnPositions);
    });

    const scale = document.createElement("span");
    scale.className = "bamboo-column-control__scale";
    scale.innerHTML = "<i>左</i><i>右</i>";

    row.append(heading, slider, scale);
    return row;
  }

  function renderColumnControls() {
    const columns = getColumns();
    ensureColumnPositions(columns);
    columnControls.replaceChildren(
      ...columns.map((column, index) => createColumnControl(column, index)),
    );
  }

  function resetView() {
    camera.position.set(0, 0.31, 1.72);
    controls.target.set(0, 0.3, 0);
    controls.update();
  }

  function updateText() {
    const columns = getColumns();
    ensureColumnPositions(columns);
    renderColumnControls();
    noticeText?.update(columns, columnPositions);
  }

  function getColumnPositionData() {
    const columns = getColumns();
    ensureColumnPositions(columns);
    return {
      type: "bamboo-notice-column-layout",
      coordinate: "texture-x-normalized",
      readingOrder: "right-to-left",
      layout: {
        ...BAMBOO_NOTICE_LAYOUT,
      },
      columns: columns.map((text, index) => ({
        index: index + 1,
        text,
        x: Number(columnPositions[index].toFixed(4)),
      })),
    };
  }

  async function copyColumnPositionData() {
    const data = JSON.stringify(getColumnPositionData(), null, 2);
    try {
      await navigator.clipboard.writeText(data);
      copyFeedback.textContent = "已复制，可以直接发给我";
      copyDataButton.textContent = "已复制位置数据";
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = data;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
      copyFeedback.textContent = "已复制，可以直接发给我";
      copyDataButton.textContent = "已复制位置数据";
    }
    window.setTimeout(() => {
      copyDataButton.textContent = "复制列位置数据";
      copyFeedback.textContent = "";
    }, 2200);
  }

  new GLTFLoader()
    .loadAsync(MODEL_URL)
    .then((gltf) => {
      model = gltf.scene;
      model.name = "bamboo-notice-preview";
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          if (!material) return;
          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        });
      });
      scene.add(model);
      noticeText = attachBambooNoticeText(model, {
        columns: getColumns(),
        columnPositions,
        topOffsetRatio: TOP_OFFSET,
        anisotropy: renderer.capabilities.getMaxAnisotropy(),
      });
      status.textContent = "竹简与墨迹已加载";
      status.dataset.state = "ready";
      root.classList.add("is-ready");
    })
    .catch((error) => {
      console.error("[Bamboo notice] Failed to load model", error);
      status.textContent = "模型加载失败，请刷新重试";
      status.dataset.state = "error";
    });

  columnsInput.addEventListener("input", updateText);
  resetColumnsButton.addEventListener("click", () => {
    columnPositions = getDefaultBambooColumnPositions(COLUMN_SLOT_COUNT);
    renderColumnControls();
    noticeText?.update(getColumns(), columnPositions);
  });
  copyDataButton.addEventListener("click", copyColumnPositionData);
  resetButton.addEventListener("click", resetView);
  rotateButton.addEventListener("click", () => {
    controls.autoRotate = !controls.autoRotate;
    rotateButton.classList.toggle("is-active", controls.autoRotate);
    rotateButton.textContent = controls.autoRotate ? "暂停旋转" : "自动旋转";
  });
  renderColumnControls();

  const resizeObserver = new ResizeObserver(() => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(root);

  let frameId = 0;
  function render() {
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  }
  render();

  window.addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      noticeText?.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}

bootstrapBambooNoticePreview();
