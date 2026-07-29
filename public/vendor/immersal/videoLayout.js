export function applyVideoLayout(
  element,
  size,
  { ownsCamera = true, positionElement = false } = {},
) {
  if (!element?.style || !size) return;

  element.style.width = `${size.width}px`;
  element.style.height = `${size.height}px`;

  // A shared video may also be consumed by another vision pipeline. Its
  // width/height attributes describe the frame passed to drawImage, so only
  // the camera owner is allowed to replace them with viewport dimensions.
  if (ownsCamera) {
    element.width = size.width;
    element.height = size.height;
  }

  if (positionElement) {
    element.style.left = `${size.x}px`;
    element.style.top = `${size.y}px`;
  }
}
