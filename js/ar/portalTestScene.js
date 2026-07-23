import * as THREE from "three";

const STENCIL_REF = 1;
const APERTURE_RENDER_ORDER = 100;
const CONTENT_RENDER_ORDER = 101;

export function createPortalPlaneGeometry(width, height, x = 0) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        x, -halfHeight, halfWidth,
        x, -halfHeight, -halfWidth,
        x, halfHeight, -halfWidth,
        x, halfHeight, halfWidth,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function createCalibrationTexture(mapId) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#59b9dc");
  gradient.addColorStop(0.58, "#e5bd70");
  gradient.addColorStop(1, "#58372d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(36, 25, 24, 0.94)";
  ctx.beginPath();
  ctx.moveTo(0, 590);
  ctx.lineTo(180, 420);
  ctx.lineTo(340, 585);
  ctx.lineTo(530, 365);
  ctx.lineTo(730, 580);
  ctx.lineTo(885, 445);
  ctx.lineTo(1024, 590);
  ctx.lineTo(1024, 768);
  ctx.lineTo(0, 768);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(16, 18, 20, 0.82)";
  ctx.fillRect(318, 322, 388, 92);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`PORTAL ${mapId}`, 512, 368);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function withStencil(material) {
  material.stencilWrite = true;
  material.stencilRef = STENCIL_REF;
  material.stencilFunc = THREE.EqualStencilFunc;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  return material;
}

function addContentMesh(root, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, withStencil(material));
  mesh.position.set(position[0], position[1], position[2]);
  mesh.renderOrder = CONTENT_RENDER_ORDER;
  mesh.frustumCulled = false;
  root.add(mesh);
  return mesh;
}

/**
 * 创建用于验证 Portal 裁剪、透视和视差的程序化三维世界。
 * 本地坐标约定：入口在 X=0，-X 穿过墙体并进入虚拟世界。
 */
export function createPortalTestScene({
  mapId,
  wallDepth,
  apertureHeight,
  apertureWidth,
}) {
  const root = new THREE.Group();
  root.name = `portal-test-world-${mapId}`;

  const apertureMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: STENCIL_REF,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  const aperture = new THREE.Mesh(
    createPortalPlaneGeometry(apertureWidth, apertureHeight, -Math.abs(wallDepth)),
    apertureMaterial,
  );
  aperture.name = "portal-exit-stencil";
  aperture.renderOrder = APERTURE_RENDER_ORDER;
  aperture.frustumCulled = false;
  root.add(aperture);

  const groundY = -0.28;
  addContentMesh(
    root,
    new THREE.BoxGeometry(4.8, 0.04, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x384a3d, roughness: 0.95 }),
    [-2.75, groundY, 0],
  );

  const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xd9c27a });
  for (const x of [-0.8, -1.25, -1.7, -2.15, -2.6, -3.05]) {
    addContentMesh(
      root,
      new THREE.BoxGeometry(0.18, 0.006, 0.035),
      laneMaterial.clone(),
      [x, groundY + 0.024, 0],
    );
  }

  addContentMesh(
    root,
    new THREE.BoxGeometry(0.32, 0.62, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xc9553d, roughness: 0.72 }),
    [-0.82, 0.03, -0.34],
  );
  addContentMesh(
    root,
    new THREE.SphereGeometry(0.16, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x55b7c7, roughness: 0.42 }),
    [-1.35, -0.02, 0.28],
  );
  addContentMesh(
    root,
    new THREE.BoxGeometry(0.46, 0.92, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xd09b3c, roughness: 0.8 }),
    [-2.05, 0.18, -0.48],
  );
  addContentMesh(
    root,
    new THREE.CylinderGeometry(0.18, 0.23, 1.15, 20),
    new THREE.MeshStandardMaterial({ color: 0x7657b8, roughness: 0.68 }),
    [-2.8, 0.3, 0.52],
  );

  const backgroundTexture = createCalibrationTexture(mapId);
  const background = new THREE.Mesh(
    createPortalPlaneGeometry(3.8, 2.5, -4.35),
    withStencil(
      new THREE.MeshBasicMaterial({
        map: backgroundTexture,
        side: THREE.DoubleSide,
        depthWrite: true,
      }),
    ),
  );
  background.name = "portal-test-background";
  background.renderOrder = CONTENT_RENDER_ORDER;
  background.frustumCulled = false;
  root.add(background);

  return root;
}

export function disposePortalTestScene(root) {
  root?.traverse((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      material?.map?.dispose?.();
      material?.dispose?.();
    });
  });
}
