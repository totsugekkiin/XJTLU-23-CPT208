import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as PIXI from "pixi.js";

export function exposeGlobals() {
  // 兼容现有代码：大量模块直接使用 window.gsap / globalThis.PIXI / Lenis
  if (typeof window !== "undefined") {
    window.gsap = gsap;
    window.ScrollTrigger = ScrollTrigger;
    try {
      gsap.registerPlugin(ScrollTrigger);
    } catch {
      // ignore
    }
    window.Lenis = Lenis;
    window.PIXI = PIXI;
  }
}

