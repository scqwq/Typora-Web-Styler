import { chromium } from 'playwright';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts/ui');
await mkdir(artifacts, { recursive: true });
const before = process.argv.includes('--before');
const extension = path.join(artifacts, before ? 'before-extension' : 'after-extension');
await cp(path.join(root, 'dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*']; // Dedicated test copy only.
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const fixture = await readFile(path.join(root, 'tests/fixtures/article.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { checks: [], errors: [], appearance: [] };
// Browser action popups are separate targets, not ordinary tabs with a preset viewport.
async function nativePopup(worker, ui, mode) {
  const cdp = await ui.context().newCDPSession(ui);
  await worker.evaluate(() => chrome.action.openPopup());
  const { targetInfos } = await cdp.send('Target.getTargets');
  const target = targetInfos.find(item => item.url.endsWith('/popup/index.html') && !item.attached);
  assert.ok(target, 'browser action popup target exists');
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  let sequence = 0;
  const pending = new Map();
  cdp.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return;
    const result = JSON.parse(event.message), task = pending.get(result.id);
    if (!task) return;
    pending.delete(result.id); clearTimeout(task.timer);
    if (result.error) task.reject(new Error(result.error.message)); else task.resolve(result.result);
  });
  function command(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Popup command timed out: ${method}`)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => { clearTimeout(timer); pending.delete(id); reject(error); });
    });
  }
  try {
    await command('Runtime.evaluate', { expression: `new Promise(resolve => {
      const check = () => document.readyState === 'complete' && document.querySelector('#theme option') && document.documentElement.dataset.appearance === '${mode}' ? requestAnimationFrame(() => requestAnimationFrame(resolve)) : setTimeout(check, 20);
      check();
    })`, awaitPromise: true });
    const result = await command('Runtime.evaluate', { expression: `(() => ({ width: innerWidth, height: innerHeight, body: document.body.getBoundingClientRect().width, scrollWidth: document.documentElement.scrollWidth, background: getComputedStyle(document.documentElement).backgroundColor }))()`, returnByValue: true });
    assert.equal(result.result.value.width, 390, `${mode} native popup viewport width`);
    assert.equal(result.result.value.body, 390, `${mode} native popup body width`);
    assert.equal(result.result.value.scrollWidth, 390, `${mode} native popup has no horizontal overflow`);
    const screenshot = await command('Page.captureScreenshot');
    await writeFile(path.join(artifacts, `${mode}-native-popup.png`), Buffer.from(screenshot.data, 'base64'));
    return { mode, ...result.result.value };
  } finally {
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
    await cdp.detach();
  }
}
let context;
try {
  context = await chromium.launchPersistentContext(path.join(root, `.cache/ui-profile-${Date.now()}`), {
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging'],
    viewport: { width: 1365, height: 1000 }, colorScheme: 'light'
  });
  context.on('weberror', event => report.errors.push(event.error().message));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${id}/options/index.html`);
  await ui.locator('#themes .theme').first().waitFor();
  const article = await context.newPage();
  await article.goto(`http://127.0.0.1:${server.address().port}/`);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, article.url());
  const popup = await context.newPage();
  // A popup opened as a tab needs a fixed fixture target rather than its own active tab.
  await popup.addInitScript(id => { chrome.tabs.query = async () => [{ id, url: 'http://127.0.0.1/' }]; }, tabId);
  await popup.goto(`chrome-extension://${id}/popup/index.html`);
  await popup.locator('#theme option').first().waitFor({ state: 'attached' });
  async function screenshot(page, name, width, height) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
  }
  if (before) {
    await screenshot(ui, 'before-options-desktop', 1365, 1000);
    await screenshot(ui, 'before-options-mobile', 390, 844);
    await screenshot(popup, 'before-popup', 390, 700);
  } else {
    await ui.locator('#appearance').selectOption('dark');
    await popup.waitForFunction(() => document.documentElement.dataset.appearance === 'dark');
    await ui.reload();
    await ui.waitForFunction(() => document.querySelector('#appearance').value === 'dark');
    report.checks.push('appearance persists on reload and syncs between popup and options');
    for (const mode of ['light', 'dark']) {
      await ui.locator('#appearance').selectOption(mode);
      await popup.waitForFunction(value => document.documentElement.dataset.appearance === value, mode);
      for (const [page, name, width, height] of [[ui, 'options-desktop', 1365, 1000], [ui, 'options-mobile', 390, 844], [ui, 'options-narrow', 320, 844], [popup, 'popup', 390, 700]]) {
        await screenshot(page, `${mode}-${name}`, width, height);
      }
      await ui.setViewportSize({ width: 1365, height: 1000 });
      await ui.screenshot({ path: path.join(artifacts, `${mode}-options-top.png`) });
      report.appearance.push(await ui.evaluate(() => ({ mode: document.documentElement.dataset.appearance, background: getComputedStyle(document.documentElement).backgroundColor, color: getComputedStyle(document.documentElement).color })));
      await worker.evaluate(id => chrome.tabs.update(id, { active: true }), tabId);
      (report.nativePopups ??= []).push(await nativePopup(worker, ui, mode));
    }
    report.checks.push('both palettes fit desktop and narrow settings widths plus the 390px popup');
    report.checks.push('real browser action popup opens and reopens at 390px in light and dark modes');
    await popup.locator('#appearance').selectOption('system');
    await ui.waitForFunction(() => document.querySelector('#appearance').value === 'system');
    await ui.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await ui.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(30, 30, 27)');
    await ui.emulateMedia({ colorScheme: 'light' });
    assert.equal(await ui.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(247, 249, 252)');
    report.checks.push('system appearance follows light and dark media preferences');
    await ui.emulateMedia({ colorScheme: 'dark' });
    await ui.locator('#appearance').selectOption('light');
    assert.equal(await ui.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(247, 249, 252)');
    await ui.emulateMedia({ colorScheme: 'light' });
    await ui.evaluate(async () => { await chrome.storage.local.set({ uiAppearance: 'obsolete-value' }); });
    await ui.waitForFunction(() => document.querySelector('#appearance').value === 'system');
    await popup.waitForFunction(() => document.querySelector('#appearance').value === 'system');
    await ui.evaluate(() => { globalThis.originalUiSet = chrome.storage.local.set; chrome.storage.local.set = async () => { throw new Error('simulated write failure'); }; });
    await ui.locator('#appearance').selectOption('dark');
    await ui.waitForFunction(() => document.querySelector('#appearanceStatus').textContent.includes('未能保存'));
    assert.equal(await ui.locator('#appearance').inputValue(), 'system');
    await ui.evaluate(() => { chrome.storage.local.set = globalThis.originalUiSet; });
    await ui.locator('#appearance').selectOption('light');
    await ui.waitForFunction(() => document.querySelector('#appearanceStatus').textContent === '');
    report.checks.push('explicit appearance overrides system; invalid values fall back and failed saves roll back');
    await ui.locator('#file').setInputFiles({ name: 'UI test.css', mimeType: 'text/css', buffer: Buffer.from('#write { color: #263849; } #write h2 { color: #315f7a; }') });
    await ui.locator('#import').click();
    await ui.locator('#themes .theme').nth(1).waitFor();
    await ui.locator('#maxArticleNodes').fill('65000');
    await ui.locator('#saveNodeSettings').click();
    await ui.waitForFunction(async () => (await chrome.storage.local.get('globalSettings')).globalSettings.maxArticleNodes === 65000);
    await ui.locator('#resetSettings').click();
    await ui.waitForFunction(() => document.querySelector('#maxArticleNodes').value === '60000');
    report.checks.push('CSS import, node settings and reset remain usable');
    await popup.locator('#selector').fill('#post');
    await popup.locator('#locate').click();
    await popup.waitForFunction(() => !document.querySelector('#apply').disabled);
    await popup.locator('#apply').click();
    await article.locator('[data-wm-article]').waitFor();
    await popup.locator('#reportBox').waitFor();
    await screenshot(popup, 'light-popup-applied', 390, 700);
    await popup.locator('#restore').click();
    await article.locator('[data-wm-article]').waitFor({ state: 'detached' });
    report.checks.push('popup locate, confirm, apply, report and restore work');
    assert.deepEqual(report.errors, []);
    await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await context?.close(); await new Promise(resolve => server.close(resolve)); }
