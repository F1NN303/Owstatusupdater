(function () {
  function defaultIsMobileSheet() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    if (viewportWidth > 0 && viewportWidth <= 1024) {
      return true;
    }
    const compactViewport = window.matchMedia("(max-width: 1024px)").matches;
    const touchViewport = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    return compactViewport || touchViewport;
  }

  function formatVersionDate(date) {
    const locale = document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith("de")
      ? "de-DE"
      : "en-US";
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function hydrateVersionInfo() {
    const nodes = Array.from(document.querySelectorAll("[data-version-info]"));
    if (!nodes.length) {
      return;
    }
    const versionUrl =
      (document.body && document.body.dataset && document.body.dataset.versionUrl) || "./data/status.json";
    let label = "";
    try {
      const response = await fetch(versionUrl, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const raw = payload && (payload.generated_at || payload.generatedAt || payload.updated_at);
        const parsed = raw ? new Date(raw) : null;
        if (parsed && !Number.isNaN(parsed.getTime())) {
          label = `Version: ${formatVersionDate(parsed)}`;
        }
      }
    } catch (error) {
      // keep fallback below
    }
    if (!label) {
      const parsed = document.lastModified ? new Date(document.lastModified) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        label = `Version: ${formatVersionDate(parsed)}`;
      } else {
        label = "Version: unknown";
      }
    }
    for (const node of nodes) {
      node.textContent = label;
    }
  }

  function setupVersionInfo() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        hydrateVersionInfo();
      }, { once: true });
      return;
    }
    hydrateVersionInfo();
  }

  function getFocusable(panel) {
    return Array.from(
      panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((node) => node instanceof HTMLElement && !node.hidden);
  }

  function createTopNavMenu(options = {}) {
    const trigger = options.trigger;
    const panel = options.panel;
    if (!(trigger instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
      return null;
    }
    const closeButton = options.closeButton instanceof HTMLElement ? options.closeButton : null;
    const isMobileSheet = typeof options.isMobileSheet === "function" ? options.isMobileSheet : defaultIsMobileSheet;
    const onBeforeOpen = typeof options.onBeforeOpen === "function" ? options.onBeforeOpen : null;
    const onAfterClose = typeof options.onAfterClose === "function" ? options.onAfterClose : null;
    const closeOnScrollDesktop = options.closeOnScrollDesktop !== false;
    const shell = trigger.closest(".menu-shell");
    let menuMode = "dropdown";

    const getSheetCard = () => {
      const card = panel.querySelector(".menu-sheet-card");
      return card instanceof HTMLElement ? card : null;
    };

    const getSheetHead = () => {
      const head = panel.querySelector(".menu-sheet-head");
      return head instanceof HTMLElement ? head : null;
    };

    const resetSheetScroll = () => {
      panel.scrollTop = 0;
      const card = getSheetCard();
      if (card) {
        card.scrollTop = 0;
      }
    };

    const forceSheetTop = () => {
      resetSheetScroll();
      window.requestAnimationFrame(() => {
        resetSheetScroll();
        window.requestAnimationFrame(() => {
          resetSheetScroll();
          const head = getSheetHead();
          if (head) {
            head.scrollIntoView({ block: "start", inline: "nearest" });
          }
        });
      });
    };

    const syncMode = () => {
      if (!document.body) {
        return menuMode;
      }
      menuMode = isMobileSheet() ? "sheet" : "dropdown";
      document.body.dataset.menuMode = menuMode;
      return menuMode;
    };

    const lockScroll = () => {
      if (!document.body || !document.documentElement) {
        return;
      }
      if (document.body.classList.contains("menu-open")) {
        return;
      }
      document.documentElement.classList.add("menu-open");
      document.body.classList.add("menu-open");
    };

    const unlockScroll = () => {
      if (!document.body || !document.documentElement) {
        return;
      }
      document.documentElement.classList.remove("menu-open");
      document.body.classList.remove("menu-open");
    };

    const setOpenState = (isOpen) => {
      if (!document.body) {
        return;
      }
      if (isOpen && menuMode === "sheet") {
        document.body.dataset.menuOpen = "true";
        lockScroll();
        return;
      }
      document.body.dataset.menuOpen = "false";
      unlockScroll();
    };

    const isOpen = () => trigger.getAttribute("aria-expanded") === "true";

    const resetState = () => {
      trigger.setAttribute("aria-expanded", "false");
      panel.classList.remove("is-open");
      panel.hidden = true;
      if (shell instanceof HTMLElement) {
        shell.classList.remove("is-open");
      }
      setOpenState(false);
      resetSheetScroll();
    };

    const close = (focusTrigger = false) => {
      syncMode();
      resetState();
      if (focusTrigger) {
        trigger.focus();
      }
      if (onAfterClose) {
        onAfterClose({
          menuMode,
          trigger,
          panel,
        });
      }
    };

    const open = () => {
      syncMode();
      if (onBeforeOpen) {
        onBeforeOpen({
          menuMode,
          trigger,
          panel,
        });
      }
      trigger.setAttribute("aria-expanded", "true");
      panel.hidden = false;
      panel.classList.add("is-open");
      if (shell instanceof HTMLElement) {
        shell.classList.add("is-open");
      }
      setOpenState(true);
      forceSheetTop();
      window.requestAnimationFrame(() => {
        if (!isOpen()) {
          return;
        }
        if (menuMode === "sheet") {
          if (closeButton) {
            closeButton.focus();
            return;
          }
          const focusables = getFocusable(panel);
          if (focusables.length) {
            focusables[0].focus();
          }
        }
      });
      window.setTimeout(() => {
        if (isOpen()) {
          forceSheetTop();
        }
      }, 120);
      window.setTimeout(() => {
        if (!isOpen()) {
          return;
        }
        const head = getSheetHead();
        if (head) {
          head.scrollIntoView({ block: "start", inline: "nearest" });
          return;
        }
        forceSheetTop();
      }, 260);
    };

    trigger.addEventListener("click", () => {
      if (isOpen()) {
        close(false);
        return;
      }
      open();
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!panel.hidden && !panel.contains(target) && !trigger.contains(target)) {
        close(false);
      }
    });

    panel.addEventListener("click", (event) => {
      if (menuMode !== "sheet") {
        return;
      }
      if (event.target === panel) {
        close(false);
      }
    });

    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!panel.hidden && !panel.contains(target) && !trigger.contains(target)) {
        close(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close(true);
        return;
      }
      if (event.key === "Tab" && !panel.hidden && menuMode === "sheet") {
        const focusables = getFocusable(panel);
        if (!focusables.length) {
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    for (const link of Array.from(panel.querySelectorAll("a"))) {
      link.addEventListener("click", () => close(false));
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => close(true));
    }

    const handleViewportChange = () => {
      const previousMode = menuMode;
      syncMode();
      if (previousMode !== menuMode) {
        close(false);
      }
      if (menuMode !== "sheet") {
        setOpenState(false);
      }
    };

    window.addEventListener("resize", handleViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
    }
    window.addEventListener("orientationchange", handleViewportChange);
    window.addEventListener("hashchange", () => close(false));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        resetState();
      }
    });
    window.addEventListener("pageshow", () => {
      syncMode();
      resetState();
    });
    window.addEventListener("pagehide", resetState);

    if (closeOnScrollDesktop) {
      window.addEventListener(
        "scroll",
        () => {
          if (isOpen() && menuMode !== "sheet") {
            close(false);
          }
        },
        { passive: true }
      );
    }

    syncMode();
    resetState();

    return {
      close,
      open,
      reset: resetState,
      syncMode,
      isOpen,
      getMode: () => menuMode,
    };
  }

  window.OwMenu = {
    createTopNavMenu,
  };
  setupVersionInfo();
})();
