import { ANCHOR_POINTS } from "../anchorConfig.js";
import { adjustedAnchorCoords } from "../calibration.js";

/** @type {Map<string, HTMLElement>} */
export const anchorEntityMap = new Map();

/**
 * @param {HTMLElement} sceneEl
 * @returns {HTMLElement[]}
 */
export function spawnAnchorEntities(sceneEl) {
  anchorEntityMap.clear();
  const created = [];

  ANCHOR_POINTS.forEach((anchor) => {
    const coords = adjustedAnchorCoords(anchor.lat, anchor.lng);
    const wrapper = document.createElement("a-entity");
    wrapper.setAttribute("id", `anchor-${anchor.id}`);
    wrapper.setAttribute("data-anchor-id", anchor.id);
    wrapper.setAttribute("gps-new-entity-place", {
      latitude: coords.lat,
      longitude: coords.lng,
    });

    const box = document.createElement("a-box");
    box.setAttribute("color", anchor.color);
    box.setAttribute("depth", "1");
    box.setAttribute("height", "1");
    box.setAttribute("width", "1");
    box.setAttribute("position", "0 0.5 0");
    box.setAttribute("material", "opacity: 0.92; transparent: true");

    const label = document.createElement("a-text");
    label.setAttribute("value", anchor.label);
    label.setAttribute("align", "center");
    label.setAttribute("color", "#f4f1ea");
    label.setAttribute("position", "0 1.6 0");
    label.setAttribute("scale", "2 2 2");

    wrapper.appendChild(box);
    wrapper.appendChild(label);
    sceneEl.appendChild(wrapper);

    anchorEntityMap.set(anchor.id, wrapper);
    created.push(wrapper);
  });

  return created;
}

/** Re-apply calibration offsets to all anchor entities. */
export function refreshAnchorPositions() {
  ANCHOR_POINTS.forEach((anchor) => {
    const el = anchorEntityMap.get(anchor.id);
    if (!el) return;
    const coords = adjustedAnchorCoords(anchor.lat, anchor.lng);
    el.setAttribute("gps-new-entity-place", {
      latitude: coords.lat,
      longitude: coords.lng,
    });
  });
}
