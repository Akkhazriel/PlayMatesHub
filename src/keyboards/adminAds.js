import { Markup } from 'telegraf';

/**
 * Основная клавиатура админки рекламы.
 */
export function mainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ Добавить новую'],
        ['📂 Все', '👣 Entry', '🔍 Search', '⏱ Interval'],
        ['⬅️ Назад']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
}

/**
 * Инлайн-кнопки для конкретной рекламы.
 */
export function buildInlineKeyboard(ad) {
  if (!ad || typeof ad.id !== 'number') {
    return Markup.inlineKeyboard([]);
  }

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`🗑 Удалить ${ad.id}`, `ad_delete_${ad.id}`),
      Markup.button.callback(
        ad.active ? `🔴 Выключить ${ad.id}` : `🟢 Включить ${ad.id}`,
        `ad_toggle_${ad.id}`
      )
    ]
  ]);
}

/**
 * Кнопки выбора типа рекламы.
 */
export function buildAdTypeButtons() {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('👣 При входе в бота', 'ad_type_entry')],
      [Markup.button.callback('🔍 В поиске тиммейтов', 'ad_type_search')],
      [Markup.button.callback('⏱ Периодически', 'ad_type_interval')]
    ]).reply_markup
  };
}
