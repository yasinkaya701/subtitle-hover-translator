/**
 * @license GPLv3
 * Copyright (c) 2026 Mehmet Yasin Kaya. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * You shall not disclose, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of this software without prior written permission.
 */

const WORD_REGEX = /[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu;
const IGNORE_SELECTOR =
  "input, textarea, select, button, nav, header, footer, aside, [role='navigation'], [role='menu'], [role='menubar'], [contenteditable='true'], .sht-root";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const HOVER_WORD_DISTANCE_PX = 28;
const DRAG_WORD_DISTANCE_PX = 56;
const DRAG_SELECTION_MIN_PX = 8;
const HOVER_DELAY_MS = 140;
const HOVER_REARM_DISTANCE_PX = 6;
const TOUCH_HOLD_DELAY_MS = 320;
const TOUCH_CANCEL_MOVE_PX = 14;
const WORD_CACHE_TTL_MS = 1600;
const TRANSLATION_CACHE_MAX = 240;
const ACTIVE_CUE_CACHE_TTL_MS = 220;
const ACTIVE_CUE_MAX_LINE_WIDTH_RATIO = 0.74;
const ACTIVE_CUE_MIN_FONT_SIZE = 16;
const ACTIVE_CUE_MAX_FONT_SIZE = 30;
const FALLBACK_CANDIDATE_TTL_MS = 1800;
const CONTEXT_REFRESH_INTERVAL_MS = 4200;
const CONTEXT_REFRESH_DEBOUNCE_MS = 180;
const TOOLTIP_HIDE_DELAY_MS = 320;
const TOOLTIP_INTERACTION_GRACE_MS = 2200;
const TOOLTIP_TRANSITION_MS = 150;
const TOOLTIP_PENDING_DELAY_MS = 120;
const TOOLTIP_STATUS_RESET_MS = 1800;
const TOOLTIP_PLAYER_GUARD_PX = 22;
const LOOSE_TEXT_MAX_CHARS = 640;
const SUBTITLE_HISTORY_POLL_MS = 900;
const SCROLL_SUPPRESS_MS = 260;
const READING_EXTRA_HOVER_DELAY_MS = 140;
const MIN_STATIONARY_MS_WEB = 120;
const CONTEXT_TARGET_MARKER = "[[*]]";
const CONTEXT_TARGET_MARKER_END = "[[/]]";
const HOVER_CONTEXT_WINDOW_WORDS = 8;
const MAX_CONTEXT_PHRASE_CANDIDATES = 2;
const OCR_SNAPSHOT_TTL_MS = 1400;
const OCR_TRACK_WORD_DISTANCE_PX = 36;
const OCR_FAILURE_SUSPEND_MS = 15_000;
const RUNTIME_MESSAGE_TIMEOUT_MS = 9_000;
const extensionApi = globalThis.browser || globalThis.chrome;
const usesPromiseMessagingApi =
  typeof globalThis.browser !== "undefined" && extensionApi === globalThis.browser;
const PHRASE_CONNECTOR_WORDS = new Set([
  "about",
  "after",
  "around",
  "as",
  "at",
  "away",
  "back",
  "by",
  "down",
  "for",
  "from",
  "in",
  "into",
  "of",
  "off",
  "on",
  "onto",
  "out",
  "over",
  "through",
  "to",
  "under",
  "up",
  "with"
]);
const SITE_PROFILE_BEHAVIORS = {
  youtube: {
    hoverDelayMs: 110,
    tooltipPlacement: "right",
    tooltipSize: "compact",
    displayMode: "tooltip",
    ocrEnabled: false
  },
  netflix: {
    hoverDelayMs: 150,
    tooltipPlacement: "top",
    tooltipSize: "balanced",
    displayMode: "docked",
    ocrEnabled: true
  },
  max: {
    hoverDelayMs: 175,
    tooltipPlacement: "left",
    tooltipSize: "compact",
    displayMode: "docked",
    ocrEnabled: true
  }
};
const VIDEO_SITE_PROFILES = [
  {
    id: "youtube",
    label: "YouTube",
    hostPatterns: [/(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i],
    pathPatterns: [/^\/watch/i, /^\/shorts/i, /^\/live/i, /^\/embed\//i],
    subtitleSelectors: [
      ".ytp-caption-window-container",
      ".ytp-caption-segment",
      ".caption-window",
      ".captions-text"
    ]
  },
  {
    id: "netflix",
    label: "Netflix",
    hostPatterns: [/(^|\.)netflix\.com$/i],
    pathPatterns: [/^\/watch/i, /^\/title/i],
    subtitleSelectors: [
      ".player-timedtext",
      '[data-uia="player-subtitle-text"]',
      '[class*="timed-text"]',
      '[class*="subtitle"]'
    ]
  },
  {
    id: "prime-video",
    label: "Prime Video",
    hostPatterns: [/(^|\.)primevideo\.com$/i, /(^|\.)amazon\.[a-z.]+$/i],
    subtitleSelectors: [
      '[class*="captions"]',
      '[class*="subtitle"]',
      '.atvwebplayersdk-captions-text'
    ]
  },
  {
    id: "disney-plus",
    label: "Disney+",
    hostPatterns: [/(^|\.)disneyplus\.com$/i],
    subtitleSelectors: [
      '[class*="subtitle"]',
      '[class*="captions"]',
      '[data-testid*="subtitle"]'
    ]
  },
  {
    id: "max",
    label: "Max",
    hostPatterns: [/(^|\.)max\.com$/i, /(^|\.)hbomax\.com$/i],
    subtitleSelectors: [
      '[class*="caption"]',
      '[class*="subtitle"]',
      '[data-testid*="caption"]',
      '[data-testid*="subtitle"]',
      '[aria-live="polite"]',
      '[aria-live="assertive"]'
    ]
  },
  {
    id: "udemy",
    label: "Udemy",
    hostPatterns: [/(^|\.)udemy\.com$/i],
    subtitleSelectors: [
      '[data-purpose="captions-cue-text"]',
      '[class*="captions-display--captions-cue-text"]',
      '[class*="captions--cue"]'
    ]
  },
  {
    id: "twitch",
    label: "Twitch",
    hostPatterns: [/(^|\.)twitch\.tv$/i],
    subtitleSelectors: [
      '[data-a-target="closed-captions-text"]',
      '[class*="closed-caption"]'
    ]
  }
];

const state = {
  enabled: false,
  settings: {
    sourceLang: "auto",
    targetLang: "tr",
    displayMode: "auto",
    uiTheme: "aurora",
    subtitleHistoryLimit: 10,
    syncWordPool: false,
    siteProfiles: {}
  },
  capabilities: {
    ocrCaptureSupported: true,
    syncStorageSupported: false
  },
  pageContext: null,
  tooltip: null,
  cache: new Map(),
  pendingTranslationCache: new Map(),
  currentPayload: null,
  lastHoverKey: "",
  hoverBlockedUntil: 0,
  lastPointerSample: null,
  lastPointerMoveAt: 0,
  scrollSuppressedUntil: 0,
  lastScrollTop: 0,
  lastScrollLeft: 0,
  selectionTimer: null,
  hoverTimer: null,
  hideTimer: null,
  tooltipHideAnimationTimer: null,
  tooltipPendingTimer: null,
  tooltipStatusTimer: null,
  tooltipPointerInside: false,
  tooltipPinnedUntil: 0,
  tooltipManualPinned: false,
  currentUrl: "",
  currentRouteKey: "",
  contextRefreshTimer: null,
  contextObserver: null,
  siteSelectorCache: {
    at: 0,
    candidates: []
  },
  fallbackCandidateCache: {
    at: 0,
    candidates: []
  },
  activeCueCache: {
    at: 0,
    key: "",
    snapshot: null
  },
  containerWordCache: new WeakMap(),
  dragSelection: {
    pointerDown: false,
    moved: false,
    startPoint: null,
    startWord: null
  },
  touchSelection: {
    timer: null,
    active: false,
    moved: false,
    startPoint: null,
    startWord: null
  },
  subtitleHistory: [],
  subtitleHistorySignature: "",
  subtitleHistorySyncAt: 0,
  ocrCache: {
    at: 0,
    key: "",
    snapshot: null,
    pending: null
  },
  ocrSupport: {
    permanentlyUnavailable: false,
    suspendedUntil: 0,
    reason: ""
  },
  nextTooltipRequestId: 0,
  activeTooltipRequestId: 0
};

const UI_THEMES = new Set(["aurora", "sand", "ink"]);

init();

function normalizeUiTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return UI_THEMES.has(normalized) ? normalized : "aurora";
}

function applyTooltipTheme() {
  if (!state.tooltip) {
    return;
  }
  state.tooltip.dataset.theme = normalizeUiTheme(state.settings?.uiTheme);
}

function init() {
  setDocumentDebugState("booting");
  refreshPageContext(true);
  observeDynamicPageChanges();

  sendRuntimeMessage({ type: "GET_STATE" })
    .then((response) => {
      state.enabled = Boolean(response.state.enabled);
      state.settings = response.state.settings;
      state.capabilities = normalizeRuntimeCapabilities(response.state.capabilities);
      applyTooltipTheme();
      setDocumentDebugState("ready");
    })
    .catch(() => {
      setDocumentDebugState("runtime-error");
    });

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "STATE_UPDATED") {
      state.enabled = Boolean(message.enabled);
      if (!state.enabled) {
        hideTooltip(true);
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "SETTINGS_UPDATED") {
      state.settings = message.settings;
      if (message.capabilities) {
        state.capabilities = normalizeRuntimeCapabilities(message.capabilities);
      }
      state.cache.clear();
      state.pendingTranslationCache.clear();
      state.activeCueCache = {
        at: 0,
        key: "",
        snapshot: null
      };
      invalidateTooltipRequests();
      applyTooltipTheme();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_PAGE_CONTEXT") {
      sendResponse({
        ok: true,
        pageContext: serializePageContext()
      });
      return true;
    }

    if (message.type === "TRANSLATION_ENRICHED") {
      applyTranslationUpdate(message.translation, message.requestKey);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("keydown", handleDocumentKeyDown, true);
  document.addEventListener("selectionchange", handleSelectionChange, true);
  document.addEventListener("touchstart", handleTouchStart, {
    capture: true,
    passive: false
  });
  document.addEventListener("touchmove", handleTouchMove, {
    capture: true,
    passive: false
  });
  document.addEventListener("touchend", handleTouchEnd, {
    capture: true,
    passive: false
  });
  document.addEventListener("touchcancel", handleTouchCancel, {
    capture: true,
    passive: false
  });
  document.addEventListener("scroll", handleDocumentScroll, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hideTooltip(true);
    }
  });

  window.setInterval(() => scheduleContextRefresh(), CONTEXT_REFRESH_INTERVAL_MS);
  window.setInterval(() => {
    captureSubtitleHistoryTick().catch(() => {
      // ignore history polling errors
    });
  }, SUBTITLE_HISTORY_POLL_MS);
}

function setDocumentDebugState(status) {
  if (!document?.documentElement?.dataset) {
    return;
  }

  document.documentElement.dataset.shtExtension = "1";
  document.documentElement.dataset.shtRuntime = extensionApi === globalThis.browser ? "browser" : "chrome";
  document.documentElement.dataset.shtState = status;
}

function canHandleTextInteractions() {
  return Boolean(
    state.enabled &&
    (state.pageContext?.isVideoPage || state.pageContext?.allowGenericText)
  );
}

function normalizeRuntimeCapabilities(value) {
  return {
    ocrCaptureSupported: value?.ocrCaptureSupported !== false,
    syncStorageSupported: Boolean(value?.syncStorageSupported)
  };
}

function handleMouseMove(event) {
  if (!canHandleTextInteractions()) {
    return;
  }

  const now = Date.now();
  state.lastPointerMoveAt = now;

  if (state.pageContext?.pageMode === "web" && now < state.scrollSuppressedUntil) {
    return;
  }

  if (state.tooltipManualPinned && !state.tooltip?.contains(event.target)) {
    return;
  }

  if (shouldSuppressPlayerPointerEvent(event.clientX, event.clientY)) {
    consumePointerEvent(event);
  }

  if (state.dragSelection.pointerDown) {
    updateDragSelection(event.clientX, event.clientY);
    return;
  }

  if (Date.now() < state.hoverBlockedUntil) {
    return;
  }

  if (state.tooltip && state.tooltip.contains(event.target)) {
    return;
  }

  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    return;
  }

  if (isStablePointerSample(event)) {
    return;
  }

  state.lastPointerSample = {
    x: event.clientX,
    y: event.clientY,
    target: event.target
  };

  clearTimeout(state.hoverTimer);
  clearTimeout(state.hideTimer);

  state.hoverTimer = window.setTimeout(async () => {
    if (
      state.pageContext?.pageMode === "web" &&
      Date.now() - state.lastPointerMoveAt < MIN_STATIONARY_MS_WEB
    ) {
      return;
    }

    const hoveredWord = await getHoveredWordWithFallback(event.clientX, event.clientY);

    if (!hoveredWord) {
      state.lastHoverKey = "";
      scheduleHide();
      return;
    }

    const hoverKey = `${hoveredWord.word}|${hoveredWord.context}`;
    if (
      hoverKey === state.lastHoverKey &&
      state.currentPayload?.sourceText === hoveredWord.word
    ) {
      positionTooltip(hoveredWord.rect, {
        x: event.clientX,
        y: event.clientY
      });
      return;
    }

    state.lastHoverKey = hoverKey;
    const requestId = beginTooltipRequest();
    scheduleTooltipPending(requestId, {
      title: "Kelime",
      sourceText: hoveredWord.word,
      context: hoveredWord.context,
      rect: hoveredWord.rect,
      point: {
        x: event.clientX,
        y: event.clientY
      }
    });

    try {
      const translation = await requestTranslation(
        hoveredWord.word,
        buildHoverTranslationOptions(hoveredWord)
      );
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      if (!translation) {
        return;
      }
      showTooltip({
        title: "Kelime",
        sourceText: hoveredWord.word,
        translatedText: translation.translatedText,
        sourceLang: translation.detectedSourceLanguage,
        details: translation.details,
        requestKey: translation.requestKey,
        context: hoveredWord.context,
        rect: hoveredWord.rect,
        point: {
          x: event.clientX,
          y: event.clientY
        }
      });
      void enrichHoverTranslation(hoveredWord, translation).then((enrichedTranslation) => {
        if (!isTooltipRequestCurrent(requestId)) {
          return;
        }
        applyTranslationUpdate(enrichedTranslation);
      });
    } catch (error) {
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      showTooltipError("Kelime cevirisi alinamadi.", hoveredWord.rect, {
        x: event.clientX,
        y: event.clientY
      });
    }
  }, getHoverDelayMs());
}

function handleMouseUp(event) {
  if (state.tooltipManualPinned && !state.tooltip?.contains(event.target)) {
    resetDragSelection();
    return;
  }

  const endPoint = {
    x: event.clientX,
    y: event.clientY
  };
  const dragSelection = snapshotDragSelection();
  clearTimeout(state.hoverTimer);
  clearTimeout(state.hideTimer);

  if (
    state.enabled &&
    state.pageContext?.hasVisibleVideo &&
    dragSelection.pointerDown &&
    dragSelection.moved
  ) {
    consumePointerEvent(event, { preventDefault: true });
  }

  if (!canHandleTextInteractions()) {
    resetDragSelection();
    return;
  }

  window.setTimeout(async () => {
    const draggedSelection = getDraggedSubtitleSelection(dragSelection, endPoint);
    const nativeSelection = getNativeSubtitleSelection(window.getSelection());
    const selectionPayload = draggedSelection || nativeSelection;

    resetDragSelection();

    if (!selectionPayload) {
      return;
    }

    state.hoverBlockedUntil = Date.now() + 420;
    state.lastHoverKey = "";
    const requestId = beginTooltipRequest();
    scheduleTooltipPending(requestId, {
      title: selectionPayload.title,
      sourceText: selectionPayload.sourceText,
      context: selectionPayload.context,
      rect: selectionPayload.rect,
      point: selectionPayload.point
    });

    try {
      const translation = await requestTranslation(selectionPayload.sourceText);
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      if (!translation) {
        return;
      }
      showTooltip({
        title: selectionPayload.title,
        sourceText: selectionPayload.sourceText,
        translatedText: translation.translatedText,
        sourceLang: translation.detectedSourceLanguage,
        details: translation.details,
        requestKey: translation.requestKey,
        context: selectionPayload.context,
        rect: selectionPayload.rect,
        point: selectionPayload.point
      });
    } catch (error) {
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      showTooltipError("Secim cevirisi alinamadi.", selectionPayload.rect, selectionPayload.point);
    }
  }, 0);
}

