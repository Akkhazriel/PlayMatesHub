import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import formatTavernCard from '../utils/formatTavernCard.js';
import { logToAdmin } from '../utils/logToAdmin.js';

function goToProfileScene(ctx) {
  return ctx.scene.enter('profileScene');
}

const likedByScene = new Scenes.WizardScene(
  'likedByScene',

  async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      let profileId;
      try {
        const { rows: profileRes } = await db.query(
          'SELECT id FROM profiles WHERE telegram_id = $1',
          [telegramId]
        );
        if (profileRes.length === 0) {
          await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируем вас заново!');
          return ctx.scene.enter('registrationScene');
        }
        profileId = profileRes[0].id;
      } catch (err) {
        console.error('Ошибка при запросе профиля:', err);
        await logToAdmin(`❗ Ошибка при запросе профиля (likedByScene): ${err.message}`);
        await ctx.reply('⚠️ Не удалось загрузить профиль.');
        return goToProfileScene(ctx);
      }

      if (!profileId) {
        try {
          await ctx.reply('❌ Профиль не найден.');
        } catch (err) {
          console.error('Ошибка при отправке сообщения', err);
        }
        return goToProfileScene(ctx);
      }

      let likes = [];
      try {
        const { rows } = await db.query(
          `
          SELECT l.id AS like_id, p.id, p.name, p.age, p.gender, p.bio, p.steam_id, u.username, pr.expires_at,
                ARRAY_AGG(g.name || ' — ' || COALESCE(r.name, 'Без ранга')) AS games,
                p.id AS from_profile_id
          FROM likes l
          JOIN profiles p ON p.id = l.from_profile_id
          JOIN users u ON u.telegram_id = p.telegram_id
          LEFT JOIN profile_games pg ON pg.profile_id = p.id
          LEFT JOIN games g ON g.id = pg.game_id
          LEFT JOIN ranks r ON r.id = pg.rank_id
          LEFT JOIN premium pr ON pr.profile_id = p.id
          WHERE l.to_profile_id = $1
            AND l.created_at >= NOW() - INTERVAL '2 days'
            AND NOT EXISTS (
              SELECT 1 FROM matches m
              WHERE (m.user1_profile_id = $1 AND m.user2_profile_id = p.id)
                OR (m.user2_profile_id = $1 AND m.user1_profile_id = p.id)
            )
            AND p.is_banned = false
          GROUP BY 
            l.id,
            l.created_at,
            p.id,
            p.name,
            p.age,
            p.gender,
            p.bio,
            u.username,
            pr.expires_at
          ORDER BY l.created_at DESC
          `,
          [profileId]
        );
        likes = rows;
      } catch (err) {
        console.error('Ошибка при загрузке лайков:', err);
        await logToAdmin(`❗ Ошибка при загрузке лайков (likedByScene): ${err.message}`);
        await ctx.reply('⚠️ Не удалось загрузить список лайков.');
        return goToProfileScene(ctx);
      }

      for (const like of likes) {
        like.is_premium = like.expires_at && new Date(like.expires_at) > new Date();
      }

      if (!likes.length) {
        try {
          await ctx.reply('😕 Никто пока не лайкнул ваш профиль.');
        } catch (err) {
          console.error('Ошибка при отправке сообщения', err);
        }
        return goToProfileScene(ctx);
      }

      ctx.wizard.state.likes = likes;
      ctx.wizard.state.index = 0;
      ctx.wizard.state.myProfileId = profileId;

      return showLike(ctx);
    } catch (err) {
      console.error('Ошибка загрузки лайков:', err);
      await logToAdmin(`❗ Ошибка загрузки лайков (likedByScene, верхний catch): ${err.message}`);
      try {
        await ctx.reply('⚠️ Не удалось загрузить список лайков.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
      return goToProfileScene(ctx);
    }
  }
);

