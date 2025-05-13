import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { validateName, validateAge, validateBio } from '../utils/validators.js';
import mainMenuKeyboard from '../keyboards/mainMenu.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';
import { logToAdmin } from '../utils/logToAdmin.js';


const registrationScene = new Scenes.WizardScene(
  'registrationScene',

  // 🔹 Шаг 0: Имя
  async (ctx) => {
    try {
      await ctx.reply('Введи свое имя: ', Markup.removeKeyboard());
    } catch (err) {
      console.error('Ошибка отправки сообщения (шаг 0):', err);
      await logToAdmin(`❗ Ошибка отправки сообщения (шаг 0): ${err.message}`);
    }
    return ctx.wizard.next();
  },

  // 🔹 Шаг 1: Возраст
  async (ctx) => {
    const text = ctx.message?.text;

    if (!validateName(text)) {
      return ctx.reply('Некорректное имя, попробуй еще раз.');
    }

    ctx.wizard.state.name = text.trim();

    try {
      await ctx.reply('Введи свой возраст: ', Markup.keyboard([['⬅️ Назад']]).resize());
    } catch (err) {
      console.error('Ошибка отправки сообщения (шаг 1):', err);
      await logToAdmin(`❗ Ошибка отправки сообщения (шаг 1): ${err.message}`);
    }
    return ctx.wizard.next();
  },

  // 🔹 Шаг 2: Выбор пола
  async (ctx) => {
    const text = ctx.message?.text;

    if (text === '⬅️ Назад') {
      return ctx.wizard.selectStep(0);
    }

    const age = parseInt(text, 10);
    if (!validateAge(age)) {
      return ctx.reply('Некорректный возраст.');
    }

    ctx.wizard.state.age = age;

    try {
      await ctx.reply(`Выбери свой пол: `, Markup.inlineKeyboard([
        [Markup.button.callback('👨 Мужской', 'gender_male')],
        [Markup.button.callback('👩 Женский', 'gender_female')],
        [Markup.button.callback('❓ Не указывать', 'gender_unspecified')],
      ]));
    } catch (err) {
      console.error('Ошибка отправки сообщения (шаг 2):', err);
      await logToAdmin(`❗ Ошибка отправки сообщения (шаг 2): ${err.message}`);
    }

    return ctx.wizard.next();
  },

  // 🔹 Шаг 3: Ввод био и проверка игр
  async (ctx) => {
    const text = ctx.message?.text;

    if (text === '⬅️ Назад') {
      await ctx.reply('Выбери свой пол:', Markup.inlineKeyboard([
        [Markup.button.callback('👨 Мужской', 'gender_male')],
        [Markup.button.callback('👩 Женский', 'gender_female')],
        [Markup.button.callback('❓ Не указывать', 'gender_unspecified')],
      ]));
      return ctx.wizard.selectStep(2);
    }

    if (!validateBio(text)) {
      try {
        return ctx.reply('Слишком длинное описание. Напиши до 300 символов.');
      } catch (err) {
        console.error('Ошибка отправки сообщения', err);
        await logToAdmin(`❗ Ошибка отправки сообщения (нет игр): ${err.message}`);
      }
    }

    ctx.wizard.state.bio = text.trim();

    let games = [];
    try {
      const result = await db.query('SELECT * FROM games ORDER BY name ASC');
      games = result.rows;
    } catch (err) {
      console.error('❗ Ошибка при запросе списка игр:', err);
      await logToAdmin(`❗ Ошибка при запросе списка игр: ${err.message}`);
      await ctx.reply('❗ Произошла ошибка при загрузке списка игр. Попробуйте позже.');
      return ctx.scene.enter('mainMenuScene');
    }


    if (games.length === 0) {
      const telegramId = ctx.from.id.toString();
      const username = ctx.from.username;

      try {
          const userCheck = await db.query('SELECT 1 FROM users WHERE telegram_id = $1', [telegramId]);
          if (userCheck.rows.length === 0) {
              await db.query('INSERT INTO users (telegram_id, username) VALUES ($1, $2)', [telegramId, username]);
          }
      } catch (err) {
          console.error('❗ Ошибка при проверке/вставке пользователя:', err);
          await logToAdmin(`❗ Ошибка при проверке/вставке пользователя: ${err.message}`);
          await ctx.reply('❗ Произошла ошибка при проверке пользователя. Попробуйте позже.');
          return ctx.scene.enter('mainMenuScene');
      }

      try {
        await db.query(
          'INSERT INTO profiles (telegram_id, name, age, gender, bio) VALUES ($1, $2, $3, $4, $5)',
          [telegramId, ctx.wizard.state.name, ctx.wizard.state.age, ctx.wizard.state.gender, ctx.wizard.state.bio]
        );
      } catch (err) {
        console.error('❗ Ошибка при создании профиля (нет игр):', err);
        await ctx.reply('❗ Не удалось создать профиль. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
      }

      try {
        await ctx.reply('⚠️ Список доступных игр пока пуст. Как только игры появятся, они будут добавлены в ваш профиль автоматически.');
      } catch (err) {
        console.error('Ошибка отправки сообщения', err);
        await logToAdmin(`❗ Ошибка отправки сообщения (main menu): ${err.message}`);
      }

      try {
        await ctx.reply('🧭 Вы можете начать пользоваться ботом, но поиск пока недоступен.', mainMenuKeyboard(false));

      } catch (err) {
        console.error('Ошибка отправки сообщения', err);
        await logToAdmin(`❗ Ошибка отправки сообщения (main menu): ${err.message}`);
      }

      return ctx.scene.enter('mainMenuScene');
    }

    ctx.wizard.state.availableGames = games;
    ctx.wizard.state.selectedGames = [];

    await sendGameSelection(ctx, 0); // начинаем с первой страницы
    return ctx.wizard.next(); // шаг выбора игр
  },

  // 🔹 Шаг 4: Игры
  async (ctx) => {
    try {
      return await ctx.reply('Пожалуйста, выберите игры, используя кнопки ниже.');
    } catch (err) {
      if (err.code === 403) {
        console.warn(`[WARN] Пользователь ${ctx.from?.id} заблокировал бота.`);
      } else {
        console.error('Ошибка при отправке уведомления:', err);
      }
    }
  },


  // 🔹 Шаг 5: Ранги
  async (ctx) => {
    return ctx.reply('Ожидается выбор рангов...');
  },

  // 🔹 Шаг 6: Завершение
  async (ctx) => {
    const { name, age, gender, bio, selectedGames, selectedRanks } = ctx.wizard.state;
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username;

    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;

    try {
        const userCheck = await db.query('SELECT 1 FROM users WHERE telegram_id = $1', [telegramId]);
        if (userCheck.rows.length === 0) {
            await db.query('INSERT INTO users (telegram_id, username) VALUES ($1, $2)', [telegramId, username]);
        }
    } catch (err) {
        console.error('❗ Ошибка при проверке/вставке пользователя (шаг 6):', err);
        await ctx.reply('❗ Не удалось сохранить пользователя. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
    }

    let profileId;
    try {
      const profileRes = await db.query(
        'INSERT INTO profiles (telegram_id, name, age, gender, bio) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [telegramId, name, age, gender, bio]
      );
      if (profileRes.rows.length === 0) {
        console.error('❗ Профиль не вернул id');
        await ctx.reply('❗ Не удалось создать профиль. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
      }
      profileId = profileRes.rows[0].id;
    } catch (err) {
      console.error('❗ Ошибка при создании профиля:', err);
      await logToAdmin(`❗ Ошибка при создании профиля: ${err.message}`);
      await logToAdmin(`❗ Ошибка при создании профиля (registrationScene): ${err.message}`);
      await ctx.reply('❗ Произошла ошибка при создании профиля. Попробуйте позже.');
      return ctx.scene.enter('mainMenuScene');
    }


    for (const gameId of selectedGames) {
      const rankId = selectedRanks[gameId] || null;
      try {
        await db.query(
          'INSERT INTO profile_games (profile_id, game_id, rank_id) VALUES ($1, $2, $3)',
          [profileId, gameId, rankId]
        );
      } catch (err) {
        console.error(`❗ Ошибка при вставке игры (gameId: ${gameId}):`, err);
        await ctx.reply('❗ Произошла ошибка при сохранении выбранных игр. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
      }
    }


    await ctx.reply('Регистрация завершена. Можешь приступать к поиску.', mainMenuKeyboard(false));
    return ctx.scene.enter('mainMenuScene');
  }
);

// 📌 Обработка выбора пола
registrationScene.action(/^gender_(male|female|unspecified)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const gender = ctx.match[1];
  ctx.wizard.state.gender = gender;

  await ctx.answerCbQuery();
  await ctx.reply('Напиши о себе: ', Markup.keyboard([['⬅️ Назад']]).resize());
  return ctx.wizard.selectStep(3);
});

// 📌 Обработка выбора игр
registrationScene.action(/^game_(\d+)_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const gameId = parseInt(ctx.match[1]);
  const page = parseInt(ctx.match[2]);
  const { selectedGames } = ctx.wizard.state;
  const isPremium = false; // TODO: определить по БД

  const idx = selectedGames.indexOf(gameId);
  if (idx === -1) {
    if (selectedGames.length >= (isPremium ? 6 : 3)) {
      return ctx.answerCbQuery('Ограничение для обычного пользователя - 3 игры.');
    }
    selectedGames.push(gameId);
  } else {
    selectedGames.splice(idx, 1);
  }

  try {
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([])); // очистить старую
  } catch (err) {
    console.error('[game handler] Ошибка очистки replyMarkup:', err);
  }

  await sendGameSelection(ctx, page);
  return ctx.answerCbQuery();
});

// 📌 Завершение выбора игр
registrationScene.action('game_done', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const { availableGames, selectedGames } = ctx.wizard.state;

  const selectedGameObjects = availableGames.filter((g) => selectedGames.includes(g.id));
  const gamesWithRank = selectedGameObjects.filter((g) => g.has_rank);

  ctx.wizard.state.gamesWithRank = gamesWithRank;
  ctx.wizard.state.selectedRanks = {};

  return askNextRank(ctx);
});

