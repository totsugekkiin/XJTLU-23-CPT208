import fs from "fs";
import path from "path";

const base =
  process.env.AGENT_TRANSCRIPTS ||
  "C:/Users/庞嘉扬/.cursor/projects/d-cpt208-code-XJTLU-23-CPT208/agent-transcripts";

const APPMAIN_RX =
  /appmain|appMain|AppMain|js\/appmain|css\/appmain|map\.html|scrollMaskZoom|heroCardStack|riverScene|petComicChat|bootstrapAppMain|RouteSection|\bAMap\b|高德|智谱|zhipu|阊门|changmen|胶片|胶带|桌宠|岛屿|小船|河流|地图界面|route-section|river-sea|sea-funnel|onReachedBottom|scrollTransition|cm-filmstrip|cm-mask|river-island|guide-menu|ChangmenGate|layoutConfig|motionConfig|--hero-scroll|route_plan|sendToAI|pet_route|river canvas|scroll director|scrollMask|\bPIXI\b|pet-layer|林黛玉|dockEnd|switchEnd|petConfig|styleVars|AppMainPage|appMain\.jsx|bootstrapAppMain|幕布|glm-4|\/api\/chat|\bWalking\b|geocod|地点名|坐标|步行规划|卡片堆叠|filmstrip|timeline|时间轴|\bGO\b|首屏|初始界面|转场|ScrollTrigger|gate\.png|exposeGlobals|多页|Vite.*appMain|scrollLengthPx/gi;

const NOISE =
  /^\s*(ok|欧克|好的|谢谢|行|收到|可以|嗯)\s*\.?\s*$/i;

function walkJsonlFiles(d, acc) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === "subagents") continue;
      walkJsonlFiles(p, acc);
    } else if (n.endsWith(".jsonl")) acc.push(p);
  }
}

function extractText(obj) {
  const c = obj.message?.content;
  if (!Array.isArray(c)) return "";
  return c.filter((x) => x.type === "text").map((x) => x.text || "").join("\n");
}

function clean(t) {
  return t
    .replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/g, "")
    .replace(/<attached_files>[\s\S]*?<\/attached_files>\s*/g, "")
    .replace(/<external_links>[\s\S]*?<\/external_links>\s*/g, "")
    .replace(/<image_files>[\s\S]*?<\/image_files>\s*/g, "")
    .replace(/<git_diff_from_branch_to_main>[\s\S]*?(?=<user_query>|$)/g, "")
    .replace(/\[Image\]\s*/g, "")
    .trim();
}

function getQuery(t) {
  const m = t.match(/<user_query>\s*([\s\S]*?)<\/user_query>/i);
  if (m) return clean(m[1].trim());
  return clean(t);
}

const files = [];
walkJsonlFiles(base, files);

const seen = new Set();
const rows = [];

for (const fp of files) {
  const session = path.basename(path.dirname(fp));
  const rawFile = fs.readFileSync(fp, "utf8");
  for (const line of rawFile.split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.role !== "user") continue;
    const raw = extractText(o);
    const q = getQuery(raw);
    if (!q || q.length < 3) continue;
    if (NOISE.test(q)) continue;
    if (!APPMAIN_RX.test(q)) continue;
    const key = q.replace(/\s+/g, " ").slice(0, 500);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ session, q });
  }
}

rows.sort((a, b) => a.session.localeCompare(b.session));

const outDir = path.join(process.cwd(), "ailog");
const outJson = path.join(outDir, "appmain-code-prompts-full.json");
const outLog = path.join(outDir, "appmain-code-prompts.log");

fs.writeFileSync(outJson, JSON.stringify({ count: rows.length, rows }, null, 2), "utf8");

/** 日志里可读版本：整页 HTML / 极长说明文做摘要，避免 .log 成千上万行 */
function forLog(q, index1) {
  const n = q.length;
  if (/^<!DOCTYPE html>/i.test(q) || /^<html[\s>]/i.test(q)) {
    const tail = q.slice(-160).replace(/\s+/g, " ");
    return `[长内容·整页 HTML] 约 ${n} 字符；尾部：…${tail}\n→ 全文见「appmain-code-prompts-full.json」条目 #${index1}`;
  }
  if (n > 1400) {
    return `${q.slice(0, 1400).trimEnd()}\n…（后 ${n - 1400} 字略）→ JSON #${index1}`;
  }
  return q;
}

const header = `# AppMain 相关用户提示词（尽量全量）

- **条数**：${rows.length}（主会话 transcript 去重后；**\`subagents/\`** 子代理会话未合并进本次扫描**）。
- **机器可读全文**：\`ailog/appmain-code-prompts-full.json\`（含长 HTML / 计划附件节选等未删节副本）。
- **本文件**：同批数据的阅读版；整页_demo HTML 或超长条文在下方用摘要表示，请到 JSON 核对原文。

`;

const body = rows
  .map((row, i) => {
    const num = String(i + 1).padStart(3, "0");
    const sid = row.session.slice(0, 8);
    return `### ${num} · \`${sid}…\` · ${row.session}\n\n${forLog(row.q, i + 1)}\n`;
  })
  .join("\n");

fs.writeFileSync(
  outLog,
  `${header}\n---\n\n${body}\n`,
  "utf8",
);

console.log("wrote", outJson, "count", rows.length);
console.log("wrote", outLog);
