import { Scenes } from 'telegraf';
import db from '../db.js';
import { premiumKeyboard } from '../keyboards/premiumKeyboards.js';
import { isPremiumActive } from '../utils/premium.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';
import { logToAdmin } from '../utils/logToAdmin.js';


const premiumScene = new Scenes.BaseScene('premiumScene');

premiumScene.enter(async (ctx) => {
  if (ctx.session?.isProcessing) return;
  ctx.session.isProcessing = true;

  try {
    const telegramId = ctx.from.id.toString();

    let user;
    try {
      const { rows } = await db.query(`
        SELECT p.id, pr.expires_at
        FROM profiles p
        LEFT JOIN premium pr ON pr.profile_id = p.id
        WHERE p.telegram_id = $1
    `, [telegramId]);

      if (rows.length === 0) {
        console.warn(`❗ Профиль не найден для telegramId: ${telegramId}`);
        await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируем вас заново!');
        ctx.session.isProcessing = false;
        return ctx.scene.enter('registrationScene');
      }
      user = rows[0];
    } catch (err) {
      console.error('[premiumScene] Ошибка при запросе профиля:', err);
      await logToAdmin(`❗ Ошибка при запросе профиля (premiumScene): ${err.message}`);
      await ctx.reply('⚠️ Не удалось загрузить премиум-статус.');
      ctx.session.isProcessing = false;
      return;
    }

    const isPremium = isPremiumActive(user);

    let premiumLabel;
    if (isPremium) {
      const formatted = new Date(user.expires_at).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      premiumLabel = `💎 *Премиум активен до:* ${escapeMarkdown(formatted)}`;
    } else {
      premiumLabel = '🧑‍💻 *Статус:* Обычный пользователь';
    }

    const infoText = '\n\n*💡 Возможности премиума:*\n' +
      '• До 6 игр в профиле (вместо 3)\n' +
      '• 🔁 Кнопка "Вернуть" в поиске\n' +
      '• 👀 Вкладка "Кого я лайкнул"\n' +
      '• 🚀 Приоритет в поиске тиммейтов\n' +
      '• 🏆 Участие в ивентах и турнирах\n';

    try {
      await ctx.replyWithMarkdown(`${premiumLabel}${infoText}`, premiumKeyboard());
    } catch (err) {
      console.error('Ошибка при отправке текста', err);
      await logToAdmin(`❗ Ошибка при отправке текста (premiumScene): ${err.message}`);
    }
  } catch (err) {
    console.error('[premiumScene] Ошибка при получении статуса:', err);
    await logToAdmin(`❗ Ошибка при получении статуса (premiumScene, верхний catch): ${err.message}`);
    try {
      await ctx.reply('⚠️ Произошла ошибка при загрузке премиум-статуса.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (premiumScene, верхний catch): ${err.message}`);
    }
  } finally {
    ctx.session.isProcessing = false;
  }
});

premiumScene.hears('💳 Оформить подписку', async (ctx) => {
  if (ctx.session?.isProcessing) return;
  ctx.session.isProcessing = true;

  try {
    try {
      await ctx.reply('🚧 Функция покупки премиума в разработке.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (premiumScene, покупка премиума): ${err.message}`);
    }
  } finally {
    ctx.session.isProcessing = false;
  }
});

// ✅ Добавлен слушатель кнопки "Связаться с админом"
premiumScene.hears('🧑‍💼 Связаться с админом', async (ctx) => {
  const adminId = process.env.ADMIN_IDS?.split(',')[0];
  if (adminId) {
    try {
      let admin;
      try {
        admin = await ctx.telegram.getChat(adminId);
      } catch (err) {
        console.error('Ошибка получения данных админа:', err);
        await logToAdmin(`❗ Ошибка получения данных админа (premiumScene): ${err.message}`);
        try {
          await ctx.reply('⚠️ Не удалось получить данные администратора.');
        } catch (sendErr) {
          console.error('Ошибка при отправке сообщения:', sendErr);
        }
        return;
      }

      if (admin.username) {
        try {
          await ctx.reply(`🧑‍💼 Связаться с администратором: https://t.me/${admin.username}`);
        } catch (err) {
          console.error('Ошибка при отправке сообщения', err);
          await logToAdmin(`❗ Ошибка при отправке сообщения (premiumScene, ответ про админа): ${err.message}`);
        }
      } else {
        try {
          await ctx.reply(`🧑‍💼 Администратор без username, ID: ${adminId}`);
        } catch (err) {
          console.error('Ошибка при отправке сообщения', err);
          await logToAdmin(`❗ Ошибка при отправке сообщения (premiumScene, ответ про админа): ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Ошибка получения данных админа:', err);
      try {
        await ctx.reply('⚠️ Не удалось получить данные администратора.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
    }
  } else {
    try {
      await ctx.reply('⚠️ Администратор не назначен.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
    }
  }
});

premiumScene.hears('⬅️ Назад', (ctx) => ctx.scene.enter('mainMenuScene'));

export default premiumScene;
