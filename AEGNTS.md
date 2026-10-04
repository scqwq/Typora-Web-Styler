# Typora Web Styler 项目指南与窗口接力记录

版本：0.4 · 更新日期：2026-10-05 · 状态：Typora Web Styler 0.2.0；统一配置、本地字体/图片、日志已实现。用户已反馈真实 Typora 主题可以导入，复杂主题仍需逐项验收。

## 1. 指南入口与优先级

本文件按用户指定拼写命名为 `AEGNTS.md`，是新项目的完整指南。根目录 `AGENTS.md` 是自动发现入口，指向本文件。修改目标、实现状态或路线时更新本文件，不维护两份互相冲突的设计。

用户最新指令优先。项目对外名称为 **Typora Web Styler**（历史名称 Web-markdown）。本次更名范围为文档；manifest、界面和 npm 包名仍沿用旧名称。未来同步产品名称时保留存储键、IndexedDB 数据库名及扩展身份，避免用户主题数据丢失。新源码位于项目根目录；`markdown-viewer/` 是用户迁入的旧项目参考目录，不是新插件源码入口。定位文件以当前工作区实际路径为准，不硬编码迁移前的绝对路径。

旧项目中的 AGENTS.md 和 TECHNICAL-PLAN.zh-CN.md 描述旧项目路线，只在参考或修改旧项目时适用，不能把其中“保留 Markdown 原文渲染能力”的要求带入新插件。

## 2. 项目目标

开发独立的 Chrome / Edge Manifest V3 浏览器扩展，让用户在**当前博客网页的原正文上**应用自己导入的 Typora CSS 主题。

核心流程：导入主题 → 打开博客 → 定位/确认正文 → 应用主题 → 切换主题或恢复原样。

浏览器中的目标通常是已经由 Markdown 生成的 HTML。无需获取作者的 `.md` 文件，无需证明文章的原始写作格式，不把 HTML 转回 Markdown。新项目不要求保留旧扩展的本地/远程 Markdown 原文查看、多编译器或整页渲染功能。

默认原则：**在不让原正文变乱的前提下，尽可能替换成 Typora 主题的样式。** 优先保留网站布局、正文内容、标题 ID、链接、公式、图表及交互；允许主题改变标题、段落、引用、列表、表格和代码的排版。

首阶段支持 Windows Chrome / Edge；Firefox 和其他 Chromium 浏览器另行验证，不以共享内核推断全部兼容。

## 3. 当前实际状态

- 新项目已实现 Manifest V3 插件、主题导入/删除、AST 自动转换、正文识别/确认、应用/切换/恢复、转换报告和基本导航清理。独立本地 Git 仓库位于 main 分支；首版提交为 `3aae32c`，0.2 功能提交为 `19bec7f`。用户本次授权文档更名、README 整理和忽略规则完成后提交本地 commit，没有授权推送。
- 已生成可加载的 `dist/`；安装方式见 README.md，加载该目录，不是根目录。正式 manifest 仅有 activeTab/scripting/storage，没有持久 host 权限。
- 旧项目在 `markdown-viewer/`，有自己的 Git 历史和用户未提交改动。新仓库忽略整个旧参考目录，不会将它作为嵌套仓库加入分发或版本记录；参考代码需实际复制到新源码并记录来源。
- 旧目录有用户修改的 README、构建脚本和新增中文方案，必须保留。
- 项目目前位于 `D:\moresoftware\Web-markdown-theme`，原路径已不可用。本次只更新项目文档名称，不再次移动目录；定位源码以实际工作区为准，内层旧项目保持只读。
- 用户已在自己的浏览器确认 Typora 主题可以正常导入；未提供该主题文件给 agent，不能将该反馈当成所有资源、结构或恢复均已验收。
- 第一测试页面：`https://saurlax.com/blog/fundamentals-of-artificial-intelligence#人工智能概述`。本次通过独立无头 Edge 加载真实网页，确认正文为 `article#article-content`，有 4 个 pre 代码块、133 个公式候选及 13 个 SVG/图表候选。已为这个具体路径添加适配器，不推断所有 Saurlax 页面结构一致。
- 转换/资源/配置/日志共 16 项行为测试通过；独立无头 Edge 已验证实际 popup、导入、作用范围、交互、应用/切换/恢复、失败回退和后台重启。0.2 新增浏览器检查包含全局保留开关、important/font 简写、主题间共享配置、原站新增内联修改、本地字体加载/释放、图片、CSP 及日志筛选/导出/清空；最终运行结果以 artifacts/browser-results.json 为准。
- 目标站已用内置测试主题完成应用/撤销和前后截图检查；测试产物在 artifacts/，报告为 browser-results.json。后台/页面没有测试环境捕获的未处理错误。正式 activeTab 点击授权流程仍需要用户在日常 Edge/Chrome 中手动确认，Chrome 未单独实测。
- 自动化复制 dist 到独立测试扩展，并仅在该副本添加本地测试页和 Saurlax 的 host 权限。不要把测试 manifest 分发或用它宣称正式插件具有持久网站权限。
- 用户已在日常浏览器安装插件，并反馈内置主题“貌似成功”；这是用户初步试用反馈，不替代实际主题、所有交互与恢复的完整验收。用户没有看到正文高亮，需后续改进确认范围的体验。
- 旧项目的构建成功不代表新项目可构建、可加载或已完成浏览器验证。
- 0.2 已支持 1 MB 主 CSS、最多 64 个本地资源（单个 16 MB、合计 24 MB）、主题目录选择、字体隔离加载、可选背景图片、11 项统一配置、持久日志页面。通用评分、网页点选、按站点自动应用、@import 合并和 ZIP 资源包仍未实现。

