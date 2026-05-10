import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Layers,
  Sparkles,
  Cloud,
  MapPin,
  Bot,
  Image as ImageIcon,
  Component,
  Zap,
  ArrowDown,
} from "lucide-react";

const NODES = [
  {
    id: "user",
    layer: 0,
    label: "Visitor",
    sub: "Desktop / Mobile browser",
    icon: Globe,
    accent: "#1a1a1a",
    bg: "bg-[#1a1a1a]",
    fg: "text-white",
    detail:
      "Loads one of four HTML entries. Drives every scroll, drag and chat — all interaction starts here.",
  },
  {
    id: "appmain",
    layer: 1,
    label: "appMain.html",
    sub: "React shell · story page",
    icon: Sparkles,
    accent: "#d15a24",
    bg: "bg-white",
    fg: "text-[#d15a24]",
    border: "border-[#d15a24] border-2",
    detail:
      "src/pages/AppMainPage.jsx. Renders the felt cards, hero stack and timeline immediately, then awaits import('js/appmain.js') after first paint to bootstrap pet + river canvas + scroll director.",
  },
  {
    id: "index",
    layer: 1,
    label: "index.html",
    sub: "Landing · home / team",
    icon: Layers,
    accent: "#2d4a3e",
    bg: "bg-white",
    fg: "text-[#2d4a3e]",
    detail: "src/entries/index.jsx → HomePage. Light React tree, no heavy animation.",
  },
  {
    id: "map",
    layer: 1,
    label: "map.html",
    sub: "Standalone walking map",
    icon: MapPin,
    accent: "#2d4a3e",
    bg: "bg-white",
    fg: "text-[#2d4a3e]",
    detail: "src/pages/MapPage.jsx → just renders <RouteSection standalone />.",
  },
  {
    id: "portfolio",
    layer: 1,
    label: "portfolio.html",
    sub: "This page (felt style)",
    icon: Component,
    accent: "#2d4a3e",
    bg: "bg-white",
    fg: "text-[#2d4a3e]",
    detail: "src/portfolio/PortfolioApp.jsx — what you are reading right now.",
  },
  {
    id: "pet",
    layer: 2,
    label: "Desktop Pet",
    sub: "PIXI.js · state machine",
    icon: Bot,
    accent: "#d15a24",
    bg: "bg-[#fff7ee]",
    fg: "text-[#d15a24]",
    detail:
      "js/appmain/pet/*. PIXI sprite + dragging + target observer + comic-style chat bubble. Sends prompts via sendToAI().",
  },
  {
    id: "scene",
    layer: 2,
    label: "River Scene",
    sub: "Canvas 2D + GSAP",
    icon: Sparkles,
    accent: "#d15a24",
    bg: "bg-[#fff7ee]",
    fg: "text-[#d15a24]",
    detail: "js/appmain/riverScene.js. Animated water, drifting boat, anchored island cards.",
  },
  {
    id: "scroll",
    layer: 2,
    label: "Scroll Director",
    sub: "scrollMaskZoom · curtain",
    icon: Zap,
    accent: "#d15a24",
    bg: "bg-[#fff7ee]",
    fg: "text-[#d15a24]",
    detail:
      "Drives the timeline filmstrip, gate-mask zoom and curtain transition based on window.scrollY + GSAP timelines.",
  },
  {
    id: "route",
    layer: 2,
    label: "RouteSection",
    sub: "AMap loader (lazy)",
    icon: MapPin,
    accent: "#d15a24",
    bg: "bg-[#fff7ee]",
    fg: "text-[#d15a24]",
    detail:
      "src/components/RouteSection.jsx. Mounted only when body.is-river-page is on, to avoid loading WebGL map tiles up front.",
  },
  {
    id: "assets",
    layer: 2,
    label: "Static Assets",
    sub: "public/images/* · fonts",
    icon: ImageIcon,
    accent: "#1a1a1a",
    bg: "bg-[#f4f1ea]",
    fg: "text-[#1a1a1a]",
    detail: "Timeline images, pet sprites and SVG motifs — bundled into dist/ by Vite.",
  },
  {
    id: "serverless",
    layer: 3,
    label: "/api/chat",
    sub: "Vercel serverless",
    icon: Cloud,
    accent: "#2d4a3e",
    bg: "bg-[#2d4a3e]",
    fg: "text-white",
    detail:
      "api/chat.js. Adds the 林黛玉 system prompt, attaches the API key from env var `agent`, then forwards to Zhipu. The key never reaches the browser.",
  },
  {
    id: "amap",
    layer: 3,
    label: "AMap Web API",
    sub: "v2.0 · AMap.Walking",
    icon: MapPin,
    accent: "#1a1a1a",
    bg: "bg-white",
    fg: "text-[#1a1a1a]",
    detail:
      "Tiles + walking-route plugin. Called directly from the browser via JSONP — multi-leg search is chained client-side.",
  },
  {
    id: "zhipu",
    layer: 3,
    label: "Zhipu BigModel",
    sub: "glm-4-flash",
    icon: Bot,
    accent: "#1a1a1a",
    bg: "bg-white",
    fg: "text-[#1a1a1a]",
    detail:
      "OpenAI-compatible endpoint at open.bigmodel.cn. Returns choices[0].message.content which is unwrapped to { reply } by the proxy.",
  },
];

