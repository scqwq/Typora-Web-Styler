import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkPage, validateAnchor, validatePatch, validateLayout, contentSignature, findAnchor, BOOKMARK_COLORS } from '../src/shared/bookmark-policy.js';
import { listBookmarks, changeBookmarks } from '../src/bookmarks/repository.js';

function anchor(source, exact, start = source.indexOf(exact)) {
  return { exact, start, prefix: source.slice(Math.max(0, start - 64), start), suffix: source.slice(start + exact.length, start + exact.length + 64), signature: contentSignature(source) };
}
test('page identity retains queries and hash routes, but heading links share bookmarks', () => {
  assert.equal(bookmarkPage('https://a.test/read?id=1#section'), 'https://a.test/read?id=1');
  assert.notEqual(bookmarkPage('https://a.test/read?id=1'), bookmarkPage('https://a.test/read?id=2'));
  assert.notEqual(bookmarkPage('https://a.test/#/one'), bookmarkPage('https://a.test/#/two'));
  assert.equal(bookmarkPage('https://a.test/#!/one'), 'https://a.test/#!/one');
  assert.throws(() => bookmarkPage('chrome://settings'));
});
test('content anchors survive preceding insertions, nested DOM splits and changed layouts', () => {
  const source = '前一段正文。这里记录关键词，后面继续阅读。';
  const saved = anchor(source, '关键词');
  assert.equal(findAnchor(source, saved), source.indexOf('关键词'));
  const changed = '新增加的段落。' + source;
  assert.equal(findAnchor(changed, saved), changed.indexOf('关键词'));
  assert.equal(findAnchor(source.replace('关键词', '别的内容'), saved), null);
});
test('ambiguous repeated words are not silently resolved to an arbitrary occurrence', () => {
  const source = '甲'.repeat(80) + '词' + '乙'.repeat(80);
  const saved = anchor(source, '词');
  assert.equal(findAnchor(source + source, saved), null);
  assert.equal(findAnchor('甲词乙'.repeat(3000), { ...saved, prefix: '', suffix: '' }), null);
});
test('bookmark validation rejects oversized text, invalid offsets and unsafe color values', () => {
  const saved = anchor('正文选文', '选文');
  assert.deepEqual(validateAnchor(saved), saved);
  for (const value of [{ ...saved, exact: '' }, { ...saved, exact: '词'.repeat(257) }, { ...saved, start: -1 }, { ...saved, start: 1.5 }]) assert.throws(() => validateAnchor(value));
  assert.deepEqual(validatePatch({ name: '  学习笔记  ', color: '#AABBCC' }), { name: '学习笔记', color: '#aabbcc' });
  for (const patch of [{ name: '  ' }, { color: 'url(https://a.test)' }, { color: '#fff' }, { id: 'other' }]) assert.throws(() => validatePatch(patch));
  assert.throws(() => validateLayout({ x: NaN, y: 5, collapsed: false }));
});
test('repository persists monotonic names, serializes simultaneous edits and keeps pages separate', async () => {
  let storage = {};
  globalThis.chrome = { storage: { local: {
    get: async key => structuredClone({ [key]: storage[key] }),
    set: async value => { await new Promise(resolve => setTimeout(resolve, 2)); storage = structuredClone({ ...storage, ...value }); }
  } } };
  const page = 'https://a.test/article', saved = anchor('正文中的词句', '词句');
  try {
    const create = () => changeBookmarks(page, 'create', { anchor: saved, selector: 'article' });
    await Promise.all([create(), create(), create()]);
    let record = await listBookmarks(page + '#heading');
    assert.deepEqual(record.items.map(item => item.name), ['标签1', '标签2', '标签3']);
    assert.ok(record.items.every(item => BOOKMARK_COLORS.includes(item.color)));
    const [first, second] = record.items;
    await Promise.all([changeBookmarks(page, 'update', { id: first.id, patch: { name: '新名字' } }), changeBookmarks(page, 'update', { id: second.id, patch: { color: '#123456' } })]);
    await changeBookmarks(page, 'delete', { id: second.id }); await create();
    record = await listBookmarks(page);
    assert.equal(record.items[0].name, '新名字'); assert.equal(record.items.at(-1).name, '标签4');
    assert.equal((await listBookmarks(page + '?other=1')).items.length, 0);
    await changeBookmarks(page, 'layout', { layout: { x: 50, y: 75, collapsed: true } });
    assert.equal((await listBookmarks(page)).layout.collapsed, true);
    const before = structuredClone(storage);
    await assert.rejects(changeBookmarks(page, 'update', { id: first.id, patch: { color: 'bad' } }));
    assert.deepEqual(storage, before);
    for (const item of record.items) await changeBookmarks(page, 'delete', { id: item.id });
    assert.equal((await listBookmarks(page)).items.length, 0);
    await create(); assert.equal((await listBookmarks(page)).items[0].name, '标签5');
    assert.equal((await listBookmarks(page)).layout.collapsed, false);
  } finally { delete globalThis.chrome; }
});
test('repository enforces per-page capacity without destroying stored bookmarks', async () => {
  let saved;
  globalThis.chrome = { storage: { local: { get: async () => ({ pageBookmarksV1: saved }), set: async value => { saved = structuredClone(value.pageBookmarksV1); } } } };
  try {
    const page = 'https://a.test/full', fields = { anchor: anchor('完整正文', '正文'), selector: 'main' };
    for (let i = 0; i < 100; i++) await changeBookmarks(page, 'create', fields);
    await assert.rejects(changeBookmarks(page, 'create', fields), /上限/);
    assert.equal((await listBookmarks(page)).items.length, 100);
  } finally { delete globalThis.chrome; }
});