## 4. 用户新增想法与设计判断

### 4.1 自动转换 Typora CSS

可行。Typora 主题本身已经是浏览器可解析的 CSS，转换器要解决的是运行环境和 DOM 结构差异，不是发明一种新的 CSS 语言。

首版目标：自动分析并输出限定正文范围的 CSS；支持常见正文规则，对未支持规则给出报告。复杂主题兼容性后续逐步补充，但不能将原始主题直接注入整页来冒充自动转换。

不引入 AI 或联网分析。使用 CSS AST 与选择器 AST，在扩展内进行确定性的本地转换。不要用正则全局替换代替语法解析；声明值的转换也应使用相应解析手段。

### 4.2 保留原网页的部分样式

合理。0.2 已实现统一配置，所有主题共用：标题字号/颜色、正文字体/字号/行距、链接颜色、代码配色/背景色保护；另有字体、背景图片和正文根背景开关。

保留开关默认仅代码配色开启，其余关闭，优先应用主题的受支持样式。布局和交互保护始终启用。背景图片和根背景替换默认关闭，字体加载默认开启。常见 CodeMirror 类已映射到 Prism/Highlight.js，不保证 Shiki 内联配色或任意 token 结构。

“保留”通过应用前捕获选定计算属性、可撤销的有限内联声明实现，覆盖继承、变量和 font 简写的间接影响。不会冻结全部样式；但应用期间网站自身动态改变这些视觉属性可能不即时反映。恢复不覆盖网站随后改动的同一声明，新增节点不会自动补齐所有保护。

保存统一配置后，用户在网页再次应用主题生效；不刷新整页，不自动改变其他已打开会话。每次切换先撤回扩展的旧标记/保留声明，捕获原站基线后应用新会话；失败重做旧标记与保留声明，保留旧 CSS/字体。

## 5. 首版范围与明确边界

首版必需：单 CSS 导入、自动转换、正文确认、手动应用、主题切换、恢复、简要转换报告。

首版正文定位采用已实测站点规则和用户输入/确认的选择器；可检查 article/main 作为候选，但不盲目自动选最大容器。通用评分和网页点选工具后续增加。

0.2 支持本地字体和可选的本地背景图片，可选择散文件或目录；远程资源与 @import 仍不加载，跳过并报告。目录中的其他 CSS 不会自动合并。字体通过二进制 FontFace 加入 document.fonts，图片使用验证后的 data URL；当前无头 Edge 扩展隔离环境在 font-src/img-src none 测试页仍加载成功，这是实际观察，不代表所有浏览器与资源来源均可绕过 CSP。日志按真实加载结果记录；损坏字体/图片会报告并回退。

首版不做独立阅读覆盖层、不做 HTML 转 Markdown、不重新渲染公式或代码、不实现所有网站自动识别、不追求所有主题像素级复刻。

可以延后复杂兼容，不能延后以下底线：限定正文作用范围；不重建 body；不修改原 ID；可撤销；连续应用不重复累积样式；失败时保留或恢复可用状态。

## 6. 当前技术栈

