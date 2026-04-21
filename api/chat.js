// api/chat.js

export default async function handler(req, res) {
  // 1. 检查是否为 POST 请求（前端发送数据通常用 POST）
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '请使用 POST 请求' });
  }

  // 2. 解析前端传来的用户消息
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ message: '消息内容不能为空' });
  }

  try {
    // 3. 调用 AI 接口（以 DeepSeek 为例，OpenAI 结构类似）
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.agent}` // 自动读取环境变量
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 或者是 "gpt-3.5-turbo" 等
        messages: [
          // --- 这里是你的智能体“设定” ---
          {
            role: "system",
            content: "你是一个专业的智能导览助手，语气亲切且富有幽默感。你可以根据自己的喜好加入特定的性格设定。"
          },
          // ----------------------------
          { role: "user", content: prompt }
        ],
        temperature: 0.7 // 随机性，数值越大 AI 越活泼
      })
    });

    const data = await response.json();

    // 4. 将 AI 的回答返回给前端
    if (data.choices && data.choices[0]) {
      res.status(200).json({ reply: data.choices[0].message.content });
    } else {
      throw new Error('AI 返回数据异常');
    }
  } catch (error) {
    console.error('后端报错:', error);
    res.status(500).json({ error: '服务器出了点小问题，请稍后再试' });
  }
}
