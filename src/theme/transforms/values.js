import valueParser from 'postcss-value-parser';
import { resolveResource } from '../resources.js';
import { rewriteFontNames } from './fonts.js';

export function transformValue(declaration, context) {
  const parsed = valueParser(declaration.value); let blocked = false;
  parsed.walk(node => {
    if (node.type === 'function' && ['image-set', '-webkit-image-set', 'src', 'paint', 'element', 'expression'].includes(node.value.toLowerCase())) {
      blocked = true; context.missing(declaration.prop, '复杂资源表达式', '暂不支持此资源函数'); return false;
    }
    if (node.type === 'function' && node.value.toLowerCase() === 'url') {
      const url = node.nodes[0]?.type === 'string' ? node.nodes[0].value : valueParser.stringify(node.nodes).trim();
      if (!context.policy.enableBackgroundImages) { blocked = true; context.missing(declaration.prop, url, '统一配置关闭了背景图片'); return false; }
      try {
        const resource = resolveResource(url, 'image', context.bundle, context.warn);
        node.nodes = [{ type: 'string', quote: '"', value: resource.dataUrl }];
        if (!context.images.some(item => item.dataUrl === resource.dataUrl)) context.images.push({ label: resource.path, dataUrl: resource.dataUrl });
        context.report.imageReferences++;
      } catch (error) { blocked = true; context.missing(declaration.prop, url, error.message); }
      return false;
    }
    if (node.type === 'function' && node.value.toLowerCase() === 'var') {
      const name = node.nodes.find(n => n.type === 'word');
      if (name?.value.startsWith('--')) name.value = `--wm-${context.sessionId}-${name.value.slice(2)}`;
    }
    if (node.type === 'word') {
      const unit = valueParser.unit(node.value);
      if (unit?.unit?.toLowerCase() === 'rem') node.value = `${Number(unit.number) * context.report.baseFontSize}px`;
    }
  });
  if (blocked) return null;
  if (['font', 'font-family'].includes(declaration.prop.toLowerCase()) || declaration.prop.startsWith('--')) rewriteFontNames(parsed, context.aliases);
  return parsed.toString();
}
