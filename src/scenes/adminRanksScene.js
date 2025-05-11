import { Scenes, Markup } from 'telegraf';
import {
  getGamesWithRanks,
  getRanksByGame,
  createRank,
  updateRank,
  deleteRank,
  moveRank
} from '../services/rank.service.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';


const adminRanksScene = new Scenes.WizardScene('adminRanksScene',

    // STEP 0 — выбор игры
    async (ctx) => {
        const games = await getGamesWithRanks();
        if (!games.length) {
            await ctx.reply('❌ Нет игр с рангами.');
            return ctx.scene.enter('adminPanelScene'); // или ctx.scene.leave()
        }

        const buttons = games.map((g) =>
            [Markup.button.callback(g.name, `select_game_${g.id}`)]
        );
        buttons.push([Markup.button.callback('⬅️ Назад', 'back_to_admin')]);

        await ctx.reply('🎮 Выберите игру для управления рангами:', Markup.inlineKeyboard(buttons));
        return ctx.wizard.selectStep(0); // ✅ обязательный return
    },

    // STEP 1 — список рангов
    async () => { }
);

// Общая функция рендера списка рангов
async function renderRanksUI(ctx, gameId) {
    const ranks = await getRanksByGame(gameId);
    const list = ranks.length
        ? ranks.map((r, i) => `${i + 1}. ${escapeMarkdown(r.name)}`).join('\n')
        : '❌ Пока нет рангов';


    const buttons = ranks.map((r, i) => {
        const controls = [];
        if (i > 0) controls.push(Markup.button.callback('⬆️', `rank_up_${r.id}`));
        if (i < ranks.length - 1) controls.push(Markup.button.callback('⬇️', `rank_down_${r.id}`));
        controls.push(Markup.button.callback('✏', `rank_edit_${r.id}`));
        controls.push(Markup.button.callback('❌', `rank_delete_${r.id}`));
        return controls;
    });

    buttons.push([Markup.button.callback('➕ Добавить ранг', 'rank_add')]);
    buttons.push([Markup.button.callback('⬅️ Назад к играм', 'back_to_games')]);

    await ctx.replyWithMarkdown(`🏷 *Ранги:*\n\n${list}`, Markup.inlineKeyboard(buttons));
    return ctx.wizard.selectStep(1); // ✅ важен для повторного выбора
}

// SELECT GAME
adminRanksScene.action(/^select_game_(\d+)$/, async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    await ctx.answerCbQuery();

    const gameId = parseInt(ctx.match[1], 10);
    ctx.wizard.state.selectedGameId = gameId;

    return renderRanksUI(ctx, gameId);
});

// ➕ Добавить ранг
adminRanksScene.action('rank_add', async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.reply('✍ Введите название нового ранга:');
    return ctx.wizard.selectStep(2);
});

// ✏ Редактировать
adminRanksScene.action(/^rank_edit_(\d+)$/, async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    await ctx.answerCbQuery();

    ctx.wizard.state.editingRankId = parseInt(ctx.match[1], 10);
    await ctx.reply('✏ Введите новое название ранга:');
    return ctx.wizard.selectStep(3);
});

// ❌ Удалить
adminRanksScene.action(/^rank_delete_(\d+)$/, async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    await ctx.answerCbQuery();

    const id = parseInt(ctx.match[1], 10);
    await deleteRank(id);
    return renderRanksUI(ctx, ctx.wizard.state.selectedGameId);
});

// ⬆⬇ Переместить
adminRanksScene.action(/^rank_(up|down)_(\d+)$/, async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    await ctx.answerCbQuery();

    const [_, dir, id] = ctx.match;
    await moveRank(parseInt(id, 10), dir === 'up' ? -1 : 1);
    return renderRanksUI(ctx, ctx.wizard.state.selectedGameId);
});

adminRanksScene.action('back_to_games', async (ctx) => {
    await ctx.answerCbQuery(); // подтвердить Telegram-боту, что кнопка обработана

    ctx.wizard.selectStep(0);        // сменить шаг вручную
    return ctx.wizard.steps[0](ctx); // вызвать шаг 0 напрямую
});



// Назад в админку
adminRanksScene.action('back_to_admin', async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    return ctx.scene.enter('adminPanelScene');
});

// Обработка текста: создание/редактирование
adminRanksScene.on('text', async (ctx, next) => {
    const step = ctx.wizard.cursor;
    const gameId = ctx.wizard.state.selectedGameId;
    const name = ctx.message.text.trim();

    if (!name) return ctx.reply('❌ Название не может быть пустым.');

    if (step === 2) {
        await createRank(gameId, name);
        return renderRanksUI(ctx, gameId);
    }

    if (step === 3) {
        const id = ctx.wizard.state.editingRankId;
        await updateRank(id, name);
        return renderRanksUI(ctx, gameId);
    }

    return next();
});

export default adminRanksScene;