/*!
  标签小组件文件
  Created by [Candinya](https://candinya.com)
  Created for [Kratos-Rebirth](https://github.com/Candinya/Kratos-Rebirth)
*/

const alertIconMap = {
  primary: "refresh",
  success: "check",
  danger: "exclamation",
  info: "info",
  warning: "warning",
};

const widgets = new Map();
let nextWidgetId = 0;

const renderWidgetMarkdown = (widget, content) =>
  hexo.post.render(widget.source, {
    content,
    engine: "markdown",
    markdown: { breaks: false },
  });

const renderInlineText = async (widget, text) => {
  if (!text) return "";
  const html = (await renderWidgetMarkdown(widget, text)).trim();
  const paragraph = html.match(/^<p>([\s\S]*)<\/p>$/);
  return paragraph ? paragraph[1] : html;
};

const splitType = (args) => {
  const match = args.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return match ? [match[1], match[2] || ""] : ["", ""];
};

hexo.extend.filter.register(
  "before_post_render",
  (data) => {
    if (typeof data.content !== "string") return;
    const tagPattern =
      /{%\s*(alertbar|blur|alertpanel|collapse|endalertpanel|endcollapse)\b([\s\S]*?)%}/g;
    const blocks = [];
    let match;

    while ((match = tagPattern.exec(data.content))) {
      const [source, name, rawArguments] = match;
      if (name === "alertpanel" || name === "collapse") {
        blocks.push({
          name,
          rawArguments,
          start: match.index,
          bodyStart: tagPattern.lastIndex,
        });
        continue;
      }
      if (name === "endalertpanel" || name === "endcollapse") {
        const opening = blocks.at(-1);
        if (!opening || `end${opening.name}` !== name) continue;
        blocks.pop();
        const widget = {
          name: opening.name,
          arguments: opening.rawArguments.trim(),
          content: data.content.slice(opening.bodyStart, match.index),
          source: data.full_source,
        };
        const placeholder = `{% kratos_widget ${nextWidgetId} %}`;
        widgets.set(nextWidgetId++, widget);
        data.content =
          data.content.slice(0, opening.start) +
          placeholder +
          data.content.slice(tagPattern.lastIndex);
        tagPattern.lastIndex = opening.start + placeholder.length;
        continue;
      }

      widgets.set(nextWidgetId, {
        name,
        arguments: rawArguments.trim(),
        content: "",
        source: data.full_source,
      });
      const placeholder = `{% kratos_widget ${nextWidgetId++} %}`;
      data.content =
        data.content.slice(0, match.index) +
        placeholder +
        data.content.slice(tagPattern.lastIndex);
      tagPattern.lastIndex = match.index + placeholder.length;
    }
  },
  8,
);

hexo.extend.tag.register(
  "kratos_widget",
  async (args) => {
    const widget = widgets.get(Number(args[0]));
    if (!widget) return "";

    if (widget.name === "alertbar") {
      const [type, text] = splitType(widget.arguments);
      return `<div class="alert alert-${type}">
  <div class="icon"><i class="fa fa-${alertIconMap[type]}"></i></div>
  <div class="text">
  ${await renderWidgetMarkdown(widget, text)}
  </div>
  </div>`;
    }

    if (widget.name === "alertpanel") {
      const [type, title] = splitType(widget.arguments);
      return `<div class="panel panel-${type}">
    <div class="panel-title"><i class="fa fa-${alertIconMap[type]}"></i>${await renderInlineText(widget, title)}</div>
    <div class="panel-body">
        ${await renderWidgetMarkdown(widget, widget.content)}
    </div>
    </div>`;
    }

    if (widget.name === "collapse") {
      const [title, state] = widget.arguments
        .split(",")
        .map((value) => value.trim());
      return `<div class="collapse-box-control${state === "open" ? " active" : ""}">
    <div class="collapse-box-header"><div class="collapse-box-icon"><i class="fa fa-plus"></i></div><span>${await renderInlineText(widget, title)}</span></div>
    <div class="collapse-box-content"><div class="inner">
        ${await renderWidgetMarkdown(widget, widget.content)}
    </div></div>
    </div>`;
    }

    return `<span class="blur">${await renderInlineText(widget, widget.arguments)}</span>`;
  },
  { async: true },
);

// 链接列表 // 参数： 0.排序依据 (order / random) 1.列表的数据ID（使用来自 data files 的数据时必要）
hexo.once("generateBefore", () => {
  const datafiles = hexo.locals.get("data");

  hexo.extend.tag.register("linklist", (args) => {
    const linklist = datafiles.linklist[args[0]];

    if (!linklist) {
      // 什么都没有
      return "无效的列表";
    }

    let inner = "",
      appendix = "";

    if (args.length === 1) {
      args[1] = "order"; // 默认为顺序
    }

    switch (args[1]) {
      case "order":
        inner = linklist
          .map(
            (link) =>
              `<li>
          <a target="_blank" href="${link.link}">
            <img src="${link.image}" alt=${link.title} />
            <div>
              <span>${link.title}</span>
              <p>${link.description}</p>
            </div>
          </a>
        </li>`,
          )
          .join("");
        break;
      case "random":
        appendix = `<script type="text/javascript">
          (() => {
              const flist = ${JSON.stringify(linklist)};
              let friendNodes = '';
              while (flist.length > 0) {
                  const randID = Math.floor(Math.random()*flist.length);
                  friendNodes += \`<li>
                    <a target="_blank" href="\${flist[randID].link}">
                      <img src="\${flist[randID].image}" alt=\${flist[randID].title} />
                      <div>
                        <span>\${flist[randID].title}</span>
                        <p>\${flist[randID].description}</p>
                      </div>
                    </a>
                  </li>\`;
                  flist.splice(randID, 1);
              }
      
              document.currentScript.parentNode.querySelector(".kr-linklist-container").innerHTML = friendNodes;
          })();
          </script>`;
        break;
    }

    return `<div class="kr-linklist">
    <ul class="kr-linklist-container">${inner}</ul>
    ${appendix}
  </div>`;
  });
});
