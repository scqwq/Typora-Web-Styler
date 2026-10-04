import parser from 'postcss-selector-parser';

const editorNames = new Set(['typora-sidebar', 'typora-source', 'typora-quick-open', 'md-meta', 'md-before', 'md-after', 'md-toc', 'CodeMirror', 'md-fences', 'cm-s-inner']);
const allowedFunctional = new Set([':is', ':where', ':not']);
const isRoot = node => (node.type === 'id' && node.value === 'write') ||
  (node.type === 'tag' && ['html', 'body'].includes(node.value.toLowerCase())) ||
  (node.type === 'pseudo' && node.value === ':root');
const hasRoot = selector => selector.nodes.some(isRoot);

/** Convert one selector AST. Never allow selectors to escape the article via siblings. */
export function convertSelectors(input, sessionId, onSkip) {
  const scope = `[data-wm-article="${sessionId}"]`;
  const guard = ':not([data-wm-protected], [data-wm-protected] *)';
  const ast = parser().astSync(input);
  const output = [];
  for (const original of ast.nodes) {
    const selector = original.clone();
    let unsupported = '';
    selector.walk(node => {
      if (node.type === 'nesting' || node.namespace != null) unsupported = '嵌套或命名空间选择器';
      if (node.type === 'pseudo' && (node.value.startsWith('::') || [':before', ':after', ':first-line', ':first-letter', ':visited', ':has'].includes(node.value))) unsupported = '伪元素或暂未支持的伪类';
      if (node.type === 'pseudo' && node.nodes?.length && !allowedFunctional.has(node.value)) unsupported = '暂未支持的函数伪类';
      if ((node.type === 'class' || node.type === 'id') && (editorNames.has(node.value) || node.value.startsWith('cm-'))) unsupported = 'Typora 编辑器专用结构';
      if (node.type === 'attribute' && (node.attribute.startsWith('data-wm-') || ['md-inline', 'mdtype'].includes(node.attribute))) unsupported = '专用属性选择器';
    });
    if (unsupported) { onSkip(original.toString(), unsupported); continue; }

    // Drop simple html/body ancestor chains. Other root combinations remain explicit or are skipped.
    while (selector.nodes.length > 2 && isRoot(selector.first) && selector.nodes[1].type === 'combinator' && selector.nodes[1].value === ' ' && isRoot(selector.nodes[2])) {
      selector.first.remove(); selector.first.remove();
    }
    const topRoots = selector.nodes.filter(isRoot);
    if (topRoots.length > 1 || (topRoots.length && !isRoot(selector.first))) {
      onSkip(original.toString(), '依赖复杂网页根结构'); continue;
    }
    const rootBound = hasRoot(selector);
    if (rootBound && selector.nodes.some(node => node.type === 'combinator' && ![' ', '>'].includes(node.value))) {
      onSkip(original.toString(), '根与同级节点组合可能超出正文'); continue;
    }
    selector.walk(node => {
      if (isRoot(node)) node.replaceWith(parser().astSync(scope).first.first.clone());
    });
    const guarded = selector.toString() + guard;
    if (rootBound) {
      output.push({ selector: guarded, root: !selector.nodes.some(n => n.type === 'combinator') });
    } else {
      // Both descendants and the root itself can match a generic element/class selector.
      output.push({ selector: `${scope} ${guarded}`, root: false });
      if (!selector.nodes.some(n => n.type === 'combinator')) {
        output.push({ selector: `${scope}:is(${selector.toString()})${guard}`, root: true });
      }
    }
  }
  return output;
}
