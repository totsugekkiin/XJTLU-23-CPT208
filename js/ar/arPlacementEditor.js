import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  AR_MAP_PROFILES,
  COMBINED_MAP_IDS,
  DEFAULT_MAP_ID,
  STANDALONE_MAP_ID,
  resolveActiveMapIds,
} from "./arAnchors.js";
import {
  attachBambooNoticeText,
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  getBambooNoticeContent,
} from "./bambooNotice.js";
import { createPortalTestScene, disposePortalTestScene } from "./portalTestScene.js";

const IMMERSAL_BASE = "https://api.immersal.com";
const CLIENT_TOKEN = import.meta.env.VITE_IMMERSAL_TOKEN ?? "";
const CAMERA_KEY_MOVE_SPEED = 4;
const CAMERA_KEY_BOOST = 3;
const DEFAULT_BAMBOO_MODEL_URL = "/models/bamboo-notice-ar.glb";

function radToDeg(r) {
  return (r * 180) / Math.PI;
}

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function vec3FromArray(arr, fallback = 0) {
  return new THREE.Vector3(arr?.[0] ?? fallback, arr?.[1] ?? fallback, arr?.[2] ?? fallback);
}

function eulerFromArray(arr) {
  return new THREE.Euler(arr?.[0] ?? 0, arr?.[1] ?? 0, arr?.[2] ?? 0, "XYZ");
}

function formatNum(n) {
  return Number.parseFloat(n.toFixed(4));
}

function anchorToState(anchor) {
  const type = anchor.type ?? "model";
  return {
    id: anchor.id,
    type,
    label: anchor.label ?? anchor.id,
    url: anchor.url ?? "",
    content: type === "bamboo-notice"
      ? getBambooNoticeContent(anchor.content).id
      : anchor.content ?? null,
    fieldMapPosition: Array.isArray(anchor.fieldMapPosition)
      ? [...anchor.fieldMapPosition]
      : null,
    position: [...(anchor.position ?? [0, 0, 0])],
    rotation: [...(anchor.rotation ?? [0, 0, 0])],
    scale: [...(anchor.scale ?? [1, 1, 1])],
  };
}

function formatAnchorExport(anchor) {
  const pos = anchor.position.map(formatNum);
  const rot = anchor.rotation.map(formatNum);
  const scl = anchor.scale.map(formatNum);
  const typeLine = anchor.type && anchor.type !== "model"
    ? `\n        type: ${JSON.stringify(anchor.type)},`
    : "";
  const urlLine = anchor.url ? `\n        url: ${JSON.stringify(anchor.url)},` : "";
  const contentLine = anchor.content ? `\n        content: ${JSON.stringify(anchor.content)},` : "";
  const fieldMapLine = Array.isArray(anchor.fieldMapPosition)
    ? `\n        fieldMapPosition: [${anchor.fieldMapPosition.map(formatNum).join(", ")}],`
    : "";
  return `      {
        id: ${JSON.stringify(anchor.id)},
        label: ${JSON.stringify(anchor.label)},${typeLine}${urlLine}${contentLine}${fieldMapLine}
        position: [${pos.join(", ")}],
        rotation: [${rot.join(", ")}],
        scale: [${scl.join(", ")}],
      }`;
}

function generateAnchorsModule(profiles) {
  const profilesBody = profiles
    .map((profile) => {
      const anchorsBody = profile.anchors.map(formatAnchorExport).join(",\n");
      const anchorsBlock = anchorsBody ? `${anchorsBody},\n` : "";
      return `  {
    mapId: ${profile.mapId},
    label: ${JSON.stringify(profile.label)},
    anchors: [
${anchorsBlock}
    ],
  }`;
    })
    .join(",\n");

  const defaultMapId = profiles[0]?.mapId ?? DEFAULT_MAP_ID;

  return `/** 摆放控制台的默认编辑地图。 */
export const DEFAULT_MAP_ID = ${defaultMapId};

/** 默认识别模式使用的三张连续区域地图。 */
export const COMBINED_MAP_IDS = Object.freeze([${COMBINED_MAP_IDS.join(", ")}]);

/** 可单独用于识别和锚点标定的新地图。 */
export const STANDALONE_MAP_ID = ${STANDALONE_MAP_ID};

/**
 * 多地图 AR 配置：每张 Immersal 地图可有独立锚点
 * - mapId: Immersal 地图 ID
 * - label: 显示名称
 * - anchors: 该地图坐标系下的模型锚点
 */
export const AR_MAP_PROFILES = [
${profilesBody},
];

export function getAllMapIds() {
  return AR_MAP_PROFILES.map((profile) => profile.mapId);
}

const MAP_ID_ALIASES = new Map();

function normalizeMapId(mapId) {
  const id = Number(mapId);
  return MAP_ID_ALIASES.get(id) ?? id;
}

export function getMapProfile(mapId) {
  const id = normalizeMapId(mapId);
  return AR_MAP_PROFILES.find((profile) => profile.mapId === id) ?? null;
}

export function getAnchorsForMap(mapId) {
  return getMapProfile(mapId)?.anchors ?? [];
}

export function getMapProfilesForIds(mapIds) {
  const idSet = new Set(mapIds.map(normalizeMapId));
  return AR_MAP_PROFILES.filter((profile) => idSet.has(profile.mapId));
}

export function resolveActiveMapIds(options = {}) {
  const search = options.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const selectedValue = options.selectedValue ?? "all";
  const params = new URLSearchParams(search);

  if (params.has("map")) {
    const id = normalizeMapId(params.get("map"));
    if (Number.isFinite(id)) return [id];
  }

  if (params.has("maps")) {
    const ids = params
      .get("maps")
      .split(",")
      .map((part) => normalizeMapId(part.trim()))
      .filter(Number.isFinite);
    if (ids.length > 0) return ids;
  }

  if (selectedValue !== "all") {
    const id = normalizeMapId(selectedValue);
    if (Number.isFinite(id)) return [id];
  }

  return [...COMBINED_MAP_IDS];
}

export function formatMapIdList(mapIds) {
  return mapIds.join(", ");
}

/** @deprecated 使用 DEFAULT_MAP_ID 或 resolveActiveMapIds */
export const IMMERSAL_MAP_ID = DEFAULT_MAP_ID;

/** @deprecated 使用 getAnchorsForMap(mapId) */
export const AR_ANCHORS = getAnchorsForMap(DEFAULT_MAP_ID);
`;
}