function handleSelectionChange() {
  clearTimeout(state.selectionTimer);
  clearTimeout(state.hoverTimer);
  clearTimeout(state.hideTimer);

  if (state.tooltipManualPinned) {
    return;
  }

  if (!canHandleTextInteractions()) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return;
  }

  state.hoverBlockedUntil = Date.now() + 420;

  state.selectionTimer = window.setTimeout(async () => {
    const selectionPayload = getNativeSubtitleSelection(window.getSelection());
    if (!selectionPayload) {
      return;
    }

    const requestId = beginTooltipRequest();
    scheduleTooltipPending(requestId, {
      title: selectionPayload.title,
      sourceText: selectionPayload.sourceText,
      context: selectionPayload.context,
      rect: selectionPayload.rect,
      point: selectionPayload.point
    });

    try {
      const translation = await requestTranslation(selectionPayload.sourceText);
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      if (!translation) {
        return;
      }
      showTooltip({
        title: selectionPayload.title,
        sourceText: selectionPayload.sourceText,
        translatedText: translation.translatedText,
        sourceLang: translation.detectedSourceLanguage,
        details: translation.details,
        requestKey: translation.requestKey,
        context: selectionPayload.context,
        rect: selectionPayload.rect,
        point: selectionPayload.point
      });
    } catch (error) {
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      showTooltipError("Secim cevirisi alinamadi.", selectionPayload.rect, selectionPayload.point);
    }
  }, 130);
}

function handleDocumentMouseDown(event) {
  if (event.button !== 0) {
    return;
  }

  if (state.tooltipManualPinned && state.tooltip && !state.tooltip.contains(event.target)) {
    return;
  }

  clearTimeout(state.hoverTimer);
  clearTimeout(state.hideTimer);
  clearTimeout(state.selectionTimer);

  if (!state.tooltip) {
    resetDragSelection();
  } else if (state.tooltip.contains(event.target)) {
    return;
  }

  hideTooltip(true);
  resetDragSelection();
  state.hoverBlockedUntil = Date.now() + 220;
  state.lastHoverKey = "";
  state.lastPointerSample = null;

  if (!canHandleTextInteractions()) {
    return;
  }

  const startWord = getHoveredWord(event.clientX, event.clientY, {
    allowNearby: true,
    maxDistance: HOVER_WORD_DISTANCE_PX
  });

  if (!startWord) {
    return;
  }

  state.dragSelection.pointerDown = true;
  state.dragSelection.startPoint = {
    x: event.clientX,
    y: event.clientY
  };
  state.dragSelection.startWord = startWord;
}

function handleDocumentClick(event) {
  if (!canHandleTextInteractions()) {
    return;
  }

  if (state.tooltip?.contains(event.target)) {
    return;
  }
}

function handleDocumentKeyDown(event) {
  if (!state.tooltip || state.tooltip.hidden) {
    return;
  }

  if (isEditableTarget(event.target)) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    hideTooltip(true);
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const normalizedKey = String(event.key || "").toLowerCase();
  if (normalizedKey === "s" && state.currentPayload?.sourceText) {
    event.preventDefault();
    event.stopPropagation();
    pinTooltip();
    handleSaveUnknownWord();
    return;
  }

  if (normalizedKey === "p") {
    event.preventDefault();
    event.stopPropagation();
    toggleTooltipPinned();
    return;
  }

  if (normalizedKey === "r") {
    event.preventDefault();
    event.stopPropagation();
    playCurrentPayloadPronunciation(1);
  }
}

function updateDragSelection(clientX, clientY) {
  const startPoint = state.dragSelection.startPoint;

  if (!state.dragSelection.pointerDown || !startPoint) {
    return;
  }

  if (
    Math.abs(clientX - startPoint.x) >= DRAG_SELECTION_MIN_PX ||
    Math.abs(clientY - startPoint.y) >= DRAG_SELECTION_MIN_PX
  ) {
    state.dragSelection.moved = true;
  }
}

function snapshotDragSelection() {
  return {
    pointerDown: state.dragSelection.pointerDown,
    moved: state.dragSelection.moved,
    startPoint: state.dragSelection.startPoint
      ? { ...state.dragSelection.startPoint }
      : null,
    startWord: state.dragSelection.startWord
      ? { ...state.dragSelection.startWord }
      : null
  };
}

function resetDragSelection() {
  state.dragSelection.pointerDown = false;
  state.dragSelection.moved = false;
  state.dragSelection.startPoint = null;
  state.dragSelection.startWord = null;
}

function handleTouchStart(event) {
  if (!canHandleTextInteractions()) {
    resetTouchSelection();
    return;
  }

  if (state.tooltipManualPinned && !state.tooltip?.contains(event.target)) {
    return;
  }

  if (event.touches.length !== 1) {
    resetTouchSelection();
    return;
  }

  const touch = event.touches[0];
  if (!touch) {
    resetTouchSelection();
    return;
  }

  if (state.tooltip && state.tooltip.contains(event.target)) {
    return;
  }

  const startWord = getHoveredWord(touch.clientX, touch.clientY, {
    allowNearby: true,
    maxDistance: HOVER_WORD_DISTANCE_PX
  });
  if (!startWord) {
    resetTouchSelection();
    return;
  }

  hideTooltip(true);
  resetTouchSelection();

  state.touchSelection.startPoint = {
    x: touch.clientX,
    y: touch.clientY
  };
  state.touchSelection.startWord = startWord;
  state.touchSelection.timer = window.setTimeout(() => {
    state.touchSelection.active = true;
  }, TOUCH_HOLD_DELAY_MS);
}

function handleTouchMove(event) {
  const touch = event.touches[0];
  if (!touch || !state.touchSelection.startPoint) {
    return;
  }

  const distance = Math.hypot(
    touch.clientX - state.touchSelection.startPoint.x,
    touch.clientY - state.touchSelection.startPoint.y
  );

  if (!state.touchSelection.active) {
    if (distance > TOUCH_CANCEL_MOVE_PX) {
      resetTouchSelection();
    }
    return;
  }

  if (distance > DRAG_SELECTION_MIN_PX) {
    state.touchSelection.moved = true;
  }

  if (event.cancelable) {
    event.preventDefault();
  }
}

function handleTouchEnd(event) {
  const snapshot = snapshotTouchSelection();
  const touch = event.changedTouches[0];
  resetTouchSelection();

  if (!canHandleTextInteractions() || !snapshot.active || !touch) {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }

  const touchPoint = {
    x: touch.clientX,
    y: touch.clientY
  };

  window.setTimeout(async () => {
    if (snapshot.moved) {
      const selectionPayload = getDraggedSubtitleSelection(
        {
          pointerDown: true,
          moved: true,
          startWord: snapshot.startWord
        },
        touchPoint
      );

      if (!selectionPayload) {
        return;
      }

      const requestId = beginTooltipRequest();
      scheduleTooltipPending(requestId, {
        title: selectionPayload.title,
        sourceText: selectionPayload.sourceText,
        context: selectionPayload.context,
        rect: selectionPayload.rect,
        point: selectionPayload.point
      });

      try {
        const translation = await requestTranslation(selectionPayload.sourceText);
        clearTooltipPendingTimer();
        if (!isTooltipRequestCurrent(requestId)) {
          return;
        }
        if (!translation) {
          return;
        }
        showTooltip({
          title: selectionPayload.title,
          sourceText: selectionPayload.sourceText,
          translatedText: translation.translatedText,
          sourceLang: translation.detectedSourceLanguage,
          details: translation.details,
          requestKey: translation.requestKey,
          context: selectionPayload.context,
          rect: selectionPayload.rect,
          point: selectionPayload.point
        });
      } catch (error) {
        clearTooltipPendingTimer();
        if (!isTooltipRequestCurrent(requestId)) {
          return;
        }
        showTooltipError("Secim cevirisi alinamadi.", selectionPayload.rect, selectionPayload.point);
      }

      return;
    }

    const requestId = beginTooltipRequest();
    scheduleTooltipPending(requestId, {
      title: "Kelime",
      sourceText: snapshot.startWord.word,
      context: snapshot.startWord.context,
      rect: snapshot.startWord.rect,
      point: touchPoint
    });

    try {
      const translation = await requestTranslation(
        snapshot.startWord.word,
        buildHoverTranslationOptions(snapshot.startWord)
      );
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      if (!translation) {
        return;
      }
      showTooltip({
        title: "Kelime",
        sourceText: snapshot.startWord.word,
        translatedText: translation.translatedText,
        sourceLang: translation.detectedSourceLanguage,
        details: translation.details,
        requestKey: translation.requestKey,
        context: snapshot.startWord.context,
        rect: snapshot.startWord.rect,
        point: touchPoint
      });
      void enrichHoverTranslation(snapshot.startWord, translation).then((enrichedTranslation) => {
        if (!isTooltipRequestCurrent(requestId)) {
          return;
        }
        applyTranslationUpdate(enrichedTranslation);
      });
    } catch (error) {
      clearTooltipPendingTimer();
      if (!isTooltipRequestCurrent(requestId)) {
        return;
      }
      showTooltipError("Kelime cevirisi alinamadi.", snapshot.startWord.rect, touchPoint);
    }
  }, 0);
}

function handleTouchCancel() {
  resetTouchSelection();
}

function handleDocumentScroll(event) {
  if (state.tooltip && (event.target === state.tooltip || state.tooltip.contains(event.target))) {
    pinTooltip();
    return;
  }

  if (state.tooltipManualPinned) {
    pinTooltip();
    return;
  }

  const scrollElement = document.scrollingElement || document.documentElement;
  const scrollTop = Number(scrollElement?.scrollTop ?? window.pageYOffset ?? 0);
  const scrollLeft = Number(scrollElement?.scrollLeft ?? window.pageXOffset ?? 0);
  const delta =
    Math.abs(scrollTop - state.lastScrollTop) + Math.abs(scrollLeft - state.lastScrollLeft);

  state.lastScrollTop = scrollTop;
  state.lastScrollLeft = scrollLeft;

  if (delta <= 1) {
    return;
  }

  state.scrollSuppressedUntil = Date.now() + SCROLL_SUPPRESS_MS;
  hideTooltip(true);
}

function snapshotTouchSelection() {
  return {
    active: state.touchSelection.active,
    moved: state.touchSelection.moved,
    startPoint: state.touchSelection.startPoint
      ? { ...state.touchSelection.startPoint }
      : null,
    startWord: state.touchSelection.startWord
      ? { ...state.touchSelection.startWord }
      : null
  };
}

function resetTouchSelection() {
  clearTimeout(state.touchSelection.timer);
  state.touchSelection.timer = null;
  state.touchSelection.active = false;
  state.touchSelection.moved = false;
  state.touchSelection.startPoint = null;
  state.touchSelection.startWord = null;
}

function getHoveredWord(clientX, clientY, options = {}) {
  const containers = getSubtitleContainersNearPoint(clientX, clientY, options);

  for (const container of containers) {
    const match = getWordEntryAtPoint(container, clientX, clientY, options);
    if (!match || match.word.length < 2) {
      continue;
    }

    return {
      ...match,
      context: clipContext(getContainerTextSnapshot(container))
    };
  }

  const activeCueWord = getActiveCueWordAtPoint(clientX, clientY, options);
  if (activeCueWord) {
    return activeCueWord;
  }

  return null;
}

async function getHoveredWordWithFallback(clientX, clientY, options = {}) {
  const directMatch = getHoveredWord(clientX, clientY, options);
  if (directMatch) {
    return directMatch;
  }

  if (!canUseOcrFallback()) {
    return null;
  }

  return getOcrWordAtPoint(clientX, clientY, options);
}

async function getOcrWordAtPoint(clientX, clientY, options = {}) {
  const snapshot = await getOcrSubtitleSnapshot();
  if (!snapshot?.entries?.length || !snapshot.rect) {
    return null;
  }

  const maxDistance = options.allowNearby
    ? options.maxDistance ?? OCR_TRACK_WORD_DISTANCE_PX
    : OCR_TRACK_WORD_DISTANCE_PX;

  if (!isPointNearRect(snapshot.rect, clientX, clientY, maxDistance)) {
    return null;
  }

  let nearestEntry = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entry of snapshot.entries) {
    const distance = getDistanceToRect(entry.rect, clientX, clientY);
    if (distance === 0) {
      return {
        word: entry.word,
        rect: entry.rect,
        index: entry.index,
        context: clipContext(snapshot.text),
        virtualEntries: snapshot.entries,
        virtualCueKey: snapshot.key,
        source: "ocr"
      };
    }

    if (distance < nearestDistance) {
      nearestEntry = entry;
      nearestDistance = distance;
    }
  }

  if (!nearestEntry || nearestDistance > maxDistance) {
    return null;
  }

  return {
    word: nearestEntry.word,
    rect: nearestEntry.rect,
    index: nearestEntry.index,
    context: clipContext(snapshot.text),
    virtualEntries: snapshot.entries,
    virtualCueKey: snapshot.key,
    source: "ocr"
  };
}

async function getOcrSubtitleSnapshot() {
  if (!canUseOcrFallback()) {
    return null;
  }

  const videoRect = getPrimaryVideoRect();
  if (!videoRect) {
    return null;
  }

  const currentTime = Math.round(Number(getPrimaryVideoElement()?.currentTime || 0) * 10);
  const key = [
    location.href,
    currentTime,
    Math.round(videoRect.left),
    Math.round(videoRect.top),
    Math.round(videoRect.width),
    Math.round(videoRect.height)
  ].join("|");

  if (
    state.ocrCache.snapshot &&
    state.ocrCache.key === key &&
    Date.now() - state.ocrCache.at < OCR_SNAPSHOT_TTL_MS
  ) {
    return state.ocrCache.snapshot;
  }

  if (state.ocrCache.pending && state.ocrCache.key === key) {
    return state.ocrCache.pending;
  }

  state.ocrCache.key = key;
  state.ocrCache.pending = captureOcrSubtitleSnapshot(videoRect, key)
    .then((snapshot) => {
      state.ocrCache.at = Date.now();
      state.ocrCache.snapshot = snapshot;
      return snapshot;
    })
    .catch((error) => {
      handleOcrSnapshotFailure(error);
      return null;
    })
    .finally(() => {
      state.ocrCache.pending = null;
    });

  return state.ocrCache.pending;
}

async function captureOcrSubtitleSnapshot(videoRect, key) {
  const imageDataUrl = await sendRuntimeMessage({
    type: "CAPTURE_VISIBLE_TAB"
  }).then((response) => response.imageDataUrl);

  if (!imageDataUrl) {
    return null;
  }

  const image = await loadImageFromDataUrl(imageDataUrl);
  const scale = Math.max(window.devicePixelRatio || 1, 1);
  const cropRect = {
    left: Math.max(0, Math.round((videoRect.left + videoRect.width * 0.08) * scale)),
    top: Math.max(0, Math.round((videoRect.top + videoRect.height * 0.56) * scale)),
    width: Math.max(80, Math.round(videoRect.width * 0.84 * scale)),
    height: Math.max(42, Math.round(videoRect.height * 0.28 * scale))
  };

  const canvas = document.createElement("canvas");
  canvas.width = cropRect.width;
  canvas.height = cropRect.height;
  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!context) {
    return null;
  }

  context.drawImage(
    image,
    cropRect.left,
    cropRect.top,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  const detector = new globalThis.TextDetector();
  const blocks = await detector.detect(canvas);
  if (!Array.isArray(blocks) || !blocks.length) {
    return null;
  }

  const entries = [];
  const contextLines = [];

  for (const block of blocks) {
    const rawValue = normalizeWhitespace(block?.rawValue || "");
    const box = block?.boundingBox;
    if (!rawValue || !box?.width || !box?.height) {
      continue;
    }

    contextLines.push(rawValue);
    const words = rawValue.match(WORD_REGEX) || [];
    if (!words.length) {
      continue;
    }

    const totalChars = words.reduce((sum, word) => sum + word.length, 0);
    let currentLeft = box.x;

    words.forEach((word) => {
      const ratio = totalChars ? word.length / totalChars : 1 / words.length;
      const width = Math.max((box.width * ratio), 14);
      const rect = {
        left: cropRect.left / scale + currentLeft / scale,
        top: cropRect.top / scale + box.y / scale,
        right: cropRect.left / scale + (currentLeft + width) / scale,
        bottom: cropRect.top / scale + (box.y + box.height) / scale,
        width: width / scale,
        height: box.height / scale
      };

      entries.push({
        index: entries.length,
        word,
        rect
      });
      currentLeft += width;
    });
  }

  if (!entries.length) {
    return null;
  }

  return {
    key,
    text: clipContext(contextLines.join(" ")),
    entries,
    rect: mergeRects(entries.map((entry) => entry.rect))
  };
}

function canUseOcrFallback() {
  if (!state.pageContext?.hasVisibleVideo || !getActiveSiteBehavior().ocrEnabled) {
    return false;
  }

  if (
    typeof globalThis.TextDetector === "undefined" ||
    typeof globalThis.createImageBitmap !== "function"
  ) {
    return false;
  }

  if (state.capabilities?.ocrCaptureSupported === false) {
    return false;
  }

  if (state.ocrSupport.permanentlyUnavailable) {
    return false;
  }

  if (Date.now() < state.ocrSupport.suspendedUntil) {
    return false;
  }

  return true;
}

function handleOcrSnapshotFailure(error) {
  const message = String(error?.message || error || "").toLocaleLowerCase("tr");
  if (
    /capturevisibletab|desteklenmiyor|not supported|permission|izin|denied|yetki/.test(message)
  ) {
    state.ocrSupport.permanentlyUnavailable = true;
    state.ocrSupport.reason = message;
    return;
  }

  state.ocrSupport.suspendedUntil = Date.now() + OCR_FAILURE_SUSPEND_MS;
  state.ocrSupport.reason = message;
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("OCR image could not be decoded"));
    image.src = dataUrl;
  });
}

