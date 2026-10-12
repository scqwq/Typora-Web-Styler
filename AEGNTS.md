# Typora Web Styler 项目指南与窗口接力记录

版本：0.9 · 更新日期：2026-10-12 · 状态：Typora Web Styler 0.5.0；在线/ZIP 导入与包内 CSS 依赖已实现；统一配置、本地资源、全局背景、标签页自动应用、日志、页面阅读位置标签已实现。用户真实主题与复杂网站仍需逐项验收。

## 1. 指南入口与优先级

本文件按用户指定拼写命名为 `AEGNTS.md`，是新项目的完整指南。根目录 `AGENTS.md` 是自动发现入口，指向本文件。修改目标、实现状态或路线时更新本文件，不维护两份互相冲突的设计。

用户最新指令优先。项目对外名称为 **Typora Web Styler**（历史名称 Web-markdown）。manifest 和界面已使用新名称；npm 包名、日志导出文件名前缀和存储标识保留历史名称。修改品牌展示时保留存储键、IndexedDB 数据库名及扩展身份，避免用户主题数据丢失。新源码位于项目根目录；`markdown-viewer/` 是用户迁入的旧项目参考目录，不是新插件源码入口。定位文件以当前工作区实际路径为准，不硬编码迁移前的绝对路径。

旧项目中的 AGENTS.md 和 TECHNICAL-PLAN.zh-CN.md 描述旧项目路线，只在参考或修改旧项目时适用，不能把其中“保留 Markdown 原文渲染能力”的要求带入新插件。

## 2. 项目目标

开发独立的 Chrome / Edge Manifest V3 浏览器扩展，让用户在**当前博客网页的原正文上**应用自己导入的 Typora CSS 主题。

核心流程：导入主题 → 打开博客 → 定位/确认正文 → 应用主题 → 切换主题或恢复原样。

浏览器中的目标通常是已经由 Markdown 生成的 HTML。无需获取作者的 `.md` 文件，无需证明文章的原始写作格式，不把 HTML 转回 Markdown。新项目不要求保留旧扩展的本地/远程 Markdown 原文查看、多编译器或整页渲染功能。

默认原则：**在不让原正文变乱的前提下，尽可能替换成 Typora 主题的样式。** 优先保留网站布局、正文内容、标题 ID、链接、公式、图表及交互；允许主题改变标题、段落、引用、列表、表格和代码的排版。

首阶段支持 Windows Chrome / Edge；Firefox 和其他 Chromium 浏览器另行验证，不以共享内核推断全部兼容。

## 3. 当前实际状态

- 新项目已实现 Manifest V3 插件、主题导入/删除、AST 自动转换、正文识别/确认、应用/切换/恢复、全局背景与临时标签页自动应用。独立本地 Git 仓库位于 main 分支；首版提交为 `3aae32c`，0.2 功能提交为 `19bec7f`。用户本次授权更新 README/项目指南，并将 0.3.0 功能与文档提交本地 commit，没有授权推送。
- 已生成可加载的 `dist/`；安装方式见 README.md，加载该目录，不是根目录。0.3 正式 manifest 必需权限仅 activeTab/scripting/storage，webNavigation 和 HTTP/HTTPS host 权限为可选，按用户启用功能申请，不默认授予持久 host 权限。
- 旧项目在 `markdown-viewer/`，有自己的 Git 历史和用户未提交改动。新仓库忽略整个旧参考目录，不会将它作为嵌套仓库加入分发或版本记录；参考代码需实际复制到新源码并记录来源。
- 旧目录有用户修改的 README、构建脚本和新增中文方案，必须保留。
- 项目目前位于 `D:\moresoftware\Web-markdown-theme`，原路径已不可用。本次只更新项目文档名称，不再次移动目录；定位源码以实际工作区为准，内层旧项目保持只读。
- 用户已在自己的浏览器确认 Typora 主题可以正常导入；未提供该主题文件给 agent，不能将该反馈当成所有资源、结构或恢复均已验收。
- 第一测试页面：`https://saurlax.com/blog/fundamentals-of-artificial-intelligence#人工智能概述`。本次通过独立无头 Edge 加载真实网页，确认正文为 `article#article-content`，有 4 个 pre 代码块、133 个公式候选及 13 个 SVG/图表候选。已为这个具体路径添加适配器，不推断所有 Saurlax 页面结构一致。
- 当前 Node 行为测试共 42 项（含独立背景与自动应用配置/范围/权限检查）通过。独立无头 Edge 的原功能及全局背景回归通过；新增自动应用检查覆盖两个开关、标签页登记、刷新/SPA/延迟正文、范围限制、暂停恢复和后台重启，并验证 go-zero 刷新和环境安装章节点击。报告分别为 artifacts/browser-results.json 与 auto-browser-results.json；真实浏览器原生可选授权弹窗未自动化。
- 目标站已用内置测试主题完成应用/撤销和前后截图检查；测试产物在 artifacts/，报告为 browser-results.json。后台/页面没有测试环境捕获的未处理错误。正式 activeTab 点击授权流程仍需要用户在日常 Edge/Chrome 中手动确认，Chrome 未单独实测。
- 原回归仅在独立测试副本添加本地页/Saurlax host 权限；自动应用脚本在另一测试副本预授予 webNavigation 与 HTTP/HTTPS host 权限，实际修改仍由标签页登记决定。不要分发这些测试 manifest，或把预授予测试结果当成正式授权弹窗已验证。
- 用户已在日常浏览器安装插件，并反馈内置主题“貌似成功”；这是用户初步试用反馈，不替代实际主题、所有交互与恢复的完整验收。用户没有看到正文高亮，需后续改进确认范围的体验。
- 旧项目的构建成功不代表新项目可构建、可加载或已完成浏览器验证。
- 当前支持 2 MiB 主 CSS、最多 64 个本地资源（单个 16 MB、合计 24 MB）、主题目录选择、字体隔离加载、背景图片、11 项样式开关及可配置正文节点上限、独立全局背景、临时标签页自动应用与持久日志。在线/本地 ZIP 解包、包内 @import 合并已在 0.4 实现；通用评分、网页点选、独立永久站点规则仍未实现。

