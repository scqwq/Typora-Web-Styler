import { BOOKMARK_COLORS, MAX_BOOKMARKS_PER_PAGE, bookmarkPage, validateAnchor, validatePatch, validateLayout } from '../shared/bookmark-policy.js';

const KEY = 'pageBookmarksV1';
let queue = Promise.resolve();
function serialized(task) {
  const next = queue.catch(() => {}).then(task);
  queue = next; return next;
}
async function read() {
  const saved = (await chrome.storage.local.get(KEY))[KEY];
  if (!saved) return { version: 1, pages: [] };
  if (saved.version !== 1 || !Array.isArray(saved.pages)) throw new Error('标签数据版本不受支持，请勿覆盖原数据。');
  return structuredClone(saved);
}
function empty(page) { return { page, next: 1, revision: 0, items: [], layout: null }; }
export function listBookmarks(page) {
  page = bookmarkPage(page);
  return serialized(async () => (await read()).pages.find(item => item.page === page) ?? empty(page));
}
export function changeBookmarks(page, operation, request) {
  page = bookmarkPage(page);
  return serialized(async () => {
    const store = await read();
    let record = store.pages.find(item => item.page === page);
    if (!record) {
      if (operation !== 'create') throw new Error('当前页面没有标签。');
      if (store.pages.length >= 200) throw new Error('已达到 200 个页面的标签上限。');
      record = empty(page); store.pages.push(record);
    }
    if (operation === 'create') {
      if (record.items.length >= MAX_BOOKMARKS_PER_PAGE || store.pages.reduce((count, item) => count + item.items.length, 0) >= 1000) throw new Error('标签数量已达上限，请先删除不需要的标签。');
      const anchor = validateAnchor(request.anchor);
      if (typeof request.selector !== 'string' || request.selector.length > 2000) throw new Error('正文选择器无效。');
      const colors = BOOKMARK_COLORS.filter(color => color !== record.items.at(-1)?.color);
      record.items.push({ id: crypto.randomUUID(), name: `标签${record.next++}`, color: colors[Math.floor(Math.random() * colors.length)], anchor, selector: request.selector, createdAt: Date.now() });
      record.layout = record.layout ? { ...record.layout, collapsed: false } : null;
    } else if (operation === 'layout') record.layout = validateLayout(request.layout);
    else {
      const index = record.items.findIndex(item => item.id === request.id);
      if (index < 0) throw new Error('标签已删除，请刷新侧栏。');
      if (operation === 'update') Object.assign(record.items[index], validatePatch(request.patch));
      else if (operation === 'delete') record.items.splice(index, 1);
      else throw new Error('未知标签操作。');
    }
    record.revision = (record.revision ?? 0) + 1;
    if (JSON.stringify(store).length > 1500000) throw new Error('标签存储空间已达上限。');
    await chrome.storage.local.set({ [KEY]: store });
    return record;
  });
}