| 层 | 初始选型 | 说明 |
| --- | --- | --- |
| 扩展平台 | Manifest V3 | Chrome/Edge 优先，service worker 后台 |
| 业务代码 | 原生 JavaScript、ES modules、JSDoc | 不为首版引入框架迁移 |
| 界面 | HTML/CSS/原生 DOM | 简单 popup 与 options，无需照搬旧 UI 依赖 |
| CSS 转换 | PostCSS 8.5.28 + postcss-selector-parser 7.1.6 | 已本地打包，在 MV3 后台完成转换 |
| 声明值解析 | postcss-value-parser 4.2.0 | 已处理 URL、rem 单位和变量引用 |
| 构建 | Node.js/npm + esbuild 0.28.2 | 独立构建到 dist，不依赖旧 Bash 构建；本次 Node 24.20.0/npm 11.19.0 |
| 存储 | chrome.storage.local + 扩展来源 IndexedDB | 元信息/配置/报告/日志在 local；新主题原 CSS 和资源在 IndexedDB；兼容读取旧 local 主题 |
| 页面操作 | DOM API + chrome.scripting | executeScript、insertCSS、removeCSS |
| 验证 | Node 内置测试 + Playwright 1.63.0/本机 Edge | 真实扩展的独立无头浏览器测试；不连接用户日常配置 |

不需要服务器、数据库服务、Markdown 编译器或 AI 接口。依赖必须本地打包，不通过 CDN 动态加载执行代码。不要在 package.json 创建之前虚构构建/测试命令；安装时选择实际可用版本并保存 lockfile。

## 7. 实际代码目录与后续模块

```text
Typora Web Styler/            # 逻辑项目根，实际路径以工作区为准
  AGENTS.md                   # 自动发现入口
  AEGNTS.md                   # 完整接手指南（本文件）
  .gitignore
  README.md                   # 快速开始、使用及已知限制；zh-CN 为入口链接
  package.json                # 依赖、构建和测试入口
  package-lock.json
  scripts/build.mjs
  scripts/browser-check.mjs    # 自动化测试扩展、夹具和目标站
  src/
    manifest.json             # 源 manifest，构建复制到 dist
    background/
      index.js                # 消息、权限和页面注入协调
      article-service.js      # 应用、切换、恢复及 CSS 注入记录
    content/
      controller.js           # 页面内会话生命周期
      detector.js             # 正文候选与选择器验证
      annotator.js            # 少量语义标记及撤销记录
      contrast.js             # 抽样可读性检查，低对比度时撤销新主题
      preservation.js         # 全局保留选项的属性捕获、撤回和重做
      resources.js            # 页面内字体/图片加载及字体释放
      adapters/saurlax.js      # 已实测目标路径适配器
    theme/
      compiler.js             # 转换入口、编译版本和输出
      selectors.js            # 根映射、作用域和选择器处理
      repository.js           # 本地主题保存与查询
      asset-store.js          # IndexedDB 原 CSS/资源读写
      resources.js            # 文件类型、路径、容量、内容验证和资源查找
      report.js               # 有界兼容报告
      transforms/fonts.js     # 字体定义和名称隔离
      transforms/values.js    # 声明值、变量、rem、图片引用转换
      compatibility/code.js   # CodeMirror 到已有 token 结构映射
    settings/repository.js    # 一套全局配置读取与保存
    diagnostics/logger.js     # 有界持久日志、脱敏和串行存储
    shared/
      messages.js             # 可序列化消息契约
      style-policy.js         # 属性白名单、配置默认值及验证
    popup/                    # 应用、主题选择、恢复
    options/                  # 主题/本地资源导入、全局配置
    logs/                     # 日志筛选、搜索、导出及清空
    # 自定义图标暂未创建
  tests/
    compiler.test.js
    resources.test.js         # 1 MiB 边界、路径/字体/图片/代码映射与配置
    logs.test.js              # 日志次序、容量、脱敏、清空
    fixtures/                 # 测试主题及代表性 DOM
  dist/                       # 已构建输出，浏览器加载此目录
  artifacts/                  # 不入 Git：浏览器报告、截图、测试扩展副本
  markdown-viewer/            # 旧项目，默认只读参考，不进入新仓库和分发包
```

按需要逐步创建目录，不生成大量空模块冒充进度。构建只从 src/ 和显式依赖取文件，不递归打包整个根目录。

现有命令：`npm ci --cache .cache/npm`、`npm test`、`npm run build`、`npm run test:browser`。系统 npm 缓存本次不可写，已使用项目内 .cache/npm；默认沙箱进程初始化错误，改用获准的执行方式完成开发。不要修改系统 npm 配置或旧构建脚本。

保护机制的当前限制：控件、公式、SVG/图表使用可撤销标记与继承样式快照保护；代码颜色改为统一配置的选定属性保护。网站会话期间的动态样式可能被保护盖住，不是完整动态隔离。新增复杂控件尚不自动补标记。保留属性捕获最多处理 12,000 个正文元素，超限需缩小范围。rem 采用静态基准，媒体查询中的动态 html 字号未完整适配。未知语法保守跳过。变量和字体名称按会话隔离。

