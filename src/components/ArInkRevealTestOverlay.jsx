import React from "react";

/**
 * TEST VERSION — AR ink-reveal experiment.
 * Remove this component together with js/ar/inkRevealTest.js and
 * css/ar-ink-reveal-test.css to delete the experiment completely.
 */
export function ArInkRevealTestOverlay({ active = false }) {
  return (
    <div
      id="ar-ink-reveal-test"
      className={`ar-ink-reveal-test${active ? " is-active" : ""}`}
      data-test-version="ink-reveal-v1"
      aria-hidden={active ? "false" : "true"}
    >
      <canvas id="ar-ink-reveal-test-canvas" aria-hidden="true" />
      <p id="ar-ink-reveal-test-status" role="status" aria-live="polite">
        正在展开实景…
      </p>
    </div>
  );
}
