import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuto, eligibleAuto, automaticSelector, webOrigin, hostPattern } from '../src/shared/auto-policy.js';
import { getAutoSettings, saveAutoSettings } from '../src/settings/auto-repository.js';

test('tab automation is opt-in and validates both checkbox fields', () => {
  assert.deepEqual(normalizeAuto(), { enabled: false, sameSiteOnly: false });
  for (const input of [null, [], { enabled: 'yes' }, { everyTab: true }]) assert.throws(() => normalizeAuto(input));
});
test('same-site mode keeps exact origin, and cross-site mode discards the original selector', () => {
  const rule = { origin: 'https://go-zero.dev', selector: '.article-body', paused: false };
  assert.ok(eligibleAuto({ enabled: true, sameSiteOnly: true }, rule, 'https://go-zero.dev/zh-cn/next/'));
  for (const url of ['http://go-zero.dev/', 'https://go-zero.dev:8443/', 'https://other.dev/', 'chrome://extensions/']) assert.equal(eligibleAuto({ enabled: true, sameSiteOnly: true }, rule, url), false);
  assert.ok(eligibleAuto({ enabled: true, sameSiteOnly: false }, rule, 'https://other.dev/'));
  assert.equal(eligibleAuto({ enabled: true }, { ...rule, paused: true }, 'https://go-zero.dev/'), false);
  assert.equal(eligibleAuto({ enabled: false }, rule, 'https://go-zero.dev/'), false);
  assert.equal(automaticSelector(rule, 'https://other.dev/'), '');
  assert.equal(automaticSelector(rule, 'https://go-zero.dev/next/'), '.article-body');
  assert.equal(hostPattern('http://localhost:1234/path'), 'http://localhost/*');
  assert.equal(webOrigin('not a URL'), null);
});
test('saving enabled automation requires the actual optional permissions', async () => {
  let saved = {}; let navigation = false, hosts = false;
  globalThis.chrome = { storage: { local: { get: async () => saved, set: async value => { saved = value; } } }, permissions: { contains: async request => request.permissions ? navigation : hosts } };
  assert.deepEqual(await getAutoSettings(), normalizeAuto());
  await assert.rejects(saveAutoSettings({ enabled: true, sameSiteOnly: true }), /导航权限/);
  assert.deepEqual(saved, {});
  navigation = true;
  await saveAutoSettings({ enabled: true, sameSiteOnly: true });
  await assert.rejects(saveAutoSettings({ enabled: true, sameSiteOnly: false }), /网站访问权限/);
  assert.equal((await getAutoSettings()).sameSiteOnly, true);
  hosts = true; await saveAutoSettings({ enabled: true, sameSiteOnly: false });
  assert.equal((await getAutoSettings()).sameSiteOnly, false);
  delete globalThis.chrome;
});
