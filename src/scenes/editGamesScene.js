import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';
import { logToAdmin } from '../utils/logToAdmin.js';


const editGamesScene = new Scenes.WizardScene(
  'editGamesScene',

  async (ctx) => {
    try {
      await ctx.reply(
        '⚙️ Что вы хотите изменить?',
        Markup.keyboard([
          ['🎮 Игры', '🏅 Ранги'],
          ['✅ Готово'],
          ['⬅️ Назад']
        ]).resize()
      );
    } catch (err) {
      console.error('Ошибка отправки сообщения', err);
      await logToAdmin(`❗ Ошибка отправки сообщения (editGamesScene): ${err.message}`);
    }
    return ctx.wizard.next();
  },

  async (ctx) => {
    const choice = ctx.message?.text;

    if (choice === '🎮 Игры') return await showGameList(ctx);
    if (choice === '🏅 Ранги') return await showGamesWithRanks(ctx);
    if (choice === '✅ Готово' || choice === '⬅️ Назад') {
      try {
        await ctx.reply('✅ Возвращаюсь в меню редактирования профиля.');
      } catch (err) {
        console.error('Ошибка отправки сообщения', err);
        await logToAdmin(`❗ Ошибка отправки сообщения (editGamesScene, вызов клавиатуры): ${err.message}`);
      }
      return ctx.scene.enter('editProfileWizardScene');
    }

    try {
      return ctx.reply('❌ Неверный выбор. Используйте кнопки.');
    } catch (err) {
      console.error('Ошибка отправки сообщения', err);
    }
  }
);

// === 🔁 Game actions ===

editGamesScene.action(/^remove_game_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const profileId = await getProfileId(ctx);
  const gameId = parseInt(ctx.match[1]);

  try {
    await db.query('DELETE FROM profile_games WHERE profile_id = $1 AND game_id = $2', [profileId, gameId]);
  } catch (err) {
    console.error(`Ошибка при удалении игры (profileId: ${profileId}, gameId: ${gameId}):`, err);
    await logToAdmin(`❗ Ошибка при удалении игры (editGamesScene, profileId: ${profileId}, gameId: ${gameId}): ${err.message}`);
    await ctx.reply('⚠️ Не удалось удалить игру. Попробуйте позже.');
    return;
  }


  await ctx.answerCbQuery('🗑 Игра удалена.');
  await ctx.editMessageReplyMarkup(null);
  return await showGameList(ctx);
});

editGamesScene.action(/^edit_game_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null);
  return await showAvailableGames(ctx, true);
});

editGamesScene.action(/^add_game$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null);
  return await showAvailableGames(ctx, false);
});

editGamesScene.action(/^select_game_(\d+)_(replace|add)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const gameId = parseInt(ctx.match[1]);
  const mode = ctx.match[2];
  const profileId = await getProfileId(ctx);

  if (mode === 'replace') {
    let oldGameRes;
    try {
      oldGameRes = await db.query(`SELECT game_id FROM profile_games WHERE profile_id = $1 LIMIT 1`, [profileId]);
    } catch (err) {
      console.error('Ошибка при получении старой игры:', err);
      await logToAdmin(`❗ Ошибка при получении старой игры (editGamesScene): ${err.message}`);
      await ctx.reply('⚠️ Не удалось получить старую игру.');
      return;
    }

    const oldGameId = oldGameRes.rows[0]?.game_id;
    if (oldGameId) {
      await db.query(`DELETE FROM profile_games WHERE profile_id = $1 AND game_id = $2`, [profileId, oldGameId]);
    }
  }

  try {
    await db.query(`INSERT INTO profile_games (profile_id, game_id) VALUES ($1, $2)`, [profileId, gameId]);
  } catch (err) {
    if (err.code === '23505') {
      console.warn(`Игра уже добавлена (profileId: ${profileId}, gameId: ${gameId})`);
      await ctx.answerCbQuery('❗ Эта игра уже выбрана.');
      return;
    }
    console.error('Ошибка при добавлении игры:', err);
    await logToAdmin(`❗ Ошибка при добавлении игры (editGamesScene): ${err.message}`);
    await ctx.reply('⚠️ Не удалось добавить игру.');
    return;
  }



  await ctx.answerCbQuery(mode === 'replace' ? '🔁 Игра заменена.' : '✅ Игра добавлена.');
  return await showGameList(ctx);
});

