import { DEFAULT_BACKGROUND, normalizeBackground } from '../shared/background-policy.js';
import { validateFiles } from '../theme/resources.js';
import { getBundle, putBundle } from '../theme/asset-store.js';

const ID = 'global-background';
export async function getBackground() {
  const saved = await getBundle(ID);
  return { settings: normalizeBackground(saved?.settings ?? DEFAULT_BACKGROUND), image: saved?.image ?? null };
}
export async function saveBackground(input) {
  const settings = normalizeBackground(input.settings);
  const previous = await getBackground();
  let image = previous.image;
  if (Object.hasOwn(input, 'image')) {
    if (input.image === null) image = null;
    else {
      const validated = validateFiles([input.image]).files[0];
      if (validated.kind !== 'image') throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
      image = validated;
    }
  }
  if (settings.enabled && !image) throw new Error('请先上传背景图片，再启用自定义背景。');
  await putBundle({ id: ID, settings, image });
  return { settings, image };
}
