import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import formatTavernCard from '../utils/formatTavernCard.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { logToAdmin } from '../utils/logToAdmin.js';


const likedToScene = new Scenes.WizardScene('likedToScene',

  // 🔹 Шаг 0: загрузка лайков
  async (ctx) => {
    if (ctx.session?.isProcessing) return;
    ctx.session.isProcessing = true;

    if (!ctx.session.profileId) {
      await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируем вас заново!');
      ctx.session.isProcessing = false;
      return ctx.scene.enter('registrationScene');
    }

    try {
      console.log('[likedToScene] Загружаю лайки для профиля:', ctx.session.profileId);

      let likes = [];
      try {
        const result = await db.query(`
      SELECT
        l.id AS like_id,
        p.id,
        p.name,
        p.age,
        p.bio,
        p.gender,
        p.steam_id,
        u.telegram_id,
        ARRAY_AGG(DISTINCT g.name || COALESCE(' (' || r.name || ')', '')) AS games
      FROM likes l
      JOIN profiles p ON p.id = l.to_profile_id
      JOIN users u ON u.telegram_id = p.telegram_id
      LEFT JOIN profile_games pg ON pg.profile_id = p.id
      LEFT JOIN games g ON g.id = pg.game_id
      LEFT JOIN ranks r ON r.id = pg.rank_id
      LEFT JOIN matches m ON (
        (m.user1_profile_id = l.from_profile_id AND m.user2_profile_id = l.to_profile_id)
        OR (m.user2_profile_id = l.from_profile_id AND m.user1_profile_id = l.to_profile_id)
      )
      WHERE l.from_profile_id = $1
        AND m.id IS NULL
        AND p.is_banned = false
      GROUP BY l.id, p.id, u.telegram_id
      ORDER BY l.id DESC
    `, [ctx.session.profileId]);
        likes = result.rows;

        console.log('[likedToScene] Лайков найдено:', likes.length);
        console.dir(likes, { depth: null });
      } catch (err) {
        console.error('[likedToScene] Ошибка при загрузке лайков:', err);
        await logToAdmin(`❗ Ошибка при загрузке лайков (likedToScene): ${err.message}`);
        await ctx.reply('⚠️ Не удалось загрузить ваши лайки.');
        return ctx.scene.enter('mainMenuScene');
      }

      if (likes.length === 0) {
        try {
          await ctx.reply('❌ Вы ещё никого не лайкнули или с ними уже есть мэтчи.');
        } catch (err) {
          console.error('Ошибка при отправке сообщения', err);
          await logToAdmin(`❗ Ошибка при отправке сообщения (likedToScene, нет лайков): ${err.message}`);
        }
        return ctx.scene.enter('mainMenuScene');
      }

      ctx.wizard.state.likes = likes;
      ctx.wizard.state.index = 0;

      return await showCurrentLike(ctx, true); // первый показ
    } catch (error) {
      console.error('[likedToScene] Ошибка при входе:', error);
      await logToAdmin(`❗ Ошибка при входе (likedToScene): ${error.message}`);
      try {
        await ctx.reply('⚠️ Ошибка загрузки лайков.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (likedToScene, верхний catch): ${err.message}`);
      }
      return ctx.scene.enter('mainMenuScene');
    } finally {
      ctx.session.isProcessing = false;
    }
  },

  // 🔹 Шаг 1: ожидание действий
  async (ctx) => {
    return; // обработка через action
  }
);

async function showCurrentLike(ctx, initial = false) {
  const { likes, index } = ctx.wizard.state;
  const user = likes[index];

  // Защита от undefined
  user.games = user.games?.filter(Boolean) || [];

  // Должно быть:
  let steamGames = [];
  if (user.steam_id) {
    try {
      const { rows } = await db.query('SELECT appid, game_name, playtime_hours FROM steam_stats WHERE steam_id = $1', [user.steam_id]);
      steamGames = rows.map(row => ({
        appid: row.appid,
        game_name: row.game_name,
        playtime_hours: row.playtime_hours
      }));
    } catch (err) {
      console.error(`Ошибка при загрузке Steam-игр для steam_id: ${user.steam_id}`, err);
      await logToAdmin(`❗ Ошибка при загрузке Steam-игр (likedToScene, steam_id: ${user.steam_id}): ${err.message}`);
      steamGames = [];
    }
  }


  const text = formatTavernCard({ ...user }, { isOwner: false, steamGames });

  // Кнопки
  const buttons = [
    [Markup.button.callback('💔 Удалить лайк', `unlike_${user.id}`)],
    [Markup.button.callback('➡️ Далее', 'next')],
    [Markup.button.callback('⬅️ Назад в профиль', 'back_to_profile')]
  ];

  const markup = Markup.inlineKeyboard(buttons);

  // Первая отправка — reply
  if (initial) {
    try {
      return ctx.replyWithMarkdown(text, markup);
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (likedToScene, replyWithMarkdown): ${err.message}`);
    }
  }

  // Повторная отправка — редактирование

  if (ctx.session?.isProcessing) return;
  ctx.session.isProcessing = true;
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...markup
    });
  } catch (err) {
    console.warn('[likedToScene] editMessageText fallback to reply:', err.message);
    await ctx.replyWithMarkdown(text, markup);
  } finally {
    ctx.session.isProcessing = false;
  }
}

// 🔘 Удалить лайк
likedToScene.action(/^unlike_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const userId = parseInt(ctx.match[1]);
  try {
    await db.query('DELETE FROM likes WHERE from_profile_id = $1 AND to_profile_id = $2', [
      ctx.session.profileId,
      userId
    ]);
  } catch (err) {
    console.error(`Ошибка при удалении лайка (profileId: ${ctx.session.profileId}, toProfileId: ${userId}):`, err);
    await logToAdmin(`❗ Ошибка при удалении лайка (likedToScene, profileId: ${ctx.session.profileId}, toProfileId: ${userId}): ${err.message}`);
    await ctx.reply('⚠️ Не удалось удалить лайк. Попробуйте позже.');
    return ctx.scene.enter('mainMenuScene');
  }


  ctx.wizard.state.likes.splice(ctx.wizard.state.index, 1);

  if (ctx.wizard.state.likes.length === 0) {
    try {
      await ctx.reply('📭 Больше нет лайков.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (likedToScene, после удаления лайка): ${err.message}`);
    }
    return ctx.scene.enter('mainMenuScene');
  }

  if (ctx.wizard.state.index >= ctx.wizard.state.likes.length) {
    ctx.wizard.state.index = 0;
  }

  return showCurrentLike(ctx);
});

// 🔘 Следующий лайк
likedToScene.action('next', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  ctx.wizard.state.index++;
  if (ctx.wizard.state.index >= ctx.wizard.state.likes.length) {
    ctx.wizard.state.index = 0;
  }

  return showCurrentLike(ctx);
});

// 🔘 Назад в профиль
likedToScene.action('back_to_profile', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  return ctx.scene.enter('profileScene');
});

export default likedToScene;
