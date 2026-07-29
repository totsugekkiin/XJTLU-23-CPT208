import * as THREE from "three";

function createBambooNoticeContent(id, label, description, columns) {
  return Object.freeze({
    id,
    label,
    description,
    columns: Object.freeze([...columns]),
  });
}

export const DEFAULT_BAMBOO_NOTICE_CONTENT_ID = "spring-autumn";

export const BAMBOO_NOTICE_CONTENTS = Object.freeze({
  "spring-autumn": createBambooNoticeContent(
    "spring-autumn",
    "春秋时期",
    "阊门的建造、位置和城门功能",
    [
      "春秋时期",
      "传统记载认为",
      "阊门建于公元前514年",
      "当时吴国营建阖闾大城",
      "阊门位于古城西北部",
      "这里同时设有水门和陆门",
      "水陆两门控制人员船只进出",
      "城门也承担城市防御",
      "吴国攻楚时又称破楚门",
    ],
  ),
  tang: createBambooNoticeContent(
    "tang",
    "唐代",
    "白居易、虎丘堤路与山塘河史料争议",
    [
      "唐代",
      "825年白居易任苏州刺史",
      "他修建通往虎丘的堤路",
      "这项工程减少道路积水",
      "也方便船只和行人往来",
      "这条路线后来成为山塘街",
      "后来的地方志说他开河",
      "但早期资料只记载修建堤路",
      "是否新开山塘河仍有争议",
    ],
  ),
  "southern-song": createBambooNoticeContent(
    "southern-song",
    "南宋时期",
    "《平江图》中的水门、陆门及其用途",
    [
      "南宋时期",
      "1229年平江图刻成石碑",
      "图中记录当时的苏州布局",
      "阊门同时设有水门和陆门",
      "水门让船只通过城墙",
      "陆门供人员和车辆通行",
      "两种城门共同控制进出",
      "城内水道通过水门出城",
      "阊门兼有交通和防御功能",
    ],
  ),
  "ming-qing": createBambooNoticeContent(
    "ming-qing",
    "明清时期",
    "阊门商业区的发展与《姑苏繁华图》",
    [
      "明清时期",
      "明代商业中心向阊门发展",
      "街市连接西中市南濠和山塘",
      "河边分布商铺会馆和码头",
      "货物在这里装卸和转运",
      "清代商业规模继续扩大",
      "1759年徐扬完成长卷",
      "画中详细记录阊门街市",
      "这幅画现在称姑苏繁华图",
    ],
  ),
  modern: createBambooNoticeContent(
    "modern",
    "晚清到现代",
    "1860年后的破坏、改建、拆除与修复",
    [
      "晚清到现代",
      "1860年太平军逼近苏州",
      "江苏巡抚下令清军纵火",
      "南濠和山塘等街市被烧毁",
      "阊门商业区受到严重破坏",
      "1934年改建成三孔城门",
      "20世纪50年代被拆除",
      "2004年发现水城门遗址",
      "2006年完成保护修复",
    ],
  ),
});

export const BAMBOO_NOTICE_CONTENT_OPTIONS = Object.freeze(
  Object.values(BAMBOO_NOTICE_CONTENTS),
);

export function getBambooNoticeContent(contentId = DEFAULT_BAMBOO_NOTICE_CONTENT_ID) {
  return BAMBOO_NOTICE_CONTENTS[contentId]
    ?? BAMBOO_NOTICE_CONTENTS[DEFAULT_BAMBOO_NOTICE_CONTENT_ID];
}

const DEFAULT_COLUMNS = getBambooNoticeContent().columns;

export const BAMBOO_NOTICE_LAYOUT = Object.freeze({
  slotCount: 9,
  columnStartX: 0.8006,
  columnGap: 0.0666,
  topOffset: 0.075,
});

export const BAMBOO_NOTICE_COLUMN_POSITIONS = Object.freeze([
  0.8006,
  0.734,
  0.6674,
  0.606,
  0.5342,
  0.457,
  0.392,
  0.33,
  0.2678,
]);

