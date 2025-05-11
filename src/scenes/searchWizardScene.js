import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { loadCandidates, logSearch } from '../services/match.service.js';
import getRandomAdByType from '../utils/getRandomAdByType.js';
import { renderCandidateCard } from '../utils/renderCandidateCard.js';

import { isPremiumActive } from '../utils/premium.js';
import { logAdView } from '../services/ads.service.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';
import { logToAdmin } from '../utils/logToAdmin.js';

async function handleSearchAd(ctx) {
  const ad = await getRandomAdByType('search');
  if (ad) {
    try {
      await logAdView(ctx.from.id, ad.id, 'search');
    } catch (err) {
      console.error('❗ Ошибка при логировании показа рекламы:', err.message);
      await logToAdmin(`❗ Ошибка рекламы (searchWizardScene): ${err.message}`);
    }
  }
}

const searchWizardScene = new Scenes.WizardScene('searchWizardScene',

  // Шаг 0: выбор игры
  async (ctx) => {
    try {
      await handleSearchAd(ctx);
    } catch (err) {
      console.error('❗ Ошибка при обработке рекламы в шаге 0:', err.message);
      await logToAdmin(`❗ Ошибка при обработке рекламы в шаге 0: ${err.message}`);
    }

    const res = await db.query(`
      SELECT id, is_banned
      FROM profiles
      WHERE telegram_id = $1
    `, [ctx.from.id]);

    const profile = res.rows[0];

    if (!profile) {
      await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируем вас заново!');
      return ctx.scene.enter('registrationScene');
    }

    ctx.wizard.state.profileId = profile.id;
    ctx.wizard.state.isBanned = profile.is_banned;

    try {
      const telegramId = ctx.from.id.toString();

      const res = await db.query(`
        SELECT p.id, pr.expires_at, g.id AS game_id, g.name, g.has_rank
        FROM profiles p
        LEFT JOIN premium pr ON pr.profile_id = p.id
        JOIN profile_games pg ON pg.profile_id = p.id
        JOIN games g ON pg.game_id = g.id
        WHERE p.telegram_id = $1
    `, [telegramId]);

      const games = res.rows;

      if (games.length === 0) {
        await ctx.reply('⚠️ У вас не выбрано ни одной игры. Добавьте их в профиле.');
        return ctx.scene.leave();
      }

      const profileId = games[0].id;
      const isPremium = isPremiumActive(games[0]);

      ctx.wizard.state.profileId = profileId;
      ctx.wizard.state.isPremium = isPremium;

      const limit = isPremium ? 6 : 3;
      const uniqueGames = [...new Map(games.map(g => [g.game_id, g])).values()];

      if (uniqueGames.length > limit) {
        await ctx.reply(`⚠️ Вы превысили лимит выбранных игр (${limit}). Удалите лишние в профиле.`);
        return ctx.scene.enter('mainMenuScene');
      }

      ctx.wizard.state.userGames = uniqueGames;

      const buttons = uniqueGames.map(g => [
        Markup.button.callback(escapeMarkdown(g.name), `search_game_${g.game_id}`)
      ]);

      buttons.push([Markup.button.callback('⛔ Выйти', 'search_exit')]);

      await ctx.reply('🎮 Выберите игру для поиска тиммейтов:', Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('Ошибка загрузки игр:', err);
      await logToAdmin(`❗ Ошибка загрузки игр: ${err.message}`);
      try {
        await ctx.reply('⚠️ Произошла ошибка при загрузке игр. Попробуйте позже.');
      } catch (sendErr) {
        if (sendErr.code === 403) {
          console.warn(`[WARN] Пользователь ${ctx.from.id} заблокировал бота.`);
        } else {
          console.error(`[ERROR] Ошибка отправки сообщения при загрузке игр:`, sendErr);
          await logToAdmin(`❗ Ошибка отправки сообщения при загрузке игр: ${sendErr.message}`);
        }
      }
      return ctx.scene.leave();
    }
  },

  async () => {
    await ctx.reply('Выберите игру из списка выше.');
  }
);

// ACTIONS

searchWizardScene.action(/^search_game_(\d+)$/, async (ctx) => {
  if (ctx.session.isProcessing) return ctx.answerCbQuery('⏳ Подождите...');
  ctx.session.isProcessing = true;
  if (isCallbackHandled(ctx)) return;

  try {
    await ctx.editMessageReplyMarkup(null);

    const gameId = parseInt(ctx.match[1]);
    const selectedGame = ctx.wizard.state.userGames.find(g => g.game_id === gameId);

    if (!selectedGame) {
      return ctx.answerCbQuery('❌ Игра не найдена');
    }

    ctx.wizard.state.selectedGame = selectedGame;
    ctx.wizard.state.index = 0;
    ctx.wizard.state.undoStack = [];

    // Получаем возраст и ранг
    const res = await db.query(`
      SELECT p.age, pg.rank_id
      FROM profiles p
      JOIN profile_games pg ON pg.profile_id = $1 AND pg.game_id = $2
      WHERE p.id = $1
    `, [ctx.wizard.state.profileId, gameId]);

    const { age, rank_id: ownRank } = res.rows[0];
    const ageMin = age - 3;
    const ageMax = age + 3;

    const excludedRes = await db.query(`
      SELECT to_profile_id FROM likes WHERE from_profile_id = $1
    `, [ctx.wizard.state.profileId]);


    const excludedIds = excludedRes.rows.map(r => r.to_profile_id);

    ctx.wizard.state.candidates = await loadCandidates(
      ctx.wizard.state.profileId,
      gameId,
      ownRank,
      ageMin,
      ageMax,
      excludedIds,
      selectedGame.has_rank
    );

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    shuffle(ctx.wizard.state.candidates);
    ctx.wizard.state.index = 0;

    await ctx.answerCbQuery();
    await ctx.editMessageText(`🔍 Ищем тиммейтов для: ${selectedGame.name}`);
    return showNextCandidate(ctx);
  } finally {
    ctx.session.isProcessing = false;
  }
});


searchWizardScene.action('search_like', async (ctx) => {
  if (ctx.session.isProcessing) return ctx.answerCbQuery();
  ctx.session.isProcessing = true;
  if (isCallbackHandled(ctx)) return;

  try {
    const { profileId, currentCandidate } = ctx.wizard.state;
    if (ctx.wizard.state.isBanned) {
      // Просто сохраняем лайк, но не проверяем ответный лайк, не создаём мэтч
      await matchService.fakeLikeOnly(ctx.wizard.state.profileId, currentCandidate.id);
      await ctx.answerCbQuery('❤️ Лайк отправлен');
      return showNextCandidate(ctx);
    }

    await db.query(`
      INSERT INTO likes (from_profile_id, to_profile_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [profileId, currentCandidate.id]);

    const mutual = await db.query(`
      SELECT 1 FROM likes WHERE from_profile_id = $1 AND to_profile_id = $2
    `, [currentCandidate.id, profileId]);

    if (mutual.rowCount > 0 && !currentCandidate.is_banned) {
      await db.query(`
        INSERT INTO matches (user1_profile_id, user2_profile_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [profileId, currentCandidate.id]);
      // Удаляем взаимные лайки после мэтча
      await db.query(`
        DELETE FROM likes
        WHERE (from_profile_id = $1 AND to_profile_id = $2)
          OR (from_profile_id = $2 AND to_profile_id = $1)
      `, [profileId, currentCandidate.id]);

      const msg = `🎉 У вас новый мэтч!\nТеперь вы можете связаться друг с другом.`;

      // Отправить обоим
      try {
        await ctx.telegram.sendMessage(currentCandidate.telegram_id, msg);
      } catch (err) {
        console.warn('❗ Ошибка при уведомлении мэтча кандидату:', err.message);
        await logToAdmin(`❗ Ошибка при уведомлении мэтча кандидату: ${err.message}`);
      }

      try {
        await ctx.reply(msg);
      } catch (err) {
        console.warn('❗ Ошибка при уведомлении мэтча отправителю:', err.message);
        await logToAdmin(`❗ Ошибка при уведомлении мэтча отправителю: ${err.message}`);
      }
    } else {
      // Односторонний лайк → уведомление без раскрытия
      try {
        await ctx.telegram.sendMessage(
          currentCandidate.telegram_id,
          `❤️ Кто-то поставил вам лайк!\nЗагляните в раздел «👁 Кто меня лайкнул» и начните поиск тиммейтов!`
        );
      } catch (err) {
        console.warn('❗ Ошибка при уведомлении о лайке:', err.message);
        await logToAdmin(`❗ Ошибка при уведомлении о лайке: ${err.message}`);
      }

      await ctx.reply('❤️ Лайк отправлен');
    }

    await logSearch(profileId, currentCandidate.id, 'like');
    return showNextCandidate(ctx);
  } finally {
    ctx.session.isProcessing = false;
  }
});

searchWizardScene.action('search_skip', async (ctx) => {
  if (ctx.session.isProcessing) return ctx.answerCbQuery();
  ctx.session.isProcessing = true;
  if (isCallbackHandled(ctx)) return;

  try {
    const { profileId, currentCandidate, undoStack, isPremium } = ctx.wizard.state;

    await db.query(`
      INSERT INTO skips (from_profile_id, to_profile_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [profileId, currentCandidate.id]);

    if (isPremium) {
      undoStack.unshift(currentCandidate);
      if (undoStack.length > 3) undoStack.pop();
    }

    await logSearch(profileId, currentCandidate.id, 'skip');
    return showNextCandidate(ctx);
  } finally {
    ctx.session.isProcessing = false;
  }
});

searchWizardScene.action('search_undo', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const { isPremium, undoStack } = ctx.wizard.state;
  if (!isPremium || !undoStack?.length) return ctx.answerCbQuery('🚫 Нечего возвращать');

  const last = undoStack.shift();
  ctx.wizard.state.candidates.unshift(last);
  ctx.wizard.state.index = 0;

  return showNextCandidate(ctx);
});

searchWizardScene.action('search_report', async (ctx) => {
  const targetId = ctx.wizard.state.currentCandidate?.id;
  if (isCallbackHandled(ctx)) return;

  if (!targetId) {
    try {
      await ctx.reply('⚠️ Не удалось определить пользователя для жалобы.');
    } catch (err) {
      console.error('❗ Ошибка при отправке сообщения о жалобе:', err.message);
    }
    return;
  }

  return ctx.scene.enter('reportScene', {
    reportTargetId: targetId,
    returnTo: 'searchWizardScene'
  });
});

searchWizardScene.action('search_exit', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  try {
    await ctx.editMessageReplyMarkup(null);
  } catch (err) {
    console.error('❗ Ошибка при удалении кнопок:', err.message);
    await logToAdmin(`❗ Ошибка при удалении кнопок: ${err.message}`);
  }
  try {
    await ctx.reply('📍 Поиск завершён. Возвращаемся в меню...');
  } catch (err) {
    console.error('❗ Ошибка при отправке сообщения о выходе:', err.message);
    await logToAdmin(`❗ Ошибка при отправке сообщения о выходе: ${err.message}`);
  }
  return ctx.scene.enter('mainMenuScene');
});

searchWizardScene.action('search_repeat', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  ctx.wizard.selectStep(0);
  return ctx.wizard.steps[0](ctx);
});

async function showNextCandidate(ctx) {
  const state = ctx.wizard.state;

  if (state.index >= state.candidates.length) {
    try {
      await ctx.reply('❗ Анкеты закончились.', Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Повторить поиск', 'search_repeat')],
        [Markup.button.callback('⛔ Выйти', 'search_exit')]
      ]));
    } catch (err) {
      console.error('❗ Ошибка при отправке сообщения о завершении анкет:', err.message);
      await logToAdmin(`❗ Ошибка при отправке сообщения о завершении анкет: ${err.message}`);
    }
    return;
  }

  if (state.index > 0 && state.index % 3 === 0) {
    try {
      const ad = await getRandomAdByType('search');
      if (ad) {
        const text = `📢 *Реклама:*\n${escapeMarkdown(ad.content)}`;
        const opts = {
          parse_mode: 'Markdown',
          reply_markup: ad.link ? {
            inline_keyboard: [[{ text: 'Перейти', url: ad.link }]]
          } : undefined
        };

        if (ad.media) {
          const method = ad.media.includes('photo') ? 'sendPhoto' :
            ad.media.includes('video') ? 'sendVideo' : 'sendAnimation';
          try {
            await ctx.telegram[method](ctx.chat.id, ad.media, { caption: text, ...opts });
          } catch (err) {
            console.error('❗ Ошибка при отправке медиа рекламы:', err.message);
            await logToAdmin(`❗ Ошибка при отправке сообщения о медиа рекламы: ${err.message}`);
          }
        } else {
          try {
            await ctx.reply(text, opts);
          } catch (err) {
            console.error('❗ Ошибка при отправке текстовой рекламы:', err.message);
            await logToAdmin(`❗ Ошибка при отправке текстовой рекламы: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error('Ошибка показа рекламы:', err.message);
      await logToAdmin(`❗ Ошибка при отправке сообщения о показе рекламы: ${err.message}`);
    }
  }

  const candidate = state.candidates[state.index++];
  state.currentCandidate = candidate;

  // Запрос игр кандидата из БД
  try {
    const gamesRes = await db.query(`
        SELECT g.id, g.name, rg.name as rank_name
        FROM profile_games pg
        JOIN games g ON pg.game_id = g.id
        LEFT JOIN ranks rg ON pg.rank_id = rg.id
        WHERE pg.profile_id = $1
      `, [candidate.id]);
    candidate.games = gamesRes.rows;
  } catch (err) {
    console.error('❗ Ошибка при загрузке игр кандидата:', err.message);
    await logToAdmin(`❗ Ошибка при отправке сообщения о загрузке игр: ${err.message}`);
    candidate.games = [];
  }

  let steamGames = [];
  if (candidate.steam_id) {
    try {
      const { rows } = await db.query(
        'SELECT appid, game_name AS name, playtime_hours FROM steam_stats WHERE steam_id = $1',
        [candidate.steam_id]
      );
      steamGames = rows.map(row => ({
        appid: row.appid,
        name: row.name,
        playtime_hours: Math.round(row.playtime_hours)
      }));
    } catch (err) {
      console.error('❗ Ошибка при загрузке Steam-игр:', err.message);
      await logToAdmin(`❗ Ошибка при отправке сообщения о загрузке Steam-игр: ${err.message}`);
      steamGames = [];
    }
  }



  const { text, buttons } = renderCandidateCard(candidate, {
    isOwner: false,
    isPremium: ctx.wizard.state.isPremium,
    steamGames
  });
  try {
    await ctx.replyWithMarkdown(text, Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('❗ Ошибка при отправке анкеты:', err.message);
    await logToAdmin(`❗ Ошибка при отправке сообщения об отправке анкеты: ${err.message}`);
  }
}

export default searchWizardScene;