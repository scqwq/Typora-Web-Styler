import { decodeDataUrl } from '../theme/resources.js';

const timeout = promise => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('资源加载超时')), 8000);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
export async function loadResources(fonts = [], images = []) {
  const faces = [], failures = [];
  await Promise.all(fonts.map(async item => {
    try {
      const source = item.dataUrl ? decodeDataUrl(item.dataUrl).bytes.buffer : item.local;
      const face = new FontFace(item.family, source, item.descriptors);
      await timeout(face.load()); document.fonts.add(face); faces.push(face);
    } catch (error) { failures.push(`字体 ${item.label}：${error.message}`); }
  }));
  await Promise.all(images.map(async item => {
    try {
      await timeout(new Promise((resolve, reject) => {
        const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error('图片无法加载，可能受到页面 CSP 限制')); image.src = item.dataUrl;
      }));
    } catch (error) { failures.push(error.message); }
  }));
  return { faces, failures };
}
export function releaseFonts(faces = []) { for (const face of faces) document.fonts.delete(face); }
