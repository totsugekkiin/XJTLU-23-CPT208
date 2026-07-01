/** Immersal VPS configuration — token via VITE_IMMERSAL_TOKEN in .env.local */
export const IMMERSAL_MAP_ID = 148542;

export const immersalParams = {
  developerToken: import.meta.env.VITE_IMMERSAL_TOKEN || "",
  mapIds: [IMMERSAL_MAP_ID],
  continuousLocalization: true,
  continuousInterval: 16,
  imageDownScale: 0.25,
  solverType: 1,
};

export function validateImmersalConfig() {
  if (!immersalParams.developerToken) {
    return "缺少 Immersal Developer Token。请在项目根目录创建 .env.local 并设置 VITE_IMMERSAL_TOKEN=你的token";
  }
  return null;
}
