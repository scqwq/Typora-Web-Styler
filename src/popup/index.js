import { send, reportText } from '../shared/messages.js';
const $ = id => document.getElementById(id);
let tabId;
let documentToken;
let confirmedSelector = null;
let busy = false;
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
function update() { $('apply').disabled = busy || !$('confirm').checked || confirmedSelector === null; }
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
  $('confirm').disabled = false; status('正文已短暂高亮，请确认范围。');
}));
$('apply').addEventListener('click', () => action(async () => {
  const result = await send('article.apply', { tabId, documentToken, selector: confirmedSelector, themeId: $('theme').value });
  await chrome.storage.local.set({ preferredTheme: $('theme').value });
  $('reportBox').hidden = false; $('report').textContent = `${reportText(result.report)}\n已加载 ${result.resources.fontLoaded} 个字体；保留 ${result.preservedCount} 项原站样式。\n${result.resources.failures.join('\n')}`;
  status(`主题已应用。已保护 ${result.protectedCount} 个控件、公式或图表区域。${result.resources.failures.length ? '部分资源未加载，详见报告和日志。' : ''}`);
}));
$('restore').addEventListener('click', () => action(async () => {
  await send('article.restore', { tabId }); $('reportBox').hidden = true; status('已撤销主题，保留网页当前内容。');
}));
await action(async () => {
  const [tabs, themes, preferences] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), send('theme.list'), chrome.storage.local.get('preferredTheme')]);
  tabId = tabs[0]?.id;
  for (const item of themes) { const option = new Option(item.name, item.id); $('theme').add(option); }
  if (themes.some(t => t.id === preferences.preferredTheme)) $('theme').value = preferences.preferredTheme;
  try {
    const current = await send('article.status', { tabId });
    if (current.themeId && themes.some(t => t.id === current.themeId)) $('theme').value = current.themeId;
    status(current.notice || (current.active ? '当前正文已有主题，可重新识别后切换，或直接恢复。' : '选择主题，然后识别正文。'));
  } catch { status('在博客文章标签页打开此弹窗，再识别正文。'); }
});
