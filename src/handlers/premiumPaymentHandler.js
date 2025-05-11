import db from '../db.js';
import { Markup } from 'telegraf';

/**
 * Регистрирует все обработчики оплаты премиума
 * @param {Telegraf} bot
 */
export function registerPremiumPaymentHandlers(bot) {
  // 💳 Кнопка / команда: Оформить подписку
  bot.hears('💳 Оформить подписку', async (ctx) => {
    try {
      await ctx.reply('Выберите способ оплаты:', Markup.inlineKeyboard([
        [Markup.button.callback('💎 30 дней — Telegram', 'buy_premium_30')],
        [Markup.button.url('Оплатить через банк', 'https://your-bank-link.com')],
        [Markup.button.url('Связаться с админом', 'https://t.me/youradmin')],
      ]));
    } catch (err) {
      console.error('Ошибка при показе кнопок оплаты:', err);
    }
  });

  // ☑️ Inline-кнопка оплаты через Telegram Payments
  bot.action(/^buy_premium_(\d+)$/, async (ctx) => {
    const days = parseInt(ctx.match[1]);
    const amount = days * 1000; // Пример: 30 дней * 1000 копеек = 300 руб
    const label = `${days} дней премиум`;

    try {
      await ctx.answerCbQuery();
      await ctx.replyWithInvoice({
        title: 'Премиум-подписка',
        description: `Доступ к премиум-функциям на ${days} дней`,
        payload: `premium-${days}-days`,
        provider_token: process.env.PAYMENT_PROVIDER_TOKEN,
        currency: 'RUB',
        prices: [{ label, amount }],
        start_parameter: 'premium-subscription',
        need_name: true,
        need_email: false,
        photo_url: 'https://i.imgur.com/NbKQKDu.png',
        photo_width: 600,
        photo_height: 400
      });
    } catch (err) {
      console.error('Ошибка при создании инвойса:', err);
      ctx.reply('⚠️ Не удалось создать счёт. Попробуйте позже.');
    }
  });

  // ✅ Подтверждение оплаты от Telegram
  bot.on('pre_checkout_query', (ctx) => {
    return ctx.answerPreCheckoutQuery(true);
  });

  // 🧾 Оплата прошла успешно
  bot.on('successful_payment', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const payload = ctx.message.successful_payment.invoice_payload;
      const match = payload.match(/premium-(\d+)-days/);
      const days = match ? parseInt(match[1]) : 30;

      const { rows } = await db.query('SELECT id FROM profiles WHERE telegram_id = $1', [telegramId]);
      const profileId = rows[0]?.id;

      if (!profileId) {
        return ctx.reply('❌ Профиль не найден.');
      }

      const now = new Date();
      const newExpiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await db.query(`
        INSERT INTO premium (profile_id, expires_at)
        VALUES ($1, $2)
        ON CONFLICT (profile_id) DO UPDATE SET expires_at = $2
      `, [profileId, newExpiry]);

      await ctx.reply(`🎉 Оплата прошла успешно!\n💎 Премиум активирован до ${newExpiry.toLocaleDateString()}`);
    } catch (err) {
      console.error('Ошибка при обработке успешной оплаты:', err);
      ctx.reply('⚠️ Оплата прошла, но не удалось активировать премиум. Свяжитесь с админом.');
    }
  });
}
