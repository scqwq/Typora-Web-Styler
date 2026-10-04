import test from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import parser from 'postcss-selector-parser';
import { compileTheme } from '../src/theme/compiler.js';

test('root, selector lists, combinators, media and nested pseudos are scoped', () => {
  const { css } = compileTheme(`html body #write { color: red; padding: 10px; }
    #write > h2, p:not(.skip), :is(#write, .note) { color: purple; }
    @media (min-width: 1px) { @supports (display: grid) { h3 { font-weight: bold; } } }`, { sessionId: 'unit' });
  assert.ok(css.includes('[data-wm-article='));
  assert.ok(css.includes('@media'));
  assert.ok(css.includes('@supports'));
  assert.ok(!css.includes('padding: 10px'));
  postcss.parse(css).walkRules(rule => {
    const selectors = parser().astSync(rule.selector);
    for (const selector of selectors.nodes) {
      assert.equal(selector.first.type, 'attribute');
      assert.equal(selector.first.attribute, 'data-wm-article');
      assert.ok(selector.toString().includes('data-wm-protected'));
    }
  });
});
test('sibling escape, editor UI, pseudo elements and unsafe nesting are omitted', () => {
  const { css, report } = compileTheme(`#write { color: black; }
    #write + aside, body ~ footer, .app #write, .CodeMirror { color: red; }
    #write::before { content: 'danger'; }
    #write { & p { color: green; } }`);
  assert.ok(!css.includes('aside'));
  assert.ok(!css.includes('footer'));
  assert.ok(!css.includes('CodeMirror'));
  assert.ok(!css.includes('::before'));
  assert.ok(report.skipped.length >= 5);
});
test('resources hidden in variables, font definitions, imports and animations never pass through', () => {
  const { css, report } = compileTheme(`@import 'https://example.org/theme.css';
    @font-face { font-family: remote; src: url(font.woff); }
    @keyframes spin { to { transform: rotate(360deg); } }
    :root { --remote: url(https://example.org/image.png); --safe: #345; }
    #write { color: var(--safe); animation: spin 1s; }
    #write p { background: image-set('https://example.org/a.png' 1x); position: fixed; }`);
  assert.ok(!css.includes('https:'));
  assert.ok(!css.includes('url('));
  assert.ok(!css.includes('@font-face'));
  assert.ok(!css.includes('animation'));
  assert.ok(!css.includes('position'));
  assert.ok(css.includes('--wm-preview-safe'));
  assert.equal(report.resources.length, 2);
});
test('rem conversion uses a static theme html base without changing page html', () => {
  const { css, report } = compileTheme('html { font-size: 20px; } #write h2 { font-size: 1.5rem; margin: calc(2rem + 1px); }');
  assert.equal(report.baseFontSize, 20);
  assert.ok(css.includes('30px'));
  assert.ok(css.includes('calc(40px + 1px)'));
  assert.ok(!css.includes('1.5rem'));
});
test('malformed, oversized and empty themes fail without yielding a partial stylesheet', () => {
  for (const source of ['p {', '/* comment */', 'a'.repeat(512 * 1024 + 1)]) assert.throws(() => compileTheme(source));
  assert.throws(() => compileTheme('p { color: red }', { sessionId: 'x"] body' }));
});
test('numeric-leading session IDs remain quoted CSS attribute values', () => {
  const { css } = compileTheme('#write h2 { color: purple }', { sessionId: '123abc' });
  assert.ok(css.includes('[data-wm-article="123abc"]'));
});
test('theme variables are namespaced so they cannot change existing site layout variables', () => {
  const { css } = compileTheme(':root { --width: 999px; --text: #123 } #write p { color: var(--text, var(--width)); }');
  assert.ok(css.includes('--wm-preview-width: 999px'));
  assert.ok(css.includes('var(--wm-preview-text, var(--wm-preview-width))'));
  assert.ok(!css.includes('var(--width)'));
});
test('undefined theme variable references cannot borrow resource URLs from the host site', () => {
  const { css } = compileTheme('#write p { background: var(--site-image, #fff); }');
  assert.ok(css.includes('var(--wm-preview-site-image, #fff)'));
});
