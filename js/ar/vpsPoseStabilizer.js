const DEFAULT_OPTIONS = Object.freeze({
  historySize: 8,
  stationaryRadius: 0.3,
  baseJumpAllowance: 0.35,
  jumpAllowancePerSecond: 1.2,
  maxJumpAllowanceSeconds: 1,
  candidateConsistencyDistance: 0.5,
  rotationJumpAllowance: 20 * Math.PI / 180,
  candidateConsistencyAngle: 15 * Math.PI / 180,
  hardJumpDistance: 3,
  hardRotationJump: 60 * Math.PI / 180,
  jumpConfirmations: 2,
  hardJumpConfirmations: 3,
  stationaryPositionAlpha: 0.18,
  movingPositionAlpha: 0.42,
  confirmedJumpPositionAlpha: 0.65,
  serverPositionAlpha: 0.12,
  rotationAlpha: 0.2,
  maxPredictionDistance: 0.12,
  predictionFullMs: 80,
  predictionFadeMs: 450,
});

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clonePosition(position) {
  if (!position) return null;
  const next = {
    x: Number(position.x),
    y: Number(position.y),
    z: Number(position.z),
  };
  return isFiniteNumber(next.x) && isFiniteNumber(next.y) && isFiniteNumber(next.z)
    ? next
    : null;
}

function normalizeQuaternion(rotation) {
  if (!rotation) return null;
  const next = {
    x: Number(rotation.x),
    y: Number(rotation.y),
    z: Number(rotation.z),
    w: Number(rotation.w),
  };
  if (![next.x, next.y, next.z, next.w].every(isFiniteNumber)) return null;
  const length = Math.hypot(next.x, next.y, next.z, next.w);
  if (length < 1e-6) return null;
  next.x /= length;
  next.y /= length;
  next.z /= length;
  next.w /= length;
  return next;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerpPosition(a, b, alpha) {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
  };
}

function slerpQuaternion(a, b, alpha) {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw;

  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (dot > 0.9995) {
    return normalizeQuaternion({
      x: a.x + (bx - a.x) * alpha,
      y: a.y + (by - a.y) * alpha,
      z: a.z + (bz - a.z) * alpha,
      w: a.w + (bw - a.w) * alpha,
    });
  }

  const theta0 = Math.acos(Math.min(1, Math.max(-1, dot)));
  const sinTheta0 = Math.sin(theta0);
  const theta = theta0 * alpha;
  const s0 = Math.cos(theta) - dot * Math.sin(theta) / sinTheta0;
  const s1 = Math.sin(theta) / sinTheta0;
  return normalizeQuaternion({
    x: s0 * a.x + s1 * bx,
    y: s0 * a.y + s1 * by,
    z: s0 * a.z + s1 * bz,
    w: s0 * a.w + s1 * bw,
  });
}

function quaternionAngle(a, b) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
}

function robustHistoryCenter(history) {
  if (history.length === 1) return { ...history[0] };

  const mean = history.reduce(
    (sum, item) => ({ x: sum.x + item.x, y: sum.y + item.y, z: sum.z + item.z }),
    { x: 0, y: 0, z: 0 },
  );
  mean.x /= history.length;
  mean.y /= history.length;
  mean.z /= history.length;

  if (history.length <= 2) return mean;
  const variance = history.reduce((sum, item) => sum + distance(item, mean) ** 2, 0) / history.length;
  const inliers = history.filter((item) => distance(item, mean) ** 2 <= variance);
  if (inliers.length === 0) return mean;

  const center = inliers.reduce(
    (sum, item) => ({ x: sum.x + item.x, y: sum.y + item.y, z: sum.z + item.z }),
    { x: 0, y: 0, z: 0 },
  );
  center.x /= inliers.length;
  center.y /= inliers.length;
  center.z /= inliers.length;
  return center;
}

