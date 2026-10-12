import { locate } from './detector.js';
import { bookmarkPage } from '../shared/bookmark-policy.js';
import { textIndex, captureAnchor, resolveAnchor, firstRect, scrollToRange } from './bookmark-anchor.js';
import { bookmarkStyle } from './bookmark-style.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function button(className, text, label = text) {
  const node = element('button', className, text); node.type = 'button'; node.setAttribute('aria-label', label); return node;
}
function bookmarkIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M4 1h12a2 2 0 0 1 2 2v20l-8-5-8 5V3a2 2 0 0 1 2-2z');
  svg.append(path); return svg;
}

class PageBookmarks {
  constructor() { this.session = null; this.openSequence = 0; }

  async open(selector) {
    const sequence = ++this.openSequence;
    const page = bookmarkPage(location.href);
    const root = locate(document, selector);
    const record = await this.request('list', page);
    if (sequence !== this.openSequence || bookmarkPage(location.href) !== page || !root.isConnected) throw new Error('页面已变化，请重新打开页面标签。');
    this.dispose();
    const abort = new AbortController();
    const host = element('div'); host.setAttribute('data-wm-bookmarks', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = element('style'); style.textContent = bookmarkStyle; shadow.append(style);
    document.documentElement.append(host);
    const s = this.session = { root, selector, page, record, host, shadow, abort, markers: new Map(), ranges: new Map(), index: null, dirty: true, busy: false, frame: 0, editor: null, flash: null };
    s.toolbar = element('div', 'surface toolbar'); s.toolbar.hidden = true;
    s.recordButton = button('record', '标记', '标记选中文字的位置'); s.toolbar.append(s.recordButton); shadow.append(s.toolbar);
    s.recordButton.addEventListener('pointerdown', event => event.preventDefault());
    s.recordButton.addEventListener('click', () => this.add());
    s.toast = element('div', 'surface toast'); s.toast.hidden = true; s.toast.setAttribute('role', 'status'); s.toast.setAttribute('aria-live', 'polite'); shadow.append(s.toast);
    const listen = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: abort.signal });
    listen(document, 'selectionchange', () => this.selection());
    listen(document, 'scroll', () => this.schedule(), { capture: true, passive: true });
    listen(window, 'resize', () => { this.positionPanel(); this.schedule(); });
    listen(window, 'hashchange', () => this.check());
    listen(window, 'popstate', () => this.check());
    listen(window, 'pagehide', () => this.dispose());
    listen(document, 'load', () => this.schedule(), { capture: true });
    listen(document, 'keydown', event => { if (event.key === 'Escape') { s.toolbar.hidden = true; this.cancelEditor(); } });
    if (document.fonts) listen(document.fonts, 'loadingdone', () => this.schedule());
    s.observer = new MutationObserver(changes => {
      if (!this.check()) return;
      if (changes.some(change => s.root.contains(change.target))) { s.dirty = true; this.schedule(true); }
    });
    s.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class', 'style'] });
    s.resize = new ResizeObserver(() => this.schedule()); s.resize.observe(root);
    s.timer = setInterval(() => this.check(), 700);
    s.storageListener = (changes, area) => {
      if (area === 'local' && changes.pageBookmarksV1 && !s.busy && !s.editor) this.reload().catch(error => this.notify(error.message));
    };
    chrome.storage.onChanged.addListener(s.storageListener);
    this.render(); this.selection();
    this.notify(record.items.length ? '已恢复页面标签。选取文字后可继续记录。' : '选取正文中的词或短句，然后点击“标记”。');
    return { count: record.items.length };
  }

  async request(operation, page, fields = {}) {
    const result = await chrome.runtime.sendMessage({ type: `bookmark.${operation}`, page, ...fields });
    if (!result?.ok) throw new Error(result?.error || '标签工具暂时不可用，请重新加载扩展。');
    return result.value;
  }

  check() {
    const s = this.session;
    if (!s) return false;
    if (bookmarkPage(location.href) !== s.page) { this.dispose(); return false; }
    if (!s.host.isConnected) { this.dispose(); return false; }
    if (!s.root.isConnected) {
      try {
        s.root = locate(document, s.selector); s.resize.disconnect(); s.resize.observe(s.root); s.dirty = true; this.schedule(true);
      } catch {
        for (const marker of s.markers.values()) marker.hidden = true;
        s.toolbar.hidden = true;
      }
    }
    return true;
  }

  dispose() {
    const s = this.session;
    if (!s) return;
    s.abort.abort(); s.observer.disconnect(); s.resize.disconnect();
    chrome.storage.onChanged.removeListener(s.storageListener);
    clearInterval(s.timer); clearTimeout(s.toastTimer); clearTimeout(s.flashTimer); clearTimeout(s.rebuildTimer);
    cancelAnimationFrame(s.frame); s.host.remove(); this.session = null;
  }

  notify(message) {
    const s = this.session; if (!s) return;
    clearTimeout(s.toastTimer); s.toast.textContent = message; s.toast.hidden = false;
    s.toastTimer = setTimeout(() => { s.toast.hidden = true; }, 4500);
  }

  selection() {
    const s = this.session; if (!this.check() || s.busy) return;
    const selection = document.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) { s.selection = null; s.toolbar.hidden = true; return; }
    const range = selection.getRangeAt(0);
    if (!s.root.contains(range.startContainer) || !s.root.contains(range.endContainer) || !range.toString().trim() || range.startContainer.parentElement?.closest('button, input, textarea, [contenteditable]:not([contenteditable="false"])')) {
      s.selection = null; s.toolbar.hidden = true; return;
    }
    s.selection = range.cloneRange(); this.positionToolbar();
  }

  positionToolbar() {
    const s = this.session;
    if (!s?.selection) return;
    const rect = firstRect(s.selection);
    if (!rect || rect.bottom < 0 || rect.top > innerHeight) { s.toolbar.hidden = true; return; }
    s.toolbar.hidden = false;
    s.toolbar.style.left = `${Math.max(8, Math.min(innerWidth - 100, rect.left))}px`;
    s.toolbar.style.top = `${Math.max(8, Math.min(innerHeight - 50, rect.bottom + 6))}px`;
  }

  async mutate(operation, fields) {
    const s = this.session;
    if (!this.check() || s.busy) return false;
    s.busy = true;
    for (const control of s.shadow.querySelectorAll('button, input')) control.disabled = true;
    try {
      const record = await this.request(operation, s.page, fields);
      if (this.session !== s || !this.check()) return false;
      s.record = record; return true;
    } catch (error) { this.notify(error.message); return false; }
    finally {
      s.busy = false;
      for (const control of s.shadow.querySelectorAll('button, input')) control.disabled = false;
    }
  }

  async add() {
    const s = this.session;
    if (!s?.selection || !this.check() || s.busy) return;
    try {
      const anchor = captureAnchor(s.root, s.selection);
      const selector = s.selector || (s.root.id ? `#${CSS.escape(s.root.id)}` : '');
      if (await this.mutate('create', { anchor, selector })) {
        s.selection = null; s.toolbar.hidden = true; document.getSelection()?.removeAllRanges();
        s.collapsed = false; this.render(); this.notify(`已记录${s.record.items.at(-1).name}。`);
      }
    } catch (error) { this.notify(error.message); }
  }

  async reload() {
    const s = this.session;
    if (!this.check()) return;
    const record = await this.request('list', s.page);
    if (this.session !== s || !this.check() || s.busy || s.editor) return;
    // Storage events can race a local update; never replace a newer response.
    if ((record.revision ?? 0) < (s.record.revision ?? 0)) return;
    s.record = record; this.render();
  }

  render() {
    const s = this.session; if (!s) return;
    s.panel?.remove(); s.editor = null;
    for (const marker of s.markers.values()) marker.remove(); s.markers.clear(); s.ranges.clear();
    if (!s.record.items.length) { s.panel = null; return; }
    s.collapsed = s.record.layout?.collapsed ?? false;
    const panel = s.panel = element('section', `surface panel${s.collapsed ? ' collapsed' : ''}`);
    panel.setAttribute('aria-label', '页面标签');
    const header = element('div', 'head');
    const handle = s.handle = button('handle', `⠿ 页面标签 · ${s.record.items.length}`, '拖动页面标签侧栏，方向键可移动');
    const toggle = s.toggle = button('icon-button', s.collapsed ? '展开' : '收起');
    toggle.setAttribute('aria-expanded', String(!s.collapsed));
    toggle.addEventListener('click', () => this.toggle()); header.append(handle, toggle); panel.append(header);
    const list = element('div', 'list'); panel.append(list);
    for (const item of s.record.items) {
      const row = element('div', 'row'); row.dataset.id = item.id;
      const summary = element('div', 'summary');
      const jump = button('jump', '', `跳转到${item.name}`);
      const dot = element('span', 'dot'); dot.style.background = item.color;
      jump.append(dot, element('span', 'label', item.name)); jump.addEventListener('click', () => this.jump(item.id));
      const edit = button('icon-button', '⋯', `编辑${item.name}`); edit.addEventListener('click', () => this.edit(item.id, row));
      summary.append(jump, edit); row.append(summary, element('p', 'excerpt', item.anchor.exact)); list.append(row);
      const marker = button('marker', '', `跳转到${item.name}`); marker.title = item.name; marker.dataset.id = item.id; marker.style.color = item.color; marker.append(bookmarkIcon());
      marker.addEventListener('click', () => this.jump(item.id)); marker.hidden = true;
      s.shadow.append(marker); s.markers.set(item.id, marker);
    }
    panel.append(element('div', 'hint', '拖动顶部可移动 · 选中文字后点击“标记”'));
    s.shadow.append(panel); this.attachDrag(handle); this.positionPanel();
    s.dirty = true; this.schedule();
  }

  positionPanel() {
    const s = this.session; if (!s?.panel) return;
    const rect = s.panel.getBoundingClientRect();
    const pos = s.position ?? s.record.layout ?? { x: innerWidth - rect.width - 22, y: 100 };
    s.position = { x: Math.max(8, Math.min(pos.x, innerWidth - rect.width - 8)), y: Math.max(8, Math.min(pos.y, innerHeight - rect.height - 8)) };
    s.panel.style.left = `${s.position.x}px`; s.panel.style.top = `${s.position.y}px`;
  }

  attachDrag(handle) {
    const s = this.session;
    let dragging = null;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || s.busy) return;
      event.preventDefault(); handle.setPointerCapture(event.pointerId);
      dragging = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: s.position.x, top: s.position.y };
    });
    handle.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== dragging.pointer) return;
      s.position = { x: dragging.left + event.clientX - dragging.x, y: dragging.top + event.clientY - dragging.y }; this.positionPanel();
    });
    const finish = async () => { if (!dragging) return; dragging = null; await this.saveLayout(); };
    handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish); handle.addEventListener('lostpointercapture', finish);
    handle.addEventListener('keydown', event => {
      const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key];
      if (!delta || s.busy) return;
      event.preventDefault(); s.position = { x: s.position.x + delta[0], y: s.position.y + delta[1] }; this.positionPanel(); this.saveLayout();
    });
  }

  async saveLayout() {
    const s = this.session; if (!s?.panel) return;
    await this.mutate('layout', { layout: { ...s.position, collapsed: s.collapsed } });
  }

  async toggle() {
    const s = this.session; if (!s?.panel || s.busy) return;
    s.collapsed = !s.collapsed; s.panel.classList.toggle('collapsed', s.collapsed);
    s.toggle.textContent = s.collapsed ? '展开' : '收起'; s.toggle.setAttribute('aria-label', s.toggle.textContent); s.toggle.setAttribute('aria-expanded', String(!s.collapsed));
    this.positionPanel(); await this.saveLayout();
  }

  cancelEditor() {
    const s = this.session; if (!s?.editor || s.busy) return;
    s.editor.node.remove(); s.editor = null;
  }

  edit(id, row) {
    const s = this.session; if (s.busy) return;
    this.cancelEditor();
    const item = s.record.items.find(item => item.id === id); if (!item) return;
    const editor = element('form', 'editor');
    const name = element('input', 'name'); name.value = item.name; name.maxLength = 80; name.required = true; name.setAttribute('aria-label', '标签名称');
    const color = element('input', 'color'); color.type = 'color'; color.value = item.color; color.setAttribute('aria-label', '标签颜色');
    const save = button('save', '保存'); save.type = 'submit';
    const cancel = button('cancel', '取消'); cancel.addEventListener('click', () => this.cancelEditor());
    const remove = button('delete', '删除'); remove.addEventListener('click', async () => {
      if (await this.mutate('delete', { id })) { this.render(); this.notify(s.record.items.length ? '标签已删除。' : '标签已全部删除，侧栏已关闭。'); }
    });
    editor.append(name, color, save, cancel, remove);
    editor.addEventListener('submit', async event => {
      event.preventDefault();
      if (await this.mutate('update', { id, patch: { name: name.value, color: color.value } })) { this.render(); this.notify('标签已更新。'); }
    });
    row.append(editor); s.editor = { node: editor, id }; name.focus(); name.select(); this.positionPanel();
  }

  schedule(rebuild = false) {
    const s = this.session; if (!s) return;
    if (rebuild) {
      clearTimeout(s.rebuildTimer); s.rebuildTimer = setTimeout(() => this.schedule(), 160); return;
    }
    if (s.frame) return;
    s.frame = requestAnimationFrame(() => {
      s.frame = 0;
      if (!this.check()) return;
      try { this.geometry(); } catch (error) { this.notify(error.message); }
    });
  }

  geometry() {
    const s = this.session;
    if (!s.root.isConnected) return;
    if (s.dirty) {
      s.index = textIndex(s.root); s.ranges.clear();
      for (const item of s.record.items) {
        let sameRoot = true;
        if (item.selector) {
          try { const roots = document.querySelectorAll(item.selector); sameRoot = roots.length === 1 && roots[0] === s.root; }
          catch { sameRoot = false; }
        }
        const range = sameRoot ? resolveAnchor(s.index, item.anchor) : null; s.ranges.set(item.id, range);
        const row = s.panel?.querySelector(`[data-id="${item.id}"]`);
        row?.classList.toggle('missing', !range);
        if (row) row.querySelector('.excerpt').textContent = range ? item.anchor.exact : `暂未找到原位置 · ${item.anchor.exact}`;
      }
      s.dirty = false;
    }
    const placed = [];
    for (const [id, marker] of s.markers) {
      const range = s.ranges.get(id), rect = range ? firstRect(range) : null;
      let visible = !!rect && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      if (visible) {
        let parent = range.startContainer.parentElement;
        while (parent && parent !== document.body) {
          const style = getComputedStyle(parent);
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            const bound = parent.getBoundingClientRect();
            if (rect.bottom <= bound.top || rect.top >= bound.bottom) { visible = false; break; }
          }
          parent = parent.parentElement;
        }
      }
      marker.hidden = !visible;
      if (!visible) continue;
      const block = range.startContainer.parentElement?.closest('p, li, pre, h1, h2, h3, h4, h5, h6, td, blockquote') ?? s.root;
      const left = block.getBoundingClientRect().left;
      let x = Math.max(2, left - 30), y = Math.max(0, rect.top + rect.height / 2 - 14);
      while (placed.some(pos => Math.abs(pos.y - y) < 25 && Math.abs(pos.x - x) < 26)) x += 27;
      x = Math.min(innerWidth - 28, x); placed.push({ x, y });
      marker.style.left = `${x}px`; marker.style.top = `${y}px`;
    }
    this.positionToolbar();
    if (s.flash && s.flashRange) {
      const rect = firstRect(s.flashRange);
      if (rect) { s.flash.style.left = `${rect.left - 3}px`; s.flash.style.top = `${rect.top - 3}px`; s.flash.style.width = `${Math.max(12, s.flashRange.getBoundingClientRect().width) + 6}px`; s.flash.style.height = `${rect.height + 6}px`; }
    }
  }

  jump(id) {
    const s = this.session; if (!this.check() || s.busy) return;
    try {
      // Resolve again on a click even if a DOM observer has not delivered its changes yet.
      s.dirty = true; this.geometry();
      const item = s.record.items.find(item => item.id === id), range = s.ranges.get(id);
      if (!range || !firstRect(range)) { this.notify('原文字已变化或尚未加载，暂时无法定位这个标签。'); return; }
      scrollToRange(range);
      s.flash?.remove(); clearTimeout(s.flashTimer);
      s.flash = element('div', 'flash'); s.flash.style.borderColor = item.color; s.flashRange = range;
      s.shadow.append(s.flash); this.schedule();
      s.flashTimer = setTimeout(() => { s.flash?.remove(); s.flash = null; }, 1800);
    } catch (error) { this.notify(error.message); }
  }
}