const DEFAULT_OPTIONS = {
  columns: DEFAULT_COLUMNS,
  color: "#6a4027",
  textureWidth: 3072,
  textureHeight: 1800,
  fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
  fontWeight: "400",
  fontSize: 126,
  columnStartX: BAMBOO_NOTICE_LAYOUT.columnStartX,
  columnGapRatio: BAMBOO_NOTICE_LAYOUT.columnGap,
  characterGap: 14,
  columnPositions: BAMBOO_NOTICE_COLUMN_POSITIONS,
  topOffsetRatio: BAMBOO_NOTICE_LAYOUT.topOffset,
  opacity: 0.82,
  widthRatio: 0.79,
  heightRatio: 0.75,
  surfaceOffset: 0.006,
};

function normalizeColumns(columns) {
  if (Array.isArray(columns)) {
    return columns.map((column) => String(column).trim());
  }
  return String(columns ?? "")
    .split(/\r?\n/)
    .map((column) => column.trim());
}

function drawInkColumns(canvas, options) {
  const context = canvas.getContext("2d");
  const columns = normalizeColumns(options.columns);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.fillStyle = options.color;
  context.globalAlpha = options.opacity;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${options.fontWeight} ${options.fontSize}px ${options.fontFamily}`;

  const top = canvas.height * options.topOffsetRatio;
  const lineHeight = options.fontSize + options.characterGap;

  columns.forEach((column, columnIndex) => {
    const configuredPosition = Number(options.columnPositions?.[columnIndex]);
    const x = Number.isFinite(configuredPosition)
      ? THREE.MathUtils.clamp(configuredPosition, 0, 1) * canvas.width
      : (options.columnStartX - columnIndex * options.columnGapRatio) * canvas.width;
    Array.from(column).forEach((character, characterIndex) => {
      const y = top + characterIndex * lineHeight;
      if (y <= canvas.height - options.fontSize * 0.4) {
        context.fillText(character, x, y);
      }
    });
  });
  context.restore();
}

export function createBambooNoticeTexture(userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const canvas = document.createElement("canvas");
  canvas.width = options.textureWidth;
  canvas.height = options.textureHeight;
  drawInkColumns(canvas, options);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "bamboo-notice-ink";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = userOptions.anisotropy ?? 1;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return {
    canvas,
    texture,
    update(columns, columnPositions = options.columnPositions) {
      options.columns = normalizeColumns(columns);
      options.columnPositions = Array.isArray(columnPositions)
        ? [...columnPositions]
        : null;
      drawInkColumns(canvas, options);
      texture.needsUpdate = true;
    },
  };
}

export function attachBambooNoticeText(model, userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const ink = createBambooNoticeTexture(options);
  const geometry = new THREE.PlaneGeometry(
    size.x * options.widthRatio,
    size.y * options.heightRatio,
  );
  const material = new THREE.MeshBasicMaterial({
    map: ink.texture,
    transparent: true,
    opacity: 1,
    alphaTest: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "bamboo-notice-text";
  mesh.position.set(center.x, center.y, bounds.max.z + options.surfaceOffset);
  mesh.renderOrder = 10;
  model.add(mesh);

  return {
    mesh,
    update(columns, columnPositions) {
      ink.update(columns, columnPositions);
    },
    dispose() {
      model.remove(mesh);
      geometry.dispose();
      material.dispose();
      ink.texture.dispose();
    },
  };
}

export function getDefaultBambooColumnPositions(count, userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  return Array.from({ length: count }, (_, index) =>
    THREE.MathUtils.clamp(
      Number.isFinite(options.columnPositions?.[index])
        ? options.columnPositions[index]
        : options.columnStartX - index * options.columnGapRatio,
      0.05,
      0.95,
    ),
  );
}

export { DEFAULT_COLUMNS as BAMBOO_NOTICE_SAMPLE_COLUMNS };
