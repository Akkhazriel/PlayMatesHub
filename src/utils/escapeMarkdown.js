/**
 * Экранирует спецсимволы MarkdownV2.
 * Используется для безопасного форматирования сообщений Telegram.
 * Документация: https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}!]/g, '\\$&');
}

