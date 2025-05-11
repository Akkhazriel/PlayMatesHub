import { Markup } from 'telegraf';

/**
 * Клавиатура меню профиля пользователя.
 */
export function profileMenuKeyboard() {
  const buttons = [
    ['✏️ Редактировать'],
    ['💬 Мои мэтчи'],
    ['👁 Кто меня лайкнул'],
    ['📌 Кого я лайкнул'],
    ['🔗 Привязать Steam-профиль'],
    ['⬅️ В главное меню']
  ];

  return Markup.keyboard(buttons).resize();
}
