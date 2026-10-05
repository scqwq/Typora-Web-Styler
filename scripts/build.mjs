import { build } from 'esbuild';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

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
const notices = [`Typora Web Styler ${dependencies.version}`, 'Third-party dependency licenses (bundled code):'];
const rootRequire = createRequire(path.join(root, 'package.json'));
// Resolve transitive dependencies from their owner rather than assuming npm hoisting.
async function packageDirectory(name, owner) {
  const resolver = owner ? createRequire(rootRequire.resolve(owner)) : rootRequire;
  let directory = path.dirname(resolver.resolve(name));
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      if (manifest.name === name) return directory;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot locate dependency license directory: ${name}`);
    directory = parent;
  }
}
for (const [name, owner] of [
  ['postcss'], ['postcss-selector-parser'], ['postcss-value-parser'],
  ['nanoid', 'postcss'], ['picocolors', 'postcss'], ['source-map-js', 'postcss'],
  ['cssesc', 'postcss-selector-parser'], ['util-deprecate', 'postcss-selector-parser']
]) {
  const directory = await packageDirectory(name, owner);
  let found = false;
  for (const file of ['LICENSE', 'LICENSE-MIT', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT.txt']) {
    try { notices.push(`\n--- ${name} ---\n${await readFile(path.join(directory, file), 'utf8')}`); found = true; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!found) throw new Error(`Missing dependency license: ${name}`);
}
await writeFile(path.join(out, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n'));
console.log(`Built Typora Web Styler ${dependencies.version}: ${out}`);
