import { operate, serialize } from './article-service.js';
import { getAutoSettings, saveAutoSettings } from '../settings/auto-repository.js';
import { eligibleAuto, automaticSelector, webOrigin } from '../shared/auto-policy.js';
import { record, pageAddress } from '../diagnostics/logger.js';

const runs = new Map();
let listenersInstalled = false;
async function rules() { return (await chrome.storage.session.get('autoTabs')).autoTabs ?? {}; }
async function changeRule(tabId, transform) {
  return serialize('auto-tabs', async () => {
    const saved = await rules(); const next = transform(saved[tabId]);
    if (next) saved[tabId] = next; else delete saved[tabId];
    await chrome.storage.session.set({ autoTabs: saved }); return next;
  });
}
export async function autoStatus(tabId) {
  const settings = await getAutoSettings(), rule = (await rules())[tabId];
  return { enabled: settings.enabled, registered: !!rule, paused: !!rule?.paused, sameSiteOnly: settings.sameSiteOnly };
}
export async function setAutoSettings(input) {
  const settings = await saveAutoSettings(input);
  for (const run of runs.values()) run.cancelled = true;
  if (!settings.enabled) await serialize('auto-tabs', () => chrome.storage.session.remove('autoTabs'));
  return settings;
}
export async function rememberManual(tabId, request, applied) {
  if (!await getAutoSettings().then(settings => settings.enabled)) return { registered: false };
  installAutoListeners();
  try {
    const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 });
    const origin = webOrigin(frame?.url);
    if (!origin || frame.documentId !== applied.documentId) return { registered: false, notice: '页面已变化，未登记自动应用。' };
    const run = runs.get(tabId); if (run) run.cancelled = true;
    await changeRule(tabId, () => ({ origin, themeId: request.themeId, selector: request.selector ?? '', paused: false }));
    return { registered: true };
  } catch { return { registered: false, notice: '未能登记自动应用，请检查导航权限。' }; }
}
export async function pauseAuto(tabId) {
  const run = runs.get(tabId); if (run) run.cancelled = true;
  await changeRule(tabId, rule => rule ? { ...rule, paused: true } : null);
}
export async function forgetAuto(tabId) {
  const run = runs.get(tabId); if (run) run.cancelled = true;
  await changeRule(tabId, () => null);
}
async function attempt(tabId, run) {
  if (run.cancelled) return { done: true };
  const settings = await getAutoSettings(), rule = (await rules())[tabId];
  if (!settings.enabled || !rule || rule.paused) return { done: true };
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 });
  if (!frame || (run.documentId && frame.documentId !== run.documentId)) return { done: true };
  if (!eligibleAuto(settings, rule, frame.url)) return { done: true };
  if (run.cancelled) return { done: true };
  const selector = automaticSelector(rule, frame.url);
  const status = await operate(tabId, { type: 'article.status' }, frame.documentId);
  if (status.active) return { done: true };
  let located;
  try { located = await operate(tabId, { type: 'article.locate', selector, preview: false }, frame.documentId); }
  catch (error) { return { done: false, error: error.message, page: frame.url }; }
  if (run.cancelled) return { done: true };
  const result = await operate(tabId, { type: 'article.apply', selector, themeId: rule.themeId, documentToken: located.documentToken }, frame.documentId);
  await record('application', result.resources.failures.length ? 'warning' : 'success', '已自动应用标签页主题', { page: pageAddress(frame.url), themeId: rule.themeId, resources: result.resources });
  return { done: true };
}
export function scheduleAuto(tabId, documentId) {
  const previous = runs.get(tabId); if (previous) previous.cancelled = true;
  const run = { documentId, cancelled: false }; runs.set(tabId, run);
  // Retry only detection, within a bounded load window. Each attempt releases the tab lock.
  const task = async () => {
    let last;
    for (const delay of [0, 200, 500, 1000, 2000, 3500, 5000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (run.cancelled) return;
      last = await serialize(tabId, () => attempt(tabId, run));
      if (last.done) return;
    }
    if (!run.cancelled && last?.error) await record('detection', 'warning', `自动应用已跳过：${last.error}`, { page: pageAddress(last.page) });
  };
  task().catch(async error => {
    if (!run.cancelled) await record('application', 'warning', `自动应用已暂停本次尝试：${error.message}`, { tabId }).catch(() => {});
  }).finally(() => { if (runs.get(tabId) === run) runs.delete(tabId); });
}
export function installAutoListeners() {
  // Optional API namespaces may be absent until the user grants their permission.
  if (listenersInstalled || !chrome.webNavigation?.onCompleted) return;
  const navigate = details => { if (details.frameId === 0 && webOrigin(details.url)) scheduleAuto(details.tabId, details.documentId); };
  chrome.webNavigation.onDOMContentLoaded.addListener(navigate);
  chrome.webNavigation.onCompleted.addListener(navigate);
  chrome.webNavigation.onHistoryStateUpdated.addListener(navigate);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(navigate);
  chrome.tabs.onRemoved.addListener(tabId => { forgetAuto(tabId).catch(() => {}); });
  chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => { forgetAuto(removedTabId).catch(() => {}); });
  listenersInstalled = true;
}
