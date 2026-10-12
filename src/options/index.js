import { inspectPackageTheme } from '../theme/package-analysis.js';
import { unpackZip, listPackageThemes, MAX_ZIP_BYTES } from '../theme/zip-package.js';
import { resolveLink, originsForLink, fetchBounded, NeededPermission, sourceAddress } from '../theme/online.js';
import { send, reportText } from '../shared/messages.js';
import { DEFAULT_POLICY, POLICY_FIELDS } from '../shared/style-policy.js';
import { MAX_CSS_BYTES, MAX_RESOURCE_BYTES, MAX_BUNDLE_BYTES, MAX_FILES } from '../theme/resources.js';
import { DEFAULT_BACKGROUND } from '../shared/background-policy.js';
import { WEB_ORIGINS } from '../shared/auto-policy.js';
const $ = id => document.getElementById(id);
let busy = false;
let onlineBusy = false, resolvedLink = null, downloadedPackage = null, permissionRetry = null;
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
        if (busy || onlineBusy) return; busy = true; remove.disabled = true;
        try { await send('theme.delete', { id: theme.id }); await render(); }
        catch (error) { $('status').textContent = error.message; $('status').className = 'error'; remove.disabled = false; }
        finally { busy = false; }
      }); row.append(remove);
    }
    card.append(row);
    if (theme.provenance) {
      const origin = document.createElement('p'); origin.className = 'hint';
      const link = document.createElement('a'); link.textContent = '主题来源 ↗'; link.href = theme.provenance.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      origin.append(link, document.createTextNode(` · ${theme.provenance.version || '版本未提供'} · ${theme.provenance.entry}`)); card.append(origin);
    }
    if (theme.report) { const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '查看转换报告'; const pre = document.createElement('pre'); pre.textContent = reportText(theme.report); details.append(summary, pre); card.append(details); }
    $('themes').append(card);
  }
}
$('file').addEventListener('change', () => {
  if (!$('name').value && $('file').files[0]) $('name').value = $('file').files[0].name.replace(/\.css$/i, '');
});
$('importForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || onlineBusy) return; busy = true; $('import').disabled = true;
  let requested = false;
  try {
    const file = $('file').files[0];
    if (!file || file.size > MAX_CSS_BYTES) throw new Error('请选择不超过 2 MB 的 CSS 文件。');
    const directory = [...$('directory').files];
    const cssMatches = directory.filter(item => item.name === file.name);
    if (cssMatches.length > 1) throw new Error('目录中有多个同名主 CSS，请选择更小的主题目录。');
    const relativePath = item => item.webkitRelativePath ? item.webkitRelativePath.split('/').slice(1).join('/') : item.name;
    const chosen = [...$('resources').files, ...directory.filter(item => /\.(woff2?|ttf|otf|png|jpe?g|webp|gif)$/i.test(item.name))];
    if (chosen.length > MAX_FILES || chosen.some(item => item.size > MAX_RESOURCE_BYTES) || chosen.reduce((total, item) => total + item.size, 0) > MAX_BUNDLE_BYTES) throw new Error('资源超过限制：最多 64 个，单个 16 MB，合计 24 MB。');
    const files = await Promise.all(chosen.map(async item => ({ path: relativePath(item), dataUrl: await readDataUrl(item) })));
    const source = await file.text();
    const otherCss = directory.filter(item => /\.css$/i.test(item.name));
    if (otherCss.length > 128 || otherCss.some(item => item.size > MAX_CSS_BYTES)) throw new Error('目录最多 128 个 CSS，每个最多 2 MB。');
    const cssFiles = await Promise.all(otherCss.map(async item => ({ path: relativePath(item), source: await item.text() })));
    requested = true;
    const theme = await send('theme.import', { name: $('name').value.trim() || file.name.replace(/\.css$/i, ''), source, resources: { files, ...(cssFiles.length ? { cssFiles } : {}), sourcePath: cssMatches.length ? relativePath(cssMatches[0]) : file.name } });
    $('status').className = ''; $('status').textContent = `已导入“${theme.name}”。\n${reportText(theme.report)}`;
    $('importForm').reset(); await render();
  } catch (error) { $('status').className = 'error'; $('status').textContent = error.message; if (!requested) await send('logs.importError', { message: error.message }).catch(() => {}); }
  finally { busy = false; $('import').disabled = false; }
});
function readDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`读取资源失败：${file.name}`)); reader.readAsDataURL(file); }); }
function showPolicy(settings) {
  for (const [key] of POLICY_FIELDS) $(key).checked = settings[key];
  $('maxArticleNodes').value = settings.maxArticleNodes;
}
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
$('settingsForm').addEventListener('submit', event => { event.preventDefault(); savePolicy({ ...Object.fromEntries(POLICY_FIELDS.map(([key]) => [key, $(key).checked])), maxArticleNodes: Number($('maxArticleNodes').value) }); });
$('resetSettings').addEventListener('click', () => savePolicy(DEFAULT_POLICY));
try { await render(); showPolicy(await send('settings.get')); } catch (error) { $('status').textContent = error.message; $('status').className = 'error'; }

