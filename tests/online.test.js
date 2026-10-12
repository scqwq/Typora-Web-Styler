import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { mergeCss, importReference } from '../src/theme/css-package.js';
import { unpackZip, listPackageThemes, preparePackageTheme } from '../src/theme/zip-package.js';
import { inspectPackageTheme } from '../src/theme/package-analysis.js';
import { classifyLink, resolveLink, fetchBounded, originsForLink, NeededPermission, sourceAddress } from '../src/theme/online.js';
import { validateFiles } from '../src/theme/resources.js';
import { compileTheme } from '../src/theme/compiler.js';
const css = (path, source) => ({ path, source });
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
const fixture = () => zipSync({
  'bundle/green.css': strToU8('@import "./common/base.css"; #write h2{color:green}'),
  'bundle/dark.css': strToU8('@import "./common/base.css"; #write h2{color:white}'),
  'bundle/common/base.css': strToU8('@import "fonts.css"; #write p{background-image:url("../images/paper.png");color:#333}'),
  'bundle/common/fonts.css': strToU8('@font-face{font-family:Demo;src:url("../fonts/demo.woff")}#write p{font-family:Demo}'),
  'bundle/fonts/demo.woff': strToU8('wOFF fixture'), 'bundle/images/paper.png': png,
  'bundle/unused.png': png, 'bundle/scripts.js': strToU8('throw new Error("never execute")')
});
test('CSS merges nested imports in cascade order, rewrites dependency URLs and leaves independent themes separate', () => {
  const files = unpackZip(fixture()), prepared = preparePackageTheme(files, 'bundle/green.css');
  assert.ok(prepared.source.indexOf('color:#333') < prepared.source.indexOf('color:green'));
  assert.ok(!prepared.source.includes('color:white'));
  assert.equal(prepared.resources.sourcePath, 'theme.css');
  assert.deepEqual(prepared.resources.files.map(f => f.path).sort(), ['bundle/fonts/demo.woff', 'bundle/images/paper.png']);
  const output = compileTheme(prepared.source, { bundle: { ...prepared.resources, files: validateFiles(prepared.resources.files).files }, settings: { enableFonts: true, enableBackgroundImages: true } });
  assert.equal(output.fonts.length, 1); assert.equal(output.images.length, 1); assert.equal(output.report.resources.length, 0);
  const { candidates } = listPackageThemes(files); assert.equal(candidates[0].dependency, false);
  assert.equal(candidates.find(c => c.path.endsWith('fonts.css')).dependency, true);
});
test('CSS import media conditions and repeated references preserve order', () => {
  assert.deepEqual(importReference('url("b.css") screen and (min-width: 500px)'), { url: 'b.css', condition: 'screen and (min-width: 500px)' });
  const result = mergeCss('a.css', [css('a.css', '@import "b.css" screen and (min-width:500px);p{color:blue}@import "b.css";'), css('b.css', 'p{color:red}')]);
  assert.match(result.source, /@media screen and \(min-width:500px\)/);
  assert.equal(result.source.match(/color:red/g).length, 2);
});
test('missing, cyclic, oversized and unsupported conditional CSS imports fail clearly; external imports stay reportable', () => {
  assert.throws(() => mergeCss('a.css', [css('a.css', '@import "missing.css";')]), /缺少/);
  assert.throws(() => mergeCss('a.css', [css('a.css', '@import "b.css";'), css('b.css', '@import "a.css";')]), /循环引用/);
  assert.throws(() => mergeCss('a.css', [css('a.css', '@import "b.css" layer(foo);'), css('b.css', 'p{color:red}')]), /layer\/supports/);
  assert.throws(() => mergeCss('a.css', [css('a.css', '@import "../b.css";')]), /超出/);
  assert.throws(() => mergeCss('a.css', [css('a.css', 'x'.repeat(2097153))]), /2 MB/);
  const result = mergeCss('a.css', [css('a.css', '@import "https://example.com/remote.css";p{color:red}')]);
  assert.equal(compileTheme(result.source).report.skipped.some(i => i.item.includes('remote.css')), true);
});
test('ZIP rejects traversal, canonical duplicates, bad CRC, encryption, symlinks and oversized expansion', () => {
  assert.throws(() => unpackZip(zipSync({ '../evil.css': strToU8('p{color:red}') })), /不安全/);
  assert.throws(() => unpackZip(zipSync({ 'a.css': strToU8('p{color:red}'), 'a%2Ecss': strToU8('p{color:red}') })), /重复/);
  const mutateCentral = fn => { const data = fixture(); const view = new DataView(data.buffer); let at = 0; while(view.getUint32(at, true) !== 0x02014b50) at++; fn(view, at); return data; };
  assert.throws(() => unpackZip(mutateCentral((v, at) => v.setUint32(at + 16, 0, true))), /校验失败/);
  assert.throws(() => unpackZip(mutateCentral((v, at) => v.setUint16(at + 8, 1, true))), /加密/);
  assert.throws(() => unpackZip(mutateCentral((v, at) => v.setUint32(at + 38, 0xa0000000, true))), /链接/);
  assert.throws(() => unpackZip(mutateCentral((v, at) => v.setUint32(at + 24, 100 * 1024 * 1024, true))), /96 MB/);
  assert.throws(() => unpackZip(mutateCentral((v, at) => v.setUint32(at + 24, 1, true))), /声明大小|校验失败/);
  assert.throws(() => unpackZip(new Uint8Array(50)), /有效/);
});
test('ZIP ignores scripts and source-only archives fail without installing anything', () => {
  assert.equal(unpackZip(fixture()).has('bundle/scripts.js'), false);
  assert.throws(() => unpackZip(zipSync({ 'theme.scss': strToU8('p{color:red}') })), /已编译/);
});
test('supported URLs classify deterministically and reject arbitrary pages, local and insecure addresses', () => {
  assert.equal(classifyLink('https://theme.typora.io/theme/Lapis/').kind, 'typora');
  assert.equal(classifyLink('https://github.com/a/b').kind, 'repository');
  assert.equal(classifyLink('https://github.com/a/b/releases/tag/v1.0').tag, 'v1.0');
  assert.equal(classifyLink('https://cdn.example.com/a.zip?token=x').kind, 'zip');
  for (const url of ['http://example.com/a.zip', 'https://127.0.0.1/a.zip', 'https://a.local/a.zip', 'https://u:p@example.com/a.zip', 'https://example.com/page', 'https://github.com/a/b/tree/main']) assert.throws(() => classifyLink(url));
  assert.ok(originsForLink('https://github.com/a/b').includes('https://api.github.com/*'));
  assert.equal(sourceAddress('https://cdn.example.com/a.zip?token=secret#foo'), 'https://cdn.example.com/a.zip');
});
function fakeApi(routes) {
  const calls = [];
  return { calls, fetcher: async url => { calls.push(url); const entry = routes[new URL(url).pathname]; assert.ok(entry, url); return new Response(JSON.stringify(entry.body), { status: entry.status ?? 200 }); }, permissions: null };
}
test('GitHub resolves multiple release ZIPs and excludes unsupported/oversized attachments', async () => {
  const fake = fakeApi({ '/repos/a/b/releases/latest': { body: { tag_name: 'v2', assets: [{ name:'light.zip', size:12, browser_download_url:'https://github.com/a/b/releases/download/v2/light.zip' }, { name:'dark.zip', size:12, browser_download_url:'https://github.com/a/b/releases/download/v2/dark.zip' }, { name:'code.tar.gz',size:12 }] } } });
  const result = await resolveLink('https://github.com/a/b', fake);
  assert.equal(result.archives.length, 2); assert.equal(result.archives[0].version, 'v2'); assert.equal(fake.calls.length, 1);
});
test('repository without a release uses immutable commit snapshot; explicit Release never silently switches version', async () => {
  const fake = fakeApi({ '/repos/a/b/releases/latest': { status:404,body:{} }, '/repos/a/b': { body:{default_branch:'main'} }, '/repos/a/b/commits/main': { body:{sha:'a'.repeat(40)} } });
  const result = await resolveLink('https://github.com/a/b', fake);
  assert.equal(result.archives[0].url, `https://codeload.github.com/a/b/zip/${'a'.repeat(40)}`);
  await assert.rejects(resolveLink('https://github.com/a/b/releases', fake), /没有可用/);
});
test('download requires actual host permission, has byte limits and reports rate limits without fallback', async () => {
  await assert.rejects(fetchBounded('https://example.com/a.zip', { permissions: {contains:async () => false} }), NeededPermission);
  await assert.rejects(fetchBounded('https://example.com/a.zip', { permissions:null, limit:3, fetcher:async () => new Response('1234') }), /大小限制/);
  await assert.rejects(fetchBounded('https://example.com/a.zip', { permissions:null, fetcher:async () => new Response('', {status:429}) }), /频繁/);
  const fake = fakeApi({ '/repos/a/b/releases/latest': { status:403,body:{} } });
  await assert.rejects(resolveLink('https://github.com/a/b', fake), /拒绝/); assert.equal(fake.calls.length, 1);
});

