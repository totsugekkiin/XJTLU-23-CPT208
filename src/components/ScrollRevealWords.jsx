import React, { useEffect, useMemo, useRef, useState } from "react";
import { cubicBezier, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 词内缓动：与 CSS cubic-bezier(0.16, 1, 0.3, 1) 一致 */
const easeWordReveal = cubicBezier(0.16, 1, 0.3, 1);

/**
 * 逐词滚动映射；词数极大时可改为单 MotionValue + rAF 以减少订阅（约 80–120 词以上再考虑）。
 */
function WordSpan({ word, index, total, scrollYProgress, isReduced }) {
  const opacity = useTransform(scrollYProgress, (p) => {
    if (isReduced) return 1;
    if (total <= 0) return 1;
    const t = clamp01(p * total - index);
    const eased = easeWordReveal(t);
    return eased;
  });

  const y = useTransform(scrollYProgress, (p) => {
    if (isReduced) return 0;
    if (total <= 0) return 0;
    const t = clamp01(p * total - index);
    const eased = easeWordReveal(t);
    return 40 * (1 - eased);
  });

  return (
    <motion.span className="scroll-reveal-words__word" style={{ opacity, y }} aria-hidden="true">
      {word}
    </motion.span>
  );
}

/**
 * @param {object} props
 * @param {string} props.text
 * @param {"word"|"char"} [props.splitMode="word"]
 * @param {string} [props.className]
 * @param {string} [props.id]
 * @param {string} [props.handoffTargetId="cm-transition"] — 阊门段进入视口：fixed 居中 → absolute 锚在当前测量位置；离开视口：恢复 fixed 居中（可逆）
 */
export function ScrollRevealWords({
  text,
  splitMode = "word",
  className = "",
  id,
  handoffTargetId = "cm-transition",
}) {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const isReduced = useReducedMotion();
  const [handoff, setHandoff] = useState(false);
  const [handoffBox, setHandoffBox] = useState(null);

  const words = useMemo(() => {
    const t = text.trim();
    if (!t) return [];
    if (splitMode === "char") {
      return Array.from(t);
    }
    return t.split(/\s+/).filter(Boolean);
  }, [text, splitMode]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 1", "end 0.12"],
  });

  /** 更早跑满进度；前置留白缩短，整体上移显现时机 */
  const scaledProgress = useTransform(scrollYProgress, (p) => clamp01(p / 0.30));
  const revealProgress = useTransform(scaledProgress, (p) => clamp01((p - 0.025) / 0.975));

  const total = words.length;
  const minHeightStyle =
    total > 0
      ? { minHeight: `clamp(72vh, ${120 + total * 20}px, min(240vh, 6500px))` }
      : { minHeight: "60vh" };

  useEffect(() => {
    if (isReduced) return;

    const el = typeof document !== "undefined" ? document.getElementById(handoffTargetId) : null;
    if (!el) return;

    const commitHandoff = () => {
      const inner = innerRef.current;
      const target = containerRef.current;
      if (!inner || !target) return;
      const ir = inner.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      setHandoffBox({
        top: ir.top - tr.top,
        left: ir.left - tr.left,
        width: ir.width,
      });
      setHandoff(true);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const shouldPin =
          entry?.isIntersecting === true && entry.intersectionRatio >= 0.035;
        if (shouldPin) {
          requestAnimationFrame(() => commitHandoff());
        } else {
          setHandoff(false);
          setHandoffBox(null);
        }
      },
      { threshold: [0, 0.02, 0.035, 0.08, 0.15], rootMargin: "0px 0px -6% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [handoffTargetId, isReduced]);

  return (
    <section id={id} className={`scroll-reveal-words ${className}`.trim()} aria-label={text}>
      <div ref={containerRef} className="scroll-reveal-words__target" style={minHeightStyle}>
        <div
          className={`scroll-reveal-words__pin ${handoff ? "is-handoff" : ""}`}
          style={
            handoff && handoffBox
              ? {
                  position: "absolute",
                  top: handoffBox.top,
                  left: handoffBox.left,
                  width: handoffBox.width,
                  right: "auto",
                  bottom: "auto",
                }
              : undefined
          }
        >
          <p ref={innerRef} className="scroll-reveal-words__inner">
            {isReduced ? (
              <span className="scroll-reveal-words__static">{text}</span>
            ) : (
              words.map((word, i) => (
                <React.Fragment key={`${i}-${word}`}>
                  <span
                    className="scroll-reveal-words__wave"
                    style={{ animationDelay: `${i * 0.052}s` }}
                    aria-hidden="true"
                  >
                    <WordSpan
                      word={word}
                      index={i}
                      total={total}
                      scrollYProgress={revealProgress}
                      isReduced={!!isReduced}
                    />
                  </span>
                  {splitMode === "word" && i < total - 1 ? " " : null}
                </React.Fragment>
              ))
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
