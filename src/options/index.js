import { send, reportText } from '../shared/messages.js';
const $ = id => document.getElementById(id);
let busy = false;
async function render() {
  const themes = await send('theme.list'); $('themes').replaceChildren();
  for (const theme of themes) {
    const card = document.createElement('div'); card.className = 'theme';
    const row = document.createElement('div'); row.className = 'row';
    const name = document.createElement('strong'); name.textContent = theme.name; row.append(name);
    if (theme.builtIn) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '内置测试'; row.append(tag); }
    else {
      const remove = document.createElement('button'); remove.textContent = '删除'; remove.className = 'delete';
      remove.addEventListener('click', async () => {
        if (busy) return; busy = true; remove.disabled = true;
        try { await send('theme.delete', { id: theme.id }); await render(); }
        catch (error) { $('status').textContent = error.message; $('status').className = 'error'; remove.disabled = false; }
        finally { busy = false; }
      }); row.append(remove);
    }
    card.append(row);
    if (theme.report) { const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '查看转换报告'; const pre = document.createElement('pre'); pre.textContent = reportText(theme.report); details.append(summary, pre); card.append(details); }
    $('themes').append(card);
  }
}
$('file').addEventListener('change', () => {
  if (!$('name').value && $('file').files[0]) $('name').value = $('file').files[0].name.replace(/\.css$/i, '');
});
$('importForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return; busy = true; $('import').disabled = true;
  try {
    const file = $('file').files[0];
    if (!file || file.size > 512 * 1024) throw new Error('请选择不超过 512 KB 的 CSS 文件。');
    const theme = await send('theme.import', { name: $('name').value, source: await file.text() });
    $('status').className = ''; $('status').textContent = `已导入“${theme.name}”。\n${reportText(theme.report)}`;
    $('importForm').reset(); await render();
  } catch (error) { $('status').className = 'error'; $('status').textContent = error.message; }
  finally { busy = false; $('import').disabled = false; }
});
try { await render(); } catch (error) { $('status').textContent = error.message; $('status').className = 'error'; }
