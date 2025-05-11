import { Scenes, Markup } from 'telegraf';
import { findUserForAdmin, blockUser, unblockUser } from '../services/admin.service.js';
import { formatUserInfo } from '../utils/userFormatter.js';

const adminBlockScene = new Scenes.WizardScene('adminBlockScene',

  async (ctx) => {
    if (!ctx.session.isAdmin) return ctx.reply('❌ Доступ запрещён.');
    await ctx.reply('✉️ Введите @username или Telegram ID пользователя:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    const input = ctx.message?.text?.trim();
    if (!input) return ctx.reply('⚠️ Введите корректные данные.', backButton());

    const user = await findUserForAdmin(input);
    if (!user) return ctx.reply('❌ Пользователь не найден.', backButton());

    ctx.wizard.state.user = user;
    await ctx.reply(formatUserInfo(user), buildUserButtons(user));
    return ctx.wizard.next();
  },

  async () => {} // ожидание action
);

// === ACTIONS ===

adminBlockScene.action(/^admin_block_(\d+)$/, async (ctx) => {
  const days = parseInt(ctx.match[1], 10);
  const user = ctx.wizard.state.user;
  if (!user) return;

  await blockUser(user.telegram_id, days);
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch {}
  await ctx.reply(`⛔ Пользователь заблокирован на ${days} дней.`);
  try {
    return ctx.scene.enter('adminPanelScene');
  } catch (err) {
    console.error('Ошибка перехода в adminPanelScene:', err);
    await ctx.reply('⚠️ Не удалось вернуться в админ-панель.');
  }
  
});

adminBlockScene.action('admin_unblock', async (ctx) => {
  const user = ctx.wizard.state.user;
  if (!user) return;

  await unblockUser(user.telegram_id);
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch {}
  await ctx.reply('✅ Пользователь разблокирован.');
  try {
    return ctx.scene.enter('adminPanelScene');
  } catch (err) {
    console.error('Ошибка перехода в adminPanelScene:', err);
    await ctx.reply('⚠️ Не удалось вернуться в админ-панель.');
  }
  
});

adminBlockScene.action('admin_block_back', async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch {}
  try {
    return ctx.scene.enter('adminPanelScene');
  } catch (err) {
    console.error('Ошибка перехода в adminPanelScene:', err);
    await ctx.reply('⚠️ Не удалось вернуться в админ-панель.');
  }
  
});

// === UI helpers ===

function buildUserButtons(user) {
  const buttons = user.is_banned
    ? [[Markup.button.callback('✅ Разблокировать', 'admin_unblock')]]
    : [
        [Markup.button.callback('⛔ 3 дня', 'admin_block_3'), Markup.button.callback('⛔ 14 дней', 'admin_block_14')],
        [Markup.button.callback('⛔ 30 дней', 'admin_block_30'), Markup.button.callback('⛔ 60 дней', 'admin_block_60')],
        [Markup.button.callback('⛔ 90 дней', 'admin_block_90')],
        [Markup.button.callback('⛔ Навсегда', 'admin_block_9999')]
      ];

  buttons.push([Markup.button.callback('⬅️ Назад', 'admin_block_back')]);
  return Markup.inlineKeyboard(buttons);
}

function backButton() {
  return Markup.inlineKeyboard([
    Markup.button.callback('⬅️ Назад', 'admin_block_back')
  ]);
}

export default adminBlockScene;