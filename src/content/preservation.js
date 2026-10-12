import { normalizePolicy } from '../shared/style-policy.js';

// Snapshot only selected declarations, retaining nodes, events and unrelated inline styles.
export function preserve(root, settings) {
  const policy = normalizePolicy(settings);
  const records = [];
  const nodes = [root, ...root.querySelectorAll('*')];
  if (nodes.length > policy.maxArticleNodes) throw new Error(`正文节点超过 ${policy.maxArticleNodes.toLocaleString('en-US')} 个，请在设置中增大最大正文节点数，或选择更小区域。`);
  for (const el of nodes) {
    if (el.closest('[data-wm-protected]')) continue;
    const heading = !!el.closest('h1,h2,h3,h4,h5,h6');
    const code = !!el.closest('pre,code');
    const link = !!el.closest('a');
    const props = new Set();
    if (heading && policy.preserveHeadingSize) props.add('font-size');
    if (heading && policy.preserveHeadingColor) props.add('color');
    if (!code && policy.preserveBodyFont) props.add('font-family');
    if (!code && !heading && policy.preserveBodySize) props.add('font-size');
    if (!code && policy.preserveLineHeight) props.add('line-height');
    if (link && policy.preserveLinkColor) props.add('color');
    if (code && policy.preserveCodeColors) props.add('color');
    if (code && policy.preserveCodeBackground) props.add('background-color');
    if (!props.size) continue;
    const computed = getComputedStyle(el);
    for (const prop of props) records.push({ el, prop, before: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop), absent: !el.hasAttribute('style'), value: computed.getPropertyValue(prop) });
  }
  redoPreservation(records);
  return records;
}
export function undoPreservation(records = []) {
  for (const { el, prop, before, priority, value, absent } of [...records].reverse()) {
    if (el.style.getPropertyValue(prop) !== value || el.style.getPropertyPriority(prop) !== 'important') continue;
    if (before) el.style.setProperty(prop, before, priority); else el.style.removeProperty(prop);
    if (absent && !el.style.length) el.removeAttribute('style');
  }
}
export function redoPreservation(records = []) {
  for (const { el, prop, before, priority, value } of records) {
    if (el.style.getPropertyValue(prop) === before && el.style.getPropertyPriority(prop) === priority) el.style.setProperty(prop, value, 'important');
  }
}
