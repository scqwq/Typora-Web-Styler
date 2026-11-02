import '../shared/appearance.js';
import { send, reportText } from '../shared/messages.js';
import { hostPattern } from '../shared/auto-policy.js';
const $ = id => document.getElementById(id);
let tabId;
let documentToken;
let confirmedSelector = null;
let busy = false;
let autoSettings = { enabled: false, sameSiteOnly: false };
let targetUrl;
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
function update() {
  const disabled = busy || !$('confirm').checked || confirmedSelector === null;
  $('apply').disabled = disabled;
}
async function action(task) {
  if (busy) return;
  busy = true; for (const id of ['locate', 'restore', 'theme', 'selector']) $(id).disabled = true; update();
  try { await task(); } catch (error) { status(error.message, true); }
  finally { busy = false; for (const id of ['locate', 'restore', 'theme', 'selector']) $(id).disabled = false; update(); }
}
$('confirm').addEventListener('change', update);
$('selector').addEventListener('input', () => { confirmedSelector = null; $('confirm').checked = false; $('confirm').disabled = true; update(); });
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('locate').addEventListener('click', () => action(async () => {
  $('confirm').checked = false; confirmedSelector = null;
  const selector = $('selector').value.trim();
  const found = await send('article.locate', { tabId, selector });
  documentToken = found.documentToken; confirmedSelector = selector;
  const d = found.description;
  $('target').textContent = `${d.title}\n${d.element}${d.id ? `#${d.id}` : ''} · ${d.characters} 字 · ${d.headings} 个标题 · ${d.codeBlocks} 个代码块`;
  $('confirm').disabled = false; $('confirm').checked = true; status('已识别正文。');
}));
$('apply').addEventListener('click', () => action(async () => {
  let permissionNotice = '';
  if (autoSettings.enabled && autoSettings.sameSiteOnly) {
    const pattern = hostPattern(targetUrl);
    if (pattern) {
      try { if (!await chrome.permissions.request({ origins: [pattern] })) permissionNotice = '未获得持续网站访问授权，自动应用仅能在临时授权有效时工作。'; }
      catch { permissionNotice = '持续网站访问授权未取得，自动应用可能受限。'; }
    }
  }
  const result = await send('article.apply', { tabId, documentToken, selector: confirmedSelector, themeId: $('theme').value });
  await chrome.storage.local.set({ preferredTheme: $('theme').value });
  $('reportBox').hidden = false; $('report').textContent = `${reportText(result.report)}\n已加载 ${result.resources.fontLoaded} 个字体；保留 ${result.preservedCount} 项原站样式。\n${result.resources.failures.join('\n')}`;
  status(`已应用主题。${result.resources.failures.length ? '部分资源未加载，见转换详情。' : ''}${result.automation?.registered ? '此标签页将自动沿用。' : result.automation?.notice ?? ''}${permissionNotice}`);
}));
$('restore').addEventListener('click', () => action(async () => {
  await send('article.restore', { tabId }); $('reportBox').hidden = true; status('已恢复原样，自动沿用已暂停。');
}));
await action(async () => {
  const [tabs, themes, preferences, automatic] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), send('theme.list'), chrome.storage.local.get('preferredTheme'), send('auto.get')]);
  tabId = tabs[0]?.id;
  targetUrl = tabs[0]?.url; autoSettings = automatic;
  for (const item of themes) { const option = new Option(item.name, item.id); $('theme').add(option); }
  if (themes.some(t => t.id === preferences.preferredTheme)) $('theme').value = preferences.preferredTheme;
  try {
    const current = await send('article.status', { tabId });
    if (current.themeId && themes.some(t => t.id === current.themeId)) $('theme').value = current.themeId;
    status(current.notice || (current.active ? '已应用主题。重新识别可切换主题。' : current.automation?.paused ? '自动沿用已暂停，手动应用后恢复。' : ''));
  } catch { status('请在文章网页中打开扩展面板。'); }
});
