import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/** @typedef {'closed' | 'unfolding' | 'painting' | 'stamping' | 'finished' | 'closing'} AnimationStage */

const SCROLL_TRANSITION_SEC = 1.15;

/** 卷轴纸面与轴处于「拉开」状态的阶段（closing / closed 为收起） */
function isScrollExpanded(stage) {
  return stage === "unfolding" || stage === "painting" || stage === "stamping" || stage === "finished";
}

/**
 * 古典卷轴展开 → 笔墨 → 钤印 → 收起 → 再展开循环
 */
export function AncientScrollBrushAnimation() {
  /** @type {[AnimationStage, React.Dispatch<React.SetStateAction<AnimationStage>>]} */
  const [stage, setStage] = useState(/** @type {AnimationStage} */ ("closed"));

  useEffect(() => {
    const sequence = async () => {
      setStage("unfolding");
      // 等展开动画走完再进入作画，展开效果才能看清
      await new Promise((r) => setTimeout(r, Math.round(SCROLL_TRANSITION_SEC * 1000) + 150));

      setStage("painting");
      await new Promise((r) => setTimeout(r, 2750));

      setStage("stamping");
      await new Promise((r) => setTimeout(r, 650));

      setStage("finished");
      await new Promise((r) => setTimeout(r, 280));

      setStage("closing");
      await new Promise((r) => setTimeout(r, Math.round(SCROLL_TRANSITION_SEC * 1000) + 80));

      setStage("closed");
    };

    if (stage === "closed") {
      sequence();
    }
  }, [stage]);

  const width = 600;
  const height = 600;
  const scrollHeight = 360;
  const scrollY = (height - scrollHeight) / 2;
  const maxScrollWidth = 440;

  const expanded = isScrollExpanded(stage);
  const scrollEase = { duration: SCROLL_TRANSITION_SEC, ease: "easeInOut" };

  const stroke1 = "M 180 220 Q 250 180 320 220";
  const stroke2 = "M 200 280 C 250 320 350 240 400 280";

  return (
    <div className="ancient-scroll-brush" aria-hidden="true">
      <div className="ancient-scroll-brush__inner">
        <svg
          className="ancient-scroll-brush__svg"
          viewBox={`0 0 ${width} ${height}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.rect
            initial={{ width: 0, x: 300 }}
            animate={{
              width: expanded ? maxScrollWidth : 0,
              x: expanded ? (width - maxScrollWidth) / 2 : 300,
            }}
            transition={scrollEase}
            y={scrollY}
            height={scrollHeight}
            fill="#ffeeb2"
            rx="30"
          />
          <motion.rect
            initial={{ width: 0, x: 300 }}
            animate={{
              width: expanded ? maxScrollWidth - 60 : 0,
              x: expanded ? (width - maxScrollWidth + 60) / 2 : 300,
            }}
            transition={scrollEase}
            y={scrollY + 30}
            height={scrollHeight - 60}
            fill="#fff9e6"
            rx="15"
            stroke="#e6cc8e"
            strokeWidth="3"
          />

          <motion.g
            initial={{ x: 300 - 17.5 }}
            animate={{
              x: expanded ? (width - maxScrollWidth) / 2 - 17.5 : 300 - 17.5,
            }}
            transition={scrollEase}
          >
            <rect y={scrollY - 20} width="35" height={scrollHeight + 40} fill="#a67c52" rx="17" />
            <circle cx="17.5" cy={scrollY - 20} r="22" fill="#7a5633" />
            <circle cx="17.5" cy={scrollY + scrollHeight + 20} r="22" fill="#7a5633" />
          </motion.g>

          <motion.g
            initial={{ x: 304 - 17.5 }}
            animate={{
              x: expanded ? (width + maxScrollWidth) / 2 - 17.5 : 300 - 17.5,
            }}
            transition={scrollEase}
          >
            <rect y={scrollY - 20} width="35" height={scrollHeight + 40} fill="#a67c52" rx="17" />
            <circle cx="17.5" cy={scrollY - 20} r="22" fill="#7a5633" />
            <circle cx="17.5" cy={scrollY + scrollHeight + 20} r="22" fill="#7a5633" />
          </motion.g>

          <AnimatePresence>
            {(stage === "painting" || stage === "stamping" || stage === "finished") && (
              <g>
                <motion.path
                  d={stroke1}
                  stroke="#333"
                  strokeWidth="16"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  exit={{ opacity: 0, pathLength: 0 }}
                  transition={{ duration: 0.35, ease: "easeIn" }}
                />

                <motion.path
                  d={stroke2}
                  stroke="#333"
                  strokeWidth="18"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.85 }}
                  exit={{ opacity: 0, pathLength: 0 }}
                  transition={{ duration: 0.35, ease: "easeIn" }}
                />
              </g>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(stage === "stamping" || stage === "finished") && (
              <motion.g
                initial={{ scale: 3, opacity: 0, y: -100, x: 410 }}
                animate={{ scale: 1, opacity: 1, y: 360, x: 410 }}
                exit={{ opacity: 0, scale: 0.6, y: 380 }}
                transition={{
                  y: { type: "spring", stiffness: 400, damping: 20 },
                  opacity: { duration: 0.25 },
                  scale: { duration: 0.25 },
                }}
              >
                <rect width="45" height="45" fill="#c92a2a" rx="4" />
                <rect x="4" y="4" width="37" height="37" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" rx="2" />
              </motion.g>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {stage === "painting" && (
              <motion.g
                initial={{ x: 300, y: 150, rotate: -40, opacity: 0 }}
                animate={[
                  { x: 180, y: 220, rotate: -15, opacity: 1, transition: { duration: 0.5 } },
                  { x: 320, y: 220, rotate: 25, transition: { duration: 0.8, delay: 0.2 } },
                  { x: 200, y: 280, rotate: -20, transition: { duration: 0.5, delay: 0.5 } },
                  { x: 400, y: 280, rotate: 15, transition: { duration: 1 } },
                  { y: 50, opacity: 0, transition: { duration: 0.5, delay: 0.5 } },
                ]}
                exit={{ opacity: 0 }}
                style={{ originX: "0px", originY: "0px" }}
              >
                <rect x="-6" y="-80" width="12" height="80" fill="#5c4033" rx="6" />
                <path d="M -12 0 L 12 0 C 18 30 0 50 -12 0 Z" fill="#333" />
                <circle cx="0" cy="-80" r="10" fill="#e6cc8e" />
              </motion.g>
            )}

            {stage === "stamping" && (
              <motion.g
                initial={{ x: 432, y: 100, opacity: 0 }}
                animate={[
                  { opacity: 1, y: 320, transition: { duration: 0.4 } },
                  { y: 360, transition: { duration: 0.1, type: "spring", stiffness: 500 } },
                  { y: 200, opacity: 0, transition: { duration: 0.5, delay: 0.3 } },
                ]}
              >
                <rect x="-22" y="-70" width="44" height="70" fill="#cf4343" rx="4" />
                <rect x="-18" y="-80" width="36" height="15" fill="#8b2d2d" rx="2" />
                <rect x="-10" y="-100" width="20" height="30" fill="#a67c52" rx="4" />
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}
