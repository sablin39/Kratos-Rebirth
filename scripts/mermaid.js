"use strict";

const { escapeHTML } = require("hexo-util");

const mermaidFence =
  /^([ \t]{0,3})(`{3,}|~{3,})[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\2[ \t]*(?=\r?$)/gim;
let nextDiagramId = 0;

hexo.extend.filter.register(
  "before_post_render",
  (data) => {
    if (typeof data.content !== "string") return;
    data.content = data.content.replace(
      mermaidFence,
      (_, indent, fence, source) => {
        const id = `mermaid-source-${nextDiagramId++}`;
        const encodedSource = Buffer.from(source, "utf8").toString("base64");
        return `${indent}<pre id="${id}" class="mermaid" data-mermaid-source="${encodedSource}">${escapeHTML(source)}</pre>`;
      },
    );
  },
  8,
);
