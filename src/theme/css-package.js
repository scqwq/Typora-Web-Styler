import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { normalizePath, MAX_CSS_BYTES } from './resources.js';

const bytes = text => new TextEncoder().encode(text).length;
export function importReference(params) {
  const nodes = valueParser(params).nodes;
  const index = nodes.findIndex(n => n.type !== 'space' && n.type !== 'comment');
  const first = nodes[index];
  const url = first?.type === 'string' ? first.value : first?.type === 'function' && first.value.toLowerCase() === 'url' ? valueParser.stringify(first.nodes).trim().replace(/^['"]|['"]$/g, '') : null;
  if (!url) throw new Error('无法识别 @import 的文件地址。');
  return { url, condition: valueParser.stringify(nodes.slice(index + 1)).trim() };
}
export const isExternal = url => /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(url);

/** Expand only the selected entry's dependency graph, preserving order and each file's URL base. */
export function mergeCss(entry, cssFiles) {
  const files = new Map();
  if (!Array.isArray(cssFiles) || cssFiles.length > 128) throw new Error('一个包最多包含 128 个 CSS 文件。');
  for (const file of cssFiles) {
    const path = normalizePath(file.path);
    if (files.has(path) || typeof file.source !== 'string' || bytes(file.source) > MAX_CSS_BYTES) throw new Error(`CSS 重复或超过 2 MB：${path}`);
    files.set(path, file.source);
  }
  let visits = 0, expandedBytes = 0;
  const dependencies = new Set();
  function expand(path, chain = []) {
    if (chain.includes(path)) throw new Error(`CSS 循环引用：${[...chain, path].join(' → ')}`);
    if (chain.length >= 16 || ++visits > 256) throw new Error('CSS 引用层数或次数超过限制。');
    const source = files.get(path);
    if (source === undefined) throw new Error(`缺少被引用的 CSS：${path}。请选择包含依赖的主题目录或 ZIP。`);
    expandedBytes += bytes(source);
    if (expandedBytes > 4 * MAX_CSS_BYTES) throw new Error('CSS 展开内容过大。');
    dependencies.add(path);
    let tree;
    try { tree = postcss.parse(source, { from: path }); }
    catch (error) { throw new Error(`CSS 解析失败：${path}，第 ${error.line ?? '?'} 行。`); }
    tree.walkDecls(decl => {
      const parsed = valueParser(decl.value);
      parsed.walk(node => {
        if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
        const raw = valueParser.stringify(node.nodes).trim().replace(/^['"]|['"]$/g, '');
        if (!isExternal(raw)) node.nodes = [{ type: 'string', quote: '"', value: normalizePath(raw, path) }];
        return false;
      });
      decl.value = parsed.toString();
    });
    tree.walkAtRules(/^import$/i, rule => {
      if (rule.parent !== tree) throw new Error(`@import 必须位于 CSS 顶层：${path}`);
      const { url, condition } = importReference(rule.params);
      if (isExternal(url)) return; // Existing compiler reports and drops remote imports.
      if (condition && /\b(?:layer|supports)\b/i.test(condition)) throw new Error(`暂不支持带 layer/supports 条件的 @import：${path}`);
      const imported = expand(normalizePath(url, path), [...chain, path]);
      if (condition) {
        const wrapper = postcss.atRule({ name: 'media', params: condition });
        wrapper.append(imported.nodes); rule.replaceWith(wrapper);
      } else rule.replaceWith(...imported.nodes);
    });
    return tree;
  }
  const source = expand(normalizePath(entry)).toString();
  if (bytes(source) > MAX_CSS_BYTES) throw new Error('合并后的主题 CSS 超过 2 MB。');
  return { source, sourcePath: 'theme.css', dependencies: [...dependencies] };
}
