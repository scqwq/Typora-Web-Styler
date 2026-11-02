import { chromium } from 'playwright';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts'); await mkdir(artifacts, { recursive: true });
const extension = path.join(artifacts, 'bookmark-test-extension');
await cp(path.join(root, 'dist'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
// Test-only host permission, never added to the shipped manifest.
manifest.host_permissions = ['http://*/*', 'https://*/*'];
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2));
const paragraphs = Array.from({ length: 60 }, (_, i) => `<p id="p${i}">第${i}段：这里是用于验证阅读位置的普通正文。关键词${i} 位于这一段的中间。<strong>内联文字${i}</strong>。每个段落都有足够的文字来验证换行、滚动与文字位置恢复，而不是依赖固定的页面像素坐标。</p>`).join('');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:white;color:#26372c;font:18px/1.8 sans-serif}header{position:fixed;top:0;height:64px;background:#eef4e9;width:100%;z-index:10}.spacer{height:300px}.scroll{height:460px;overflow:auto;width:70%;margin:0 auto;border:1px solid #ccc}article{padding:32px}p{margin:30px 0}footer{height:500px}</style></head><body><header>固定页头</header><div class="spacer"></div><div class="scroll"><article id="post"><h1>页面标签验证</h1>${paragraphs}</article></div><footer></footer></body></html>`;
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}/article`;
const report = { environment: 'Dedicated headless Edge profile with test-only pregranted web host permissions', checks: [], errors: [] };
const profile = path.join(root, `.cache/bookmark-profile-${Date.now()}`);
const launchOptions = {
  ...(process.env.WM_BROWSER === 'chromium' ? { channel: 'chromium' } : { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }),
  headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging'], viewport: { width: 1365, height: 900 }
};
let context;
const passed = name => { report.checks.push(name); console.log(`PASS ${name}`); };
try {
  context = await chromium.launchPersistentContext(profile, launchOptions);
  context.on('weberror', event => report.errors.push(event.error().message));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const ui = await context.newPage(); await ui.goto(`chrome-extension://${id}/options/index.html`);
  const page = await context.newPage(); await page.goto(address);
  const tabId = await ui.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, address);
  async function send(type, fields = {}) {
    const result = await ui.evaluate(data => chrome.runtime.sendMessage(data), { type, tabId, ...fields });
    assert.ok(result?.ok, result?.error); return result.value;
  }
  const host = page.locator('[data-wm-bookmarks]');
  const panel = host.locator('.panel');
  async function select(paragraph, exact) {
    await page.locator(`#${paragraph}`).scrollIntoViewIfNeeded();
    await page.evaluate(({ paragraph, exact }) => {
      const block = document.getElementById(paragraph);
      const range = document.createRange(), start = block.textContent.indexOf(exact);
      if (start < 0) throw new Error('Fixture selection missing');
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node, offset = 0, begun = false;
      while ((node = walker.nextNode())) {
        if (!begun && offset + node.length > start) { range.setStart(node, start - offset); begun = true; }
        if (begun && offset + node.length >= start + exact.length) { range.setEnd(node, start + exact.length - offset); break; }
        offset += node.length;
      }
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }, { paragraph, exact });
    await host.locator('.record').waitFor({ state: 'visible' });
    if (!report.markerButton) {
      report.markerButton = await host.locator('.toolbar').evaluate(node => ({ width: node.getBoundingClientRect().width, unscaledWidth: node.offsetWidth }));
      assert.ok(Math.abs(report.markerButton.width / report.markerButton.unscaledWidth - .8) < .02);
      await host.locator('.toolbar').screenshot({ path: path.join(artifacts, 'bookmark-marker-small.png') });
    }
    await host.locator('.record').click();
  }
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup/index.html`);
  assert.equal(await popup.locator('#bookmarks').count(), 0); await popup.close();
  assert.deepEqual(await ui.locator('section[aria-labelledby="importTitle"] > details > summary').allTextContents(), ['本地 CSS 与目录', '本地 ZIP', '从链接导入']);
  assert.equal(await ui.locator('h1').innerText(), '让阅读变成你熟悉的样子');
  assert.equal(await ui.locator('#settingsTitle').innerText(), '样式设置');
  assert.equal(await ui.locator('#automationTitle').innerText(), '主题沿用设置');
  assert.ok(await ui.evaluate(() => !!(document.querySelector('#bookmarkSettings').compareDocumentPosition(document.querySelector('#nodeSettings')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  await ui.locator('#maxArticleNodes').fill('65000'); await ui.locator('#saveNodeSettings').click();
  await ui.waitForFunction(() => document.querySelector('#settingsStatus').textContent.includes('已保存'));
  assert.equal((await send('settings.get')).maxArticleNodes, 65000);
  // Simulate permission refusal at the native UI boundary; the formal manifest remains optional.
  await ui.evaluate(() => { globalThis.originalPermissionRequest = chrome.permissions.request; chrome.permissions.request = async () => false; });
  await ui.locator('#bookmarksEnabled').click();
  await ui.waitForFunction(() => document.querySelector('#bookmarkSettingsStatus').textContent.includes('未取得'));
  assert.equal(await ui.locator('#bookmarksEnabled').isChecked(), false); assert.equal(await host.count(), 0);
  await ui.evaluate(() => { chrome.permissions.request = globalThis.originalPermissionRequest; });
  await ui.locator('#bookmarksEnabled').check(); await host.waitFor(); assert.equal(await panel.count(), 0);
  await ui.waitForFunction(() => document.querySelector('#bookmarkSettingsStatus').textContent.includes('已开启'));
  const registered = await ui.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  assert.ok(registered.some(script => script.id === 'wm-page-bookmarks' && script.persistAcrossSessions));
  await ui.screenshot({ path: path.join(artifacts, 'settings-bookmark-layout.png'), fullPage: true });
  passed('settings layout, relocated node save, refused permission and persistent bookmark switch work');

  await select('p12', '关键词12 位于这一段的中间。内联文字12'); await panel.locator('.row').waitFor();
  assert.equal(await panel.locator('.label').innerText(), '标签1');
  await page.waitForFunction(() => document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelector('.marker')?.hidden === false);
  await select('p35', '关键词35'); await panel.locator('.row').nth(1).waitFor();
  assert.deepEqual(await panel.locator('.label').allTextContents(), ['标签1', '标签2']);
  const colors = await panel.locator('.dot').evaluateAll(nodes => nodes.map(node => node.style.background));
  assert.notEqual(colors[0], colors[1]); passed('selection creates numbered bookmarks and matching colored line markers');

  await panel.getByRole('button', { name: '编辑标签1', exact: true }).click();
  await panel.getByRole('textbox', { name: '标签名称' }).fill('重点概念');
  await panel.locator('input[type=color]').fill('#c43f65'); await panel.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelector('.label')?.textContent === '重点概念');
  assert.equal(await panel.locator('.dot').first().evaluate(node => node.style.background), 'rgb(196, 63, 101)');
  assert.equal(await host.locator('.marker').first().evaluate(node => node.style.color), 'rgb(196, 63, 101)');
  passed('rename and color editing update both sidebar and markers');

  await panel.locator('.jump').first().click();
  await page.waitForFunction(() => {
    const rect = document.querySelector('#p12').getBoundingClientRect(), box = document.querySelector('.scroll').getBoundingClientRect();
    return rect.top >= box.top && rect.top < box.bottom && rect.top > 64;
  });
  assert.ok(await host.locator('.flash').count()); passed('jump scrolls nested article container and highlights target below fixed header');

  const handle = panel.locator('.handle'), beforeDrag = await panel.boundingBox(), handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 20, handleBox.y + 12); await page.mouse.down();
  await page.mouse.move(handleBox.x - 140, handleBox.y + 82, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(async () => (await document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelector('.panel').style.left) !== '');
  const afterDrag = await panel.boundingBox(); assert.ok(Math.abs(afterDrag.x - beforeDrag.x) > 100);
  await panel.getByRole('button', { name: '收起', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelector('.panel').classList.contains('collapsed'));
  assert.equal(await panel.locator('.list').isVisible(), false);
  await panel.getByRole('button', { name: '展开', exact: true }).click();
  await panel.locator('.list').waitFor({ state: 'visible' });
  passed('sidebar drags, collapses and expands while retaining bookmarks');

  const found = await send('article.locate', { selector: '#post' });
  await send('article.apply', { selector: '#post', documentToken: found.documentToken, themeId: 'builtin-paper' });
  await panel.locator('.jump').first().click();
  await send('article.restore'); assert.equal(await panel.locator('.label').first().innerText(), '重点概念');
  assert.equal(await page.locator('[data-wm-article]').count(), 0);
  passed('theme application, reflow and restore retain independent bookmarks');

  await page.evaluate(() => { const p = document.createElement('p'); p.textContent = '后来新增的正文段落。'.repeat(10); document.querySelector('#post').prepend(p); document.querySelector('article').style.fontSize = '24px'; });
  await panel.locator('.jump').first().click();
  assert.ok(await host.locator('.flash').count()); passed('text anchors survive inserted paragraphs and font size changes');

  await page.screenshot({ path: path.join(artifacts, 'bookmarks-sidebar.png') });
  await page.reload(); await host.waitFor();
  await panel.locator('.row').nth(1).waitFor();
  assert.deepEqual(await panel.locator('.label').allTextContents(), ['重点概念', '标签2']);
  const cdp = await context.newCDPSession(ui); await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers');
  await select('p15', '关键词15'); await panel.locator('.row').nth(2).waitFor();
  assert.equal(await panel.locator('.label').last().innerText(), '标签3');
  passed('reload restores persisted bookmarks, backend worker restart does not lose data');

  await page.evaluate(() => { document.querySelector('#p12').textContent = '原段落已经被修改，原来选取的文字不再存在。'; });
  await panel.locator('.jump').first().click();
  await host.locator('.toast').filter({ hasText: '原文字已变化' }).waitFor();
  await panel.locator('.missing').first().waitFor(); passed('deleted content reports an unresolved bookmark instead of jumping elsewhere');

  const savedMarkup = await page.locator('#post').innerHTML();
  await page.evaluate(() => { const old = document.querySelector('#post'), replacement = old.cloneNode(true); old.replaceWith(replacement); });
  await panel.locator('.jump').nth(1).click();
  await host.locator('.flash').waitFor(); passed('replaced article root rebinds using confirmed selector');
  assert.equal(await page.locator('#post').innerHTML(), savedMarkup);

  await page.evaluate(() => { const clone = document.querySelector('#post').cloneNode(true); clone.id = 'other-post'; document.body.append(clone); });
  await send('bookmark.open', { selector: '#other-post' });
  await panel.locator('.jump').nth(1).click();
  await host.locator('.toast').filter({ hasText: '原文字已变化' }).waitFor();
  assert.equal(await host.locator('.flash').count(), 0);
  await send('bookmark.open', { selector: '#post' });
  await page.locator('#other-post').evaluate(node => node.remove());
  passed('identical text in another confirmed article cannot steal the saved anchor');

  await page.evaluate(() => {
    const control = document.createElement('button'); control.id = 'test-control'; control.textContent = '按钮文字'; document.querySelector('#post').append(control);
    const range = document.createRange(); range.selectNodeContents(control);
    getSelection().removeAllRanges(); getSelection().addRange(range);
  });
  await page.waitForFunction(() => document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelector('.toolbar').hidden);
  passed('selecting interactive control text does not offer a misleading bookmark');

  await page.setViewportSize({ width: 480, height: 450 });
  const smallBox = await panel.boundingBox(); assert.ok(smallBox.x >= 0 && smallBox.x + smallBox.width <= 480 && smallBox.y >= 0 && smallBox.y + smallBox.height <= 450);
  await page.screenshot({ path: path.join(artifacts, 'bookmarks-small-window.png') });
  passed('sidebar remains inside a resized viewport');

  for (let count = 3; count > 0; count--) {
    await panel.locator('.summary .icon-button').first().click(); await panel.getByRole('button', { name: '删除', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelectorAll('.row').length === expected, count - 1);
  }
  assert.equal(await panel.count(), 0); assert.equal(await host.locator('.marker').count(), 0);
  await select('p2', '关键词2'); await panel.locator('.row').waitFor();
  assert.equal(await panel.locator('.label').innerText(), '标签4'); passed('deleting all labels closes the sidebar; recording again reopens it with monotonic naming');

  await send('bookmark.open', { selector: '#post' }); await send('bookmark.open', { selector: '#post' });
  assert.equal(await page.locator('[data-wm-bookmarks]').count(), 1);
  const otherPage = await context.newPage(); await otherPage.goto(address);
  const otherTab = await ui.evaluate(async url => (await chrome.tabs.query({})).filter(tab => tab.url === url).at(-1).id, address);
  await send('bookmark.open', { tabId: otherTab, selector: '#post' });
  const otherHost = otherPage.locator('[data-wm-bookmarks]');
  await otherHost.locator('.summary .icon-button').first().click();
  await otherHost.getByRole('textbox', { name: '标签名称' }).fill('另一标签页修改'); await otherHost.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-wm-bookmarks]').shadowRoot.querySelector('.label')?.textContent === '另一标签页修改');
  await otherPage.close(); passed('reopening is idempotent and edits synchronize between open tabs of the same page');

  await page.evaluate(() => history.pushState({}, '', '/different?article=2'));
  await page.waitForFunction(() => { const host = document.querySelector('[data-wm-bookmarks]'); return !host || host.shadowRoot.querySelectorAll('.row').length === 0; });
  await send('bookmark.open', { selector: '#post' }); assert.equal(await panel.count(), 0);
  passed('SPA navigation removes stale UI and isolates another article identity');
  await context.close();
  context = await chromium.launchPersistentContext(profile, launchOptions);
  context.on('weberror', event => report.errors.push(event.error().message));
  const restartedWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
  const restartedId = new URL(restartedWorker.url()).host;
  const restartedUI = await context.newPage(); await restartedUI.goto(`chrome-extension://${restartedId}/options/index.html`);
  const restartedArticle = await context.newPage(); await restartedArticle.goto(address);
  await restartedArticle.locator('[data-wm-bookmarks] .label').waitFor();
  assert.equal(await restartedUI.locator('#bookmarksEnabled').isChecked(), true);
  assert.equal(await restartedArticle.locator('[data-wm-bookmarks] .label').innerText(), '另一标签页修改');
  passed('full browser shutdown and restart preserve local bookmarks');
  await restartedUI.locator('#bookmarksEnabled').uncheck();
  await restartedArticle.locator('[data-wm-bookmarks]').waitFor({ state: 'detached' });
  assert.deepEqual(await restartedUI.evaluate(() => chrome.scripting.getRegisteredContentScripts()), []);
  await restartedArticle.reload(); assert.equal(await restartedArticle.locator('[data-wm-bookmarks]').count(), 0);
  await restartedUI.locator('#bookmarksEnabled').check();
  await restartedArticle.locator('[data-wm-bookmarks] .label').waitFor();
  assert.equal(await restartedArticle.locator('[data-wm-bookmarks] .label').innerText(), '另一标签页修改');
  passed('disabling removes tools and registration; reenabling restores saved labels');
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally {
  await writeFile(path.join(artifacts, 'bookmark-browser-results.json'), JSON.stringify(report, null, 2));
  await context?.close(); await new Promise(resolve => server.close(resolve));
}
