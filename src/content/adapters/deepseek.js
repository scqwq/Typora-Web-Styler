// Verified on the shared conversation page on 2026-10-09.
export function deepseekSelector(url) {
  return new URL(url).hostname === 'chat.deepseek.com'
    ? '.ds-assistant-message-main-content' : null;
}
