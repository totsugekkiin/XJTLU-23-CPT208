export function isAcceptedLocalizationPose(trackedPose) {
  if (!trackedPose) return false;
  return trackedPose.poseFilter?.observation?.accepted !== false;
}

/**
 * Turns the SDK's monotonically increasing localization counter into a
 * single, consumable confirmation. Device, manual, and server paths all call
 * this helper so one SDK result cannot confirm the scene more than once.
 */
export function evaluateLocalizationCounter({
  lastCounter = 0,
  counter,
  trackedPose,
}) {
  const previous = Number.isFinite(Number(lastCounter))
    ? Number(lastCounter)
    : 0;
  const current = Number(counter);

  if (!Number.isFinite(current) || current <= previous) {
    return {
      isNew: false,
      accepted: false,
      lastCounter: previous,
      mapId: null,
      reason: "stale-counter",
    };
  }

  const observation = trackedPose?.poseFilter?.observation ?? null;
  return {
    isNew: true,
    accepted: isAcceptedLocalizationPose(trackedPose),
    lastCounter: current,
    mapId: trackedPose?.mapId ?? null,
    reason: observation?.reason ?? (trackedPose ? "accepted-pose" : "missing-pose"),
  };
}