### 7.1 目录职责与查找入口（当前实际实现）

| 目录/文件 | 负责什么 | 要修改此行为时从哪里找 |
| --- | --- | --- |
| src/manifest.json | 插件名称、版本、权限、后台和界面入口 | 修改权限或加载入口看此源文件，不能只改 dist/manifest.json |
| src/background/index.js | 验证消息来源，分发 theme/article 请求，串行化主题写入与页面操作 | 新增扩展操作、检查请求参数和消息权限 |
| src/background/article-service.js | 固定 tab/document 注入目标，调度编译，插入/删除 CSS，处理失败与后台重启遗留状态 | 查应用、切换、恢复和注入失败问题 |
| src/content/detector.js | 验证用户选择器，站点规则优先，检查可见性/文字量/候选歧义 | 查“正文区域”、自动识别失败或误选范围 |
| src/content/adapters/ | 仅存具体网站的已验证正文规则 | 新网站适配与实时 DOM 验证记录；当前只有 saurlax.js |
| src/content/controller.js | 保存页面内选区和会话状态，调度标记/校验/撤销，预览高亮，观察正文替换和路径变化 | 查高亮、确认、会话阶段与 SPA 结束行为 |
| src/content/annotator.js | 标记受保护控件、公式、图表，保存有限继承样式，支持 undo/redo | 查保护范围、保护样式或遗留属性 |
| src/content/contrast.js | 抽样比较应用前后文字对比度 | 查低对比度主题被拒绝的问题 |
| src/theme/compiler.js | CSS AST 编译协调、at-rule 递归、属性策略过滤和输出 | 查主题转换总体流程；声明值/字体/资源/报告已有独立模块 |
| src/theme/selectors.js | 选择器 AST 转换、根映射、作用范围、保护节点排除与不支持结构过滤 | 查选择器未生效或范围泄漏 |
| src/theme/repository.js | 内置主题、导入/删除/列表、旧 local 记录兼容与 IndexedDB 协调 | 查主题列表、原 CSS/资源保存和容量限制 |
| src/shared/messages.js | UI 发消息的统一错误处理、转换报告文字格式 | 查界面请求报错和报告显示；正式消息分发仍在 background/index.js |
| src/shared/style-policy.js | 文本/块级属性白名单、11 项默认全局配置、布尔参数验证 | 查布局声明为何被跳过或配置默认值 |
| src/popup/ | 工具栏弹窗的界面、正文确认、主题选择、应用与恢复按钮 | 查日常使用流程；识别算法不放这里 |
| src/options/ | CSS/资源/目录选择、名称回退、导入/删除/报告和统一配置 | 查文件选择与配置交互；CSS 编译逻辑不放这里 |
| src/content/preservation.js | 捕获有限原站属性，应用 important 内联保护，撤回/重做并保留站点后续修改 | 查字号/颜色/字体保留、切换基线与撤销 |
| src/content/resources.js | 二进制 FontFace 加载、图片预检、8 秒超时与字体释放 | 查字体未生效、CSP 图片失败或字体遗留 |
| src/theme/resources.js、asset-store.js | 分别负责资源验证/解析和 IndexedDB 存储 | 查资源路径、文件类型/容量、资源丢失 |
| src/theme/transforms/ | fonts.js 字体定义/引用隔离，values.js 变量/rem/资源值转换 | 查字体别名、简写/变量和图片引用 |
| src/theme/compatibility/code.js、report.js | 分别负责代码类映射和有界兼容报告 | 查 CodeMirror token 映射、跳过项与资源警告 |
| src/settings/repository.js | 全局配置读取、兼容已知键、部分更新合并 | 查配置持久化；主题记录不保存独立配置 |
| src/diagnostics/logger.js、src/logs/ | 分别负责本地日志队列/脱敏/容量和日志页面 | 查记录缺失、筛选、搜索、导出和清空 |
| scripts/build.mjs | 本地打包、复制 manifest/静态界面、汇总依赖许可 | 查 dist 产物和依赖是否被打包 |
| scripts/browser-check.mjs | 独立浏览器的夹具、弹窗和目标站验证 | 查自动化流程、测试权限副本和截图 |
| tests/compiler.test.js、tests/fixtures/ | CSS 编译行为测试与代表性正文 HTML | 修改转换规则时补充对应输入和行为验证 |
| dist/、artifacts/、.cache/ | 分别是正式构建输出、验证产物、依赖/浏览器缓存 | 都不是手写业务源码，不能把修复只写进生成目录 |
| markdown-viewer/ | 旧项目参考 | 默认只读，不属于新插件架构和构建范围 |