// === 🏅 Rank actions ===

editGamesScene.action(/^select_rank_game_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const gameId = parseInt(ctx.match[1]);
  ctx.wizard.state.editingRankGameId = gameId;

  let ranks;
  try {
    ranks = await db.query(`SELECT id, name FROM ranks WHERE game_id = $1 ORDER BY "order"`, [gameId]);
  } catch (err) {
    console.error(`Ошибка при загрузке рангов для gameId: ${gameId}`, err);
    await logToAdmin(`❗ Ошибка при загрузке рангов (editGamesScene, gameId: ${gameId}): ${err.message}`);
    await ctx.reply('⚠️ Не удалось загрузить ранги.');
    return;
  }

  const buttons = ranks.rows.map(r =>
    [Markup.button.callback(r.name, `set_rank_${r.id}`)]
  );
  buttons.push([Markup.button.callback('❌ Без ранга', 'set_rank_null')]);

  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText('Выберите новый ранг:', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('Ошибка отправки сообщения', err);
    await logToAdmin(`❗ Ошибка отправки сообщения (editGamesScene, выбор ранга): ${err.message}`);
  }
});

editGamesScene.action(/^set_rank_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const rankId = parseInt(ctx.match[1]);
  const gameId = ctx.wizard.state.editingRankGameId;
  const profileId = await getProfileId(ctx);

  try {
    await db.query(`UPDATE profile_games SET rank_id = $1 WHERE profile_id = $2 AND game_id = $3`, [rankId, profileId, gameId]);
  } catch (err) {
    console.error(`Ошибка при установке ранга (profileId: ${profileId}, gameId: ${gameId}):`, err);
    await logToAdmin(`❗ Ошибка при установке ранга (editGamesScene, profileId: ${profileId}, gameId: ${gameId}): ${err.message}`);
    await ctx.reply('⚠️ Не удалось установить ранг.');
    return;
  }


  await ctx.answerCbQuery('✅ Ранг установлен.');
  return await showGamesWithRanks(ctx);
});

editGamesScene.action('set_rank_null', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const gameId = ctx.wizard.state.editingRankGameId;
  const profileId = await getProfileId(ctx);

  try {
    await db.query(`UPDATE profile_games SET rank_id = NULL WHERE profile_id = $1 AND game_id = $2`, [profileId, gameId]);
  } catch (err) {
    console.error(`Ошибка при сбросе ранга (profileId: ${profileId}, gameId: ${gameId}):`, err);
    await logToAdmin(`❗ Ошибка при сбросе ранга (editGamesScene, profileId: ${profileId}, gameId: ${gameId}): ${err.message}`);
    await ctx.reply('⚠️ Не удалось сбросить ранг.');
    return;
  }


  await ctx.answerCbQuery('✅ Ранг сброшен.');
  return await showGamesWithRanks(ctx);
});

// === helpers ===

async function getProfileId(ctx) {
  let res;
  try {
    res = await db.query(`SELECT id FROM profiles WHERE telegram_id = $1`, [ctx.from.id.toString()]);
  } catch (err) {
    console.error('Ошибка при получении profileId:', err);
    await logToAdmin(`❗ Ошибка при получении profileId (editGamesScene): ${err.message}`);
    return null;
  }
  return res.rows[0]?.id;

}

