// Compare a small sample with its original readability; do not attempt to normalize the whole site.
const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
const ctx = canvas.getContext('2d', { willReadFrequently: true });
function rgba(value) {
  ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].map((n, i) => i === 3 ? n / 255 : n);
}
function over(top, base) { return top.slice(0, 3).map((value, i) => value * top[3] + base[i] * (1 - top[3])); }
function luminance(rgb) {
  const linear = rgb.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function ratio(element) {
  if (!element.isConnected || !element.getClientRects().length) return null;
  const colors = [];
  for (let node = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== 'none') return null; // An image's actual color cannot be inferred from CSS alone.
    const color = rgba(style.backgroundColor); colors.push(color); if (color[3] === 1) break;
  }
  let background = [255, 255, 255];
  for (const color of colors.reverse()) background = over(color, background);
  const foreground = over(rgba(getComputedStyle(element).color), background);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
export function captureReadability(root) {
  return [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,td')]
    .filter(el => el.textContent.trim() && !el.closest('[data-wm-protected],svg,.katex,mjx-container'))
    .slice(0, 40).map(el => ({ el, before: ratio(el) }));
}
export function checkReadability(samples) {
  if (samples.some(({ el, before }) => before >= 2 && ratio(el) != null && ratio(el) < 1.35)) {
    throw new Error('主题文字与网页背景过于接近，已取消应用并恢复上一状态。请使用适合当前背景的主题。');
  }
}