### 3.1 全局自定义背景（2026-10-05 新增）

用户已授权第一版：在 options/index.html 中维护独立全局背景，上传用户图片，正文底色与图片不透明度分开调节，所有主题共用。设置默认关闭，正文底色 90%、图片 50%；PNG/JPEG/WebP/GIF 单张最多 16 MB，复用现有资源签名验证。使用 IndexedDB bundles 中保留 ID `global-background` 原子保存图片与配置，不混入普通样式 globalSettings。删除主题先检查主题存在，避免误删保留记录。

新增 src/shared/background-policy.js（数值配置契约）、src/settings/background-repository.js（保存与读取）、src/content/background.js（固定图片层、正文背景覆盖及 undo/redo）。后台增加 background.get/set；应用时读取配置，stage 预检图片，validate 在主题 CSS 注入后取得正文计算底色并应用透明度。图片固定居中 cover、不接收点击；body 使用可撤销 isolation，背景层 z-index -1。仅正文根改底色/去背景图，网站外层不透明容器保持原样，可能遮住图片；透明底色回退白色。

新背景纳入 prepare/commit/rollback/restore/导航清理；失败恢复旧背景，切换不重复叠层，撤销保留网站随后修改的声明。保存配置后再次应用，不实时修改其他标签页。独立背景设置不随普通样式“恢复默认”重置；使用“删除图片并关闭”。背景图片下的对比度仅抽样，不能代表真实图像阅读效果。

验证结果见本次更新记录与 artifacts/browser-results.json；正式 activeTab 及用户真实图片/网站仍需实际浏览器确认。

### 3.2 标签页自动应用（0.3.0）

用户已确认两个全局偏好，默认均关闭：enabled“当前标签页自动使用主题”；sameSiteOnly“仅限该标签页下的相同网站”，仅 enabled 开启可操作。设置页不选目标，不直接登记标签页。小窗口成功手动应用后登记 tabId、原 origin、主题 ID、正文选择器；多个标签页分别登记。相同网站按协议/主机/端口判断，路径不限；跨网站模式丢弃原站选择器重新识别。

偏好存储在 local.autoSettings；临时规则存储在 storage.session.autoTabs，可跨后台休眠，关闭标签页删除，浏览器重启/扩展重载或更新清除。保存关闭偏好会清除登记但不撤销已应用样式。恢复原样先暂停该标签页，刷新保持暂停，成功手动应用可恢复并更新主题。主题删除后下次自动应用失败会记日志，不静默改用其他主题。

