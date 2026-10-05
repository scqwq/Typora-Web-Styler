import { send, reportText } from '../shared/messages.js';
import { DEFAULT_POLICY, POLICY_FIELDS } from '../shared/style-policy.js';
import { MAX_CSS_BYTES, MAX_RESOURCE_BYTES, MAX_BUNDLE_BYTES, MAX_FILES } from '../theme/resources.js';
const $ = id => document.getElementById(id);
let busy = false;
async function render() {
  const themes = await send('theme.list'); $('themeCount').textContent = `${themes.length} 个主题`; $('themes').replaceChildren();
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
  let requested = false;
  try {
    const file = $('file').files[0];
    if (!file || file.size > MAX_CSS_BYTES) throw new Error('请选择不超过 1 MB 的 CSS 文件。');
    const directory = [...$('directory').files];
    const cssMatches = directory.filter(item => item.name === file.name);
    if (cssMatches.length > 1) throw new Error('目录中有多个同名主 CSS，请选择更小的主题目录。');
    const relativePath = item => item.webkitRelativePath ? item.webkitRelativePath.split('/').slice(1).join('/') : item.name;
    const chosen = [...$('resources').files, ...directory.filter(item => /\.(woff2?|ttf|otf|png|jpe?g|webp|gif)$/i.test(item.name))];
    if (chosen.length > MAX_FILES || chosen.some(item => item.size > MAX_RESOURCE_BYTES) || chosen.reduce((total, item) => total + item.size, 0) > MAX_BUNDLE_BYTES) throw new Error('资源超过限制：最多 64 个，单个 16 MB，合计 24 MB。');
    const files = await Promise.all(chosen.map(async item => ({ path: relativePath(item), dataUrl: await readDataUrl(item) })));
    const source = await file.text(); requested = true;
    const theme = await send('theme.import', { name: $('name').value.trim() || file.name.replace(/\.css$/i, ''), source, resources: { files, sourcePath: cssMatches.length ? relativePath(cssMatches[0]) : file.name } });
    $('status').className = ''; $('status').textContent = `已导入“${theme.name}”。\n${reportText(theme.report)}`;
    $('importForm').reset(); await render();
  } catch (error) { $('status').className = 'error'; $('status').textContent = error.message; if (!requested) await send('logs.importError', { message: error.message }).catch(() => {}); }
  finally { busy = false; $('import').disabled = false; }
});
function readDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`读取资源失败：${file.name}`)); reader.readAsDataURL(file); }); }
function showPolicy(settings) { for (const [key] of POLICY_FIELDS) $(key).checked = settings[key]; }
const policyGroups = [
  { title: '正文排版', description: '勾选后，保留网页原本的对应样式。', keys: ['preserveHeadingSize', 'preserveHeadingColor', 'preserveBodyFont', 'preserveBodySize', 'preserveLineHeight', 'preserveLinkColor'] },
  { title: '代码阅读', description: '照顾原有高亮，也可以试试主题的配色。', keys: ['preserveCodeColors', 'preserveCodeBackground'] },
  { title: '字体与背景', description: '按需启用主题的配套资源。', keys: ['enableFonts', 'enableBackgroundImages', 'useThemeBackground'] }
];
for (const group of policyGroups) {
  const fieldset = document.createElement('fieldset'); fieldset.className = 'policy-group';
  const legend = document.createElement('legend'); legend.textContent = group.title;
  const description = document.createElement('p'); description.textContent = group.description;
  fieldset.append(legend, description);
  for (const key of group.keys) {
    const text = POLICY_FIELDS.find(([field]) => field === key)[1];
    const label = document.createElement('label'); label.className = 'policy';
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = key;
    label.append(input, document.createTextNode(text)); fieldset.append(label);
  }
  $('policyFields').append(fieldset);
}
async function savePolicy(settings) {
  $('saveSettings').disabled = true; $('resetSettings').disabled = true;
  try { const result = await send('settings.set', { settings }); showPolicy(result.settings); $('settingsStatus').textContent = '已保存。请返回网页再次应用主题。'; }
  catch (error) { $('settingsStatus').textContent = error.message; }
  finally { $('saveSettings').disabled = false; $('resetSettings').disabled = false; }
}
$('settingsForm').addEventListener('submit', event => { event.preventDefault(); savePolicy(Object.fromEntries(POLICY_FIELDS.map(([key]) => [key, $(key).checked]))); });
$('resetSettings').addEventListener('click', () => savePolicy(DEFAULT_POLICY));
try { await render(); showPolicy(await send('settings.get')); } catch (error) { $('status').textContent = error.message; $('status').className = 'error'; }
