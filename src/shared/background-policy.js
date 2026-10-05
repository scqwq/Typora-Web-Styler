export const DEFAULT_BACKGROUND = Object.freeze({ enabled: false, surfaceOpacity: 90, imageOpacity: 50 });
export function normalizeBackground(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('背景配置格式不正确。');
  for (const [key, value] of Object.entries(input)) {
    if (key === 'enabled' ? typeof value !== 'boolean' : !['surfaceOpacity', 'imageOpacity'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error(`无效背景配置：${key}`);
  }
  return { ...DEFAULT_BACKGROUND, ...input };
}