新增 src/shared/auto-policy.js（配置、origin/host pattern 与范围判断）、src/settings/auto-repository.js（偏好和实际权限检查）、src/background/auto-service.js（登记、暂停、导航调度、有限重试）。background/index 增加 auto.get/set，分别对 UI 手动操作和自动流程协调；article-service 接受后台内部 expectedDocumentId，拒绝过期自动请求。controller 的 status 同步检查路径/正文有效性；旧会话 cleanup 消息亦触发允许范围内的重试。自动 locate 不显示动画。小窗口在成功识别后默认勾选“使用已识别的正文区域”，修改选择器后仍须重新识别。

事件涵盖 DOMContentLoaded、Completed、HistoryStateUpdated、ReferenceFragmentUpdated，及当前正文整体替换后的 cleanup。仅已登记且未暂停标签页执行；每个标签页串行，每次调度取消旧重试，后台休眠后由新事件重新调度。正文检测最多约 12 秒有限重试；明确检测成功后的编译/资源/注入失败不无限重试。不能保证任意异步站点加载时机与新增复杂节点保护。

设置页保存开启时申请可选 webNavigation；跨网站同时申请 HTTP/HTTPS host 权限；相同网站模式在网页小窗口点击应用时按需请求该网站 host。拒绝网站权限仍允许手动应用，自动能力可能只在 activeTab 临时授权有效时成立。后台无可选 API namespace 时不安装导航监听，授权后再安装，确保默认手动功能仍能启动。

新增 scripts/auto-browser-check.mjs、tests/auto.test.js 和 pnpm run test:browser:auto。独立 Edge 已实测 go-zero 入门页通用规则选择 main（含标题正文，不含左右导航），刷新后自动应用，点击环境安装后自动重新应用；实际下一页为 /zh-cn/getting-started/installation/。这两页结果不代表全站验证。Native 可选授权弹窗仍需日常浏览器手测；拒绝场景仅在 UI API 边界模拟。

### 3.3 在线主题与 ZIP 导入（0.4.0，2026-10-07）

用户明确授权范围：保留本地导入；支持 Typora 详情页、GitHub 仓库/Release、HTTPS ZIP 直链；ZIP 解包、多个主题选择、包内 import 与配套资源；下载后离线使用，保留来源/版本；不做全站商店、任意网站解析、自动更新或在线构建。

src/theme/online.js 按 URL 分类，Typora 用设置页 DOMParser 提取 Download，GitHub 用公开 API 列出 ZIP 附件；仓库没有合适发布包时取默认分支固定 commit 的 codeload 快照。显式 Release 不自动改版本。fetchBounded 用实际 host 权限检查、credentials omit、45 秒超时和流式大小限制。设置页同步从点击手势申请已知下载来源，发现额外域名时展示“授权并继续”；不向网页内容脚本开放下载接口，不登记自动应用标签页。

src/theme/zip-package.js 用本地打包的 fflate 0.8.3 解包；先检查 central/local metadata、路径、重复项、压缩方式、符号链接和解压容量，解压后校验 CRC。最多下载 48 MiB、解压累计 96 MiB、2048 条目、128 CSS；拒绝 ZIP64/加密/链接，仅提取 CSS 与支持的字体/图片。列出入口，引用过的 CSS 和文档/示例目录标注“依赖/示例”，不声称自动识别全部主题。

src/theme/css-package.js 用 PostCSS/value-parser 按依赖关系展开 import、保持顺序及重复引用语义；保留普通 @media 条件。修正每个 CSS 的 url 到包内统一路径，检测循环、缺失文件、越界、最大 16 层/256 引用，展开预算 8 MiB、最终 2 MiB。带 layer/supports 条件的 import 明确拒绝，远程 import 留给转换器跳过和报告。ZIP 仅将所选入口实际引用的本地资源送给原有签名/类型/容量校验，资源仍为最多 64 个、单个 16 MiB、合计 24 MiB。

options 增加链接获取、发布附件选择、ZIP 本地输入、CSS 入口选择及导入；原有本地 CSS/目录仍可用，目录中的 import 也会合并。repository 保存合并后未经过滤的 CSS 与资源到 IndexedDB，元信息新增 provenance（去 query/hash 的来源/下载 URL、version、entry、downloadedAt）。应用时不再联网，现有转换/布局保护/字体隔离/恢复保持原样。

验证：31 项 Node 测试；原 browser-check（含 Saurlax/全局背景）和 auto-browser-check（含 go-zero）通过；新增 online-browser-check.mjs 覆盖 Typora→Release→ZIP、多个附件/主题、commit 快照、ZIP 直链/本地包/目录依赖、失败不污染库、设置页重开后离线字体/图片应用/切换/恢复。在线测试使用可控 HTTPS 响应和独立 Edge 副本预授予权限；不等同于原生权限弹窗或所有真实来源都成功。

