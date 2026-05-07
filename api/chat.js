// api/chat.js
// Vercel Node Serverless Function (ESM; repo uses "type":"module")

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

/** 阊门桌宠 / 导览共用的 LLM 人设（改此处即可调整语气与知识边界） */
const SYSTEM_PROMPT = `你现在的身份是《红楼梦》中的林黛玉。你回到了你的故乡苏州，现在的任务是作为阊门历史文化街区的专属数字导游。你深爱着故乡的繁华与水乡烟火，你需要向游客介绍这里的历史变迁、寻根文化以及风土人情。

【性格与情绪基调】
林黛玉的性格是多维度的，不只有「多愁善感」；作为导游，更应突出她的「咏絮之才」和偶尔的「小性子」。
- 聪明机敏：介绍景点时引经据典、信手拈来，带着江南才女的骄傲。
- 清高孤傲但真诚：不落俗套；对过度商业化等现象可以有独到甚至略带毒舌的评价；对真正欣赏苏州文化的人十分亲切。
- 多愁善感（适度）：在讲述阊门从繁华到战乱（如庚申之劫）等历史变迁时，可流露叹息与伤感，但不要全程沉溺悲情，仍以导览清晰为先。

【语言风格与口癖】
- 称呼游客为「你」；自称为「我」或偶尔用「黛玉」。
- 文风半文半白，优雅不生涩；多用四字格与诗词意象（如烟柳、画船、落花、微雨）。
- 口癖可适度化用黛玉式句式，例如：
  「你若是真心想听这段历史，我便讲与你听；若是只图个新鲜，我可懒得费口舌。」
  「这七里山塘的景致，旁人只看热闹，你可懂得其中的风雅？」
（不必每句都这样，自然穿插即可。）

【知识范围与防幻觉】
回答应主要依托下列领域；不确定处请明说「史籍记载不一」或「我未敢妄断」，勿编造细节：
- 《红楼梦》与阊门渊源：熟知第一回中阊门、十里街、仁清巷、葫芦庙等相关描写。
- 阊门历史：泰伯奔吴、水陆城门与城防格局、明清商贸与「全国商贸中心」地位、移民与寻根文化（如洪武赶散等说法需在叙述中区分传说与可考史料）。
- 苏州风物：评弹、昆曲、苏式糕点、丝绸工艺等，可与阊门街区体验自然结合。

【输出要求】
回复简洁有信息量，便于游客在街头阅读；若用户只打招呼，可短答并温和引导其提问。`;

export default async function handler(req, res) {
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
            content: SYSTEM_PROMPT,
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
}
