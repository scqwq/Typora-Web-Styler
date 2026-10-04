import { locate, describe } from './detector.js';
import { annotate, undo } from './annotator.js';
import { captureReadability, checkReadability } from './contrast.js';

if (!globalThis.__wmV1) {
  let active = null;
  let pending = null;
  let stagedCss = null;
  let selected = null;
  let selectedUrl = null;
  let retired = [];
  let observer = null;
  let timer = null;
  let notice = '';
  let previewAnimation = null;
  const documentToken = crypto.randomUUID();
  const pageUrl = () => location.href.split('#')[0];
  function stopWatching() { observer?.disconnect(); observer = null; clearInterval(timer); timer = null; }
  function end() {
    stopWatching();
    previewAnimation?.cancel(); previewAnimation = null;
    if (stagedCss) { retired.push(stagedCss); stagedCss = null; }
    if (active) { undo(active.annotation.modifications); if (active.css) retired.push(active.css); active = null; }
    if (pending) { undo(pending.annotation.modifications); pending = null; }
  }
  function watch() {
    stopWatching();
    const check = () => {
      if (active && (!active.root.isConnected || active.url !== pageUrl())) {
        end(); selected = null; notice = '页面或正文已变化，主题会话已结束，请重新识别。';
        chrome.runtime.sendMessage({ type: 'article.cleanup' }).catch(() => {});
      }
    };
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timer = setInterval(check, 1000);
  }
  function validateSelection(selector) {
    const root = locate(document, selector);
    if (selected !== root || selectedUrl !== pageUrl()) throw new Error('请先识别并确认当前正文，再应用主题。');
    return root;
  }
  globalThis.__wmV1 = {
    dispatch(command) {
      switch (command.type) {
        case 'status':
          return { documentToken, active: !!active, themeId: active?.themeId, description: active ? describe(active.root) : null, notice, css: active?.css, sessionId: active?.id, retired: [...retired], stagedCss };
        case 'locate': {
          selected = locate(document, command.selector); selectedUrl = pageUrl(); notice = '';
          // A browser animation changes no DOM attributes and is cancelled automatically.
          previewAnimation?.cancel();
          previewAnimation = selected.animate([{ outline: '3px solid #8b5cf6', outlineOffset: '4px' }, { outline: '3px solid transparent', outlineOffset: '4px' }], { duration: 1800 });
          return { documentToken, description: describe(selected) };
        }
        case 'prepare': {
          if (pending) throw new Error('已有正在应用的主题，请稍后重试。');
          const root = validateSelection(command.selector);
          previewAnimation?.cancel(); previewAnimation = null;
          if (active) {
            if (active.root !== root) throw new Error('切换正文区域前请先恢复当前主题。');
            return { documentToken, id: active.id, protectionCss: active.annotation.css, protectedCount: active.annotation.protectedCount };
          }
          const readability = captureReadability(root);
          const annotation = annotate(root, command.sessionId);
          pending = { id: command.sessionId, root, url: pageUrl(), annotation, readability };
          return { documentToken, id: pending.id, protectionCss: annotation.css, protectedCount: annotation.protectedCount };
        }
        case 'stage':
          if (!(pending ?? active) || (pending ?? active).id !== command.sessionId) throw new Error('没有准备好的主题会话。');
          stagedCss = command.css; return {};
        case 'validate':
          checkReadability((pending ?? active)?.readability ?? []); return {};
        case 'commit': {
          const next = pending ?? active;
          if (!next || next.id !== command.sessionId || !next.root.isConnected || next.url !== pageUrl()) {
            if (pending) { undo(pending.annotation.modifications); pending = null; }
            throw new Error('页面已变化，应用已取消。');
          }
          if (active?.css && active.css !== command.css) retired.push(active.css);
          active = { ...next, css: command.css, themeId: command.themeId };
          pending = null; stagedCss = null; watch(); return { active: true };
        }
        case 'rollback':
          if (pending) { undo(pending.annotation.modifications); pending = null; }
          stagedCss = null;
          return {};
        case 'restore':
          end(); notice = ''; return { retired: [...retired] };
        case 'ackCleanup':
          retired = retired.filter(css => !command.css.includes(css)); return {};
        default: throw new Error('未知正文操作。');
      }
    }
  };
}
