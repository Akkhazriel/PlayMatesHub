import { Markup } from 'telegraf';
import db from '../db.js';
import mainMenuKeyboard from '../keyboards/mainMenu.js';
import { getRandomAdByType } from '../utils/getRandomAdByType.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js'; // если есть

const startKeyboard = Markup.keyboard([
  ['🐾 Войти', 'ℹ️ О Боте'],
]).resize();

export default async function handleStart(ctx) {
  const telegramId = ctx.from?.id?.toString();

  if (!telegramId || !ctx.chat || ctx.chat.type !== 'private') {
    return ctx.reply('⚠️ Команда /start работает только в приватном чате.');
  }

  const chatId = ctx.chat.id;

  try {
    // 🔸 Реклама
    const ad = await getRandomAdByType('entry');
    if (ad) {
      try {
        const opts = {
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        };

        const adText = `📢 *Реклама:*\n${escapeMarkdown(ad.content)}`;
        if (ad.link) {
          opts.reply_markup = {
            inline_keyboard: [[{ text: 'Перейти', url: ad.link }]]
          };
        }

        if (ad.media) {
          const method = ad.media.includes('photo') ? 'sendPhoto'
                      : ad.media.includes('video') ? 'sendVideo'
                      : 'sendAnimation';
          await ctx.telegram[method](chatId, ad.media, {
            caption: adText,
            ...opts
          });
        } else {
          await ctx.reply(adText, opts);
        }
      } catch (err) {
        console.error('Ошибка при отправке рекламы:', err.message);
      }
    }

    // 🔸 Проверка регистрации
    const res = await db.query(`
      SELECT telegram_id
      FROM users
      WHERE telegram_id = $1
    `, [telegramId]);

    if (res.rowCount > 0) {
      await ctx.reply(
        `👋 Добро пожаловать обратно, ${escapeMarkdown(ctx.from.first_name)}!`,
        { ...mainMenuKeyboard(ctx.session?.isAdmin), parse_mode: 'Markdown' }
      );
      return ctx.scene.enter('mainMenuScene');
    } else {
      await ctx.replyWithMarkdown(
        `👋 *Добро пожаловать!*\n\n`,
        startKeyboard
      );
    }
  } catch (error) {
    console.error('Ошибка обработки команды /start:', error);
    await ctx.reply('⚠️ Произошла ошибка на сервере. Попробуйте позже.');
  }
}
