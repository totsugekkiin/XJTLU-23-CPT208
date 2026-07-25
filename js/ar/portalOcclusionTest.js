const COMPONENT_NAME = "portal-occlusion-test";

const TARGET_WIDTH_MM = 260;
const OPENING_WIDTH = 200 / TARGET_WIDTH_MM;
const OPENING_HEIGHT = 260 / TARGET_WIDTH_MM;
const WALL_DEPTH = 400 / TARGET_WIDTH_MM;
const WALL_COVERAGE = 1.5;

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else {
      object.material?.dispose();
    }
  });
}

export function registerPortalOcclusionTest() {
  const AFRAME = window.AFRAME;
  if (!AFRAME || AFRAME.components[COMPONENT_NAME]) return;

  const THREE = AFRAME.THREE;

  AFRAME.registerComponent(COMPONENT_NAME, {
    schema: {
      direction: { type: "int", default: -1 },
      occlusion: { type: "boolean", default: true },
    },

    init() {
      this.root = new THREE.Group();
      this.root.name = "portal-occlusion-test";
      this.el.setObject3D(COMPONENT_NAME, this.root);
      this.mask = null;
      this.occluders = [];
      this.build();
    },

    update(oldData) {
      if (!this.root) return;
      if (oldData.direction !== undefined && oldData.direction !== this.data.direction) {
        this.build();
        return;
      }
      this.applyOcclusion();
    },

    remove() {
      disposeObject(this.root);
      this.el.removeObject3D(COMPONENT_NAME);
    },

    build() {
      while (this.root.children.length > 0) {
        const child = this.root.children.pop();
        disposeObject(child);
      }
      this.mask = null;
      this.occluders = [];

      const direction = this.data.direction < 0 ? -1 : 1;
      this.addApertureMask(direction);
      this.addWallOccluders(direction);
      this.addCalibrationFrames(direction);
      this.addTestWorld(direction);
      this.applyOcclusion();
    },

    addApertureMask(direction) {
      const extent = 10;
      const shape = new THREE.Shape();
      shape.moveTo(-extent, -extent);
      shape.lineTo(-extent, extent);
      shape.lineTo(extent, extent);
      shape.lineTo(extent, -extent);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(-OPENING_WIDTH / 2, -OPENING_HEIGHT / 2);
      hole.lineTo(OPENING_WIDTH / 2, -OPENING_HEIGHT / 2);
      hole.lineTo(OPENING_WIDTH / 2, OPENING_HEIGHT / 2);
      hole.lineTo(-OPENING_WIDTH / 2, OPENING_HEIGHT / 2);
      hole.closePath();
      shape.holes.push(hole);

      const material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
      });
      const mask = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
      mask.position.z = direction * 0.002;
      mask.renderOrder = 0;
      mask.frustumCulled = false;
      mask.name = "near-aperture-depth-mask";
      this.root.add(mask);
      this.mask = mask;
    },

    addWallOccluders(direction) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
      });
      const halfDepth = WALL_DEPTH / 2;
      const z = direction * halfDepth;

      const definitions = [
        {
          size: [WALL_COVERAGE, OPENING_HEIGHT + WALL_COVERAGE * 2, WALL_DEPTH],
          position: [-(OPENING_WIDTH + WALL_COVERAGE) / 2, 0, z],
        },
        {
          size: [WALL_COVERAGE, OPENING_HEIGHT + WALL_COVERAGE * 2, WALL_DEPTH],
          position: [(OPENING_WIDTH + WALL_COVERAGE) / 2, 0, z],
        },
        {
          size: [OPENING_WIDTH, WALL_COVERAGE, WALL_DEPTH],
          position: [0, (OPENING_HEIGHT + WALL_COVERAGE) / 2, z],
        },
        {
          size: [OPENING_WIDTH, WALL_COVERAGE, WALL_DEPTH],
          position: [0, -(OPENING_HEIGHT + WALL_COVERAGE) / 2, z],
        },
      ];

      definitions.forEach(({ size, position }, index) => {
        const occluder = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
        occluder.position.set(...position);
        occluder.renderOrder = 1;
        occluder.name = `wall-occluder-${index}`;
        this.root.add(occluder);
        this.occluders.push(occluder);
      });
    },

    addFrame(group, z, color, stencil) {
      const thickness = 0.018;
      const material = stencil
        ? new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true })
        : new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
      const horizontal = new THREE.BoxGeometry(
        OPENING_WIDTH + thickness,
        thickness,
        thickness,
      );
      const vertical = new THREE.BoxGeometry(
        thickness,
        OPENING_HEIGHT,
        thickness,
      );
      const pieces = [
        [horizontal, 0, OPENING_HEIGHT / 2, z],
        [horizontal, 0, -OPENING_HEIGHT / 2, z],
        [vertical, -OPENING_WIDTH / 2, 0, z],
        [vertical, OPENING_WIDTH / 2, 0, z],
      ];
      pieces.forEach(([geometry, x, y, pieceZ]) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, pieceZ);
        mesh.renderOrder = stencil ? 3 : 4;
        group.add(mesh);
      });
    },

    addCalibrationFrames(direction) {
      const frameGroup = new THREE.Group();
      frameGroup.name = "calibration-frames";
      this.addFrame(frameGroup, direction * 0.006, 0xff3b30, false);
      this.addFrame(frameGroup, direction * WALL_DEPTH, 0x30d5ff, true);
      this.root.add(frameGroup);
    },

    addTestWorld(direction) {
      const world = new THREE.Group();
      world.name = "portal-test-world";

      const backZ = direction * (WALL_DEPTH + 2.5);
      const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 2.1),
        new THREE.MeshBasicMaterial({
          color: 0x153b3a,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: true,
        }),
      );
      backdrop.position.set(0, 0.18, backZ);
      backdrop.renderOrder = 2;
      world.add(backdrop);

      const groundDepth = 3.5;
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, groundDepth),
        new THREE.MeshBasicMaterial({
          color: 0x243329,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: true,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -OPENING_HEIGHT / 2 + 0.03, direction * (WALL_DEPTH + 1.75));
      ground.renderOrder = 2;
      world.add(ground);

      const pathMaterial = new THREE.MeshBasicMaterial({
        color: 0xe0b64f,
        depthTest: true,
        depthWrite: true,
      });
      for (let index = 0; index < 7; index += 1) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.24), pathMaterial);
        slab.position.set(
          0,
          -OPENING_HEIGHT / 2 + 0.04,
          direction * (WALL_DEPTH + 0.35 + index * 0.42),
        );
        slab.renderOrder = 3;
        world.add(slab);
      }

      const columnMaterial = new THREE.MeshBasicMaterial({
        color: 0xd96b3b,
        depthTest: true,
        depthWrite: true,
      });
      [
        [-0.48, -0.23, WALL_DEPTH + 0.65, 0.58],
        [0.43, -0.17, WALL_DEPTH + 1.25, 0.72],
        [-0.26, -0.29, WALL_DEPTH + 1.9, 0.46],
      ].forEach(([x, y, depth, height]) => {
        const column = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, height, 0.16),
          columnMaterial,
        );
        column.position.set(x, y, direction * depth);
        column.renderOrder = 3;
        world.add(column);
      });

      const hillMaterial = new THREE.MeshBasicMaterial({
        color: 0x2f7773,
        depthTest: true,
        depthWrite: true,
      });
      [
        [-0.72, -0.18, WALL_DEPTH + 2.25, 0.56],
        [0.72, -0.2, WALL_DEPTH + 2.4, 0.68],
        [0.2, -0.25, WALL_DEPTH + 2.65, 0.48],
      ].forEach(([x, y, depth, radius]) => {
        const hill = new THREE.Mesh(
          new THREE.ConeGeometry(radius, radius * 1.25, 5),
          hillMaterial,
        );
        hill.position.set(x, y, direction * depth);
        hill.renderOrder = 3;
        world.add(hill);
      });

      this.root.add(world);
    },

    applyOcclusion() {
      const enabled = this.data.occlusion;
      if (this.mask) this.mask.visible = enabled;
      this.occluders.forEach((occluder) => {
        occluder.visible = enabled;
      });
    },
  });
}