function getActiveCueWordAtPoint(clientX, clientY, options = {}) {
  const snapshot = getActiveCueSnapshot();
  if (!snapshot?.entries?.length || !snapshot.rect) {
    return null;
  }

  const maxDistance = options.allowNearby
    ? options.maxDistance ?? HOVER_WORD_DISTANCE_PX
    : 0;

  if (!isPointNearRect(snapshot.rect, clientX, clientY, maxDistance)) {
    return null;
  }

  let nearestEntry = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entry of snapshot.entries) {
    const distance = getDistanceToRect(entry.rect, clientX, clientY);
    if (distance === 0) {
      return {
        word: entry.word,
        rect: entry.rect,
        index: entry.index,
        context: clipContext(snapshot.text),
        virtualEntries: snapshot.entries,
        virtualCueKey: snapshot.key
      };
    }

    if (distance < nearestDistance) {
      nearestEntry = entry;
      nearestDistance = distance;
    }
  }

  if (!nearestEntry || nearestDistance > maxDistance) {
    return null;
  }

  return {
    word: nearestEntry.word,
    rect: nearestEntry.rect,
    index: nearestEntry.index,
    context: clipContext(snapshot.text),
    virtualEntries: snapshot.entries,
    virtualCueKey: snapshot.key
  };
}

function getSubtitleContainersNearPoint(clientX, clientY, options = {}) {
  const containers = [];
  const seen = new Set();

  const addContainer = (container) => {
    if (!container || seen.has(container)) {
      return;
    }

    seen.add(container);
    containers.push(container);
  };

  if (options.preferredContainer) {
    addContainer(options.preferredContainer);
  }

  const elementsAtPoint = getElementsAtPointDeep(clientX, clientY);

  for (const element of elementsAtPoint) {
    addContainer(findInteractiveTextContainer(element));
  }

  if (state.pageContext?.allowGenericText) {
    for (const element of elementsAtPoint) {
      addContainer(findLooseReadableTextContainer(element));
    }
  }

  const canSearchVideo =
    Boolean(state.pageContext?.hasVisibleVideo || state.pageContext?.supportedHost);
  if (canSearchVideo) {
    const pointDistance = options.allowNearby ? options.maxDistance ?? HOVER_WORD_DISTANCE_PX : 0;
    for (const container of getProfileSubtitleCandidates()) {
      if (isPointNearRect(container.getBoundingClientRect(), clientX, clientY, pointDistance)) {
        addContainer(container);
      }
    }

    for (const container of getFallbackSubtitleCandidates()) {
      if (isPointNearRect(container.getBoundingClientRect(), clientX, clientY, pointDistance)) {
        addContainer(container);
      }
    }
  }

  return containers;
}

function shouldSuppressPlayerPointerEvent(clientX, clientY) {
  if (!state.pageContext?.hasVisibleVideo) {
    return false;
  }

  const videoRect = getPrimaryVideoRect();
  if (!videoRect || !isPointNearRect(videoRect, clientX, clientY, 0)) {
    return false;
  }

  if (
    state.tooltip &&
    !state.tooltip.hidden &&
    state.tooltip.dataset.surface === "video" &&
    isPointNearRect(state.tooltip.getBoundingClientRect(), clientX, clientY, 8)
  ) {
    return true;
  }

  if (
    state.currentPayload?.rect &&
    isNearPrimaryVideo(state.currentPayload.rect) &&
    isPointNearRect(state.currentPayload.rect, clientX, clientY, TOOLTIP_PLAYER_GUARD_PX)
  ) {
    return true;
  }

  if (
    state.dragSelection.pointerDown &&
    (
      (
        state.dragSelection.startWord?.container &&
        isPointNearRect(
          state.dragSelection.startWord.container.getBoundingClientRect(),
          clientX,
          clientY,
          TOOLTIP_PLAYER_GUARD_PX
        )
      ) ||
      (
        state.dragSelection.startWord?.virtualEntries?.length &&
        (() => {
          const virtualRect = getVirtualEntriesRect(state.dragSelection.startWord.virtualEntries);
          return Boolean(
            virtualRect &&
            isPointNearRect(virtualRect, clientX, clientY, TOOLTIP_PLAYER_GUARD_PX)
          );
        })()
      )
    )
  ) {
    return true;
  }

  const activeCueSnapshot = getActiveCueSnapshot();
  if (
    activeCueSnapshot?.rect &&
    isPointNearRect(activeCueSnapshot.rect, clientX, clientY, TOOLTIP_PLAYER_GUARD_PX)
  ) {
    return true;
  }

  const overlayContainer = getVideoOverlayContainerAtPoint(
    clientX,
    clientY,
    TOOLTIP_PLAYER_GUARD_PX
  );
  if (!overlayContainer) {
    return false;
  }

  return isNearPrimaryVideo(overlayContainer.getBoundingClientRect());
}

function getVideoOverlayContainerAtPoint(clientX, clientY, tolerance = 0) {
  const containers = [];
  const seen = new Set();
  const addContainer = (container) => {
    if (!container || seen.has(container)) {
      return;
    }

    seen.add(container);
    containers.push(container);
  };
  const elementsAtPoint = getElementsAtPointDeep(clientX, clientY);

  for (const element of elementsAtPoint) {
    addContainer(findSubtitleContainer(element));
  }

  for (const container of getProfileSubtitleCandidates()) {
    if (isPointNearRect(container.getBoundingClientRect(), clientX, clientY, tolerance)) {
      addContainer(container);
    }
  }

  for (const container of getFallbackSubtitleCandidates()) {
    if (isPointNearRect(container.getBoundingClientRect(), clientX, clientY, tolerance)) {
      addContainer(container);
    }
  }

  return containers.find((container) =>
    isPointNearRect(container.getBoundingClientRect(), clientX, clientY, tolerance)
  ) || null;
}

function consumePointerEvent(event, options = {}) {
  if (options.preventDefault && event.cancelable) {
    event.preventDefault();
  }

  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }

  event.stopPropagation();
}

function getWordEntryAtPoint(container, clientX, clientY, options = {}) {
  const entries = getRenderedWordEntries(container);
  if (!entries.length) {
    return null;
  }

  let nearestEntry = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const distance = getDistanceToWordEntry(entry, clientX, clientY);

    if (distance === 0) {
      return {
        container,
        word: entry.word,
        rect: entry.rect,
        index: entry.index,
        node: entry.node,
        startOffset: entry.startOffset,
        endOffset: entry.endOffset
      };
    }

    if (distance < nearestDistance) {
      nearestEntry = entry;
      nearestDistance = distance;
    }
  }

  const maxDistance = options.allowNearby
    ? options.maxDistance ?? HOVER_WORD_DISTANCE_PX
    : 0;

  if (!nearestEntry || nearestDistance > maxDistance) {
    return null;
  }

  return {
    container,
    word: nearestEntry.word,
    rect: nearestEntry.rect,
    index: nearestEntry.index,
    node: nearestEntry.node,
    startOffset: nearestEntry.startOffset,
    endOffset: nearestEntry.endOffset
  };
}

function getRenderedWordEntries(container) {
  const text = normalizeWhitespace(container.textContent || "");
  if (!text) {
    return [];
  }

  const rect = container.getBoundingClientRect();
  const signature = [
    text,
    Math.round(rect.left),
    Math.round(rect.top),
    Math.round(rect.width),
    Math.round(rect.height)
  ].join("|");

  const cached = state.containerWordCache.get(container);
  if (cached && cached.signature === signature && Date.now() - cached.at < WORD_CACHE_TTL_MS) {
    return cached.entries;
  }

  const entries = [];
  const textWalker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const value = node.textContent || "";
        if (!value) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!/\S/.test(value)) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent || parent.closest(IGNORE_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }

        const style = window.getComputedStyle(parent);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity || "1") < 0.2
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let textNode = textWalker.nextNode();
  while (textNode) {
    const nodeText = textNode.textContent || "";
    const matcher = new RegExp(WORD_REGEX.source, WORD_REGEX.flags);

    for (const match of nodeText.matchAll(matcher)) {
      const startOffset = match.index ?? 0;
      const endOffset = startOffset + match[0].length;
      const range = document.createRange();

      range.setStart(textNode, startOffset);
      range.setEnd(textNode, endOffset);

      const rects = Array.from(range.getClientRects())
        .map(cloneRect)
        .filter((clientRect) => clientRect.width > 1 && clientRect.height > 1);
      const mergedRect = mergeRects(rects.length ? rects : [cloneRect(range.getBoundingClientRect())]);

      if (!mergedRect || mergedRect.width <= 1 || mergedRect.height <= 1) {
        continue;
      }

      entries.push({
        index: entries.length,
        word: match[0],
        node: textNode,
        startOffset,
        endOffset,
        rects: rects.length ? rects : [mergedRect],
        rect: mergedRect
      });
    }

    textNode = textWalker.nextNode();
  }

  state.containerWordCache.set(container, {
    at: Date.now(),
    signature,
    entries,
    text
  });

  return entries;
}

function getContainerTextSnapshot(container) {
  const cached = state.containerWordCache.get(container);
  if (cached?.text) {
    return cached.text;
  }

  return normalizeWhitespace(container.textContent || "");
}

function isStablePointerSample(event) {
  const previous = state.lastPointerSample;
  if (!previous || previous.target !== event.target) {
    return false;
  }

  return (
    Math.abs(event.clientX - previous.x) < HOVER_REARM_DISTANCE_PX &&
    Math.abs(event.clientY - previous.y) < HOVER_REARM_DISTANCE_PX
  );
}

function getDistanceToWordEntry(entry, clientX, clientY) {
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const rect of entry.rects) {
    const distance = getDistanceToRect(rect, clientX, clientY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  }

  return nearestDistance;
}

function getDistanceToRect(rect, clientX, clientY) {
  const dx =
    clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
  const dy =
    clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;

  return Math.hypot(dx, dy);
}

function isPointNearRect(rect, clientX, clientY, tolerance = 0) {
  return (
    clientX >= rect.left - tolerance &&
    clientX <= rect.right + tolerance &&
    clientY >= rect.top - tolerance &&
    clientY <= rect.bottom + tolerance
  );
}

function cloneRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
}

function mergeRects(rects) {
  const validRects = rects.filter(
    (rect) => rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)
  );

  if (!validRects.length) {
    return null;
  }

  const left = Math.min(...validRects.map((rect) => rect.left));
  const top = Math.min(...validRects.map((rect) => rect.top));
  const right = Math.max(...validRects.map((rect) => rect.right));
  const bottom = Math.max(...validRects.map((rect) => rect.bottom));

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

function getVirtualEntriesRect(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }

  return mergeRects(entries.map((entry) => entry.rect).filter(Boolean));
}

function getRangeRect(range) {
  const rects = Array.from(range.getClientRects())
    .map(cloneRect)
    .filter((clientRect) => clientRect.width > 1 && clientRect.height > 1);

  return mergeRects(rects.length ? rects : [cloneRect(range.getBoundingClientRect())]);
}

function getNativeSubtitleSelection(selection) {
  if (!selection || selection.isCollapsed) {
    return null;
  }

  const selectedText = normalizeWhitespace(selection.toString());
  if (!selectedText || selectedText.length > 320) {
    return null;
  }

  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  const rect = range ? getRangeRect(range) : null;
  const anchorNode = range?.commonAncestorContainer || selection.anchorNode;
  const anchorElement = anchorNode
    ? anchorNode.nodeType === Node.TEXT_NODE
      ? getParentElementCrossRoot(anchorNode)
      : anchorNode
    : null;

  if (!range || !rect || !anchorElement) {
    return null;
  }

  if (
    anchorElement.matches?.(IGNORE_SELECTOR) ||
    anchorElement.closest?.(IGNORE_SELECTOR)
  ) {
    return null;
  }

  const container = getSelectionContainer(selection) || findSelectionContextContainer(anchorElement);
  const contextText = normalizeWhitespace(
    container?.innerText || container?.textContent || selectedText
  );
  const normalizedSelectionText = expandToWholeWordSelection(selectedText, contextText);

  return {
    title: "Secim",
    sourceText: normalizedSelectionText,
    context: contextText,
    rect,
    point: {
      x: rect.left + rect.width / 2,
      y: rect.top
    }
  };
}

function getDraggedSubtitleSelection(dragSelection, endPoint) {
  if (
    !dragSelection.pointerDown ||
    (!dragSelection.startWord?.container && !dragSelection.startWord?.virtualEntries)
  ) {
    return null;
  }

  const endWord = getHoveredWord(endPoint.x, endPoint.y, {
    allowNearby: true,
    maxDistance: DRAG_WORD_DISTANCE_PX,
    preferredContainer: dragSelection.startWord.container
  });
  if (!endWord) {
    return null;
  }

  if (
    dragSelection.startWord.virtualEntries &&
    endWord.virtualEntries &&
    dragSelection.startWord.virtualCueKey &&
    dragSelection.startWord.virtualCueKey === endWord.virtualCueKey
  ) {
    const entries = dragSelection.startWord.virtualEntries;
    const startEntry = entries[dragSelection.startWord.index];
    const endEntry = entries[endWord.index];

    if (!startEntry || !endEntry) {
      return null;
    }

    const fromIndex = Math.min(startEntry.index, endEntry.index);
    const toIndex = Math.max(startEntry.index, endEntry.index);
    if (!dragSelection.moved && fromIndex === toIndex) {
      return null;
    }

    const selectedEntries = entries.slice(fromIndex, toIndex + 1);
    const sourceText = normalizeWhitespace(selectedEntries.map((entry) => entry.word).join(" "));
    const rect = mergeRects(selectedEntries.map((entry) => entry.rect));

    if (!sourceText || sourceText.length > 320 || !rect) {
      return null;
    }

    return {
      title: "Secim",
      sourceText,
      context: normalizeWhitespace(selectedEntries.map((entry) => entry.word).join(" ")),
      rect,
      point: {
        x: rect.left + rect.width / 2,
        y: rect.top
      }
    };
  }

  const sharedContainer = resolveDraggedSelectionContainer(
    dragSelection.startWord.container,
    endWord.container
  );
  if (!sharedContainer) {
    return null;
  }

  const entries = getRenderedWordEntries(sharedContainer);
  const startEntry = resolveWordEntry(entries, dragSelection.startWord);
  const endEntry = resolveWordEntry(entries, endWord);

  if (!startEntry || !endEntry) {
    return null;
  }

  const fromIndex = Math.min(startEntry.index, endEntry.index);
  const toIndex = Math.max(startEntry.index, endEntry.index);
  if (!dragSelection.moved && fromIndex === toIndex) {
    return null;
  }

  const selectedEntries = entries.slice(fromIndex, toIndex + 1);
  const sourceText = normalizeWhitespace(selectedEntries.map((entry) => entry.word).join(" "));
  const rect = mergeRects(selectedEntries.map((entry) => entry.rect));

  if (!sourceText || sourceText.length > 320 || !rect) {
    return null;
  }

  return {
    title: "Secim",
    sourceText,
    context: normalizeWhitespace(
      sharedContainer.innerText || sharedContainer.textContent || ""
    ),
    rect,
    point: {
      x: rect.left + rect.width / 2,
      y: rect.top
    }
  };
}

function resolveWordEntry(entries, reference) {
  if (Number.isInteger(reference.index)) {
    const indexedEntry = entries[reference.index];
    if (
      indexedEntry &&
      indexedEntry.word === reference.word &&
      indexedEntry.startOffset === reference.startOffset
    ) {
      return indexedEntry;
    }
  }

  const directMatch = entries.find(
    (entry) =>
      entry.node === reference.node &&
      entry.startOffset === reference.startOffset &&
      entry.endOffset === reference.endOffset
  );
  if (directMatch) {
    return directMatch;
  }

  let nearestEntry = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const targetX = reference.rect ? reference.rect.left + reference.rect.width / 2 : 0;
  const targetY = reference.rect ? reference.rect.top + reference.rect.height / 2 : 0;

  for (const entry of entries) {
    if (entry.word !== reference.word) {
      continue;
    }

    const distance = getDistanceToRect(entry.rect, targetX, targetY);
    if (distance < nearestDistance) {
      nearestEntry = entry;
      nearestDistance = distance;
    }
  }

  return nearestEntry;
}

function resolveDraggedSelectionContainer(startContainer, endContainer) {
  if (!startContainer || !endContainer) {
    return null;
  }

  if (startContainer === endContainer) {
    return startContainer;
  }

  if (isComposedAncestor(startContainer, endContainer)) {
    return startContainer;
  }

  if (isComposedAncestor(endContainer, startContainer)) {
    return endContainer;
  }

  let element = getParentElementCrossRoot(startContainer);
  while (element) {
    if (isComposedAncestor(element, endContainer)) {
      return element;
    }

    if (element === document.body || element === document.documentElement) {
      break;
    }

    element = getParentElementCrossRoot(element);
  }

  return findSelectionContextContainer(startContainer) || findSelectionContextContainer(endContainer);
}

