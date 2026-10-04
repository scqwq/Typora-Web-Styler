import { compileTheme, MAX_THEME_BYTES } from './compiler.js';

export const DEMO_THEME = {
  id: 'builtin-paper', name: '纸笺 · 测试主题', builtIn: true,
  source: `html { font-size: 16px; font-family: Georgia, "Microsoft YaHei", serif; color: #303744; }
#write { line-height: 1.85; max-width: 860px; padding: 32px; }
#write h1, #write h2, #write h3 { color: #7950a3; font-weight: 700; line-height: 1.35; }
#write h1 { font-size: 2rem; margin: 1.3em 0 .7em; }
#write h2 { font-size: 1.55rem; border-bottom: 1px solid #ddd4e9; padding-bottom: .35em; }
#write p, #write li { font-size: 1rem; }
#write a { color: #70519e; text-decoration: underline; }
#write blockquote { border-left: 4px solid #b49acb; background-color: #f6f2fa; color: #5e5368; margin: 1em 0; padding: .5em 1em; }
#write pre { background-color: #f3f2f7; border: 1px solid #dedbe5; border-radius: 8px; padding: 1em; font-family: Consolas, monospace; font-size: .9rem; line-height: 1.6; }
#write code { font-family: Consolas, monospace; }
#write table { border-collapse: collapse; }
#write th, #write td { border: 1px solid #ddd4e9; padding: .55em .8em; }
#write th { background-color: #f0eaf6; }
#write hr { border: 0; border-top: 1px solid #ddd4e9; margin: 2em 0; }`
};
export async function listThemes() {
  const { themes = [] } = await chrome.storage.local.get('themes');
  return [DEMO_THEME, ...themes];
}
export async function importTheme(name, source) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('请填写主题名称。');
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_THEME_BYTES) throw new Error('CSS 文件必须小于 512 KB。');
  const compiled = compileTheme(source);
  const themes = (await listThemes()).filter(t => !t.builtIn);
  if (themes.length >= 20) throw new Error('首版最多保存 20 个自定义主题，请先删除不需要的主题。');
  const theme = { id: crypto.randomUUID(), name: name.trim().slice(0, 100), source, report: compiled.report, createdAt: Date.now() };
  await chrome.storage.local.set({ themes: [...themes, theme] });
  return theme;
}
export async function deleteTheme(id) {
  if (id === DEMO_THEME.id) throw new Error('内置测试主题不能删除。');
  const themes = (await listThemes()).filter(t => !t.builtIn && t.id !== id);
  await chrome.storage.local.set({ themes });
}
