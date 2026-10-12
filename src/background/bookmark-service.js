import { listBookmarks, changeBookmarks } from '../bookmarks/repository.js';
import { bookmarkPage } from '../shared/bookmark-policy.js';

export async function openBookmarks(request) {
  if (!Number.isInteger(request.tabId) || request.tabId < 0 || typeof request.selector !== 'string' || request.selector.length > 2000) throw new Error('无效页面参数。');
  const results = await chrome.scripting.executeScript({ target: { tabId: request.tabId }, files: ['content/bookmarks.js'] });
  const documentId = results[0]?.documentId;
  if (!documentId) throw new Error('网页已变化，请重新识别正文。');
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: request.tabId, documentIds: [documentId] }, func: async selector => {
    try { return { ok: true, value: await globalThis.__wmBookmarks.open(selector) }; }
    catch (error) { return { ok: false, error: error.message }; }
  }, args: [request.selector] });
  if (!result?.ok) throw new Error(result?.error || '无法打开页面标签。');
  return result.value;
}

export async function bookmarkRequest(request, sender) {
  if (!sender.tab || sender.frameId !== 0 || !sender.documentId) throw new Error('标签操作仅支持当前主页面。');
  // Execute against the exact sending document, so an old page cannot write after navigation.
  const results = await chrome.scripting.executeScript({ target: { tabId: sender.tab.id, documentIds: [sender.documentId] }, func: () => location.href });
  const page = bookmarkPage(results[0]?.result ?? '');
  if (request.page !== page) throw new Error('页面已变化，请重新打开页面标签。');
  const operation = request.type.slice('bookmark.'.length);
  if (operation === 'list') return listBookmarks(page);
  if (!['create', 'update', 'delete', 'layout'].includes(operation)) throw new Error('未知标签操作。');
  return changeBookmarks(page, operation, request);
}

const BOOKMARK_SCRIPT_ID = 'wm-page-bookmarks';
const BOOKMARK_ORIGINS = ['http://*/*', 'https://*/*'];
export async function getBookmarkSettings() {
  const stored = await chrome.storage.local.get('bookmarkSettings');
  return { enabled: stored.bookmarkSettings?.enabled === true && await chrome.permissions.contains({ origins: BOOKMARK_ORIGINS }) };
}
export async function syncBookmarkStartup() {
  const { enabled } = await getBookmarkSettings();
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [BOOKMARK_SCRIPT_ID] });
  if (enabled && !registered.length) await chrome.scripting.registerContentScripts([{
    id: BOOKMARK_SCRIPT_ID, matches: BOOKMARK_ORIGINS, js: ['content/bookmarks.js'], runAt: 'document_idle', persistAcrossSessions: true
  }]);
  if (!enabled && registered.length) await chrome.scripting.unregisterContentScripts({ ids: [BOOKMARK_SCRIPT_ID] });
  return { enabled };
}
export async function setBookmarkSettings(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('页面标签开关无效。');
  if (enabled && !await chrome.permissions.contains({ origins: BOOKMARK_ORIGINS })) throw new Error('未取得网站访问授权，页面标签未开启。');
  const previous = (await chrome.storage.local.get('bookmarkSettings')).bookmarkSettings;
  await chrome.storage.local.set({ bookmarkSettings: { enabled } });
  try { await syncBookmarkStartup(); }
  catch (error) { await chrome.storage.local.set({ bookmarkSettings: previous ?? { enabled: false } }); await syncBookmarkStartup().catch(() => {}); throw error; }
  const tabs = await chrome.tabs.query({});
  // Existing tabs start immediately; future documents use the registered script.
  await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(async tab => {
    if (enabled) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/bookmarks.js'] });
    else await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      globalThis.__wmBookmarkStartup?.setEnabled(false); globalThis.__wmBookmarks?.dispose();
    } });
  }));
  return { enabled };
}