export function bootstrapArPlacementEditor(rootEl) {
  const canvas = rootEl.querySelector("#ar-editor-canvas");
  const statusEl = rootEl.querySelector("#ar-editor-status");
  const anchorSelect = rootEl.querySelector("#ar-editor-anchor-select");
  const addBambooBtn = rootEl.querySelector("#ar-editor-add-bamboo");
  const deleteAnchorBtn = rootEl.querySelector("#ar-editor-delete-anchor");
  const loadSparseBtn = rootEl.querySelector("#ar-editor-load-sparse");
  const loadDenseBtn = rootEl.querySelector("#ar-editor-load-dense");
  const refFileInput = rootEl.querySelector("#ar-editor-ref-file");
  const modelFileInput = rootEl.querySelector("#ar-editor-model-file");
  const modeTranslateBtn = rootEl.querySelector("#ar-editor-mode-translate");
  const modeRotateBtn = rootEl.querySelector("#ar-editor-mode-rotate");
  const modeScaleBtn = rootEl.querySelector("#ar-editor-mode-scale");
  const resetCameraBtn = rootEl.querySelector("#ar-editor-reset-camera");
  const exportBtn = rootEl.querySelector("#ar-editor-export");
  const copyBtn = rootEl.querySelector("#ar-editor-copy");
  const importBtn = rootEl.querySelector("#ar-editor-import");
  const importFileInput = rootEl.querySelector("#ar-editor-import-file");
  const toggleRefBtn = rootEl.querySelector("#ar-editor-toggle-ref");
  const toggleGridBtn = rootEl.querySelector("#ar-editor-toggle-grid");
  const mapSelect = rootEl.querySelector("#ar-editor-map-select");
  const mapHintEl = rootEl.querySelector("#ar-editor-map-hint");
  const portalSection = rootEl.querySelector("#ar-editor-portal-section");
  const modelFileField = rootEl.querySelector("#ar-editor-model-file-field");
  const portalSummary = rootEl.querySelector("#ar-editor-portal-summary");
  const nudgeStepSelect = rootEl.querySelector("#ar-editor-nudge-step");
  const resetAnchorBtn = rootEl.querySelector("#ar-editor-reset-anchor");
  const copyCurrentBtn = rootEl.querySelector("#ar-editor-copy-current");
  const bambooContentField = rootEl.querySelector("#ar-editor-bamboo-content-field");
  const bambooContentSelect = rootEl.querySelector("#ar-editor-bamboo-content-select");
  const bambooContentSummary = rootEl.querySelector("#ar-editor-bamboo-content-summary");
  const pointSizeInput = rootEl.querySelector("#ar-editor-point-size");
  const pointSizeOutput = rootEl.querySelector("#ar-editor-point-size-output");
  const pointOpacityInput = rootEl.querySelector("#ar-editor-point-opacity");
  const pointOpacityOutput = rootEl.querySelector("#ar-editor-point-opacity-output");
  const portalOpacityInput = rootEl.querySelector("#ar-editor-portal-opacity");
  const portalOpacityOutput = rootEl.querySelector("#ar-editor-portal-opacity-output");
  const togglePortalTestBtn = rootEl.querySelector("#ar-editor-toggle-portal-test");
  const fineTitle = rootEl.querySelector("#ar-editor-fine-title");
  const focusModelBtn = rootEl.querySelector("#ar-editor-focus-model");
  const readableSizeBtn = rootEl.querySelector("#ar-editor-readable-size");
  const numInputs = {
    px: rootEl.querySelector("#ar-editor-px"),
    py: rootEl.querySelector("#ar-editor-py"),
    pz: rootEl.querySelector("#ar-editor-pz"),
    rx: rootEl.querySelector("#ar-editor-rx"),
    ry: rootEl.querySelector("#ar-editor-ry"),
    rz: rootEl.querySelector("#ar-editor-rz"),
    sx: rootEl.querySelector("#ar-editor-sx"),
    sy: rootEl.querySelector("#ar-editor-sy"),
    sz: rootEl.querySelector("#ar-editor-sz"),
  };

  const profileStates = new Map(
    AR_MAP_PROFILES.map((profile) => [
      profile.mapId,
      {
        mapId: profile.mapId,
        label: profile.label,
        anchors: profile.anchors.map(anchorToState),
      },
    ]),
  );
  const initialAnchorStates = new Map(
    AR_MAP_PROFILES.flatMap((profile) =>
      profile.anchors.map((anchor) => [`${profile.mapId}:${anchor.id}`, anchorToState(anchor)]),
    ),
  );
  const initialMapIds = resolveActiveMapIds({ selectedValue: mapSelect?.value ?? String(DEFAULT_MAP_ID) });
  let activeMapId = initialMapIds[0] ?? AR_MAP_PROFILES[0]?.mapId ?? DEFAULT_MAP_ID;
  let anchorStates = profileStates.get(activeMapId)?.anchors ?? [];
  let activeAnchorId = anchorStates[0]?.id ?? null;
  let referenceRoot = null;
  let referencePointsMaterial = null;
  let referenceVisible = true;
  let gridVisible = true;
  let modelObject = null;
  let portalPreviewMaterials = [];
  let portalTestRoot = null;
  let portalTestDimensionsKey = "";
  let portalTestVisible = true;
  let isSyncingUi = false;
  const pressedKeys = new Set();
  let cameraBoost = false;
  const cameraMoveForward = new THREE.Vector3();
  const cameraMoveRight = new THREE.Vector3();
  const cameraMoveDelta = new THREE.Vector3();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171a1f);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
  camera.position.set(4, 3, 6);

  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;

  const transformControls = new TransformControls(camera, canvas);
  transformControls.setSpace("local");
  scene.add(transformControls.getHelper());

  const grid = new THREE.GridHelper(40, 40, 0x3a4556, 0x252b35);
  grid.position.y = 0;
  scene.add(grid);

  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(4, 8, 2);
  scene.add(dirLight);

  const modelRoot = new THREE.Group();
  modelRoot.name = "ar-model-root";
  scene.add(modelRoot);

  const inactiveAnchorsRoot = new THREE.Group();
  inactiveAnchorsRoot.name = "ar-inactive-anchors-root";
  scene.add(inactiveAnchorsRoot);

  const plyLoader = new PLYLoader();
  const gltfLoader = new GLTFLoader();
  const modelAssetCache = new Map();
  let inactivePreviewVersion = 0;

  bambooContentSelect?.replaceChildren(
    ...BAMBOO_NOTICE_CONTENT_OPTIONS.map((content) => {
      const option = document.createElement("option");
      option.value = content.id;
      option.textContent = `${content.label} · ${content.description}`;
      return option;
    }),
  );

  function getActiveProfile() {
    return profileStates.get(activeMapId) ?? null;
  }

  function saveCurrentProfileAnchors() {
    const profile = getActiveProfile();
    if (!profile) return;
    profile.anchors = anchorStates.map((state) => ({
      ...state,
      position: [...state.position],
      rotation: [...state.rotation],
      scale: [...state.scale],
    }));
  }

  function updateMapHint() {
    if (!mapHintEl) return;
    mapHintEl.textContent = `Map ${activeMapId} · 白色为场景点，绿色为扫描轨迹`;
  }

  function switchMapProfile(mapId) {
    const nextMapId = Number(mapId);
    if (!Number.isFinite(nextMapId) || !profileStates.has(nextMapId)) return;
    saveCurrentProfileAnchors();
    activeMapId = nextMapId;
    if (mapSelect) mapSelect.value = String(activeMapId);
    anchorStates = profileStates.get(activeMapId)?.anchors ?? [];
    activeAnchorId = anchorStates[0]?.id ?? null;
    populateAnchorSelect();
    updateMapHint();
    clearReference();
    inactivePreviewVersion += 1;
    inactiveAnchorsRoot.clear();
    if (activeAnchorId) {
      loadModelFromState(getActiveState());
    } else {
      modelRoot.clear();
      modelObject = null;
      transformControls.detach();
      clearPortalTestWorld();
      setStatus(`Map ${activeMapId} 还没有锚点，请点击“添加竹简”`);
    }
  }

  function getExportProfiles() {
    saveCurrentProfileAnchors();
    return Array.from(profileStates.values()).map((profile) => ({
      mapId: profile.mapId,
      label: profile.label,
      anchors: profile.anchors.map((anchor) => ({
        id: anchor.id,
        type: anchor.type,
        label: anchor.label,
        url: anchor.url,
        content: anchor.content,
        fieldMapPosition: Array.isArray(anchor.fieldMapPosition)
          ? [...anchor.fieldMapPosition]
          : null,
        position: [...anchor.position],
        rotation: [...anchor.rotation],
        scale: [...anchor.scale],
      })),
    }));
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.level = isError ? "error" : "info";
  }

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }

  function getActiveState() {
    return anchorStates.find((a) => a.id === activeAnchorId) ?? null;
  }

  function createBambooAnchorState() {
    const bambooAnchors = anchorStates.filter((anchor) => anchor.type === "bamboo-notice");
    const usedContentIds = new Set(bambooAnchors.map((anchor) => anchor.content));
    const content = BAMBOO_NOTICE_CONTENT_OPTIONS.find(
      (option) => !usedContentIds.has(option.id),
    ) ?? BAMBOO_NOTICE_CONTENT_OPTIONS[bambooAnchors.length % BAMBOO_NOTICE_CONTENT_OPTIONS.length];
    const activeState = getActiveState();
    const source = activeState?.type === "bamboo-notice"
      ? activeState
      : bambooAnchors[bambooAnchors.length - 1];

    let sequence = bambooAnchors.length + 1;
    let id = sequence === 1 ? "bamboo-notice" : `bamboo-notice-${sequence}`;
    const existingIds = new Set(anchorStates.map((anchor) => anchor.id));
    while (existingIds.has(id)) {
      sequence += 1;
      id = `bamboo-notice-${sequence}`;
    }

    const position = source
      ? [source.position[0] + 0.8, source.position[1], source.position[2]]
      : orbitControls.target.toArray();

    return anchorToState({
      id,
      type: "bamboo-notice",
      label: `阊门竹简 ${sequence}`,
      url: source?.url || DEFAULT_BAMBOO_MODEL_URL,
      content: content.id,
      position: position.map(formatNum),
      rotation: source?.rotation ?? [0, 0, 0],
      scale: source?.scale ?? [1, 1, 1],
    });
  }

  async function addBambooAnchor() {
    readStateFromObject();
    const state = createBambooAnchorState();
    anchorStates.push(state);
    initialAnchorStates.set(`${activeMapId}:${state.id}`, anchorToState(state));
    activeAnchorId = state.id;
    populateAnchorSelect();
    await loadModelFromState(state);
    setTransformMode("translate");
    if (modelObject) focusOnObject(modelObject);
    setStatus(`${state.label} 已添加；可拖动 Gizmo 摆放，导出配置后保存`);
  }

  async function deleteCurrentBambooAnchor() {
    const state = getActiveState();
    if (state?.type !== "bamboo-notice") return;
    const confirmed = window.confirm(`删除“${state.label}”？此操作会从本次编辑配置中移除它。`);
    if (!confirmed) return;

    const index = anchorStates.findIndex((anchor) => anchor.id === state.id);
    if (index < 0) return;
    anchorStates.splice(index, 1);
    initialAnchorStates.delete(`${activeMapId}:${state.id}`);
    inactivePreviewVersion += 1;
    inactiveAnchorsRoot.clear();
    activeAnchorId = anchorStates[index]?.id ?? anchorStates[index - 1]?.id ?? null;
    populateAnchorSelect();

    if (activeAnchorId) {
      await loadModelFromState(getActiveState());
    } else {
      modelRoot.clear();
      inactiveAnchorsRoot.clear();
      modelObject = null;
      transformControls.detach();
      clearPortalTestWorld();
      bambooContentField?.setAttribute("hidden", "");
      if (portalSummary) portalSummary.textContent = "";
    }
    setStatus(`${state.label} 已删除；导出配置后保存`);
  }

  function clearPortalTestWorld() {
    if (!portalTestRoot) return;
    scene.remove(portalTestRoot);
    disposePortalTestScene(portalTestRoot);
    portalTestRoot = null;
    portalTestDimensionsKey = "";
  }

  function updatePortalTestWorld(state) {
    if (state?.type !== "portal") {
      clearPortalTestWorld();
      return;
    }
    const dimensionsKey = state.scale.map((value) => formatNum(value)).join(":");
    if (!portalTestRoot || dimensionsKey !== portalTestDimensionsKey) {
      clearPortalTestWorld();
      portalTestRoot = createPortalTestScene({
        mapId: activeMapId,
        wallDepth: state.scale[0],
        apertureHeight: state.scale[1],
        apertureWidth: state.scale[2],
      });
      portalTestDimensionsKey = dimensionsKey;
      scene.add(portalTestRoot);
    }
    portalTestRoot.position.copy(vec3FromArray(state.position));
    portalTestRoot.rotation.copy(eulerFromArray(state.rotation));
    portalTestRoot.visible = portalTestVisible;
  }

  function applyStateToObject(state) {
    if (!modelObject || !state) return;
    modelObject.position.copy(vec3FromArray(state.position));
    modelObject.rotation.copy(eulerFromArray(state.rotation));
    modelObject.scale.copy(vec3FromArray(state.scale, 1));
    updatePortalTestWorld(state);
  }

  function decorateModelForEditing(model, state) {
    if (state.type === "bamboo-notice") {
      const content = getBambooNoticeContent(state.content);
      state.content = content.id;
      model.userData.bambooNoticeText = attachBambooNoticeText(model, {
        columns: content.columns,
        anisotropy: renderer.capabilities.getMaxAnisotropy(),
      });
    }

    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.userData.arNaturalSize = size.toArray();

    if (state.type === "bamboo-notice") {
      const arrowLength = Math.max(size.x, size.y) * 0.32;
      const frontArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(center.x, center.y, bounds.max.z + 0.025),
        arrowLength,
        0xffc857,
        arrowLength * 0.28,
        arrowLength * 0.16,
      );
      frontArrow.name = "bamboo-front-indicator";
      model.add(frontArrow);
    }
  }

  function readStateFromObject() {
    const state = getActiveState();
    if (!modelObject || !state) return;
    state.position = [
      formatNum(modelObject.position.x),
      formatNum(modelObject.position.y),
      formatNum(modelObject.position.z),
    ];
    state.rotation = [
      formatNum(modelObject.rotation.x),
      formatNum(modelObject.rotation.y),
      formatNum(modelObject.rotation.z),
    ];
    state.scale = [
      formatNum(modelObject.scale.x),
      formatNum(modelObject.scale.y),
      formatNum(modelObject.scale.z),
    ];
    updatePortalTestWorld(state);
    syncUiFromState();
  }

  function syncUiFromState() {
    const state = getActiveState();
    if (!state || isSyncingUi) return;
    isSyncingUi = true;
    numInputs.px.value = String(state.position[0]);
    numInputs.py.value = String(state.position[1]);
    numInputs.pz.value = String(state.position[2]);
    numInputs.rx.value = String(radToDeg(state.rotation[0]));
    numInputs.ry.value = String(radToDeg(state.rotation[1]));
    numInputs.rz.value = String(radToDeg(state.rotation[2]));
    numInputs.sx.value = String(state.scale[0]);
    numInputs.sy.value = String(state.scale[1]);
    numInputs.sz.value = String(state.scale[2]);
    Object.entries(numInputs).forEach(([key, input]) => {
      const output = rootEl.querySelector(`#ar-editor-${key}-readout`);
      if (output) output.value = Number.parseFloat(input.value || "0").toFixed(3);
    });
    const isPortal = state.type === "portal";
    const isBambooNotice = state.type === "bamboo-notice";
    bambooContentField?.toggleAttribute("hidden", !isBambooNotice);
    if (isBambooNotice) {
      const content = getBambooNoticeContent(state.content);
      state.content = content.id;
      if (bambooContentSelect) bambooContentSelect.value = content.id;
      if (bambooContentSummary) {
        bambooContentSummary.textContent = `${content.description}。共 ${content.columns.length} 列，选择后会立即更新模型预览。`;
      }
    }
    portalSection?.removeAttribute("hidden");
    modelFileField?.toggleAttribute("hidden", isPortal);
    rootEl.querySelector("#ar-editor-model-tools")?.toggleAttribute("hidden", isPortal);
    rootEl.querySelectorAll(".ar-portal-only").forEach((element) => {
      element.toggleAttribute("hidden", !isPortal);
    });
    if (fineTitle) fineTitle.textContent = isPortal ? "遮罩精调" : "模型精调";
    const sxLabel = rootEl.querySelector("#ar-editor-sx-label");
    const syLabel = rootEl.querySelector("#ar-editor-sy-label");
    const szLabel = rootEl.querySelector("#ar-editor-sz-label");
    const nudgeSxLabel = rootEl.querySelector("#ar-editor-nudge-sx-label");
    const nudgeSyLabel = rootEl.querySelector("#ar-editor-nudge-sy-label");
    const nudgeSzLabel = rootEl.querySelector("#ar-editor-nudge-sz-label");
    if (sxLabel) sxLabel.textContent = isPortal ? "墙深 X" : "缩放 X";
    if (syLabel) syLabel.textContent = isPortal ? "洞高 Y" : "缩放 Y";
    if (szLabel) szLabel.textContent = isPortal ? "洞宽 Z" : "缩放 Z";
    if (nudgeSxLabel) nudgeSxLabel.textContent = isPortal ? "墙深 X" : "缩放 X";
    if (nudgeSyLabel) nudgeSyLabel.textContent = isPortal ? "洞高 Y" : "缩放 Y";
    if (nudgeSzLabel) nudgeSzLabel.textContent = isPortal ? "洞宽 Z" : "缩放 Z";
    if (portalSummary) {
      const lines = [
        `position: [${state.position.map((value) => formatNum(value)).join(", ")}]`,
        `rotation: [${state.rotation.map((value) => formatNum(value)).join(", ")}]`,
        `rotation°:[${state.rotation.map((value) => formatNum(radToDeg(value))).join(", ")}]`,
        `scale:    [${state.scale.map((value) => formatNum(value)).join(", ")}]${isPortal ? "  // 墙深, 洞高, 洞宽" : ""}`,
      ];
      const naturalSize = modelObject?.userData?.arNaturalSize;
      if (!isPortal && Array.isArray(naturalSize)) {
        const physicalSize = naturalSize.map((value, index) =>
          Math.abs(value * state.scale[index]),
        );
        lines.push(`实际尺寸: ${(physicalSize[0] * 100).toFixed(1)} × ${(physicalSize[1] * 100).toFixed(1)} × ${(physicalSize[2] * 100).toFixed(1)} cm`);
        lines.push("正面方向: 模型本地 +Z（黄色箭头）");
      }
      if (isBambooNotice) {
        const content = getBambooNoticeContent(state.content);
        lines.push(`竹简内容: ${content.label} (${content.id})`);
      }
      portalSummary.textContent = lines.join("\n");
    }
    isSyncingUi = false;
  }

  function applyUiToState() {
    const state = getActiveState();
    if (!state || isSyncingUi) return;
    state.position = [
      Number.parseFloat(numInputs.px.value) || 0,
      Number.parseFloat(numInputs.py.value) || 0,
      Number.parseFloat(numInputs.pz.value) || 0,
    ];
    state.rotation = [
      degToRad(Number.parseFloat(numInputs.rx.value) || 0),
      degToRad(Number.parseFloat(numInputs.ry.value) || 0),
      degToRad(Number.parseFloat(numInputs.rz.value) || 0),
    ];
    state.scale = [
      Number.parseFloat(numInputs.sx.value) || 1,
      Number.parseFloat(numInputs.sy.value) || 1,
      Number.parseFloat(numInputs.sz.value) || 1,
    ];
    applyStateToObject(state);
    syncUiFromState();
  }

  function nudgeField(field, sign) {
    const input = numInputs[field];
    if (!input) return;
    const baseStep = Number.parseFloat(nudgeStepSelect?.value || "0.005");
    const step = field.startsWith("r") ? 0.5 : baseStep;
    const next = (Number.parseFloat(input.value) || 0) + sign * step;
    input.value = String(formatNum(next));
    applyUiToState();
  }

  function focusOnObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 1);
    orbitControls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius * 1.4, radius * 0.9, radius * 1.4));
    orbitControls.update();
  }

  function setAnchorView(view) {
    const state = getActiveState();
    if (!modelObject || !state) return;

    const target = modelObject.position.clone();
    const box = new THREE.Box3().setFromObject(modelObject);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length(), 0.25);
    const isPortal = state.type === "portal";
    const offsets = {
      entrance: isPortal
        ? new THREE.Vector3(radius * 4, 0, 0)
        : new THREE.Vector3(0, 0, radius * 4),
      perspective: isPortal
        ? new THREE.Vector3(radius * 3, radius * 1.8, radius * 2.6)
        : new THREE.Vector3(radius * 2.2, radius * 1.5, radius * 3.2),
      side: isPortal
        ? new THREE.Vector3(0, radius * 0.2, radius * 4)
        : new THREE.Vector3(radius * 4, 0, 0),
      top: new THREE.Vector3(0, radius * 4, 0.001),
    };
    const localOffset = offsets[view] ?? offsets.perspective;
    localOffset.applyQuaternion(modelObject.quaternion);
    camera.position.copy(target).add(localOffset);
    camera.up.set(0, 1, 0).applyQuaternion(modelObject.quaternion);
    camera.lookAt(target);
    orbitControls.target.copy(target);
    orbitControls.update();
  }

  function setReadableBambooSize() {
    const state = getActiveState();
    const naturalSize = modelObject?.userData?.arNaturalSize;
    if (state?.type !== "bamboo-notice" || !Array.isArray(naturalSize) || !naturalSize[0]) return;
    const uniformScale = 0.7 / naturalSize[0];
    state.scale = [uniformScale, uniformScale, uniformScale].map(formatNum);
    applyStateToObject(state);
    syncUiFromState();
    focusOnObject(modelObject);
    setStatus("竹简已预设为约 70 cm 宽；这是预览参数，复制或导出后才会写回配置");
  }

  function updatePointAppearance() {
    const size = Number.parseFloat(pointSizeInput?.value || "0.018");
    const opacity = Number.parseFloat(pointOpacityInput?.value || "1");
    if (referencePointsMaterial) {
      referencePointsMaterial.size = size;
      referencePointsMaterial.opacity = opacity;
      referencePointsMaterial.transparent = opacity < 1;
      referencePointsMaterial.needsUpdate = true;
    }
    if (pointSizeOutput) pointSizeOutput.value = size.toFixed(3);
    if (pointOpacityOutput) pointOpacityOutput.value = `${Math.round(opacity * 100)}%`;
  }

  function updatePortalAppearance() {
    const opacity = Number.parseFloat(portalOpacityInput?.value || "0.28");
    portalPreviewMaterials.forEach((material) => {
      material.opacity = opacity;
      material.needsUpdate = true;
    });
    if (portalOpacityOutput) portalOpacityOutput.value = `${Math.round(opacity * 100)}%`;
  }

  function isTypingTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }

  const CAMERA_MOVE_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyQ",
    "KeyE",
    "PageUp",
    "PageDown",
  ]);

  function moveCameraFromKeys(delta) {
    if (!orbitControls.enabled || pressedKeys.size === 0) return;

    cameraMoveDelta.set(0, 0, 0);
    camera.getWorldDirection(cameraMoveForward);
    cameraMoveForward.y = 0;
    if (cameraMoveForward.lengthSq() > 1e-8) {
      cameraMoveForward.normalize();
      cameraMoveRight.crossVectors(cameraMoveForward, camera.up).normalize();
    } else {
      cameraMoveForward.set(0, 0, -1);
      cameraMoveRight.set(1, 0, 0);
    }

    if (pressedKeys.has("ArrowUp") || pressedKeys.has("KeyW")) cameraMoveDelta.add(cameraMoveForward);
    if (pressedKeys.has("ArrowDown") || pressedKeys.has("KeyS")) cameraMoveDelta.sub(cameraMoveForward);
    if (pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA")) cameraMoveDelta.sub(cameraMoveRight);
    if (pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD")) cameraMoveDelta.add(cameraMoveRight);
    if (pressedKeys.has("KeyQ") || pressedKeys.has("PageUp")) cameraMoveDelta.y += 1;
    if (pressedKeys.has("KeyE") || pressedKeys.has("PageDown")) cameraMoveDelta.y -= 1;

    if (cameraMoveDelta.lengthSq() === 0) return;

    const speed = CAMERA_KEY_MOVE_SPEED * (cameraBoost ? CAMERA_KEY_BOOST : 1) * delta;
    cameraMoveDelta.normalize().multiplyScalar(speed);
    camera.position.add(cameraMoveDelta);
    orbitControls.target.add(cameraMoveDelta);
  }

  function onCameraKeyDown(event) {
    if (isTypingTarget(event.target)) return;

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      cameraBoost = true;
      return;
    }

    if (!CAMERA_MOVE_KEYS.has(event.code)) return;
    event.preventDefault();
    pressedKeys.add(event.code);
  }

  function onCameraKeyUp(event) {
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      cameraBoost = false;
      return;
    }
    pressedKeys.delete(event.code);
  }

  function onCameraWindowBlur() {
    pressedKeys.clear();
    cameraBoost = false;
  }

  function clearReference() {
    if (referenceRoot) {
      scene.remove(referenceRoot);
      referenceRoot.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      referenceRoot = null;
      referencePointsMaterial = null;
    }
  }

  function addPlyGeometry(geometry, label) {
    clearReference();
    geometry.computeVertexNormals();

    const hasColors = Boolean(geometry.getAttribute("color"));
    const material = new THREE.PointsMaterial({
      size: Number.parseFloat(pointSizeInput?.value || "0.018"),
      sizeAttenuation: true,
      vertexColors: hasColors,
      color: hasColors ? 0xffffff : 0xddff19,
      opacity: Number.parseFloat(pointOpacityInput?.value || "1"),
      transparent: Number.parseFloat(pointOpacityInput?.value || "1") < 1,
    });
    referencePointsMaterial = material;

    const points = new THREE.Points(geometry, material);
    referenceRoot = new THREE.Group();
    referenceRoot.name = "map-reference";
    referenceRoot.add(points);
    referenceRoot.visible = referenceVisible;
    scene.add(referenceRoot);
    focusOnObject(referenceRoot);
    setStatus(`${label} 已加载（${geometry.getAttribute("position").count} 点）`);
  }

  function addGltfScene(gltfScene, label) {
    clearReference();
    referenceRoot = new THREE.Group();
    referenceRoot.name = "map-reference";
    referenceRoot.add(gltfScene);
    referenceRoot.visible = referenceVisible;
    scene.add(referenceRoot);
    focusOnObject(referenceRoot);
    setStatus(`${label} 已加载`);
  }

  async function loadImmersalPly(kind) {
    if (!CLIENT_TOKEN) {
      setStatus("未配置 VITE_IMMERSAL_TOKEN，请用本地文件导入点云/网格", true);
      return;
    }
    const endpoint = kind === "dense" ? "dense" : "sparse";
    setStatus(`正在下载 Map ${activeMapId} ${endpoint} 点云…`);
    try {
      const url = `${IMMERSAL_BASE}/${endpoint}?token=${encodeURIComponent(CLIENT_TOKEN)}&id=${activeMapId}`;
      const geometry = await plyLoader.loadAsync(url);
      addPlyGeometry(geometry, kind === "dense" ? "稠密点云" : "稀疏点云");
    } catch (err) {
      setStatus(`点云加载失败：${err?.message || err}`, true);
    }
  }

  async function loadReferenceFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    setStatus(`正在加载 ${file.name}…`);
    try {
      const url = URL.createObjectURL(file);
      if (name.endsWith(".ply")) {
        const geometry = await plyLoader.loadAsync(url);
        URL.revokeObjectURL(url);
        addPlyGeometry(geometry, file.name);
      } else if (name.endsWith(".glb") || name.endsWith(".gltf")) {
        const gltf = await gltfLoader.loadAsync(url);
        URL.revokeObjectURL(url);
        addGltfScene(gltf.scene, file.name);
      } else {
        setStatus("仅支持 .ply / .glb / .gltf 参考文件", true);
      }
    } catch (err) {
      setStatus(`参考文件加载失败：${err?.message || err}`, true);
    }
  }

  function loadModelAsset(url) {
    if (!modelAssetCache.has(url)) {
      const promise = gltfLoader.loadAsync(url).catch((error) => {
        modelAssetCache.delete(url);
        throw error;
      });
      modelAssetCache.set(url, promise);
    }
    return modelAssetCache.get(url);
  }

  async function refreshInactiveAnchorPreviews() {
    const version = ++inactivePreviewVersion;
    const previewMapId = activeMapId;
    inactiveAnchorsRoot.clear();

    const previewStates = anchorStates.filter(
      (state) => state.id !== activeAnchorId && state.type !== "portal" && state.url,
    );

    await Promise.all(previewStates.map(async (state) => {
      try {
        const gltf = await loadModelAsset(state.url);
        if (version !== inactivePreviewVersion || previewMapId !== activeMapId) return;
        const preview = gltf.scene.clone(true);
        preview.name = `inactive-anchor-${state.id}`;
        preview.traverse((node) => {
          if (node.isMesh) node.frustumCulled = false;
        });
        if (state.type === "bamboo-notice") {
          const content = getBambooNoticeContent(state.content);
          attachBambooNoticeText(preview, {
            columns: content.columns,
            anisotropy: renderer.capabilities.getMaxAnisotropy(),
          });
        }
        preview.position.copy(vec3FromArray(state.position));
        preview.rotation.copy(eulerFromArray(state.rotation));
        preview.scale.copy(vec3FromArray(state.scale, 1));
        inactiveAnchorsRoot.add(preview);
      } catch (error) {
        console.warn(`[AR editor] 无法预览锚点 ${state.id}`, error);
      }
    }));
  }

  async function loadModelFromState(state) {
    modelRoot.clear();
    modelObject = null;
    portalPreviewMaterials = [];
    transformControls.detach();

    if (state.type === "portal") {
      const portalPreview = new THREE.Group();
      const loopSegments = (x) => [
        x, -0.5, -0.5, x, -0.5, 0.5,
        x, -0.5, 0.5, x, 0.5, 0.5,
        x, 0.5, 0.5, x, 0.5, -0.5,
        x, 0.5, -0.5, x, -0.5, -0.5,
      ];
      const frontGeometry = new THREE.BufferGeometry();
      frontGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(loopSegments(0), 3),
      );
      portalPreview.add(
        new THREE.LineSegments(frontGeometry, new THREE.LineBasicMaterial({ color: 0x38d9ff })),
      );

      const backGeometry = new THREE.BufferGeometry();
      backGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(loopSegments(-1), 3),
      );
      portalPreview.add(
        new THREE.LineSegments(backGeometry, new THREE.LineBasicMaterial({ color: 0xffc857 })),
      );

      const tunnelGeometry = new THREE.BufferGeometry();
      tunnelGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            0, -0.5, -0.5, -1, -0.5, -0.5,
            0, -0.5, 0.5, -1, -0.5, 0.5,
            0, 0.5, 0.5, -1, 0.5, 0.5,
            0, 0.5, -0.5, -1, 0.5, -0.5,
          ],
          3,
        ),
      );
      portalPreview.add(
        new THREE.LineSegments(tunnelGeometry, new THREE.LineBasicMaterial({ color: 0xffffff })),
      );

      const apertureMaterial = new THREE.MeshBasicMaterial({
        color: 0x7deaff,
        transparent: true,
        opacity: Number.parseFloat(portalOpacityInput?.value || "0.28"),
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      portalPreviewMaterials.push(apertureMaterial);
      const aperture = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), apertureMaterial);
      aperture.rotation.y = Math.PI / 2;
      aperture.position.x = -0.998;
      portalPreview.add(aperture);

      const direction = new THREE.ArrowHelper(
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        1,
        0xffc857,
        0.12,
        0.07,
      );
      direction.name = "portal-depth-direction";
      portalPreview.add(direction);

      modelObject = portalPreview;
      modelObject.name = `anchor-${state.id}`;
      applyStateToObject(state);
      modelRoot.add(modelObject);
      transformControls.attach(modelObject);
      syncUiFromState();
      refreshInactiveAnchorPreviews();
      setStatus(`Portal 已加载：${state.label}（X/Y/Z = 墙深/洞高/洞宽）`);
      return;
    }

    setStatus(`正在加载模型 ${state.label}…`);
    try {
      const gltf = await loadModelAsset(state.url);
      modelObject = gltf.scene.clone(true);
      modelObject.name = `anchor-${state.id}`;
      decorateModelForEditing(modelObject, state);
      applyStateToObject(state);
      modelRoot.add(modelObject);
      transformControls.attach(modelObject);
      syncUiFromState();
      refreshInactiveAnchorPreviews();
      setStatus(`模型已加载：${state.label}`);
    } catch (err) {
      setStatus(`模型加载失败：${err?.message || err}`, true);
    }
  }

  async function loadModelFile(file) {
    if (!file || !activeAnchorId) return;
    const state = getActiveState();
    if (!state) return;
    const url = URL.createObjectURL(file);
    try {
      const gltf = await gltfLoader.loadAsync(url);
      state.url = url;
      modelRoot.clear();
      modelObject = gltf.scene;
      decorateModelForEditing(modelObject, state);
      applyStateToObject(state);
      modelRoot.add(modelObject);
      transformControls.attach(modelObject);
      syncUiFromState();
      refreshInactiveAnchorPreviews();
      setStatus(`已替换当前锚点模型：${file.name}`);
    } catch (err) {
      setStatus(`模型文件加载失败：${err?.message || err}`, true);
    }
  }

  function populateAnchorSelect() {
    if (!anchorSelect) return;
    anchorSelect.replaceChildren(
      ...anchorStates.map((a) => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.label;
        return opt;
      }),
    );
    anchorSelect.value = activeAnchorId ?? "";
    anchorSelect.disabled = anchorStates.length === 0;
    if (deleteAnchorBtn) {
      deleteAnchorBtn.disabled = getActiveState()?.type !== "bamboo-notice";
    }
  }

  function setTransformMode(mode) {
    transformControls.setMode(mode);
    modeTranslateBtn?.classList.toggle("is-active", mode === "translate");
    modeRotateBtn?.classList.toggle("is-active", mode === "rotate");
    modeScaleBtn?.classList.toggle("is-active", mode === "scale");
  }

  function exportConfig() {
    const moduleText = generateAnchorsModule(getExportProfiles());
    const blob = new Blob([moduleText], { type: "text/javascript;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "arAnchors.js";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("已下载 arAnchors.js，请覆盖 js/ar/arAnchors.js");
    return moduleText;
  }

  async function copyConfig() {
    const text = generateAnchorsModule(getExportProfiles());
    try {
      await navigator.clipboard.writeText(text);
      setStatus("配置已复制到剪贴板");
    } catch {
      setStatus("复制失败，请使用导出按钮", true);
    }
  }

  async function copyCurrentAnchor() {
    const state = getActiveState();
    if (!state) return;
    const text = JSON.stringify(
      {
        mapId: activeMapId,
        id: state.id,
        type: state.type,
        label: state.label,
        url: state.url,
        content: state.content,
        fieldMapPosition: state.fieldMapPosition
          ? state.fieldMapPosition.map(formatNum)
          : null,
        position: state.position.map(formatNum),
        rotation: state.rotation.map(formatNum),
        scale: state.scale.map(formatNum),
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(text);
      setStatus("当前锚点参数和内容已复制");
    } catch {
      setStatus("复制失败，请从下方参数框手动复制", true);
    }
  }

  function resetCurrentAnchor() {
    const state = getActiveState();
    const initial = state && initialAnchorStates.get(`${activeMapId}:${state.id}`);
    if (!state || !initial) return;
    state.position = [...initial.position];
    state.rotation = [...initial.rotation];
    state.scale = [...initial.scale];
    state.content = initial.content;
    if (state.type === "bamboo-notice") {
      const content = getBambooNoticeContent(state.content);
      modelObject?.userData?.bambooNoticeText?.update(content.columns);
    }
    applyStateToObject(state);
    syncUiFromState();
    setStatus("已恢复代码中的初始锚点参数和内容");
  }

  function importConfigFromJson(data) {
    if (Array.isArray(data?.profiles)) {
      data.profiles.forEach((profile, index) => {
        const mapId = Number(profile.mapId);
        if (!Number.isFinite(mapId)) return;
        profileStates.set(mapId, {
          mapId,
          label: profile.label ?? `Map ${mapId}`,
          anchors: (profile.anchors ?? []).map((item, anchorIndex) =>
            anchorToState({
              id: item.id ?? `anchor-${anchorIndex}`,
              type: item.type,
              label: item.label ?? item.id ?? `锚点 ${anchorIndex + 1}`,
              url: item.url ?? AR_MAP_PROFILES[0]?.anchors[0]?.url ?? "",
              content: item.content,
              fieldMapPosition: item.fieldMapPosition,
              position: item.position,
              rotation: item.rotation,
              scale: item.scale,
            }),
          ),
        });
      });
      populateMapSelect();
      switchMapProfile(Number(data.profiles[0]?.mapId) || activeMapId);
      return;
    }

    if (!Array.isArray(data?.anchors) && !Array.isArray(data)) {
      throw new Error("JSON 需包含 profiles 或 anchors 数组");
    }
    const list = Array.isArray(data?.anchors) ? data.anchors : data;
    anchorStates = list.map((item, index) =>
      anchorToState({
        id: item.id ?? `anchor-${index}`,
        type: item.type,
        label: item.label ?? item.id ?? `锚点 ${index + 1}`,
        url: item.url ?? AR_MAP_PROFILES[0]?.anchors[0]?.url ?? "",
        content: item.content,
        fieldMapPosition: item.fieldMapPosition,
        position: item.position,
        rotation: item.rotation,
        scale: item.scale,
      }),
    );
    const profile = getActiveProfile();
    if (profile) profile.anchors = anchorStates;
    activeAnchorId = anchorStates[0]?.id ?? null;
    populateAnchorSelect();
    if (activeAnchorId) loadModelFromState(getActiveState());
  }

  function populateMapSelect() {
    if (!mapSelect) return;
    mapSelect.replaceChildren(
      ...Array.from(profileStates.values()).map((profile) => {
        const opt = document.createElement("option");
        opt.value = String(profile.mapId);
        opt.textContent = `${profile.label} (${profile.mapId})`;
        return opt;
      }),
    );
    mapSelect.value = String(activeMapId);
  }

  transformControls.addEventListener("dragging-changed", (event) => {
    orbitControls.enabled = !event.value;
  });

  transformControls.addEventListener("objectChange", () => {
    readStateFromObject();
  });

  Object.values(numInputs).forEach((input) => {
    input?.addEventListener("input", applyUiToState);
  });

  rootEl.querySelectorAll("[data-ar-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      nudgeField(button.dataset.arNudge, Number(button.dataset.arSign) || 1);
    });
  });

  rootEl.querySelectorAll("[data-ar-view]").forEach((button) => {
    button.addEventListener("click", () => setAnchorView(button.dataset.arView));
  });

  focusModelBtn?.addEventListener("click", () => {
    if (modelObject) focusOnObject(modelObject);
  });
  readableSizeBtn?.addEventListener("click", setReadableBambooSize);

  pointSizeInput?.addEventListener("input", updatePointAppearance);
  pointOpacityInput?.addEventListener("input", updatePointAppearance);
  portalOpacityInput?.addEventListener("input", updatePortalAppearance);
  togglePortalTestBtn?.addEventListener("click", () => {
    portalTestVisible = !portalTestVisible;
    if (portalTestRoot) portalTestRoot.visible = portalTestVisible;
    togglePortalTestBtn.textContent = portalTestVisible
      ? "隐藏透视测试场景"
      : "显示透视测试场景";
    togglePortalTestBtn.classList.toggle("ar-editor-primary", portalTestVisible);
  });

  mapSelect?.addEventListener("change", () => {
    switchMapProfile(mapSelect.value);
    if (CLIENT_TOKEN) loadImmersalPly("sparse");
  });

  anchorSelect?.addEventListener("change", () => {
    activeAnchorId = anchorSelect.value;
    const state = getActiveState();
    if (state) loadModelFromState(state);
  });

  addBambooBtn?.addEventListener("click", async () => {
    addBambooBtn.disabled = true;
    try {
      await addBambooAnchor();
    } catch (error) {
      setStatus(`添加竹简失败：${error?.message || error}`, true);
    } finally {
      addBambooBtn.disabled = false;
    }
  });

  deleteAnchorBtn?.addEventListener("click", async () => {
    deleteAnchorBtn.disabled = true;
    try {
      await deleteCurrentBambooAnchor();
    } finally {
      deleteAnchorBtn.disabled = getActiveState()?.type !== "bamboo-notice";
    }
  });

  bambooContentSelect?.addEventListener("change", () => {
    const state = getActiveState();
    if (state?.type !== "bamboo-notice") return;
    const content = getBambooNoticeContent(bambooContentSelect.value);
    state.content = content.id;
    modelObject?.userData?.bambooNoticeText?.update(content.columns);
    syncUiFromState();
    setStatus(`竹简内容已切换：${content.label}`);
  });

  loadSparseBtn?.addEventListener("click", () => loadImmersalPly("sparse"));
  loadDenseBtn?.addEventListener("click", () => loadImmersalPly("dense"));
  refFileInput?.addEventListener("change", () => {
    const file = refFileInput.files?.[0];
    refFileInput.value = "";
    loadReferenceFile(file);
  });
  modelFileInput?.addEventListener("change", () => {
    const file = modelFileInput.files?.[0];
    modelFileInput.value = "";
    loadModelFile(file);
  });

  modeTranslateBtn?.addEventListener("click", () => setTransformMode("translate"));
  modeRotateBtn?.addEventListener("click", () => setTransformMode("rotate"));
  modeScaleBtn?.addEventListener("click", () => setTransformMode("scale"));

  resetCameraBtn?.addEventListener("click", () => {
    if (referenceRoot) focusOnObject(referenceRoot);
    else if (modelObject) focusOnObject(modelObject);
    else {
      orbitControls.target.set(0, 0, 0);
      camera.position.set(4, 3, 6);
      orbitControls.update();
    }
  });

  exportBtn?.addEventListener("click", exportConfig);
  copyBtn?.addEventListener("click", copyConfig);
  copyCurrentBtn?.addEventListener("click", copyCurrentAnchor);
  resetAnchorBtn?.addEventListener("click", resetCurrentAnchor);

  importBtn?.addEventListener("click", () => importFileInput?.click());
  importFileInput?.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    importFileInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      importConfigFromJson(JSON.parse(text));
      setStatus(`已导入 ${file.name}`);
    } catch (err) {
      setStatus(`导入失败：${err?.message || err}`, true);
    }
  });

  toggleRefBtn?.addEventListener("click", () => {
    referenceVisible = !referenceVisible;
    if (referenceRoot) referenceRoot.visible = referenceVisible;
    toggleRefBtn.textContent = referenceVisible ? "隐藏点云" : "显示点云";
  });

  toggleGridBtn?.addEventListener("click", () => {
    gridVisible = !gridVisible;
    grid.visible = gridVisible;
    axes.visible = gridVisible;
    toggleGridBtn.textContent = gridVisible ? "隐藏网格" : "显示网格";
  });

  const ro = new ResizeObserver(resize);
  ro.observe(rootEl);

  window.addEventListener("keydown", onCameraKeyDown);
  window.addEventListener("keyup", onCameraKeyUp);
  window.addEventListener("blur", onCameraWindowBlur);

  let frameId = 0;
  let lastFrameTime = performance.now();
  const tick = (now) => {
    const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    moveCameraFromKeys(delta);
    orbitControls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(tick);
  };

  populateMapSelect();
  populateAnchorSelect();
  updateMapHint();
  setTransformMode("translate");
  updatePointAppearance();
  updatePortalAppearance();
  resize();
  tick();

  if (CLIENT_TOKEN) {
    loadImmersalPly("sparse");
  } else {
    setStatus("未配置 VITE_IMMERSAL_TOKEN：可上传本地 sparse.ply，或配置 .env 后刷新");
  }

  if (activeAnchorId) {
    loadModelFromState(getActiveState());
  }

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("keydown", onCameraKeyDown);
    window.removeEventListener("keyup", onCameraKeyUp);
    window.removeEventListener("blur", onCameraWindowBlur);
    pressedKeys.clear();
    ro.disconnect();
    transformControls.detach();
    transformControls.dispose();
    orbitControls.dispose();
    clearReference();
    clearPortalTestWorld();
    renderer.dispose();
  };
}