真实来源只读探测：Drake 默认分支快照下载与 drake-ayu.css→drake/font.css 合并成功，4 个资源、310 条正文规则；两个内嵌 SVG 引用仍因现有不支持规则进入报告。Lapis 与 Phycat 本次下载超时，未将其标记为兼容成功。网络/主题站结构变化仍可能导致获取失败，可使用本地 ZIP 兜底。

本轮更新源码/锁文件/说明/构建产物，不修改旧参考目录，不提交或推送。报告为 artifacts/online-browser-results.json，新增命令 pnpm run test:browser:online。必须只分发正式 dist，不分发测试副本。

### 3.4 可配置正文节点上限（2026-10-08）

统一配置新增 maxArticleNodes，默认 60,000，设置页提供“最大正文节点数”数字输入，允许 1–200,000 的整数。统计正文根及后代元素；保存后再次应用生效，恢复默认还原 60,000。旧版缺失配置和非法存储值回退默认值，修改其他偏好保留已保存的上限。超限错误显示实际配置并提示调整设置或缩小区域；失败切换继续保留旧主题。

验证：34 项 Node 测试及构建通过；独立 Edge 原浏览器回归（含全局背景、Saurlax）通过，无捕获未处理错误。新增检查覆盖 60,000 元素成功、12,000 自定义上限拒绝与旧主题回退、65,000 保存/设置页重开/应用、恢复默认、60,001 拒绝和撤销清理。报告 artifacts/browser-results.json。浏览器确认框测试改为等待识别完成后检查默认勾选，避免与异步自动勾选竞争。已更新正式 dist 与本地 0.4.0 ZIP，未提交或推送。

### 3.5 DeepSeek 分享页识别诊断（2026-10-09）

只读调查用户提供的 https://chat.deepseek.com/share/s9ol46mf6vaapo7hsn。独立 Edge 已加载真实分享内容，语义候选 article/main/[role=main] 为 0，回答使用 div.ds-assistant-message-main-content，调查时尚无 DeepSeek 适配，因此当时默认 locate 返回“未找到正文”。该页 .ds-markdown 共 2 个（思考过程与最终回答），直接使用它会触发多匹配拒绝。最终回答匹配 1 个，750 字、含根 124 元素，与节点预算无关。

独立正式构建测试副本实测：手动 .ds-assistant-message-main-content 定位成功，内置纸笺主题应用改变段落字体/颜色，恢复成功。只在测试副本授予 chat.deepseek.com host，不改正式 manifest、源码或 dist。证据 artifacts/deepseek-extension-diagnosis.json；当前结论仅覆盖此分享页，多轮登录聊天、流式输出和虚拟列表动态内容未验收。后续适配需明确单条回答与整个对话的范围，不能以选中整个 body 代替安全正文定位。

### 3.6 DeepSeek 自动识别与容器查找帮助（2026-10-09）

用户授权将已实测的 `.ds-assistant-message-main-content` 加入自动搜寻。新增 src/content/adapters/deepseek.js，只匹配 chat.deepseek.com，detector.js 优先使用该规则；适配候选保留全部匹配，再按原可见性/长度/范围检查筛选。单个可用回答自动定位，多条可用回答提示手动选择，目标不存在回退原 article/main/role=main；不自动取第一条、不扩展到整页 body。短于 80 字的正文门槛保持原样。

popup 新增“如何查找正文容器”折叠说明：正文右键检查→沿父元素选完整正文→复制选择器→粘贴识别并确认范围。提示唯一匹配、加载时机、避免 body/html 和动态类名/位置失效；未找到/多候选错误指向该说明。README 同步操作步骤及已验证范围。

34 项 Node 测试、构建通过。新增 scripts/deepseek-browser-check.mjs，命令 node scripts/deepseek-browser-check.mjs。真实分享页自动定位/内置主题应用/恢复通过；7 个浏览器夹具覆盖思考排除、隐藏回答、多回答拒绝、手动选单条、语义候选回退、其他域名相同类名不触发、普通 main 检测。弹窗帮助截图已检查，无捕获未处理错误；报告 artifacts/deepseek-browser-results.json。测试 host 仅在副本预授予，正式权限不变；已更新 dist 与本地 0.4.0 ZIP，未提交或推送。登录多轮聊天、流式/虚拟列表新增节点仍需另行验收。

### 3.7 导入候选与预检查修复（2026-10-12）

