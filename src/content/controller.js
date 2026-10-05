import { locate, describe } from './detector.js';
import { annotate, undo, redo } from './annotator.js';
import { preserve, undoPreservation, redoPreservation } from './preservation.js';
import { loadResources, releaseFonts } from './resources.js';
import { captureReadability, checkReadability } from './contrast.js';
import { applyBackground, undoBackground, redoBackground } from './background.js';

if (!globalThis.__wmV1) {
  let active = null;
  let pending = null;
  let stagedCss = null;
  let stagedFaces = [];
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
    releaseFonts(stagedFaces); stagedFaces = [];
    if (pending) { undoBackground(pending.backgroundState); undoPreservation(pending.preservation); undo(pending.annotation.modifications); pending = null; }
    if (active) { undoBackground(active.backgroundState); undoPreservation(active.preservation); undo(active.annotation.modifications); releaseFonts(active.faces); if (active.css) retired.push(active.css); active = null; }
  }
  function checkSession() {
    if (active && (!active.root.isConnected || active.url !== pageUrl())) {
      end(); selected = null; notice = '页面或正文已变化，旧主题会话已结束。';
      chrome.runtime.sendMessage({ type: 'article.cleanup' }).catch(() => {});
    }
  }
  function watch() {
    stopWatching();
    const check = checkSession;
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
    async dispatch(command) {
      switch (command.type) {
        case 'status':
          checkSession();
          return { documentToken, active: !!active, pending: !!pending, themeId: active?.themeId, description: active ? describe(active.root) : null, notice, css: active?.css, sessionId: active?.id, retired: [...retired], stagedCss };
        case 'locate': {
          selected = locate(document, command.selector); selectedUrl = pageUrl(); notice = '';
          // A browser animation changes no DOM attributes and is cancelled automatically.
          previewAnimation?.cancel();
          if (command.preview !== false) previewAnimation = selected.animate([{ outline: '3px solid #8b5cf6', outlineOffset: '4px' }, { outline: '3px solid transparent', outlineOffset: '4px' }], { duration: 1800 });
          return { documentToken, description: describe(selected) };
        }
        case 'prepare': {
          if (pending) throw new Error('已有正在应用的主题，请稍后重试。');
          const root = validateSelection(command.selector);
          previewAnimation?.cancel(); previewAnimation = null;
          if (active) {
            if (active.root !== root) throw new Error('切换正文区域前请先恢复当前主题。');
            undoBackground(active.backgroundState); undoPreservation(active.preservation); undo(active.annotation.modifications);
          }
          let annotation;
          try {
            const readability = captureReadability(root);
            annotation = annotate(root, command.sessionId);
            const preservation = preserve(root, command.settings);
            pending = { id: command.sessionId, root, url: pageUrl(), annotation, readability, preservation };
            return { documentToken, id: pending.id, protectionCss: annotation.css, protectedCount: annotation.protectedCount, preservedCount: preservation.length };
          } catch (error) {
            if (annotation) undo(annotation.modifications);
            if (active) { redo(active.annotation.modifications); redoPreservation(active.preservation); redoBackground(active.backgroundState); }
            throw error;
          }
        }
        case 'stage': {
          if (!pending || pending.id !== command.sessionId) throw new Error('没有准备好的主题会话。');
          const next = pending;
          stagedCss = command.css;
          const loaded = await loadResources(command.fonts, command.images);
          if (pending !== next || !next.root.isConnected || next.url !== pageUrl()) { releaseFonts(loaded.faces); throw new Error('资源加载期间页面已变化。'); }
          stagedFaces = loaded.faces;
          if (command.background) {
            const checked = await loadResources([], [command.background.image]);
            if (pending !== next || !next.root.isConnected || next.url !== pageUrl()) throw new Error('背景加载期间页面已变化。');
            if (checked.failures.length) throw new Error(`自定义背景加载失败：${checked.failures.join('；')}`);
            next.background = command.background;
          }
          return { fontLoaded: loaded.faces.length, failures: loaded.failures };
        }
        case 'validate': {
          if (pending?.background) pending.backgroundState = applyBackground(pending.root, pending.background);
          checkReadability((pending ?? active)?.readability ?? []); return {};
        }
        case 'commit': {
          const next = pending ?? active;
          if (!next || next.id !== command.sessionId || !next.root.isConnected || next.url !== pageUrl()) {
            throw new Error('页面已变化，应用已取消。');
          }
          if (active?.css && active.css !== command.css) retired.push(active.css);
          releaseFonts(active?.faces);
          active = { ...next, css: command.css, themeId: command.themeId, faces: stagedFaces };
          stagedFaces = [];
          pending = null; stagedCss = null; watch(); return { active: true };
        }
        case 'rollback':
          if (pending) { undoBackground(pending.backgroundState); undoPreservation(pending.preservation); undo(pending.annotation.modifications); pending = null; }
          releaseFonts(stagedFaces); stagedFaces = [];
          if (active) { redo(active.annotation.modifications); redoPreservation(active.preservation); redoBackground(active.backgroundState); }
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
