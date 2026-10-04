export const MAX_CSS_BYTES = 1024 * 1024;
export const MAX_RESOURCE_BYTES = 16 * 1024 * 1024;
export const MAX_BUNDLE_BYTES = 24 * 1024 * 1024;
export const MAX_FILES = 64;
const types = {
  woff: ['font', 'font/woff'], woff2: ['font', 'font/woff2'], ttf: ['font', 'font/ttf'], otf: ['font', 'font/otf'],
  png: ['image', 'image/png'], jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'],
  webp: ['image', 'image/webp'], gif: ['image', 'image/gif']
};
export function normalizePath(input, basePath = '') {
  if (typeof input !== 'string' || input.length > 1024) throw new Error('资源路径格式不正确。');
  let path;
  try { path = decodeURIComponent(input.split(/[?#]/)[0]).replaceAll('\\', '/'); }
  catch { throw new Error('资源路径编码不正确。'); }
  if (!path || path.startsWith('/') || path.includes(':') || path.includes('\0')) throw new Error('资源路径必须是主题内的相对路径。');
  const parts = basePath ? basePath.split('/').slice(0, -1) : [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) throw new Error('资源路径超出主题目录。'); parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
}
export function decodeDataUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('data:') || url.length > Math.ceil(MAX_RESOURCE_BYTES * 4 / 3) + 200) throw new Error('资源内容过大或格式不正确。');
  const comma = url.indexOf(',');
  const header = url.slice(5, comma);
  if (comma < 0 || !header.endsWith(';base64')) throw new Error('资源必须使用 base64 编码。');
  let bytes;
  try { bytes = Uint8Array.from(atob(url.slice(comma + 1)), ch => ch.charCodeAt(0)); }
  catch { throw new Error('资源 base64 内容不正确。'); }
  if (bytes.length > MAX_RESOURCE_BYTES) throw new Error('单个资源最多 16 MB。');
  return { mime: header.slice(0, -7).toLowerCase(), bytes };
}
function validSignature(bytes, extension) {
  const start = String.fromCharCode(...bytes.slice(0, 12));
  switch (extension) {
    case 'woff': return start.startsWith('wOFF');
    case 'woff2': return start.startsWith('wOF2');
    case 'ttf': return (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) || start.startsWith('true');
    case 'otf': return start.startsWith('OTTO');
    case 'png': return [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
    case 'jpg': case 'jpeg': return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case 'webp': return start.startsWith('RIFF') && start.slice(8, 12) === 'WEBP';
    case 'gif': return start.startsWith('GIF87a') || start.startsWith('GIF89a');
    default: return false;
  }
}
export function validateFiles(files = []) {
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new Error('配套资源最多 64 个文件。');
  const validated = []; const paths = new Set(); let total = 0;
  for (const file of files) {
    const path = normalizePath(file.path);
    const extension = path.split('.').pop().toLowerCase(); const type = types[extension];
    if (!type) throw new Error(`不支持的资源类型：${path}`);
    if (paths.has(path)) throw new Error(`资源路径重复：${path}`);
    paths.add(path);
    const { bytes } = decodeDataUrl(file.dataUrl);
    if (!validSignature(bytes, extension)) throw new Error(`资源文件内容与类型不匹配：${path}`);
    total += bytes.length; if (total > MAX_BUNDLE_BYTES) throw new Error('一个主题的配套资源合计最多 24 MB。');
    validated.push({ path, kind: type[0], mime: type[1], size: bytes.length, dataUrl: `data:${type[1]};base64,${file.dataUrl.slice(file.dataUrl.indexOf(',') + 1)}` });
  }
  return { files: validated, bytes: total };
}
export function resolveResource(url, kind, bundle, warn) {
  if (url.startsWith('data:')) {
    const { mime } = decodeDataUrl(url);
    const type = Object.entries(types).find(([, info]) => info[0] === kind && info[1] === mime);
    if (!type) throw new Error('不支持此嵌入资源类型。');
    return validateFiles([{ path: `embedded.${type[0]}`, dataUrl: url }]).files[0];
  }
  const path = normalizePath(url, bundle.sourcePath ?? 'theme.css');
  const exact = bundle.files?.find(file => file.path === path && file.kind === kind);
  if (exact) return exact;
  const filename = path.split('/').pop();
  const matching = (bundle.files ?? []).filter(file => file.path.split('/').pop() === filename && file.kind === kind);
  if (matching.length === 1) { warn?.(`资源 ${url} 按唯一文件名匹配为 ${matching[0].path}`); return matching[0]; }
  throw new Error(`缺少本地资源：${url.slice(0, 160)}${matching.length > 1 ? '（同名文件不唯一）' : ''}`);
}