function smoothstep(edge0, edge1, value) {
  if (edge1 <= edge0) return value < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Stabilizes low-frequency VPS measurements without pretending they are SLAM.
 * A short, clamped TrackerPlugin prediction is allowed after an accepted pose;
 * isolated spatial jumps are held until repeated measurements confirm them.
 */
export function createVpsPoseStabilizer(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let activeMapId = null;
  let lastObservedCounter = null;
  let lastAcceptedAt = 0;
  let lastAcceptedRawPosition = null;
  let filteredPosition = null;
  let filteredRotation = null;
  let latestSource = "unknown";
  let latestLatencyMs = 0;
  let history = [];
  let pendingJump = null;
  let rejectedMeasurements = 0;
  let acceptedMeasurements = 0;

  function reset(mapId = null) {
    activeMapId = mapId;
    lastObservedCounter = null;
    lastAcceptedAt = 0;
    lastAcceptedRawPosition = null;
    filteredPosition = null;
    filteredRotation = null;
    latestSource = "unknown";
    latestLatencyMs = 0;
    history = [];
    pendingJump = null;
    rejectedMeasurements = 0;
    acceptedMeasurements = 0;
  }

  function acceptMeasurement(position, rotation, timestamp, source, latencyMs, confirmedJump = false) {
    const movement = filteredPosition ? distance(filteredPosition, position) : 0;
    history.push({ ...position });
    if (history.length > config.historySize) history.shift();

    if (!filteredPosition) {
      filteredPosition = { ...position };
      filteredRotation = { ...rotation };
    } else {
      const isStationary = movement <= config.stationaryRadius && !confirmedJump;
      const targetPosition = isStationary ? robustHistoryCenter(history) : position;
      let positionAlpha = confirmedJump
        ? config.confirmedJumpPositionAlpha
        : isStationary
          ? config.stationaryPositionAlpha
          : config.movingPositionAlpha;
      if (source === "server") positionAlpha = Math.min(positionAlpha, config.serverPositionAlpha);
      filteredPosition = lerpPosition(filteredPosition, targetPosition, positionAlpha);
      filteredRotation = slerpQuaternion(filteredRotation, rotation, config.rotationAlpha);
    }

    lastAcceptedRawPosition = { ...position };
    lastAcceptedAt = timestamp;
    latestSource = source;
    latestLatencyMs = latencyMs;
    pendingJump = null;
    acceptedMeasurements += 1;
  }

  function observe(measurement) {
    const timestamp = Number.isFinite(measurement?.timestamp)
      ? measurement.timestamp
      : performance.now();
    const mapId = measurement?.mapId ?? null;
    const counter = measurement?.counter ?? null;
    const position = clonePosition(measurement?.position);
    const rotation = normalizeQuaternion(measurement?.rotation);
    const source = measurement?.source ?? "unknown";
    const latencyMs = Number.isFinite(measurement?.latencyMs) ? Math.max(0, measurement.latencyMs) : 0;

    if (!position || !rotation) {
      return { changed: false, accepted: false, reason: "invalid-pose" };
    }
    if (counter != null && counter === lastObservedCounter && mapId === activeMapId) {
      return { changed: false, accepted: true, reason: "same-measurement" };
    }
    lastObservedCounter = counter;

    if (activeMapId !== mapId) reset(mapId);
    lastObservedCounter = counter;

    if (!filteredPosition) {
      acceptMeasurement(position, rotation, timestamp, source, latencyMs);
      return { changed: true, accepted: true, reason: "initial-pose", distance: 0 };
    }

    const jumpDistance = distance(filteredPosition, position);
    const rotationJump = quaternionAngle(filteredRotation, rotation);
    const elapsedSeconds = Math.min(
      config.maxJumpAllowanceSeconds,
      Math.max(0, (timestamp - lastAcceptedAt) / 1000),
    );
    const allowedDistance = config.baseJumpAllowance + config.jumpAllowancePerSecond * elapsedSeconds;

    if (jumpDistance > allowedDistance || rotationJump > config.rotationJumpAllowance) {
      const isConsistent = pendingJump
        && distance(pendingJump.position, position) <= config.candidateConsistencyDistance
        && quaternionAngle(pendingJump.rotation, rotation) <= config.candidateConsistencyAngle;
      if (isConsistent) {
        pendingJump.position = lerpPosition(pendingJump.position, position, 1 / (pendingJump.confirmations + 1));
        pendingJump.rotation = slerpQuaternion(
          pendingJump.rotation,
          rotation,
          1 / (pendingJump.confirmations + 1),
        );
        pendingJump.confirmations += 1;
      } else {
        pendingJump = {
          position: { ...position },
          rotation: { ...rotation },
          confirmations: 1,
          source,
          latencyMs,
        };
      }

      const isHardJump = jumpDistance >= config.hardJumpDistance
        || rotationJump >= config.hardRotationJump;
      const requiredConfirmations = isHardJump
        ? config.hardJumpConfirmations
        : config.jumpConfirmations;
      if (pendingJump.confirmations < requiredConfirmations) {
        rejectedMeasurements += 1;
        return {
          changed: true,
          accepted: false,
          reason: "unconfirmed-jump",
          distance: jumpDistance,
          rotationDegrees: rotationJump * 180 / Math.PI,
          allowedDistance,
          confirmations: pendingJump.confirmations,
          requiredConfirmations,
        };
      }

      acceptMeasurement(
        pendingJump.position,
        pendingJump.rotation,
        timestamp,
        pendingJump.source,
        pendingJump.latencyMs,
        true,
      );
      return {
        changed: true,
        accepted: true,
        reason: "confirmed-jump",
        distance: jumpDistance,
        rotationDegrees: rotationJump * 180 / Math.PI,
        confirmations: requiredConfirmations,
      };
    }

    pendingJump = null;
    acceptMeasurement(position, rotation, timestamp, source, latencyMs);
    return {
      changed: true,
      accepted: true,
      reason: "in-range",
      distance: jumpDistance,
      rotationDegrees: rotationJump * 180 / Math.PI,
    };
  }

  function getPose({ timestamp = performance.now(), estimatedPosition = null } = {}) {
    if (!filteredPosition || !filteredRotation) return null;

    const position = { ...filteredPosition };
    let predictionDistance = 0;
    let predictionWeight = 0;
    const prediction = clonePosition(estimatedPosition);
    if (prediction && lastAcceptedRawPosition && latestSource !== "server") {
      const age = Math.max(0, timestamp - lastAcceptedAt);
      predictionWeight = 1 - smoothstep(config.predictionFullMs, config.predictionFadeMs, age);
      const delta = {
        x: prediction.x - lastAcceptedRawPosition.x,
        y: prediction.y - lastAcceptedRawPosition.y,
        z: prediction.z - lastAcceptedRawPosition.z,
      };
      predictionDistance = Math.hypot(delta.x, delta.y, delta.z);
      if (predictionDistance > config.maxPredictionDistance && predictionDistance > 0) {
        const clampScale = config.maxPredictionDistance / predictionDistance;
        delta.x *= clampScale;
        delta.y *= clampScale;
        delta.z *= clampScale;
        predictionDistance = config.maxPredictionDistance;
      }
      position.x += delta.x * predictionWeight;
      position.y += delta.y * predictionWeight;
      position.z += delta.z * predictionWeight;
    }

    return {
      mapId: activeMapId,
      position,
      rotation: { ...filteredRotation },
      tracking: {
        mode: predictionWeight > 0 ? "bounded-prediction" : "filtered-hold",
        source: latestSource,
        latencyMs: latestLatencyMs,
        predictionDistance,
        predictionWeight,
        acceptedMeasurements,
        rejectedMeasurements,
        pendingJumpConfirmations: pendingJump?.confirmations ?? 0,
      },
    };
  }

  return { observe, getPose, reset };
}