操作链：popup/options → shared/messages → background/index → article-service/theme/repository → theme/compiler 或页面内 content/controller → detector/annotator/contrast。后台管理浏览器 API；页面内控制器管理 DOM；主题模块负责 CSS，不混入 UI。

### 7.2 转换模块组织（0.2 已部分落地）

0.2 已从 compiler 拆出 transforms/fonts、transforms/values、resources、report，新增 compatibility/code。后续沿职责扩展，不为每款主题复制一套解析器；需要进一步分拆时以实际复杂度为准。

- 保持 background/content/theme/shared/popup/options 的顶层职责，不为结构整理引入新框架。
- 主题采用一套通用 CSS/选择器/声明值 AST 解析器。不同主题文件先走同一管线，不为每个 CSS 文件另写一个解析器，也不复制多个完整编译器。
- 流程：PostCSS 解析 → 静态 rem 基准 → fonts 收集与别名 → at-rule 递归 → selectors 与代码类映射 → 属性白名单 → values 转换 → CSS/字体/图片清单/报告。共享上下文只存在于单次编译，不依赖跨主题全局状态。
- Typora 专有结构扩展到 `src/theme/compatibility/`；这是可组合的结构映射规则，不是按主题重复语法解析。
- 原 CSS 与资源保存在 IndexedDB，元信息和报告在 local。编译器版本为 2；应用时按最新统一配置重新编译。以后可把内置测试主题移到独立数据文件。
- 所有转换模块使用明确输入/输出与编译上下文，避免隐藏全局状态；阶段顺序及是否修改 AST 要写清。相关语法样例放 tests/fixtures/，验证转换后的行为而不是只测函数是否被调用。
- 结构整理前后保留现有转换与浏览器测试，确保应用、切换、撤销没有行为回退。文件移动后同步修改构建入口、导入路径和本节职责表。

### 7.3 本次使用疑问与后续体验事项

- “正文区域”是浏览器 CSS 选择器，如 `#article-content`、`.post-content`、`article#article-content`，不是 URL、标题文字或 Markdown 文件路径。显式选择器必须只匹配一个合适的容器；留空则先走已验证站点适配，再尝试 article/main/[role=main]。当前尚无通用全文评分或人工智能识别。
- 高亮当前是对整个正文根容器的 outline 动画：紫色 3px 轮廓、4px 偏移、1800ms 淡出；不是只高亮头部，也不逐段着色，不自动滚动。正文很长、网页裁剪轮廓或用户仍在看弹窗时，可能看不到明显边界。应用主题时立即取消该预览。用户已反馈未看到高亮，后续考虑持久预览/可见区域提示或滚动定位；尚未修改。
- “主题名称”是列表和弹窗的显示名，内部用独立 ID 区分。选择 CSS 文件时空名称自动填写文件名；提交时仍为空也回退文件名。导入后重命名尚未实现。
- 文件选择现已连接完整首版链路：读取文本 → AST 转换验证 → 保存原 CSS/元信息/报告 → 弹窗可选 → 应用时按会话重新转换。不是仅上传或压缩，但不代表任意 Typora 主题已完整兼容。字体/图片/import、复杂嵌套与代码配色映射仍有边界。

## 8. 主题转换契约

转换流程：原 CSS → AST 解析 → 规则分类 → 选择器/声明转换 → 属性策略过滤 → 正文限定 CSS + 转换报告。

- 给正文根添加会话唯一标记，如 `data-wm-article="s123"`；不占用原 id。
- 将 #write 映射到正文根。普通规则限定在根内，处理根自身、列表、组合器、伪类；不简单给所有规则拼接同一前缀。
- html/body/:root 中的字体、颜色和自定义变量按策略迁到正文；窗口、工具栏和编辑器 UI 规则跳过。
- 递归处理已支持的 @media/@supports。未知或不支持的 at-rule 默认跳过并报告；不能未经检查原样透传造成全局作用。
- 字体定义按会话隔离并改写 font-family/font/变量中的引用；最多加载 32 个字体定义。优先使用用户上传二进制，再尝试 local()；失败退回备用字体并记录。keyframes/动画仍跳过。
- 检查 CSS URL，包括自定义变量里的资源引用；首版禁止主题意外触发远程字体、图片或 import 请求。
- 保留原 CSS。编译结果与编译器版本、选项绑定；会话选择器可用结构化模板，不能在输出后用全局文本替换修改任意内容。
- Typora 的 rem 仍参照网页 html；把 html 字号搬到正文不会自动改变 rem 基准。首版应明确转换主题内 rem 的策略与基准，无法静态确定时报告，不改变整页 html 字号。
- 对依赖原站祖先结构、无法可靠限定范围或映射的规则先跳过，不牺牲页面稳定性。
- 报告包含已转换、因布局保护跳过、不支持结构、缺失资源和解析错误；CSS 可解析不代表视觉兼容已经验收。

