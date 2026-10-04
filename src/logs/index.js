import { send } from '../shared/messages.js';
const $ = id => document.getElementById(id);
const names = { import: '导入', conversion: '转换', detection: '正文识别', application: '应用与恢复', settings: '配置', success: '成功', warning: '警告', error: '错误' };
let logs = [];
function render() {
  const term = $('search').value.toLowerCase();
  const filtered = logs.filter(item => (!$('level').value || item.level === $('level').value) && (!$('category').value || item.category === $('category').value) && JSON.stringify(item).toLowerCase().includes(term));
  $('entries').replaceChildren(); $('status').textContent = `显示 ${filtered.length} / ${logs.length} 条日志。`;
  for (const item of filtered) {
    const card = document.createElement('article'); card.className = `entry ${item.level}`;
    const meta = document.createElement('small'); meta.textContent = `${new Date(item.time).toLocaleString()} · ${names[item.category] ?? item.category} · ${names[item.level] ?? item.level}`;
    const message = document.createElement('p'); message.textContent = item.message;
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '详细信息';
    const pre = document.createElement('pre'); pre.textContent = JSON.stringify(item.details, null, 2); details.append(summary, pre); card.append(meta, message, details); $('entries').append(card);
  }
}
async function refresh() { try { logs = await send('logs.list'); render(); } catch (error) { $('status').textContent = error.message; } }
for (const id of ['level', 'category', 'search']) $(id).addEventListener('input', render);
$('refresh').addEventListener('click', refresh);
$('clear').addEventListener('click', async () => { try { await send('logs.clear'); await refresh(); } catch (error) { $('status').textContent = error.message; } });
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), logs }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `web-markdown-logs-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
let timer;
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.activityLogs) { clearTimeout(timer); timer = setTimeout(refresh, 100); } });
await refresh();