function findSubtitleContainer(startElement) {
  const profileContainer = findProfileSubtitleContainer(startElement);
  if (profileContainer) {
    return profileContainer;
  }

  if (!state.pageContext?.isVideoPage) {
    return null;
  }

  let element = startElement;

  while (element) {
    const rect = element.getBoundingClientRect();

    if (isLikelySubtitleContainer(element, rect)) {
      return element;
    }

    if (element === document.body || element === document.documentElement) {
      break;
    }

    element = getParentElementCrossRoot(element);
  }

  return null;
}

function findInteractiveTextContainer(startElement) {
  return findSubtitleContainer(startElement) || findReadableTextContainer(startElement);
}

function findReadableTextContainer(startElement) {
  if (!state.pageContext?.allowGenericText) {
    return null;
  }

  let element = startElement;
  let fallbackCandidate = null;
  let looseCandidate = null;

  while (element) {
    const rect = element.getBoundingClientRect();
    const text = normalizeWhitespace(element.innerText || element.textContent || "");

    if (isLikelyReadableTextContainer(element, rect)) {
      if (countWords(text) >= 2) {
        return element;
      }

      fallbackCandidate = fallbackCandidate || element;
    } else if (isLooseReadableTextContainer(element, rect, text)) {
      if (countWords(text) >= 1) {
        return element;
      }

      looseCandidate = looseCandidate || element;
    }

    if (element === document.body || element === document.documentElement) {
      break;
    }

    element = getParentElementCrossRoot(element);
  }

  return fallbackCandidate || looseCandidate;
}

function findLooseReadableTextContainer(startElement) {
  let element = startElement;

  while (element) {
    const rect = element.getBoundingClientRect();
    const text = normalizeWhitespace(element.innerText || element.textContent || "");

    if (isLooseReadableTextContainer(element, rect, text)) {
      return element;
    }

    if (element === document.body || element === document.documentElement) {
      break;
    }

    element = getParentElementCrossRoot(element);
  }

  return null;
}

function isLikelySubtitleContainer(element, rect = element.getBoundingClientRect()) {
  if (!element || element.matches(IGNORE_SELECTOR) || element.closest(IGNORE_SELECTOR)) {
    return false;
  }

  if (matchesProfileSelector(element)) {
    return isVisibleCandidate(element, rect);
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity || "1") < 0.2
  ) {
    return false;
  }

  if (rect.width < 40 || rect.height < 12) {
    return false;
  }

  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    return false;
  }

  const text = normalizeWhitespace(element.innerText || element.textContent || "");
  if (!text || text.length > 220) {
    return false;
  }

  const lines = (element.innerText || text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 3) {
    return false;
  }

  const meta = [
    element.id,
    element.className,
    element.getAttribute("aria-label"),
    element.getAttribute("data-testid"),
    element.getAttribute("data-purpose")
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr");

  let score = 0;

  if (/(subtitle|subtitles|caption|captions|transcript|cc|cue|track|lyrics)/.test(meta)) {
    score += 3;
  }

  if (rect.bottom > window.innerHeight * 0.55) {
    score += 1;
  }

  if (rect.top > window.innerHeight * 0.3) {
    score += 1;
  }

  if (isNearPrimaryVideo(rect)) {
    score += 2;
  }

  if (["fixed", "absolute", "sticky"].includes(style.position)) {
    score += 1;
  }

  const centerX = rect.left + rect.width / 2;
  if (centerX > window.innerWidth * 0.15 && centerX < window.innerWidth * 0.85) {
    score += 1;
  }

  const fontSize = Number.parseFloat(style.fontSize || "0");
  if (fontSize >= 14) {
    score += 1;
  }

  if (text.length <= 140) {
    score += 1;
  }

  if (state.pageContext?.hasVisibleVideo) {
    score += 1;
  }

  return score >= 3;
}

function isLikelyReadableTextContainer(element, rect = element.getBoundingClientRect()) {
  if (
    !element ||
    element.matches(IGNORE_SELECTOR) ||
    element.closest(IGNORE_SELECTOR) ||
    isLikelyChromeUiElement(element)
  ) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity || "1") < 0.2
  ) {
    return false;
  }

  if (rect.width < 24 || rect.height < 12) {
    return false;
  }

  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    return false;
  }

  const text = normalizeWhitespace(element.innerText || element.textContent || "");
  if (!text || text.length > 720) {
    return false;
  }

  const lines = (element.innerText || text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 10) {
    return false;
  }

  let score = 0;
  const tagName = element.tagName;
  if (["P", "SPAN", "LI", "BLOCKQUOTE", "FIGCAPTION", "TD", "H1", "H2", "H3", "H4"].includes(tagName)) {
    score += 2;
  } else if (tagName === "DIV") {
    score += 1;
  }

  if (text.length <= 220) {
    score += 1;
  }

  if (countWords(text) >= 2) {
    score += 1;
  }

  if (lines.length <= 3) {
    score += 1;
  }

  const fontSize = Number.parseFloat(style.fontSize || "0");
  if (fontSize >= 12) {
    score += 1;
  }

  if (rect.width < window.innerWidth * 0.95) {
    score += 1;
  }

  return score >= 4;
}

function isLooseReadableTextContainer(
  element,
  rect = element.getBoundingClientRect(),
  text = normalizeWhitespace(element.innerText || element.textContent || "")
) {
  if (
    !element ||
    element.matches(IGNORE_SELECTOR) ||
    element.closest(IGNORE_SELECTOR) ||
    isLikelyChromeUiElement(element)
  ) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity || "1") < 0.2
  ) {
    return false;
  }

  if (
    rect.width < 12 ||
    rect.height < 10 ||
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.width > window.innerWidth * 0.98 ||
    rect.height > window.innerHeight * 0.6
  ) {
    return false;
  }

  if (!text || text.length > LOOSE_TEXT_MAX_CHARS) {
    return false;
  }

  const wordCount = countWords(text);
  if (!wordCount || wordCount > 80) {
    return false;
  }

  return ["A", "SPAN", "P", "LI", "DIV", "TD", "H1", "H2", "H3", "H4", "LABEL"].includes(
    element.tagName
  );
}

function countWords(text) {
  const matches = String(text || "").match(WORD_REGEX);
  return matches ? matches.length : 0;
}

function getActiveSiteBehavior() {
  const siteId = state.pageContext?.siteProfile?.id || "";
  const builtIn = SITE_PROFILE_BEHAVIORS[siteId] || {};
  const saved = state.settings?.siteProfiles?.[siteId] || {};
  return {
    hoverDelayMs: clampNumber(saved.hoverDelayMs ?? builtIn.hoverDelayMs ?? HOVER_DELAY_MS, 60, 400),
    tooltipPlacement: ["auto", "right", "left", "top", "bottom"].includes(saved.tooltipPlacement || builtIn.tooltipPlacement)
      ? saved.tooltipPlacement || builtIn.tooltipPlacement
      : "auto",
    tooltipSize: ["compact", "balanced", "wide"].includes(saved.tooltipSize || builtIn.tooltipSize)
      ? saved.tooltipSize || builtIn.tooltipSize
      : "balanced",
    displayMode: ["auto", "tooltip", "docked"].includes(saved.displayMode || builtIn.displayMode)
      ? saved.displayMode || builtIn.displayMode
      : "auto",
    ocrEnabled:
      typeof saved.ocrEnabled === "boolean"
        ? saved.ocrEnabled
        : Boolean(builtIn.ocrEnabled)
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(Math.max(number, min), max);
}

function getHoverDelayMs() {
  const base = getActiveSiteBehavior().hoverDelayMs;
  if (state.pageContext?.pageMode === "web") {
    return clampNumber(base + READING_EXTRA_HOVER_DELAY_MS, 180, 420);
  }
  return base;
}

function getTooltipPreferredWidth(kind) {
  const size = getActiveSiteBehavior().tooltipSize;
  const widthMap = {
    compact: kind === "Secim" ? 340 : 292,
    balanced: kind === "Secim" ? 360 : 308,
    wide: kind === "Secim" ? 404 : 344
  };

  return widthMap[size] || widthMap.balanced;
}

function getTooltipPlacementPreference() {
  return getActiveSiteBehavior().tooltipPlacement;
}

function getEffectiveDisplayMode() {
  const globalMode = state.settings?.displayMode || "auto";
  if (globalMode === "tooltip" || globalMode === "docked") {
    return globalMode;
  }

  const siteMode = getActiveSiteBehavior().displayMode || "auto";
  if (siteMode === "tooltip" || siteMode === "docked") {
    return siteMode;
  }

  return state.pageContext?.pageMode === "video" ? "docked" : "tooltip";
}

function playCurrentPayloadPronunciation(rate = 1) {
  if (!state.currentPayload?.sourceText || !globalThis.speechSynthesis) {
    return;
  }

  const pronunciation = state.currentPayload?.details?.pronunciation || {};
  const utterance = new SpeechSynthesisUtterance(state.currentPayload.sourceText);
  utterance.lang = pronunciation.lang || resolveSpeechLanguage(state.currentPayload.sourceLang);
  utterance.rate = rate;
  utterance.pitch = 1;

  globalThis.speechSynthesis.cancel();
  globalThis.speechSynthesis.speak(utterance);
  pinTooltip(8_000);
}

function resolveSpeechLanguage(sourceLang) {
  const normalized = String(sourceLang || "").toLowerCase();
  if (normalized.startsWith("tr")) {
    return "tr-TR";
  }
  if (normalized.startsWith("de")) {
    return "de-DE";
  }
  if (normalized.startsWith("fr")) {
    return "fr-FR";
  }
  if (normalized.startsWith("es")) {
    return "es-ES";
  }
  return "en-US";
}

function isEditableTarget(target) {
  const element = target instanceof Element ? target : getParentElementCrossRoot(target);
  if (!element) {
    return false;
  }

  return Boolean(
    element.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox']"
    )
  );
}

function isLikelyChromeUiElement(element) {
  let current = element;

  while (current) {
    if (
      current.matches?.(
        "nav, header, footer, aside, [role='navigation'], [role='menu'], [role='menubar']"
      )
    ) {
      return true;
    }

    const meta = `${current.id || ""} ${String(current.className || "")}`
      .toLocaleLowerCase("tr")
      .trim();

    if (/(^|[\s_-])(nav|menu|toolbar|sidebar|breadcrumb|toc|portlet|tab|tabs)([\s_-]|$)/.test(meta)) {
      return true;
    }

    if (current === document.body || current === document.documentElement) {
      break;
    }

    current = getParentElementCrossRoot(current);
  }

  return false;
}

function getParentNodeCrossRoot(node) {
  if (!node) {
    return null;
  }

  const parentNode = node.parentNode;
  if (parentNode instanceof ShadowRoot) {
    return parentNode.host;
  }

  return parentNode || null;
}

function getParentElementCrossRoot(node) {
  let parent = getParentNodeCrossRoot(node);

  while (parent && !(parent instanceof Element)) {
    parent = getParentNodeCrossRoot(parent);
  }

  return parent || null;
}

function isComposedAncestor(container, target) {
  let current = target;

  while (current) {
    if (current === container) {
      return true;
    }

    current = getParentNodeCrossRoot(current);
  }

  return false;
}

function getDeepSearchRoots(startRoot = document) {
  const roots = [];
  const queue = [startRoot];
  const seen = new Set();

  while (queue.length) {
    const root = queue.shift();
    if (!root || seen.has(root)) {
      continue;
    }

    seen.add(root);
    roots.push(root);

    const scope =
      root instanceof Document
        ? root.documentElement || root.body
        : root;

    if (!(scope instanceof Node)) {
      continue;
    }

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
    let element = walker.currentNode;

    while (element) {
      if (element instanceof Element && element.shadowRoot) {
        queue.push(element.shadowRoot);
      }

      element = walker.nextNode();
    }
  }

  return roots;
}

function querySelectorAllDeep(selector, startRoot = document) {
  const elements = [];
  const seen = new Set();

  for (const root of getDeepSearchRoots(startRoot)) {
    if (!(root instanceof Document || root instanceof Element || root instanceof ShadowRoot)) {
      continue;
    }

    let matches = [];
    try {
      matches = Array.from(root.querySelectorAll(selector));
    } catch (error) {
      continue;
    }

    for (const element of matches) {
      if (!seen.has(element)) {
        seen.add(element);
        elements.push(element);
      }
    }
  }

  return elements;
}

function getElementsAtPointDeep(clientX, clientY, root = document) {
  const elements = [];
  const seen = new Set();
  const seenRoots = new Set();

  const collect = (currentRoot) => {
    if (!currentRoot || seenRoots.has(currentRoot)) {
      return;
    }

    seenRoots.add(currentRoot);

    const rootElements =
      typeof currentRoot.elementsFromPoint === "function"
        ? currentRoot.elementsFromPoint(clientX, clientY)
        : typeof currentRoot.elementFromPoint === "function"
          ? [currentRoot.elementFromPoint(clientX, clientY)].filter(Boolean)
          : [];

    for (const element of rootElements) {
      if (element.shadowRoot) {
        collect(element.shadowRoot);
      }

      if (!seen.has(element)) {
        seen.add(element);
        elements.push(element);
      }
    }
  };

  collect(root);

  return elements;
}

function isNearPrimaryVideo(textRect) {
  const videoRect = getPrimaryVideoRect();

  if (!videoRect) {
    return false;
  }

  const horizontalOverlap =
    Math.min(textRect.right, videoRect.right) - Math.max(textRect.left, videoRect.left);
  const overlapRatio = horizontalOverlap / Math.min(textRect.width, videoRect.width);
  const lowerHalfThreshold = videoRect.top + videoRect.height * 0.35;

  return (
    overlapRatio > 0.45 &&
    textRect.top >= lowerHalfThreshold &&
    textRect.bottom <= videoRect.bottom + 80
  );
}

function getPrimaryVideoElement() {
  const videos = querySelectorAllDeep("video");
  const visibleVideos = videos
    .map((video) => ({
      video,
      rect: video.getBoundingClientRect()
    }))
    .filter(
      ({ rect }) =>
        rect.width > 200 &&
        rect.height > 120 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight
    )
    .sort((left, right) => right.rect.width * right.rect.height - left.rect.width * left.rect.height);

  return visibleVideos[0]?.video || null;
}

function getPrimaryVideoRect() {
  return getPrimaryVideoElement()?.getBoundingClientRect() || null;
}

function getActiveCueSnapshot() {
  const video = getPrimaryVideoElement();
  if (!video) {
    return null;
  }

  const videoRect = video.getBoundingClientRect();
  const cueText = getVideoActiveCueText(video);
  if (!cueText) {
    state.activeCueCache = {
      at: Date.now(),
      key: "",
      snapshot: null
    };
    return null;
  }

  const key = [
    normalizeWhitespace(cueText),
    Math.round(Number(video.currentTime || 0) * 10),
    Math.round(videoRect.left),
    Math.round(videoRect.top),
    Math.round(videoRect.width),
    Math.round(videoRect.height)
  ].join("|");

  if (
    state.activeCueCache.snapshot &&
    state.activeCueCache.key === key &&
    Date.now() - state.activeCueCache.at < ACTIVE_CUE_CACHE_TTL_MS
  ) {
    return state.activeCueCache.snapshot;
  }

  const snapshot = buildActiveCueSnapshot(cueText, videoRect, key);
  state.activeCueCache = {
    at: Date.now(),
    key,
    snapshot
  };
  return snapshot;
}

function getVideoActiveCueText(video) {
  const textTracks = video?.textTracks;
  if (!textTracks) {
    return "";
  }

  const tracks = Array.from(textTracks).filter(Boolean);
  const activeTracks = tracks.filter((track) => track.mode === "showing");
  const orderedTracks = activeTracks.length ? activeTracks : tracks;
  const currentTime = Number(video.currentTime || 0);

  for (const track of orderedTracks) {
    const activeCueText = getCueTextList(track?.activeCues);
    if (activeCueText.length) {
      return normalizeCueText(activeCueText.join("\n"));
    }

    const allCueText = getMatchingCueText(track?.cues, currentTime);
    if (allCueText.length) {
      return normalizeCueText(allCueText.join("\n"));
    }
  }

  return "";
}

function getCueTextList(cues) {
  if (!cues) {
    return [];
  }

  return Array.from(cues)
    .map((cue) => String(cue?.text || "").trim())
    .filter(Boolean);
}

function getMatchingCueText(cues, currentTime) {
  if (!cues) {
    return [];
  }

  return Array.from(cues)
    .filter((cue) => Number(cue?.startTime) <= currentTime && Number(cue?.endTime) >= currentTime)
    .map((cue) => String(cue?.text || "").trim())
    .filter(Boolean);
}

function normalizeCueText(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n");
}