const EDGES = [
  { from: "user", to: "index", label: "GET", style: "solid" },
  { from: "user", to: "appmain", label: "GET", style: "solid", primary: true },
  { from: "user", to: "map", label: "GET", style: "solid" },
  { from: "user", to: "portfolio", label: "GET", style: "solid" },

  { from: "appmain", to: "pet", label: "lazy import", style: "solid", primary: true },
  { from: "appmain", to: "scene", label: "bootstrap", style: "solid" },
  { from: "appmain", to: "scroll", label: "bootstrap", style: "solid" },
  { from: "appmain", to: "route", label: "scroll-trigger mount", style: "dashed" },
  { from: "appmain", to: "assets", label: "<img>", style: "dotted" },

  { from: "pet", to: "serverless", label: "POST /api/chat", style: "solid", primary: true },
  { from: "route", to: "amap", label: "JSONP", style: "solid" },
  { from: "serverless", to: "zhipu", label: "POST chat/completions", style: "solid", primary: true },
];

const NODE_POS = {
  user: { col: 2, row: 0, span: 2 },

  index: { col: 0, row: 1, span: 1 },
  appmain: { col: 1, row: 1, span: 2 },
  map: { col: 3, row: 1, span: 1 },
  portfolio: { col: 4, row: 1, span: 2 },

  pet: { col: 0, row: 2, span: 1 },
  scene: { col: 1, row: 2, span: 1 },
  scroll: { col: 2, row: 2, span: 1 },
  route: { col: 3, row: 2, span: 1 },
  assets: { col: 4, row: 2, span: 2 },

  serverless: { col: 1, row: 3, span: 2 },
  amap: { col: 3, row: 3, span: 1 },
  zhipu: { col: 4, row: 3, span: 2 },
};

const COLS = 6;
const ROWS = 4;

const ROW_LABELS = [
  { y: 0, name: "Client", note: "Browser" },
  { y: 1, name: "Pages", note: "Vite multi-page · React 18" },
  { y: 2, name: "Modules", note: "Lazy-loaded experience layer" },
  { y: 3, name: "External", note: "Serverless + 3rd-party" },
];

function getCenter(nodeId, dims) {
  const pos = NODE_POS[nodeId];
  const { cellW, cellH, padX, padY, gapX, gapY } = dims;
  const x = padX + pos.col * (cellW + gapX) + (pos.span * cellW + (pos.span - 1) * gapX) / 2;
  const y = padY + pos.row * (cellH + gapY) + cellH / 2;
  return { x, y };
}

