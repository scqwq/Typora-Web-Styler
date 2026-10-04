export const DEFAULT_POLICY = Object.freeze({ protectLayout: true, preserveCodeColors: true });

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
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
  'border-collapse', 'border-spacing', 'box-shadow', 'margin', 'margin-top', 'margin-bottom',
  'margin-left', 'margin-right', 'margin-block', 'margin-block-start', 'margin-block-end',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'padding-block',
  'padding-inline', 'padding-inline-start', 'padding-inline-end'
]);
