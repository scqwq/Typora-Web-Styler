const PROTECTED = 'button, input, textarea, select, form, video, audio, iframe, svg, canvas, nav, aside, footer, [role="button"], .katex, mjx-container, .MathJax, .mermaid, pre code span';
const inherited = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'color', 'letter-spacing', 'word-spacing', 'text-align', 'text-transform', 'white-space'];

export function annotate(root, sessionId) {
  const modifications = [];
  const rules = [];
  function mark(el, name, value) {
    const before = el.getAttribute(name);
    if (before !== null) throw new Error('正文含有其他会话的扩展标记，请先恢复。');
    el.setAttribute(name, value);
    modifications.push({ el, name, before, value });
  }
  try {
    const all = [...root.querySelectorAll(PROTECTED)];
    const boundaries = all.filter(el => {
      const ancestor = el.parentElement?.closest(PROTECTED);
      return !ancestor || !root.contains(ancestor);
    });
    if (boundaries.length > 1200) throw new Error('正文的交互或代码节点过多，请选择更小区域（首版上限 1200 个）。');
    // Capture inherited properties before the article receives any theme.
    const snapshots = boundaries.map(el => ({ el, values: inherited.map(prop => [prop, getComputedStyle(el).getPropertyValue(prop)]) }));
    mark(root, 'data-wm-article', sessionId);
    snapshots.forEach(({ el, values }, index) => {
      const token = `${sessionId}-${index}`;
      mark(el, 'data-wm-protected', token);
      const body = values.map(([prop, value]) => `${prop}:${value} !important;`).join('');
      rules.push(`[data-wm-article="${sessionId}"] [data-wm-protected="${token}"]{${body}}`);
    });
    return { modifications, css: rules.join('\n'), protectedCount: snapshots.length };
  } catch (error) { undo(modifications); throw error; }
}

export function undo(modifications) {
  for (const { el, name, before, value } of [...modifications].reverse()) {
    if (el.getAttribute(name) !== value) continue; // Never overwrite a subsequent site modification.
    if (before === null) el.removeAttribute(name); else el.setAttribute(name, before);
  }
}
