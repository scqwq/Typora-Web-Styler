import { chromium } from 'playwright';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts'); await mkdir(artifacts, { recursive: true });
const extension = path.join(artifacts, 'auto-test-extension'); await cp(path.join(root, 'dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
// Dedicated automation copy simulates approved permissions; never distributed.
manifest.permissions.push('webNavigation'); manifest.host_permissions = ['http://*/*', 'https://*/*'];
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2));
const fixture = await readFile(path.join(root, 'tests/fixtures/article.html'), 'utf8');
const articleMarkup = fixture.match(/<article[\s\S]*?<\/article>/)[0];
const server = createServer((req, res) => {
  let html = fixture;
  if (req.url.startsWith('/delayed')) html = fixture.replace(articleMarkup, `<script>setTimeout(()=>document.body.insertAdjacentHTML('beforeend',${JSON.stringify(articleMarkup)}),1200)</script>`).replace("document.querySelector('#copy').addEventListener", "document.querySelector('#copy')?.addEventListener");
  if (req.url.startsWith('/ambiguous')) html = fixture.replace('</body>', articleMarkup.replace('id="post"', 'id="other-post"') + '</body>');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const port = server.address().port, address = `http://127.0.0.1:${port}`, otherAddress = `http://localhost:${port}`;
const results = { fixture: { passed: false }, target: {}, errors: [], environment: 'Dedicated headless Edge; HTTP/HTTPS + webNavigation pregranted ONLY in test copy; native authorization dialog not automated' };
let context;
try {
  context = await chromium.launchPersistentContext(path.join(root, `.cache/auto-profile-${Date.now()}`), { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging'], viewport: { width: 1365, height: 1000 } });
  context.on('weberror', event => results.errors.push(event.error().message));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const ui = await context.newPage(); await ui.goto(`chrome-extension://${id}/options/index.html`); await ui.locator('#themes .theme').first().waitFor();
  const article = await context.newPage(); await article.goto(address);
  const tabId = await ui.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url + '/').id, address);
  const send = async (type, extra = {}) => {
    const result = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type, tabId, ...extra });
    assert.ok(result?.ok, result?.error); return result.value;
  };
  const waitApplied = page => page.waitForFunction(() => {
    const root = document.querySelector('[data-wm-article]'), heading = root?.querySelector('h2');
    return root && heading && getComputedStyle(heading).color === 'rgb(121, 80, 163)';
  }, null, { timeout: 18000 });
  const manual = async (pageTab = tabId, selector = '') => {
    const found = await send('article.locate', { tabId: pageTab, selector });
    return send('article.apply', { tabId: pageTab, selector, documentToken: found.documentToken, themeId: 'builtin-paper' });
  };
  assert.equal(await ui.locator('#sameSiteOnly').isDisabled(), true);
  await ui.locator('#autoEnabled').check(); assert.equal(await ui.locator('#sameSiteOnly').isDisabled(), false);
  await ui.locator('#sameSiteOnly').check(); await ui.locator('#saveAuto').click();
  await ui.waitForFunction(() => document.querySelector('#autoStatus').textContent.includes('偏好已保存'));
  await ui.reload(); await ui.waitForFunction(() => document.querySelector('#autoEnabled').checked);
  assert.equal(await ui.locator('#sameSiteOnly').isChecked(), true);
  await ui.locator('#automation').screenshot({ path: path.join(artifacts, 'auto-options.png') });
  // Successful popup apply, without explicitly checking the confirmation checkbox.
  const popup = await context.newPage(); await article.bringToFront(); await popup.goto(`chrome-extension://${id}/popup/index.html`);
  await popup.locator('#theme option').first().waitFor({ state: 'attached' });
  await popup.locator('#locate').click(); await popup.waitForFunction(() => document.querySelector('#confirm').checked);
  await popup.locator('#apply').click(); await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已记住此标签页'));
  await popup.close();
  await article.reload(); await waitApplied(article);
  assert.equal(await article.locator('[data-wm-article]').count(), 1);
  await article.goto(address + '/chapter-two'); await waitApplied(article);
  const unregistered = await context.newPage(); await unregistered.goto(address + '/chapter-two');
  await unregistered.waitForTimeout(500); assert.equal(await unregistered.locator('[data-wm-article]').count(), 0);
  // An existing document swaps its article before updating history.
  await article.evaluate(() => { const old = document.querySelector('article'); const next = old.cloneNode(true); next.removeAttribute('data-wm-article'); next.querySelectorAll('[data-wm-protected]').forEach(el => el.removeAttribute('data-wm-protected')); old.replaceWith(next); history.pushState({}, '', '/spa-chapter'); });
  await waitApplied(article);
  const historySession = await article.locator('[data-wm-article]').getAttribute('data-wm-article');
  await article.evaluate(() => history.pushState({}, '', '/history-only'));
  await article.waitForFunction(previous => document.querySelector('[data-wm-article]')?.getAttribute('data-wm-article') !== previous && !!document.querySelector('[data-wm-article]'), historySession);
  await waitApplied(article);
  await article.goBack(); await waitApplied(article);
  await article.goto(address + '/delayed'); await waitApplied(article);
  // Same-site restriction prevents navigation to another origin, even with broad test permissions.
  await article.goto(otherAddress + '/other'); await article.waitForTimeout(700);
  assert.equal(await article.locator('[data-wm-article]').count(), 0);
  await article.goto(address + '/return'); await waitApplied(article);
  // Restoring pauses the tab across reloads, then manual apply resumes it.
  await send('article.restore'); await article.reload(); await article.waitForTimeout(700);
  assert.equal(await article.locator('[data-wm-article]').count(), 0);
  assert.equal((await send('article.status')).automation.paused, true);
  await manual(); await article.reload(); await waitApplied(article);
  const cdp = await context.newCDPSession(ui); await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers');
  await article.reload(); await waitApplied(article);
  // Ambiguous pages are skipped, then subsequent navigations can resume normally.
  await article.goto(address + '/ambiguous'); await article.waitForTimeout(14000);
  assert.equal(await article.locator('[data-wm-article]').count(), 0);
  assert.ok((await send('logs.list')).some(entry => entry.message.includes('自动应用已跳过')));
  await article.goto(address + '/normal'); await waitApplied(article);
  // Disable same-site restriction; cross-origin auto detection must not reuse custom selectors.
  await manual(tabId, '#post');
  await ui.locator('#sameSiteOnly').uncheck(); await ui.locator('#saveAuto').click();
  await ui.waitForFunction(() => document.querySelector('#autoStatus').textContent.includes('偏好已保存'));
  await article.goto(otherAddress + '/cross'); await waitApplied(article);
  // Closing one tab must not transfer its registration to a new tab at the same URL.
  await article.close();
  await ui.waitForFunction(async closed => !(await chrome.storage.session.get('autoTabs')).autoTabs?.[closed], tabId);
  const replacement = await context.newPage(); await replacement.goto(otherAddress + '/cross'); await replacement.waitForTimeout(700);
  assert.equal(await replacement.locator('[data-wm-article]').count(), 0);
  await ui.locator('#autoEnabled').uncheck(); assert.equal(await ui.locator('#sameSiteOnly').isDisabled(), true);
  await ui.locator('#saveAuto').click(); await ui.waitForFunction(() => document.querySelector('#autoStatus').textContent.includes('已关闭'));
  assert.deepEqual(await ui.evaluate(async () => (await chrome.storage.session.get('autoTabs')).autoTabs ?? {}), {});
  // Native dialog denial is simulated only at the UI API boundary; prior saved choices remain.
  await ui.evaluate(() => { globalThis.originalPermissionRequest = chrome.permissions.request; chrome.permissions.request = async () => false; });
  await ui.locator('#autoEnabled').check(); await ui.locator('#sameSiteOnly').check(); await ui.locator('#saveAuto').click();
  await ui.waitForFunction(() => document.querySelector('#autoStatus').textContent.includes('未取得授权'));
  assert.equal((await send('auto.get')).enabled, false);
  await ui.evaluate(() => { chrome.permissions.request = globalThis.originalPermissionRequest; });
  results.fixture = { passed: true, checks: ['two dependent checkboxes and persisted preferences', 'successful popup apply registers tab', 'confirmation checked after detection', 'reload and full navigation', 'SPA article replacement and history', 'delayed article readiness', 'same-site boundary and return', 'other tabs untouched', 'restore pauses across reload', 'manual apply resumes', 'worker restart', 'ambiguous root skipped', 'cross-site mode', 'closed tab forgotten', 'disable clears registration', 'permission denial leaves saved preferences'] };
  // Inspect and exercise the user's actual documentation site separately.
  const target = await context.newPage();
  try {
    await target.goto('https://go-zero.dev/zh-cn/getting-started/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await target.waitForTimeout(1200);
    results.target.dom = await target.evaluate(() => [...document.querySelectorAll('article,main,[role="main"],.sl-markdown-content')].map(el => ({ tag: el.tagName, id: el.id, classes: el.className, text: el.textContent.trim().length, headings: el.querySelectorAll('h1,h2,h3').length })));
    await send('auto.set', { settings: { enabled: true, sameSiteOnly: true } });
    const targetId = await ui.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, target.url());
    await manual(targetId); results.target.selected = (await send('article.status', { tabId: targetId })).description;
    await target.reload(); await waitApplied(target);
    await target.screenshot({ path: path.join(artifacts, 'go-zero-auto.png') });
    const nextLink = target.getByRole('link', { name: /环境安装/ }).last();
    const next = new URL(await nextLink.getAttribute('href'), target.url()).href;
    const oldTargetSession = await target.locator('[data-wm-article]').getAttribute('data-wm-article');
    await nextLink.click(); await target.waitForURL(next);
    await target.waitForFunction(previous => document.querySelector('[data-wm-article]')?.getAttribute('data-wm-article') !== previous && !!document.querySelector('[data-wm-article]'), oldTargetSession);
    await waitApplied(target); results.target.nextPage = target.url();
    await send('article.restore', { tabId: targetId });
    results.target.passed = true;
  } catch (error) { results.target.error = error.message; }
  assert.deepEqual(results.errors, []);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await writeFile(path.join(artifacts, 'auto-browser-results.json'), JSON.stringify(results, null, 2));
  await context?.close(); await new Promise(resolve => server.close(resolve));
}
