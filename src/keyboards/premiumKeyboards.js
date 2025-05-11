import { Markup } from 'telegraf';

/**
 * Клавиатура премиум-раздела.
 */
export function premiumKeyboard() {
  return Markup.keyboard([
    ['💳 Оформить подписку'],
    ['🧑‍💼 Связаться с админом'],
    ['⬅️ Назад']
  ]).resize();
}