if (!globalThis.__wmBookmarks) globalThis.__wmBookmarks = new PageBookmarks();

// The settings switch controls automatic startup; saved labels remain independent.
if (!globalThis.__wmBookmarkStartup) {
  let enabled = false, timer = null, opening = false, page = '', attempts = 0;
  const tick = async () => {
    if (!enabled || opening) return;
    if (page !== location.href) { page = location.href; attempts = 20; }
    if (globalThis.__wmBookmarks.check() || attempts-- <= 0) return;
    opening = true;
    try { await globalThis.__wmBookmarks.open(''); } catch { /* Ambiguous or missing articles are skipped. */ }
    finally { opening = false; if (!enabled) globalThis.__wmBookmarks.dispose(); }
  };
  const setEnabled = value => {
    enabled = value === true; clearInterval(timer); timer = null;
    if (enabled) { attempts = 20; page = ''; tick(); timer = setInterval(tick, 1500); }
    else { globalThis.__wmBookmarks.openSequence++; globalThis.__wmBookmarks.dispose(); }
  };
  globalThis.__wmBookmarkStartup = { setEnabled };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.bookmarkSettings) setEnabled(changes.bookmarkSettings.newValue?.enabled);
  });
  chrome.storage.local.get('bookmarkSettings').then(value => setEnabled(value.bookmarkSettings?.enabled)).catch(() => {});
}
