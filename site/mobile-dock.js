"use strict";

function emitLiquidGlassGesture(channel, phase, payload = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent("liquid-glass-gesture", {
        detail: {
          channel,
          phase,
          x: Number.isFinite(payload.x) ? payload.x : null,
          y: Number.isFinite(payload.y) ? payload.y : null,
          velocityX: Number.isFinite(payload.velocityX) ? payload.velocityX : 0,
          velocityY: Number.isFinite(payload.velocityY) ? payload.velocityY : 0,
          strength: Number.isFinite(payload.strength) ? payload.strength : 0,
        },
      })
    );
  } catch (_error) {
    // Gesture bridge is optional; ignore unsupported environments.
  }
}

function normalizePath(path) {
  try {
    const parsed = new URL(path, window.location.href);
    return parsed.pathname.replace(/\/+$/, "");
  } catch (_error) {
    return String(path || "").replace(/\/+$/, "");
  }
}

function setSlidingIndicator(trackEl, indicatorEl, activeEl) {
  if (!trackEl || !indicatorEl || !activeEl) {
    return;
  }
  const trackRect = trackEl.getBoundingClientRect();
  const activeRect = activeEl.getBoundingClientRect();
  if (!trackRect.width || !activeRect.width) {
    return;
  }
  const x = Math.max(0, activeRect.left - trackRect.left);
  const y = Math.max(0, activeRect.top - trackRect.top);
  indicatorEl.style.width = `${activeRect.width}px`;
  indicatorEl.style.height = `${activeRect.height}px`;
  indicatorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function getClosestElementByClientX(elements, clientX) {
  if (!elements.length) {
    return null;
  }
  let best = elements[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const distance = Math.abs(center - clientX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = element;
    }
  }
  return best;
}

function initMobileDock() {
  const dock = document.getElementById("mobileDock");
  if (!dock) {
    return;
  }
  const indicator = document.getElementById("mobileDockIndicator");
  const links = Array.from(dock.querySelectorAll(".mobile-dock-link"));
  if (!links.length) {
    return;
  }

  const currentPath = normalizePath(window.location.pathname);
  let activeLink =
    links.find((link) => link.getAttribute("aria-current") === "page") ||
    links.find((link) => normalizePath(link.getAttribute("href")) === currentPath) ||
    links[0];

  const syncDockState = () => {
    for (const link of links) {
      const isActive = link === activeLink;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  syncDockState();

  for (const link of links) {
    link.addEventListener("click", () => {
      activeLink = link;
      syncDockState();
      window.requestAnimationFrame(() => {
        setSlidingIndicator(dock, indicator, activeLink);
      });
    });
  }

  let touchPreviewActive = false;
  let previewLink = null;
  let dockTouchPrevX = 0;
  let dockTouchPrevY = 0;
  let dockTouchPrevTs = 0;
  const clearDockPreview = () => {
    touchPreviewActive = false;
    previewLink = null;
    emitLiquidGlassGesture("dock", "end", { strength: 0.7 });
    window.requestAnimationFrame(() => {
      setSlidingIndicator(dock, indicator, activeLink);
    });
  };

  dock.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) {
        touchPreviewActive = false;
        return;
      }
      touchPreviewActive = true;
      const touch = event.touches[0];
      dockTouchPrevX = touch.clientX;
      dockTouchPrevY = touch.clientY;
      dockTouchPrevTs = performance.now();
      previewLink = getClosestElementByClientX(links, touch.clientX) || activeLink;
      if (previewLink) {
        setSlidingIndicator(dock, indicator, previewLink);
      }
      emitLiquidGlassGesture("dock", "start", {
        x: touch.clientX,
        y: touch.clientY,
        strength: 1,
      });
    },
    { passive: true }
  );

  dock.addEventListener(
    "touchmove",
    (event) => {
      if (!touchPreviewActive || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      const now = performance.now();
      const dt = Math.max(8, now - dockTouchPrevTs);
      const velocityX = (touch.clientX - dockTouchPrevX) / dt;
      const velocityY = (touch.clientY - dockTouchPrevY) / dt;
      dockTouchPrevX = touch.clientX;
      dockTouchPrevY = touch.clientY;
      dockTouchPrevTs = now;
      const nextPreview = getClosestElementByClientX(links, touch.clientX);
      emitLiquidGlassGesture("dock", "move", {
        x: touch.clientX,
        y: touch.clientY,
        velocityX,
        velocityY,
        strength: 1,
      });
      if (!nextPreview || nextPreview === previewLink) {
        return;
      }
      previewLink = nextPreview;
      setSlidingIndicator(dock, indicator, previewLink);
    },
    { passive: true }
  );

  dock.addEventListener("touchend", clearDockPreview, { passive: true });
  dock.addEventListener("touchcancel", clearDockPreview, { passive: true });

  const update = () => setSlidingIndicator(dock, indicator, activeLink);
  window.requestAnimationFrame(update);
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
}

function isInteractiveTarget(node) {
  if (!(node instanceof Element)) {
    return false;
  }
  return Boolean(
    node.closest(
      "a,button,input,select,textarea,summary,label,[role='button'],[role='link'],[role='switch']"
    )
  );
}

function initSwipeTabs() {
  const tabNav = document.getElementById("tabNav");
  if (!tabNav) {
    return;
  }
  const buttons = Array.from(tabNav.querySelectorAll("[data-tab-target]"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
  if (buttons.length < 2 || !panels.length) {
    return;
  }

  let indicator = tabNav.querySelector(".tab-liquid-indicator");
  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "tab-liquid-indicator";
    indicator.setAttribute("aria-hidden", "true");
    tabNav.insertBefore(indicator, tabNav.firstChild);
  }

  const getActiveButton = () =>
    buttons.find((button) => button.classList.contains("active")) ||
    buttons.find((button) => button.getAttribute("aria-selected") === "true") ||
    buttons[0];

  const updateTabIndicator = () => {
    const activeButton = getActiveButton();
    if (!activeButton) {
      return;
    }
    setSlidingIndicator(tabNav, indicator, activeButton);
  };

  const observer = new MutationObserver(() => updateTabIndicator());
  for (const button of buttons) {
    observer.observe(button, {
      attributes: true,
      attributeFilter: ["class", "aria-selected"],
    });
    button.addEventListener("click", () => {
      window.requestAnimationFrame(updateTabIndicator);
    });
  }

  window.requestAnimationFrame(updateTabIndicator);
  window.addEventListener("resize", updateTabIndicator);
  window.addEventListener("orientationchange", updateTabIndicator);

  let dragActive = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragPreviewButton = null;
  const MIN_DRAG_X = 14;
  let tabTouchPrevX = 0;
  let tabTouchPrevY = 0;
  let tabTouchPrevTs = 0;

  const resetTabDrag = () => {
    dragActive = false;
    dragMoved = false;
    dragPreviewButton = null;
    emitLiquidGlassGesture("tab", "end", { strength: 0.7 });
    window.requestAnimationFrame(updateTabIndicator);
  };

  tabNav.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) {
        dragActive = false;
        return;
      }
      const touch = event.touches[0];
      dragActive = true;
      dragMoved = false;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      tabTouchPrevX = touch.clientX;
      tabTouchPrevY = touch.clientY;
      tabTouchPrevTs = performance.now();
      dragPreviewButton = getClosestElementByClientX(buttons, touch.clientX) || getActiveButton();
      emitLiquidGlassGesture("tab", "start", {
        x: touch.clientX,
        y: touch.clientY,
        strength: 1,
      });
    },
    { passive: true }
  );

  tabNav.addEventListener(
    "touchmove",
    (event) => {
      if (!dragActive || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      const now = performance.now();
      const dt = Math.max(8, now - tabTouchPrevTs);
      const velocityX = (touch.clientX - tabTouchPrevX) / dt;
      const velocityY = (touch.clientY - tabTouchPrevY) / dt;
      tabTouchPrevX = touch.clientX;
      tabTouchPrevY = touch.clientY;
      tabTouchPrevTs = now;
      const dx = touch.clientX - dragStartX;
      const dy = touch.clientY - dragStartY;
      emitLiquidGlassGesture("tab", "move", {
        x: touch.clientX,
        y: touch.clientY,
        velocityX,
        velocityY,
        strength: 1,
      });
      if (Math.abs(dx) < MIN_DRAG_X || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      dragMoved = true;
      const candidate = getClosestElementByClientX(buttons, touch.clientX);
      if (!candidate || candidate === dragPreviewButton) {
        return;
      }
      dragPreviewButton = candidate;
      setSlidingIndicator(tabNav, indicator, dragPreviewButton);
    },
    { passive: true }
  );

  tabNav.addEventListener(
    "touchend",
    () => {
      if (!dragActive) {
        return;
      }
      const activeButton = getActiveButton();
      if (dragMoved && dragPreviewButton && dragPreviewButton !== activeButton) {
        dragPreviewButton.click();
      }
      resetTabDrag();
    },
    { passive: true }
  );

  tabNav.addEventListener("touchcancel", resetTabDrag, { passive: true });

  const SWIPE_X = 52;
  const SWIPE_Y = 38;
  const SWIPE_MS = 680;
  let startX = 0;
  let startY = 0;
  let startTs = 0;
  let allowSwipe = false;

  for (const panel of panels) {
    panel.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          allowSwipe = false;
          return;
        }
        if (isInteractiveTarget(event.target)) {
          allowSwipe = false;
          return;
        }
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTs = Date.now();
        allowSwipe = true;
      },
      { passive: true }
    );

    panel.addEventListener(
      "touchend",
      (event) => {
        if (!allowSwipe || event.changedTouches.length !== 1) {
          allowSwipe = false;
          return;
        }
        const elapsed = Date.now() - startTs;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        allowSwipe = false;
        if (elapsed > SWIPE_MS || Math.abs(dx) < SWIPE_X || Math.abs(dy) > SWIPE_Y) {
          return;
        }

        const activeButton = getActiveButton();
        const activeIndex = buttons.findIndex((button) => button === activeButton);
        if (activeIndex < 0) {
          return;
        }
        if (dx < 0 && activeIndex < buttons.length - 1) {
          buttons[activeIndex + 1].click();
        } else if (dx > 0 && activeIndex > 0) {
          buttons[activeIndex - 1].click();
        }
      },
      { passive: true }
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileDock();
  initSwipeTabs();
});
