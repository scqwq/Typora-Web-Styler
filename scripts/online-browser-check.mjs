import { chromium } from 'playwright';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive:true });
const extension = path.join(artifacts, 'online-test-extension');
await cp(path.join(root,'dist'), extension, {recursive:true});
const manifest = JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
// Pregranted domains are exclusive to this test copy; native permission dialogs need manual acceptance checks.
manifest.host_permissions = ['http://127.0.0.1/*','https://theme.typora.io/*','https://github.com/*','https://api.github.com/*','https://codeload.github.com/*','https://release-assets.githubusercontent.com/*','https://objects.githubusercontent.com/*','https://themes.example.com/*'];
await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest,null,2));
const font = new Uint8Array(await readFile('C:/Windows/Fonts/arial.ttf'));
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
const archive = zipSync({
 'package/green.css':strToU8('@import "common/base.css";#write h2{color:#287852}'),
 'package/violet.css':strToU8('@import "common/base.css";#write h2{color:#663399}'),
 'package/common/base.css':strToU8('@import "fonts.css";#write p{color:#333;background-image:url("../images/paper.png")}'),
 'package/common/fonts.css':strToU8('@font-face{font-family:OfflineFont;src:url("../fonts/body.ttf")}#write{font-family:OfflineFont,serif}'),
 'package/fonts/body.ttf':font,'package/images/paper.png':png
});
const release = {tag_name:'v1.2',assets:[{name:'themes.zip',size:archive.length,browser_download_url:'https://github.com/test/themes/releases/download/v1.2/themes.zip'}]};
const fixture = await readFile(path.join(root,'tests/fixtures/article.html'));
const server = createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(fixture);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${server.address().port}/`;
const results={environment:'Dedicated headless Edge with test-only pregranted host permissions; controlled HTTPS fixtures; no native permission dialog assertion',checks:[],errors:[]};
let context;
try {
 context=await chromium.launchPersistentContext(path.join(root,`.cache/online-profile-${Date.now()}`),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--enable-unsafe-extension-debugging'],viewport:{width:1365,height:1000}});
 context.on('weberror',error=>results.errors.push(error.error().message));
 await context.route('https://**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='theme.typora.io') return route.fulfill({contentType:'text/html',body:'<h1>Test Theme</h1><a href="https://github.com/test/themes/releases/latest">Download</a><script>window.remoteScriptExecuted=true</script>'});
  if(url.hostname==='api.github.com') {
   if(url.pathname.includes('/rate/')) return route.fulfill({status:403,contentType:'application/json',body:'{}'});
   if(url.pathname==='/repos/test/source/releases/latest') return route.fulfill({status:404,contentType:'application/json',body:'{}'});
   if(url.pathname==='/repos/test/source') return route.fulfill({contentType:'application/json',body:JSON.stringify({default_branch:'main'})});
   if(url.pathname==='/repos/test/source/commits/main') return route.fulfill({contentType:'application/json',body:JSON.stringify({sha:'a'.repeat(40)})});
   const data=url.pathname.includes('/multi/')?{...release,assets:[release.assets[0],{...release.assets[0],name:'second.zip'}]}:release;
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  if(url.hostname==='github.com') return route.fulfill({contentType:'application/zip',body:Buffer.from(archive)});
  if(['release-assets.githubusercontent.com','codeload.github.com','themes.example.com'].includes(url.hostname)) return route.fulfill({contentType:'application/zip',body:Buffer.from(archive)});
  return route.abort();
 });
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const ui=await context.newPage(); await ui.goto(`chrome-extension://${id}/options/index.html`); await ui.locator('#themes .theme').first().waitFor();
 const send=async(type,fields={})=>{const result=await ui.evaluate(data=>chrome.runtime.sendMessage(data),{type,...fields});assert.ok(result.ok,result.error);return result.value;};
 const fetchLink=async link=>{await ui.locator('#themeUrl').fill(link);await ui.locator('#fetchTheme').click();await ui.locator('#packageChoices').waitFor({state:'visible'});};
 const importEntry=async(entry,name)=>{await ui.locator('#entrySelect').selectOption(entry);await ui.locator('#packageName').fill(name);await ui.locator('#importPackage').click();await ui.waitForFunction(name=>document.querySelector('#packageStatus').textContent.includes(`已导入“${name}”`),name);return(await send('theme.list')).find(t=>t.name===name);};
 await fetchLink('https://theme.typora.io/theme/Test/');
 assert.equal(await ui.evaluate(()=>window.remoteScriptExecuted),undefined);
 assert.equal(await ui.locator('#entrySelect option').count(),2);
 await ui.locator('#showAllCss').check(); assert.equal(await ui.locator('#entrySelect option').count(),4);
 await ui.locator('#showAllCss').uncheck();
 const theme=await importEntry('package/green.css','online-green');
 assert.equal(theme.provenance.sourceUrl,'https://theme.typora.io/theme/Test/');assert.equal(theme.provenance.version,'v1.2');assert.equal(theme.resourceCount,2);
 assert.equal(theme.report.resources.length,0);assert.equal(theme.report.fontDefinitions,1);
 const violet=await importEntry('package/violet.css','online-violet');
 assert.ok(theme.id!==violet.id);
 results.checks.push('Typora detail → Release API → ZIP → two independent theme entries → CSS dependency/font/image validation → source/version');
 await ui.locator('#themeUrl').fill('https://github.com/test/multi');await ui.locator('#fetchTheme').click();await ui.locator('#archiveChoices').waitFor({state:'visible'});assert.equal(await ui.locator('#archiveSelect option').count(),2);await ui.locator('#archiveSelect').selectOption('1');await ui.locator('#downloadArchive').click();await ui.locator('#packageChoices').waitFor({state:'visible'});
 results.checks.push('multiple Release ZIP selection');
 await fetchLink('https://github.com/test/source');
 const snapshot=await importEntry('package/green.css','commit-theme');assert.equal(snapshot.provenance.version,'a'.repeat(40));
 results.checks.push('repository without releases → immutable commit ZIP');
 await fetchLink('https://themes.example.com/themes.zip?token=private');
 const direct=await importEntry('package/violet.css','direct-zip');assert.equal(direct.provenance.sourceUrl,'https://themes.example.com/themes.zip');
 results.checks.push('direct ZIP with credential-free fetch and redacted query metadata');
 await ui.locator('#zipFile').setInputFiles({name:'local.zip',mimeType:'application/zip',buffer:Buffer.from(archive)});await ui.waitForFunction(()=>document.querySelector('#onlineStatus').textContent.includes('本地 ZIP 已读取'));await importEntry('package/green.css','local-zip');
 await ui.locator('#zipFile').setInputFiles({name:'broken.zip',mimeType:'application/zip',buffer:Buffer.from('not zip')});await ui.waitForFunction(()=>document.querySelector('#onlineStatus').textContent.includes('ZIP'));assert.equal(await ui.locator('#packageChoices').isVisible(),false);
 results.checks.push('local ZIP and malformed archive clear stale selection');
 // Candidate filtering and preflight failures never reach the theme store.
 const mixed = zipSync({
  'themes/main.css':strToU8('@import "font-only.css";#write p{font-family:OfflineFont;color:#333}'),
  'themes/font-only.css':strToU8('@font-face{font-family:OfflineFont;src:url("../fonts/body.ttf")}'),
  'themes/online.css':strToU8('@import "https://example.com/main.css";'),
  'themes/empty.css':strToU8('/* empty */'),
  'themes/missing.css':strToU8('@import "lost.css";#write p{color:red}'),
  'themes/large.css':strToU8('#write p{color:#333}/*'+'x'.repeat(1100000)+'*/'),
  'themes/over.css':strToU8('@import "large.css";@import "large.css";'),
  'fonts/body.ttf':font
 });
 await ui.locator('#zipFile').setInputFiles({name:'mixed.zip',mimeType:'application/zip',buffer:Buffer.from(mixed)});
 await ui.waitForFunction(()=>document.querySelector('#onlineStatus').textContent.includes('本地 ZIP 已读取'));
 assert.equal(await ui.locator('#entrySelect option').count(),3); // main, missing and over; large is a dependency
 await ui.locator('#showAllCss').check(); assert.equal(await ui.locator('#entrySelect option').count(),7);
 for(const value of ['themes/font-only.css','themes/online.css','themes/empty.css']) assert.equal(await ui.locator(`#entrySelect option[value="${value}"]`).isDisabled(),true);
 const beforeChecks=(await send('theme.list')).length;
 await ui.locator('#entrySelect').selectOption('themes/missing.css');
 await ui.waitForFunction(()=>document.querySelector('#packageStatus').textContent.includes('缺少'));
 assert.equal(await ui.locator('#importPackage').isDisabled(),true);
 await ui.locator('#entrySelect').selectOption('themes/over.css');
 await ui.waitForFunction(()=>document.querySelector('#packageStatus').textContent.includes('超过 2 MB'));
 assert.equal(await ui.locator('#importPackage').isDisabled(),true);
 assert.equal((await send('theme.list')).length,beforeChecks);
 const largeTheme=await importEntry('themes/large.css','above-old-css-limit'); assert.ok(largeTheme.id);
 const withFont=await importEntry('themes/main.css','font-dependency-retained'); assert.equal(withFont.resourceCount,1);
 await ui.locator('#packageChoices').screenshot({path:path.join(artifacts,'package-preflight.png')});
 results.checks.push('default entry filter, disabled font/remote/empty choices, missing/merged-overlimit preflight, >1 MiB import, font dependency retained');

 const directory=path.join(root,'.cache/online-directory');await mkdir(path.join(directory,'shared'),{recursive:true});await writeFile(path.join(directory,'main.css'),'@import "shared/base.css";#write h2{color:#735028}');await writeFile(path.join(directory,'shared/base.css'),'#write p{color:#333}');
 await ui.locator('#file').setInputFiles(path.join(directory,'main.css'));await ui.locator('#directory').setInputFiles(directory);await ui.locator('#name').fill('local-directory');await ui.locator('#import').click();await ui.waitForFunction(()=>document.querySelector('#status').textContent.includes('已导入“local-directory”'));
 results.checks.push('existing local CSS and directory dependency imports');
 await ui.locator('#themeUrl').fill('https://github.com/rate/themes');await ui.locator('#fetchTheme').click();await ui.waitForFunction(()=>document.querySelector('#onlineStatus').textContent.includes('拒绝'));assert.equal(await ui.locator('#packageChoices').isVisible(),false);
 const count=(await send('theme.list')).length;
 await ui.evaluate(()=>{chrome.permissions.request=async()=>false;});await ui.locator('#themeUrl').fill('https://github.com/test/themes');await ui.locator('#fetchTheme').click();await ui.waitForFunction(()=>document.querySelector('#onlineStatus').textContent.includes('未取得'));assert.equal((await send('theme.list')).length,count);
 results.checks.push('rate-limit failure and permission denial preserve installed themes');
 await ui.screenshot({path:path.join(artifacts,'online-options.png'),fullPage:true});
 const article=await context.newPage();await article.goto(address);
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,address);
 await ui.reload();await ui.locator('#themes .theme').nth(count-1).waitFor();
 await context.setOffline(true);
 await send('settings.set',{settings:{enableBackgroundImages:true}});
 const found=await send('article.locate',{tabId,selector:'#post'});
 const applied=await send('article.apply',{tabId,selector:'#post',documentToken:found.documentToken,themeId:theme.id});
 assert.equal(applied.resources.fontLoaded,1);assert.equal(applied.resources.failures.length,0);
 assert.equal(await article.locator('#heading').evaluate(el=>getComputedStyle(el).color),'rgb(40, 120, 82)');
 await send('article.apply',{tabId,selector:'#post',documentToken:found.documentToken,themeId:violet.id});
 assert.equal(await article.locator('#heading').evaluate(el=>getComputedStyle(el).color),'rgb(102, 51, 153)');
 await send('article.restore',{tabId});assert.equal(await article.locator('[data-wm-article]').count(),0);
 results.checks.push('settings reload → offline persisted font/image application → theme switch → restore');
 assert.deepEqual(results.errors,[]);results.passed=true;
 console.log(JSON.stringify(results,null,2));
} catch(error) { results.failure=error.message; results.pages=await Promise.all((context?.pages()??[]).map(async page=>({url:page.url(),status:await page.evaluate(()=>document.querySelector('#onlineStatus')?.textContent??null).catch(()=>null)}))); console.log(JSON.stringify(results,null,2)); throw error; } finally {await writeFile(path.join(artifacts,'online-browser-results.json'),JSON.stringify(results,null,2));await context?.close();await new Promise(resolve=>server.close(resolve));}
