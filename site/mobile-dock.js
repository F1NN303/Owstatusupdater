"use strict";

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

  for (const link of links) {
    const isActive = link === activeLink;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
    link.addEventListener("click", () => {
      activeLink = link;
      window.requestAnimationFrame(() => {
        setSlidingIndicator(dock, indicator, activeLink);
      });
    });
  }

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
