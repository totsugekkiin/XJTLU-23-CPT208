import React, { useLayoutEffect, useRef, useState } from "react";

/** 与原 acid preloader 一致的最短台前时间，避免动画被瞬间切掉 */
const MIN_INTRO_MS = 2600;

/** PIXI / bootstrap 未及时创建 Promise 时的兜底等待 */
const TEXTURE_POLL_MS = 20000;

function waitForPetTextures() {
  return new Promise((resolve) => {
    const deadline = Date.now() + TEXTURE_POLL_MS;

    const tryResolve = () => {
      const p = globalThis.__PET_TEX_PRELOAD_PROMISE__;
      if (p) {
        void p.then(() => resolve()).catch(() => resolve());
        return true;
      }
      return false;
    };

    if (tryResolve()) return;

    const id = window.setInterval(() => {
      if (tryResolve() || Date.now() >= deadline) {
        window.clearInterval(id);
        if (!globalThis.__PET_TEX_PRELOAD_PROMISE__) resolve();
      }
    }, 32);
  });
}

/**
 * 阊门城门加载转场（源自 changmen-acid-preloader）。
 * - 挂载即触发桌宠 PNG 预加载（与 bootstrap 内部调用去重）
 * - 遮罩挡住交互直至贴图就绪且退场动画结束
 */
export function ChangmenGatePreloader() {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(true);

  useLayoutEffect(() => {
    let cancelled = false;
    const notifyDone = () => {
      globalThis.__CHANGMEN_PRELOADER_DONE__ = true;
      window.dispatchEvent(new CustomEvent("changmen-preloader-done"));
    };

    void import("../../js/appmain/pet/index.js").then((m) => {
      if (cancelled || !globalThis.PIXI?.Assets) return;
      m.startPetTexturePreload(globalThis.PIXI);
    });

    const root = rootRef.current;
    if (!root) return () => {};

    let prevOverflow = document.body.style.overflow;
    document.body.dataset.changmenPreloaderScrollBackup = prevOverflow ?? "";
    document.body.style.overflow = "hidden";

    const unlockScroll = () => {
      document.body.style.overflow =
        document.body.dataset.changmenPreloaderScrollBackup ?? "";
      delete document.body.dataset.changmenPreloaderScrollBackup;
    };

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gsap = typeof window !== "undefined" ? window.gsap : null;

    if (prefersReducedMotion || !gsap) {
      unlockScroll();
      notifyDone();
      setVisible(false);
      return () => {
        cancelled = true;
      };
    }

    const ctx = gsap.context(() => {
      const counter = root.querySelector(".changmen-gate-preloader__counter");

      const obj = { value: 0 };
      gsap.to(obj, {
        value: 100,
        duration: 3,
        ease: "power2.inOut",
        onUpdate: () => {
          if (counter && !cancelled) {
            counter.textContent = `${Math.floor(obj.value).toString().padStart(2, "0")}%`;
          }
        },
      });

      gsap.from(root.querySelectorAll(".changmen-gate-preloader__gate-svg"), {
        y: 100,
        opacity: 0,
        duration: 2,
        ease: "expo.out",
      });

      gsap.from(root.querySelectorAll(".changmen-gate-preloader__portal"), {
        scaleY: 0,
        duration: 1.5,
        ease: "power3.inOut",
        delay: 1,
      });

      gsap.from(root.querySelectorAll(".changmen-gate-preloader__title"), {
        y: 50,
        opacity: 0,
        duration: 1.2,
        ease: "power4.out",
        delay: 0.5,
      });

      void Promise.all([waitForPetTextures(), new Promise((r) => setTimeout(r, MIN_INTRO_MS))]).then(() => {
        if (cancelled || !rootRef.current) return;

        const tl = gsap.timeline({
          onComplete: () => {
            if (!cancelled) {
              unlockScroll();
              notifyDone();
              setVisible(false);
            }
          },
        });

        tl.to(".changmen-gate-preloader__content", {
          y: -30,
          opacity: 0,
          duration: 0.8,
          ease: "power3.in",
          delay: 0.2,
        })
          .to(
            ".changmen-gate-preloader__curtain",
            {
              width: "100%",
              duration: 0.8,
              ease: "expo.inOut",
            },
            "-=0.3",
          )
          .to(root, {
            xPercent: 100,
            duration: 1,
            ease: "expo.inOut",
          });
      });
    }, root);

    return () => {
      cancelled = true;
      ctx.revert();
      unlockScroll();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      id="changmen-gate-preloader"
      className="changmen-gate-preloader"
      role="progressbar"
      aria-busy="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="阊门资源加载"
    >
      <div className="changmen-gate-preloader__noise" aria-hidden="true" />
      <div className="changmen-gate-preloader__content">
        <div className="changmen-gate-preloader__stage">
          <svg className="changmen-gate-preloader__gate-svg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="50" y="200" width="300" height="80" fill="currentColor" />
            <rect x="80" y="140" width="240" height="60" fill="currentColor" />
            <rect x="120" y="80" width="160" height="60" fill="currentColor" />
            <path
              d="M170,280 L170,230 Q200,210 230,230 L230,280 Z"
              fill="var(--changmen-gate-yellow)"
              className="changmen-gate-preloader__portal"
            />
          </svg>
          <h1 className="changmen-gate-preloader__title">CHANGMEN</h1>
          <div className="changmen-gate-preloader__counter">00%</div>
        </div>
      </div>
      <div className="changmen-gate-preloader__curtain" aria-hidden="true" />
    </div>
  );
}
