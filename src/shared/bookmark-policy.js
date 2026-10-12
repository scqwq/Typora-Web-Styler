export const BOOKMARK_COLORS = ['#b94d65', '#9561b8', '#496fba', '#268884', '#52803a', '#b47a24', '#b85d35', '#5767a2'];
export const MAX_BOOKMARKS_PER_PAGE = 100;

export function bookmarkPage(address) {
  const url = new URL(address);
  if (!['http:', 'https:'].includes(url.protocol) || address.length > 4000) throw new Error('页面标签仅支持 HTTP/HTTPS 文章。');
  // Ordinary fragments are heading anchors; hash routes identify different documents.
  if (!url.hash.startsWith('#/') && !url.hash.startsWith('#!')) url.hash = '';
  return url.href;
}

function text(value, max, label, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error(`${label}无效。`);
  return value;
}

export function validateAnchor(value) {
  if (!value || typeof value !== 'object') throw new Error('标签位置无效。');
  const exact = text(value.exact, 256, '选中文字');
  const prefix = text(value.prefix, 64, '前文', true);
  const suffix = text(value.suffix, 64, '后文', true);
  const signature = text(value.signature, 32, '正文签名');
  if (!Number.isInteger(value.start) || value.start < 0 || value.start > 1000000) throw new Error('标签位置无效。');
  return { exact, prefix, suffix, start: value.start, signature };
}

export function validatePatch(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['name', 'color'].includes(key))) throw new Error('标签修改参数无效。');
  const patch = {};
  if (Object.hasOwn(value, 'name')) patch.name = text(value.name, 80, '标签名称').trim();
  if (Object.hasOwn(value, 'color')) {
    if (typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error('标签颜色无效。');
    patch.color = value.color.toLowerCase();
  }
  return patch;
}

export function validateLayout(value) {
  if (!value || typeof value !== 'object' || typeof value.collapsed !== 'boolean' ||
    !Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 0 || value.y < 0 || value.x > 100000 || value.y > 100000) throw new Error('侧栏位置无效。');
  return { x: value.x, y: value.y, collapsed: value.collapsed };
}

export function contentSignature(source) {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `${source.length}:${(hash >>> 0).toString(16)}`;
}

export function findAnchor(source, anchor, signature = contentSignature(source)) {
  if (signature === anchor.signature && source.slice(anchor.start, anchor.start + anchor.exact.length) === anchor.exact) return anchor.start;
  let found = -1, score = -1, tied = false, from = 0, matches = 0;
  while (from <= source.length) {
    const at = source.indexOf(anchor.exact, from);
    if (at < 0) break;
    // A common word must not cause an unbounded scan or a misleading first match.
    if (++matches > 2000) return null;
    let candidate = 0;
    const before = source.slice(Math.max(0, at - anchor.prefix.length), at);
    const after = source.slice(at + anchor.exact.length, at + anchor.exact.length + anchor.suffix.length);
    for (let i = 1; i <= Math.min(before.length, anchor.prefix.length); i++) {
      if (before.at(-i) !== anchor.prefix.at(-i)) break; candidate++;
    }
    for (let i = 0; i < Math.min(after.length, anchor.suffix.length); i++) {
      if (after[i] !== anchor.suffix[i]) break; candidate++;
    }
    if (candidate > score) { score = candidate; found = at; tied = false; }
    else if (candidate === score) tied = true;
    from = at + 1;
  }
  return found < 0 || tied ? null : found;
}