let backgroundImage = null;
let backgroundBusy = false;
let backgroundSelection = 0;
function previewBackground() {
  const surface = Number($('surfaceOpacity').value), image = Number($('imageOpacity').value);
  $('surfaceOpacityValue').value = `${surface}%`; $('imageOpacityValue').value = `${image}%`;
  $('backgroundPreviewImage').style.backgroundImage = backgroundImage ? `url("${backgroundImage.dataUrl}")` : 'none';
  $('backgroundPreviewImage').style.opacity = String(image / 100);
  $('backgroundPreviewSurface').style.backgroundColor = `rgba(255,255,255,${surface / 100})`;
  $('backgroundName').textContent = backgroundImage?.path ?? '尚未上传图片';
}
function showBackground(result) {
  backgroundImage = result.image;
  $('backgroundEnabled').checked = result.settings.enabled;
  $('surfaceOpacity').value = result.settings.surfaceOpacity;
  $('imageOpacity').value = result.settings.imageOpacity;
  $('backgroundFile').value = ''; previewBackground();
}
function backgroundControls(disabled) {
  for (const id of ['saveBackground', 'removeBackground', 'backgroundFile', 'backgroundEnabled', 'surfaceOpacity', 'imageOpacity']) $(id).disabled = disabled;
}
for (const id of ['surfaceOpacity', 'imageOpacity']) $(id).addEventListener('input', previewBackground);
$('backgroundFile').addEventListener('change', async () => {
  const selection = ++backgroundSelection;
  const file = $('backgroundFile').files[0]; if (!file) return;
  backgroundControls(true);
  try {
    if (file.size > MAX_RESOURCE_BYTES) throw new Error('背景图片最多 16 MB。');
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name)) throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
    const dataUrl = await readDataUrl(file);
    const image = new Image(); image.src = dataUrl; await image.decode();
    if (selection !== backgroundSelection) return;
    backgroundImage = { path: file.name, dataUrl }; $('backgroundEnabled').checked = true; previewBackground();
    $('backgroundStatus').textContent = '图片已预览。点击保存背景配置后生效。';
  } catch (error) { $('backgroundStatus').textContent = `图片读取失败：${error.message}`; $('backgroundFile').value = ''; }
  finally { backgroundControls(false); }
});
async function persistBackground(remove = false) {
  if (backgroundBusy) return; backgroundBusy = true; backgroundControls(true);
  try {
    const settings = { enabled: remove ? false : $('backgroundEnabled').checked, surfaceOpacity: Number($('surfaceOpacity').value), imageOpacity: Number($('imageOpacity').value) };
    const result = await send('background.set', { settings, image: remove ? null : backgroundImage });
    showBackground(result); $('backgroundStatus').textContent = remove ? '图片已删除、背景已关闭。请返回网页再次应用主题，或恢复原样。' : '背景配置已保存。请返回网页再次应用主题。';
  } catch (error) { $('backgroundStatus').textContent = error.message; }
  finally { backgroundBusy = false; backgroundControls(false); }
}
$('backgroundForm').addEventListener('submit', event => { event.preventDefault(); persistBackground(); });
$('removeBackground').addEventListener('click', () => persistBackground(true));
backgroundControls(true);
try { showBackground(await send('background.get')); }
catch (error) { showBackground({ settings: DEFAULT_BACKGROUND, image: null }); $('backgroundStatus').textContent = error.message; }
finally { backgroundControls(false); }