test('redirected downloads recheck final host permissions before accepting content', async () => {
  const response = new Response('zip');
  Object.defineProperty(response, 'url', { value: 'https://cdn.example.com/package.zip' });
  const permissions = { contains: async ({ origins }) => origins[0] === 'https://example.com/*' };
  await assert.rejects(fetchBounded('https://example.com/package.zip', { permissions, fetcher: async () => response }), error => error instanceof NeededPermission && error.origins[0] === 'https://cdn.example.com/*');
});


test('package candidates distinguish font-only, remote and empty files without losing CSS dependencies', () => {
  const files = unpackZip(zipSync({
    'theme.css': strToU8('@import "fonts.css";#write p{font-family:Demo;color:#333}'),
    'fonts.css': strToU8('@font-face{font-family:Demo;src:url("demo.woff")}'),
    'remote.css': strToU8('@import "https://example.com/theme.css";'),
    'wrapper.css': strToU8('@import "theme.css";'),
    'empty.css': strToU8('/* empty */'), 'demo.woff': strToU8('wOFF fixture')
  }));
  const { candidates } = listPackageThemes(files);
  assert.equal(candidates.find(c => c.path === 'fonts.css').kind, 'font');
  assert.equal(candidates.find(c => c.path === 'remote.css').kind, 'remote');
  assert.equal(candidates.find(c => c.path === 'empty.css').kind, 'empty');
  assert.equal(candidates.find(c => c.path === 'wrapper.css').kind, 'theme');
  const checked = inspectPackageTheme(files, 'wrapper.css');
  assert.equal(checked.ok, true); assert.equal(checked.resourceCount, 1);
  assert.ok(checked.dependencies.includes('fonts.css'));
  assert.equal(inspectPackageTheme(files, 'fonts.css').ok, false);
});

test('preflight reports missing imports and merged-size errors before any storage mutation', () => {
  const enc = text => new TextEncoder().encode(text);
  const files = new Map([
    ['broken.css', enc('@import "missing.css";#write p{color:red}')],
    ['large.css', enc('#write p{color:#333}/*' + 'x'.repeat(1100000) + '*/')],
    ['over.css', enc('@import "large.css";@import "large.css";')]
  ]);
  assert.match(inspectPackageTheme(files, 'broken.css').error, /缺少/);
  assert.equal(inspectPackageTheme(files, 'large.css').ok, true);
  assert.match(inspectPackageTheme(files, 'over.css').error, /超过 2 MB/);
  assert.throws(() => unpackZip(zipSync({ 'over.css': enc('x'.repeat(2097153)) })), /超过大小/);
});
