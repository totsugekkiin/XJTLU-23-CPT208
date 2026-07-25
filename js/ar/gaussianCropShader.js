const cropModifyGlsl = `
uniform vec3 uCropMin;
uniform vec3 uCropMax;
uniform float uCropEnabled;

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
  bool outside =
    any(lessThan(center, uCropMin)) ||
    any(greaterThan(center, uCropMax));
  if (uCropEnabled > 0.5 && outside) {
    color.a = 0.0;
  }
}
`;

const cropModifyWgsl = `
uniform uCropMin: vec3f;
uniform uCropMax: vec3f;
uniform uCropEnabled: f32;

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
  let outside =
    any(center < uniform.uCropMin) ||
    any(center > uniform.uCropMax);
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
  material.setParameter("uCropMin", bounds.min);
  material.setParameter("uCropMax", bounds.max);
  material.setParameter("uCropEnabled", enabled ? 1 : 0);
}
