import { MAX_ZIP_BYTES } from './zip-package.js';
export const GITHUB_ORIGINS = ['https://github.com/*', 'https://api.github.com/*', 'https://codeload.github.com/*', 'https://release-assets.githubusercontent.com/*', 'https://objects.githubusercontent.com/*'];
export function checkedUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('请输入完整的 HTTPS 链接。'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) throw new Error('仅支持公开网站的 HTTPS 链接，不支持账号、端口或本地地址。');
  url.hash = ''; return url;
}
export function classifyLink(input) {
  const url = checkedUrl(input);
  if (url.hostname === 'theme.typora.io' && /^\/theme\/[^/]+\/?$/.test(url.pathname)) return { kind: 'typora', url: url.href };
  if (/\.zip$/i.test(url.pathname)) return { kind: 'zip', url: url.href };
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts.every(p => !/%2f|%5c/i.test(p)) && /^[\w.-]+$/.test(parts[0]) && /^[\w.-]+$/.test(parts[1])) {
      const repo = `${parts[0]}/${parts[1].replace(/\.git$/, '')}`;
      if (parts.length === 2) return { kind: 'repository', repo, url: url.href };
      if (parts[2] === 'releases' && (parts.length === 3 || (parts.length === 4 && parts[3] === 'latest'))) return { kind: 'release', repo, url: url.href };
      if (parts[2] === 'releases' && parts[3] === 'tag' && parts.length >= 5) return { kind: 'release', repo, tag: decodeURIComponent(parts.slice(4).join('/')), url: url.href };
    }
  }
  throw new Error('支持 Typora 主题详情页、GitHub 仓库首页或 Release，以及 .zip 下载链接。');
}
export function originsForLink(input) {
  const info = classifyLink(input);
  return info.kind === 'typora' ? ['https://theme.typora.io/*', ...GITHUB_ORIGINS] : info.kind === 'zip' ? [...new Set([`${new URL(info.url).origin}/*`, ...(new URL(info.url).hostname === 'github.com' ? GITHUB_ORIGINS : [])])] : GITHUB_ORIGINS;
}
export function sourceAddress(input) { const url = checkedUrl(input); url.search = ''; return url.href; }
export class NeededPermission extends Error {
  constructor(origins) { super('下载来源需要额外授权。点击“授权并继续”后重试。'); this.origins = origins; }
}
export async function fetchBounded(input, { limit = MAX_ZIP_BYTES, fetcher = fetch, permissions = globalThis.chrome?.permissions, allow404 = false } = {}) {
  const url = checkedUrl(input);
  const origin = `${url.origin}/*`;
  if (permissions && !await permissions.contains({ origins: [origin] })) throw new NeededPermission([origin]);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetcher(url.href, { credentials: 'omit', signal: controller.signal, referrerPolicy: 'no-referrer', headers: url.hostname === 'api.github.com' ? { Accept: 'application/vnd.github+json' } : {} });
    if (response.url) {
      const final = checkedUrl(response.url);
      if (permissions && !await permissions.contains({ origins: [`${final.origin}/*`] })) throw new NeededPermission([`${final.origin}/*`]);
    }
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? '来源拒绝访问或请求过于频繁，请稍后重试。' : `获取失败（HTTP ${response.status}）。`);
    if (Number(response.headers.get('content-length')) > limit) throw new Error('下载文件超过大小限制。');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('下载响应没有可读取的内容。');
    const chunks = []; let size = 0;
    try {
      while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > limit) { await reader.cancel(); throw new Error('下载内容超过大小限制。'); } chunks.push(item.value); }
    } finally { reader.releaseLock(); }
    const data = new Uint8Array(size); let at = 0;
    for (const chunk of chunks) { data.set(chunk, at); at += chunk.length; }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('下载超时，请重试。');
    if (error instanceof TypeError) throw new Error('无法连接下载来源。请检查网络及网站访问权限；跨域下载跳转可尝试粘贴最终 ZIP 链接。');
    throw error;
  } finally { clearTimeout(timeout); }
}
export function parseTyporaPage(html, pageUrl) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const anchors = [...document.querySelectorAll('a[href]')];
  const download = anchors.find(a => /^(?:download|下载)$/i.test(a.textContent.trim()));
  if (!download) throw new Error('主题详情页没有可识别的 Download 链接，请粘贴 GitHub 或 ZIP 链接。');
  return { downloadUrl: checkedUrl(new URL(download.getAttribute('href'), pageUrl).href).href, title: document.querySelector('h1')?.textContent.trim().slice(0, 100) || '' };
}
export async function resolveLink(input, options = {}, depth = 0) {
  if (depth > 2) throw new Error('下载链接跳转层数过多，请直接粘贴 GitHub 或 ZIP 链接。');
  const info = classifyLink(input);
  const get = (url, extra = {}) => fetchBounded(url, { ...options, limit: 2 * 1024 * 1024, ...extra });
  const json = async (url, extra) => { const bytes = await get(url, extra); if (bytes === null) return null; try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('GitHub 返回了无法识别的数据。'); } };
  if (info.kind === 'zip') return { title: '', sourceUrl: sourceAddress(input), archives: [{ label: '下载这个 ZIP', url: info.url, version: '' }] };
  if (info.kind === 'typora') {
    const page = parseTyporaPage(new TextDecoder().decode(await get(info.url)), info.url);
    const resolved = await resolveLink(page.downloadUrl, options, depth + 1);
    return { ...resolved, title: page.title || resolved.title, sourceUrl: sourceAddress(input) };
  }
  const api = `https://api.github.com/repos/${info.repo}`;
  const release = await json(`${api}/releases/${info.tag ? `tags/${encodeURIComponent(info.tag)}` : 'latest'}`, { allow404: !info.tag });
  const archives = (release?.assets ?? []).filter(asset => /\.zip$/i.test(asset.name) && asset.size <= MAX_ZIP_BYTES).slice(0, 30).map(asset => ({ label: `${asset.name} · ${release.tag_name}`, url: checkedUrl(asset.browser_download_url).href, version: String(release.tag_name).slice(0, 100) }));
  if (!archives.length) {
    if (info.kind === 'release') throw new Error('这个 Release 没有可用的 ZIP 附件。请提供主题发布包，或尝试仓库首页链接。');
    const repo = await json(api);
    const commit = await json(`${api}/commits/${encodeURIComponent(repo.default_branch)}`);
    if (!/^[a-f\d]{40}$/i.test(commit.sha)) throw new Error('无法确定仓库版本。');
    archives.push({ label: `仓库快照 · ${commit.sha.slice(0, 8)}`, url: `https://codeload.github.com/${info.repo}/zip/${commit.sha}`, version: commit.sha });
  }
  return { title: info.repo.split('/')[1], sourceUrl: sourceAddress(input), archives };
}
