import { undoPreservation, redoPreservation } from './preservation.js';

// The layer sits above the body background, below its content, and never receives clicks.
// Only the article root is made translucent; opaque site ancestors remain untouched.
export function applyBackground(root, config) {
  if (!config?.settings.enabled || !config.image) return null;
  const records = [];
  const layer = document.createElement('div');
  layer.setAttribute('data-wm-background', '');
  layer.setAttribute('aria-hidden', 'true');
  const styles = { position: 'fixed', inset: '0', width: 'auto', height: 'auto', margin: '0', padding: '0', border: 'none', 'pointer-events': 'none', 'z-index': '-1', 'background-image': `url("${config.image.dataUrl}")`, 'background-size': 'cover', 'background-position': 'center', 'background-repeat': 'no-repeat', opacity: String(config.settings.imageOpacity / 100) };
  for (const [prop, value] of Object.entries(styles)) layer.style.setProperty(prop, value, 'important');
  function set(el, prop, value) {
    const before = el.style.getPropertyValue(prop), priority = el.style.getPropertyPriority(prop), absent = !el.hasAttribute('style');
    el.style.setProperty(prop, value, 'important');
    records.push({ el, prop, before, priority, absent, value: el.style.getPropertyValue(prop) });
  }
  try {
    // Resolve computed colors (including CSS Color 4) through the browser's canvas parser.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = getComputedStyle(root).backgroundColor; ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    set(document.body, 'isolation', 'isolate');
    set(root, 'background-image', 'none');
    set(root, 'background-color', `rgba(${a ? r : 255}, ${a ? g : 255}, ${a ? b : 255}, ${config.settings.surfaceOpacity / 100})`);
    document.body.prepend(layer);
    return { records, layer };
  } catch (error) { layer.remove(); undoPreservation(records); throw error; }
}
export function undoBackground(state) { if (state) { state.layer.remove(); undoPreservation(state.records); } }
export function redoBackground(state) { if (state) { redoPreservation(state.records); document.body.prepend(state.layer); } }