function buildActiveCueSnapshot(cueText, videoRect, key) {
  const fontSize = clampNumber(videoRect.height * 0.048, ACTIVE_CUE_MIN_FONT_SIZE, ACTIVE_CUE_MAX_FONT_SIZE);
  const lineHeight = fontSize * 1.42;
  const gap = fontSize * 0.4;
  const charWidth = fontSize * 0.56;
  const maxLineWidth = Math.min(videoRect.width * ACTIVE_CUE_MAX_LINE_WIDTH_RATIO, 820);
  const lines = wrapCueLines(cueText, maxLineWidth, charWidth, gap);

  if (!lines.length) {
    return null;
  }

  const totalHeight = lines.length * lineHeight;
  const top = Math.max(videoRect.top + videoRect.height * 0.56, videoRect.bottom - totalHeight - fontSize * 1.9);
  const entries = [];

  lines.forEach((line, lineIndex) => {
    const lineWidth =
      line.reduce((sum, word) => sum + measureCueWordWidth(word.word, charWidth), 0) +
      Math.max(0, line.length - 1) * gap;
    let left = videoRect.left + (videoRect.width - lineWidth) / 2;

    line.forEach((word) => {
      const width = measureCueWordWidth(word.word, charWidth);
      const rect = {
        left,
        top: top + lineIndex * lineHeight,
        right: left + width,
        bottom: top + lineIndex * lineHeight + lineHeight,
        width,
        height: lineHeight
      };

      entries.push({
        index: entries.length,
        word: word.word,
        rect
      });

      left += width + gap;
    });
  });

  return {
    key,
    text: normalizeWhitespace(cueText.replace(/\n+/g, " ")),
    entries,
    rect: mergeRects(entries.map((entry) => entry.rect))
  };
}

function wrapCueLines(cueText, maxLineWidth, charWidth, gap) {
  const rawLines = String(cueText || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const wrappedLines = [];

  for (const rawLine of rawLines) {
    const words = rawLine.match(WORD_REGEX) || [];
    if (!words.length) {
      continue;
    }

    let currentLine = [];
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = measureCueWordWidth(word, charWidth);
      const nextWidth = currentLine.length ? currentWidth + gap + wordWidth : wordWidth;

      if (currentLine.length && nextWidth > maxLineWidth) {
        wrappedLines.push(currentLine);
        currentLine = [{ word }];
        currentWidth = wordWidth;
        continue;
      }

      currentLine.push({ word });
      currentWidth = nextWidth;
    }

    if (currentLine.length) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines.slice(0, 3);
}

function measureCueWordWidth(word, charWidth) {
  return Math.max(charWidth * String(word || "").length, charWidth * 0.9);
}

function findProfileSubtitleContainer(startElement) {
  const candidates = getProfileSubtitleCandidates();

  if (!candidates.length) {
    return null;
  }

  let element = startElement;
  while (element) {
    const match = candidates.find(
      (candidate) => candidate === element || isComposedAncestor(candidate, element)
    );
    if (match) {
      return match;
    }

    if (element === document.body || element === document.documentElement) {
      break;
    }

    element = getParentElementCrossRoot(element);
  }

  return null;
}

function getProfileSubtitleCandidates() {
  const profile = state.pageContext?.siteProfile;
  if (!profile?.subtitleSelectors?.length) {
    return [];
  }

  if (Date.now() - state.siteSelectorCache.at < 400) {
    return state.siteSelectorCache.candidates;
  }

  const selectors = profile.subtitleSelectors.join(", ");
  const candidates = querySelectorAllDeep(selectors)
    .filter((element) => isVisibleCandidate(element))
    .sort((left, right) => {
      const leftScore = isNearPrimaryVideo(left.getBoundingClientRect()) ? 1 : 0;
      const rightScore = isNearPrimaryVideo(right.getBoundingClientRect()) ? 1 : 0;
      return rightScore - leftScore;
    });

  state.siteSelectorCache = {
    at: Date.now(),
    candidates
  };

  return candidates;
}

function getFallbackSubtitleCandidates() {
  if (Date.now() - state.fallbackCandidateCache.at < FALLBACK_CANDIDATE_TTL_MS) {
    return state.fallbackCandidateCache.candidates;
  }

  const video = getPrimaryVideoElement();
  const searchRoots = [];
  const profileCandidates = getProfileSubtitleCandidates();
  let searchRoot = video ? getParentElementCrossRoot(video) : null;

  for (const candidate of profileCandidates) {
    let candidateRoot = candidate;
    for (let level = 0; candidateRoot && level < 3; level += 1) {
      if (!searchRoots.includes(candidateRoot)) {
        searchRoots.push(candidateRoot);
      }
      candidateRoot = getParentElementCrossRoot(candidateRoot);
    }
  }

  for (let level = 0; searchRoot && level < 4; level += 1) {
    if (!searchRoots.includes(searchRoot)) {
      searchRoots.push(searchRoot);
    }
    searchRoot = getParentElementCrossRoot(searchRoot);
  }

  if (!searchRoots.length) {
    state.fallbackCandidateCache = {
      at: Date.now(),
      candidates: []
    };
    return [];
  }

  const seen = new Set();
  const candidates = [];

  for (const root of searchRoots) {
    const rootCandidates = querySelectorAllDeep(
      "div, span, p, li, section, article, [aria-live='polite'], [aria-live='assertive'], [class*='cue'], [class*='track'], [class*='caption'], [class*='subtitle']",
      root
    )
      .filter((element) => !seen.has(element))
      .filter((element) => {
        seen.add(element);
        return isLikelySubtitleContainer(element);
      });

    candidates.push(...rootCandidates);
  }

  const sortedCandidates = candidates
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftScore = Number(isNearPrimaryVideo(leftRect)) * 2 + Number(leftRect.bottom > window.innerHeight * 0.55);
      const rightScore =
        Number(isNearPrimaryVideo(rightRect)) * 2 +
        Number(rightRect.bottom > window.innerHeight * 0.55);

      return rightScore - leftScore;
    })
    .slice(0, 18);

  state.fallbackCandidateCache = {
    at: Date.now(),
    candidates: sortedCandidates
  };

  return sortedCandidates;
}

function matchesProfileSelector(element) {
  return getProfileSubtitleCandidates().some((candidate) => candidate === element);
}

function isVisibleCandidate(element, rect = element.getBoundingClientRect()) {
  const style = window.getComputedStyle(element);

  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity || "1") < 0.2
  ) {
    return false;
  }

  if (rect.width < 30 || rect.height < 10) {
    return false;
  }

  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    return false;
  }

  return Boolean(normalizeWhitespace(element.innerText || element.textContent || ""));
}

function cloneTranslationDetails(details) {
  return {
    headword: String(details?.headword || ""),
    partOfSpeech: String(details?.partOfSpeech || ""),
    detailedMeanings: Array.isArray(details?.detailedMeanings)
      ? details.detailedMeanings.map((group) => ({
          partOfSpeech: String(group?.partOfSpeech || ""),
          meanings: Array.isArray(group?.meanings) ? [...group.meanings] : []
        }))
      : [],
    synonyms: Array.isArray(details?.synonyms) ? [...details.synonyms] : [],
    wordForms: Array.isArray(details?.wordForms)
      ? details.wordForms.map((entry) => ({
          label: String(entry?.label || ""),
          value: String(entry?.value || "")
        }))
      : [],
    dictionaryDefinitions: Array.isArray(details?.dictionaryDefinitions)
      ? details.dictionaryDefinitions.map((entry) => ({
          partOfSpeech: String(entry?.partOfSpeech || ""),
          definition: String(entry?.definition || ""),
          headword: String(entry?.headword || ""),
          example: String(entry?.example || "")
        }))
      : [],
    examples: Array.isArray(details?.examples) ? [...details.examples] : [],
    phraseMatches: Array.isArray(details?.phraseMatches)
      ? details.phraseMatches.map((entry) => ({
          text: String(entry?.text || ""),
          translatedText: String(entry?.translatedText || ""),
          partOfSpeech: String(entry?.partOfSpeech || ""),
          examples: Array.isArray(entry?.examples) ? [...entry.examples] : []
        }))
      : [],
    grammarBreakdown: details?.grammarBreakdown
      ? {
          summary: String(details.grammarBreakdown.summary || ""),
          structure: String(details.grammarBreakdown.structure || ""),
          tense: String(details.grammarBreakdown.tense || ""),
          notes: Array.isArray(details.grammarBreakdown.notes)
            ? [...details.grammarBreakdown.notes]
            : []
        }
      : null,
    contextInsights: Array.isArray(details?.contextInsights)
      ? [...details.contextInsights]
      : [],
    pronunciation: details?.pronunciation
      ? {
          text: String(details.pronunciation.text || ""),
          lang: String(details.pronunciation.lang || ""),
          label: String(details.pronunciation.label || ""),
          slowerLabel: String(details.pronunciation.slowerLabel || "")
        }
      : null
  };
}

function beginTooltipRequest() {
  clearTooltipPendingTimer();
  state.nextTooltipRequestId += 1;
  state.activeTooltipRequestId = state.nextTooltipRequestId;
  return state.activeTooltipRequestId;
}

function invalidateTooltipRequests() {
  clearTooltipPendingTimer();
  state.nextTooltipRequestId += 1;
  state.activeTooltipRequestId = state.nextTooltipRequestId;
}

function isTooltipRequestCurrent(requestId) {
  return requestId === state.activeTooltipRequestId;
}

async function enrichHoverTranslation(hoveredWord, translation) {
  const details = cloneTranslationDetails(translation.details);

  if (
    !(details.phraseMatches || []).length &&
    countWords(translation.sourceText) === 1 &&
    String(translation.detectedSourceLanguage || "").toLowerCase().startsWith("en")
  ) {
    const phraseMatch = await detectPhraseMatch(hoveredWord, translation);
    if (phraseMatch) {
      details.phraseMatches = [phraseMatch];
    }
  }

  return {
    ...translation,
    details
  };
}

async function detectPhraseMatch(hoveredWord, baseTranslation) {
  if (!Number.isInteger(hoveredWord?.index)) {
    return null;
  }

  const entries = hoveredWord.virtualEntries
    || (hoveredWord.container ? getRenderedWordEntries(hoveredWord.container) : []);
  if (entries.length < 2) {
    return null;
  }

  const candidates = buildPhraseCandidates(entries, hoveredWord.index);
  for (const candidate of candidates.slice(0, 2)) {
    if (!candidate.text || normalizeWhitespace(candidate.text) === hoveredWord.word) {
      continue;
    }

    const phraseTranslation = await requestTranslation(candidate.text);
    if (!phraseTranslation?.translatedText) {
      continue;
    }

    return {
      text: candidate.text,
      translatedText: phraseTranslation.translatedText,
      partOfSpeech: phraseTranslation.details?.partOfSpeech || "",
      examples: Array.isArray(phraseTranslation.details?.examples)
        ? phraseTranslation.details.examples.slice(0, 2)
        : []
    };
  }

  return null;
}

