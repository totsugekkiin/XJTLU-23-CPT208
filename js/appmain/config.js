export const layoutConfig = {
  padX: 30,
  cardMaxWidth: 460,
  scrollLengthPx: 6000,
  primary: {
    maxWidth: 350,
    heightRatio: 1,
    radius: 34,
    paddingX: 22,
    paddingY: 28,
    paddingBottom: 24,
    hiddenRatio: 0.14,
    hiddenRatioMobile: 0.2,
  },
};

export const cardsConfig = [
  {
    id: "primary",
    index: 0,
    variantClass: "stack-card--primary",
    zIndex: 5,
    size: {
      width: "var(--primary-card-width)",
      height: "var(--primary-card-height)",
    },
    radius: "var(--primary-card-radius)",
    paddingX: "var(--primary-card-pad-x)",
    paddingTop: "var(--primary-card-pad-y)",
    paddingBottom: "var(--primary-card-pad-bottom)",
    stackLayout: { x: 0, y: 0, rotate: 0, scale: 1 },
    release: { liftY: 206, driftX: 20, rotateDelta: 5 },
    contentMotion: { breatheDuration: 2.8, sheenDuration: 3.2 },
  },
  {
    id: "blue",
    index: 1,
    variantClass: "stack-card--blue",
    zIndex: 4,
    stackLayout: { x: -16, y: 10, rotate: -11, scale: 1 },
    release: { liftY: 214, driftX: 30, rotateDelta: 11 },
    contentMotion: { breatheDuration: 2.8, sheenDuration: 3.2 },
  },
  {
    id: "cream",
    index: 2,
    variantClass: "stack-card--cream",
    zIndex: 3,
    stackLayout: { x: 18, y: 4, rotate: 13, scale: 1 },
    release: { liftY: 218, driftX: -28, rotateDelta: -12 },
    contentMotion: { breatheDuration: 2.8, sheenDuration: 3.2 },
  },
  {
    id: "green",
    index: 3,
    variantClass: "stack-card--green",
    zIndex: 2,
    stackLayout: { x: 7, y: 18, rotate: 7, scale: 1 },
    release: { liftY: 224, driftX: -22, rotateDelta: -6 },
    contentMotion: { breatheDuration: 2.8, sheenDuration: 3.2 },
  },
  {
    id: "indigo",
    index: 4,
    variantClass: "stack-card--indigo",
    zIndex: 1,
    stackLayout: { x: -12, y: 21, rotate: -15, scale: 1 },
    release: { liftY: 232, driftX: 34, rotateDelta: 14 },
    contentMotion: { breatheDuration: 2.8, sheenDuration: 3.2 },
  },
];

export const motionConfig = {
  stages: {
    dockEnd: 0.34,
    switchEnd: 0.44,
    releaseEnd: 1,
  },
  switch: {
    point: 0.2,
    faceOutEnd: 0.52,
    scatterStart: 0.68,
    stackScaleXMin: 0.04,
    primaryRotateYMax: 90,
  },
  release: {
    fadeStart: 0.78,
  },
  tactile: {
    hoverTiltX: 5.2,
    hoverTiltY: 4.4,
    pressScaleX: 0.992,
    pressScaleY: 0.985,
  },
};

/** 桌宠：飞向目标区的滚动触发（相对 #hero 的 --hero-scroll-length-px，与 motionConfig.stages 同刻度 0~1） */
export const petConfig = {
  /** 达到该进度即开始 HOMING；设得比 dockEnd（0.34）小越多越早（约在重叠卡片动画之前） */
  homingScrollProgress: 0.16,
  /** 上滑低于该进度则取消目标态（滞回，避免边界抖动） */
  homingScrollRelease: 0.1,
  /** 离场后无新的 scroll 事件达到该毫秒数，桌宠回到主卡锚点（Lenis 滚动脉冲间隔常 >420ms，勿过小） */
  scrollHideReturnMs: 2800,
};
