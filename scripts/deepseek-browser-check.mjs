import { chromium } from 'playwright';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const extension = path.join(artifacts, 'deepseek-test-extension');
await cp(path.join(root, 'dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
// Only the independent test copy receives persistent hosts, never the shipped manifest.
manifest.host_permissions = ['https://chat.deepseek.com/*', 'https://example.com/*'];
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const results = { fixtures: [], errors: [], live: null };
let context;
try {
  context = await chromium.launchPersistentContext(path.join(root, `.cache/deepseek-profile-${Date.now()}`), {
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging']
  });
  context.on('weberror', error => results.errors.push(error.error().message));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const ui = await context.newPage(); await ui.goto(`chrome-extension://${id}/options/index.html`);
  await ui.locator('#themes .theme').first().waitFor();
  const live = await context.newPage();
  await live.goto('https://chat.deepseek.com/share/s9ol46mf6vaapo7hsn', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await live.locator('.ds-assistant-message-main-content').waitFor({ timeout: 20000 });
  const tabId = await ui.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url).id, live.url());
  const send = async (type, fields = {}) => {
    const response = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type, tabId, ...fields });
    assert.ok(response.ok, response.error); return response.value;
  };
  const located = await send('article.locate');
  assert.ok(located.description.className.includes('ds-assistant-message-main-content'));
  const style = () => live.locator('.ds-assistant-message-main-content p').first().evaluate(el => ({ color: getComputedStyle(el).color, font: getComputedStyle(el).fontFamily }));
  const before = await style();
  await send('article.apply', { documentToken: located.documentToken, themeId: 'builtin-paper' });
  assert.notDeepEqual(await style(), before);
  assert.equal(await live.locator('.ds-think-content [data-wm-article]').count(), 0);
  await send('article.restore'); assert.deepEqual(await style(), before);
  results.live = { passed: true, checks: ['automatic locate of final answer', 'apply changes answer appearance', 'thinking excluded', 'restore original appearance'] };
  await live.close();

  const text = '用于验证正文识别的内容。'.repeat(20);
  const answer = (id, hidden = false) => `<div id="${id}" class="ds-assistant-message-main-content" ${hidden ? 'hidden' : ''}><p>${text}</p></div>`;
  const cases = [
    { name: 'single answer excludes thinking', html: `<div class="ds-think-content ds-markdown">${text}</div>${answer('answer-a')}`, selected: 'answer-a' },
    { name: 'hidden answer ignored', html: answer('hidden', true) + answer('answer-a'), selected: 'answer-a' },
    { name: 'multiple answers require a choice', html: answer('answer-a') + answer('answer-b'), error: '多个可能' },
    { name: 'manual selection among multiple answers', html: answer('answer-a') + answer('answer-b'), selector: '#answer-b', selected: 'answer-b' },
    { name: 'missing adapter target falls back to article', html: `<article id="article">${text}</article>`, selected: 'article' },
    { name: 'DeepSeek class on another host is not auto-selected', host: 'example.com', html: answer('answer-a'), error: '未找到正文' },
    { name: 'generic detection remains available on other sites', host: 'example.com', html: `<main id="main">${text}</main>`, selected: 'main' }
  ];
  for (let i = 0; i < cases.length; i++) {
    const item = cases[i]; const page = await context.newPage();
    const url = `https://${item.host ?? 'chat.deepseek.com'}/wm-fixture-${i}`;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><title>正文夹具</title></head><body>${item.html}</body></html>` }));
    await page.goto(url);
    const fixtureTab = await ui.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url).id, url);
    const result = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type: 'article.locate', tabId: fixtureTab, selector: item.selector ?? '' });
    if (item.error) { assert.equal(result.ok, false); assert.ok(result.error.includes(item.error), result.error); }
    else { assert.ok(result.ok, result.error); assert.equal(result.value.description.id, item.selected); }
    results.fixtures.push({ name: item.name, passed: true }); await page.close();
  }
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup/index.html`);
  await popup.locator('#selectorHelp summary').click();
  assert.equal(await popup.locator('#selectorHelp li').count(), 4);
  await popup.locator('#selectorHelp').screenshot({ path: path.join(artifacts, 'selector-help.png') });
  assert.deepEqual(results.errors, []);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await writeFile(path.join(artifacts, 'deepseek-browser-results.json'), JSON.stringify(results, null, 2));
  await context?.close();
}