编译器使用样例做行为测试，包括 #write、html/body/:root、:is/:not 等嵌套选择器、媒体规则、变量、单位、资源和泄漏。只支持经过测试的语法子集。

## 9. 默认布局与样式策略

默认允许主题改变正文的字体、字号、颜色、行距和文本块外观。默认保护正文外的导航、侧栏和评论，以及正文内的表单、复制按钮、播放器、公式和图表内部结构。

正文根的宽度、居中、背景、留白由独立策略控制，默认保留原站。对子元素的 position/display/固定尺寸/溢出处理等布局声明采用保守策略，不能把 Typora 窗口布局直接搬进网站。合理的段落、引用和代码间距允许调整。

主题作用域与覆盖优先级是两个问题。先使用有边界的选择器和排版声明，必要时针对明确属性增强覆盖；不使用全局 !important 或 all:unset，不声称 USER 来源 CSS 保证压过所有网站样式。

代码块外观与 token 颜色分开处理。首版支持外观；Typora CodeMirror 与 Prism/Highlight.js/Shiki 的 token 映射逐步增加。保护公式/图表不只是避开根节点，也要检查继承和宽泛后代规则的影响。

## 10. 会话、恢复与消息职责

- ThemeRecord：ID、名称、原 CSS、编译版本和报告；可重建缓存与原文件分开。
- ArticleTarget：页面内 root、定位方式、受保护节点和必要理由。DOM 节点不跨消息传递。
- ArticleSession：文档标识、会话标记、主题/选项、确切注入 CSS/origin、有限属性改动、监听器和观察器。
- 消息使用独立命名，如 article.locate/apply/restore、theme.import/list；校验发送方、tab、参数和结果，返回明确错误。
- 页面内控制器持有 DOM 状态，后台负责权限与注入协调。MV3 worker 可能休眠，恢复不能仅依赖后台内存；保存或重新取得当前文档的注入记录，并拒绝过期导航结果。
- 切换前先编译新主题；失败保留旧状态。注入失败清理新增项。移除 CSS 时使用原注入文本与来源等匹配信息。
- 重复应用幂等。恢复只撤销扩展自己的样式、标记和监听器，不用旧 innerHTML 覆盖网站新增 DOM，不改变原标题 ID/hash。
- 首版遇到正文被替换或页面导航应结束旧会话并报告；复杂 SPA 自动重新定位是后续能力。观察器必须可释放、节流并过滤自身改动。

## 11. 权限与复用边界

首版手动应用声明 activeTab、scripting、storage。自动应用以后按用户开启的站点申请可选 host 权限，不默认申请全部网站持久访问。受限浏览器页面和跨域 iframe 不属于首版。

可参考旧项目的文件读取、消息传递、扩展结构和注入 API 用法，但独立重写正文检测、CSS 转换、样式策略和会话控制。

禁止复用旧 content/index.js 的 body 挂载、pre 原文读取和整页高亮/公式/图表重渲染流程。旧 storage.sync 主题存储和按旧 origins 清理权限的逻辑也不能照搬。

实际复制旧项目的代码时保留其 MIT 版权/许可说明，记录来源；第三方主题、图标和依赖分别按其许可处理。不要把旧项目全部复制进 src 或 dist。

### 11.1 旧项目值得复制/参考的具体位置

以下路径相对于新项目根目录。复用以小段功能为单位，先读原代码，再移入新模块并解除 md.* 全局状态耦合；不是把整文件直接替换进新插件。