用户授权修复 VLOOK 候选过多、字体依赖误选与合并容量限制。zip-package.js 按 CSS 内容识别普通入口、字体-only、纯远程 import、空文件与语法问题；默认隐藏依赖/示例及非主题文件，“显示全部 CSS”仍可查看，非主题选项禁用。保留字体 CSS 和其他依赖用于合并，不按文件名盲删。

新增 theme/package-analysis.js 的只读 inspectPackageTheme：所选入口 prepare→资源验证→同配置预编译，返回合并大小、依赖、资源及报告；失败禁用导入。options 用版本号取消过期预检查，缓存当前成功准备结果；展示实际来源版本及依赖详情。所有单 CSS/最终合并/后台/编译/ZIP 入口共享 2 MiB 上限，展开预算同步为 8 MiB；资源/ZIP/条目上限不变。README 已同步候选说明及 IndexedDB/storage 查看步骤。

36 项 Node 测试、构建和 online-browser-check 通过；新增混合包夹具覆盖过滤、显示全部、字体/空/远程选项禁用、缺失/合并超限不写库、1.1MB CSS 保存、字体依赖仍加载，回归在线来源解析及设置页重开后离线字体/图片应用。截图 package-preflight.png 已检查，报告 online-browser-results.json 无捕获未处理错误。真实官方 V2026.10 CSS 和依赖通过 API 读取，未成功下载全 ZIP；Fancy 845217 字节、Thinking 1149766 字节、Note 735815 字节均通过预检查，约 0.7–0.9 秒（本机 Node 测量），fs-dyn-min 仍因无正文规则拒绝。报告 vlook-fix-results.json；主主题通过不等于视觉或专属插件功能兼容。

用户全局偏好“不主动生成 HTML，除非明确要求”已写入本机 Codex 的 C:/Users/56955/.codex/AGENTS.md；当前及后续说明默认文字/Markdown。已更新 dist 与本地 0.4.0 ZIP。2026-10-12 用户随后要求更新 AGENTS.md 并提交一次本地 commit：本次提交在线导入、入口预检查、节点上限、DeepSeek 适配、测试与文档；不推送，不包含忽略的构建产物、私人导学文件、旧项目或 article-service.js 中用户已有的学习注释。

### 3.8 页面阅读位置标签（0.5.0，2026-10-12）

用户确认只完成 1～3：选词/短句后“记录”，图标跟随文字所在行；可拖动/收起侧栏，删除最后一个标签自动关闭；随机预设颜色、默认递增名称、改名/改色/删除/跳转。自定义图标及设置页导入是未来需求，本轮未实现。按用户偏好未生成 HTML 解释页。

新增 src/shared/bookmark-policy.js（页面身份、字段校验、有界文本重定位）、src/bookmarks/repository.js（独立 local.pageBookmarksV1、串行读写、容量、递增名称、revision）、src/background/bookmark-service.js（固定文档注入与同文档 CRUD 校验）、src/content/bookmark-anchor.js（文本索引/选区/嵌套滚动）、bookmark-style.js（Shadow DOM 样式）、bookmarks.js（图标、选文按钮、侧栏、拖动、编辑、监听清理）。后台分发、popup、构建入口及 package 命令接入；不修改旧参考项目与用户 article-service.js 注释。

不需要主题应用。当前入口为设置页底部“开启页面标签”持久开关，选文点击网页“标记”；旧弹窗入口已移除。UI 位于正文外，不改原 ID 或重建正文；同一页面多次开启保持单实例。图标按选中文字的首行位置布局，不写死行号或像素高度。检索按全文签名/原偏移、选文前后 64 字上下文恢复，重复匹配不明确或文字删除时提示未找到。正文选择器明确指向另一容器时不得误用其中的相同文字。

普通标题 hash 共用同页标签；查询参数、#/ 与 #! 路由独立保存。主题切换/恢复保留标签；刷新/重开/浏览器重启后数据保留；开启设置开关后通过持久动态内容脚本自动启用，需可选 HTTP/HTTPS 网站授权，关闭后保留数据。同页多个已开启标签页通过 storage.onChanged 更新。页面路径变化释放 UI/事件/观察器；同页正文替换按已确认选择器重新定位。读写错误保留原存储并在网页提示。

容量为每页 100、全局 1000 标签、200 页面记录（含删除后保留递增编号的空页面）；存储预算约 150 万 JSON 字符，文本检索上限 100 万字符/3 万文本节点。名称最长 80 字、选文最多 256 字、颜色限定六位十六进制。选文和摘要仅存本机，未加入普通日志。没有导出/导入或跨浏览器同步，卸载会清除数据；未来需自行增加备份能力。

