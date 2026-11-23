import { addInlineControls } from "./mermaid-inline-controls.js";

(() => {
  // PJAX history restores HTML without its listeners. Track rendered nodes in memory.
  const renderedDiagrams = new WeakSet();
  const renderingDiagrams = new WeakSet();

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
        renderedDiagrams.has(diagram) ||
        renderingDiagrams.has(diagram)
      )
        continue;
      renderingDiagrams.add(diagram);
      delete diagram.dataset.mermaidRendered;
      try {
        const { svg, bindFunctions } = await mermaid.render(
          `${diagram.id}-svg`,
          decodeSource(diagram),
        );
        if (!diagram.isConnected) continue;
        diagram.innerHTML = svg;
        diagram.dataset.mermaidRendered = "true";
        diagram.classList.remove("mermaid-error");
        const wrapper = diagram.parentElement.classList.contains(
          "mermaid-frame",
        )
          ? diagram.parentElement
          : document.createElement("div");
        if (wrapper !== diagram.parentElement) {
          wrapper.className = "mermaid-frame";
          diagram.replaceWith(wrapper);
          wrapper.appendChild(diagram);
        }
        wrapper.querySelector(".mermaid-expand")?.remove();
        const expandButton = document.createElement("button");
        expandButton.type = "button";
        expandButton.className = "mermaid-expand";
        expandButton.setAttribute("aria-label", "Expand interactive diagram");
        expandButton.title = "Expand diagram";
        expandButton.textContent = "⛶";
        expandButton.addEventListener("click", () => openViewer(diagram));
        wrapper.appendChild(expandButton);
        addInlineControls(diagram);
        bindFunctions?.(diagram);
        renderedDiagrams.add(diagram);
      } catch (error) {
        diagram.textContent = decodeSource(diagram);
        delete diagram.dataset.mermaidRendered;
        if (diagram.parentElement?.classList.contains("mermaid-frame")) {
          diagram.parentElement.querySelector(".mermaid-expand")?.remove();
          diagram.parentElement
            .querySelector(".mermaid-inline-controls")
            ?.remove();
        }
        diagram.classList.add("mermaid-error");
        console.error("Mermaid rendering failed", error);
      } finally {
        renderingDiagrams.delete(diagram);
      }
    }
  };

  let modal;
  let panZoom;
  let previousFocus;
  let returnFocusOnClose = true;
  let viewerLoading;

  const loadPanZoom = () => {
    if (window.svgPanZoom) return Promise.resolve(window.svgPanZoom);
    if (viewerLoading) return viewerLoading;
    viewerLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${window.kr.siteRoot}vendors/svg-pan-zoom@3.6.2/dist/svg-pan-zoom.min.js`;
      script.onload = () => resolve(window.svgPanZoom);
      script.onerror = () => {
        viewerLoading = null;
        reject(new Error("Unable to load SVG pan/zoom"));
      };
      document.head.appendChild(script);
    });
    return viewerLoading;
  };

  const closeViewer = () => {
    if (!modal) return;
    panZoom?.destroy();
    panZoom = null;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mermaid-viewer-open");
    if (returnFocusOnClose) previousFocus?.focus();
    returnFocusOnClose = true;
  };

  const resetViewer = () => {
    if (!panZoom) return;
    panZoom.resize();
    panZoom.fit();
    panZoom.center();
    panZoom.zoom(0.875);
  };

  const openViewer = async (diagram) => {
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
            <button type="button" data-action="reset">Fit to view</button>
            <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" data-action="close" aria-label="Close diagram">×</button>
          </div>
          <div class="mermaid-viewer-canvas"><div class="mermaid-viewer-content"></div></div>
        </div>`;
      document.body.appendChild(modal);
      modal
        .querySelector('[data-action="close"]')
        .addEventListener("click", closeViewer);
      modal
        .querySelector(".mermaid-viewer-backdrop")
        .addEventListener("click", closeViewer);
      modal
        .querySelector('[data-action="zoom-in"]')
        .addEventListener("click", () => panZoom?.zoomIn());
      modal
        .querySelector('[data-action="zoom-out"]')
        .addEventListener("click", () => panZoom?.zoomOut());
      modal
        .querySelector('[data-action="reset"]')
        .addEventListener("click", resetViewer);
    }

    const svgPanZoom = await loadPanZoom();
    const viewport = modal.querySelector(".mermaid-viewer-content");
    viewport.replaceChildren(diagram.querySelector("svg").cloneNode(true));
    const svg = viewport.querySelector("svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.removeAttribute("style");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    previousFocus = document.activeElement;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("mermaid-viewer-open");
    modal.querySelector('[data-action="close"]').focus();
    panZoom?.destroy();
    panZoom = svgPanZoom(svg, {
      fit: true,
      center: true,
      minZoom: 0.2,
      maxZoom: 12,
      zoomScaleSensitivity: 0.2,
      dblClickZoomEnabled: false,
      controlIconsEnabled: false,
      panEnabled: true,
      zoomEnabled: true,
    });
    resetViewer();
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
        event.target.matches(".mermaid-expand")
      ) {
        event.preventDefault();
        openViewer(event.target.parentElement.querySelector("pre.mermaid"));
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
        renderedDiagrams.delete(diagram);
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
