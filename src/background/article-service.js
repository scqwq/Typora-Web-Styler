import { compileTheme } from '../theme/compiler.js';
import { getTheme } from '../theme/repository.js';
import { getSettings } from '../settings/repository.js';

const locks = new Map();
export function serialize(tabId, task) {
  const previous = locks.get(tabId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  locks.set(tabId, next);
  next.finally(() => { if (locks.get(tabId) === next) locks.delete(tabId); }).catch(() => {});
  return next;
}
async function bootstrap(tabId) {
  const result = await chrome.scripting.executeScript({ target: { tabId }, files: ['content/controller.js'] });
  if (!result[0]?.documentId) throw new Error('无法取得当前页面文档。请刷新网页后再试。');
  return { tabId, documentIds: [result[0].documentId] };
}
async function command(target, payload) {
  const result = await chrome.scripting.executeScript({ target, func: async data => {
    try { return { ok: true, value: await globalThis.__wmV1.dispatch(data) }; }
    catch (error) { return { ok: false, error: error.message }; }
  }, args: [payload] });
  if (!result[0]?.result?.ok) throw new Error(result[0]?.result?.error || '网页已变化或暂时无法访问。');
  return result[0].result.value;
}
async function cleanup(target, cssList) {
  const removed = [];
  for (const css of cssList ?? []) {
    await chrome.scripting.removeCSS({ target, css, origin: 'AUTHOR' }); removed.push(css);
  }
  if (removed.length) await command(target, { type: 'ackCleanup', css: removed });
}
export async function operate(tabId, request) {
  const target = await bootstrap(tabId);
  let status = await command(target, { type: 'status' });
  // A terminated worker can leave an uncommitted insertion. The page records it before injection.
  if (status.stagedCss || status.pending) {
    if (status.stagedCss) await chrome.scripting.removeCSS({ target, css: status.stagedCss, origin: 'AUTHOR' });
    await command(target, { type: 'rollback' });
    status = await command(target, { type: 'status' });
  }
  await cleanup(target, status.retired);
  if (request.documentToken && request.documentToken !== status.documentToken) throw new Error('网页已导航，请重新识别正文。');
  switch (request.type) {
    case 'article.status': return status;
    case 'article.locate': return command(target, { type: 'locate', selector: request.selector ?? '' });
    case 'article.restore': {
      const ended = await command(target, { type: 'restore' }); await cleanup(target, ended.retired); return { active: false };
    }
    case 'article.apply': {
      if (!request.documentToken) throw new Error('请先识别并确认正文。');
      const theme = await getTheme(request.themeId);
      const settings = await getSettings();
      const sessionId = crypto.randomUUID();
      const compiled = compileTheme(theme.source, { sessionId, settings, bundle: theme.bundle });
      const prepared = await command(target, { type: 'prepare', selector: request.selector ?? '', sessionId, settings });
      const css = `${compiled.css}\n${prepared.protectionCss}`;
      let inserted = false;
      let resources;
      try {
        resources = await command(target, { type: 'stage', sessionId, css, fonts: compiled.fonts, images: compiled.images });
        await chrome.scripting.insertCSS({ target, css, origin: 'AUTHOR' }); inserted = true;
        await command(target, { type: 'validate' });
        // Commit before deleting the old style so a failed insertion never destroys the existing theme.
        await command(target, { type: 'commit', sessionId, css, themeId: theme.id });
      } catch (error) {
        if (inserted) await chrome.scripting.removeCSS({ target, css, origin: 'AUTHOR' }).catch(() => {});
        await command(target, { type: 'rollback' }).catch(() => {}); throw error;
      }
      const committed = await command(target, { type: 'status' });
      await cleanup(target, committed.retired);
      return { active: true, themeId: theme.id, report: compiled.report, protectedCount: prepared.protectedCount, preservedCount: prepared.preservedCount, settings, resources };
    }
    default: throw new Error('未知页面操作。');
  }
}
export async function cleanupDocument(tabId, documentId) {
  if (!documentId) return;
  const target = { tabId, documentIds: [documentId] };
  const status = await command(target, { type: 'status' });
  await cleanup(target, status.retired);
}
