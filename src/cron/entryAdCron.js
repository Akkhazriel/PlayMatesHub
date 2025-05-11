import db from '../db.js';
import { getRandomAdByType } from '../utils/getRandomAdByType.js';
import bot from '../bot.js';
import { logAdView } from '../services/ads.service.js';

// Задержка между отправками (в миллисекундах)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Простейшее экранирование HTML для Telegram
const escapeHTML = (str = '') =>
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;');

export default async function sendEntryAd() {
  try {
    const ad = await getRandomAdByType('entry');
    if (!ad) return;

    const res = await db.query(`
      SELECT u.telegram_id
      FROM users u
      JOIN profiles p ON u.telegram_id = p.telegram_id
      WHERE p.is_banned = false
    `);

    const rawText = escapeHTML(ad.content || '');
    const text = rawText.length > 3900 ? rawText.slice(0, 3900) + '…' : rawText;

    for (const user of res.rows) {
      try {
        if (ad.media && ['photo', 'video', 'animation'].includes(ad.media.type)) {
          await bot.telegram.sendMediaGroup(user.telegram_id, [{
            type: ad.media.type,
            media: ad.media.file_id,
            caption: text,
            parse_mode: 'HTML',
          }]);
        } else {
          await bot.telegram.sendMessage(user.telegram_id, text, {
            parse_mode: 'HTML',
            reply_markup: ad.link
              ? { inline_keyboard: [[{ text: 'Подробнее', url: ad.link }]] }
              : undefined
          });
        }

        await logAdView(user.telegram_id, ad.id, 'entry');
      } catch (err) {
        if (err.response?.error_code === 403) {
          console.warn(`⛔ Пользователь ${user.telegram_id} заблокировал бота`);
        } else {
          console.error(`Ошибка отправки рекламы пользователю ${user.telegram_id}:`, err.message);
        }
      }

      await delay(40); // ограничение по Telegram rate-limit
    }

    console.log('[entryAdCron] Реклама отправлена пользователям');
  } catch (err) {
    console.error('[entryAdCron] Ошибка при рассылке entry рекламы:', err);
  }
}
