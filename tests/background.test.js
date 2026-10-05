import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackground } from '../src/shared/background-policy.js';

test('background defaults are independent and opacity accepts both endpoints', () => {
  assert.deepEqual(normalizeBackground(), { enabled: false, surfaceOpacity: 90, imageOpacity: 50 });
  assert.deepEqual(normalizeBackground({ enabled: true, surfaceOpacity: 0, imageOpacity: 100 }), { enabled: true, surfaceOpacity: 0, imageOpacity: 100 });
});
test('background rejects invalid opacity and unsupported fields before storage', () => {
  for (const value of [-1, 101, NaN, Infinity, '50', null]) assert.throws(() => normalizeBackground({ imageOpacity: value }));
  assert.throws(() => normalizeBackground({ enabled: 'yes' }));
  assert.throws(() => normalizeBackground({ dataUrl: 'https://example.com/image.png' }));
  assert.throws(() => normalizeBackground(null));
});
