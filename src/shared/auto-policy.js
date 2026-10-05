export const DEFAULT_AUTO = Object.freeze({ enabled: false, sameSiteOnly: false });
export const WEB_ORIGINS = ['http://*/*', 'https://*/*'];
export function normalizeAuto(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('自动应用配置格式不正确。');
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_AUTO, key) || typeof value !== 'boolean') throw new Error(`无效自动应用配置：${key}`);
  }
  return { ...DEFAULT_AUTO, ...input };
}
export function webOrigin(url) {
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null; }
  catch { return null; }
}
// Chrome host patterns cover a host's ports; exact origin restrictions are enforced separately.
export function hostPattern(url) {
  if (!webOrigin(url)) return null;
  const parsed = new URL(url); return `${parsed.protocol}//${parsed.hostname}/*`;
}
export function eligibleAuto(settings, rule, url) {
  const origin = webOrigin(url);
  return !!(settings.enabled && rule && !rule.paused && origin && (!settings.sameSiteOnly || rule.origin === origin));
}
export function automaticSelector(rule, url) { return rule.origin === webOrigin(url) ? rule.selector : ''; }
