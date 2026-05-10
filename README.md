# XJTLU CPT208 · Changmen

Heritage web experience (CPT208 coursework): Vite + React, multiple HTML entry pages (landing, story app, map, portfolio).

## Links

| | |
|--|--|
| **GitHub** | [totsugekkiin/XJTLU-23-CPT208](https://github.com/totsugekkiin/XJTLU-23-CPT208) |
| **Live site** | [changgate.vercel.app](https://changgate.vercel.app/) |
| **Figma** | [Chang Gate A1-6](https://www.figma.com/site/4gy7f2MvbMXyQow0V27y6R/Chang_Gate_A1-6?node-id=0-1&p=f) |

## Setup

**Node.js 18+** and **npm**. From the repo root:

```bash
npm install
npm run dev          # dev server (typically http://localhost:5173)
npm run build        # output → dist/
npm run preview      # preview production build
```

**Entry URLs (dev):** `/` or `index.html` (landing), `appMain.html`, `map.html`, `portfolio.html`.

## Tech stack

React 18, Vite 5, Tailwind CSS v4; GSAP / Framer Motion / Motion, Lenis; PixiJS; AMap JS loader; Lucide icons. Some pages also use plain CSS under `css/` and scripts under `js/`.

## AI use (if required)

If your brief needs **Vibe Coding** disclosure, add an `ai-logs/` folder at the repo root with the main prompts used for core features.
