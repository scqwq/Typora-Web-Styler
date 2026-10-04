import { listThemes, importTheme, deleteTheme } from '../theme/repository.js';
import { operate, serialize, cleanupDocument } from './article-service.js';

// Only our extension UI may request theme changes or arbitrary tab operations.
chrome.runtime.onMessage.addListener((request, sender, reply) => {
  if (!request || typeof request.type !== 'string' || sender.id !== chrome.runtime.id) return;
  const uiOrigin = `chrome-extension://${chrome.runtime.id}/`;
  const isUI = sender.url?.startsWith(uiOrigin) && ['popup/index.html', 'options/index.html'].includes(sender.url.slice(uiOrigin.length).split(/[?#]/)[0]);
  let promise;
  if (request.type === 'article.cleanup' && sender.tab && sender.documentId) {
    promise = serialize(sender.tab.id, () => cleanupDocument(sender.tab.id, sender.documentId));
  } else if (!isUI) return;
  else if (request.type === 'theme.list') promise = listThemes().then(items => items.map(({ source, ...theme }) => theme));
  else if (request.type === 'theme.import') promise = serialize('themes', () => importTheme(request.name, request.source)).then(({ source, ...theme }) => theme);
  else if (request.type === 'theme.delete') promise = serialize('themes', () => deleteTheme(request.id));
  else if (['article.status', 'article.locate', 'article.apply', 'article.restore'].includes(request.type)) {
    if (!Number.isInteger(request.tabId) || request.tabId < 0 || (request.selector != null && (typeof request.selector !== 'string' || request.selector.length > 2000))) {
      reply({ ok: false, error: '无效页面参数。' }); return;
    }
    promise = serialize(request.tabId, () => operate(request.tabId, request));
  } else return;
  Promise.resolve(promise).then(value => reply({ ok: true, value }), error => reply({ ok: false, error: error.message || '操作失败。' }));
  return true;
});
