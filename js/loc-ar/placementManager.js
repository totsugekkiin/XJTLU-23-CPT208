import {
  CUBE_COLORS,
  CUBE_SIZE,
  MAX_PLACEMENTS,
  ORIGIN_SPHERE,
} from "./placementConfig.js";

/**
 * @param {HTMLElement} sceneEl
 */
export function createPlacementManager(sceneEl) {
  /** @type {{ lat: number, lng: number, entity: HTMLElement } | null} */
  let origin = null;
  /** @type {Array<{ id: string, label: string, lat: number, lng: number, accuracy: number | null, color: string, entity: HTMLElement }>} */
  let placements = [];

  function getEntities() {
    const entities = [];
    if (origin?.entity) entities.push(origin.entity);
    placements.forEach((p) => entities.push(p.entity));
    return entities;
  }

  /**
   * @param {number} lat
   * @param {number} lng
   * @returns {boolean}
   */
  function setOrigin(lat, lng) {
    if (origin) return false;

    const wrapper = document.createElement("a-entity");
    wrapper.id = "placement-origin";
    wrapper.setAttribute("gps-new-entity-place", {
      latitude: lat,
      longitude: lng,
    });

    const sphere = document.createElement("a-sphere");
    sphere.setAttribute("color", ORIGIN_SPHERE.color);
    sphere.setAttribute("radius", String(ORIGIN_SPHERE.radius));
    sphere.setAttribute("position", `0 ${ORIGIN_SPHERE.radius} 0`);
    sphere.setAttribute("material", "opacity: 0.92; transparent: true");

    const label = document.createElement("a-text");
    label.setAttribute("value", ORIGIN_SPHERE.label);
    label.setAttribute("align", "center");
    label.setAttribute("color", "#f4f1ea");
    label.setAttribute("position", `0 ${ORIGIN_SPHERE.radius * 2 + 0.3} 0`);
    label.setAttribute("scale", "2 2 2");

    wrapper.appendChild(sphere);
    wrapper.appendChild(label);
    sceneEl.appendChild(wrapper);

    origin = { lat, lng, entity: wrapper };
    return true;
  }

  /**
   * @param {number} lat
   * @param {number} lng
   * @param {number | null} accuracy
   * @returns {{ id: string, label: string, lat: number, lng: number, accuracy: number | null, color: string, entity: HTMLElement } | null}
   */
  function placeAt(lat, lng, accuracy = null) {
    if (placements.length >= MAX_PLACEMENTS) return null;

    const index = placements.length;
    const id = `p${index + 1}`;
    const label = `观测点 ${index + 1}`;
    const color = CUBE_COLORS[index % CUBE_COLORS.length];

    const wrapper = document.createElement("a-entity");
    wrapper.id = `placement-${id}`;
    wrapper.setAttribute("data-placement-id", id);
    wrapper.setAttribute("gps-new-entity-place", {
      latitude: lat,
      longitude: lng,
    });

    const box = document.createElement("a-box");
    box.setAttribute("color", color);
    box.setAttribute("depth", String(CUBE_SIZE));
    box.setAttribute("height", String(CUBE_SIZE));
    box.setAttribute("width", String(CUBE_SIZE));
    box.setAttribute("position", `0 ${CUBE_SIZE / 2} 0`);
    box.setAttribute("material", "opacity: 0.92; transparent: true");

    const text = document.createElement("a-text");
    text.setAttribute("value", label);
    text.setAttribute("align", "center");
    text.setAttribute("color", "#f4f1ea");
    text.setAttribute("position", `0 ${CUBE_SIZE + 0.6} 0`);
    text.setAttribute("scale", "2 2 2");

    wrapper.appendChild(box);
    wrapper.appendChild(text);
    sceneEl.appendChild(wrapper);

    const placement = { id, label, lat, lng, accuracy, color, entity: wrapper };
    placements.push(placement);
    return placement;
  }

  function clear() {
    if (origin?.entity) origin.entity.remove();
    placements.forEach((p) => p.entity.remove());
    origin = null;
    placements = [];
  }

  /**
   * Reset origin to current position (clears cubes, re-places sphere).
   * @param {number} lat
   * @param {number} lng
   */
  function resetOrigin(lat, lng) {
    clear();
    setOrigin(lat, lng);
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
    setOrigin,
    placeAt,
    getEntities,
    clear,
    resetOrigin,
  };
}
