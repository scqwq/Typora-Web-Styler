import { chromium } from 'playwright';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const testExtension = path.join(artifacts, 'test-extension');
await cp(path.join(root, 'dist'), testExtension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(testExtension, 'manifest.json'), 'utf8'));
// Automation cannot grant activeTab by clicking the browser action. Test-only permissions, never shipped.
manifest.host_permissions = ['http://127.0.0.1/*', 'https://saurlax.com/*'];
await writeFile(path.join(testExtension, 'manifest.json'), JSON.stringify(manifest, null, 2));
const fixture = await readFile(path.join(root, 'tests/fixtures/article.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...(req.url.startsWith('/csp') ? { 'Content-Security-Policy': "font-src 'none'; img-src 'none'" } : {}) }); res.end(fixture); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}`;
const results = { fixture: {}, target: {}, environment: 'Headless Chromium/Edge; dedicated test profile and test-only host permissions', errors: [] };
let context;
try {
  context = await chromium.launchPersistentContext(path.join(root, `.cache/browser-profile-${Date.now()}`), {
    ...(process.env.WM_BROWSER === 'chromium' ? { channel: 'chromium' } : { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }),
    headless: true,
    args: [`--disable-extensions-except=${testExtension}`, `--load-extension=${testExtension}`, '--enable-unsafe-extension-debugging'],
    viewport: { width: 1365, height: 1000 }
  });
  context.on('weberror', error => results.errors.push(error.error().message));
  let worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${id}/options/index.html`);
  await ui.locator('#themes .theme').first().waitFor();
  const article = await context.newPage(); await article.goto(address);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url + '/').id, address);
  const send = async (type, extra = {}) => {
    const response = await ui.evaluate(async data => chrome.runtime.sendMessage(data), { type, tabId, ...extra });
    assert.ok(response.ok, response.error); return response.value;
  };
  const snapshot = () => article.evaluate(() => {
    const css = selector => { const s = getComputedStyle(document.querySelector(selector)); return { color: s.color, font: s.fontFamily, size: s.fontSize, background: s.backgroundColor }; };
    return { heading: css('#heading'), nav: css('#outside'), copy: css('#copy'), token: css('.token'), formula: css('.katex'), width: document.querySelector('article').getBoundingClientRect().width };
  });
  const before = await snapshot(); await article.screenshot({ path: path.join(artifacts, 'fixture-before.png'), fullPage: true });
  const found = await send('article.locate', { selector: '#post' });
  const applied = await send('article.apply', { selector: '#post', documentToken: found.documentToken, themeId: 'builtin-paper' });
  const after = await snapshot();
  assert.notEqual(after.heading.color, before.heading.color);
  for (const key of ['nav', 'copy', 'formula', 'width']) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.token.color, before.token.color);
  assert.equal(await article.evaluate(() => document.querySelector('#heading') === window.originalHeading), true);
  await article.locator('#copy').click(); assert.equal(await article.evaluate(() => window.copies), 1);
  await article.locator('#anchor').click(); assert.ok(article.url().endsWith('#heading'));
  await article.evaluate(() => { const p = document.createElement('p'); p.id = 'new-node'; p.textContent = '网站运行期间新增的内容'; document.querySelector('article').append(p); });
  await send('article.apply', { selector: '#post', documentToken: found.documentToken, themeId: 'builtin-paper' });
  assert.equal(await article.locator('[data-wm-article]').count(), 1);
  await article.screenshot({ path: path.join(artifacts, 'fixture-after.png'), fullPage: true });

  // Import through the actual options UI, then switch without changing the original heading node.
  await ui.locator('#file').setInputFiles({ name: 'violet.css', mimeType: 'text/css', buffer: Buffer.from('html { font-size: 18px; } #write h2 { color: #bc315c; font-size: 2rem; }') });
  await ui.locator('#import').click(); await ui.locator('#themes .theme').nth(1).waitFor();
  const themes = await ui.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'theme.list' })).value);
  await send('article.apply', { selector: '#post', documentToken: found.documentToken, themeId: themes[1].id });
  assert.equal((await snapshot()).heading.color, 'rgb(188, 49, 92)');
  const unreadable = await send('theme.import', { name: '低对比度测试', source: '#write h2, #write p { color: white; }' });
  const rejected = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type: 'article.apply', tabId, selector: '#post', documentToken: found.documentToken, themeId: unreadable.id });
  assert.equal(rejected.ok, false); assert.ok(rejected.error.includes('背景'));
  assert.equal((await snapshot()).heading.color, 'rgb(188, 49, 92)');
  const cdp = await context.newCDPSession(ui);
  await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers');
  assert.equal((await send('article.status')).active, true);
  await send('article.restore'); assert.deepEqual(await snapshot(), before);
  assert.equal(await article.locator('[data-wm-article], [data-wm-protected]').count(), 0);
  assert.equal(await article.locator('#new-node').count(), 1);
  await article.locator('#copy').click(); assert.equal(await article.evaluate(() => window.copies), 2);
  // SPA URL changes deactivate old scope, clean CSS and keep new DOM.
  await send('article.apply', { selector: '#post', documentToken: found.documentToken, themeId: 'builtin-paper' });
  await article.evaluate(() => history.pushState({}, '', '/next'));
  await article.waitForFunction(() => !document.querySelector('[data-wm-article]'));
  assert.deepEqual(await snapshot(), before);
  await article.reload();
  const stale = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type: 'article.apply', tabId, selector: '#post', documentToken: found.documentToken, themeId: 'builtin-paper' });
  assert.equal(stale.ok, false); assert.ok(stale.error.includes('导航'));
  const popup = await context.newPage();
  await article.bringToFront();
  await popup.goto(`chrome-extension://${id}/popup/index.html`);
  await popup.locator('#theme option').first().waitFor({ state: 'attached' });
  await popup.locator('#selector').fill('#post');
  await popup.locator('#locate').click();
  await popup.locator('#confirm').check();
  await popup.locator('#apply').click();
  await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('主题已应用'));
  assert.notEqual((await snapshot()).heading.color, before.heading.color);
  await popup.locator('body').screenshot({ path: path.join(artifacts, 'popup.png') });
  await popup.locator('#restore').click();
  await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已撤销'));
  assert.deepEqual(await snapshot(), before);
  // Preferences capture the original page, even while switching an already active theme.
  const original = await article.evaluate(() => {
    const get = selector => { const s = getComputedStyle(document.querySelector(selector)); return [s.fontSize, s.fontFamily, s.color, s.lineHeight, s.backgroundColor]; };
    return { heading: get('#heading'), body: get('article p'), code: get('pre code'), link: get('#anchor') };
  });
  const detailed = await send('theme.import', { name: '配置验证', source: '#write h2{font:italic 42px/3 Georgia !important;color:#993311 !important} #write p{font:28px/2 Georgia !important} #write a{color:red !important} #write pre,#write code{background:#eee !important} #write .cm-keyword{color:#552288 !important}' });
  await article.evaluate(() => document.querySelector('.token').classList.add('keyword'));
  const current = await send('article.locate', { selector: '#post' });
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: detailed.id });
  for (const key of ['preserveHeadingSize', 'preserveHeadingColor', 'preserveBodyFont', 'preserveBodySize', 'preserveLineHeight', 'preserveLinkColor', 'preserveCodeBackground']) await ui.locator(`#${key}`).check();
  await ui.locator('#saveSettings').click(); await ui.waitForFunction(() => document.querySelector('#settingsStatus').textContent.includes('已保存'));
  const preserved = await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: detailed.id });
  assert.ok(preserved.preservedCount > 0);
  const kept = await article.evaluate(() => {
    const get = selector => { const s = getComputedStyle(document.querySelector(selector)); return [s.fontSize, s.fontFamily, s.color, s.lineHeight, s.backgroundColor]; };
    return { heading: get('#heading'), body: get('article p'), code: get('pre code'), link: get('#anchor') };
  });
  for (const index of [0,1,2,3]) assert.equal(kept.heading[index], original.heading[index]);
  for (const index of [0,1,3]) assert.equal(kept.body[index], original.body[index]);
  assert.equal(kept.link[2], original.link[2]); assert.equal(kept.code[4], original.code[4]);
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: 'builtin-paper' });
  assert.equal((await snapshot()).heading.size, before.heading.size); // shared across themes
  await article.evaluate(() => document.querySelector('#heading').style.setProperty('color', 'rgb(1, 2, 3)', 'important'));
  await send('article.restore'); assert.equal((await snapshot()).heading.color, 'rgb(1, 2, 3)');
  await article.evaluate(() => document.querySelector('#heading').removeAttribute('style'));
  await send('settings.set', { settings: { preserveHeadingSize: false, preserveHeadingColor: false, preserveBodyFont: false, preserveBodySize: false, preserveLineHeight: false, preserveLinkColor: false, preserveCodeBackground: false, preserveCodeColors: false } });
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: detailed.id });
  assert.equal((await snapshot()).token.color, 'rgb(85, 34, 136)'); await send('article.restore');

  // A real system font is read only at runtime, never copied into the repository.
  const fontBuffer = await readFile('C:/Windows/Fonts/arial.ttf');
  await ui.locator('#file').setInputFiles({ name: 'local-font.css', mimeType: 'text/css', buffer: Buffer.from('@font-face{font-family:LocalTest;src:url(fonts/local.ttf)} #write{font-family:LocalTest,serif} #write h2{color:#663399}') });
  await ui.locator('#resources').setInputFiles({ name: 'local.ttf', mimeType: 'font/ttf', buffer: fontBuffer });
  await ui.locator('#import').click(); await ui.waitForFunction(() => document.querySelector('#status').textContent.includes('已导入“local-font”'));
  const fontTheme = (await send('theme.list')).find(theme => theme.name === 'local-font');
  assert.equal(fontTheme.resourceCount, 1);
  const fontResult = await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: fontTheme.id });
  assert.equal(fontResult.resources.fontLoaded, 1); assert.deepEqual(fontResult.resources.failures, []);
  assert.equal(await article.evaluate(() => [...document.fonts].filter(face => face.family.startsWith('wm-font-')).length), 1);
  assert.ok(await article.evaluate(() => getComputedStyle(document.querySelector('article')).fontFamily.includes('wm-font-')));
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: 'builtin-paper' });
  assert.equal(await article.evaluate(() => [...document.fonts].filter(face => face.family.startsWith('wm-font-')).length), 0);
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: fontTheme.id });
  await send('article.restore'); assert.equal(await article.evaluate(() => [...document.fonts].filter(face => face.family.startsWith('wm-font-')).length), 0);
  const imageSource = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const imageTheme = await send('theme.import', { name: '字体背景资源', source: '@font-face{font-family:ImageFont;src:url(local.ttf)} #write{font-family:ImageFont,serif;background-image:url(paper.png)} #write h2{color:#663399}', resources: { files: [{ path: 'local.ttf', dataUrl: 'data:font/ttf;base64,' + fontBuffer.toString('base64') }, { path: 'paper.png', dataUrl: imageSource }] } });
  await send('settings.set', { settings: { enableBackgroundImages: true, useThemeBackground: true } });
  const imageResult = await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: imageTheme.id });
  assert.deepEqual(imageResult.resources.failures, []);
  assert.ok(await article.evaluate(() => getComputedStyle(document.querySelector('article')).backgroundImage.includes('data:image/png')));
  await send('article.restore');
  const restricted = await context.newPage(); await restricted.goto(address + '/csp');
  const restrictedId = await ui.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, address + '/csp');
  const restrictedTarget = await send('article.locate', { tabId: restrictedId, selector: '#post' });
  const restrictedResult = await send('article.apply', { tabId: restrictedId, selector: '#post', documentToken: restrictedTarget.documentToken, themeId: imageTheme.id });
  assert.equal(restrictedResult.resources.fontLoaded, 1); assert.ok(Array.isArray(restrictedResult.resources.failures));
  results.resourceCsp = { fontLoaded: restrictedResult.resources.fontLoaded, failures: restrictedResult.resources.failures, note: 'Observed in extension isolated world; CSP behavior may differ by browser and resource source' };
  await send('article.restore', { tabId: restrictedId }); await restricted.close();
  const damagedTheme = await send('theme.import', { name: '损坏资源回退', source: '@font-face{font-family:Broken;src:url(bad.woff)} #write{font-family:Broken,serif} #write blockquote{background-image:url(bad.png)}', resources: { files: [{ path: 'bad.woff', dataUrl: 'data:font/woff;base64,' + Buffer.from('wOFF broken fixture').toString('base64') }, { path: 'bad.png', dataUrl: 'data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10]).toString('base64') }] } });
  const damagedResult = await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: damagedTheme.id });
  assert.equal(damagedResult.resources.fontLoaded, 0); assert.equal(damagedResult.resources.failures.length, 2);
  await send('article.restore');
  await send('settings.set', { settings: { enableBackgroundImages: false, useThemeBackground: false } });
  await send('settings.set', { settings: { preserveCodeColors: true } });
  // Global background through the real UI, independent of theme resources.
  const backgroundBefore = await article.evaluate(() => ({ body: document.body.style.cssText, root: document.querySelector('#post').style.cssText }));
  const globalImage = await ui.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
    const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0, 0, 960, 600);
    gradient.addColorStop(0, '#357e88'); gradient.addColorStop(0.5, '#c3d9ad'); gradient.addColorStop(1, '#bba2ce');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 600); return canvas.toDataURL('image/png');
  });
  await ui.locator('#backgroundFile').setInputFiles({ name: 'my-background.png', mimeType: 'image/png', buffer: Buffer.from(globalImage.split(',')[1], 'base64') });
  await ui.waitForFunction(() => document.querySelector('#backgroundName').textContent === 'my-background.png');
  await ui.locator('#surfaceOpacity').fill('60'); await ui.locator('#imageOpacity').fill('35');
  await ui.locator('#saveBackground').click();
  await ui.waitForFunction(() => document.querySelector('#backgroundStatus').textContent.includes('背景配置已保存'));
  await ui.reload(); await ui.locator('#backgroundName').filter({ hasText: 'my-background.png' }).waitFor();
  assert.equal(await ui.locator('#surfaceOpacity').inputValue(), '60'); assert.equal(await ui.locator('#imageOpacity').inputValue(), '35');
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: 'builtin-paper' });
  assert.equal(await article.locator('[data-wm-background]').count(), 1);
  assert.equal(await article.evaluate(() => getComputedStyle(document.querySelector('[data-wm-background]')).opacity), '0.35');
  assert.equal(await article.evaluate(() => getComputedStyle(document.querySelector('#post')).backgroundColor), 'rgba(255, 255, 255, 0.6)');
  await article.locator('#copy').click();
  await article.screenshot({ path: path.join(artifacts, 'global-background.png'), fullPage: true });
  await ui.locator('#background').screenshot({ path: path.join(artifacts, 'global-background-options.png') });
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: imageTheme.id });
  assert.equal(await article.locator('[data-wm-background]').count(), 1);
  assert.equal(await article.evaluate(() => getComputedStyle(document.querySelector('#post')).backgroundImage), 'none');
  const backgroundRejected = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type: 'article.apply', tabId, selector: '#post', documentToken: current.documentToken, themeId: unreadable.id });
  assert.equal(backgroundRejected.ok, false); assert.equal(await article.locator('[data-wm-background]').count(), 1);
  await cdp.send('ServiceWorker.stopAllWorkers');
  assert.equal((await send('background.get')).settings.imageOpacity, 35);
  await send('article.restore'); assert.equal(await article.locator('[data-wm-background]').count(), 0);
  assert.deepEqual(await article.evaluate(() => ({ body: document.body.style.cssText, root: document.querySelector('#post').style.cssText })), backgroundBefore);
  await send('background.set', { settings: { enabled: true, surfaceOpacity: 0, imageOpacity: 100 } });
  await send('article.apply', { selector: '#post', documentToken: current.documentToken, themeId: 'builtin-paper' });
  assert.equal(await article.evaluate(() => getComputedStyle(document.querySelector('#post')).backgroundColor), 'rgba(255, 255, 255, 0)');
  await article.evaluate(() => document.querySelector('#post').style.setProperty('background-color', 'rgb(12, 34, 56)', 'important'));
  await send('article.restore'); assert.equal(await article.evaluate(() => document.querySelector('#post').style.backgroundColor), 'rgb(12, 34, 56)');
  await article.evaluate(() => document.querySelector('#post').removeAttribute('style'));
  await ui.locator('#removeBackground').click();
  await ui.waitForFunction(() => document.querySelector('#backgroundStatus').textContent.includes('图片已删除'));
  assert.equal((await send('background.get')).image, null);
  results.globalBackground = { passed: true, checks: ['UI upload/preview/save/reload/delete', 'independent opacity', 'theme switch without duplicate layers', 'theme root image override', 'failed switch rollback', 'worker restart persistence', 'restore declarations', 'site edits retained', 'opacity endpoints', 'clickable controls'] };
  await send('theme.import', { name: '大于旧上限', source: '#write p{color:#333}/*' + 'x'.repeat(600 * 1024) + '*/' });
  const invalid = await ui.evaluate(() => chrome.runtime.sendMessage({ type: 'theme.import', name: '坏 CSS', source: 'p{' })); assert.equal(invalid.ok, false);
  const logPage = await context.newPage(); await logPage.goto(`chrome-extension://${id}/logs/index.html`);
  await logPage.locator('.entry').first().waitFor(); await logPage.locator('#level').selectOption('error');
  assert.ok(await logPage.locator('.entry.error').count() >= 2);
  const downloadPromise = logPage.waitForEvent('download'); await logPage.locator('#export').click(); const download = await downloadPromise;
  await download.saveAs(path.join(artifacts, 'logs-export.json'));
  const exported = JSON.parse(await readFile(path.join(artifacts, 'logs-export.json'), 'utf8'));
  assert.ok(exported.logs.some(item => item.category === 'conversion' && item.level === 'error'));
  assert.ok(!JSON.stringify(exported).includes('data:font'));
  await logPage.screenshot({ path: path.join(artifacts, 'logs.png'), fullPage: true });
  await logPage.locator('#clear').click(); await logPage.waitForFunction(() => document.querySelector('#status').textContent.includes('0 / 0'));
  await ui.screenshot({ path: path.join(artifacts, 'options.png'), fullPage: true });
  results.fixture = { passed: true, applied, checks: ['popup UI locate/confirm/apply/restore', 'import UI and IndexedDB resources', 'scope', 'layout', 'protected controls/math/code', 'original node identity', 'links/hash', 'repeat apply', 'theme switch', 'low-contrast rollback', 'worker restart recovery', 'restore with new DOM', 'SPA cleanup', 'stale document rejection', 'shared preferences including important font shorthand', 'site inline changes retained', 'code token mapping', 'binary fonts load/switch/restore', 'local background image', 'strict CSP font/image behavior', '600 KiB CSS import', 'log errors/filter/export/clear'] };

  const target = await context.newPage();
  try {
    await target.goto('https://saurlax.com/blog/fundamentals-of-artificial-intelligence#人工智能概述', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await target.waitForTimeout(2500);
    results.target.dom = await target.evaluate(() => [...document.querySelectorAll('article,main,[role=main]')].map(el => ({ tag: el.tagName, id: el.id, classes: el.className, characters: el.textContent.length, headings: el.querySelectorAll('h1,h2,h3').length, code: el.querySelectorAll('pre').length, math: el.querySelectorAll('.katex,mjx-container,.MathJax').length, diagrams: el.querySelectorAll('.mermaid,svg').length })));
    const actualTab = await ui.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.startsWith('https://saurlax.com/blog/fundamentals-of-artificial-intelligence')).id);
    const command = async (type, fields = {}) => {
      const response = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type, tabId: actualTab, ...fields });
      assert.ok(response.ok, response.error); return response.value;
    };
    await target.screenshot({ path: path.join(artifacts, 'saurlax-before.png'), fullPage: true });
    await target.screenshot({ path: path.join(artifacts, 'saurlax-before-viewport.png') });
    const actual = await command('article.locate');
    results.target.selected = actual.description;
    results.target.applied = await command('article.apply', { documentToken: actual.documentToken, themeId: 'builtin-paper' });
    await target.screenshot({ path: path.join(artifacts, 'saurlax-after.png'), fullPage: true });
    await target.screenshot({ path: path.join(artifacts, 'saurlax-after-viewport.png') });
    await command('article.restore');
    assert.equal(await target.locator('[data-wm-article], [data-wm-protected]').count(), 0);
    results.target.passed = true;
  } catch (error) { results.target.error = error.message; }
  assert.deepEqual(results.errors, [], 'extension/page errors');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify(results, null, 2));
  await context?.close(); await new Promise(resolve => server.close(resolve));
}
