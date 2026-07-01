/**
 * Request device orientation / motion permissions (required on iOS Safari).
 * @returns {Promise<void>}
 */
export async function requestSensorPermissions() {
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    const result = await DeviceOrientationEvent.requestPermission();
    if (result !== "granted") {
      throw new Error("需要允许设备方向权限以完成 AR 定位。");
    }
  }

  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    const result = await DeviceMotionEvent.requestPermission();
    if (result !== "granted") {
      throw new Error("需要允许设备运动权限以完成 AR 定位。");
    }
  }
}
