import { contentSignature, findAnchor } from '../shared/bookmark-policy.js';

const EXCLUDED = 'script, style, noscript, textarea, input, select, button, svg, canvas, iframe, nav, aside, [hidden], [aria-hidden="true"], [contenteditable]:not([contenteditable="false"])';
export function textIndex(root) {
  const entries = [];
  let source = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return !parent || parent.closest(EXCLUDED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) {
    if (!node.length) continue;
    if (source.length + node.length > 1000000 || entries.length >= 30000) throw new Error('正文过长，请选择更小的正文区域再使用标签。');
    entries.push({ node, start: source.length, end: source.length + node.length });
    source += node.data;
  }
  return { source, entries, signature: contentSignature(source) };
}

export function captureAnchor(root, range, index = textIndex(root)) {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer) || range.collapsed) throw new Error('请在已确认的正文中选取一个词或短句。');
  function offset(container, value, end) {
    const entry = index.entries.find(item => item.node === container);
    if (entry) return entry.start + value;
    if (container.nodeType === Node.TEXT_NODE) throw new Error('请选择正文文字；按钮、输入框等控件不支持标签。');
    // A browser selection may end at an element boundary rather than a text node.
    const point = document.createRange(); point.setStart(container, value); point.collapse(true);
    for (const item of index.entries) {
      const start = document.createRange(); start.setStart(item.node, 0); start.collapse(true);
      if (point.compareBoundaryPoints(Range.START_TO_START, start) <= 0) return item.start;
    }
    return end ? index.source.length : null;
  }
  const start = offset(range.startContainer, range.startOffset, false);
  const end = offset(range.endContainer, range.endOffset, true);
  if (start == null || end == null || end <= start) throw new Error('无法记录这段选文，请重新选择正文文字。');
  const exact = index.source.slice(start, Math.min(end, start + 256));
  if (!exact.trim()) throw new Error('请选择文字，而不是空白。');
  return { exact, start, prefix: index.source.slice(Math.max(0, start - 64), start), suffix: index.source.slice(start + exact.length, start + exact.length + 64), signature: index.signature };
}

export function rangeAt(index, start, length) {
  const first = index.entries.find(item => item.start <= start && item.end > start);
  const last = index.entries.find(item => item.start < start + length && item.end >= start + length);
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first.node, start - first.start);
  range.setEnd(last.node, start + length - last.start);
  return range;
}

export function resolveAnchor(index, anchor) {
  const start = findAnchor(index.source, anchor, index.signature);
  return start == null ? null : rangeAt(index, start, anchor.exact.length);
}

export function firstRect(range) {
  const first = range.cloneRange();
  if (first.startContainer.nodeType === Node.TEXT_NODE) first.setEnd(first.startContainer, Math.min(first.startContainer.length, first.startOffset + 1));
  return [...first.getClientRects()].find(rect => rect.width && rect.height) ?? null;
}

export function scrollToRange(range) {
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  // Scroll each nested container from inside out, and finally the viewport.
  for (let parent = start.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (parent !== document.body && /(auto|scroll|overlay)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
      const rect = firstRect(range);
      if (rect) parent.scrollTop += rect.top - parent.getBoundingClientRect().top - Math.min(100, parent.clientHeight / 3);
    }
  }
  const rect = firstRect(range);
  if (rect) window.scrollBy({ top: rect.top - Math.min(180, innerHeight / 3), behavior: 'instant' });
}
