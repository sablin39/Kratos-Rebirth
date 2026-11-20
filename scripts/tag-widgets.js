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

// 提示横幅 // 参数： 0.类型 其余参数为内容
hexo.extend.tag.register("alertbar", (args) => {
  const [type, ...text] = args;
  return `<div class="alert alert-${type}">
  <div class="icon"><i class="fa fa-${alertIconMap[type]}"></i></div>
  <div class="text"><p>${text.join(" ")}</p></div>
  </div>`;
});

// 提示面板 // 参数： 0.类型 其余参数为标题 内部内容
hexo.extend.tag.register(
  "alertpanel",
  (args, content) => {
    const [type, ...title] = args;
    return `<div class="panel panel-${type}">
    <div class="panel-title"><i class="fa fa-${alertIconMap[type]}"></i>${title.join(" ")}</div>
    <div class="panel-body">
        ${content}
    </div>
    </div>`;
  },
  { ends: true },
);

// 折叠内容 // 参数： 逗号分隔的标题 可选的 open 状态 内部内容
hexo.extend.tag.register(
  "collapse",
  (args, content) => {
    const [title, state] = args
      .join(" ")
      .split(",")
      .map((value) => value.trim());
    return `<div class="collapse-box-control${state === "open" ? " active" : ""}">
    <div class="collapse-box-header"><div class="collapse-box-icon"><i class="fa fa-plus"></i></div><span>${title}</span></div>
    <div class="collapse-box-content"><div class="inner">
        ${content}
    </div></div>
    </div>`;
  },
  { ends: true },
);

// 模糊隐藏 // 参数： 0.内容
hexo.extend.tag.register(
  "blur",
  (args) => `<span class="blur">${args.join(" ")}</span>`,
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
