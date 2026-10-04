export const DEFAULT_POLICY = Object.freeze({
  preserveHeadingSize: false, preserveHeadingColor: false,
  preserveBodyFont: false, preserveBodySize: false, preserveLineHeight: false,
  preserveLinkColor: false, preserveCodeColors: true, preserveCodeBackground: false,
  enableFonts: true, enableBackgroundImages: false, useThemeBackground: false
});

export const POLICY_FIELDS = [
  ['preserveHeadingSize', '保留原标题字号'], ['preserveHeadingColor', '保留原标题颜色'],
  ['preserveBodyFont', '保留原正文字体（代码除外）'], ['preserveBodySize', '保留原正文字号（标题、代码除外）'],
  ['preserveLineHeight', '保留原正文行距（代码除外）'], ['preserveLinkColor', '保留原链接颜色'],
  ['preserveCodeColors', '保留原代码配色'], ['preserveCodeBackground', '保留原代码背景色'],
  ['enableFonts', '加载主题配套的本地字体'], ['enableBackgroundImages', '允许主题使用本地背景图片'],
  ['useThemeBackground', '允许替换正文容器背景（宽度、位置仍保留原站）']
];

export function normalizePolicy(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('配置格式不正确。');
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_POLICY, key) || typeof value !== 'boolean') throw new Error(`无效配置项：${key}`);
  }
  return { ...DEFAULT_POLICY, ...input };
}

// Restrict P0 to text/block appearance; layout, generated content and motion need separate review.
export const TEXT_PROPERTIES = new Set([
  'color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'font-variant-ligatures', 'font-feature-settings', 'font-kerning', 'letter-spacing',
  'line-height', 'text-align', 'text-indent', 'text-transform', 'text-decoration',
  'text-decoration-color', 'text-decoration-line', 'text-decoration-style',
  'text-underline-offset', 'text-shadow', 'word-spacing', 'overflow-wrap', 'word-break',
  'white-space', 'tab-size', 'hyphens', 'list-style-type', 'list-style-position'
]);
export const BLOCK_PROPERTIES = new Set([
  'background', 'background-color', 'border', 'border-color', 'border-style', 'border-width',
  'background-image', 'background-size', 'background-position', 'background-repeat',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
  'border-collapse', 'border-spacing', 'box-shadow', 'margin', 'margin-top', 'margin-bottom',
  'margin-left', 'margin-right', 'margin-block', 'margin-block-start', 'margin-block-end',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'padding-block',
  'padding-inline', 'padding-inline-start', 'padding-inline-end'
]);
