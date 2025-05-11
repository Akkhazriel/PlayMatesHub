import { Markup } from 'telegraf';

/**
 * Возвращает клавиатуру главного меню.
 * Если пользователь админ — добавляется кнопка админ-панели.
 */
export default function mainMenuKeyboard(isAdmin = false) {
  const keyboard = [
    ['🔍 Поиск тиммейтов'],
    ['👤 Профиль', '💎 Премиум'],
    ['❓ Помощь']
  ];

  if (isAdmin) {
    keyboard.push(['🛠 Админ-панель']);
  }

  return Markup.keyboard(keyboard).resize();
}