// 📌 Выбор ранга
registrationScene.action(/^rank_\d+_(\d+|null)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const [_, gameIdStr, rankIdStr] = ctx.match[0].split('_');
  const gameId = parseInt(gameIdStr);
  const rankId = rankIdStr === 'null' ? null : parseInt(rankIdStr);

  ctx.wizard.state.selectedRanks[gameId] = rankId;
  return askNextRank(ctx);
});

// 🔁 Helper: Ранги
async function askNextRank(ctx) {
  const game = ctx.wizard.state.gamesWithRank.shift();

  if (!game) {
    // ✅ Все игры с рангами обработаны — сохраняем профиль
    const { name, age, gender, bio, selectedGames, selectedRanks } = ctx.wizard.state;
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username;

    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;

    try {
        const userCheck = await db.query('SELECT 1 FROM users WHERE telegram_id = $1', [telegramId]);
        if (userCheck.rows.length === 0) {
            await db.query('INSERT INTO users (telegram_id, username) VALUES ($1, $2)', [telegramId, username]);
        }
    } catch (err) {
        console.error('❗ Ошибка при проверке/вставке пользователя (askNextRank):', err);
        await ctx.reply('❗ Не удалось сохранить пользователя. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
    }

    let profileId;
    try {
      const profileRes = await db.query(
        'INSERT INTO profiles (telegram_id, name, age, gender, bio) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [telegramId, name, age, gender, bio]
      );
      if (profileRes.rows.length === 0) {
        console.error('❗ Профиль не вернул id (askNextRank)');
        await ctx.reply('❗ Не удалось создать профиль. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
      }
      profileId = profileRes.rows[0].id;
    } catch (err) {
      console.error('❗ Ошибка при создании профиля (askNextRank):', err);
      await ctx.reply('❗ Не удалось создать профиль. Попробуйте позже.');
      return ctx.scene.enter('mainMenuScene');
    }

    for (const gameId of selectedGames) {
      const rankId = selectedRanks[gameId] || null;
      try {
        await db.query(
          'INSERT INTO profile_games (profile_id, game_id, rank_id) VALUES ($1, $2, $3)',
          [profileId, gameId, rankId]
        );
      } catch (err) {
        console.error(`❗ Ошибка при вставке игры (askNextRank, gameId: ${gameId}):`, err);
        await logToAdmin(`❗ Ошибка при вставке игры (askNextRank, gameId: ${gameId}): ${err.message}`);
        await ctx.reply('❗ Не удалось сохранить выбранные игры. Попробуйте позже.');
        return ctx.scene.enter('mainMenuScene');
      }
    }


    await ctx.reply('✅ Регистрация завершена! Добро пожаловать в главное меню.', mainMenuKeyboard(false));
    return ctx.scene.enter('mainMenuScene');
  }

  let ranks = [];
  try {
    const ranksRes = await db.query('SELECT id, name FROM ranks WHERE game_id = $1 ORDER BY "order"', [game.id]);
    ranks = ranksRes.rows;
  } catch (err) {
    console.error(`❗ Ошибка при загрузке рангов для игры (gameId: ${game.id}):`, err);
    await ctx.reply('❗ Не удалось загрузить ранги для выбранной игры. Попробуйте позже.');
    return ctx.scene.enter('mainMenuScene');
  }


  const buttons = ranks.map(r => [
    Markup.button.callback(escapeMarkdown(r.name), `rank_${game.id}_${r.id}`)
  ]);
  buttons.push([Markup.button.callback('Без ранга', `rank_${game.id}_null`)]);

  try {
    await ctx.reply(`Выберите ранг для ${escapeMarkdown(game.name)}:`, Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
  }

}

// 🔁 Helper: Игры с пагинацией
async function sendGameSelection(ctx, page = 0) {
  const { availableGames, selectedGames } = ctx.wizard.state;
  const pageSize = 10;
  const totalPages = Math.ceil(availableGames.length / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;
  const gamesPage = availableGames.slice(start, end);

  const buttons = [];
  for (let i = 0; i < gamesPage.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < gamesPage.length; j++) {
      const game = gamesPage[j];
      const selected = selectedGames.includes(game.id);
      row.push(Markup.button.callback(`${selected ? '✅' : '➕'} ${escapeMarkdown(game.name)}`, `game_${game.id}_${page}`));
    }
    buttons.push(row);
  }

  const navButtons = [];
  if (page > 0) navButtons.push(Markup.button.callback('⬅️ Назад', `page_${page - 1}`));
  if (page < totalPages - 1) navButtons.push(Markup.button.callback('➡️ Вперед', `page_${page + 1}`));
  if (selectedGames.length > 0) navButtons.push(Markup.button.callback('✅ Готово', 'game_done'));

  if (navButtons.length > 0) buttons.push(navButtons);

  try {
    await ctx.reply('🎮 Выберите игры (до 3):', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('[sendGameSelection] Ошибка отправки сообщения:', err);
  }
}

// 📌 Обработка кнопок страницы
registrationScene.action(/^page_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const page = parseInt(ctx.match[1]);
  try {
    await ctx.deleteMessage(); // удалить старое сообщение
  } catch (err) {
    console.error('[page handler] Ошибка удаления сообщения:', err);
  }
  await sendGameSelection(ctx, page);
});



export default registrationScene;