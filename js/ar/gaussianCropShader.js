const cropModifyGlsl = `
uniform vec3 uCropCenter;
uniform vec3 uCropHalfExtents;
uniform vec4 uCropInverseRotation;
uniform float uCropEnabled;

vec3 rotateCropVector(vec4 rotation, vec3 vector) {
  return vector + 2.0 * cross(
    rotation.xyz,
    cross(rotation.xyz, vector) + rotation.w * vector
  );
}

vec3 cropModelCenter(vec3 worldCenter) {
  vec3 axisX = matrix_model[0].xyz;
  vec3 axisY = matrix_model[1].xyz;
  vec3 axisZ = matrix_model[2].xyz;
  vec3 offset = worldCenter - matrix_model[3].xyz;
  float determinant = dot(axisX, cross(axisY, axisZ));
  return vec3(
    dot(cross(axisY, axisZ), offset),
    dot(cross(axisZ, axisX), offset),
    dot(cross(axisX, axisY), offset)
  ) / determinant;
}

void modifySplatCenter(inout vec3 center) {
}

void modifySplatRotationScale(
  vec3 originalCenter,
  vec3 modifiedCenter,
  inout vec4 rotation,
  inout vec3 scale
) {
}

void modifySplatColor(vec3 center, inout vec4 color) {
  #ifdef GSPLAT_CENTER_NOPROJ
    vec3 modelCenter = cropModelCenter(center);
  #else
    vec3 modelCenter = center;
  #endif
  vec3 localCenter = rotateCropVector(
    uCropInverseRotation,
    modelCenter - uCropCenter
  );
  bool outside = any(greaterThan(abs(localCenter), uCropHalfExtents));
  if (uCropEnabled > 0.5 && outside) {
    color.a = 0.0;
  }
}
`;

const cropModifyWgsl = `
uniform uCropCenter: vec3f;
uniform uCropHalfExtents: vec3f;
uniform uCropInverseRotation: vec4f;
uniform uCropEnabled: f32;

fn rotateCropVector(rotation: vec4f, vector: vec3f) -> vec3f {
  return vector + 2.0 * cross(
    rotation.xyz,
    cross(rotation.xyz, vector) + rotation.w * vector
  );
}

fn cropModelCenter(worldCenter: vec3f) -> vec3f {
  let axisX = uniform.matrix_model[0].xyz;
  let axisY = uniform.matrix_model[1].xyz;
  let axisZ = uniform.matrix_model[2].xyz;
  let offset = worldCenter - uniform.matrix_model[3].xyz;
  let determinant = dot(axisX, cross(axisY, axisZ));
  return vec3f(
    dot(cross(axisY, axisZ), offset),
    dot(cross(axisZ, axisX), offset),
    dot(cross(axisX, axisY), offset)
  ) / determinant;
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
}

fn modifySplatRotationScale(
  originalCenter: vec3f,
  modifiedCenter: vec3f,
  rotation: ptr<function, vec4f>,
  scale: ptr<function, vec3f>
) {
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  #ifdef GSPLAT_CENTER_NOPROJ
    let modelCenter = cropModelCenter(center);
  #else
    let modelCenter = center;
  #endif
  let localCenter = rotateCropVector(
    uniform.uCropInverseRotation,
    modelCenter - uniform.uCropCenter
  );
  let outside = any(abs(localCenter) > uniform.uCropHalfExtents);
  if (uniform.uCropEnabled > 0.5 && outside) {
    (*color).a = 0.0;
  }
}
`;

export function installGaussianCropShader(material) {
  material.shaderChunks.glsl.set("gsplatModifyVS", cropModifyGlsl);
  material.shaderChunks.wgsl.set("gsplatModifyVS", cropModifyWgsl);
}

export function updateGaussianCropMaterial(
  material,
  bounds,
  enabled = true,
) {
  const [rx, ry, rz] = bounds.rotation ?? [0, 0, 0];
  const halfToRadians = Math.PI / 360;
  const x = rx * halfToRadians;
  const y = ry * halfToRadians;
  const z = rz * halfToRadians;
  const sx = Math.sin(x);
  const cx = Math.cos(x);
  const sy = Math.sin(y);
  const cy = Math.cos(y);
  const sz = Math.sin(z);
  const cz = Math.cos(z);
  const quaternion = [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
  material.setParameter("uCropCenter", bounds.center);
  material.setParameter("uCropHalfExtents", bounds.halfExtents);
  material.setParameter("uCropInverseRotation", [
    -quaternion[0],
    -quaternion[1],
    -quaternion[2],
    quaternion[3],
  ]);
  material.setParameter("uCropEnabled", enabled ? 1 : 0);
}
