import valueParser from 'postcss-value-parser';
import { resolveResource } from '../resources.js';

const descriptors = { 'font-style': 'style', 'font-weight': 'weight', 'font-stretch': 'stretch', 'unicode-range': 'unicodeRange', 'font-display': 'display', 'font-feature-settings': 'featureSettings', 'font-variation-settings': 'variationSettings' };
function familyName(value) {
  const nodes = valueParser(value).nodes;
  if (nodes.length === 1 && nodes[0].type === 'string') return nodes[0].value;
  return value.trim();
}
export function collectFonts(tree, context) {
  const aliases = new Map(); const fonts = [];
  tree.walkAtRules('font-face', rule => {
    const declarations = Object.fromEntries((rule.nodes ?? []).filter(n => n.type === 'decl').map(n => [n.prop.toLowerCase(), n.value]));
    if (!declarations['font-family']) { context.skip('@font-face', '字体缺少名称'); return; }
    const original = familyName(declarations['font-family']); const key = original.toLowerCase();
    if (!aliases.has(key)) aliases.set(key, `wm-font-${context.sessionId}-${aliases.size}`);
    if (!context.policy.enableFonts) { context.skip(`@font-face ${original}`, '统一配置关闭了配套字体'); return; }
    if (fonts.length >= 32) { context.skip(`@font-face ${original}`, '单个主题最多加载 32 个字体定义'); return; }
    const sources = valueParser(declarations.src ?? '').nodes.filter(node => node.type === 'function' && ['url', 'local'].includes(node.value.toLowerCase()));
    let chosen;
    // Prefer supplied binary resources; local() may refer to a font not installed here.
    for (const source of [...sources.filter(n => n.value.toLowerCase() === 'url'), ...sources.filter(n => n.value.toLowerCase() === 'local')]) {
      const url = source.nodes[0]?.type === 'string' ? source.nodes[0].value : valueParser.stringify(source.nodes).trim();
      try {
        if (source.value.toLowerCase() === 'local') {
          if (url.length > 200) throw new Error('本地字体名称过长');
          chosen = { local: `local(${JSON.stringify(url)})` }; break;
        }
        chosen = { dataUrl: resolveResource(url, 'font', context.bundle, context.warn).dataUrl }; break;
      } catch (error) { context.missing('font-face src', url, error.message); }
    }
    if (!chosen) { context.skip(`@font-face ${original}`, '没有可加载的本地字体来源'); return; }
    const options = {};
    for (const [css, api] of Object.entries(descriptors)) if (declarations[css]) options[api] = declarations[css];
    fonts.push({ family: aliases.get(key), label: original, ...chosen, descriptors: options }); context.report.fontDefinitions++;
  });
  return { aliases, fonts };
}
/** Rewrite family suffixes, including names inside a font shorthand, without rewriting other words. */
export function rewriteFontNames(parsed, aliases) {
  if (!aliases.size) return;
  const groups = []; let current = [];
  for (const node of parsed.nodes) {
    if (node.type === 'div' && node.value === ',') { groups.push(current); current = []; }
    else current.push(node);
  }
  groups.push(current);
  for (const group of groups) {
    const meaningful = group.filter(node => node.type !== 'space' && node.type !== 'comment');
    for (let start = 0; start < meaningful.length; start++) {
      const tail = meaningful.slice(start);
      if (!tail.every(node => ['word', 'string'].includes(node.type))) continue;
      const name = tail.map(node => node.value).join(' ').toLowerCase();
      if (!aliases.has(name)) continue;
      const first = parsed.nodes.indexOf(tail[0]); const last = parsed.nodes.indexOf(tail.at(-1));
      parsed.nodes.splice(first, last - first + 1, { type: 'string', quote: '"', value: aliases.get(name) }); break;
    }
  }
}