初版验证入口：新增 tests/bookmarks.test.js 和 scripts/bookmark-browser-check.mjs，命令 pnpm run test:browser:bookmarks。42 项 Node 测试通过；最终独立 Edge 的 17 项新增流程全部通过，包括跨内联节点选文、侧栏操作、字体变化/前文插入、正文替换、相同文字不同容器拒绝、输入控件排除、刷新、worker 重启和浏览器完整关闭重启。截图 bookmarks-sidebar.png、bookmarks-small-window.png 已检查；报告 bookmark-browser-results.json 无捕获错误。原本地主题/背景/配置回归通过；自动应用夹具与 go-zero 真实章节导航通过。Saurlax 真实页本轮连接关闭，不能报告通过。Chrome/联想浏览器和日常原生授权未实测。版本/README/构建包更新为 0.5.0，未提交或推送。

### 3.9 设置页顺序与标签开关调整（2026-10-12）

按用户要求将导入顺序改为本地 CSS/目录、本地 ZIP、链接；链接备注使用正确站点 theme.typora.io，说明整包可能含多个主题/配色，推荐下载查看后本地导入。两个标题分别改为“按照习惯微调部分”“主题沿用设置”。最大正文节点数移至页面底部，保留 settingsForm 关联与保存/重置行为，另有底部保存按钮和状态反馈。标签开关位于节点设置上方，弹窗不再显示开启按钮；选文按钮改为“标记”，文字/内边距/外框缩小至约原尺寸的 75%。

bookmarkSettings.enabled 独立持久保存；首次点击开启申请可选 HTTP/HTTPS host 授权，后台注册持久 document_idle 内容脚本并启用已有可访问网页。关闭会撤销注册并清理当前工具，标签数据保留；授权拒绝回退关闭，权限撤销同步关闭。正文不明确时不选整页；每次 URL 变化最多 20 次、间隔 1.5 秒尝试，弹窗手动识别成功可开启所选容器。没有增加正式必需权限或主题自动应用登记。

42 项现有 Node 测试和构建通过；标签独立 Edge 浏览器 18 项检查通过，覆盖布局顺序、底部节点保存、授权拒绝、自动启用、刷新/浏览器重启恢复、关闭清理与重新开启保留数据及原标签流程。在线/本地 ZIP 与目录导入浏览器回归也通过；检查最终设置页截图。测试仅在副本预授予 host，不代表原生授权弹窗已验收；报告 artifacts/bookmark-browser-results.json 和 online-browser-results.json。dist 与本地 0.5.0 ZIP 已同步。保留另一窗口所有标签代码与用户 article-service.js 注释，未提交或推送。

### 3.10 标题与标记框微调、准备本地提交（2026-10-12）

用户要求设置页主标题改为“让阅读变成你熟悉的样子”，选文“标记”浮框再缩至前次尺寸的 80%；使用整体 scale(.8)，不缩放侧栏和正文图标。更新 README 与 AGENTS 的分发说明：正式 dist 内容打包为根目录 typora-web-styler-0.5.0.zip，manifest 位于 ZIP 根目录。最终构建和标签浏览器 18 项检查通过，实际浮框宽度缩放比为 0.8，已检查按钮截图；重新打包并核对 ZIP 为 0.5.0、根目录含 manifest.json、没有测试 host_permissions。按用户要求将 0.5.0 标签功能、设置调整和文档提交一个本地 commit；不推送、不上传 Release，保留用户 article-service.js 学习注释在提交之外。

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

