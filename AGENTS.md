# Typora Web Styler 工作入口

开始工作前必须读取根目录 [AEGNTS.md](AEGNTS.md)，其中记录新项目目标、用户决策、技术路线、实际进度、目录规划和接力要求。本文件适用于新项目根目录及新源码。

项目名称为 **Typora Web Styler**。`markdown-viewer/` 是用户迁入的旧项目参考目录，默认只读；其指南只适用于旧代码，不决定新项目需求。新插件不要求保留旧项目的 Markdown 原文渲染功能。

用户最新指令优先。保护新旧项目已有修改。更新接手信息时修改 AEGNTS.md，避免重复维护完整指南。

当前版本为 0.3.0；快速开始见 [README.md](README.md)。主题转换、资源、统一配置、全局背景、标签页自动应用、日志的目录职责及验证边界均记录在 AEGNTS.md。构建入口为 `npm run build`，浏览器加载 `dist/`；不要运行旧项目的 Bash 打包脚本。

接手 0.3.0 时注意：

- 设置页的自动应用开关只保存偏好；小窗口成功手动应用后才登记标签页。第二个开关限制为最初的 origin，不按网址或标题猜测标签页身份。
- 临时登记使用 `chrome.storage.session`。恢复原样暂停当前标签页，手动应用后恢复；关闭标签页、浏览器重启或扩展重载会清除登记。
- 必需权限仍为 activeTab/scripting/storage；webNavigation 和 HTTP/HTTPS host 权限均为可选。测试副本预授予权限不能进入正式 dist 或安装包。
- 校验使用 `pnpm test`、`pnpm run build`、`pnpm run test:browser`、`pnpm run test:browser:auto`。报告分别是 artifacts/browser-results.json 和 artifacts/auto-browser-results.json；不要把独立 Edge 测试等同于用户浏览器的原生授权弹窗验收。
- 提交源码、测试、版本元信息及文档；dist、ZIP、artifacts、缓存和旧参考项目按忽略规则保留在本地。完整设计和后续事项继续统一维护在 AEGNTS.md。
