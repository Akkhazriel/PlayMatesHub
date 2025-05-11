import { Scenes, Markup } from 'telegraf';
import {
  getAllGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  isDuplicateName
} from '../services/game.service.js';
import { resetWizard } from '../utils/wizardReset.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';


const adminGamesScene = new Scenes.WizardScene('adminGamesScene',

  // STEP 0 — показать список игр
  async (ctx) => {
    if (!ctx.session.isAdmin) return ctx.reply('❌ Доступ запрещён.');

    const games = await getAllGames();

    if (games.length > 0) {
      const list = games
        .map((g) => `• ${g.name} (${g.has_rank ? 'с рангами' : 'без рангов'})`)
        .join('\n');

      const buttons = games.map((g) => ([
        Markup.button.callback(`✏ ${g.name}`, `edit_game_${g.id}`),
        Markup.button.callback('❌', `delete_game_${g.id}`),
      ]));

      buttons.push([Markup.button.callback('➕ Добавить игру', 'add_game')]);
      buttons.push([Markup.button.callback('⬅️ Назад', 'back_to_admin')]);

      await ctx.replyWithMarkdown(`🎮 *Текущие игры:*\n\n${list}`, Markup.inlineKeyboard(buttons));
    } else {
      await ctx.reply('📭 В базе пока нет игр.', Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить игру', 'add_game')],
        [Markup.button.callback('⬅️ Назад', 'back_to_admin')],
      ]));
    }

    return ctx.wizard.selectStep(0);
  },

  // STEP 1 — ввод названия
  async (ctx) => {
    const name = ctx.message?.text?.trim();
    if (!name || name.length < 2 || name.length > 50) {
      return ctx.reply('❌ Название должно быть от 2 до 50 символов.');
    }

    ctx.wizard.state.game.name = name;

    await ctx.reply('🎮 У этой игры есть система рангов?', Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да', 'game_has_rank_true')],
      [Markup.button.callback('❌ Нет', 'game_has_rank_false')],
    ]));

    return ctx.wizard.selectStep(2);
  },

  // STEP 2 — выбор has_rank и сохранение
  async () => {}
);

// ACTIONS

adminGamesScene.action('add_game', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  ctx.wizard.state.game = { mode: 'add' };
  await ctx.reply('✍ Введите название новой игры:');
  return ctx.wizard.selectStep(1);
});

adminGamesScene.action(/^edit_game_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  const id = parseInt(ctx.match[1], 10);
  const game = await getGameById(id);

  if (!game) return ctx.reply('❌ Игра не найдена.');

  ctx.wizard.state.game = {
    id,
    mode: 'edit',
    name: game.name,
  };

  await ctx.reply(`✏️ Текущее название: *${game.name}* (${game.has_rank ? 'с рангами' : 'без рангов'})`, { parse_mode: 'Markdown' });
  await ctx.reply('✍ Введите новое название игры:');
  return ctx.wizard.selectStep(1);
});

adminGamesScene.action(/^delete_game_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  const id = parseInt(ctx.match[1], 10);
  ctx.wizard.state.game = { id, mode: 'delete' };

  await ctx.reply('🗑 Вы уверены, что хотите удалить эту игру?', Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да, удалить', 'confirm_delete')],
    [Markup.button.callback('❌ Отмена', 'cancel')],
  ]));

  return ctx.wizard.selectStep(3);
});

adminGamesScene.action(/^game_has_rank_(true|false)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();

  try {
    await ctx.deleteMessage();
  } catch (err) {
    if (!err.description?.includes('message to delete not found')) {
      console.warn('Ошибка удаления inline-кнопок:', err.description);
    }
  }

  const hasRank = ctx.match[1] === 'true';
  const { name, mode, id } = ctx.wizard.state.game || {};

  if (!name) return ctx.reply('❌ Название не указано.');

  try {
    if (await isDuplicateName(name, id)) {
      return ctx.reply('❌ Игра с таким названием уже существует.');
    }

    if (mode === 'add') {
      await createGame(name, hasRank);
      await ctx.reply(`✅ Игра добавлена: *${escapeMarkdown(name)}*`, { parse_mode: 'Markdown' });
    } else {
      await updateGame(id, name, hasRank);
      await ctx.reply(`✅ Игра обновлена: *${escapeMarkdown(name)}*`, { parse_mode: 'Markdown' });
    }

    resetWizard(ctx);
    return ctx.scene.reenter();

  } catch (err) {
    console.error('Ошибка сохранения игры:', err);
    return ctx.reply('⚠️ Не удалось сохранить игру.');
  }
});

adminGamesScene.action('confirm_delete', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();

  try {
    await ctx.deleteMessage();
  } catch (err) {
    if (!err.description?.includes('message to delete not found')) {
      console.warn('Ошибка удаления inline-кнопок:', err.description);
    }
  }

  const { id } = ctx.wizard.state.game || {};
  if (!id) return ctx.reply('❌ Неизвестная игра.');

  try {
    await deleteGame(id);
    await ctx.reply('🗑 Игра удалена.');
  } catch (err) {
    console.error('❌ Ошибка при удалении игры:', err);
    await ctx.reply('⚠️ Не удалось удалить игру.');
  }

  resetWizard(ctx);
  return ctx.scene.reenter();
});

adminGamesScene.action('cancel', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  await ctx.reply('❎ Действие отменено.');
  resetWizard(ctx);
  return ctx.scene.reenter();
});

adminGamesScene.action('back_to_admin', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  return ctx.scene.enter('adminPanelScene');
});

export default adminGamesScene;