likedByScene.action('next_like', async (ctx) => {
  try {
    if (isCallbackHandled?.(ctx)) return;
    await ctx.answerCbQuery();
    ctx.wizard.state.index++;
    return showLike(ctx);
  } catch (err) {
    console.error('Ошибка при переходе к следующему лайку:', err);
    await logToAdmin(`❗ Ошибка при переходе к следующему лайку (likedByScene): ${err.message}`);
    return goToProfileScene(ctx);
  }
});

likedByScene.action(/^like_back_(\d+)$/, async (ctx) => {
  try {
    if (isCallbackHandled?.(ctx)) return;
    const targetProfileId = parseInt(ctx.match[1]);
    const myId = ctx.wizard.state.myProfileId;

    try {
      await db.query(
        'INSERT INTO likes (from_profile_id, to_profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [myId, targetProfileId]
      );
    } catch (err) {
      console.error('Ошибка при вставке лайка в ответ:', err);
      await logToAdmin(`❗ Ошибка при вставке лайка в ответ (likedByScene): ${err.message}`);
      await ctx.reply('⚠️ Не удалось отправить лайк.');
      return goToProfileScene(ctx);
    }


    let matchExists = [];
    try {
      const { rows } = await db.query(
        'SELECT 1 FROM likes WHERE from_profile_id = $2 AND to_profile_id = $1',
        [myId, targetProfileId]
      );
      matchExists = rows;
    } catch (err) {
      console.error('Ошибка при проверке мэтча:', err);
      await logToAdmin(`❗ Ошибка при проверке мэтча (likedByScene): ${err.message}`);
      await ctx.reply('⚠️ Не удалось проверить мэтч.');
      return goToProfileScene(ctx);
    }


    if (matchExists.length) {
      try {
        await db.query(
          `INSERT INTO matches (user1_profile_id, user2_profile_id)
          SELECT $1, $2
          WHERE NOT EXISTS (
            SELECT 1 FROM matches WHERE
            (user1_profile_id = $1 AND user2_profile_id = $2)
            OR (user1_profile_id = $2 AND user2_profile_id = $1)
          )`, [myId, targetProfileId]
        );
      } catch (err) {
        console.error('Ошибка при создании мэтча:', err);
        await logToAdmin(`❗ Ошибка при создании мэтча (likedByScene): ${err.message}`);
        await ctx.reply('⚠️ Не удалось создать мэтч.');
        return goToProfileScene(ctx);
      }
      try {
        await db.query(`
          DELETE FROM likes
          WHERE (from_profile_id = $1 AND to_profile_id = $2)
            OR (from_profile_id = $2 AND to_profile_id = $1)
        `, [myId, targetProfileId]);
      } catch (err) {
        console.error('Ошибка при удалении лайков после мэтча:', err);
        await logToAdmin(`❗ Ошибка при удалении лайков после мэтча (likedByScene): ${err.message}`);
      }

      try {
        await ctx.reply('🎉 У вас новый мэтч! Вы можете связаться с пользователем.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }

      // Получаем Telegram ID пользователя, которого лайкнули
      let telegramId;
      try {
        const res = await db.query(`
          SELECT u.telegram_id
          FROM users u
          JOIN profiles p ON p.telegram_id = u.telegram_id
          WHERE p.id = $1
        `, [targetProfileId]);

        telegramId = res.rows[0]?.telegram_id;
      } catch (err) {
        console.error('Ошибка при получении Telegram ID:', err);
        await logToAdmin(`❗ Ошибка при получении Telegram ID (likedByScene): ${err.message}`);
        telegramId = undefined;
      }

      try {
        if (telegramId) {
          try {
            await ctx.telegram.sendMessage(
              telegramId,
              `🎉 У вас новый мэтч! Вы можете связаться с пользователем.`
            );
          } catch (err) {
            if (err.response?.error_code === 403) {
              console.warn(`Пользователь ${telegramId} заблокировал бота.`);
            } else {
              console.error('Ошибка отправки сообщения:', err);
              await logToAdmin(`❗ Ошибка отправки сообщения (likedByScene, мэтч): ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.error('Ошибка отправки сообщения при мэтче:', err);
        await logToAdmin(`❗ Ошибка отправки сообщения при мэтче (likedByScene): ${err.message}`);
      }
    } else {
      try {
        await ctx.reply('❤️ Лайк отправлен! Если пользователь лайкнёт вас в ответ — будет мэтч.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
    }

    ctx.wizard.state.likes = ctx.wizard.state.likes.filter(l => l.from_profile_id !== targetProfileId);
    ctx.wizard.state.index = 0;
    await ctx.editMessageReplyMarkup(null);

    if (!ctx.wizard.state.likes.length) {
      try {
        await ctx.reply('Больше нет входящих лайков.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
      return goToProfileScene(ctx);
    }

    return showLike(ctx);
  } catch (err) {
    console.error('Ошибка при лайке в ответ:', err);
    try {
      await ctx.reply('⚠️ Не удалось обработать лайк.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
    }
    return goToProfileScene(ctx);
  }
});

likedByScene.action(/^skip_like_(\d+)$/, async (ctx) => {
  try {
    if (isCallbackHandled?.(ctx)) return;
    const likeId = parseInt(ctx.match[1]);
    try {
      await db.query('DELETE FROM likes WHERE id = $1', [likeId]);
    } catch (err) {
      console.error(`Ошибка при удалении лайка (id: ${likeId}):`, err);
      await logToAdmin(`❗ Ошибка при удалении лайка (likedByScene, id: ${likeId}): ${err.message}`);
      await ctx.reply('⚠️ Не удалось удалить лайк.');
      return goToProfileScene(ctx);
    }

    await ctx.answerCbQuery('⏭ Пропущено');
    await ctx.editMessageReplyMarkup(null);

    ctx.wizard.state.likes = ctx.wizard.state.likes.filter(l => l.like_id !== likeId);
    ctx.wizard.state.index = 0;

    await db.query(`
      DELETE FROM likes
      WHERE id = $1
         OR (from_profile_id = $2 AND to_profile_id = (
           SELECT from_profile_id FROM likes WHERE id = $1
         ))
    `, [likeId, ctx.wizard.state.myProfileId]);

    if (!ctx.wizard.state.likes.length) {
      try {
        await ctx.reply('Больше нет входящих лайков.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
      return goToProfileScene(ctx);
    }

    return showLike(ctx);
  } catch (err) {
    console.error('Ошибка при пропуске лайка:', err);
    await logToAdmin(`❗ Ошибка при пропуске лайка (likedByScene): ${err.message}`);
    return goToProfileScene(ctx);
  }
});

likedByScene.action('exit_likes', async (ctx) => {
  try {
    if (isCallbackHandled?.(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(null);
    return goToProfileScene(ctx);
  } catch (err) {
    console.error('Ошибка при выходе из лайков:', err);
    await logToAdmin(`❗ Ошибка при выходе из лайков (likedByScene): ${err.message}`);
    return goToProfileScene(ctx);
  }
});

async function showLike(ctx, initial = false) {
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
      await logToAdmin(`❗ Ошибка при загрузке Steam-игр (likedByScene, steam_id: ${user.steam_id}): ${err.message}`);
      steamGames = [];
    }
  }


  // 🔥 Фикс для премиума
  user.is_premium = user.expires_at && new Date(user.expires_at) > new Date();

  const text = formatTavernCard({ ...user }, { isOwner: false, steamGames });

  // Кнопки
  const buttons = [
    [
      Markup.button.callback('❤️ Лайк в ответ', `like_back_${user.from_profile_id}`),
      Markup.button.callback('💔 Пропустить', `skip_like_${user.like_id}`)
    ],
    [Markup.button.callback('⬅️ Назад в профиль', 'exit_likes')]
  ];

  const markup = Markup.inlineKeyboard(buttons);

  if (initial) {
    try {
      return ctx.replyWithMarkdown(text, markup);
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (likedByScene, showLike): ${err.message}`);
    }
  }

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

export default likedByScene;