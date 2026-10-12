# Typora Web Styler 工作入口

开始工作前必须读取根目录 [AEGNTS.md](AEGNTS.md)，其中记录新项目目标、用户决策、技术路线、实际进度、目录规划和接力要求。本文件适用于新项目根目录及新源码。

项目名称为 **Typora Web Styler**。`markdown-viewer/` 是用户迁入的旧项目参考目录，默认只读；其指南只适用于旧代码，不决定新项目需求。新插件不要求保留旧项目的 Markdown 原文渲染功能。

用户最新指令优先。保护新旧项目已有修改。更新接手信息时修改 AEGNTS.md，避免重复维护完整指南。不要主动生成 HTML 解释页、可视化页面或 HTML 文档；只有用户明确要求时才生成，默认使用文字或 Markdown。

当前版本为 0.5.0；快速开始见 [README.md](README.md)。主题转换、资源、统一配置、全局背景、标签页自动应用、日志的目录职责及验证边界均记录在 AEGNTS.md。构建入口为 `npm run build`，浏览器加载 `dist/`；不要运行旧项目的 Bash 打包脚本。

接手 0.3.0 时注意：

- 设置页的自动应用开关只保存偏好；小窗口成功手动应用后才登记标签页。第二个开关限制为最初的 origin，不按网址或标题猜测标签页身份。
- 临时登记使用 `chrome.storage.session`。恢复原样暂停当前标签页，手动应用后恢复；关闭标签页、浏览器重启或扩展重载会清除登记。
- 必需权限仍为 activeTab/scripting/storage；webNavigation 和 HTTP/HTTPS host 权限均为可选。测试副本预授予权限不能进入正式 dist 或安装包。
- 校验使用 `pnpm test`、`pnpm run build`、`pnpm run test:browser`、`pnpm run test:browser:auto`。报告分别是 artifacts/browser-results.json 和 artifacts/auto-browser-results.json；不要把独立 Edge 测试等同于用户浏览器的原生授权弹窗验收。
- 提交源码、测试、版本元信息及文档；dist、ZIP、artifacts、缓存和旧参考项目按忽略规则保留在本地。完整设计和后续事项继续统一维护在 AEGNTS.md。

接手 0.4.0：

- 设置页新增从链接/本地 ZIP 导入；在线获取只在扩展设置页执行，按需申请来源 host 权限，不允许内容脚本请求任意下载。
- theme/online.js 负责受支持的链接与有界下载，zip-package.js 负责 ZIP 校验/解包和入口资源，css-package.js 负责包内 import 展开/路径修正；沿用 repository.js 的串行主题保存和正文转换。
- 包内 import 支持普通媒体条件；远程 import 不下载，layer/supports 条件暂拒绝。默认隐藏依赖/示例 CSS，纯字体、纯远程 import、空文件和语法错误项不可作为入口，但包内依赖仍参与合并。package-analysis.js 对当前入口完成资源验证与预编译，成功后才允许导入；预检查通过不代表完整视觉兼容。
- 单 CSS 和最终合并 CSS 共用 resources.js 的 2 MiB 上限，展开预算为 8 MiB；调整容量时同步校验、编译、ZIP 和界面，不能只修改一处。主题元信息保存于 chrome.storage.local 的 themes；合并源码和资源保存于 IndexedDB web-markdown-themes/bundles，不保存原始下载 ZIP。
- 正文节点上限默认 60,000，可在设置页调整为 1–200,000；旧配置缺失时使用默认值。DeepSeek 自动识别仅针对 chat.deepseek.com 的 .ds-assistant-message-main-content，多条可用回答要求手动选择；弹窗提供容器查找说明。
- 在线浏览器验证用 pnpm run test:browser:online，报告 artifacts/online-browser-results.json；DeepSeek 验证用 node scripts/deepseek-browser-check.mjs，报告 artifacts/deepseek-browser-results.json。当前 Node 测试共 36 项，已验证入口筛选、预检查、字体依赖和容量边界；真实 VLOOK 同版本 CSS 合并通过，不代表整包下载及所有视觉效果已验收。测试专用 host 权限和网络夹具不可进入正式包；真实来源下载情况见 AEGNTS.md。
- 用户学习文件 导学.md 按 .gitignore 保留在本地。提交前检查无关用户修改，不将其混入功能提交；本地 commit 不代表获得推送授权。

接手 0.5.0 页面标签：

- 用户授权范围为选文记录、随文字显示图标、可拖动/收起侧栏、标签改名/改色/删除/跳转；自定义图标尚未实现。
- src/bookmarks/repository.js 独立使用 local.pageBookmarksV1，所有读写串行；不要混入主题或 session.autoTabs。页面身份保留查询参数与 #/、#! 路由，普通 heading hash 共用。
- content/bookmarks.js 独立于主题 controller，Shadow DOM UI 位于正文外。删除最后一个标签关闭侧栏但保留选文监听；设置页底部 bookmarkSettings 开关控制持久自动注入，刷新后自动恢复，关闭仅移除工具不删除数据。首次开启申请可选 HTTP/HTTPS host 权限；正文识别不明确时跳过，弹窗手动识别可启用。恢复主题不删除书签。
- bookmark-service.js 只允许扩展 UI 打开工具，内容脚本 CRUD 仅限发送方主文档；必须核对当前 documentId/URL，不允许网页传任意 tab/url。
- pnpm run test:browser:bookmarks 覆盖侧栏、内层滚动、选文恢复、持久化与原内容失效反馈；报告 artifacts/bookmark-browser-results.json。开关浏览器测试仅在副本预授予 HTTP/HTTPS host 权限，正式 manifest 不增加必需权限。

交付 0.5.0 时注意：

- 设置页主标题为“让阅读变成你熟悉的样子”；选文“标记”浮框在前次缩小后再整体缩至 80%，侧栏和正文图标不缩放。
- 当前 Node 测试为 42 项。Release 上传根目录 typora-web-styler-0.5.0.zip：由正式 dist 内容打包，manifest.json 位于 ZIP 根目录。不要上传测试副本、缓存、artifacts 或私人导学文件。ZIP 按忽略规则保留本地，不纳入源码 commit。
