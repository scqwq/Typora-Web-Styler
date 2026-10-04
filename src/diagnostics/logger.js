export const LOG_LIMIT = 300;
const BYTE_BUDGET = 1500 * 1024;
let queue = Promise.resolve();

function sanitize(value, depth = 0) {
  if (depth > 5) return '[省略]';
  if (typeof value === 'string') {
    if (value.includes('data:')) return '[嵌入资源内容已省略]';
    return value.slice(0, 800);
  }
  if (Array.isArray(value)) return value.slice(0, 40).map(item => sanitize(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [key, sanitize(item, depth + 1)]));
  return value;
}
export function pageAddress(url) {
  try { const page = new URL(url); return `${page.origin}${page.pathname}`; } catch { return ''; }
}
export function record(category, level, message, details = {}) {
  const task = queue.catch(() => {}).then(async () => {
    const { activityLogs = [] } = await chrome.storage.local.get('activityLogs');
    const entry = { id: crypto.randomUUID(), time: Date.now(), category, level, message: sanitize(message), details: sanitize(details) };
    const logs = [entry, ...activityLogs].slice(0, LOG_LIMIT);
    while (logs.length > 1 && new TextEncoder().encode(JSON.stringify(logs)).length > BYTE_BUDGET) logs.pop();
    await chrome.storage.local.set({ activityLogs: logs });
    return entry;
  });
  queue = task;
  // Diagnostics must not turn a successful action into a failure if storage is full.
  return task.catch(error => { console.warn('Web-markdown 日志保存失败:', error.message); });
}
export async function listLogs() { await queue.catch(() => {}); return (await chrome.storage.local.get('activityLogs')).activityLogs ?? []; }
export function clearLogs() {
  const task = queue.catch(() => {}).then(() => chrome.storage.local.set({ activityLogs: [] }));
  queue = task; return task;
}
