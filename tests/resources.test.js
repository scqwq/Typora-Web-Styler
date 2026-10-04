import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTheme, MAX_THEME_BYTES } from '../src/theme/compiler.js';
import { normalizePath, validateFiles, resolveResource } from '../src/theme/resources.js';
import { normalizePolicy } from '../src/shared/style-policy.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const font = 'data:font/woff;base64,' + Buffer.from('wOFF test fixture').toString('base64');
const bundle = { sourcePath: 'css/theme.css', files: validateFiles([{ path: 'fonts/demo.woff', dataUrl: font }, { path: 'images/paper.png', dataUrl: png }]).files };

test('CSS byte limit accepts exactly 1 MiB and rejects one byte more, including UTF-8', () => {
  const rule = '#write p{color:#333}'; const source = rule + '/*' + 'x'.repeat(MAX_THEME_BYTES - rule.length - 4) + '*/';
  assert.ok(compileTheme(source).css.includes('#333'));
  assert.throws(() => compileTheme(source + 'x'), /1 MB/);
  assert.throws(() => compileTheme('中'.repeat(Math.ceil(MAX_THEME_BYTES / 3))), /1 MB/);
});
test('local resource paths resolve relative to CSS, rejecting traversal and remote URLs', () => {
  assert.equal(normalizePath('../fonts/demo.woff', 'css/theme.css'), 'fonts/demo.woff');
  for (const path of ['../escape', '/absolute', 'https://example.com/a', '%2e%2e/escape']) assert.throws(() => normalizePath(path));
  assert.equal(resolveResource('../fonts/demo.woff', 'font', bundle).path, 'fonts/demo.woff');
  assert.throws(() => validateFiles([{ path: 'bad.woff', dataUrl: png }]), /类型不匹配/);
  assert.throws(() => validateFiles([{ path: 'paper.svg', dataUrl: png }]), /不支持/);
});
test('basename fallback warns and refuses ambiguous files', () => {
  const warnings = [];
  assert.equal(resolveResource('demo.woff', 'font', bundle, text => warnings.push(text)).path, 'fonts/demo.woff');
  assert.equal(warnings.length, 1);
  assert.throws(() => resolveResource('demo.woff', 'font', { files: [...bundle.files, { ...bundle.files[0], path: 'other/demo.woff' }] }), /不唯一/);
});
test('fonts get isolated names across family, shorthand and variables; binary resources preferred', () => {
  const { css, fonts } = compileTheme('@font-face{font-family:"Demo Font";src:local("Missing"),url(../fonts/demo.woff)} :root{--font:Demo Font} #write{font-family:Demo Font,serif} #write p{font:bold 18px "Demo Font",serif}', { sessionId: 'font-test', bundle });
  assert.equal(fonts.length, 1); assert.equal(fonts[0].dataUrl, font); assert.ok(!fonts[0].local);
  assert.ok(!css.includes('Demo Font')); assert.ok(css.includes('wm-font-font-test-0')); assert.ok(!css.includes('@font-face'));
  const disabled = compileTheme('@font-face{font-family:Demo;src:url(../fonts/demo.woff)} #write{font-family:Demo,serif}', { bundle, settings: { enableFonts: false } });
  assert.equal(disabled.fonts.length, 0);
});
test('background images and root background have separate opt-ins, preserving root layout', () => {
  const source = '#write{background:url(../images/paper.png);width:999px} #write blockquote{background-image:url(../images/paper.png);color:#333}';
  const off = compileTheme(source, { bundle }); assert.equal(off.images.length, 0); assert.ok(!off.css.includes('url('));
  const blocks = compileTheme(source, { bundle, settings: { enableBackgroundImages: true } }); assert.equal(blocks.images.length, 1); assert.ok(!blocks.css.includes('999px'));
  const all = compileTheme(source, { bundle, settings: { enableBackgroundImages: true, useThemeBackground: true } }); assert.equal(all.report.imageReferences, 2);
});
test('common Typora code classes map to existing Prism and Highlight.js tokens', () => {
  const { css } = compileTheme('#write .cm-keyword{color:purple} #write .md-fences{background:#eee}');
  assert.ok(css.includes('.token.keyword')); assert.ok(css.includes('.hljs-keyword')); assert.ok(!css.includes('.cm-keyword'));
});
test('global preferences enforce known boolean keys with conservative defaults', () => {
  assert.equal(normalizePolicy({ preserveHeadingColor: true }).preserveCodeColors, true);
  assert.equal(normalizePolicy().enableBackgroundImages, false);
  assert.throws(() => normalizePolicy({ preserveHeadingColor: 'yes' })); assert.throws(() => normalizePolicy({ arbitrary: true }));
});