| 旧文件 | 值得取用的部分 | 新项目位置与必要调整 |
| --- | --- | --- |
| markdown-viewer/options/custom.js | input[type=file]、FileReader.readAsText(..., 'UTF-8')、上传/替换/删除的交互流程 | 放入 src/options/；保留原 CSS，增加读取失败与解析错误提示；移除 Mithril/MDC 依赖及 csso.minify 作为唯一处理步骤，接入 AST 转换与主题 ID |
| markdown-viewer/background/inject.js | executeScript 的 target/files/args 用法，以及 insertCSS 调用形态 | 放入 article-service；只取 API 调用框架，改为独立正文控制器和编译后 CSS；增加等待结果、错误清理、document 身份校验及 removeCSS，不能复制隐藏 pre 或旧内容脚本列表 |
| markdown-viewer/background/messages.js | runtime 消息分发、sendResponse、异步响应保持通道的组织方式；打开设置页的代码 | 放入 background/index.js 与 shared/messages；使用 article/theme 消息，校验请求并返回错误；不复制 Markdown 编译分支、统一 reload 或旧 state 存储接口 |
| markdown-viewer/background/messages.js 的 notifyContent | 获取活动 tab 后发送页面消息的基本调用 | popup 操作时捕获明确 tab/document 后传给后台，后续异步步骤沿用该目标；不能每一步重新查活动 tab，以免用户切换标签后改错页面 |
| markdown-viewer/options/origins.js | permissions.request/getAll/remove 的调用与授权结果处理；文件 URL 开关提示的思路 | 用于 P1 按站点自动应用；首版用 activeTab；不复制 Allow All 默认流程，也不把旧来源检测配置当作正文识别规则 |
| markdown-viewer/background/storage.js | 默认配置、版本迁移和持久化设置的组织思路 | theme/repository 与配置模块重新实现；改用 local，等待初始化；不复制 sync 主题正文、旧 migrations 或 storage.bug 的权限清理 |
| markdown-viewer/manifest.chrome.json | MV3 的 action、service_worker、options_page 和图标字段结构 | 新建 src/manifest.json；替换名称、描述、图标和路径；权限按本指南重写，web_accessible_resources 只声明实际需要的资源 |
| markdown-viewer/popup/index.js、popup/index.html、options/index.html | 主题选择、设置入口和界面字段组织可作交互参考 | 默认用原生 DOM 重写；不复制编译器/原文开关、固定主题列表及整套 Bootstrap/MDC/Mithril 依赖 |
| markdown-viewer/background/icon.js | chrome.action.setIcon 按尺寸设置图标的短代码 | 需要主题/状态图标时可取用；使用新资产和状态，不复制无依据的 setTimeout 与旧 settings 耦合 |
| markdown-viewer/build/package.sh | 发布物应显式包含源码入口、manifest 和依赖的打包清单思路 | scripts/build.mjs 独立实现；不复制清理 themes/vendor、批量安装、联网拉主题及 Bash/WSL 流程 |

复用优先顺序：CSS 文件读取 → 注入 API 框架 → 消息/设置页入口 → manifest 结构。其余根据实际需求取用，避免为少量代码引入整个旧依赖体系。

### 11.2 明确不复制的部分

- background/detect.js：原文 Content-Type/URL 检测不能用于正文定位。
- content/index.js 和 content/index.css：整页挂载、body 布局及全局样式不能用于原博客。
- background/compilers/：不需要再次解析 Markdown。
- content/prism.js、mathjax.js、mermaid.js、emoji.js：不对已经渲染的博客重新运行；以后确有缺失内容需求再单独设计。
- content/autoreload.js、background/webrequest.js、xhr.js：旧原文抓取/刷新路线不属于新项目首版。
- build/themes/、生成的 themes/ 和 vendor/：不是 Typora 自动转换器，不批量迁入；测试主题单独选择并记录许可。

每次实际复制后，在相关源码保留来源注释，并在更新记录列出旧路径、新路径和调整内容。项目开始复制实质代码时加入必要的 LICENSE/THIRD_PARTY_NOTICES，文档中的提示不能代替分发包内的许可文本。

## 12. 实施顺序与完成标准

### P0：自动转换与单页面闭环

1. 建立新项目构建、manifest、最小 popup/options；读取旧代码只为参考。
2. 实现主题仓库与 AST 转换器，先用不含资源的测试 CSS 验证。
3. 查看目标页面实时 DOM，确认正文根及复杂内容；未验证前不编造适配器。
4. 实现正文标记、应用、切换、恢复和失败清理。
5. 拿到真实主题后进行视觉验收；没有真实主题时继续独立工作，并明确“仅测试主题验证”。

验收：标题、段落、引用、表格、代码体现主要主题风格；正文外不被改样式；锚点、链接、复制按钮和原公式图表仍可用；重复应用不累积；恢复清除扩展修改并保留网站新增内容；dist 可加载且无扩展报错。

### P1：日常使用

0.2 已完成统一保留开关、本地资源/目录、日志；后续完善通用检测和点选、站点规则、自动应用、动态新节点保护及 @import/ZIP 资源包。

