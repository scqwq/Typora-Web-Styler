import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { convertSelectors } from './selectors.js';
import { TEXT_PROPERTIES, BLOCK_PROPERTIES, normalizePolicy } from '../shared/style-policy.js';
import { MAX_CSS_BYTES } from './resources.js';
import { createReport } from './report.js';
import { collectFonts } from './transforms/fonts.js';
import { transformValue } from './transforms/values.js';

export const COMPILER_VERSION = 2;
export const MAX_THEME_BYTES = MAX_CSS_BYTES;
export function compileTheme(source, { sessionId = 'preview', baseFontSize = 16, settings = {}, bundle = {} } = {}) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_THEME_BYTES) throw new Error('CSS 文件最多 1 MB（1,048,576 字节）。');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(sessionId)) throw new Error('无效的会话标记。');
  const reporting = createReport(baseFontSize);
  const { report, skip } = reporting;
  let tree;
  try { tree = postcss.parse(source, { from: undefined }); }
  catch (error) { const failure = new Error(`CSS 解析失败（第 ${error.line ?? '?'} 行）：${error.reason ?? error.message}`); failure.phase = 'conversion'; throw failure; }
  // A fixed px html size in a top-level rule is a predictable rem basis. Dynamic bases fall back explicitly.
  for (const rule of tree.nodes.filter(n => n.type === 'rule')) {
    if (!['html', ':root', 'html, body', 'html,body'].includes(rule.selector.trim())) continue;
    for (const decl of (rule.nodes ?? []).filter(n => n.type === 'decl' && n.prop.toLowerCase() === 'font-size')) {
      const parsed = valueParser.unit(decl.value.trim());
      if (parsed?.unit === 'px' && Number(parsed.number) > 0 && Number(parsed.number) <= 96) report.baseFontSize = Number(parsed.number);
      else skip(`${rule.selector}: font-size`, `rem 使用默认基准 ${baseFontSize}px；动态根字号暂不解析`);
    }
  }
  const output = postcss.root();
  const context = { ...reporting, sessionId, bundle, policy: normalizePolicy(settings), images: [] };
  const { aliases, fonts } = collectFonts(tree, context); context.aliases = aliases;
  function convert(container, target, depth = 0) {
    if (depth > 16) throw new Error('CSS 嵌套层数过多。');
    for (const node of container.nodes ?? []) {
      if (node.type === 'comment') continue;
      if (node.type === 'atrule') {
        if (node.name.toLowerCase() === 'font-face') continue;
        if (['media', 'supports'].includes(node.name.toLowerCase()) && node.nodes) {
          const copy = postcss.atRule({ name: node.name, params: node.params });
          convert(node, copy, depth + 1); if (copy.nodes?.length) target.append(copy);
        } else skip(`@${node.name} ${node.params}`, '暂不支持此 at-rule（包括动画与 @import）');
        continue;
      }
      if (node.type !== 'rule') { skip(node.toString(), '非规则声明'); continue; }
      if (node.nodes.some(n => !['decl', 'comment'].includes(n.type))) { skip(node.selector, '首版不支持规则内嵌套'); continue; }
      let selectors;
      try { selectors = convertSelectors(node.selector, sessionId, skip); }
      catch { skip(node.selector, '选择器解析失败'); continue; }
      for (const match of selectors) {
        const rule = postcss.rule({ selector: match.selector });
        for (const decl of node.nodes.filter(n => n.type === 'decl')) {
          const prop = decl.prop.toLowerCase();
          const rootBackground = match.root && prop.startsWith('background') && context.policy.useThemeBackground;
          if (!prop.startsWith('--') && !TEXT_PROPERTIES.has(prop) && !(BLOCK_PROPERTIES.has(prop) && (!match.root || rootBackground))) {
            skip(`${node.selector}: ${prop}`, '布局保护或暂未支持的属性'); continue;
          }
          const value = transformValue(decl, context);
          if (value !== null) rule.append(postcss.decl({ prop: decl.prop.startsWith('--') ? `--wm-${sessionId}-${decl.prop.slice(2)}` : decl.prop, value, important: decl.important }));
        }
        if (rule.nodes?.length) { target.append(rule); report.convertedRules++; }
      }
    }
  }
  convert(tree, output);
  const css = output.toString();
  if (!css.trim()) throw new Error('主题没有可应用的正文规则，请检查转换范围或选择其他 CSS。');
  return { css, report, fonts, images: context.images };
}