0.2 支持本地字体和可选的本地背景图片，可选择散文件或目录；0.4 新增在线/ZIP 导入与目录内 @import 合并，详见 3.3。远程资源和远程 import 不加载，跳过并报告；未被入口引用的 CSS 不会混合。字体通过二进制 FontFace 加入 document.fonts，图片使用验证后的 data URL；当前无头 Edge 扩展隔离环境在 font-src/img-src none 测试页仍加载成功，这是实际观察，不代表所有浏览器与资源来源均可绕过 CSP。日志按真实加载结果记录；损坏字体/图片会报告并回退。

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
  package-lock.json            # npm 锁文件（保持兼容）
  pnpm-lock.yaml              # pnpm 固定依赖与包管理器版本
  pnpm-workspace.yaml         # 根项目、缓存位置与构建脚本许可
  scripts/build.mjs
  scripts/browser-check.mjs    # 自动化测试扩展、夹具和目标站
  src/
    manifest.json             # 源 manifest，构建复制到 dist
    background/
      index.js                # 消息、权限和页面注入协调
      article-service.js      # 应用、切换、恢复及 CSS 注入记录
      auto-service.js         # 临时标签页登记、导航自动应用及暂停
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
    settings/auto-repository.js # 自动应用偏好与可选权限检查
    settings/background-repository.js # 独立背景图片与配置
    diagnostics/logger.js     # 有界持久日志、脱敏和串行存储
    shared/
      messages.js             # 可序列化消息契约
      style-policy.js         # 属性白名单、配置默认值及验证
      auto-policy.js          # 自动应用配置及网站范围契约
      background-policy.js    # 独立背景数值配置契约
    popup/                    # 应用、主题选择、恢复
    options/                  # 主题/本地资源导入、全局配置
    logs/                     # 日志筛选、搜索、导出及清空
    # 自定义图标暂未创建
  tests/
    compiler.test.js
    resources.test.js         # 1 MiB 边界、路径/字体/图片/代码映射与配置
    logs.test.js              # 日志次序、容量、脱敏、清空
    auto.test.js              # 开关、origin 边界与权限检查
    background.test.js        # 独立背景数值范围
    fixtures/                 # 测试主题及代表性 DOM
  dist/                       # 已构建输出，浏览器加载此目录
  artifacts/                  # 不入 Git：浏览器报告、截图、测试扩展副本
  markdown-viewer/            # 旧项目，默认只读参考，不进入新仓库和分发包