function showAuto(settings) {
  $('autoEnabled').checked = settings.enabled; $('sameSiteOnly').checked = settings.sameSiteOnly;
  $('sameSiteOnly').disabled = !settings.enabled;
}
$('autoEnabled').addEventListener('change', () => { $('sameSiteOnly').disabled = !$('autoEnabled').checked; });
$('automationForm').addEventListener('submit', async event => {
  event.preventDefault();
  const settings = { enabled: $('autoEnabled').checked, sameSiteOnly: $('sameSiteOnly').checked };
  $('saveAuto').disabled = true; $('autoEnabled').disabled = true; $('sameSiteOnly').disabled = true;
  try {
    if (settings.enabled) {
      // Request synchronously from the submit gesture, before messaging the service worker.
      const granted = await chrome.permissions.request({ permissions: ['webNavigation'], ...(settings.sameSiteOnly ? {} : { origins: WEB_ORIGINS }) });
      if (!granted) throw new Error('未取得授权，自动应用偏好未保存。可以勾选仅限相同网站后重试。');
    }
    const result = await send('auto.set', { settings }); showAuto(result);
    $('autoStatus').textContent = settings.enabled ? '偏好已保存。请在要登记的网页小窗口中应用一次主题。' : '自动应用已关闭，临时标签页登记已清除。已应用的样式可在小窗口恢复原样。';
  } catch (error) {
    $('autoStatus').textContent = error.message;
    try { showAuto(await send('auto.get')); } catch {}
  } finally { $('saveAuto').disabled = false; $('autoEnabled').disabled = false; $('sameSiteOnly').disabled = !$('autoEnabled').checked; }
});
$('saveAuto').disabled = true; $('autoEnabled').disabled = true;
try { showAuto(await send('auto.get')); }
catch (error) { $('autoStatus').textContent = error.message; }
finally { $('saveAuto').disabled = false; $('autoEnabled').disabled = false; }


