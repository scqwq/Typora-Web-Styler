import { Unzip, UnzipInflate, strFromU8 } from 'fflate';
import valueParser from 'postcss-value-parser';
import { normalizePath, MAX_CSS_BYTES, MAX_RESOURCE_BYTES, MAX_BUNDLE_BYTES, MAX_FILES } from './resources.js';
import { mergeCss, importReference, isExternal } from './css-package.js';
import postcss from 'postcss';
export const MAX_ZIP_BYTES = 48 * 1024 * 1024;
const MAX_EXPANDED = 96 * 1024 * 1024;
const assetPattern = /\.(woff2?|ttf|otf|png|jpe?g|webp|gif)$/i;
const ignored = path => /(^|\/)(?:\.git|node_modules|__MACOSX)(\/|$)/i.test(path);
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc32(data) { let c = 0xffffffff; for (const b of data) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function safeEntry(name) {
  if (name.includes('\\') || name.split('/').some(p => p === '..' || p === '.') || /[\x00-\x1f]/.test(name)) throw new Error('ZIP 含有不安全的文件路径。');
  return normalizePath(name);
}
/** Inspect central metadata before allocating any inflated buffers. ZIP64/encryption/symlinks are unsupported. */
export function unpackZip(input) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (data.length > MAX_ZIP_BYTES || data.length < 22) throw new Error('ZIP 无效或超过 48 MB。');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = data.length - 22;
  while (end >= Math.max(0, data.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw new Error('不是有效的 ZIP 文件。');
  const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true), centralSize = view.getUint32(end + 12, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || count > 2048 || offset + centralSize !== end || end + 22 + view.getUint16(end + 20, true) !== data.length) throw new Error('ZIP 结构不支持或文件过多。');
  const entries = new Map(), canonical = new Set(); let at = offset, total = 0, cssCount = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw new Error('ZIP 文件目录损坏。');
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), size = view.getUint32(at + 24, true), compressed = view.getUint32(at + 20, true);
    const nameSize = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true);
    if (at + 46 + nameSize + extra + comment > end || local + 30 > offset || size === 0xffffffff || compressed === 0xffffffff || view.getUint32(local, true) !== 0x04034b50) throw new Error('ZIP64 或损坏的 ZIP 暂不支持。');
    const name = strFromU8(data.subarray(at + 46, at + 46 + nameSize), !(flags & 2048));
    const path = safeEntry(name), directory = name.endsWith('/');
    if (canonical.has(path)) throw new Error(`ZIP 文件路径重复：${path}`);
    canonical.add(path);
    if (flags & 1 || ![0, 8].includes(method) || ((view.getUint32(at + 38, true) >>> 16) & 0xf000) === 0xa000) throw new Error('ZIP 含加密文件、链接或不支持的压缩方式。');
    const localFlags = view.getUint16(local + 6, true), localMethod = view.getUint16(local + 8, true), localNameSize = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localNameSize + localExtra;
    if (localFlags !== flags || localMethod !== method || start + compressed > offset || strFromU8(data.subarray(local + 30, local + 30 + localNameSize), !(flags & 2048)) !== name || (method === 0 && compressed !== size)) throw new Error('ZIP 文件头不一致。');
    total += size;
    if (total > MAX_EXPANDED) throw new Error('ZIP 解压后超过 96 MB。');
    const css = /\.css$/i.test(path), wanted = !directory && !ignored(path) && (css || assetPattern.test(path));
    if (wanted && size > (css ? MAX_CSS_BYTES : MAX_RESOURCE_BYTES)) throw new Error(`ZIP 文件超过大小限制：${path}`);
    if (wanted && css && ++cssCount > 128) throw new Error('ZIP 最多包含 128 个 CSS 文件。');
    entries.set(name, { path, wanted, size, crc: view.getUint32(at + 16, true) });
    at += 46 + nameSize + extra + comment;
  }
  if (at !== end) throw new Error('ZIP 文件目录损坏。');
  const files = new Map();
  try {
    const unzip = new Unzip(file => {
      const entry = entries.get(file.name);
      if (!entry) throw new Error('ZIP 本地文件与目录不一致。');
      if (!entry.wanted) return;
      if (files.has(entry.path)) throw new Error('ZIP 文件路径重复。');
      const chunks = []; let size = 0;
      file.ondata = (error, chunk, final) => {
        if (error) throw error;
        size += chunk.length;
        if (size > entry.size) throw new Error('ZIP 实际展开内容超过声明大小。');
        chunks.push(chunk);
        if (final) {
          const bytes = new Uint8Array(size); let position = 0;
          for (const part of chunks) { bytes.set(part, position); position += part.length; }
          if (size !== entry.size || crc32(bytes) !== entry.crc) throw new Error(`ZIP 内容校验失败：${entry.path}`);
          files.set(entry.path, bytes);
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    // Small input chunks bound transient inflation even if an archive lies about its expanded size.
    for (let position = 0; position < data.length; position += 1024) unzip.push(data.subarray(position, position + 1024), position + 1024 >= data.length);
    if (files.size !== [...entries.values()].filter(entry => entry.wanted).length) throw new Error('ZIP 文件内容不完整。');
  } catch (error) { throw new Error(`ZIP 解压或校验失败：${error.message}`); }
  if (!cssCount) throw new Error('包中没有 CSS；请提供已编译的主题发布包。');
  return files;
}
// Inspect content rather than assuming every .css file is a theme entry.
export function classifyPackageCss(source) {
  try {
    const tree = postcss.parse(source);
    let rules = 0, fonts = 0; const imports = [];
    tree.walkRules(rule => { if (rule.nodes?.some(node => node.type === 'decl' || node.type === 'rule' || node.type === 'atrule')) rules++; });
    tree.walkAtRules(/^font-face$/i, () => fonts++);
    tree.walkAtRules(/^import$/i, rule => imports.push(importReference(rule.params)));
    if (!rules && imports.length && imports.every(item => isExternal(item.url))) return { kind: 'remote', reason: '仅引用远程 CSS，当前不支持；请选择完整的本地主题。' };
    if (!rules && !imports.length) return fonts
      ? { kind: 'font', reason: '字体依赖，不含正文规则；保留用于主主题合并，不可单独导入。' }
      : { kind: 'empty', reason: '没有可用的正文样式规则。' };
    return { kind: 'theme', reason: '' };
  } catch { return { kind: 'invalid', reason: 'CSS 语法或引用格式无法解析。' }; }
}
export function listPackageThemes(files) {
  const cssFiles = [...files].filter(([path]) => /\.css$/i.test(path)).map(([path, bytes]) => ({ path, source: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }));
  const referenced = new Set();
  for (const file of cssFiles) {
    try { postcss.parse(file.source).walkAtRules(/^import$/i, rule => { const { url } = importReference(rule.params); if (!isExternal(url)) referenced.add(normalizePath(url, file.path)); }); } catch {}
  }
  const candidates = cssFiles.map(file => ({ path: file.path, ...classifyPackageCss(file.source), dependency: referenced.has(file.path), example: /(^|\/)(?:docs?|demo|examples?|screenshots?)(\/|$)/i.test(file.path) }));
  candidates.sort((a, b) => Number(a.dependency || a.example) - Number(b.dependency || b.example) || a.path.localeCompare(b.path));
  return { cssFiles, candidates };
}
function dataUrl(bytes, extension) {
  const mime = { woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[extension];
  let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${mime};base64,${btoa(binary)}`;
}
export function preparePackageTheme(files, entry) {
  const { cssFiles } = listPackageThemes(files);
  const merged = mergeCss(entry, cssFiles);
  const used = new Set();
  postcss.parse(merged.source).walkDecls(decl => {
    // Resource paths have already been normalized by the merger; AST values avoid matching comments.
    valueParser(decl.value).walk(node => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        const raw = valueParser.stringify(node.nodes).trim().replace(/^['"]|['"]$/g, '');
        if (!isExternal(raw)) used.add(normalizePath(raw));
        return false;
      }
    });
  });
  const assets = []; let total = 0;
  for (const path of used) {
    const bytes = files.get(path);
    if (!bytes || !assetPattern.test(path)) continue; // Compiler reports missing/unsupported resources.
    total += bytes.length;
    if (assets.length >= MAX_FILES || total > MAX_BUNDLE_BYTES) throw new Error('所选主题资源超过 64 个或合计 24 MB。');
    assets.push({ path, dataUrl: dataUrl(bytes, path.split('.').pop().toLowerCase()) });
  }
  return { source: merged.source, resources: { sourcePath: merged.sourcePath, files: assets }, dependencies: merged.dependencies };
}
