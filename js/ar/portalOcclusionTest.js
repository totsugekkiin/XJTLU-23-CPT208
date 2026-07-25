import {
  PORTAL_OPENING_HEIGHT as OPENING_HEIGHT,
  PORTAL_OPENING_WIDTH as OPENING_WIDTH,
  PORTAL_WALL_DEPTH as WALL_DEPTH,
} from "./portalSceneConfig.js";

const COMPONENT_NAME = "portal-occlusion-test";

const WALL_COVERAGE = 1.5;
const DEFAULT_MODEL_URL = "/models/changgate-courtyard-portal.ply";
const MODEL_WIDTH_FACTOR = 3.1;
const EDITOR_HOME_PITCH = 35;
const VIEW_DEPTH_OFFSET = WALL_DEPTH + 0.12;

function findHeaderEnd(bytes) {
  const marker = new TextEncoder().encode("end_header\n");
  outer: for (let index = 0; index <= bytes.length - marker.length; index += 1) {
    for (let offset = 0; offset < marker.length; offset += 1) {
      if (bytes[index + offset] !== marker[offset]) continue outer;
    }
    return index + marker.length;
  }
  throw new Error("PLY header has no end_header marker");
}

async function loadPortalGeometry(url, THREE) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Model request failed with HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const headerEnd = findHeaderEnd(bytes);
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, headerEnd));

  if (!header.includes("format binary_little_endian 1.0")) {
    throw new Error("Portal model must be a binary little-endian PLY");
  }
  const vertexCount = Number(header.match(/element vertex (\d+)/)?.[1] ?? 0);
  const faceCount = Number(header.match(/element face (\d+)/)?.[1] ?? 0);
  if (!vertexCount || !faceCount) {
    throw new Error("Portal model has no vertices or faces");
  }

  const usesDoublePositions =
    header.includes("property double x") &&
    header.includes("property double y") &&
    header.includes("property double z");
  const usesFloatPositions =
    header.includes("property float x") &&
    header.includes("property float y") &&
    header.includes("property float z");
  if (!usesDoublePositions && !usesFloatPositions) {
    throw new Error("Portal model has an unsupported position layout");
  }
  const positionBytes = usesDoublePositions ? 8 : 4;
  const vertexStride = positionBytes * 3 + 3;
  const faceStride = 13;
  const requiredBytes = headerEnd + vertexCount * vertexStride + faceCount * faceStride;
  if (buffer.byteLength < requiredBytes) {
    throw new Error("Portal model is truncated");
  }

  const view = new DataView(buffer);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const readPosition = usesDoublePositions
    ? (offset) => view.getFloat64(offset, true)
    : (offset) => view.getFloat32(offset, true);
  let byteOffset = headerEnd;
  for (let index = 0; index < vertexCount; index += 1) {
    const attributeOffset = index * 3;
    positions[attributeOffset] = readPosition(byteOffset);
    positions[attributeOffset + 1] = readPosition(byteOffset + positionBytes);
    positions[attributeOffset + 2] = readPosition(
      byteOffset + positionBytes * 2,
    );
    const colorOffset = byteOffset + positionBytes * 3;
    colors[attributeOffset] = view.getUint8(colorOffset) / 255;
    colors[attributeOffset + 1] = view.getUint8(colorOffset + 1) / 255;
    colors[attributeOffset + 2] = view.getUint8(colorOffset + 2) / 255;
    byteOffset += vertexStride;
  }

  const indices = new Uint32Array(faceCount * 3);
  for (let index = 0; index < faceCount; index += 1) {
    if (view.getUint8(byteOffset) !== 3) {
      throw new Error("Portal model contains a non-triangle face");
    }
    const attributeOffset = index * 3;
    indices[attributeOffset] = view.getUint32(byteOffset + 1, true);
    indices[attributeOffset + 1] = view.getUint32(byteOffset + 5, true);
    indices[attributeOffset + 2] = view.getUint32(byteOffset + 9, true);
    byteOffset += faceStride;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  return geometry;
}

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
      nearFrame: { type: "boolean", default: true },
      farFrame: { type: "boolean", default: false },
      modelUrl: { type: "asset", default: DEFAULT_MODEL_URL },
      loadModel: { type: "boolean", default: true },
      useViewPose: { type: "boolean", default: false },
      viewX: { type: "number", default: 0 },
      viewY: { type: "number", default: 0 },
      viewZ: { type: "number", default: 0 },
      viewYaw: { type: "number", default: 0 },
      viewPitch: { type: "number", default: EDITOR_HOME_PITCH },
      viewRoll: { type: "number", default: 0 },
      viewFov: { type: "number", default: 75 },
      modelScale: { type: "number", default: 0 },
      modelYaw: { type: "number", default: 0 },
      modelPitch: { type: "number", default: 0 },
      modelRoll: { type: "number", default: 0 },
      modelOffsetX: { type: "number", default: 0 },
      modelOffsetY: { type: "number", default: 0 },
      modelOffsetZ: { type: "number", default: 0 },
    },

    init() {
      this.root = new THREE.Group();
      this.root.name = "portal-occlusion-test";
      this.el.setObject3D(COMPONENT_NAME, this.root);
      this.mask = null;
      this.occluders = [];
      this.modelMesh = null;
      this.modelPose = null;
      this.modelSize = null;
      this.modelCenter = null;
      this.automaticModelScale = 0;
      this.loadGeneration = 0;
      this.build();
    },

    update(oldData) {
      if (!this.root) return;
      const rebuildKeys = [
        "direction",
        "nearFrame",
        "farFrame",
        "modelUrl",
        "loadModel",
      ];
      const transformKeys = [
        "modelScale",
        "useViewPose",
        "viewX",
        "viewY",
        "viewZ",
        "viewYaw",
        "viewPitch",
        "viewRoll",
        "viewFov",
        "modelYaw",
        "modelPitch",
        "modelRoll",
        "modelOffsetX",
        "modelOffsetY",
        "modelOffsetZ",
      ];
      if (
        oldData.direction !== undefined &&
        rebuildKeys.some((key) => oldData[key] !== this.data[key])
      ) {
        this.build();
        return;
      }
      if (
        oldData.direction !== undefined &&
        transformKeys.some((key) => oldData[key] !== this.data[key])
      ) {
        this.applyModelTransform();
      }
      this.applyOcclusion();
    },

    remove() {
      this.loadGeneration += 1;
      disposeObject(this.root);
      this.el.removeObject3D(COMPONENT_NAME);
    },

    build() {
      this.loadGeneration += 1;
      while (this.root.children.length > 0) {
        const child = this.root.children.pop();
        disposeObject(child);
      }
      this.mask = null;
      this.occluders = [];
      this.modelMesh = null;
      this.modelPose = null;
      this.modelSize = null;
      this.modelCenter = null;
      this.automaticModelScale = 0;

      const direction = this.data.direction < 0 ? -1 : 1;
      this.addApertureMask(direction);
      this.addWallOccluders(direction);
      this.addCalibrationFrames(direction);
      if (this.data.loadModel) {
        this.addModelWorld(direction, this.loadGeneration);
      }
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
      if (this.data.nearFrame) {
        this.addFrame(frameGroup, direction * 0.006, 0xff3b30, false);
      }
      if (this.data.farFrame) {
        this.addFrame(frameGroup, direction * WALL_DEPTH, 0x30d5ff, true);
      }
      this.root.add(frameGroup);
    },

    addModelWorld(direction, generation) {
      const world = new THREE.Group();
      world.name = "portal-model-world";
      // Build the model once behind -Z, then mirror the complete world when
      // the debug depth direction is flipped. This preserves the scan's up axis.
      world.scale.z = direction < 0 ? 1 : -1;

      this.root.add(world);
      this.el.emit("portal-model-loading", { url: this.data.modelUrl });

      loadPortalGeometry(this.data.modelUrl, THREE)
        .then((geometry) => {
          if (generation !== this.loadGeneration || !world.parent) {
            geometry.dispose();
            return;
          }

          const bounds = geometry.boundingBox;
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          bounds.getSize(size);
          bounds.getCenter(center);

          // The scan uses X/Y as its ground plane and Z as up. Rotate it into
          // Three.js coordinates, where Y is up and the portal looks along -Z.
          const automaticScale = Math.min(
            (OPENING_WIDTH * MODEL_WIDTH_FACTOR) / Math.max(size.x, 0.001),
            (OPENING_HEIGHT * 1.08) / Math.max(size.z, 0.001),
          );
          geometry.translate(-center.x, -center.y, -center.z);

          const material = new THREE.MeshBasicMaterial({
            vertexColors: geometry.hasAttribute("color"),
            color: geometry.hasAttribute("color") ? 0xffffff : 0xcbbd9f,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: true,
          });
          const model = new THREE.Mesh(geometry, material);
          model.name = "changgate-courtyard-model";
          model.rotation.x = -Math.PI / 2;
          model.renderOrder = 2;
          model.frustumCulled = false;

          const pose = new THREE.Group();
          pose.name = "portal-model-pose";
          pose.rotation.order = "YXZ";
          pose.add(model);
          world.add(pose);

          this.modelMesh = model;
          this.modelPose = pose;
          this.modelSize = size;
          this.modelCenter = center;
          this.automaticModelScale = automaticScale;
          this.applyModelTransform();

          this.el.emit("portal-model-loaded", {
            url: this.data.modelUrl,
            vertices: geometry.getAttribute("position")?.count ?? 0,
            scale:
              this.data.modelScale > 0
                ? this.data.modelScale
                : this.automaticModelScale,
          });
        })
        .catch((error) => {
          if (generation !== this.loadGeneration) return;
          console.error("Unable to load portal PLY model", error);
          this.el.emit("portal-model-error", {
            url: this.data.modelUrl,
            message: error?.message ?? "unknown error",
          });
        });
    },

    applyModelTransform() {
      if (
        !this.modelMesh ||
        !this.modelPose ||
        !this.modelSize ||
        !this.modelCenter
      ) {
        return;
      }

      const modelScale =
        this.data.modelScale > 0
          ? this.data.modelScale
          : this.automaticModelScale;

      this.modelMesh.scale.setScalar(modelScale);
      if (this.data.useViewPose) {
        const radians = THREE.MathUtils.degToRad;
        const axisX = new THREE.Vector3(1, 0, 0);
        const axisZ = new THREE.Vector3(0, 0, 1);
        const cameraBaseRotation = new THREE.Quaternion()
          .setFromAxisAngle(axisX, radians(EDITOR_HOME_PITCH))
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              axisZ,
              radians(180),
            ),
          );
        const sceneUp = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(cameraBaseRotation)
          .normalize();
        const cameraRotation = new THREE.Quaternion()
          .setFromAxisAngle(sceneUp, radians(this.data.viewYaw))
          .multiply(cameraBaseRotation)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              axisX,
              radians(this.data.viewPitch - EDITOR_HOME_PITCH),
            ),
          )
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              axisZ,
              radians(this.data.viewRoll),
            ),
          );
        const inverseCameraRotation = cameraRotation.clone().invert();

        // The editor renders the raw scan through a 180° X correction.
        // Move the centered mesh by the inverse selected camera pose so the
        // MindAR portal opens onto the exact same part of the courtyard.
        const centeredScanPosition = new THREE.Vector3(
          this.modelCenter.x,
          -this.modelCenter.y,
          -this.modelCenter.z,
        );
        const cameraPosition = new THREE.Vector3(
          this.data.viewX,
          this.data.viewY,
          this.data.viewZ,
        );
        this.modelPose.position
          .copy(centeredScanPosition.sub(cameraPosition))
          .applyQuaternion(inverseCameraRotation)
          .multiplyScalar(modelScale);
        this.modelPose.position.z -= VIEW_DEPTH_OFFSET;
        this.modelPose.quaternion
          .copy(inverseCameraRotation)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              axisX,
              radians(-90),
            ),
          );

        const manualRotation = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            radians(this.data.modelPitch),
            radians(this.data.modelYaw),
            radians(this.data.modelRoll),
            "YXZ",
          ),
        );
        this.modelPose.quaternion.premultiply(manualRotation);
        this.modelPose.position.add(
          new THREE.Vector3(
            this.data.modelOffsetX,
            this.data.modelOffsetY,
            this.data.modelOffsetZ,
          ),
        );
      } else {
        const scaledDepth = this.modelSize.y * modelScale;
        const depthCenter = -(
          WALL_DEPTH +
          0.12 +
          scaledDepth / 2
        );
        this.modelPose.position.set(
          this.data.modelOffsetX,
          this.data.modelOffsetY,
          depthCenter + this.data.modelOffsetZ,
        );
        this.modelPose.rotation.set(
          THREE.MathUtils.degToRad(this.data.modelPitch),
          THREE.MathUtils.degToRad(this.data.modelYaw),
          THREE.MathUtils.degToRad(this.data.modelRoll),
        );
      }
      this.el.emit("portal-model-transform", {
        scale: modelScale,
        viewPose: this.data.useViewPose
          ? {
              x: this.data.viewX,
              y: this.data.viewY,
              z: this.data.viewZ,
              yaw: this.data.viewYaw,
              pitch: this.data.viewPitch,
              roll: this.data.viewRoll,
              fov: this.data.viewFov,
            }
          : null,
        yaw: this.data.modelYaw,
        pitch: this.data.modelPitch,
        roll: this.data.modelRoll,
        x: this.data.modelOffsetX,
        y: this.data.modelOffsetY,
        z: this.data.modelOffsetZ,
        resolvedPosition: this.modelPose.position.toArray(),
        resolvedQuaternion: this.modelPose.quaternion.toArray(),
      });
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
