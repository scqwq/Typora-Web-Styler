import { normalizePolicy } from '../shared/style-policy.js';

export async function getSettings() {
  const { globalSettings = {} } = await chrome.storage.local.get('globalSettings');
  // Pick known keys when reading so future/legacy storage cannot break upgrades.
  const normalized = normalizePolicy();
  for (const key of Object.keys(normalized)) {
    if (!globalSettings || !Object.hasOwn(globalSettings, key)) continue;
    try { normalized[key] = normalizePolicy({ [key]: globalSettings[key] })[key]; } catch { /* Invalid stored values fall back to defaults. */ }
  }
  return normalized;
}
export async function saveSettings(input) {
  normalizePolicy(input);
  const settings = normalizePolicy({ ...await getSettings(), ...input });
  await chrome.storage.local.set({ globalSettings: settings });
  return settings;
}
