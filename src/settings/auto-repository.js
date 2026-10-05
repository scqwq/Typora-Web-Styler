import { normalizeAuto } from '../shared/auto-policy.js';
export async function getAutoSettings() {
  const { autoSettings = {} } = await chrome.storage.local.get('autoSettings');
  return normalizeAuto(autoSettings);
}
export async function saveAutoSettings(input) {
  const settings = normalizeAuto(input);
  if (settings.enabled && !await chrome.permissions.contains({ permissions: ['webNavigation'] })) throw new Error('请先允许页面导航权限。');
  if (settings.enabled && !settings.sameSiteOnly && !await chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })) throw new Error('跨网站自动应用需要网站访问权限；也可以勾选仅限相同网站。');
  await chrome.storage.local.set({ autoSettings: settings });
  return settings;
}
