import { build } from 'esbuild';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
await mkdir(out, { recursive: true });
for (const folder of ['popup', 'options', 'logs']) {
  await cp(path.join(root, 'src', folder), path.join(out, folder), {
    recursive: true, filter: file => !file.endsWith('.js')
  });
}
await cp(path.join(root, 'src/manifest.json'), path.join(out, 'manifest.json'));
for (const entry of ['background/index', 'content/controller', 'popup/index', 'options/index', 'logs/index']) {
  await build({
    entryPoints: [path.join(root, `src/${entry}.js`)], outfile: path.join(out, `${entry}.js`),
    bundle: true, platform: 'browser', format: entry.startsWith('content/') ? 'iife' : 'esm',
    target: 'chrome110', legalComments: 'eof'
  });
}
const dependencies = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const notices = [`Web-markdown ${dependencies.version}`, 'Third-party dependency licenses (bundled code):'];
for (const name of ['postcss', 'postcss-selector-parser', 'postcss-value-parser', 'nanoid', 'picocolors', 'source-map-js', 'cssesc', 'util-deprecate']) {
  const dir = path.join(root, 'node_modules', name);
  for (const file of ['LICENSE', 'LICENSE-MIT', 'LICENSE.md']) {
    try { notices.push(`\n--- ${name} ---\n${await readFile(path.join(dir, file), 'utf8')}`); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
await writeFile(path.join(out, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n'));
console.log(`Built Web-markdown ${dependencies.version}: ${out}`);