async function showGameList(ctx) {
  const profileId = await getProfileId(ctx);

  let profileRes;
  try {
    profileRes = await db.query(`
      SELECT pr.expires_at
      FROM profiles p
      LEFT JOIN premium pr ON pr.profile_id = p.id
      WHERE p.id = $1
    `, [profileId]);
  } catch (err) {
    console.error('Ошибка при загрузке премиум-статуса:', err);
    await ctx.reply('⚠️ Не удалось загрузить данные профиля.');
    return;
  }


  const isPremium = !!(profileRes.rows[0]?.expires_at && new Date(profileRes.rows[0].expires_at) > new Date());
  const maxGames = isPremium ? 6 : 3;

  let games;
  try {
    games = await db.query(`
      SELECT g.id, g.name FROM profile_games pg
      JOIN games g ON g.id = pg.game_id
      WHERE pg.profile_id = $1
    `, [profileId]);
  } catch (err) {
    console.error('Ошибка при загрузке игр:', err);
    await ctx.reply('⚠️ Не удалось загрузить список игр.');
    return;
  }


  const buttons = games.rows.map(g => [
    Markup.button.callback(`🗑 ${escapeMarkdown(g.name)}`, `remove_game_${g.id}`),
    Markup.button.callback('✏️ Изменить', `edit_game_${g.id}`)
  ]);

  if (games.rows.length < maxGames) {
    buttons.push([Markup.button.callback('➕ Добавить игру', 'add_game')]);
  }

  try {
    await ctx.reply('🎮 Ваши игры:', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('Ошибка отправки сообщения', err);
  }
}


async function showAvailableGames(ctx, isReplace = false, page = 0) {
  const profileId = await getProfileId(ctx);

  let allGamesRes;
  try {
    allGamesRes = await db.query(`SELECT id, name FROM games ORDER BY name`);
  } catch (err) {
    console.error('Ошибка при загрузке всех игр:', err);
    await ctx.reply('⚠️ Не удалось загрузить игры.');
    return;
  }

  const allGames = allGamesRes.rows;

  let selectedGamesRes;
  try {
    selectedGamesRes = await db.query(`
      SELECT game_id FROM profile_games WHERE profile_id = $1
    `, [profileId]);
  } catch (err) {
    console.error('Ошибка при загрузке выбранных игр:', err);
    await ctx.reply('⚠️ Не удалось загрузить выбранные игры.');
    return;
  }

  const selectedGameIds = selectedGamesRes.rows.map(r => r.game_id);

  const availableGames = allGames.filter(game => !selectedGameIds.includes(game.id));

  if (availableGames.length === 0) {
    try {
      await ctx.reply('✅ Вы выбрали максимальное количество игр.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
    }
    return;
  }

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(availableGames.length / PAGE_SIZE);

  // 🔥 Обработка пустой страницы
  let currentPage = page;
  if (currentPage >= totalPages) {
    currentPage = totalPages - 1;
  }
  if (currentPage < 0) currentPage = 0;

  const paginatedGames = availableGames.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const buttons = [];

  for (let i = 0; i < paginatedGames.length; i += 2) {
    const row = [];
    for (let j = 0; j < 2 && (i + j) < paginatedGames.length; j++) {
      const game = paginatedGames[i + j];
      row.push(Markup.button.callback(
        game.name,
        `select_game_${game.id}_${isReplace ? 'replace' : 'add'}`
      ));
    }
    buttons.push(row);
  }

  const navigationButtons = [];
  if (currentPage > 0) navigationButtons.push(Markup.button.callback('⬅️ Назад', `games_page_${currentPage - 1}_${isReplace ? 'replace' : 'add'}`));
  if (currentPage < totalPages - 1) navigationButtons.push(Markup.button.callback('➡️ Далее', `games_page_${currentPage + 1}_${isReplace ? 'replace' : 'add'}`));
  if (navigationButtons.length > 0) buttons.push(navigationButtons);

  try {
    await ctx.reply('Выберите игру:', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('Ошибка при отправке сообщения', err);
  }
}


editGamesScene.action(/^games_page_(\d+)_(replace|add)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const page = parseInt(ctx.match[1]);
  const isReplace = ctx.match[2] === 'replace';
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null);
  await showAvailableGames(ctx, isReplace, page);
});


async function showGamesWithRanks(ctx) {
  const profileId = await getProfileId(ctx);

  let res;
  try {
    res = await db.query(`
      SELECT g.id, g.name, r.name as rank_name
      FROM profile_games pg
      JOIN games g ON g.id = pg.game_id
      LEFT JOIN ranks r ON r.id = pg.rank_id
      WHERE pg.profile_id = $1 AND g.has_rank = true
    `, [profileId]);
  } catch (err) {
    console.error('Ошибка при загрузке игр с рангами:', err);
    await ctx.reply('⚠️ Не удалось загрузить игры с рангами.');
    return;
  }


  if (res.rows.length === 0) {
    try {
      return ctx.reply('❌ У вас нет игр с рангами.');
    } catch (err) {
      console.error('Ошибка отправки сообщения', err);
    }
  }

  const buttons = res.rows.map(g => [
    Markup.button.callback(`${escapeMarkdown(g.name)} — ${escapeMarkdown(g.rank_name || 'Без ранга')}`, `select_rank_game_${g.id}`)
  ]);

  try {
    await ctx.reply('🏅 Игры с рангами:', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('Ошибка отправки сообщения', err);
  }
}

export default editGamesScene;