export function ArchDiagram() {
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);

  const dims = { cellW: 150, cellH: 84, padX: 80, padY: 40, gapX: 12, gapY: 60 };
  const width = dims.padX * 2 + COLS * dims.cellW + (COLS - 1) * dims.gapX;
  const height = dims.padY * 2 + ROWS * dims.cellH + (ROWS - 1) * dims.gapY;

  const activeId = hover ?? selected;

  const activeEdgeIds = useMemo(() => {
    if (!activeId) return new Set();
    const ids = new Set();
    EDGES.forEach((e, i) => {
      if (e.from === activeId || e.to === activeId) ids.add(i);
    });
    return ids;
  }, [activeId]);

  const activeNeighborIds = useMemo(() => {
    if (!activeId) return new Set();
    const ids = new Set([activeId]);
    EDGES.forEach((e) => {
      if (e.from === activeId) ids.add(e.to);
      if (e.to === activeId) ids.add(e.from);
    });
    return ids;
  }, [activeId]);

  const selectedNode = selected ? NODES.find((n) => n.id === selected) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
        <span className="font-bold uppercase text-gray-500">Legend:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-6 h-0.5 bg-[#1a1a1a]" /> request
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-6 h-0.5 bg-[#d15a24]" /> active flow
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-6 h-0.5 bg-[#1a1a1a]" style={{ backgroundImage: "linear-gradient(to right, #1a1a1a 60%, transparent 0%)", backgroundSize: "8px 2px", backgroundRepeat: "repeat-x", background: "transparent", borderTop: "2px dashed #1a1a1a" }} />
          deferred mount
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-6 border-t-2 border-dotted border-black" />
          static asset
        </span>
        <span className="ml-auto italic text-gray-500">Hover any node to highlight · click to pin a description below</span>
      </div>

      <div
        className="relative bg-[#f4f1ea] felt-stitch rounded-sm p-3 overflow-x-auto"
        onMouseLeave={() => setHover(null)}
      >
        <div className="relative mx-auto" style={{ width, height }}>
          {ROW_LABELS.map((row) => {
            const y = dims.padY + row.y * (dims.cellH + dims.gapY);
            return (
              <div
                key={row.y}
                className="absolute left-0 flex flex-col justify-center pl-1"
                style={{ top: y, height: dims.cellH, width: dims.padX - 8 }}
              >
                <p className="text-[9px] font-mono font-black uppercase tracking-widest text-[#1a1a1a]">
                  {row.name}
                </p>
                <p className="text-[8px] font-mono text-gray-500 leading-tight">{row.note}</p>
              </div>
            );
          })}

          <svg
            className="absolute inset-0 pointer-events-none"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#1a1a1a" />
              </marker>
              <marker id="arch-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#d15a24" />
              </marker>
            </defs>

            {EDGES.map((e, i) => {
              const a = getCenter(e.from, dims);
              const b = getCenter(e.to, dims);
              const dy = b.y - a.y;
              const isActive = activeEdgeIds.has(i);
              const dim = activeId && !isActive;

              const c1 = { x: a.x, y: a.y + dy * 0.55 };
              const c2 = { x: b.x, y: b.y - dy * 0.55 };
              const path = `M ${a.x} ${a.y + 30} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y - 30}`;

              const stroke = isActive ? "#d15a24" : "#1a1a1a";
              let dash = undefined;
              if (e.style === "dashed") dash = "8 4";
              if (e.style === "dotted") dash = "2 4";

              return (
                <g key={i} opacity={dim ? 0.12 : 1} style={{ transition: "opacity 200ms" }}>
                  <path
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isActive ? 2.5 : 1.4}
                    strokeDasharray={dash}
                    markerEnd={isActive ? "url(#arch-arrow-active)" : "url(#arch-arrow)"}
                    style={{ transition: "all 200ms" }}
                  />
                  {isActive && e.label && (
                    <g>
                      <rect
                        x={(a.x + b.x) / 2 - e.label.length * 3.2 - 6}
                        y={(a.y + b.y) / 2 - 9}
                        width={e.label.length * 6.4 + 12}
                        height={18}
                        rx={4}
                        fill="#d15a24"
                      />
                      <text
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2 + 4}
                        fontSize="10"
                        fontFamily="ui-monospace, monospace"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontWeight="700"
                      >
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {NODES.map((n) => {
            const pos = NODE_POS[n.id];
            const x = dims.padX + pos.col * (dims.cellW + dims.gapX);
            const y = dims.padY + pos.row * (dims.cellH + dims.gapY);
            const w = pos.span * dims.cellW + (pos.span - 1) * dims.gapX;
            const isActive = activeNeighborIds.has(n.id);
            const dim = activeId && !isActive;
            const isSelected = selected === n.id;
            const Icon = n.icon;

            return (
              <motion.button
                key={n.id}
                type="button"
                onMouseEnter={() => setHover(n.id)}
                onClick={() => setSelected(isSelected ? null : n.id)}
                animate={{
                  opacity: dim ? 0.35 : 1,
                  scale: activeId === n.id ? 1.04 : 1,
                }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
                className={`absolute text-left p-2 rounded-md felt-stitch felt-shadow ${n.bg} ${n.fg} ${n.border ?? ""} ${
                  isSelected ? "ring-2 ring-offset-1 ring-[#d15a24]" : ""
                }`}
                style={{ left: x, top: y, width: w, height: dims.cellH }}
                aria-label={`${n.label}: ${n.sub}`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={13} strokeWidth={2.4} />
                  <p className="text-[11px] font-black uppercase leading-tight truncate">{n.label}</p>
                </div>
                <p className={`text-[9.5px] mt-1 leading-snug opacity-80 line-clamp-2 ${n.fg}`}>{n.sub}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedNode && (
          <motion.div
            key={selectedNode.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="p-3 bg-white felt-stitch rounded-sm flex gap-3 items-start"
          >
            <div
              className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center"
              style={{ backgroundColor: selectedNode.accent, color: "#fff" }}
            >
              <selectedNode.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black uppercase leading-tight">{selectedNode.label}</p>
                <span
                  className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded-sm"
                  style={{ backgroundColor: `${selectedNode.accent}1a`, color: selectedNode.accent }}
                >
                  {selectedNode.sub}
                </span>
              </div>
              <p className="text-[12px] text-gray-700 leading-snug mt-1">{selectedNode.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-[10px] font-mono uppercase text-gray-500 hover:text-[#1a1a1a] tracking-wider"
            >
              close ×
            </button>
          </motion.div>
        )}
        {!selectedNode && (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[11px] font-mono text-gray-500 italic px-1"
          >
            <ArrowDown size={12} />
            Tip: click a node above to pin its description here.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
