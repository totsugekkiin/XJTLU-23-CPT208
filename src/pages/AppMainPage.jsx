import React, { useEffect, useLayoutEffect, useState } from "react";
import { RouteSection } from "../components/RouteSection.jsx";
import { ScrollRevealWords } from "../components/ScrollRevealWords.jsx";
import { ChangmenGatePreloader } from "../components/ChangmenGatePreloader.jsx";
import { AncientScrollBrushAnimation } from "../components/AncientScrollBrushAnimation.jsx";
import {
  CHANGMEN_HISTORY_CONTENTS,
  CHANGMEN_INFO_CONTENTS,
} from "../../js/content/changmenExperienceContent.js";
import {
  EXPERIENCE_VARIANT_AR,
  resolveExperienceVariant,
} from "../../js/appmain/experienceVariant.js";

const AR_GATE_RESUME_KEY = "changmen.ar.resume-gate.v1";

function hasGateResumeRequest() {
  if (typeof window === "undefined") return false;

  const queryResume = new URLSearchParams(window.location.search).get("resume") === "gate";
  let storedResume = false;
  try {
    storedResume = window.sessionStorage.getItem(AR_GATE_RESUME_KEY) === "1";
  } catch {
    // sessionStorage is an enhancement; the query parameter remains the fallback.
  }
  return queryResume || storedResume;
}

function markArGateResume() {
  try {
    window.sessionStorage.setItem(AR_GATE_RESUME_KEY, "1");
  } catch {
    // The AR exit URL still carries resume=gate if storage is unavailable.
  }
}

const HISTORY_CONTENT_BY_ID = Object.freeze(
  Object.fromEntries(CHANGMEN_HISTORY_CONTENTS.map((content) => [content.id, content])),
);

function TextFilmstripCard({ contentId, index, year }) {
  const content = HISTORY_CONTENT_BY_ID[contentId];
  if (!content) return null;

  return (
    <div className="cm-filmstrip__item cm-filmstrip__item--text-detail">
      <div className="cm-filmstrip__segment" />
      <div className="cm-filmstrip__dot" />
      <div className="cm-filmstrip__year">{year}</div>
      <div className="cm-filmstrip__text-panel" aria-hidden="true">
        <span className="cm-filmstrip__text-index">
          {String(index).padStart(2, "0")}
        </span>
        <span className="cm-filmstrip__text-kicker">阊门纪事</span>
        <strong>{content.label}</strong>
      </div>
      <div className="cm-filmstrip__info">
        <h3>{content.description}</h3>
        <p>{content.article}</p>
      </div>
    </div>
  );
}

