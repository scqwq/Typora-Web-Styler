import { saurlaxSelector } from './adapters/saurlax.js';

export function locate(document, selector = '') {
  let candidates;
  if (selector) {
    try { candidates = [...document.querySelectorAll(selector)]; }
    catch { throw new Error('正文选择器语法不正确。'); }
    if (candidates.length !== 1) throw new Error(`选择器匹配 ${candidates.length} 个元素，请使用只匹配一个正文区域的选择器。`);
  } else {
    const adapted = saurlaxSelector(document.URL);
    const matches = adapted ? [...document.querySelectorAll(adapted)] : [];
    candidates = matches.length === 1 ? matches : [...document.querySelectorAll('article, main, [role="main"]')];
  }
  const usable = candidates.filter(el => el !== document.body && el !== document.documentElement &&
    el.getBoundingClientRect().width > 0 && el.textContent.trim().length >= 80 &&
    !el.closest('nav, aside, footer, header, [hidden]'));
  if (!usable.length) throw new Error('未找到正文。请填入正文容器的 CSS 选择器，再点击“识别正文”。');
  // Only collapse nested semantic candidates; unrelated candidates need user confirmation.
  const leaves = usable.filter(el => !usable.some(other => other !== el && el.contains(other)));
  if (leaves.length !== 1) throw new Error('发现多个可能的正文区域，请输入明确的 CSS 选择器。');
  const root = leaves[0];
  if (root.querySelectorAll('nav, aside, footer, form').length > 8) throw new Error('候选区域混入太多非正文内容，请选择更小的正文容器。');
  return root;
}

export function describe(root) {
  const first = root.querySelector('h1, h2');
  return {
    element: root.tagName.toLowerCase(), id: root.id,
    className: root.className?.toString().slice(0, 200) ?? '',
    title: (first?.textContent || document.title).trim().slice(0, 120),
    characters: root.textContent.trim().length,
    headings: root.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
    codeBlocks: root.querySelectorAll('pre').length,
    tables: root.querySelectorAll('table').length
  };
}