function buildPhraseCandidates(entries, hoveredIndex) {
  const seen = new Set();
  const candidates = [];

  for (let length = 2; length <= 4; length += 1) {
    const startMin = Math.max(0, hoveredIndex - length + 1);
    const startMax = Math.min(hoveredIndex, entries.length - length);

    for (let start = startMin; start <= startMax; start += 1) {
      const slice = entries.slice(start, start + length);
      const tokens = slice.map((entry) => String(entry.word || "").toLowerCase());
      const hoverOffset = hoveredIndex - start;
      if (!isPhraseCandidateTokens(tokens, hoverOffset)) {
        continue;
      }

      const text = normalizeWhitespace(slice.map((entry) => entry.word).join(" "));
      const key = text.toLocaleLowerCase("en-US");
      if (!text || seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({
        text,
        score: scorePhraseCandidate(tokens, hoverOffset)
      });
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

function isPhraseCandidateTokens(tokens, hoverOffset) {
  if (!Array.isArray(tokens) || tokens.length < 2) {
    return false;
  }

  const connectorPositions = tokens
    .map((token, index) => (PHRASE_CONNECTOR_WORDS.has(token) ? index : -1))
    .filter((index) => index >= 0);
  if (!connectorPositions.length || tokens.every((token) => PHRASE_CONNECTOR_WORDS.has(token))) {
    return false;
  }

  return connectorPositions.some((position) => Math.abs(position - hoverOffset) <= 1);
}

function scorePhraseCandidate(tokens, hoverOffset) {
  const connectorCount = tokens.filter((token) => PHRASE_CONNECTOR_WORDS.has(token)).length;
  const edgeConnectorBonus = PHRASE_CONNECTOR_WORDS.has(tokens[0]) || PHRASE_CONNECTOR_WORDS.has(tokens[tokens.length - 1])
    ? 2
    : 0;
  const nearHoverBonus = PHRASE_CONNECTOR_WORDS.has(tokens[hoverOffset - 1]) || PHRASE_CONNECTOR_WORDS.has(tokens[hoverOffset + 1])
    ? 3
    : 0;

  return connectorCount * 3 + edgeConnectorBonus + nearHoverBonus + tokens.length;
}

function buildHoverTranslationOptions(hoveredWord) {
  const contextText = normalizeWhitespace(String(hoveredWord?.context || ""));
  const markedContextText = buildMarkedContextText(hoveredWord);
  const phraseCandidates = buildHoverPhraseCandidates(hoveredWord);
  const options = {
    mode: "hover"
  };

  if (contextText) {
    options.contextText = contextText;
  }

  if (markedContextText) {
    options.markedContextText = markedContextText;
  }

  if (phraseCandidates.length) {
    options.phraseCandidates = phraseCandidates;
  }

  return options;
}

function buildHoverPhraseCandidates(hoveredWord) {
  if (!Number.isInteger(hoveredWord?.index)) {
    return [];
  }

  const entries = hoveredWord.virtualEntries
    || (hoveredWord.container ? getRenderedWordEntries(hoveredWord.container) : []);
  if (entries.length < 2) {
    return [];
  }

  return buildPhraseCandidates(entries, hoveredWord.index)
    .map((candidate) => candidate.text)
    .filter((candidate) => candidate && normalizeWhitespace(candidate) !== hoveredWord.word)
    .slice(0, MAX_CONTEXT_PHRASE_CANDIDATES);
}

function buildMarkedContextText(hoveredWord) {
  if (Number.isInteger(hoveredWord?.index)) {
    const entries = hoveredWord.virtualEntries
      || (hoveredWord.container ? getRenderedWordEntries(hoveredWord.container) : []);

    if (entries.length) {
      const start = Math.max(0, hoveredWord.index - HOVER_CONTEXT_WINDOW_WORDS);
      const end = Math.min(entries.length, hoveredWord.index + HOVER_CONTEXT_WINDOW_WORDS + 1);
      const parts = [];

      for (let index = start; index < end; index += 1) {
        const word = String(entries[index]?.word || "").trim();
        if (!word) {
          continue;
        }

        if (index === hoveredWord.index) {
          parts.push(CONTEXT_TARGET_MARKER, word, CONTEXT_TARGET_MARKER_END);
        } else {
          parts.push(word);
        }
      }

      const markedText = normalizeWhitespace(parts.join(" "));
      if (markedText) {
        return markedText;
      }
    }
  }

  return markFirstWordInContext(hoveredWord?.context, hoveredWord?.word);
}

function markFirstWordInContext(contextText, word) {
  const normalizedContext = normalizeWhitespace(String(contextText || ""));
  const normalizedWord = String(word || "").trim();
  if (!normalizedContext || !normalizedWord) {
    return "";
  }

  const wordPattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, "i");
  if (!wordPattern.test(normalizedContext)) {
    return "";
  }

  return normalizeWhitespace(
    normalizedContext.replace(
      wordPattern,
      `${CONTEXT_TARGET_MARKER} ${normalizedWord} ${CONTEXT_TARGET_MARKER_END}`
    )
  );
}

function buildTranslationCacheKey(text, options = {}) {
  const parts = [
    state.settings.sourceLang,
    state.settings.targetLang,
    normalizeCacheSegment(text)
  ];
  const mode = String(options?.mode || "").trim();

  if (mode) {
    parts.push(mode);
  }

  const markedContextText = normalizeCacheSegment(options?.markedContextText);
  const contextText = normalizeCacheSegment(options?.contextText);
  if (markedContextText) {
    parts.push(markedContextText);
  } else if (contextText) {
    parts.push(contextText);
  }

  const phraseSignature = Array.isArray(options?.phraseCandidates)
    ? options.phraseCandidates.map((candidate) => normalizeCacheSegment(candidate)).filter(Boolean).join("|")
    : "";
  if (phraseSignature) {
    parts.push(phraseSignature);
  }

  return parts.join(":");
}

function normalizeCacheSegment(value) {
  return normalizeWhitespace(String(value || "")).toLocaleLowerCase("tr").slice(0, 180);
}

async function requestTranslation(text, options = {}) {
  const cacheKey = buildTranslationCacheKey(text, options);

  if (state.cache.has(cacheKey)) {
    const cached = state.cache.get(cacheKey);
    state.cache.delete(cacheKey);
    state.cache.set(cacheKey, cached);
    return cached;
  }

  if (state.pendingTranslationCache.has(cacheKey)) {
    return state.pendingTranslationCache.get(cacheKey);
  }

  const pendingRequest = sendRuntimeMessage({
    type: "TRANSLATE_TEXT",
    text,
    sourceLang: state.settings.sourceLang,
    targetLang: state.settings.targetLang,
    mode: options.mode,
    contextText: options.contextText,
    markedContextText: options.markedContextText,
    phraseCandidates: options.phraseCandidates,
    requestKey: cacheKey
  })
    .then((response) => {
      if (!response?.translation) {
        return response?.translation;
      }
      const normalizedTranslation = {
        ...response.translation,
        requestKey: response.translation.requestKey || cacheKey
      };
      rememberCachedTranslation(cacheKey, normalizedTranslation);
      return normalizedTranslation;
    })
    .finally(() => {
      state.pendingTranslationCache.delete(cacheKey);
    });

  state.pendingTranslationCache.set(cacheKey, pendingRequest);
  return pendingRequest;
}

function rememberCachedTranslation(cacheKey, translation) {
  state.cache.set(cacheKey, translation);

  while (state.cache.size > TRANSLATION_CACHE_MAX) {
    const oldestKey = state.cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    state.cache.delete(oldestKey);
  }
}

function clearTooltipPendingTimer() {
  clearTimeout(state.tooltipPendingTimer);
  state.tooltipPendingTimer = null;
}

function clearTooltipStatusTimer() {
  clearTimeout(state.tooltipStatusTimer);
  state.tooltipStatusTimer = null;
}

function scheduleTooltipPending(requestId, payload) {
  clearTooltipPendingTimer();
  state.tooltipPendingTimer = window.setTimeout(() => {
    state.tooltipPendingTimer = null;
    if (!isTooltipRequestCurrent(requestId)) {
      return;
    }
    showTooltipPending(payload);
  }, TOOLTIP_PENDING_DELAY_MS);
}

function setTooltipVisible(visible) {
  if (!state.tooltip) {
    return;
  }

  const tooltip = state.tooltip;
  clearTimeout(state.tooltipHideAnimationTimer);
  state.tooltipHideAnimationTimer = null;

  if (visible) {
    if (tooltip.hidden) {
      tooltip.hidden = false;
      tooltip.dataset.visible = "false";
      requestAnimationFrame(() => {
        if (state.tooltip === tooltip && !tooltip.hidden) {
          tooltip.dataset.visible = "true";
        }
      });
      return;
    }

    tooltip.dataset.visible = "true";
    return;
  }

  tooltip.dataset.visible = "false";
  state.tooltipHideAnimationTimer = window.setTimeout(() => {
    if (state.tooltip === tooltip && tooltip.dataset.visible !== "true") {
      tooltip.hidden = true;
    }
    state.tooltipHideAnimationTimer = null;
  }, TOOLTIP_TRANSITION_MS);
}

function setTooltipStatus(message, status = "info", durationMs = 0) {
  const statusElement = state.tooltip?.querySelector("[data-role='status']");
  if (!statusElement) {
    return;
  }

  clearTooltipStatusTimer();
  statusElement.textContent = String(message || "").trim();
  statusElement.dataset.state = status;

  if (durationMs > 0 && statusElement.textContent) {
    state.tooltipStatusTimer = window.setTimeout(() => {
      if (!state.tooltip) {
        return;
      }
      const latestStatusElement = state.tooltip.querySelector("[data-role='status']");
      if (!latestStatusElement || latestStatusElement.textContent !== statusElement.textContent) {
        return;
      }
      latestStatusElement.textContent = "";
      latestStatusElement.dataset.state = "idle";
      state.tooltipStatusTimer = null;
    }, durationMs);
  }
}

function setTooltipActionState({ saveDisabled = false, saveLabel = "Listeme kaydet" } = {}) {
  if (!state.tooltip) {
    return;
  }

  const saveButton = state.tooltip.querySelector("[data-role='save']");
  const pronounceButton = state.tooltip.querySelector("[data-role='pronounce']");
  const slowPronounceButton = state.tooltip.querySelector("[data-role='pronounce-slow']");
  if (saveButton) {
    saveButton.disabled = saveDisabled;
    saveButton.textContent = saveLabel;
  }

  const canPronounce = Boolean(state.currentPayload?.sourceText);
  if (pronounceButton) {
    pronounceButton.disabled = !canPronounce;
  }
  if (slowPronounceButton) {
    slowPronounceButton.disabled = !canPronounce;
  }
}

function showTooltipPending(payload) {
  const tooltip = ensureTooltip();
  state.currentPayload = null;
  state.tooltipPinnedUntil = 0;
  state.tooltipPointerInside = false;
  state.tooltipManualPinned = false;
  tooltip.dataset.kind = payload.title || "";
  tooltip.dataset.surface = resolveTooltipSurface(payload.rect);
  tooltip.dataset.layout = getEffectiveDisplayMode();
  tooltip.dataset.manualPinned = "false";
  tooltip.dataset.loading = "true";

  tooltip.querySelector("[data-role='badge']").textContent = payload.title || "Kelime";
  tooltip.querySelector("[data-role='source']").textContent = payload.sourceText || "";
  tooltip.querySelector("[data-role='target']").textContent = "Baglamla anlam getiriliyor...";
  tooltip.querySelector("[data-role='meta']").hidden = true;
  tooltip.querySelector("[data-role='context']").textContent =
    payload.context && payload.context !== payload.sourceText
      ? clipContext(payload.context)
      : "";
  updateTooltipPinState();
  renderTooltipDetails(tooltip, null, "", "");
  renderSubtitleHistorySection(
    tooltip.querySelector("[data-role='history']"),
    tooltip.querySelector("[data-role='history-section']")
  );
  setTooltipActionState({
    saveDisabled: true,
    saveLabel: "Hazirlaniyor..."
  });
  setTooltipStatus("Bekleniyor...", "pending");
  setTooltipVisible(true);
  positionTooltip(payload.rect, payload.point);
}

function showTooltip(payload) {
  const tooltip = ensureTooltip();
  state.currentPayload = payload;
  state.tooltipPinnedUntil = 0;
  state.tooltipPointerInside = false;
  state.tooltipManualPinned = false;
  tooltip.dataset.kind = payload.title || "";
  tooltip.dataset.surface = resolveTooltipSurface(payload.rect);
  tooltip.dataset.layout = getEffectiveDisplayMode();
  tooltip.dataset.manualPinned = "false";
  tooltip.dataset.loading = "false";

  tooltip.querySelector("[data-role='badge']").textContent = payload.title;
  tooltip.querySelector("[data-role='source']").textContent = payload.sourceText;
  tooltip.querySelector("[data-role='target']").textContent = payload.translatedText;
  pushSubtitleHistoryEntry(payload.context || payload.sourceText, payload.title || "Kelime");
  updateTooltipPinState();
  renderTooltipDetails(tooltip, payload.details, payload.sourceText, payload.context);
  renderSubtitleHistorySection(
    tooltip.querySelector("[data-role='history']"),
    tooltip.querySelector("[data-role='history-section']")
  );
  tooltip.querySelector("[data-role='context']").textContent =
    payload.context && payload.context !== payload.sourceText
      ? clipContext(payload.context)
      : "";

  setTooltipStatus("", "idle");
  setTooltipActionState({
    saveDisabled: false,
    saveLabel: "Listeme kaydet"
  });
  setTooltipVisible(true);
  positionTooltip(payload.rect, payload.point);
}

function applyTranslationUpdate(translation, requestKeyOverride = "") {
  if (!translation) {
    return;
  }

  const requestKey = requestKeyOverride || translation.requestKey || "";
  if (requestKey) {
    rememberCachedTranslation(requestKey, translation);
  }

  if (!state.tooltip || state.tooltip.hidden || !state.currentPayload) {
    return;
  }

  const matchesKey = requestKey && state.currentPayload.requestKey === requestKey;
  const matchesText =
    !requestKey &&
    translation.sourceText &&
    state.currentPayload.sourceText === translation.sourceText;
  if (!matchesKey && !matchesText) {
    return;
  }

  const nextPayload = {
    ...state.currentPayload,
    ...translation,
    requestKey: requestKey || state.currentPayload.requestKey
  };
  state.currentPayload = nextPayload;

  const tooltip = state.tooltip;
  tooltip.dataset.loading = "false";
  tooltip.querySelector("[data-role='target']").textContent =
    nextPayload.translatedText || tooltip.querySelector("[data-role='target']").textContent;
  renderTooltipDetails(tooltip, nextPayload.details, nextPayload.sourceText, nextPayload.context);
  tooltip.querySelector("[data-role='context']").textContent =
    nextPayload.context && nextPayload.context !== nextPayload.sourceText
      ? clipContext(nextPayload.context)
      : "";
  setTooltipStatus("", "idle");
  setTooltipActionState({
    saveDisabled: false,
    saveLabel: "Listeme kaydet"
  });
  positionTooltip(nextPayload.rect, nextPayload.point);
}

function showTooltipError(message, rect, point) {
  const tooltip = ensureTooltip();
  state.currentPayload = null;
  state.tooltipPinnedUntil = 0;
  state.tooltipPointerInside = false;
  state.tooltipManualPinned = false;
  tooltip.dataset.kind = "Hata";
  tooltip.dataset.surface = resolveTooltipSurface(rect);
  tooltip.dataset.layout = getEffectiveDisplayMode();
  tooltip.dataset.manualPinned = "false";
  tooltip.dataset.loading = "false";

  tooltip.querySelector("[data-role='badge']").textContent = "Hata";
  tooltip.querySelector("[data-role='source']").textContent = message;
  tooltip.querySelector("[data-role='target']").textContent = "";
  updateTooltipPinState();
  renderTooltipDetails(tooltip, null, "", "");
  renderSubtitleHistorySection(
    tooltip.querySelector("[data-role='history']"),
    tooltip.querySelector("[data-role='history-section']")
  );
  tooltip.querySelector("[data-role='context']").textContent = "";
  setTooltipStatus("", "idle");
  setTooltipActionState({
    saveDisabled: true,
    saveLabel: "Listeme kaydet"
  });
  setTooltipVisible(true);
  positionTooltip(rect, point);
}

function ensureTooltip() {
  if (state.tooltip) {
    return state.tooltip;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "sht-root";
  tooltip.hidden = true;
  tooltip.dataset.visible = "false";
  tooltip.dataset.loading = "false";
  tooltip.dataset.theme = normalizeUiTheme(state.settings?.uiTheme);
  tooltip.innerHTML = `
    <div class="sht-card">
      <span class="sht-badge" data-role="badge">Kelime</span>
      <p class="sht-source" data-role="source"></p>
      <p class="sht-target" data-role="target"></p>
      <p class="sht-meta" data-role="meta" hidden></p>
      <section class="sht-section" data-role="phrases-section" hidden>
        <p class="sht-section-title">Phrase / idiom</p>
        <div class="sht-phrase-list" data-role="phrases"></div>
      </section>
      <section class="sht-section" data-role="meanings-section" hidden>
        <p class="sht-section-title">Detayli anlam</p>
        <div class="sht-chip-list" data-role="meanings"></div>
      </section>
      <section class="sht-section" data-role="synonyms-section" hidden>
        <p class="sht-section-title" data-role="synonyms-title">Synonyms</p>
        <div class="sht-chip-list" data-role="synonyms"></div>
      </section>
      <section class="sht-section" data-role="forms-section" hidden>
        <p class="sht-section-title">Word formation</p>
        <div class="sht-form-list" data-role="word-forms"></div>
      </section>
      <section class="sht-section" data-role="definitions-section" hidden>
        <p class="sht-section-title">Source dictionary</p>
        <div class="sht-definition-list" data-role="definitions"></div>
      </section>
      <section class="sht-section" data-role="examples-section" hidden>
        <p class="sht-section-title">Example mode</p>
        <div class="sht-example-list" data-role="examples"></div>
      </section>
      <section class="sht-section" data-role="insights-section" hidden>
        <p class="sht-section-title">Context engine</p>
        <div class="sht-chip-list" data-role="insights"></div>
      </section>
      <section class="sht-section" data-role="history-section" hidden>
        <p class="sht-section-title">Subtitle history</p>
        <div class="sht-example-list" data-role="history"></div>
      </section>
      <p class="sht-context" data-role="context"></p>
      <div class="sht-actions">
        <button type="button" class="sht-ghost" data-role="pronounce">Dinle</button>
        <button type="button" class="sht-ghost" data-role="pronounce-slow">Yavas</button>
        <button type="button" class="sht-pin" data-role="pin">Sabitle</button>
        <button type="button" class="sht-save" data-role="save">Listeme kaydet</button>
        <button type="button" class="sht-close" data-role="close">Kapat</button>
      </div>
      <div class="sht-status" data-role="status" data-state="idle"></div>
      <p class="sht-hint">S kaydet • P sabitle • R dinle • Esc kapa</p>
    </div>
  `;

  tooltip.addEventListener("mouseenter", () => {
    state.tooltipPointerInside = true;
    pinTooltip();
    clearTimeout(state.hideTimer);
  });

  tooltip.addEventListener("mouseleave", () => {
    state.tooltipPointerInside = false;
    scheduleHide();
  });

  tooltip.addEventListener("scroll", () => {
    pinTooltip();
  });

  tooltip.addEventListener(
    "wheel",
    () => {
      pinTooltip();
    },
    { passive: true }
  );

  tooltip.addEventListener("mousedown", () => {
    pinTooltip();
  });

  tooltip.addEventListener(
    "touchstart",
    () => {
      pinTooltip();
    },
    { passive: true }
  );

  tooltip
    .querySelector("[data-role='pin']")
    .addEventListener("click", toggleTooltipPinned);

  tooltip
    .querySelector("[data-role='save']")
    .addEventListener("click", handleSaveUnknownWord);

  tooltip
    .querySelector("[data-role='pronounce']")
    .addEventListener("click", () => playCurrentPayloadPronunciation(1));

  tooltip
    .querySelector("[data-role='pronounce-slow']")
    .addEventListener("click", () => playCurrentPayloadPronunciation(0.82));

  tooltip.querySelector("[data-role='close']").addEventListener("click", () => {
    hideTooltip(true);
  });

  document.documentElement.appendChild(tooltip);
  state.tooltip = tooltip;
  applyTooltipTheme();
  return tooltip;
}

function resolveTooltipSurface(rect) {
  return state.pageContext?.hasVisibleVideo || (rect && isNearPrimaryVideo(rect))
    ? "video"
    : "web";
}

function renderTooltipDetails(tooltip, details, sourceText, contextText = "") {
  const metaElement = tooltip.querySelector("[data-role='meta']");
  const phrasesSection = tooltip.querySelector("[data-role='phrases-section']");
  const phrasesElement = tooltip.querySelector("[data-role='phrases']");
  const meaningsSection = tooltip.querySelector("[data-role='meanings-section']");
  const meaningsElement = tooltip.querySelector("[data-role='meanings']");
  const synonymsSection = tooltip.querySelector("[data-role='synonyms-section']");
  const synonymsTitle = tooltip.querySelector("[data-role='synonyms-title']");
  const synonymsElement = tooltip.querySelector("[data-role='synonyms']");
  const formsSection = tooltip.querySelector("[data-role='forms-section']");
  const formsElement = tooltip.querySelector("[data-role='word-forms']");
  const definitionsSection = tooltip.querySelector("[data-role='definitions-section']");
  const definitionsElement = tooltip.querySelector("[data-role='definitions']");
  const examplesSection = tooltip.querySelector("[data-role='examples-section']");
  const examplesElement = tooltip.querySelector("[data-role='examples']");
  const insightsSection = tooltip.querySelector("[data-role='insights-section']");
  const insightsElement = tooltip.querySelector("[data-role='insights']");
  const safeDetails = details || {};
  const metaParts = [];

  if (safeDetails.headword && safeDetails.headword !== sourceText) {
    metaParts.push(`Lemma: ${safeDetails.headword}`);
  }

  if (safeDetails.partOfSpeech) {
    metaParts.push(safeDetails.partOfSpeech);
  }

  if (safeDetails.pronunciation?.ipa) {
    metaParts.push(safeDetails.pronunciation.ipa);
  }

  metaElement.textContent = "";

  if (safeDetails.cefrLevel) {
    const cefrBadge = document.createElement("span");
    cefrBadge.className = `sht-cefr-badge sht-cefr-${safeDetails.cefrLevel.toLowerCase()}`;
    cefrBadge.textContent = safeDetails.cefrLevel;
    cefrBadge.title = getCefrDescription(safeDetails.cefrLevel);
    metaElement.appendChild(cefrBadge);
    if (metaParts.length > 0) {
      metaElement.append(" ");
    }
  }

  if (metaParts.length > 0) {
    const metaText = document.createElement("span");
    metaText.textContent = metaParts.join(" • ");
    metaElement.appendChild(metaText);
  }

  metaElement.hidden = !safeDetails.cefrLevel && metaParts.length === 0;

  renderPhraseMatches(phrasesElement, safeDetails.phraseMatches || []);
  phrasesSection.hidden = phrasesElement.childElementCount === 0;

  renderMeaningGroups(meaningsElement, safeDetails.detailedMeanings || []);
  meaningsSection.hidden = meaningsElement.childElementCount === 0;

  renderChipItems(synonymsElement, safeDetails.synonyms || []);
  const synonymCount = synonymsElement.childElementCount;
  if (synonymsTitle) {
    synonymsTitle.textContent = synonymCount ? `Synonyms (${synonymCount})` : "Synonyms";
  }
  synonymsSection.hidden = synonymCount === 0;

  renderWordForms(formsElement, safeDetails.wordForms || []);
  formsSection.hidden = formsElement.childElementCount === 0;

  renderDefinitions(definitionsElement, safeDetails.dictionaryDefinitions || []);
  definitionsSection.hidden = definitionsElement.childElementCount === 0;

  renderExamples(examplesElement, contextText, safeDetails.examples || []);
  examplesSection.hidden = examplesElement.childElementCount === 0;

  renderChipItems(insightsElement, safeDetails.contextInsights || []);
  insightsSection.hidden = insightsElement.childElementCount === 0;
}

function renderMeaningGroups(container, groups) {
  container.textContent = "";
  if (!groups.length) return;

  const list = document.createElement("div");
  list.className = "sht-fluid-list";

  for (const group of groups) {
    const meanings = Array.isArray(group?.meanings) ? group.meanings.filter(Boolean) : [];
    const partOfSpeech = String(group?.partOfSpeech || "").trim();
    if (!partOfSpeech || !meanings.length) {
      continue;
    }

    const item = document.createElement("div");
    item.className = "sht-fluid-item";

    const label = document.createElement("span");
    label.className = "sht-inline-label";
    label.textContent = partOfSpeech;

    const values = document.createElement("span");
    values.className = "sht-inline-values";
    values.textContent = meanings.join(", ");

    item.append(label, values);
    list.appendChild(item);
  }
  container.appendChild(list);
}

function renderPhraseMatches(container, phraseMatches) {
  container.textContent = "";

  for (const phrase of phraseMatches) {
    const sourceText = String(phrase?.text || "").trim();
    const translatedText = String(phrase?.translatedText || "").trim();
    if (!sourceText || !translatedText) {
      continue;
    }

    const item = document.createElement("div");
    item.className = "sht-phrase-item";

    const sourceElement = document.createElement("p");
    sourceElement.className = "sht-phrase-source";
    sourceElement.textContent = sourceText;

    const targetElement = document.createElement("p");
    targetElement.className = "sht-phrase-target";
    targetElement.textContent = translatedText;

    item.append(sourceElement, targetElement);

    if (phrase.partOfSpeech) {
      const metaElement = document.createElement("span");
      metaElement.className = "sht-definition-label";
      metaElement.textContent = phrase.partOfSpeech;
      item.appendChild(metaElement);
    }

    const firstExample = Array.isArray(phrase.examples)
      ? phrase.examples.map((entry) => String(entry || "").trim()).find(Boolean)
      : "";
    if (firstExample) {
      const exampleElement = document.createElement("p");
      exampleElement.className = "sht-example-text";
      exampleElement.textContent = firstExample;
      item.appendChild(exampleElement);
    }

    container.appendChild(item);
  }
}

function renderChipItems(container, values) {
  container.textContent = "";
  const filtered = values.map(v => String(v || "").trim()).filter(Boolean);
  if (!filtered.length) return;

  const wrapper = document.createElement("p");
  wrapper.className = "sht-fluid-text";
  wrapper.textContent = filtered.join(", ");
  container.appendChild(wrapper);
}

function renderWordForms(container, forms) {
  container.textContent = "";

  for (const form of forms) {
    const label = String(form?.label || "").trim();
    const value = String(form?.value || "").trim();
    if (!label || !value) {
      continue;
    }

    const formElement = document.createElement("span");
    formElement.className = "sht-form-chip";

    const labelElement = document.createElement("span");
    labelElement.className = "sht-form-label";
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = "sht-form-value";
    valueElement.textContent = value;

    formElement.append(labelElement, valueElement);
    container.appendChild(formElement);
  }
}

function renderDefinitions(container, definitions) {
  container.textContent = "";
  if (!definitions.length) return;

  const list = document.createElement("div");
  list.className = "sht-fluid-list";

  for (const entry of definitions) {
    const definition = String(entry?.definition || "").trim();
    if (!definition) {
      continue;
    }

    const item = document.createElement("div");
    item.className = "sht-fluid-item";

    if (entry.partOfSpeech) {
      const label = document.createElement("span");
      label.className = "sht-inline-label";
      label.textContent = entry.partOfSpeech;
      item.appendChild(label);
    }

    const text = document.createElement("span");
    text.className = "sht-inline-values";
    text.textContent = definition;
    item.appendChild(text);

    list.appendChild(item);
  }
  container.appendChild(list);
}

function renderExamples(container, contextText, examples) {
  container.textContent = "";
  const seen = new Set();
  const list = document.createElement("div");
  list.className = "sht-fluid-list";

  const appendExample = (text, isContext = false) => {
    const normalizedText = normalizeWhitespace(text);
    if (!normalizedText) return;

    const key = normalizedText.toLocaleLowerCase("tr");
    if (seen.has(key)) return;

    seen.add(key);

    const item = document.createElement("div");
    item.className = isContext ? "sht-example-context-item" : "sht-fluid-item";

    const textElement = document.createElement("p");
    textElement.className = "sht-inline-values";
    textElement.textContent = normalizedText;

    item.appendChild(textElement);
    list.appendChild(item);
  };

  if (contextText && contextText !== state.currentPayload?.sourceText) {
    appendExample(contextText, true);
  }

  const rawExamples = Array.isArray(examples) ? examples : [];
  for (const example of rawExamples) {
    appendExample(example);
  }

  if (list.childElementCount) {
    container.appendChild(list);
  }
}

function renderGrammarBreakdown(container, grammarBreakdown) {
  container.textContent = "";
  if (!grammarBreakdown) {
    return;
  }

  const { summary, structure, tense, notes } = grammarBreakdown;
  const lines = [
    summary ? `Tur: ${summary}` : "",
    structure ? `Yapi: ${structure}` : "",
    tense ? `Zaman: ${tense}` : ""
  ].filter(Boolean);

  for (const line of lines) {
    const item = document.createElement("div");
    item.className = "sht-definition-item";

    const textElement = document.createElement("p");
    textElement.className = "sht-definition-text";
    textElement.textContent = line;
    item.appendChild(textElement);
    container.appendChild(item);
  }

  for (const note of Array.isArray(notes) ? notes : []) {
    const item = document.createElement("div");
    item.className = "sht-definition-item";

    const textElement = document.createElement("p");
    textElement.className = "sht-definition-text";
    textElement.textContent = note;
    item.appendChild(textElement);
    container.appendChild(item);
  }
}

function renderSubtitleHistorySection(container, section) {
  if (!container || !section) {
    return;
  }

  container.textContent = "";
  const displayMode = getEffectiveDisplayMode();
  const history = displayMode === "docked" ? state.subtitleHistory.slice(0, 6) : [];

  for (const entry of history) {
    const item = document.createElement("div");
    item.className = "sht-example-item";

    const label = document.createElement("span");
    label.className = "sht-definition-label";
    label.textContent = entry.source || "Satir";

    const textElement = document.createElement("p");
    textElement.className = "sht-example-text";
    textElement.textContent = entry.text;

    item.append(label, textElement);
    container.appendChild(item);
  }

  section.hidden = container.childElementCount === 0;
}

async function captureSubtitleHistoryTick() {
  if (!state.enabled || !state.pageContext?.isVideoPage) {
    return;
  }

  const text = getCurrentSubtitleContextForHistory();
  if (!text) {
    return;
  }

  pushSubtitleHistoryEntry(text, "Canli");
  await syncSubtitleHistoryToBackground();
}

function getCurrentSubtitleContextForHistory() {
  const activeCueSnapshot = getActiveCueSnapshot();
  if (activeCueSnapshot?.text) {
    return activeCueSnapshot.text;
  }

  const candidates = [...getProfileSubtitleCandidates(), ...getFallbackSubtitleCandidates()];
  for (const candidate of candidates) {
    const text = clipContext(getContainerTextSnapshot(candidate));
    if (text) {
      return text;
    }
  }

  return "";
}

function pushSubtitleHistoryEntry(text, source = "Altyazi") {
  const normalizedText = clipContext(text);
  if (!normalizedText) {
    return;
  }

  const currentHead = state.subtitleHistory[0]?.text || "";
  if (currentHead === normalizedText) {
    return;
  }

  state.subtitleHistory.unshift({
    text: normalizedText,
    source,
    savedAt: new Date().toISOString()
  });
  state.subtitleHistory = state.subtitleHistory.slice(
    0,
    Math.max(5, Number(state.settings?.subtitleHistoryLimit || 10))
  );
}

async function syncSubtitleHistoryToBackground() {
  const signature = state.subtitleHistory.map((entry) => entry.text).join("|");
  if (!signature || signature === state.subtitleHistorySignature) {
    return;
  }

  if (Date.now() - state.subtitleHistorySyncAt < 500) {
    return;
  }

  state.subtitleHistorySignature = signature;
  state.subtitleHistorySyncAt = Date.now();

  await sendRuntimeMessage({
    type: "UPDATE_SUBTITLE_HISTORY",
    items: state.subtitleHistory
  }).catch(() => {
    // ignore background sync errors
  });
}

function getViewportMetrics() {
  const visual = window.visualViewport;
  const width = visual?.width ?? window.innerWidth;
  const height = visual?.height ?? window.innerHeight;
  const baseOffsetLeft = visual?.offsetLeft ?? 0;
  const baseOffsetTop = visual?.offsetTop ?? 0;
  const rootOffset = getRootViewportOffset();
  const offsetLeft = Math.max(0, baseOffsetLeft + rootOffset.x);
  const offsetTop = Math.max(0, baseOffsetTop + rootOffset.y);

  return {
    width,
    height,
    offsetLeft,
    offsetTop
  };
}

function getRootViewportOffset() {
  const rects = [];
  if (document.documentElement) {
    rects.push(document.documentElement.getBoundingClientRect());
  }
  if (document.body) {
    rects.push(document.body.getBoundingClientRect());
  }

  let offsetX = 0;
  let offsetY = 0;
  for (const rect of rects) {
    if (!rect) {
      continue;
    }
    if (rect.left < 0) {
      offsetX = Math.max(offsetX, -rect.left);
    }
    if (rect.top < 0) {
      offsetY = Math.max(offsetY, -rect.top);
    }
  }

  return { x: offsetX, y: offsetY };
}

function positionTooltip(rect, point) {
  if (!state.tooltip) {
    return;
  }

  const tooltip = state.tooltip;
  const layout = tooltip.dataset.layout || getEffectiveDisplayMode();
  if (layout === "docked") {
    const dockedPlacement = resolveDockedTooltipPlacement(tooltip);
    tooltip.style.width = `${dockedPlacement.width}px`;
    tooltip.style.maxHeight = `${dockedPlacement.maxHeight}px`;
    tooltip.style.left = `${dockedPlacement.left}px`;
    tooltip.style.top = `${dockedPlacement.top}px`;
    return;
  }

  tooltip.style.maxHeight = "";

  if (!rect) {
    return;
  }

  const viewport = getViewportMetrics();
  const margin = 14;
  const preferredWidth = getTooltipPreferredWidth(tooltip.dataset.kind || "Kelime");
  const width = Math.min(preferredWidth, viewport.width - margin * 2);
  tooltip.style.width = `${width}px`;

  const targetX = point?.x ?? rect.left + rect.width / 2;
  const targetY = point?.y ?? rect.top;
  const tooltipHeight = tooltip.getBoundingClientRect().height || 180;
  const isVideoOverlay = Boolean(
    state.pageContext?.hasVisibleVideo || isNearPrimaryVideo(rect)
  );
  const candidates = isVideoOverlay
    ? [
        {
          placement: "right",
          left: rect.right + 18,
          top: rect.top - Math.min(26, tooltipHeight * 0.18)
        },
        {
          placement: "left",
          left: rect.left - width - 18,
          top: rect.top - Math.min(26, tooltipHeight * 0.18)
        },
        {
          placement: "top",
          left: targetX - width / 2,
          top: rect.top - tooltipHeight - 18
        },
        {
          placement: "bottom",
          left: targetX - width / 2,
          top: rect.bottom + 16
        }
      ]
    : [
        {
          placement: "right",
          left: targetX + 18,
          top: targetY + 18
        },
        {
          placement: "top",
          left: targetX - width / 2,
          top: rect.top - tooltipHeight - 14
        },
        {
          placement: "bottom",
          left: targetX - width / 2,
          top: rect.bottom + 14
        }
      ];
  const orderedCandidates = orderTooltipCandidates(candidates, getTooltipPlacementPreference());

  let placement = null;
  for (const candidate of orderedCandidates) {
    const resolved = resolveTooltipPlacement(candidate, width, tooltipHeight, margin, viewport);
    if (resolved.fits) {
      placement = resolved;
      break;
    }
  }

  if (!placement) {
    placement = resolveTooltipPlacement(
      {
        left: targetX - width / 2,
        top: rect.top - tooltipHeight - 14
      },
      width,
      tooltipHeight,
      margin,
      viewport
    );
  }

  tooltip.style.left = `${placement.left}px`;
  tooltip.style.top = `${placement.top}px`;
}

function resolveDockedTooltipPlacement(tooltip) {
  const viewport = getViewportMetrics();
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const margin = 16;
  const gutter = 14;
  const preferredWidth = Math.min(
    getTooltipPreferredWidth(tooltip.dataset.kind || "Kelime") + 44,
    430
  );
  const width = Math.min(preferredWidth, viewportWidth - margin * 2);
  const defaultMaxHeight = Math.min(viewportHeight * 0.66, 460);
  const fallback = {
    width,
    maxHeight: defaultMaxHeight,
    left: Math.max(margin, viewportWidth - width - margin) + viewport.offsetLeft,
    top: Math.max(margin, viewportHeight - defaultMaxHeight - margin) + viewport.offsetTop
  };

  if (tooltip.dataset.surface !== "video" && !state.pageContext?.hasVisibleVideo) {
    return fallback;
  }

  const videoRect = getPrimaryVideoRect();
  if (!videoRect || videoRect.width < 220 || videoRect.height < 150) {
    return fallback;
  }

  const safeVideoRect = {
    left: clamp(videoRect.left, margin, viewportWidth - margin),
    top: clamp(videoRect.top, margin, viewportHeight - margin),
    right: clamp(videoRect.right, margin, viewportWidth - margin),
    bottom: clamp(videoRect.bottom, margin, viewportHeight - margin),
    width: Math.max(0, Math.min(videoRect.right, viewportWidth - margin) - Math.max(videoRect.left, margin)),
    height: Math.max(0, Math.min(videoRect.bottom, viewportHeight - margin) - Math.max(videoRect.top, margin))
  };

  const alignedVideoTop = clamp(
    safeVideoRect.top + 10,
    margin,
    viewportHeight - defaultMaxHeight - margin
  );
  const availableRight = viewportWidth - safeVideoRect.right - margin;
  if (availableRight >= width + gutter) {
    return {
      width,
      maxHeight: Math.max(220, Math.min(defaultMaxHeight, viewportHeight - alignedVideoTop - margin)),
      left: safeVideoRect.right + gutter + viewport.offsetLeft,
      top: alignedVideoTop + viewport.offsetTop
    };
  }

  const availableLeft = safeVideoRect.left - margin;
  if (availableLeft >= width + gutter) {
    return {
      width,
      maxHeight: Math.max(220, Math.min(defaultMaxHeight, viewportHeight - alignedVideoTop - margin)),
      left: safeVideoRect.left - width - gutter + viewport.offsetLeft,
      top: alignedVideoTop + viewport.offsetTop
    };
  }

  const safeBandTop = clamp(
    safeVideoRect.top + 12,
    margin,
    viewportHeight - 220 - margin
  );
  const safeBandBottom = Math.max(
    safeBandTop + 220,
    Math.min(
      safeVideoRect.bottom - 18,
      safeVideoRect.top + Math.max(230, safeVideoRect.height * 0.46)
    )
  );
  const maxHeight = Math.max(
    220,
    Math.min(defaultMaxHeight, safeBandBottom - safeBandTop, viewportHeight - safeBandTop - margin)
  );

  return {
    width,
    maxHeight,
    left: clamp(safeVideoRect.right - width - 12, margin, viewportWidth - width - margin) + viewport.offsetLeft,
    top: clamp(safeBandTop, margin, viewportHeight - maxHeight - margin) + viewport.offsetTop
  };
}

function orderTooltipCandidates(candidates, preference) {
  if (!preference || preference === "auto") {
    return candidates;
  }

  return [...candidates].sort((left, right) => {
    const leftScore = left.placement === preference ? 0 : 1;
    const rightScore = right.placement === preference ? 0 : 1;
    return leftScore - rightScore;
  });
}

function resolveTooltipPlacement(candidate, width, height, margin, viewport) {
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const offsetLeft = viewport?.offsetLeft ?? 0;
  const offsetTop = viewport?.offsetTop ?? 0;
  const minLeft = offsetLeft + margin;
  const minTop = offsetTop + margin;
  const maxLeft = offsetLeft + viewportWidth - width - margin;
  const maxTop = offsetTop + viewportHeight - height - margin;
  const candidateLeft = candidate.left + offsetLeft;
  const candidateTop = candidate.top + offsetTop;
  const left = clamp(candidateLeft, minLeft, maxLeft);
  const top = clamp(candidateTop, minTop, maxTop);
  const fitsHorizontally =
    candidateLeft >= minLeft && candidateLeft + width <= offsetLeft + viewportWidth - margin;
  const fitsVertically =
    candidateTop >= minTop && candidateTop + height <= offsetTop + viewportHeight - margin;

  return {
    left,
    top,
    fits: fitsHorizontally && fitsVertically
  };
}

function clamp(value, min, max) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

async function handleSaveUnknownWord() {
  if (!state.currentPayload?.sourceText || !state.currentPayload?.translatedText) {
    return;
  }

  setTooltipActionState({
    saveDisabled: true,
    saveLabel: "Kaydediliyor..."
  });
  setTooltipStatus("Listeye ekleniyor...", "pending");

  try {
    const response = await sendRuntimeMessage({
      type: "SAVE_UNKNOWN_WORD",
      payload: {
        sourceText: state.currentPayload.sourceText,
        translatedText: state.currentPayload.translatedText,
        sourceLang: state.currentPayload.sourceLang || state.settings.sourceLang,
        targetLang: state.settings.targetLang,
        context: state.currentPayload.context,
        details: state.currentPayload.details
      }
    });

    setTooltipActionState({
      saveDisabled: false,
      saveLabel: "Kaydedildi"
    });
    setTooltipStatus(`${response.entry.sourceText} listene eklendi.`, "success", TOOLTIP_STATUS_RESET_MS);
    window.setTimeout(() => {
      if (!state.tooltip || state.currentPayload?.sourceText !== response.entry.sourceText) {
        return;
      }
      setTooltipActionState({
        saveDisabled: false,
        saveLabel: "Listeme kaydet"
      });
    }, TOOLTIP_STATUS_RESET_MS);
  } catch (error) {
    setTooltipActionState({
      saveDisabled: false,
      saveLabel: "Tekrar dene"
    });
    setTooltipStatus("Kaydetme sirasinda bir sorun oldu.", "error", TOOLTIP_STATUS_RESET_MS);
    window.setTimeout(() => {
      if (!state.tooltip) {
        return;
      }
      setTooltipActionState({
        saveDisabled: false,
        saveLabel: "Listeme kaydet"
      });
    }, TOOLTIP_STATUS_RESET_MS);
  }
}

function toggleTooltipPinned() {
  state.tooltipManualPinned = !state.tooltipManualPinned;
  updateTooltipPinState();

  if (state.tooltipManualPinned) {
    pinTooltip(60_000);
    return;
  }

  scheduleHide();
}

function updateTooltipPinState() {
  if (!state.tooltip) {
    return;
  }

  state.tooltip.dataset.manualPinned = state.tooltipManualPinned ? "true" : "false";
  const pinButton = state.tooltip.querySelector("[data-role='pin']");
  if (pinButton) {
    pinButton.textContent = state.tooltipManualPinned ? "Sabit" : "Sabitle";
  }
}

function scheduleHide() {
  clearTimeout(state.hideTimer);
  if (state.tooltipManualPinned) {
    return;
  }

  const remainingPinMs = Math.max(0, state.tooltipPinnedUntil - Date.now());
  const delay = Math.max(TOOLTIP_HIDE_DELAY_MS, remainingPinMs);

  state.hideTimer = window.setTimeout(() => {
    if (state.tooltipPointerInside) {
      scheduleHide();
      return;
    }

    if (Date.now() < state.tooltipPinnedUntil) {
      scheduleHide();
      return;
    }

    hideTooltip(true);
  }, delay);
}

function hideTooltip(resetState) {
  clearTimeout(state.hoverTimer);
  clearTimeout(state.hideTimer);
  clearTimeout(state.selectionTimer);
  clearTooltipPendingTimer();
  clearTooltipStatusTimer();
  if (globalThis.speechSynthesis) {
    globalThis.speechSynthesis.cancel();
  }
  if (state.tooltip) {
    setTooltipVisible(false);
  }

  if (resetState) {
    invalidateTooltipRequests();
    state.currentPayload = null;
    state.lastHoverKey = "";
    state.tooltipPointerInside = false;
    state.tooltipPinnedUntil = 0;
    state.tooltipManualPinned = false;
    updateTooltipPinState();
    resetTouchSelection();
  }
}

function pinTooltip(duration = TOOLTIP_INTERACTION_GRACE_MS) {
  state.tooltipPinnedUntil = Math.max(state.tooltipPinnedUntil, Date.now() + duration);
  clearTimeout(state.hideTimer);
}

function isTooltipPinned() {
  return state.tooltipManualPinned || state.tooltipPointerInside || Date.now() < state.tooltipPinnedUntil;
}

function getSelectionContainer(selection) {
  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  const node = range?.commonAncestorContainer || selection.anchorNode;
  if (!node) {
    return null;
  }

  const element = node.nodeType === Node.TEXT_NODE ? getParentElementCrossRoot(node) : node;
  return element ? findInteractiveTextContainer(element) : null;
}

function isInteractiveSelectionContainer(container, rect) {
  return (
    isLikelySubtitleContainer(container, rect) ||
    isLikelyReadableTextContainer(container, rect)
  );
}

function findSelectionContextContainer(startElement) {
  let element = startElement;
  let fallbackCandidate = null;

  while (element) {
    if (element.matches?.(IGNORE_SELECTOR) || element.closest?.(IGNORE_SELECTOR)) {
      return null;
    }

    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    if (!text) {
      if (element === document.body || element === document.documentElement) {
        break;
      }

      element = getParentElementCrossRoot(element);
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (isInteractiveSelectionContainer(element, rect)) {
      return element;
    }

    if (
      element.matches?.("p, li, blockquote, figcaption, td, h1, h2, h3, h4, article, section, div")
    ) {
      if (text.length <= 900) {
        return element;
      }

      fallbackCandidate = fallbackCandidate || element;
    }

    if (element === document.body || element === document.documentElement) {
      break;
    }

    element = getParentElementCrossRoot(element);
  }

  return fallbackCandidate;
}

function expandToWholeWordSelection(selectedText, contextText) {
  const normalizedSelection = normalizeWhitespace(selectedText);
  const normalizedContext = normalizeWhitespace(contextText);
  if (!normalizedSelection || !normalizedContext) {
    return normalizedSelection;
  }

  const selectionIndex = normalizedContext
    .toLocaleLowerCase("tr")
    .indexOf(normalizedSelection.toLocaleLowerCase("tr"));
  if (selectionIndex < 0) {
    return normalizedSelection;
  }

  let startIndex = selectionIndex;
  let endIndex = selectionIndex + normalizedSelection.length;

  while (startIndex > 0 && isWordBoundaryCharacter(normalizedContext[startIndex - 1])) {
    startIndex -= 1;
  }

  while (endIndex < normalizedContext.length && isWordBoundaryCharacter(normalizedContext[endIndex])) {
    endIndex += 1;
  }

  return normalizeWhitespace(normalizedContext.slice(startIndex, endIndex));
}

function isWordBoundaryCharacter(character) {
  return /[\p{L}\p{M}\d]/u.test(character);
}

function clipContext(value) {
  const normalized = normalizeWhitespace(value);
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      finishReject(new Error("Extension request timed out"));
    }, RUNTIME_MESSAGE_TIMEOUT_MS);
    const finishResolve = (response) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);

      if (!response?.ok) {
        reject(new Error(response?.error || "Extension request failed"));
        return;
      }

      resolve(response);
    };
    const finishReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error(String(error || "Extension request failed")));
    };

    try {
      if (usesPromiseMessagingApi) {
        extensionApi.runtime.sendMessage(message).then(finishResolve).catch(finishReject);
        return;
      }

      const maybePromise = extensionApi.runtime.sendMessage(message, (response) => {
        const runtimeError = extensionApi.runtime.lastError;
        if (runtimeError) {
          finishReject(new Error(runtimeError.message));
          return;
        }

        finishResolve(response);
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(finishResolve).catch(finishReject);
      }
    } catch (error) {
      finishReject(error);
    }
  });
}