export function AppMainPage() {
  // 路线区段（含高德地图）首屏被 CSS display:none 隐藏。
  // 直接 mount 会让首屏就请求高德 SDK + 初始化 WebGL，浪费资源、加剧卡顿。
  // 这里改为只在用户实际进入“河流页”后再挂载，挂载后保留（避免反复初始化地图）。
  const [shouldMountRoute, setShouldMountRoute] = useState(false);
  const [resumeAtGate] = useState(hasGateResumeRequest);
  const [experienceVariant] = useState(resolveExperienceVariant);
  const isArVariant = experienceVariant === EXPERIENCE_VARIANT_AR;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.dataset.experienceVariant = experienceVariant;
    document.body.classList.add(`experience-variant--${experienceVariant}`);

    return () => {
      delete document.body.dataset.experienceVariant;
      document.body.classList.remove(`experience-variant--${experienceVariant}`);
    };
  }, [experienceVariant]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.body.classList.contains("is-river-page")) {
      setShouldMountRoute(true);
      return;
    }
    if (typeof MutationObserver === "undefined") {
      // 兜底：若无 MutationObserver，过段时间再挂载
      const t = window.setTimeout(() => setShouldMountRoute(true), 4000);
      return () => window.clearTimeout(t);
    }
    const obs = new MutationObserver(() => {
      if (document.body.classList.contains("is-river-page")) {
        setShouldMountRoute(true);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    let firstFrame = null;
    let secondFrame = null;

    const scrollToGate = () => {
      const gate = document.getElementById("cm-transition");
      if (!gate) return;

      gate.scrollIntoView({ behavior: "auto", block: "start" });

      const url = new URL(window.location.href);
      url.searchParams.delete("resume");
      url.hash = "cm-transition";
      window.history.replaceState(window.history.state, "", url);
    };

    const consumeStoredGateResume = () => {
      let shouldResume = false;
      try {
        shouldResume = window.sessionStorage.getItem(AR_GATE_RESUME_KEY) === "1";
        if (shouldResume) window.sessionStorage.removeItem(AR_GATE_RESUME_KEY);
      } catch {
        shouldResume = false;
      }
      if (!shouldResume) return;

      globalThis.__CHANGMEN_PRELOADER_DONE__ = true;
      firstFrame = window.requestAnimationFrame(() => {
        scrollToGate();
        secondFrame = window.requestAnimationFrame(scrollToGate);
      });
    };

    const onPageShow = (event) => {
      if (event.persisted) consumeStoredGateResume();
    };

    if (resumeAtGate) {
      try {
        window.sessionStorage.removeItem(AR_GATE_RESUME_KEY);
      } catch {
        // The resume query remains sufficient when storage is unavailable.
      }
      globalThis.__CHANGMEN_PRELOADER_DONE__ = true;
      firstFrame = window.requestAnimationFrame(() => {
        scrollToGate();
        secondFrame = window.requestAnimationFrame(scrollToGate);
      });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, [resumeAtGate]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 让现有 appmain 模块能继续使用 window.gsap / window.ScrollTrigger / globalThis.PIXI
      // exposeGlobals 已在 entry 里执行
      if (cancelled) return;

      // 延迟到首帧后再 import，确保 DOM 已由 React 渲染完毕
      await new Promise((r) => requestAnimationFrame(() => r(true)));
      if (cancelled) return;

      // 由 React 页面显式控制初始化，避免模块顶层自动 boot
      globalThis.__APPMAIN_NO_AUTOBOOT__ = true;
      const mod = await import("../../js/appmain.js");
      if (typeof mod.bootstrapAppMain === "function") {
        mod.bootstrapAppMain();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {!resumeAtGate && <ChangmenGatePreloader />}
      <section className="hero" id="hero">
        <div className="cloud-field" aria-hidden="true">
          <span className="cloud cloud--a" style={{ "--cx": "4%", "--cy": "3%", "--cs": 1.05, "--co": 0.95, "--cd": "-0.2s" }} />
          <span className="cloud cloud--b" style={{ "--cx": "74%", "--cy": "6%", "--cs": 0.78, "--co": 0.88, "--cd": "-2.4s" }} />
          <span className="cloud cloud--c" style={{ "--cx": "38%", "--cy": "12%", "--cs": 0.6, "--co": 0.72, "--cd": "-4.7s" }} />
          <span className="cloud cloud--a" style={{ "--cx": "62%", "--cy": "19%", "--cs": 1.15, "--co": 0.92, "--cd": "-1.1s" }} />
          <span className="cloud cloud--b" style={{ "--cx": "8%", "--cy": "27%", "--cs": 0.88, "--co": 0.9, "--cd": "-3.8s" }} />
          <span className="cloud cloud--c" style={{ "--cx": "84%", "--cy": "33%", "--cs": 0.72, "--co": 0.8, "--cd": "-5.6s" }} />
          <span className="cloud cloud--a" style={{ "--cx": "26%", "--cy": "41%", "--cs": 0.95, "--co": 0.9, "--cd": "-0.8s" }} />
          <span className="cloud cloud--b" style={{ "--cx": "68%", "--cy": "47%", "--cs": 0.68, "--co": 0.78, "--cd": "-6.3s" }} />
          <span className="cloud cloud--c" style={{ "--cx": "12%", "--cy": "55%", "--cs": 1.1, "--co": 0.93, "--cd": "-2.0s" }} />
          <span className="cloud cloud--a" style={{ "--cx": "56%", "--cy": "62%", "--cs": 0.82, "--co": 0.86, "--cd": "-4.1s" }} />
          <span className="cloud cloud--b" style={{ "--cx": "82%", "--cy": "69%", "--cs": 0.95, "--co": 0.9, "--cd": "-1.7s" }} />
          <span className="cloud cloud--c" style={{ "--cx": "20%", "--cy": "76%", "--cs": 0.7, "--co": 0.78, "--cd": "-5.2s" }} />
          <span className="cloud cloud--a" style={{ "--cx": "64%", "--cy": "83%", "--cs": 1.0, "--co": 0.92, "--cd": "-3.0s" }} />
          <span className="cloud cloud--b" style={{ "--cx": "10%", "--cy": "90%", "--cs": 0.78, "--co": 0.85, "--cd": "-0.5s" }} />
          <span className="cloud cloud--c" style={{ "--cx": "78%", "--cy": "95%", "--cs": 0.9, "--co": 0.9, "--cd": "-4.4s" }} />
        </div>

        <div className="hero-changmen-silhouette" aria-hidden="true">
          <img
            className="hero-changmen-silhouette__image"
            src="images/gate/gate.png"
            alt=""
          />
        </div>

        <article className="hero-copy hero-card" id="hero-card" data-component="hero-card">
          <div className="hero-card-stack" id="hero-card-stack">
            <section className="stack-card stack-card--primary" data-card-index="0">
              <h1 className="hero-card__title">阊门</h1>
              <p className="hero-card__description">从阊门入城，沿山塘河认识苏州的水陆格局。</p>
              <div className="hero-card__actions">
                <span className="hero-card__go-text">GO</span>
              </div>
              <div className="hero-scroll-hint hero-card__scroll-hint" aria-hidden="true">
                <span className="hint-stem hero-card__hint-stem" />
                <span className="hint-head hero-card__hint-head" />
              </div>
            </section>

            <section className="stack-card stack-card--blue" data-card-index="1">
              <div className="stack-card__head">
                <h2 className="hero-card__title hero-card__title--sub">建城沿革</h2>
              </div>
              <div className="stack-card__stage">
                <svg className="stack-card__svg svg-motif svg-motif--star" viewBox="0 0 220 160" aria-hidden="true" role="img">
                  <circle className="motif-core" cx="110" cy="78" r="28" />
                  <polygon className="motif-star motif-spin" points="110,28 121,60 155,60 127,80 138,112 110,92 82,112 93,80 65,60 99,60" />
                  <circle className="motif-dot motif-float motif-delay-1" cx="52" cy="42" r="7" />
                  <circle className="motif-dot motif-float motif-delay-2" cx="176" cy="56" r="5" />
                  <circle className="motif-dot motif-float motif-delay-3" cx="70" cy="120" r="6" />
                  <path className="motif-orbit" d="M42 94C70 124 150 124 178 94" />
                </svg>
              </div>
              <div className="stack-card__foot">
                <p className="hero-card__description">据传统文献记载，公元前514年伍子胥主持营建阖闾大城，阊门设在古城西北。</p>
              </div>
            </section>

            <section className="stack-card stack-card--cream" data-card-index="2">
              <div className="stack-card__head">
                <h2 className="hero-card__title hero-card__title--sub">明清商贸</h2>
              </div>
              <div className="stack-card__stage">
                <svg className="stack-card__svg svg-motif svg-motif--coin" viewBox="0 0 220 160" aria-hidden="true" role="img">
                  <g className="motif-coin">
                    <circle className="motif-coin-outer" cx="110" cy="82" r="44" />
                    <circle className="motif-coin-inner-ring" cx="110" cy="82" r="33" />
                    <rect className="motif-coin-hole" x="95" y="67" width="30" height="30" rx="3" />
                    <path className="motif-coin-glyph motif-coin-glyph--top" d="M110 44L116 52L110 60L104 52Z" />
                    <path className="motif-coin-glyph motif-coin-glyph--right" d="M148 82L140 88L132 82L140 76Z" />
                    <path className="motif-coin-glyph motif-coin-glyph--bottom" d="M110 120L116 112L110 104L104 112Z" />
                    <path className="motif-coin-glyph motif-coin-glyph--left" d="M72 82L80 88L88 82L80 76Z" />
                  </g>
                </svg>
              </div>
              <div className="stack-card__foot">
                <p className="hero-card__description">明清时期，西中市、南濠与山塘在阊门内外相接，沿河分布商铺、会馆和货运码头。</p>
              </div>
            </section>

            <section className="stack-card stack-card--green" data-card-index="3">
              <div className="stack-card__head">
                <h2 className="hero-card__title hero-card__title--sub">街区文化</h2>
              </div>
              <div className="stack-card__stage">
                <svg className="stack-card__svg svg-motif svg-motif--lotus" viewBox="0 0 220 160" aria-hidden="true" role="img">
                  <ellipse className="lotus-water lotus-water--1" cx="110" cy="130" rx="74" ry="6" />
                  <ellipse className="lotus-water lotus-water--2" cx="110" cy="140" rx="48" ry="4" />
                  <ellipse className="lotus-pad" cx="110" cy="120" rx="62" ry="10" />
                  <g className="lotus">
                    <g transform="rotate(-82 110 110)">
                      <path className="petal petal--outer petal--o1" d="M110 110 C84 88 84 54 110 32 C136 54 136 88 110 110 Z" />
                    </g>
                    <g transform="rotate(-42 110 110)">
                      <path className="petal petal--outer petal--o2" d="M110 110 C84 88 84 54 110 32 C136 54 136 88 110 110 Z" />
                    </g>
                    <g transform="rotate(0 110 110)">
                      <path className="petal petal--outer petal--o3" d="M110 110 C84 88 84 54 110 32 C136 54 136 88 110 110 Z" />
                    </g>
                    <g transform="rotate(42 110 110)">
                      <path className="petal petal--outer petal--o2" d="M110 110 C84 88 84 54 110 32 C136 54 136 88 110 110 Z" />
                    </g>
                    <g transform="rotate(82 110 110)">
                      <path className="petal petal--outer petal--o1" d="M110 110 C84 88 84 54 110 32 C136 54 136 88 110 110 Z" />
                    </g>

                    <g transform="rotate(-48 110 110)">
                      <path className="petal petal--mid petal--m1" d="M110 110 C94 96 94 68 110 50 C126 68 126 96 110 110 Z" />
                    </g>
                    <g transform="rotate(-16 110 110)">
                      <path className="petal petal--mid petal--m2" d="M110 110 C94 96 94 68 110 50 C126 68 126 96 110 110 Z" />
                    </g>
                    <g transform="rotate(16 110 110)">
                      <path className="petal petal--mid petal--m2" d="M110 110 C94 96 94 68 110 50 C126 68 126 96 110 110 Z" />
                    </g>
                    <g transform="rotate(48 110 110)">
                      <path className="petal petal--mid petal--m1" d="M110 110 C94 96 94 68 110 50 C126 68 126 96 110 110 Z" />
                    </g>

                    <g transform="rotate(-22 110 110)">
                      <path className="petal petal--inner petal--i1" d="M110 110 C100 100 100 82 110 70 C120 82 120 100 110 110 Z" />
                    </g>
                    <g transform="rotate(22 110 110)">
                      <path className="petal petal--inner petal--i1" d="M110 110 C100 100 100 82 110 70 C120 82 120 100 110 110 Z" />
                    </g>
                    <path className="petal petal--inner petal--i2" d="M110 110 C102 102 102 88 110 78 C118 88 118 102 110 110 Z" />

                    <circle className="lotus-core" cx="110" cy="98" r="5" />
                  </g>
                </svg>
              </div>
              <div className="stack-card__foot">
                <p className="hero-card__description">
                  《红楼梦》开篇以「最是红尘中一二等富贵风流之地」写阊门。周边至今保存街巷、园林、会馆与传统手艺。
                </p>
              </div>
            </section>

            <section className="stack-card stack-card--indigo" data-card-index="4">
              <div className="stack-card__head">
                <h2 className="hero-card__title hero-card__title--sub">画中阊门</h2>
              </div>
              <div className="stack-card__stage">
                <AncientScrollBrushAnimation />
              </div>
              <div className="stack-card__foot">
                <p className="hero-card__description">
                  1759年，徐扬完成《盛世滋生图》。长卷记录了阊门一带的河道、码头、店铺与往来人群，今通常称《姑苏繁华图》。
                </p>
              </div>
            </section>
          </div>
        </article>
      </section>

      <div className="hero-topbar" id="hero-topbar">
        <div className="hero-topbar__left">
          <button className="hero-pet-dock-btn" id="hero-pet-dock-btn" type="button" aria-label="将桌宠移到屏幕右下角" title="桌宠到右下角" />
          <span className="hero-logo">changmen</span>
        </div>
        <button className="hero-pill" id="hero-guide-btn" type="button" aria-label="打开互动导览菜单">
          互动导览
        </button>
      </div>

      <ScrollRevealWords
        id="scroll-reveal-changmen"
        splitMode="char"
        handoffTargetId={isArVariant ? "ar-entry-section" : "cm-transition"}
        text="阊门的变化不只发生在城门本身。继续下滑，查看从春秋建城到近现代保护的关键节点。"
      />

      {isArVariant ? (
        <section className="ar-entry-section" id="ar-entry-section" aria-labelledby="ar-entry-title">
          <div className="ar-entry-section__orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ar-entry-section__content">
            <p className="ar-entry-section__eyebrow">CHANGMEN · 实景导览</p>
            <h2 id="ar-entry-title">在现场查看<br />阊门历史。</h2>
            <p className="ar-entry-section__description">
              开启相机后，对准指定建筑区域或识别图案。识别成功后，历史场景与竹简会显示在对应位置。
            </p>
            <div className="ar-entry-section__actions">
              <a
                className="ar-entry-section__primary"
                href="loc-ar.html?from=app-main&return=gate&variant=ar"
                onClick={markArGateResume}
              >
                <span className="ar-entry-section__button-mark" aria-hidden="true">实景</span>
                <span>
                  <strong>开始实景导览</strong>
                  <small>需要相机权限</small>
                </span>
                <span className="ar-entry-section__arrow" aria-hidden="true">↗</span>
              </a>
              <div className="ar-entry-section__tests" aria-label="AR 单项测试入口">
                <span className="ar-entry-section__tests-label">单项测试</span>
                <div className="ar-entry-section__test-links">
                  <a href="marker-ar.html?from=app-main" onClick={markArGateResume}>
                    <span aria-hidden="true">M</span>
                    <span>
                      <strong>MindAR 测试</strong>
                      <small>图像标记追踪</small>
                    </span>
                    <i aria-hidden="true">↗</i>
                  </a>
                  <a
                    href="loc-ar.html?dev&recognition=immersal&from=app-main&return=gate&variant=ar"
                    onClick={markArGateResume}
                  >
                    <span aria-hidden="true">I</span>
                    <span>
                      <strong>Immersal 测试</strong>
                      <small>空间地图定位</small>
                    </span>
                    <i aria-hidden="true">↗</i>
                  </a>
                </div>
              </div>
              <a className="ar-entry-section__skip" href="#cm-transition">
                继续查看时间线
                <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <p className="ar-entry-section__scroll-note" aria-hidden="true">继续下滑查看时间线</p>
        </section>
      ) : null}

      <section className="cm-mask-transition" id="cm-transition" aria-label="阊门历史时间线">
        <div className="cm-mask-transition__scroll" id="cm-mask-scroll">
          <div className="cm-mask-transition__sticky">
            <div className="cm-mask-bottom" aria-hidden="true">
              <div className="cm-celestial-sun" id="bgSun" aria-hidden="true" />
              <div className="cm-celestial-moon" id="bgMoon" aria-hidden="true" />

              <div className="cm-mask-bottom__title-wrap" id="cmTitleWrap">
                <span className="cm-mask-bottom__title-half cm-mask-bottom__title-half--top" id="cmTitleTop" aria-hidden="true">
                  阊
                </span>
                <span className="cm-mask-bottom__title-half cm-mask-bottom__title-half--bottom" id="cmTitleBottom" aria-hidden="true">
                  门
                </span>
              </div>

              <div className="cm-filmstrip" id="cmFilmstrip" aria-hidden="true">
                <div className="cm-filmstrip__track" id="cmFilmTrack">
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元前514年</div>
                    <img src="https://picsum.photos/seed/cm1/600/400" alt="阖闾建城与破楚门" />
                    <div className="cm-filmstrip__info">
                      <h3>阖闾建城 Helü&apos;s Capital</h3>
                      <p>
                        据文献记载，公元前514年，伍子胥奉吴王阖闾之命主持建城。阊门设在古城西北，是八座城门之一；「破楚门」是与吴楚战争相关的别称，并非它最初的正式名称。
                      </p>
                    </div>
                  </div>
                  {!isArVariant ? (
                    <TextFilmstripCard
                      contentId="spring-autumn"
                      index={1}
                      year="公元前514年"
                    />
                  ) : null}
                  {!isArVariant ? (
                    <TextFilmstripCard
                      contentId="tang"
                      index={2}
                      year="公元825年"
                    />
                  ) : null}
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元12世纪-13世纪</div>
                    <img
                      src="images/pingjiang-tu.png"
                      alt="南宋《平江图》：阊门一带水陆城门并列与水网格局"
                      style={{ objectFit: "contain", backgroundColor: "#0d0d0d" }}
                    />
                    <div className="cm-filmstrip__info">
                      <h3>南宋时期 Southern Song</h3>
                      <p>
                        1229年刻成的《平江图》记录了苏州城墙、河道和街巷。图中阊门设水、陆两门，分别连接城内河道与城外道路。
                      </p>
                    </div>
                  </div>
                  {!isArVariant ? (
                    <TextFilmstripCard
                      contentId="southern-song"
                      index={3}
                      year="公元1229年"
                    />
                  ) : null}
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元14世纪-17世纪</div>
                    <img
                      src="images/ming-suzhou-changmen-map.png"
                      alt="明清时期苏州城厢图局部：阊门、山塘河与城外水网商贸"
                      style={{ objectFit: "contain", backgroundColor: "#0d0d0d" }}
                    />
                    <div className="cm-filmstrip__info">
                      <h3>明代 Ming Dynasty</h3>
                      <p>
                        明代苏州商贸活动逐渐向阊门集中。西中市、南濠和山塘相互连接，沿河形成商铺、会馆与码头密集的转运街市。
                      </p>
                    </div>
                  </div>
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元18世纪</div>
                    <img
                      src="images/changmen-film-4.png"
                      alt="清代康乾时期阊门繁华与《姑苏繁华图》意象"
                      style={{ objectFit: "contain", backgroundColor: "#0d0d0d" }}
                    />
                    <div className="cm-filmstrip__info">
                      <h3>清代康乾时期 Kangxi–Qianlong</h3>
                      <p>
                        清代阊门街市继续扩展。徐扬1759年完成的《盛世滋生图》详细画出这一带的河运、店铺和市民生活，今通常称《姑苏繁华图》。
                      </p>
                    </div>
                  </div>
                  {!isArVariant ? (
                    <TextFilmstripCard
                      contentId="ming-qing"
                      index={4}
                      year="公元14世纪-18世纪"
                    />
                  ) : null}
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元1860年前后</div>
                    <img src="images/changmen-film-5.png" alt="晚清庚申之劫与阊门战事" />
                    <div className="cm-filmstrip__info">
                      <h3>晚清时期 Late Qing</h3>
                      <p>
                        1860年前后，战火波及阊门外的南濠、山塘等街市，大量商铺和建筑受损，原有商贸格局由此发生改变。
                      </p>
                    </div>
                  </div>
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元1912年-1949年</div>
                    <img src="images/changmen-film-6.png" alt="民国时期阊门拆墙筑路与铁路兴起" />
                    <div className="cm-filmstrip__info">
                      <h3>民国时期 Republican China</h3>
                      <p>
                        民国时期，城墙拆改、道路建设和铁路交通改变了阊门内外的通行方式，街区中也出现了新的公共与商业建筑。
                      </p>
                    </div>
                  </div>
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元1949年-2000年</div>
                    <img src="images/changmen-film-7.png" alt="20世纪中后期阊门老城区与市井烟火" />
                    <div className="cm-filmstrip__info">
                      <h3>20世纪中后期 Late 20th Century</h3>
                      <p>
                        随着交通方式和城市功能变化，阊门不再承担主要货运集散职能，街区逐渐以居住、零售和传统手工业为主。
                      </p>
                    </div>
                  </div>
                  <div className="cm-filmstrip__item">
                    <div className="cm-filmstrip__segment" />
                    <div className="cm-filmstrip__dot" />
                    <div className="cm-filmstrip__year">公元2006年至今</div>
                    <img src="images/changmen-film-8.png" alt="当代阊门城楼重建与文化地标" />
                    <div className="cm-filmstrip__info">
                      <h3>当代 Contemporary</h3>
                      <p>
                        2004年，阊门水城门遗址被发现；2006年完成保护与修复。现存遗址、城墙和周边街区共同展示古城西北部的水陆格局。
                      </p>
                    </div>
                  </div>
                  {!isArVariant ? (
                    <TextFilmstripCard
                      contentId="modern"
                      index={5}
                      year="公元1863年至今"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="cm-mask-top" id="maskLayer" aria-hidden="true">
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <pattern id="cmGridPattern" width="64" height="64" patternUnits="userSpaceOnUse">
                    <rect width="64" height="64" fill="#e31221" />
                    <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#600000" strokeWidth="1.5" />
                  </pattern>

                  <mask id="cmHoleMask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect x="396" y="190" width="208" height="620" rx="104" fill="black" />
                  </mask>
                </defs>

                <rect width="1000" height="1000" fill="url(#cmGridPattern)" mask="url(#cmHoleMask)" />
                <rect x="384" y="178" width="232" height="644" rx="116" fill="none" stroke="#e31221" strokeWidth="24" />
                <rect x="372" y="166" width="256" height="668" rx="128" fill="none" stroke="#000000" strokeWidth="1" />
                <rect x="396" y="190" width="208" height="620" rx="104" fill="none" stroke="#000000" strokeWidth="1" />
              </svg>
            </div>

          </div>
        </div>
      </section>

      <div className="curtain-container" id="curtainOverlay" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <path id="leftCurtain" d="M0,0 L0,0 L0,100 L0,100 Z" fill="#f4f1ea" />
          <path id="rightCurtain" d="M100,0 L100,0 L100,100 L100,100 Z" fill="#f4f1ea" />
        </svg>
      </div>

      <div id="river-scroll-spacer" aria-hidden="true" />

      <div className="river-stage" id="river-stage" aria-hidden="true">
        <canvas id="river-canvas" />

        <div className="river-island-layer" id="river-island-layer" aria-hidden="true">
          <div className="river-island" data-island-index="0">
            <div className="river-island__shore">
              <div className="river-island__land">
                <h3 className="river-island__title">唐代山塘：阊门通往虎丘的道路</h3>
                <p className="river-island__desc">825年，白居易出任苏州刺史，组织修筑阊门至虎丘一带的堤路，改善陆路通行，堤路后来发展为山塘街。后世方志记有开凿山塘河的说法，但较早资料只明确记载修建堤路，因此究竟是新开河道还是整治原有水道，仍需区分说明。</p>
              </div>
            </div>
          </div>
          <div className="river-island" data-island-index="1">
            <div className="river-island__shore">
              <div className="river-island__land">
                <h3 className="river-island__title">历史文化：城门之外的街区</h3>
                <p className="river-island__desc">明清以来，阊门内外河街并行，米行、布庄、会馆与码头沿水分布，货物可在船运和陆运之间直接转接。</p>
                {!isArVariant ? (
                  <div className="river-island__supplement">
                    <strong>{CHANGMEN_INFO_CONTENTS.culture.title}</strong>
                    <p>{CHANGMEN_INFO_CONTENTS.culture.article}</p>
                  </div>
                ) : null}
              </div>
              <div className="river-island__frame">
                <img className="river-island__img" src="images/river-changmen-old-street.png" alt="清末民初阊门外街景：商铺林立、人力车与行人穿行" />
              </div>
            </div>
          </div>
          <div className="river-island" data-island-index="2">
            <div className="river-island__shore">
              <div className="river-island__land">
                <h3 className="river-island__title">地理位置：古城西北的水陆节点</h3>
                <p className="river-island__desc">阊门位于苏州古城西北。城内通往西中市、吴趋坊，城外连接北码头、山塘与外城河，是水路和陆路的交会位置。</p>
                {!isArVariant ? (
                  <div className="river-island__supplement">
                    <strong>{CHANGMEN_INFO_CONTENTS.geography.title}</strong>
                    <p>{CHANGMEN_INFO_CONTENTS.geography.article}</p>
                  </div>
                ) : null}
              </div>
              <div className="river-island__frame">
                <img className="river-island__img" src="images/river-changmen-aerial.png" alt="今日阊门片区航拍：山塘起点、北码头与环古城河水网交织的城市肌理" />
              </div>
            </div>
          </div>

          <div className="river-island river-island--large-viz river-island--viz-only" data-island-index="3">
            <div className="river-island__shore">
              <div className="river-island__viz-stack">
                <p className="river-island__viz-intro">阊门城墙、河道与街市格局复原</p>
                <div className="river-island__frame river-island__frame--credit">
                  <img
                    className="river-island__img river-island__img--color"
                    src="images/river-changmen-3d-reconstruction.png"
                    alt="阊门古城水网与城墙三维数字复原鸟瞰：河道、城垣、街市与帆船（复原图由@古城阳面制作）"
                  />
                  <p className="river-island__img-credit">
                    复原图，由@古城阳面 制作
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div id="boat-container" aria-hidden="true">
          <svg id="boat" viewBox="0 0 80 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="乌篷船俯视图">
            <path fill="#3a2a1f" d="M40,5 C55,40 70,100 70,160 C70,220 55,280 40,315 C25,280 10,220 10,160 C10,100 25,40 40,5 Z" />
            <path fill="#5c4434" d="M40,10 C52,40 62,80 62,110 L18,110 C18,80 28,40 40,10 Z" />
            <path fill="#5c4434" d="M18,220 L62,220 C62,250 52,290 40,310 C28,290 18,250 18,220 Z" />
            <rect fill="#1a1a1a" x="15" y="110" width="50" height="30" rx="4" />
            <path fill="rgba(255,255,255,0.05)" d="M15,110 H65 V115 Q40,118 15,115 Z" />
            <rect fill="#1a1a1a" x="12" y="138" width="56" height="50" rx="4" />
            <path fill="rgba(255,255,255,0.05)" d="M12,138 H68 V145 Q40,150 12,145 Z" />
            <rect fill="#1a1a1a" x="15" y="186" width="50" height="36" rx="4" />
            <path fill="rgba(255,255,255,0.05)" d="M15,186 H65 V191 Q40,195 15,191 Z" />
            <circle fill="#e31221" cx="40" cy="40" r="1.5" />
            <g transform="rotate(-15, 40, 280)">
              <rect fill="#2a1a0f" x="38" y="270" width="4" height="60" rx="2" />
              <path fill="#1a0f08" d="M38,300 H42 L45,330 Q40,335 35,330 Z" opacity="0.8" />
            </g>
          </svg>
        </div>
      </div>

      {/* 仅河流页模式显示（CSS）；胶片段滚动时不占位
          且仅当用户实际进入河流页后才挂载，避免首屏就初始化高德地图浪费 CPU/网络 */}
      <section className="route-after-river" id="route-section" aria-label="推荐路线">
        {shouldMountRoute ? (
          <RouteSection
            heightVh={100}
            returnHref={`appMain.html?variant=${experienceVariant}`}
          />
        ) : null}
      </section>

      <div id="pet-layer" className="pet-layer" aria-hidden="true">
        <div id="pet-hitzone" className="pet-hitzone" role="button" aria-label="可拖拽的桌面宠物" tabIndex={-1} />

        <div className="pet-comic-ui is-hidden" id="pet-comic-ui" aria-hidden="true">
          <div className="pet-bubble pet-bubble--agent is-hidden" id="pet-bubble-agent" aria-live="polite" aria-hidden="true">
            <div className="pet-bubble__agent-shell">
              <div className="pet-bubble__agent-body">
                <p className="pet-bubble__agent-text" id="pet-bubble-agent-text" />
              </div>
              <div className="pet-bubble__agent-tail" aria-hidden="true" />
            </div>
          </div>
          <div className="pet-bubble pet-bubble--user is-hidden" id="pet-bubble-user" aria-live="polite" aria-hidden="true">
            <div className="pet-bubble__user-shell">
              <span className="pet-bubble__user-dot pet-bubble__user-dot--a" aria-hidden="true" />
              <span className="pet-bubble__user-dot pet-bubble__user-dot--b" aria-hidden="true" />
              <div className="pet-bubble__user-body">
                <p className="pet-bubble__user-text" id="pet-bubble-user-text" />
              </div>
            </div>
          </div>

          <form className="pet-inputbar is-hidden" id="pet-inputbar" autoComplete="off">
            <button className="pet-inputbar__enter" id="pet-inputbar-enter" type="submit" aria-label="发送（ENTER）">
              ENTER
            </button>

            <input
              className="pet-inputbar__input"
              id="pet-inputbar-input"
              type="text"
              inputMode="text"
              placeholder="询问阊门历史、街巷或路线…"
              aria-label="输入消息"
            />

            <button className="pet-inputbar__sendIcon" id="pet-inputbar-send" type="submit" aria-label="发送">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path
                  d="M2.1 12.5c0-.3.2-.6.5-.7L21 3.2c.3-.1.7-.1.9.2.2.2.2.6 0 .9l-7.7 16.4c-.2.5-.9.6-1.3.2l-3.6-3.6-5.2-1.8c-.3-.1-.5-.4-.5-.7zm7.6 3.2 3 3 5.8-12.2-8.8 8.8zM4.7 12.5l4.1 1.4 8.2-8.2-12.3 6.8z"
                  fill="currentColor"
                />
              </svg>
            </button>

            <button className="pet-inputbar__close" id="pet-inputbar-close" type="button" aria-label="关闭对话">
              ×
            </button>
          </form>
        </div>
      </div>

      <nav className="guide-menu" id="guide-menu" aria-label="互动导览选项" aria-hidden="true">
        <div className="guide-menu__backdrop" aria-hidden="true" />
        <div
          className="guide-menu__panel"
          id="guide-menu-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-menu-headline"
          aria-hidden="true"
        >
          <div className="guide-menu__chrome">
            <span className="guide-menu__brand" aria-hidden="true">
              changmen
            </span>
            <div className="guide-menu__actions">
              <button className="guide-menu__pill-cta" type="button" data-action="explore">
                重新开始
              </button>
              <button className="guide-menu__icon-btn guide-menu__icon-btn--close" id="guide-menu-close" type="button" aria-label="关闭菜单">
                <svg className="guide-menu__icon-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <h2 className="guide-menu__headline" id="guide-menu-headline">
            <span className="guide-menu__headline-line">CHANG GATE</span>
            <span className="guide-menu__headline-line">CHANG GATE</span>
            <span className="guide-menu__headline-line">CHANG  GATE</span>
            <span className="guide-menu__headline-line">CHANG    GATE</span>
          </h2>

          <div className="guide-menu__columns">
            <div className="guide-menu__col">
              <button className="guide-menu__link" type="button" data-action="timeline">
                影像时间轴
              </button>
              <button className="guide-menu__link" type="button" data-action="hero">
                回到首屏
              </button>
            </div>
            <div className="guide-menu__col">
              <button className="guide-menu__link" type="button" data-action="route">
                推荐路线
              </button>
              <button className="guide-menu__link" type="button" data-action="pet">
                黛玉伴游
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="guide-map is-hidden" id="guide-map" aria-label="互动小地图" aria-hidden="true">
        <div className="guide-map__chrome">
          <div className="guide-map__title">互动小地图</div>
          <button className="guide-map__close" id="guide-map-close" type="button" aria-label="关闭地图">
            ×
          </button>
        </div>
        <iframe className="guide-map__frame" id="guide-map-frame" title="地图" loading="lazy" referrerPolicy="no-referrer" />
      </section>
    </>
  );
}

