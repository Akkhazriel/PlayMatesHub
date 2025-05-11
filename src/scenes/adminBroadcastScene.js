import { Scenes, Markup } from 'telegraf';
import { getUsersForBroadcast, sendBroadcastToUsers } from '../services/broadcast.service.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js';

const adminBroadcastScene = new Scenes.WizardScene('adminBroadcastScene',

  // Шаг 0 — выбор игры
  async (ctx) => {
    if (!ctx.session.isAdmin) return ctx.reply('❌ Доступ запрещён.');

    ctx.wizard.state.broadcast = {};
    const games = await getUsersForBroadcast('gamesList');

    const buttons = games.map(g => [Markup.button.callback(g.name, `admin_broadcast_game_${g.id}`)]);
    buttons.push([Markup.button.callback('📢 Всем пользователям', 'admin_broadcast_all')]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'admin_broadcast_back')]);

    await ctx.reply('🎯 Выберите игру для фильтрации рассылки:', Markup.inlineKeyboard(buttons));
  },

  // Шаг 1 — текст рассылки
  async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text || text.length < 5) {
      return ctx.reply('⚠️ Введите текст длиной не менее 5 символов.');
    }

    ctx.wizard.state.broadcast.text = text;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Отправить', 'admin_broadcast_confirm')],
      [Markup.button.callback('📝 Изменить текст', 'admin_broadcast_edit')],
      [Markup.button.callback('⬅️ Назад', 'admin_broadcast_back')]
    ]);
    
    try {
      await ctx.reply(`📢 Предпросмотр:\n\n${escapeMarkdown(text)}`, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard.reply_markup
      });
    } catch (err) {
      console.error('[Broadcast Preview Error]', err);
      await ctx.reply('⚠️ Ошибка при показе предпросмотра.');
    }

    return ctx.wizard.selectStep(2);
  },

  // Шаг 2 — ожидание подтверждения
  async (ctx) => {
    await ctx.reply('✏️ Введите новый текст рассылки или нажмите кнопку ниже.');
    return ctx.wizard.selectStep(1);
  }
);

// Выбор игры
adminBroadcastScene.action(/admin_broadcast_game_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});
  ctx.wizard.state.broadcast = { gameId: parseInt(ctx.match[1]) };
  await ctx.reply('✍️ Введите текст рассылки (MarkdownV2):');
  return ctx.wizard.selectStep(1);
});

// Всем пользователям
adminBroadcastScene.action('admin_broadcast_all', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});
  ctx.wizard.state.broadcast = { gameId: null };
  await ctx.reply('✍️ Введите текст рассылки (MarkdownV2):');
  return ctx.wizard.selectStep(1);
});

// Подтверждение и отправка
adminBroadcastScene.action('admin_broadcast_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});

  const { gameId, text } = ctx.wizard.state.broadcast;
  const users = await getUsersForBroadcast(gameId);
  const result = await sendBroadcastToUsers(users, text, ctx.telegram);

  await ctx.reply(`📬 Рассылка завершена:
✅ Успешно: ${result.success}
❌ Ошибок: ${result.failed}
🔢 Всего: ${users.length}`);

try {
  return ctx.scene.enter('adminPanelScene');
} catch (err) {
  console.error('Ошибка перехода в adminPanelScene:', err);
  await ctx.reply('⚠️ Не удалось вернуться в админ-панель.');
}

});

// Редактировать текст
adminBroadcastScene.action('admin_broadcast_edit', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});
  await ctx.reply('✍️ Введите новый текст рассылки:');
  return ctx.wizard.selectStep(1);
});

// Назад
adminBroadcastScene.action('admin_broadcast_back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});
  try {
    return ctx.scene.enter('adminPanelScene');
  } catch (err) {
    console.error('Ошибка перехода в adminPanelScene:', err);
    await ctx.reply('⚠️ Не удалось вернуться в админ-панель.');
  }
  
});

export default adminBroadcastScene;
