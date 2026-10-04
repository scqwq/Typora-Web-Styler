import test from 'node:test';
import assert from 'node:assert/strict';
import { record, listLogs, clearLogs, pageAddress, LOG_LIMIT } from '../src/diagnostics/logger.js';

test('logs persist, stay ordered and bounded, redact embedded resources and can be cleared', async () => {
  const data = {}; globalThis.chrome = { storage: { local: { get: async key => ({ [key]: data[key] }), set: async values => Object.assign(data, structuredClone(values)) } } };
  await Promise.all(Array.from({ length: LOG_LIMIT + 5 }, (_, index) => record('conversion', 'warning', `item-${index}`, { asset: 'data:font/woff;base64,SECRET', nested: { result: 'skipped' } })));
  const logs = await listLogs(); assert.equal(logs.length, LOG_LIMIT); assert.equal(logs[0].message, `item-${LOG_LIMIT + 4}`);
  assert.ok(!JSON.stringify(logs).includes('SECRET')); assert.equal(logs[0].details.nested.result, 'skipped');
  assert.equal(pageAddress('https://example.com/blog?id=secret#heading'), 'https://example.com/blog');
  await clearLogs(); assert.deepEqual(await listLogs(), []); delete globalThis.chrome;
});
