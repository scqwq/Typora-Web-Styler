import parser from 'postcss-selector-parser';
const tokens = {
  'cm-keyword': '.token.keyword,.hljs-keyword', 'cm-comment': '.token.comment,.hljs-comment',
  'cm-string': '.token.string,.hljs-string', 'cm-string-2': '.token.regex,.hljs-regexp',
  'cm-number': '.token.number,.hljs-number', 'cm-atom': '.token.boolean,.hljs-literal',
  'cm-def': '.token.function,.hljs-title', 'cm-variable': '.token.variable,.hljs-variable',
  'cm-variable-2': '.token.parameter,.hljs-params', 'cm-property': '.token.property,.hljs-attr',
  'cm-operator': '.token.operator,.hljs-operator', 'cm-builtin': '.token.builtin,.hljs-built_in',
  'cm-tag': '.token.tag,.hljs-name', 'cm-attribute': '.token.attr-name,.hljs-attribute',
  'cm-meta': '.token.prolog,.hljs-meta'
};
export function mapCodeClass(node) {
  if (node.type !== 'class') return false;
  if (['CodeMirror', 'cm-s-inner'].includes(node.value)) { node.replaceWith(parser().astSync(':is(pre code)').first.first.clone()); return true; }
  if (node.value === 'md-fences') { node.replaceWith(parser.tag({ value: 'pre' })); return true; }
  if (tokens[node.value]) { node.replaceWith(parser().astSync(`:is(${tokens[node.value]})`).first.first.clone()); return true; }
  return false;
}