```

按需要逐步创建目录，不生成大量空模块冒充进度。构建只从 src/ 和显式依赖取文件，不递归打包整个根目录。

推荐命令：`pnpm install --frozen-lockfile`、`pnpm test`、`pnpm run build`、`pnpm run test:browser`；npm 原有命令仍可用。packageManager 固定 pnpm 12.3.4，pnpm-workspace.yaml 使用 allowBuilds 允许 esbuild，并将 store 放在 .cache/pnpm/store；根项目独立，不包含旧参考目录。同时维护 package-lock.json 与 pnpm-lock.yaml，依赖更新后可从 npm 锁执行 pnpm import。构建按依赖 owner 解析间接依赖位置，不能再假定所有许可证都在根 node_modules 中。系统 npm 缓存本次不可写，已使用项目内 .cache/npm；默认沙箱进程初始化错误，改用获准的执行方式完成开发。不要修改系统 npm 配置或旧构建脚本。

保护机制的当前限制：控件、公式、SVG/图表使用可撤销标记与继承样式快照保护；代码颜色改为统一配置的选定属性保护。网站会话期间的动态样式可能被保护盖住，不是完整动态隔离。新增复杂控件尚不自动补标记。正文元素上限由 globalSettings.maxArticleNodes 控制，默认 60,000；设置页可保存 1–200,000 的整数，含正文根元素，保存后再次应用生效。旧配置缺失或值非法时回退 60,000。交互/公式等保护边界的独立 1200 上限仍保留。rem 采用静态基准，媒体查询中的动态 html 字号未完整适配。未知语法保守跳过。变量和字体名称按会话隔离。

### 7.1 目录职责与查找入口（当前实际实现）

| 目录/文件 | 负责什么 | 要修改此行为时从哪里找 |
| --- | --- | --- |
| src/manifest.json | 插件名称、版本、权限、后台和界面入口 | 修改权限或加载入口看此源文件，不能只改 dist/manifest.json |
| src/background/index.js | 验证消息来源，分发 theme/article 请求，串行化主题写入与页面操作 | 新增扩展操作、检查请求参数和消息权限 |
| src/background/article-service.js | 固定 tab/document 注入目标，调度编译，插入/删除 CSS，处理失败与后台重启遗留状态 | 查应用、切换、恢复和注入失败问题 |
| src/background/auto-service.js、src/settings/auto-repository.js、src/shared/auto-policy.js | 临时标签页登记、范围/权限检查、导航重试、暂停恢复 | 查刷新或切页后自动应用、相同网站限制和授权问题 |
| src/bookmarks/repository.js、src/shared/bookmark-policy.js | 页面标签持久化、容量/字段校验、页面身份与文字锚点匹配 | 查标签丢失、命名、页面混淆、文字匹配 |
| src/content/bookmarks.js、bookmark-anchor.js、bookmark-style.js、src/background/bookmark-service.js | 页面标签 UI、正文内选文位置、滚动和受限消息注入 | 查选文记录、图标、拖动/编辑/删除/跳转和页面清理 |
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
| scripts/auto-browser-check.mjs | 独立 Edge 自动应用夹具及 go-zero 验证 | 查导航、延迟正文、登记/暂停与可选授权模拟 |
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

手动应用必需权限保持 activeTab、scripting、storage。0.3 自动应用按需申请可选 webNavigation：相同网站模式在手动应用时请求该网站 host 权限，跨网站模式在设置页保存时请求 HTTP/HTTPS host 权限；即使得到广泛授权，也只修改已登记标签页。默认不授予全部网站持久访问，关闭开关清除登记但不自动撤回已授予权限。受限浏览器页面和跨域 iframe 不支持。

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

0.3 已完成统一保留开关、本地资源/目录、日志、独立全局背景和临时标签页自动应用。后续完善通用检测和点选、独立永久站点规则、更复杂异步导航、动态新节点保护。在线/ZIP 资源包与包内 import 已在 0.4 实现。

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
| 2026-10-05 | 主题管理页与弹窗视觉更新：暖白/浅绿底色、圆润卡片、柔和按钮、自然文案；导入/收藏双栏、资源折叠、配置三组、主题数量显示、小屏布局、焦点与减少动画支持；同步 manifest/UI 展示名 | 独立 Edge 回归导入资源、全局配置、弹窗识别/应用/恢复、日志与 Saurlax 通过；检查桌面和小窗口截图。仅调整呈现及品牌展示，存储键和主题数据格式保持原样；需重新加载扩展及设置页 |
| 2026-10-05 | 新增 pnpm 12.3.4 支持、pnpm 锁及工作区配置；README 增加 pnpm 安装/测试/构建和 npm 兼容说明；构建按依赖所属包查找许可证，补充 LICENSE-MIT.txt 等文件名 | pnpm 冻结锁安装、16 项行为测试、构建通过；核对分发包含全部 8 项依赖许可证，并验证浏览器流程。保留 npm 锁和已有界面改动，不修改全局包管理配置 |

| 2026-10-05 | 新增独立全局背景：设置页上传/预览/删除用户图片，正文底色与图片不透明度分别调整；IndexedDB 独立记录、页面背景层与正文根覆盖，纳入主题切换/失败回退/恢复 | 18 项 Node 行为测试与构建通过；独立 Edge 的上传保存/刷新设置页/删除、双透明度、主题切换不叠层、根背景覆盖、失败回退、后台重启持久化、恢复与保留网站后改声明通过；原浏览器夹具及 Saurlax 回归通过，无未处理错误。已查看全局背景与设置页截图；正式权限流程及用户真实图片/复杂外层容器仍需日常浏览器确认。未提交/推送 |

| 2026-10-05 | 新增 0.3.0 临时标签页自动应用：设置页两层开关、成功手动应用后登记、刷新/导航/正文替换重识别、相同 origin 限制、跨站权限、恢复后暂停；成功识别默认勾选确认框 | 21 项 Node 测试与构建通过；独立 Edge 自动应用夹具及 go-zero 入门刷新/环境安装点击通过，原功能/背景/Saurlax 回归通过。已查看设置页与 go-zero 截图，无捕获的未处理错误。原生可选授权弹窗需日常浏览器手测；有限重试不保证任意异步站点。同步版本/文档与 npm 锁元信息，未增依赖、未提交/推送 |

| 2026-10-05 | 根据用户要求补齐 0.3.0 README 与 AGENTS 入口：ZIP 免构建安装、标签页开关操作、权限/暂停/升级说明及接手检查；同步修正本指南的 P1 与权限现状，并将功能和文档提交本地 commit | 核对已有原功能/背景/Saurlax 及自动应用/go-zero 报告均通过、无捕获的未处理错误；本次仅补文档，未重复运行浏览器测试。提交不包含 dist、ZIP、artifacts、缓存或旧项目，不推送 |

后续记录具体文件、行为变化、验证结果和未完成项。下一窗口先读取 README、browser-results.json 与 auto-browser-results.json；优先在用户日常浏览器确认正式可选权限、真实主题/背景和文档导航，再按需求推进 P1。不要重新从空项目开始。

## 15. 官方资料

- Typora 主题结构：https://theme.typora.io/doc/Write-Custom-Theme/
- Chrome 注入 API 与权限：https://developer.chrome.com/docs/extensions/reference/api/scripting
- CSS 长度与 rem 基准：https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length
