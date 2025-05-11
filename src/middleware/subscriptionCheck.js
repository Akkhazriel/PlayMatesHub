import { Markup } from 'telegraf';

const CHANNEL_ID = process.env.CHANNEL_ID; // читаем из .env

if (!CHANNEL_ID) {
  throw new Error('❌ Переменная окружения CHANNEL_ID не задана.');
}

export default async function subscriptionCheck(ctx, next) {
  if (!ctx.from) return next(); // пропускаем системные события

  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);

    if (['creator', 'administrator', 'member'].includes(member.status)) {
      return next(); // подписан → пропускаем
    } else {
      await ctx.reply(
        '❗️ Для использования бота подпишитесь на наш канал:',
        Markup.inlineKeyboard([
          Markup.button.url('📢 Подписаться', `https://t.me/${CHANNEL_ID.replace('@', '')}`)
        ])
      );
    }
  } catch (err) {
    console.error('[subscriptionCheck] Ошибка проверки подписки:', err);

    try {
      await ctx.reply('⚠️ Не удалось проверить подписку. Попробуйте позже.');
    } catch (sendErr) {
      if (sendErr.code === 403) {
        console.warn(`[subscriptionCheck] Пользователь ${ctx.from.id} заблокировал бота.`);
      } else {
        console.error('[subscriptionCheck] Ошибка при отправке уведомления:', sendErr);
      }
    }
  }
}