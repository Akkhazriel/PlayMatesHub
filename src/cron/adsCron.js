import cron from 'node-cron';
import db from '../db.js';
import { getRandomAdByType } from '../utils/getRandomAdByType.js';
import bot from '../bot.js';
import { logAdView } from '../services/ads.service.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js'; // убедись, что такой модуль есть

// вспомогательная задержка между отправками
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

cron.schedule('0 * * * *', async () => {
  try {
    const ad = await getRandomAdByType('interval');
    if (!ad) return;

    const usersRes = await db.query(`
      SELECT telegram_id FROM users u
      JOIN profiles p ON u.telegram_id = p.telegram_id
      WHERE p.is_banned = false
    `);

    for (const user of usersRes.rows) {
      const chatId = user.telegram_id;
      const opts = {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      };

      const content = escapeMarkdown(ad.content || '');
      const adText = `📢 *Реклама:*\n${content.length > 3900 ? content.slice(0, 3900) + '…' : content}`;

      if (ad.link) {
        opts.reply_markup = {
          inline_keyboard: [[{ text: 'Перейти', url: ad.link }]]
        };
      }

      try {
        if (ad.media) {
          const method = ad.media.includes('photo') ? 'sendPhoto'
                      : ad.media.includes('video') ? 'sendVideo'
                      : 'sendAnimation';
          await bot.telegram[method](chatId, ad.media, {
            caption: adText,
            ...opts
          });
        } else {
          await bot.telegram.sendMessage(chatId, adText, opts);
        }

        await logAdView(chatId, ad.id, 'interval');
      } catch (err) {
        if (err.response?.error_code === 403) {
          console.warn(`⛔ Пользователь ${chatId} заблокировал бота`);
        } else {
          console.error(`❌ Ошибка при отправке рекламы пользователю ${chatId}:`, err.message);
        }
      }

      await delay(40); // 25–30 сообщений в секунду допустимо, 40мс — безопасно
    }

    console.log(`✅ Рассылка рекламы "interval" завершена для ${usersRes.rowCount} пользователей`);
  } catch (err) {
    console.error('❌ Ошибка cron-рекламы:', err.message);
  }
});
