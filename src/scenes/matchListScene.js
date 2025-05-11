import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import formatTavernCard from '../utils/formatTavernCard.js';
import { logToAdmin } from '../utils/logToAdmin.js';

function goToProfileScene(ctx) {
  return ctx.scene.enter('profileScene');
}

const matchListScene = new Scenes.WizardScene('matchListScene',

  async (ctx) => {
    if (ctx.session?.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      const telegramId = ctx.from.id.toString();
      let profileId;
      try {
        const profileRes = await db.query(
          'SELECT id FROM profiles WHERE telegram_id = $1',
          [telegramId]
        );
        if (profileRes.rows.length === 0) {
          console.warn(`❗ Профиль не найден для telegramId: ${telegramId}`);
          await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируем вас заново!');
          return ctx.scene.enter('registrationScene');
        }
        profileId = profileRes.rows[0].id;
      } catch (err) {
        console.error('Ошибка при запросе профиля:', err);
        await logToAdmin(`❗ Ошибка при запросе профиля (matchListScene): ${err.message}`);
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

      let matches = [];
      try {
        const { rows } = await db.query(`
          SELECT 
            m.id AS match_id, 
            m.matched_at, 
            p.name, 
            p.age, 
            p.gender, 
            p.bio, 
            p.steam_id, 
            u.username,
            pr.expires_at,
            ARRAY_AGG(g.name || ' — ' || COALESCE(r.name, 'Без ранга')) AS games
          FROM matches m
          JOIN profiles p ON p.id = CASE WHEN m.user1_profile_id = $1 THEN m.user2_profile_id ELSE m.user1_profile_id END
          JOIN users u ON u.telegram_id = p.telegram_id
          LEFT JOIN profile_games pg ON pg.profile_id = p.id
          LEFT JOIN games g ON g.id = pg.game_id
          LEFT JOIN ranks r ON r.id = pg.rank_id
          LEFT JOIN premium pr ON pr.profile_id = p.id 
          WHERE (m.user1_profile_id = $1 OR m.user2_profile_id = $1)
            AND m.matched_at >= NOW() - INTERVAL '14 days'
          GROUP BY m.id, p.name, p.age, p.gender, p.bio, p.steam_id, u.username, pr.expires_at, m.matched_at
          ORDER BY m.matched_at DESC
        `, [profileId]);
        matches = rows;
      } catch (err) {
        if (!matches.length) {
          try {
            await ctx.reply('😕 У вас пока нет мэтчей. Попробуйте позже.');
          } catch (err) {
            console.error('Ошибка при отправке сообщения', err);
            await logToAdmin(`❗ Ошибка при отправке сообщения (matchListScene, profileId не найден): ${err.message}`);
          }
          return goToProfileScene(ctx);
        }
      }

      ctx.wizard.state.matches = matches;
      ctx.wizard.state.index = 0;

      return showMatch(ctx);
    } catch (err) {
      console.error('Ошибка загрузки мэтчей:', err);
      await logToAdmin(`❗ Ошибка загрузки мэтчей (matchListScene, верхний catch): ${err.message}`);
      try {
        await ctx.reply('⚠️ Не удалось загрузить мэтчи.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (matchListScene, верхний catch): ${err.message}`);
      }
      return goToProfileScene(ctx);
    } finally {
      ctx.session.isProcessing = false;
    }
  }
);

// === Инлайн-обработчики ===

matchListScene.action('next_match', async (ctx) => {
  if (ctx.session?.isProcessing) return;
  ctx.session.isProcessing = true;
  try {
    if (isCallbackHandled?.(ctx)) return;
    await ctx.answerCbQuery();

    ctx.wizard.state.index++;
    if (ctx.wizard.state.index >= ctx.wizard.state.matches.length) {
      ctx.wizard.state.index = 0;
      try {
        await ctx.reply('🔁 Вы просмотрели все мэтчи. Возвращаюсь к первому.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
    }

    return showMatch(ctx);
  } catch (err) {
    console.error('Ошибка при next_match:', err);
    await logToAdmin(`❗ Ошибка при next_match (matchListScene): ${err.message}`);
    return goToProfileScene(ctx);
  } finally {
    ctx.session.isProcessing = false;
  }
});

matchListScene.action(/^delete_match_(\d+)$/, async (ctx) => {
  if (ctx.session?.isProcessing) return;
  ctx.session.isProcessing = true;
  try {
    if (isCallbackHandled?.(ctx)) return;
    await ctx.answerCbQuery();
    const matchId = parseInt(ctx.match[1]);

    try {
      await db.query('DELETE FROM matches WHERE id = $1', [matchId]);
    } catch (err) {
      console.error(`Ошибка при удалении мэтча (id: ${matchId}):`, err);
      await logToAdmin(`❗ Ошибка при удалении мэтча (matchListScene, id: ${matchId}): ${err.message}`);
      await ctx.reply('⚠️ Не удалось удалить мэтч.');
      return goToProfileScene(ctx);
    }

    await ctx.editMessageReplyMarkup(null);
    try {
      await ctx.reply('🗑 Мэтч удалён.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (matchListScene, удаление мэтча): ${err.message}`);
    }

    ctx.wizard.state.matches = ctx.wizard.state.matches.filter(m => m.match_id !== matchId);
    ctx.wizard.state.index = 0;

    if (!ctx.wizard.state.matches.length) {
      try {
        await ctx.reply('😕 У вас больше нет мэтчей.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
      }
      return goToProfileScene(ctx);
    }

    return showMatch(ctx);
  } catch (err) {
    console.error('Ошибка при удалении мэтча:', err);
    try {
      await ctx.reply('⚠️ Не удалось удалить мэтч.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
    }
    return goToProfileScene(ctx);
  } finally {
    ctx.session.isProcessing = false;
  }
});

matchListScene.action('exit_matches', async (ctx) => {
  if (ctx.session?.isProcessing) return;
  ctx.session.isProcessing = true;
  try {
    if (isCallbackHandled?.(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(null);
    return goToProfileScene(ctx);
  } catch (err) {
    console.error('Ошибка при выходе из matchListScene:', err);
    await logToAdmin(`❗ Ошибка при выходе из matchListScene: ${err.message}`);
    return goToProfileScene(ctx);
  } finally {
    ctx.session.isProcessing = false;
  }
});

// === Функция отображения мэтча ===

async function showMatch(ctx) {
  const match = ctx.wizard.state.matches?.[ctx.wizard.state.index];
  if (!match) {
    try {
      await ctx.reply('🙁 Больше нет мэтчей.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
    }
    return goToProfileScene(ctx);
  }

  // Должно быть:
  let steamGames = [];
  if (match.steam_id) {
    try {
      const { rows } = await db.query('SELECT appid, playtime_hours FROM steam_stats WHERE steam_id = $1', [match.steam_id]);
      steamGames = rows.map(row => ({
        appid: row.appid,
        name: row.name,
        playtime_forever: row.playtime_hours * 60
      }));
    } catch (err) {
      console.error(`Ошибка при запросе Steam-игр для steam_id: ${match.steam_id}`, err);
      await logToAdmin(`❗ Ошибка при запросе Steam-игр (matchListScene, steam_id: ${match.steam_id}): ${err.message}`);
      steamGames = [];
    }
  }

  match.is_premium = match.expires_at && new Date(match.expires_at) > new Date();

  const text = formatTavernCard({ ...match }, {
    isOwner: false,
    premiumUntil: match.expires_at || null,
    showContacts: true,
    steamGames
  });

  try {
    await ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Следующий', 'next_match')],
      [Markup.button.callback('❌ Удалить мэтч', `delete_match_${match.match_id}`)],
      [Markup.button.callback('⬅️ Назад', 'exit_matches')]
    ]));
  } catch (err) {
    console.error('Ошибка при отправке клавиатуры', err);
  }

}

export default matchListScene;