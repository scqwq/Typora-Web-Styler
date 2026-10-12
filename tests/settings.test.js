import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePolicy } from '../src/shared/style-policy.js';
import { getSettings, saveSettings } from '../src/settings/repository.js';
import { preserve } from '../src/content/preservation.js';

test('article node setting validates integers and defaults to 60000', () => {
  assert.equal(normalizePolicy().maxArticleNodes, 60000);
  for (const value of [1, 12000, 60000, 200000]) assert.equal(normalizePolicy({ maxArticleNodes: value }).maxArticleNodes, value);
  for (const value of [0, -1, 200001, 1.5, NaN, Infinity, '60000', true, null]) assert.throws(() => normalizePolicy({ maxArticleNodes: value }), /最大正文节点数/);
});

test('legacy settings migrate and partial saves retain the numeric limit', async () => {
  let stored = { preserveHeadingColor: true, preserveCodeColors: false, unknown: true };
  globalThis.chrome = { storage: { local: {
    get: async () => ({ globalSettings: stored }),
    set: async value => { stored = value.globalSettings; }
  } } };
  try {
    assert.equal((await getSettings()).maxArticleNodes, 60000);
    assert.equal((await getSettings()).preserveHeadingColor, true);
    await saveSettings({ maxArticleNodes: 75000 });
    await saveSettings({ preserveBodySize: true });
    assert.equal(stored.maxArticleNodes, 75000);
    assert.equal(stored.preserveHeadingColor, true);
    assert.equal(stored.preserveCodeColors, false);
    await assert.rejects(saveSettings({ maxArticleNodes: '75000' }));
    assert.equal(stored.maxArticleNodes, 75000);
    stored = { maxArticleNodes: -1, preserveHeadingColor: true };
    assert.equal((await getSettings()).maxArticleNodes, 60000);
    stored = null;
    assert.equal((await getSettings()).maxArticleNodes, 60000);
  } finally { delete globalThis.chrome; }
});

test('node budget includes the root and reports the configured limit', () => {
  const el = { closest: () => null };
  const root = { ...el, querySelectorAll: () => Array(59999).fill(el) };
  assert.deepEqual(preserve(root, {}), []);
  root.querySelectorAll = () => Array(60000).fill(el);
  assert.throws(() => preserve(root, {}), /60,000/);
  assert.deepEqual(preserve(root, { maxArticleNodes: 60001 }), []);
  assert.throws(() => preserve(root, { maxArticleNodes: 12000 }), /12,000/);
});
