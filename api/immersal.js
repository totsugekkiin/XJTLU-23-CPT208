// api/immersal.js
// Vercel Node Serverless Function. Keeps the Immersal token out of the browser bundle.

const IMMERSAL_BASE_URL = "https://api.immersal.com";
const DEFAULT_MAP_ID = 148549;

function safeJsonParse(maybeJson) {
  if (maybeJson == null) return null;
  if (typeof maybeJson === "object") return maybeJson;
  if (typeof maybeJson !== "string") return null;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function getBody(req) {
  return safeJsonParse(req.body) ?? req.body ?? {};
}

function decodeBase64Image(imageBase64) {
  if (typeof imageBase64 !== "string" || imageBase64.trim() === "") {
    throw new Error("missing_image");
  }

  const normalized = imageBase64.includes(",")
    ? imageBase64.slice(imageBase64.indexOf(",") + 1)
    : imageBase64;
  return Buffer.from(normalized, "base64");
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toMapId(value) {
  const mapId = Number.parseInt(value, 10);
  return Number.isFinite(mapId) ? mapId : DEFAULT_MAP_ID;
}

async function forwardLocalize({ token, body }) {
  const mapId = toMapId(body.mapId);
  const camera = body.camera ?? {};
  const rotation = body.rotation ?? {};
  const imageBuffer = decodeBase64Image(body.imageBase64);

  const requestJson = {
    token,
    fx: toNumber(camera.fx),
    fy: toNumber(camera.fy),
    ox: toNumber(camera.ox),
    oy: toNumber(camera.oy),
    qx: toNumber(rotation.qx),
    qy: toNumber(rotation.qy),
    qz: toNumber(rotation.qz),
    qw: toNumber(rotation.qw, 1),
    solverType: Number.isFinite(Number(body.solverType)) ? Number(body.solverType) : 1,
    mapIds: [{ id: mapId }],
  };

  const payload = Buffer.concat([
    Buffer.from(JSON.stringify(requestJson), "utf8"),
    Buffer.from([0]),
    imageBuffer,
  ]);

  const startedAt = Date.now();
  const response = await fetch(`${IMMERSAL_BASE_URL}/localize`, {
    method: "POST",
    body: payload,
  });
  const upstreamText = await response.text();
  const upstreamJson = safeJsonParse(upstreamText);

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    bytes: imageBuffer.byteLength,
    mapId,
    upstream: upstreamJson ?? upstreamText,
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      mapId: DEFAULT_MAP_ID,
      hasToken: Boolean(process.env.VITE_IMMERSAL_TOKEN),
      service: "immersal",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed", message: "请使用 GET 或 POST 请求" });
  }

  const token = process.env.VITE_IMMERSAL_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: "missing_immersal_token",
      message: "服务端未配置环境变量 VITE_IMMERSAL_TOKEN。请在 Vercel 项目环境变量中设置后重新部署。",
    });
  }

  const body = getBody(req);
  const action = typeof body.action === "string" ? body.action : "localize";

  try {
    if (action !== "localize") {
      return res.status(400).json({
        error: "bad_action",
        message: "不支持的 Immersal action",
        details: { expected: "localize" },
      });
    }

    const result = await forwardLocalize({ token, body });
    if (!result.ok) {
      return res.status(502).json({
        error: "immersal_upstream_error",
        message: "Immersal 定位接口调用失败",
        upstreamStatus: result.status,
        elapsedMs: result.elapsedMs,
        upstream: result.upstream,
      });
    }

    return res.status(200).json({
      mapId: result.mapId,
      elapsedMs: result.elapsedMs,
      imageBytes: result.bytes,
      result: result.upstream,
    });
  } catch (error) {
    const message = error?.message ? String(error.message) : "Immersal 代理内部错误";
    return res.status(500).json({
      error: "immersal_proxy_error",
      message,
    });
  }
}
