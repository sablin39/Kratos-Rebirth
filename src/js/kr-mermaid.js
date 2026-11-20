(() => {
  const decodeSource = (element) => {
    const bytes = Uint8Array.from(
      atob(element.dataset.mermaidSource),
      (character) => character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  };

  const loadMermaid = () => {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (window.krMermaidLoading) return window.krMermaidLoading;

    window.krMermaidLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${window.kr.siteRoot}vendors/mermaid@11.17.2/dist/mermaid.min.js`;
      script.onload = async () => {
        try {
          const { default: zenuml } = await import(window.kr.mermaidZenumlUrl);
          await window.mermaid.registerExternalDiagrams([zenuml]);
          resolve(window.mermaid);
        } catch (error) {
          window.krMermaidLoading = null;
          reject(error);
        }
      };
      script.onerror = () => {
        window.krMermaidLoading = null;
        reject(new Error("Unable to load Mermaid"));
      };
      document.head.appendChild(script);
    });
    return window.krMermaidLoading;
  };

  const renderDiagrams = async () => {
    const diagrams = Array.from(
      document.querySelectorAll("pre.mermaid[data-mermaid-source]"),
    );
    if (!diagrams.length) return;

    const mermaid = await loadMermaid();
    mermaid.initialize({
      fontFamily: "inherit",
      ...window.kr.mermaidOptions,
      startOnLoad: false,
      theme:
        window.kr.mermaidOptions?.theme ||
        (document.documentElement.dataset.theme === "dark"
          ? "dark"
          : "default"),
    });

    for (const diagram of diagrams) {
      if (
        !diagram.isConnected ||
        diagram.dataset.mermaidRendered ||
        diagram.dataset.mermaidRendering
      )
        continue;
      diagram.dataset.mermaidRendering = "true";
      try {
        const { svg, bindFunctions } = await mermaid.render(
          `${diagram.id}-svg`,
          decodeSource(diagram),
        );
        if (!diagram.isConnected) continue;
        diagram.innerHTML = svg;
        diagram.dataset.mermaidRendered = "true";
        diagram.classList.remove("mermaid-error");
        diagram.tabIndex = 0;
        diagram.setAttribute("role", "button");
        diagram.setAttribute("aria-label", "Expand interactive diagram");
        diagram.title = "Click to expand";
        bindFunctions?.(diagram);
      } catch (error) {
        diagram.classList.add("mermaid-error");
        console.error("Mermaid rendering failed", error);
      } finally {
        delete diagram.dataset.mermaidRendering;
      }
    }
  };

  let modal;
  let viewport;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let previousFocus;
  let returnFocusOnClose = true;

  const updateTransform = () => {
    if (viewport)
      viewport.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`;
  };

  const closeViewer = () => {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mermaid-viewer-open");
    if (returnFocusOnClose) previousFocus?.focus();
    returnFocusOnClose = true;
  };

  const openViewer = (diagram) => {
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "mermaid-viewer";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Interactive diagram");
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <div class="mermaid-viewer-backdrop"></div>
        <div class="mermaid-viewer-dialog">
          <div class="mermaid-viewer-toolbar">
            <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
            <button type="button" data-action="reset">Reset</button>
            <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" data-action="close" aria-label="Close diagram">×</button>
          </div>
          <div class="mermaid-viewer-canvas"><div class="mermaid-viewer-content"></div></div>
        </div>`;
      document.body.appendChild(modal);
      viewport = modal.querySelector(".mermaid-viewer-content");
      modal
        .querySelector('[data-action="close"]')
        .addEventListener("click", closeViewer);
      modal
        .querySelector(".mermaid-viewer-backdrop")
        .addEventListener("click", closeViewer);
      modal
        .querySelector('[data-action="zoom-in"]')
        .addEventListener("click", () => {
          scale = Math.min(scale * 1.25, 5);
          updateTransform();
        });
      modal
        .querySelector('[data-action="zoom-out"]')
        .addEventListener("click", () => {
          scale = Math.max(scale / 1.25, 0.25);
          updateTransform();
        });
      modal
        .querySelector('[data-action="reset"]')
        .addEventListener("click", () => {
          scale = 1;
          offsetX = 0;
          offsetY = 0;
          updateTransform();
        });

      let drag = null;
      const canvas = modal.querySelector(".mermaid-viewer-canvas");
      canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        drag = { x: event.clientX - offsetX, y: event.clientY - offsetY };
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("dragging");
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!drag) return;
        offsetX = event.clientX - drag.x;
        offsetY = event.clientY - drag.y;
        updateTransform();
      });
      const stopDragging = () => {
        drag = null;
        canvas.classList.remove("dragging");
      };
      canvas.addEventListener("pointerup", stopDragging);
      canvas.addEventListener("pointercancel", stopDragging);
      canvas.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          scale = Math.max(
            0.25,
            Math.min(5, scale * (event.deltaY < 0 ? 1.1 : 0.9)),
          );
          updateTransform();
        },
        { passive: false },
      );
    }

    viewport.innerHTML = diagram.innerHTML;
    const svg = viewport.querySelector("svg");
    if (svg) {
      svg.removeAttribute("height");
      svg.style.maxWidth = "none";
      svg.style.width = `${Number.parseFloat(svg.getAttribute("viewBox")?.split(" ")[2]) || 800}px`;
    }
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
    previousFocus = document.activeElement;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("mermaid-viewer-open");
    modal.querySelector('[data-action="close"]').focus();
  };

  window.krRenderMermaid = () =>
    renderDiagrams().catch((error) => console.error(error));

  const initialize = () => {
    window.krRenderMermaid();
    window.addEventListener("pjax:complete", () => {
      returnFocusOnClose = false;
      closeViewer();
      window.krRenderMermaid();
    });
    document.addEventListener("click", (event) => {
      const diagram = event.target.closest(
        "pre.mermaid[data-mermaid-rendered]",
      );
      if (diagram) openViewer(diagram);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "Tab" && modal?.classList.contains("active")) {
        const controls = Array.from(modal.querySelectorAll("button"));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (
        (event.key === "Enter" || event.key === " ") &&
        event.target.matches("pre.mermaid[data-mermaid-rendered]")
      ) {
        event.preventDefault();
        openViewer(event.target);
      }
    });
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      returnFocusOnClose = false;
      closeViewer();
      for (const diagram of document.querySelectorAll(
        "pre.mermaid[data-mermaid-source]",
      )) {
        diagram.textContent = decodeSource(diagram);
        delete diagram.dataset.mermaidRendered;
      }
      window.krRenderMermaid();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
