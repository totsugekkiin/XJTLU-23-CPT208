// api/chat.js
// Vercel Node Serverless Function (CommonJS export for widest compatibility)

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed", message: "请使用 POST 请求" });
  }

  const apiKey = process.env.agent;
  if (!apiKey) {
    return res.status(500).json({
      error: "missing_api_key",
      message: "服务端未配置环境变量 agent（API Key）。请在 Vercel 项目环境变量中设置后重新部署。",
    });
  }

  const body = safeJsonParse(req.body) ?? req.body ?? {};
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "bad_request", message: "消息内容不能为空", details: { expected: "{ prompt: string }" } });
  }

  try {
    // Zhipu (BigModel) OpenAI-compatible endpoint
    const upstreamResponse = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [
          {
            role: "system",
            content: "你是一个专业的智能导览助手，语气亲切且富有幽默感。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        stream: false,
      }),
    });

    const upstreamText = await upstreamResponse.text();
    const upstreamJson = safeJsonParse(upstreamText);

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        error: "upstream_error",
        message: "AI 接口调用失败",
        upstreamStatus: upstreamResponse.status,
        upstream: upstreamJson ?? upstreamText,
      });
    }

    const reply = upstreamJson?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || reply.trim() === "") {
      return res.status(502).json({
        error: "upstream_bad_response",
        message: "AI 返回数据结构异常（未找到 reply）",
        upstream: upstreamJson ?? upstreamText,
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("后端报错:", error);
    return res.status(500).json({
      error: "internal_error",
      message: error?.message ? String(error.message) : "服务器出了点小问题，请稍后再试",
    });
  }
};
