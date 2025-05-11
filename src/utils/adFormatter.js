import { escapeMarkdown } from './escapeMarkdown.js';

function buildAdTypeLabel(type) {
  switch (type) {
    case 'entry': return '👣 При входе в бота';
    case 'search': return '🔍 В поиске тиммейтов';
    case 'interval': return '⏱ Периодически';
    default: return '❓ Неизвестно';
  }
}

function buildAdPreview(ad) {
  return `🆔 *ID:* ${ad.id || '—'}\n` +
         `📄 *Текст:* ${escapeMarkdown(ad.content)}\n` +
         `📍 *Тип:* ${buildAdTypeLabel(ad.type)}\n` +
         `🔗 *Ссылка:* ${escapeMarkdown(ad.link || '—')}\n` +
         `📎 *Медиа:* ${ad.media ? 'Да' : 'Нет'}\n` +
         `🔁 *Частота:* ${ad.frequency || 1}\n` +
         `${ad.active ? '✅ Активно' : '🚫 Выключено'}`;
}

export { buildAdTypeLabel, buildAdPreview };
