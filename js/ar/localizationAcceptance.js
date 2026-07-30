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
      confirmationCredit: 0,
      lastCounter: previous,
      mapId: null,
      reason: "stale-counter",
    };
  }

  const observation = trackedPose?.poseFilter?.observation ?? null;
  const accepted = isAcceptedLocalizationPose(trackedPose);
  const observedConfirmations = Number(observation?.confirmations);
  return {
    isNew: true,
    accepted,
    // A confirmed jump has already survived the stabilizer's own 2–3 sample
    // consistency gate. Requiring another full UI confirmation cycle made
    // reacquisition unnecessarily slow, so reuse that evidence here.
    confirmationCredit: accepted && Number.isFinite(observedConfirmations)
      ? Math.max(1, Math.floor(observedConfirmations))
      : accepted
        ? 1
        : 0,
    lastCounter: current,
    mapId: trackedPose?.mapId ?? null,
    reason: observation?.reason ?? (trackedPose ? "accepted-pose" : "missing-pose"),
  };
}
