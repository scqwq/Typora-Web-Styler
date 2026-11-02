// Extension UI appearance is separate from the styles applied to web articles.
const KEY = 'uiAppearance';
const choices = new Set(['system', 'light', 'dark']);
const control = document.getElementById('appearance');
let current = 'system';
function show(value) {
  current = choices.has(value) ? value : 'system';
  document.documentElement.dataset.appearance = current;
  if (control) control.value = current;
}
const initial = chrome.storage.local.get(KEY);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) show(changes[KEY].newValue);
});
control?.addEventListener('change', async () => {
  const previous = current;
  show(control.value);
  try { await chrome.storage.local.set({ [KEY]: current }); }
  catch {
    show(previous);
    const status = document.getElementById('appearanceStatus');
    if (status) status.textContent = '外观未能保存，请重试。';
    return;
  }
  const status = document.getElementById('appearanceStatus');
  if (status) status.textContent = '';
});
try { show((await initial)[KEY]); } catch { show('system'); }
