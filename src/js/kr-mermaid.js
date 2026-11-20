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
        bindFunctions?.(diagram);
      } catch (error) {
        diagram.classList.add("mermaid-error");
        console.error("Mermaid rendering failed", error);
      } finally {
        delete diagram.dataset.mermaidRendering;
      }
    }
  };

  window.krRenderMermaid = () =>
    renderDiagrams().catch((error) => console.error(error));

  const initialize = () => {
    window.krRenderMermaid();
    window.addEventListener("pjax:complete", window.krRenderMermaid);
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
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