function scheduleContextRefresh(force = false) {
  clearTimeout(state.contextRefreshTimer);
  state.contextRefreshTimer = window.setTimeout(() => {
    state.contextRefreshTimer = null;
    refreshPageContext(force);
  }, force ? 0 : CONTEXT_REFRESH_DEBOUNCE_MS);
}

function observeDynamicPageChanges() {
  if (state.contextObserver) {
    return;
  }

  const triggerRefresh = () => scheduleContextRefresh();

  window.addEventListener("popstate", triggerRefresh, true);
  window.addEventListener("hashchange", triggerRefresh, true);
  window.addEventListener("pageshow", triggerRefresh, true);
  document.addEventListener("fullscreenchange", triggerRefresh, true);

  const root = document.documentElement || document.body;
  if (!root) {
    return;
  }

  state.contextObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        if (
          shouldRefreshForNodeList(mutation.addedNodes) ||
          shouldRefreshForNodeList(mutation.removedNodes)
        ) {
          triggerRefresh();
          return;
        }
        continue;
      }

      const target = mutation.target;
      if (!(target instanceof Element) || target.closest(".sht-root")) {
        continue;
      }

      if (shouldRefreshForMutationTarget(target, mutation.attributeName)) {
        triggerRefresh();
        return;
      }
    }
  });

  state.contextObserver.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden", "src", "data-testid"]
  });
}

