const STATIONARY_SPEED = 0.3;
const JITTER_WINDOW = 60;

export class StabilityTracker {
  constructor() {
    this.metrics = {
      gpsAccuracy: null,
      anchorScreenJitter: 0,
      worldPositionJump: 0,
      maxDrift: 0,
    };
    this._screenSamples = [];
    this._lastWorldPos = null;
    this._baselineScreen = null;
  }

  onGpsUpdate(accuracy, speed) {
    this.metrics.gpsAccuracy = accuracy;
    if (speed != null && speed < STATIONARY_SPEED) {
      /* keep jitter window */
    } else {
      this._screenSamples = [];
      this._baselineScreen = null;
    }
  }

  onWorldPositionJump(jumpMeters) {
    if (jumpMeters > this.metrics.worldPositionJump) {
      this.metrics.worldPositionJump = jumpMeters;
    }
  }

  /**
   * @param {THREE.Camera} camera
   * @param {Array<{ object3D: THREE.Object3D }>} anchorEntities
   * @param {number} speed m/s
   */
  tick(camera, anchorEntities, speed) {
    if (!camera || !anchorEntities.length) return;

    const vec = new window.THREE.Vector3();
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    anchorEntities.forEach((entity) => {
      entity.object3D.getWorldPosition(vec);
      vec.project(camera);
      const sx = (vec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-vec.y * 0.5 + 0.5) * window.innerHeight;
      sumX += sx;
      sumY += sy;
      count += 1;
    });

    if (!count) return;

    const cx = sumX / count;
    const cy = sumY / count;

    if (this._baselineScreen == null) {
      this._baselineScreen = { x: cx, y: cy };
    }

    const drift = Math.hypot(cx - this._baselineScreen.x, cy - this._baselineScreen.y);
    if (drift > this.metrics.maxDrift) {
      this.metrics.maxDrift = drift;
    }

    if (speed != null && speed < STATIONARY_SPEED) {
      this._screenSamples.push({ x: cx, y: cy });
      if (this._screenSamples.length > JITTER_WINDOW) {
        this._screenSamples.shift();
      }
      if (this._screenSamples.length >= 10) {
        const meanX =
          this._screenSamples.reduce((s, p) => s + p.x, 0) / this._screenSamples.length;
        const meanY =
          this._screenSamples.reduce((s, p) => s + p.y, 0) / this._screenSamples.length;
        const variance =
          this._screenSamples.reduce(
            (s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2,
            0,
          ) / this._screenSamples.length;
        this.metrics.anchorScreenJitter = Math.sqrt(variance);
      }
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  resetSession() {
    this.metrics.worldPositionJump = 0;
    this.metrics.maxDrift = 0;
    this.metrics.anchorScreenJitter = 0;
    this._screenSamples = [];
    this._baselineScreen = null;
    this._lastWorldPos = null;
  }
}
