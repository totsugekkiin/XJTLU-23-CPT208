import * as THREE from "three";
import {
  CUBE_COLORS,
  CUBE_SIZE,
  MAX_PLACEMENTS,
  ORIGIN_MARKER,
} from "./placementConfig.js";

/**
 * @param {THREE.Scene} scene
 */
export function createPlacementManager(scene) {
  const contentRoot = new THREE.Group();
  contentRoot.name = "ar-content-root";
  scene.add(contentRoot);

  /** @type {{ position: THREE.Vector3, object: THREE.Object3D } | null} */
  let origin = null;
  /** @type {Array<{ id: string, label: string, position: THREE.Vector3, color: number, object: THREE.Object3D }>} */
  let placements = [];

  function getEntities() {
    const entities = [];
    if (origin?.object) entities.push(origin.object);
    placements.forEach((p) => entities.push(p.object));
    return entities;
  }

  function createTextSprite(text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const fontSize = 48;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    canvas.width = Math.ceil(metrics.width + 24);
    canvas.height = fontSize + 24;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f1ea";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    const scale = 0.5;
    sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
    return sprite;
  }

  /**
   * Place origin marker at map origin (localization anchor).
   * @returns {boolean}
   */
  function setOriginAtAnchor() {
    if (origin) return false;

    const group = new THREE.Group();
    group.name = "placement-origin";

    const geometry = new THREE.SphereGeometry(ORIGIN_MARKER.radius, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: ORIGIN_MARKER.color,
      transparent: true,
      opacity: 0.92,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.y = ORIGIN_MARKER.radius;
    group.add(sphere);

    const label = createTextSprite(ORIGIN_MARKER.label);
    if (label) {
      label.position.set(0, ORIGIN_MARKER.radius * 2 + 0.35, 0);
      group.add(label);
    }

    const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x4488ff,
      emissiveIntensity: 0.35,
    });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(0, CUBE_SIZE / 2, -1.2);
    group.add(cube);

    contentRoot.add(group);
    origin = { position: new THREE.Vector3(0, 0, 0), object: group };
    return true;
  }

  /**
   * @param {THREE.Vector3} position
   * @returns {typeof placements[0] | null}
   */
  function placeAt(position) {
    if (placements.length >= MAX_PLACEMENTS) return null;

    const index = placements.length;
    const id = `p${index + 1}`;
    const label = `AR 点 ${index + 1}`;
    const color = CUBE_COLORS[index % CUBE_COLORS.length];

    const group = new THREE.Group();
    group.name = `placement-${id}`;
    group.position.copy(position);

    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.92,
    });
    const box = new THREE.Mesh(geometry, material);
    box.position.y = CUBE_SIZE / 2;
    group.add(box);

    const text = createTextSprite(label);
    if (text) {
      text.position.set(0, CUBE_SIZE + 0.45, 0);
      group.add(text);
    }

    contentRoot.add(group);
    const placement = {
      id,
      label,
      position: position.clone(),
      color,
      object: group,
    };
    placements.push(placement);
    return placement;
  }

  /**
   * Place at current camera position (projected to ground y=0).
   * @param {THREE.Camera} camera
   */
  function placeAtCamera(camera) {
    const pos = new THREE.Vector3();
    camera.getWorldPosition(pos);
    pos.y = 0;
    return placeAt(pos);
  }

  function clear() {
    contentRoot.clear();
    origin = null;
    placements = [];
  }

  function resetAnchor() {
    clear();
    setOriginAtAnchor();
  }

  return {
    get origin() {
      return origin;
    },
    get placements() {
      return placements;
    },
    get placementCount() {
      return placements.length;
    },
    get canPlace() {
      return placements.length < MAX_PLACEMENTS;
    },
    setOriginAtAnchor,
    placeAt,
    placeAtCamera,
    getEntities,
    clear,
    resetAnchor,
  };
}
