import * as THREE from "three";
import {
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  BAMBOO_NOTICE_CONTENTS,
  DEFAULT_BAMBOO_NOTICE_CONTENT_ID,
  getBambooNoticeContent,
} from "../content/changmenExperienceContent.js";

export {
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  BAMBOO_NOTICE_CONTENTS,
  DEFAULT_BAMBOO_NOTICE_CONTENT_ID,
  getBambooNoticeContent,
};

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
  color: "#241108",
  strokeColor: "#100704",
  strokeWidth: 3,
  textureWidth: 3072,
  textureHeight: 1800,
  fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
  fontWeight: "600",
  fontSize: 132,
  columnStartX: BAMBOO_NOTICE_LAYOUT.columnStartX,
  columnGapRatio: BAMBOO_NOTICE_LAYOUT.columnGap,
  characterGap: 14,
  columnPositions: BAMBOO_NOTICE_COLUMN_POSITIONS,
  topOffsetRatio: BAMBOO_NOTICE_LAYOUT.topOffset,
  opacity: 0.98,
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
  context.lineJoin = "round";
  context.strokeStyle = options.strokeColor;
  context.lineWidth = options.strokeWidth;
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
        if (options.strokeWidth > 0) {
          context.strokeText(character, x, y);
        }
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