### P2：兼容性扩展

增加主题与代码结构映射、更多站点和浏览器验证；独立阅读视图仅在用户确有需求时另行设计。

验证记录必须区分：静态审查、编译测试、构建成功、真实浏览器功能测试、真实主题视觉验收。不要用一个阶段的结果替代其他阶段。

## 13. 工作约定与窗口接力

- 与用户用中文沟通，先说明结果、限制及下一步。
- 开始时读取根 AGENTS.md 和本文件，检查实际目录与新旧仓库 git status；保护无关修改。
- 用户已授权新项目路线，普通可逆编码无需反复确认；远程发布、推送和 PR 没有自动授权。
- 搜索优先 rg，修改前读相关代码，不重置、清理或提交用户成果。
- 新项目构建与旧项目解耦，不盲目执行旧 build/package.sh。
- 遇到主题/站点不确定性查官方资料并实测；单个站点验证受阻不停止不依赖它的工作。
- 每个阶段完成后同步更新“当前实际状态”、实际代码结构、使用命令及更新记录。记录剩余问题和下一步，不能只追加“已完成”而保留过期状态。

## 14. 改动更新记录

| 日期 | 改动 | 验证与剩余事项 |
| --- | --- | --- |
| 2026-10-04 | 用户决定建立独立 Web-markdown 项目，旧项目移入 markdown-viewer/；新增本指南与标准 AGENTS.md 入口、逐文件复用清单和 .gitignore，初始化 main 分支 | 已确认新 Git 仓库初始化成功、旧目录被忽略；没有提交/推送，未实现或构建插件，未实测 DOM；外层目录改名因 Windows 进程占用失败，当前路径保持原样 |
| 2026-10-04 | 实现 0.1.0：src/ 中独立 MV3 后台、主题 AST 转换与仓库、正文控制器、popup/options；增加构建脚本、8 项编译测试、浏览器闭环脚本及使用说明 | 构建与转换测试通过；无头 Edge 夹具和 Saurlax 内置主题应用/撤销通过，前后截图已查看；真实用户主题和正式 activeTab 点击流程待验收，旧项目未改动，未提交/推送 |
| 2026-10-04 | 首版交付检查完成：加入低对比度失败回退，验证实际 popup 操作，补全依赖许可，生成 web-markdown-0.1.0.zip | 最终浏览器报告的 fixture/target 均 passed，未捕获未处理错误；已查看弹窗、设置页和真实站点前后截图。ZIP 含正式 manifest、后台/正文脚本、界面、许可与说明，不含旧项目或测试 host 权限；用户决定暂不改外层目录名 |
| 2026-10-04 | 用户初步试用后询问正文选择、高亮、文件名称与主题解析结构；补充 7.1 目录职责索引、7.2 解析模块拆分规划、7.3 当前交互事实与待改体验 | 仅核对源码并修改 AEGNTS.md，没有改插件代码、重构、重建或重新运行测试。高亮可见性、导入后重命名、解析职责细分仍待实施 |
| 2026-10-05 | 实现 0.2.0：主 CSS 1 MiB，本地字体/图片及目录导入、IndexedDB 资源仓库、11 项统一配置、日志页面；按职责拆分转换模块，更新 README.md/AGENTS.md | 16 项行为测试通过；独立 Edge 验证开关/简写/原站后续修改、字体加载及释放、背景图片/CSP、日志筛选导出清空，并回归 Saurlax；正式 activeTab、用户具体主题资源及更多浏览器仍需手测。本次按用户要求提交本地 commit，不推送，旧项目未改动 |
| 2026-10-05 | 对外名称确定为 Typora Web Styler；更新 README/中文入口/AGENTS/AEGNTS，README 按功能、环境与快速开始、详细介绍组织；补齐测试报告、临时文件及新名称分发包的忽略规则 | 修正迁移后的实际路径，保留历史名称与提交记录；核对 Git 忽略规则和文档链接。本次仅文档及忽略规则，不改变插件行为和数据存储，不移动项目目录，按用户要求提交本地 commit |

后续记录具体文件、行为变化、验证结果和未完成项。下一窗口先读取 README 与 browser-results.json；优先取得真实 Typora CSS，进行用户浏览器中的手动安装/主题视觉验收，再按需求推进 P1。不要重新从空项目开始。

## 15. 官方资料

- Typora 主题结构：https://theme.typora.io/doc/Write-Custom-Theme/
- Chrome 注入 API 与权限：https://developer.chrome.com/docs/extensions/reference/api/scripting
- CSS 长度与 rem 基准：https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length