function shouldRefreshForNodeList(nodes) {
  for (const node of nodes) {
    const element =
      node instanceof Element
        ? node
        : node instanceof Text
          ? getParentElementCrossRoot(node)
          : null;

    if (!element) {
      continue;
    }

    if (element.closest(".sht-root")) {
      continue;
    }

    if (shouldRefreshForMutationTarget(element)) {
      return true;
    }
  }

  return false;
}

function shouldRefreshForMutationTarget(target, attributeName = "") {
  if (target.matches("video")) {
    return true;
  }

  if (
    target.matches(
      "[class*='caption'], [class*='subtitle'], [class*='cue'], [class*='track'], [data-testid*='caption'], [data-testid*='subtitle'], [aria-live='polite'], [aria-live='assertive']"
    )
  ) {
    return true;
  }

  if (attributeName === "src" && target.closest("video")) {
    return true;
  }

  if (target.querySelector("video")) {
    return true;
  }

  return (
    isLikelySubtitleContainer(target) ||
    isLikelyReadableTextContainer(target) ||
    isLooseReadableTextContainer(target) ||
    Boolean(target.closest("video"))
  );
}

function refreshPageContext(force = false) {
  const nextPageContext = detectPageContext();
  const nextRouteKey = buildPageContextKey(nextPageContext);
  const sameUrl = state.currentUrl === location.href;
  const shouldPreservePinnedTooltip =
    sameUrl &&
    Boolean(state.tooltip && !state.tooltip.hidden && state.currentPayload) &&
    isTooltipPinned();

  if (
    !force &&
    state.currentUrl === location.href &&
    state.currentRouteKey === nextRouteKey
  ) {
    return;
  }

  state.currentUrl = location.href;
  state.currentRouteKey = nextRouteKey;
  state.cache.clear();
  state.containerWordCache = new WeakMap();
  state.siteSelectorCache = {
    at: 0,
    candidates: []
  };
  state.fallbackCandidateCache = {
    at: 0,
    candidates: []
  };
  state.activeCueCache = {
    at: 0,
    key: "",
    snapshot: null
  };
  state.ocrCache = {
    at: 0,
    key: "",
    snapshot: null,
    pending: null
  };
  state.pageContext = nextPageContext;
  state.lastPointerSample = null;
  state.subtitleHistory = [];
  state.subtitleHistorySignature = "";
  resetDragSelection();
  resetTouchSelection();

  if (shouldPreservePinnedTooltip) {
    restorePinnedTooltipAfterContextRefresh();
    return;
  }

  hideTooltip(true);
}

function restorePinnedTooltipAfterContextRefresh() {
  if (!state.tooltip || state.tooltip.hidden || !state.currentPayload) {
    return;
  }

  state.tooltip.dataset.surface = resolveTooltipSurface(state.currentPayload.rect);
  updateTooltipPinState();
  pinTooltip(state.tooltipManualPinned ? 300_000 : TOOLTIP_INTERACTION_GRACE_MS);
  positionTooltip(state.currentPayload.rect, state.currentPayload.point);
}

function detectPageContext() {
  const hostname = location.hostname;
  const path = location.pathname || "/";
  const siteProfile = getLocalProfileOverride() || getSiteProfile(hostname);
  const primaryVideoRect = getPrimaryVideoRect();
  const hasVisibleVideo = Boolean(primaryVideoRect);
  const supportedHost = Boolean(siteProfile);
  const pathMatched = siteProfile?.pathPatterns?.length
    ? siteProfile.pathPatterns.some((pattern) => pattern.test(path))
    : true;
  const allowGenericText = hasReadableTextSurface();
  const profileSelectorsMatched = hasProfileSubtitleSelectors(siteProfile);
  const pageMode = hasVisibleVideo || (supportedHost && pathMatched) ? "video" : "web";
  const isVideoPage = Boolean(hasVisibleVideo || (supportedHost && pathMatched));

  return {
    hostname,
    allowGenericText,
    hasVisibleVideo,
    isVideoPage,
    pageMode,
    pathMatched,
    primaryVideoRect: primaryVideoRect ? cloneRect(primaryVideoRect) : null,
    siteProfile,
    supportedHost,
    usingFallback: Boolean(hasVisibleVideo && !profileSelectorsMatched)
  };
}

function serializePageContext(pageContext = state.pageContext) {
  return {
    hostname: pageContext?.hostname || location.hostname,
    allowGenericText: Boolean(pageContext?.allowGenericText),
    isVideoPage: Boolean(pageContext?.isVideoPage),
    hasVisibleVideo: Boolean(pageContext?.hasVisibleVideo),
    pageMode: pageContext?.pageMode || "web",
    supportedHost: Boolean(pageContext?.supportedHost),
    usingFallback: Boolean(pageContext?.usingFallback),
    siteId: pageContext?.siteProfile?.id || "",
    siteLabel: pageContext?.siteProfile?.label || ""
  };
}

function buildPageContextKey(pageContext) {
  const videoRect = pageContext?.primaryVideoRect;
  const roundedVideoRect = videoRect
    ? [
        Math.round(videoRect.left / 20),
        Math.round(videoRect.top / 20),
        Math.round(videoRect.width / 20),
        Math.round(videoRect.height / 20)
      ].join(":")
    : "none";

  return [
    location.href,
    pageContext?.siteProfile?.id || "",
    pageContext?.pageMode || "web",
    Number(pageContext?.allowGenericText),
    Number(pageContext?.hasVisibleVideo),
    Number(pageContext?.usingFallback),
    roundedVideoRect
  ].join("|");
}

function hasProfileSubtitleSelectors(siteProfile) {
  if (!siteProfile?.subtitleSelectors?.length) {
    return false;
  }

  return siteProfile.subtitleSelectors.some((selector) => {
    try {
      return querySelectorAllDeep(selector).some((element) =>
        isVisibleCandidate(element)
      );
    } catch (error) {
      return false;
    }
  });
}

function hasReadableTextSurface() {
  if (!document.body) {
    return false;
  }

  const candidates = [];
  const seen = new Set();
  const searchRoots = getReadableSearchRoots();
  const selector = "p, span, li, blockquote, figcaption, td, h1, h2, h3, h4, div, a";

  for (const root of searchRoots) {
    for (const element of querySelectorAllDeep(selector, root)) {
      if (seen.has(element)) {
        continue;
      }

      seen.add(element);
      candidates.push(element);
    }
  }

  let inspected = 0;

  for (const element of candidates) {
    if (inspected >= 180) {
      break;
    }

    const rect = element.getBoundingClientRect();
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.width < 24 ||
      rect.height < 12 ||
      element.matches?.(IGNORE_SELECTOR) ||
      element.closest?.(IGNORE_SELECTOR) ||
      isLikelyChromeUiElement(element)
    ) {
      continue;
    }

    inspected += 1;
    if (
      isLikelyReadableTextContainer(element, rect) ||
      isLooseReadableTextContainer(
        element,
        rect,
        normalizeWhitespace(element.innerText || element.textContent || "")
      )
    ) {
      return true;
    }
  }

  return false;
}

function getReadableSearchRoots() {
  const selector =
    "main, article, [role='main'], .main-content, .main-content-area, .content, .content-area, .article, .article-body";
  const roots = querySelectorAllDeep(selector)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 120 && rect.height > 40;
    })
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
    });

  return roots.length ? roots.slice(0, 6) : [document.body];
}

function getSiteProfile(hostname) {
  return (
    VIDEO_SITE_PROFILES.find((profile) =>
      profile.hostPatterns.some((pattern) => pattern.test(hostname))
    ) || null
  );
}

function getLocalProfileOverride() {
  if (!LOCAL_HOSTS.has(location.hostname)) {
    return null;
  }

  const profileId = new URLSearchParams(location.search).get("shtSite");
  if (!profileId) {
    return null;
  }

  return VIDEO_SITE_PROFILES.find((profile) => profile.id === profileId) || null;
}

function getCefrDescription(level) {
  const descriptions = {
    A1: "Başlangıç – En temel kelimeler",
    A2: "Temel – Günlük konuşma kelimeleri",
    B1: "Orta – İş ve eğitim kelimeleri",
    B2: "Orta-İleri – Akademik kelimeler",
    C1: "İleri – Nadir ve sofistike kelimeler",
    C2: "Uzman – Çok nadir kelimeler"
  };
  return descriptions[level] || level;
}
