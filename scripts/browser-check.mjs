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
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); });
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
  for (const key of ['nav', 'copy', 'token', 'formula', 'width']) assert.deepEqual(after[key], before[key], key);
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
  await ui.screenshot({ path: path.join(artifacts, 'options.png'), fullPage: true });
  results.fixture = { passed: true, applied, checks: ['popup UI locate/confirm/apply/restore', 'import UI', 'scope', 'layout', 'protected controls/math/code', 'original node identity', 'links/hash', 'repeat apply', 'theme switch', 'low-contrast rollback', 'worker restart recovery', 'restore with new DOM', 'SPA cleanup', 'stale document rejection'] };

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