function onlineControls(disabled) {
  onlineBusy = disabled;
  for (const id of ['fetchTheme', 'themeUrl', 'downloadArchive', 'archiveSelect', 'zipFile', 'importPackage', 'entrySelect', 'showAllCss', 'packageName', 'grantDownload']) $(id).disabled = disabled;
  $('importPackage').disabled = disabled || !downloadedPackage?.check?.ok;
}
let packageCheckVersion = 0;
function showPackage(files, provenance) {
  const { candidates } = listPackageThemes(files);
  downloadedPackage = { files, provenance, candidates, check: null };
  $('showAllCss').checked = false;
  $('packageChoices').hidden = false;
  $('packageVersion').textContent = provenance ? `发布版本：${provenance.version || '未提供'} · CSS 文件：${candidates.length}` : `本地包 · CSS 文件：${candidates.length}`;
  renderPackageEntries();
}
function renderPackageEntries() {
  if (!downloadedPackage) return;
  const previous = $('entrySelect').value;
  const candidates = downloadedPackage.candidates.filter(candidate => $('showAllCss').checked || (candidate.kind === 'theme' && !candidate.dependency && !candidate.example));
  $('entrySelect').replaceChildren();
  for (const candidate of candidates) {
    const option = document.createElement('option'); option.value = candidate.path;
    const label = { font: '字体依赖', remote: '在线入口，当前不支持', empty: '无正文规则', invalid: '格式错误' }[candidate.kind] || (candidate.example ? '示例' : candidate.dependency ? '依赖' : '主题入口');
    option.textContent = `${candidate.path}（${label}）`;
    option.disabled = candidate.kind !== 'theme';
    $('entrySelect').append(option);
  }
  const selected = candidates.find(candidate => candidate.path === previous && candidate.kind === 'theme') || candidates.find(candidate => candidate.kind === 'theme');
  $('entrySelect').value = selected?.path || '';
  updatePackageName();
  checkPackageEntry();
}
function updatePackageName() { $('packageName').value = $('entrySelect').value.split('/').pop().replace(/\.css$/i, ''); }
async function checkPackageEntry() {
  const version = ++packageCheckVersion, pack = downloadedPackage, entry = $('entrySelect').value;
  if (!pack) return;
  pack.check = null; $('importPackage').disabled = true;
  if (!entry) { $('packageStatus').textContent = '没有可选的主主题入口。可勾选“显示全部 CSS”查看依赖、在线入口及原因。'; $('packageDetails').textContent = pack.candidates.filter(c => c.kind !== 'theme').map(c => `${c.path}：${c.reason}`).join('\n'); return; }
  $('packageStatus').textContent = '正在检查所选主题的依赖、容量与正文规则…';
  $('packageDetails').textContent = '';
  await new Promise(resolve => setTimeout(resolve, 0));
  if (version !== packageCheckVersion || pack !== downloadedPackage) return;
  const checked = inspectPackageTheme(pack.files, entry);
  pack.check = checked;
  $('packageStatus').textContent = checked.ok
    ? `可导入 · 合并后 ${(checked.bytes / 1024 / 1024).toFixed(2)} MiB · ${checked.resourceCount} 个资源 · ${checked.rules} 条正文规则`
    : `无法导入：${checked.error}`;
  $('packageDetails').textContent = checked.ok ? `CSS 依赖：\n${checked.dependencies.join('\n')}\n${reportText(checked.report)}` : checked.error;
  $('importPackage').disabled = onlineBusy || busy || !checked.ok;
}
$('showAllCss').addEventListener('change', renderPackageEntries);
$('entrySelect').addEventListener('change', () => { updatePackageName(); checkPackageEntry(); });
async function runOnline(action) {
  if (onlineBusy || busy) return;
  onlineControls(true); $('grantDownload').hidden = true; permissionRetry = null;
  try { await action(); }
  catch (error) {
    $('onlineStatus').textContent = error.message;
    if (error instanceof NeededPermission) { permissionRetry = { origins: error.origins, action }; $('grantDownload').hidden = false; }
    else await send('logs.importError', { message: error.message }).catch(() => {});
  } finally { onlineControls(false); }
}
async function downloadChoice(choice, resolved) {
  $('packageChoices').hidden = true; downloadedPackage = null;
  $('onlineStatus').textContent = `正在下载并检查 ${choice.label}…`;
  const data = await fetchBounded(choice.url);
  const files = unpackZip(data);
  showPackage(files, { sourceUrl: resolved.sourceUrl, downloadUrl: sourceAddress(choice.url), version: choice.version, entry: '' });
  $('onlineStatus').textContent = '下载完成。选择一个主题导入；导入后可以离线应用。';
}
$('onlineForm').addEventListener('submit', event => {
  event.preventDefault(); if (onlineBusy || busy) return;
  const input = $('themeUrl').value.trim();
  let origins;
  try { origins = originsForLink(input); } catch (error) { $('onlineStatus').textContent = error.message; return; }
  // Start the permission request directly inside the user's submit gesture.
  $('packageChoices').hidden = true; downloadedPackage = null; $('archiveChoices').hidden = true; resolvedLink = null;
  const grant = chrome.permissions.request({ origins });
  runOnline(async () => {
    if (!await grant) throw new Error('未取得下载来源授权。已有本地主题仍可使用。');
    $('packageChoices').hidden = true; downloadedPackage = null; $('archiveChoices').hidden = true; resolvedLink = null;
    $('onlineStatus').textContent = '正在识别主题下载入口…';
    const result = await resolveLink(input); resolvedLink = result;
    $('archiveSelect').replaceChildren();
    result.archives.forEach((archive, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = archive.label; $('archiveSelect').append(option); });
    if (result.archives.length === 1) await downloadChoice(result.archives[0], result);
    else { $('archiveChoices').hidden = false; $('onlineStatus').textContent = '有多个发布包，请选择后下载。'; }
  });
});
$('downloadArchive').addEventListener('click', () => {
  if (!resolvedLink || onlineBusy || busy) return;
  const resolved = resolvedLink, choice = resolved.archives[Number($('archiveSelect').value)];
  runOnline(() => downloadChoice(choice, resolved));
});
$('grantDownload').addEventListener('click', () => {
  if (!permissionRetry || onlineBusy || busy) return;
  const retry = permissionRetry;
  const grant = chrome.permissions.request({ origins: retry.origins });
  runOnline(async () => { if (!await grant) throw new Error('未取得下载来源授权。'); await retry.action(); });
});
$('zipFile').addEventListener('change', () => {
  const file = $('zipFile').files[0]; if (!file) return;
  runOnline(async () => {
    $('packageChoices').hidden = true; downloadedPackage = null; $('archiveChoices').hidden = true;
    if (file.size > MAX_ZIP_BYTES) throw new Error('ZIP 最多 48 MB。');
    showPackage(unpackZip(new Uint8Array(await file.arrayBuffer())));
    $('onlineStatus').textContent = '本地 ZIP 已读取，请选择主题入口。';
  });
});
$('importPackage').addEventListener('click', async () => {
  if (!downloadedPackage?.check?.ok || onlineBusy || busy) return;
  const pack = downloadedPackage, entry = $('entrySelect').value, name = $('packageName').value.trim() || entry.split('/').pop().replace(/\.css$/i, '');
  onlineControls(true); busy = true;
  try {
    $('packageStatus').textContent = '正在合并 CSS、校验资源并保存…';
    const prepared = pack.check.prepared;
    if (pack.provenance) prepared.resources.provenance = { ...pack.provenance, entry };
    const theme = await send('theme.import', { name, source: prepared.source, resources: prepared.resources });
    await render(); $('packageStatus').textContent = `已导入“${theme.name}”。可以继续选择其他主题。\n${reportText(theme.report)}`;
  } catch (error) { $('packageStatus').textContent = error.message; await send('logs.importError', { message: error.message }).catch(() => {}); }
  finally { busy = false; onlineControls(false); }
});
