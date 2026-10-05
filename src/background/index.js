import { listThemes, importTheme, deleteTheme } from '../theme/repository.js';
import { operate, serialize, cleanupDocument } from './article-service.js';
import { getSettings, saveSettings } from '../settings/repository.js';
import { getBackground, saveBackground } from '../settings/background-repository.js';
import { record, listLogs, clearLogs, pageAddress } from '../diagnostics/logger.js';

async function logged(request, operation) {
  const completed = operation.then(value => ({ value }), error => ({ error }));
  const categories = { 'theme.import': 'import', 'theme.delete': 'import', 'article.locate': 'detection', 'article.apply': 'application', 'article.restore': 'application', 'settings.set': 'settings', 'article.cleanup': 'application' };
  const messages = { 'theme.import': '主题导入完成', 'theme.delete': '主题已删除', 'article.locate': '正文识别完成', 'article.apply': '主题应用完成', 'article.restore': '主题已恢复', 'settings.set': '统一配置已保存', 'article.cleanup': '页面变化，旧主题会话已清理' };
  const category = request.type === 'background.set' ? 'settings' : categories[request.type];
  let page;
  if (Number.isInteger(request.tabId)) { try { page = pageAddress((await chrome.tabs.get(request.tabId)).url); } catch {} }
  try {
    const result = await completed;
    if (result.error) throw result.error;
    const value = result.value;
    if (category) {
      const details = { page, themeId: value?.themeId ?? value?.id, description: value?.description, settings: value?.settings, resources: value?.resources, protectedCount: value?.protectedCount, preservedCount: value?.preservedCount };
      if (value?.report) {
        await record('conversion', value.report.skipped.length || value.report.resources.length || value.report.warnings.length ? 'warning' : 'success', '主题转换完成', { themeId: value.id ?? value.themeId, ...value.report });
      }
      await record(category, value?.resources?.failures?.length ? 'warning' : 'success', request.type === 'background.set' ? '全局背景配置已保存' : messages[request.type], details);
    }
    return value;
  } catch (error) {
    if (category) await record(error.phase ?? category, 'error', error.message || '操作失败', { page, operation: request.type, themeId: request.themeId, selector: request.selector });
    throw error;
  }
}

// Only our extension UI may request theme changes or arbitrary tab operations.
chrome.runtime.onMessage.addListener((request, sender, reply) => {
  if (!request || typeof request.type !== 'string' || sender.id !== chrome.runtime.id) return;
  const uiOrigin = `chrome-extension://${chrome.runtime.id}/`;
  const isUI = sender.url?.startsWith(uiOrigin) && ['popup/index.html', 'options/index.html', 'logs/index.html'].includes(sender.url.slice(uiOrigin.length).split(/[?#]/)[0]);
  let promise;
  if (request.type === 'article.cleanup' && sender.tab && sender.documentId) {
    promise = serialize(sender.tab.id, () => cleanupDocument(sender.tab.id, sender.documentId));
  } else if (!isUI) return;
  else if (request.type === 'theme.list') promise = listThemes().then(items => items.map(({ source, ...theme }) => theme));
  else if (request.type === 'theme.import') promise = serialize('themes', () => importTheme(request.name, request.source, request.resources)).then(({ source, ...theme }) => theme);
  else if (request.type === 'theme.delete') promise = serialize('themes', () => deleteTheme(request.id));
  else if (request.type === 'settings.get') promise = getSettings();
  else if (request.type === 'background.get') promise = getBackground();
  else if (request.type === 'background.set') promise = serialize('background', () => saveBackground(request));
  else if (request.type === 'settings.set') promise = serialize('settings', () => saveSettings(request.settings)).then(settings => ({ settings }));
  else if (request.type === 'logs.list') promise = listLogs();
  else if (request.type === 'logs.clear') promise = clearLogs();
  else if (request.type === 'logs.importError' && typeof request.message === 'string') promise = record('import', 'error', request.message.slice(0, 800));
  else if (['article.status', 'article.locate', 'article.apply', 'article.restore'].includes(request.type)) {
    if (!Number.isInteger(request.tabId) || request.tabId < 0 || (request.selector != null && (typeof request.selector !== 'string' || request.selector.length > 2000))) {
      reply({ ok: false, error: '无效页面参数。' }); return;
    }
    promise = serialize(request.tabId, () => operate(request.tabId, request));
  } else return;
  logged(request, Promise.resolve(promise)).then(value => reply({ ok: true, value }), error => reply({ ok: false, error: error.message || '操作失败。' }));
  return true;
});
