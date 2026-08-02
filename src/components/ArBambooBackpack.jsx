import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  getBambooNoticeContent,
} from "../../js/ar/bambooNotice.js";
import {
  AR_BAMBOO_OBSERVED_EVENT,
  collectBambooNotice,
  readBambooCollection,
  saveBambooCollection,
} from "../../js/ar/bambooCollection.js";
import {
  getAdjacentBambooContentId,
  getHorizontalSwipeStep,
} from "../../js/ar/bambooSwipeNavigation.js";

function BackpackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7V5.7C8 3.7 9.6 2 11.6 2h.8C14.4 2 16 3.7 16 5.7V7" />
      <path d="M5.2 7.2h13.6l1.1 13.3H4.1L5.2 7.2Z" />
      <path d="M8.4 11.2h7.2v4.4H8.4z" />
    </svg>
  );
}

export function ArBambooBackpack() {
  const [collection, setCollection] = useState(() => readBambooCollection());
  const [isOpen, setIsOpen] = useState(false);
  const [activeContentId, setActiveContentId] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [viewerState, setViewerState] = useState("idle");
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const collectionRef = useRef(collection);
  const announcementTimerRef = useRef(null);
  const swipeStartRef = useRef(null);

  const collectedContentIds = useMemo(
    () => new Set(collection.map((entry) => entry.contentId)),
    [collection],
  );
  const collectedContents = useMemo(
    () => BAMBOO_NOTICE_CONTENT_OPTIONS.filter((content) =>
      collectedContentIds.has(content.id),
    ),
    [collectedContentIds],
  );
  const activeContent = activeContentId ? getBambooNoticeContent(activeContentId) : null;
  const activeContentIndex = collectedContents.findIndex(({ id }) => id === activeContentId);

  const showAdjacentContent = useCallback((step) => {
    if (collectedContents.length < 2) return;
    const contentIds = collectedContents.map(({ id }) => id);
    setActiveContentId((currentId) =>
      getAdjacentBambooContentId(contentIds, currentId, step),
    );
  }, [collectedContents]);

  const onSwipeStart = (event) => {
    if (!event.isPrimary || collectedContents.length < 2) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onSwipeEnd = (event) => {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    swipeStartRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const step = getHorizontalSwipeStep(start, {
      x: event.clientX,
      y: event.clientY,
    });
    if (!step) return;

    event.preventDefault();
    showAdjacentContent(step);
    try {
      navigator.vibrate?.(12);
    } catch {
      // Vibration is optional.
    }
  };

  const cancelSwipe = () => {
    swipeStartRef.current = null;
  };

  useEffect(() => {
    const rootEl = document.getElementById("ar-app");
    if (!rootEl) return undefined;

    const onObserved = (event) => {
      const result = collectBambooNotice(collectionRef.current, event.detail);
      if (!result.added) return;
      collectionRef.current = result.entries;
      saveBambooCollection(result.entries);
      setCollection(result.entries);
      const content = getBambooNoticeContent(result.entry.contentId);
      setAnnouncement(`${content.label}已收入背包`);
      window.clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = window.setTimeout(() => setAnnouncement(""), 2400);
      try {
        navigator.vibrate?.(24);
      } catch {
        // Vibration is optional.
      }
    };

    rootEl.addEventListener(AR_BAMBOO_OBSERVED_EVENT, onObserved);
    return () => rootEl.removeEventListener(AR_BAMBOO_OBSERVED_EVENT, onObserved);
  }, []);

  useEffect(() => {
    if (!activeContentId || !canvasRef.current) {
      viewerRef.current?.setVisible(false);
      return undefined;
    }

    let cancelled = false;
    setViewerState("loading");
    (async () => {
      if (!viewerRef.current) {
        const { createBambooBackpackViewer } = await import(
          "../../js/ar/bambooBackpackViewer.js"
        );
        if (cancelled || !canvasRef.current) return;
        viewerRef.current = createBambooBackpackViewer(canvasRef.current, {
          onStatusChange: ({ state }) => {
            if (!cancelled) setViewerState(state);
          },
        });
      }
      viewerRef.current.setVisible(true);
      viewerRef.current.setContent(activeContentId);
      await viewerRef.current.ready;
      if (!cancelled) setViewerState("ready");
    })().catch(() => {
      if (!cancelled) setViewerState("error");
    });

    return () => {
      cancelled = true;
      viewerRef.current?.setVisible(false);
    };
  }, [activeContentId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (activeContentId) setActiveContentId(null);
        else setIsOpen(false);
        return;
      }
      if (!activeContentId || collectedContents.length < 2) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showAdjacentContent(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showAdjacentContent(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeContentId, collectedContents.length, showAdjacentContent]);

  useLayoutEffect(() => {
    const rootEl = document.getElementById("ar-app");
    if (!rootEl) return undefined;

    rootEl.classList.toggle("is-bamboo-viewer-open", Boolean(activeContentId));
    return () => rootEl.classList.remove("is-bamboo-viewer-open");
  }, [activeContentId]);

  useEffect(() => () => {
    window.clearTimeout(announcementTimerRef.current);
    viewerRef.current?.dispose();
  }, []);

  return (
    <aside
      className={`ar-backpack${isOpen ? " is-open" : ""}${activeContent ? " has-active-viewer" : ""}`}
    >
      <button
        type="button"
        className="ar-backpack__toggle"
        aria-expanded={isOpen}
        aria-controls="ar-backpack-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <BackpackIcon />
        <span>背包</span>
        <b aria-label={`已收集 ${collection.length} 个竹简`}>
          {collection.length}/{BAMBOO_NOTICE_CONTENT_OPTIONS.length}
        </b>
      </button>

      {isOpen && (
        <section id="ar-backpack-panel" className="ar-backpack__panel" aria-label="竹简背包">
          <header>
            <div>
              <span>CHANGMEN COLLECTION</span>
              <h2>竹简背包</h2>
            </div>
            <button type="button" aria-label="收起竹简背包" onClick={() => setIsOpen(false)}>×</button>
          </header>
          {collectedContents.length > 0 ? (
            <ol className="ar-backpack__list">
              {collectedContents.map((content, index) => (
                <li key={content.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setActiveContentId(content.id);
                    }}
                  >
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <span>
                      <strong>{content.label}</strong>
                      <small>{content.description}</small>
                    </span>
                    <i aria-hidden="true">查看 3D</i>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="ar-backpack__empty">
              <BackpackIcon />
              <strong>背包还是空的</strong>
              <p>让竹简在取景框中出现一瞬间，即可自动收入。</p>
            </div>
          )}
        </section>
      )}

      <div className={`ar-backpack__toast${announcement ? " is-visible" : ""}`} role="status">
        <span>已发现</span>
        <strong>{announcement}</strong>
      </div>

      <section
        className={`ar-bamboo-viewer${activeContent ? " is-open" : ""}`}
        aria-hidden={!activeContent}
        aria-label={activeContent ? `${activeContent.label}三维竹简` : "三维竹简"}
      >
        <button
          type="button"
          className="ar-bamboo-viewer__close"
          aria-label="关闭三维竹简"
          onClick={() => setActiveContentId(null)}
        >
          ×
        </button>
        <div
          className="ar-bamboo-viewer__stage"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={cancelSwipe}
          onLostPointerCapture={cancelSwipe}
        >
          <canvas ref={canvasRef} aria-label="始终正面展示的三维竹简模型" />
          <div className={`ar-bamboo-viewer__loading is-${viewerState}`} role="status">
            {viewerState === "error" ? "模型加载失败" : "正在展开竹简…"}
          </div>
          {collectedContents.length > 1 && (
            <div className="ar-bamboo-viewer__pager" role="status" aria-live="polite">
              <span>← 左右滑动切换 →</span>
              <b>{activeContentIndex + 1}/{collectedContents.length}</b>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
