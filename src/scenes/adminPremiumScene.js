import { Scenes, Markup } from 'telegraf';
import {
  findUserByUsernameOrId,
  grantPremiumDays,
  revokePremium
} from '../services/premium.service.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';

const adminPremiumScene = new Scenes.BaseScene('adminPremiumScene');

adminPremiumScene.enter((ctx) => {
  ctx.reply('✍ Введите @username или ID пользователя, которому хотите выдать или забрать премиум:');
});

adminPremiumScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim();

  const user = await findUserByUsernameOrId(input);
  if (!user) return ctx.reply('❌ Пользователь не найден.');

  ctx.session.selectedUser = user;

  const premiumStatus = user.premium_until
    ? `🟢 Активен до ${new Date(user.premium_until).toLocaleDateString('ru-RU')}`
    : '🔴 Неактивен';

  await ctx.reply(
    `👤 Пользователь: @${user.username || '(без username)'}\n🆔 ID: ${user.telegram_id}\n💎 Премиум: ${premiumStatus}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('+14 дней', 'premium_14'), Markup.button.callback('+30', 'premium_30')],
      [Markup.button.callback('+60', 'premium_60'), Markup.button.callback('+90', 'premium_90')],
      [Markup.button.callback('❌ Забрать премиум', 'premium_remove')],
      [Markup.button.callback('⬅️ Назад', 'back_to_admin')],
    ])
  );
});

adminPremiumScene.action(/^premium_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();

  const days = parseInt(ctx.match[1], 10);
  const user = ctx.session.selectedUser;
  if (!user) return ctx.reply('❌ Пользователь не выбран.');

  await grantPremiumDays(user.telegram_id, days);
  await ctx.reply(`✅ Премиум выдан на ${days} дней.`);
});

adminPremiumScene.action('premium_remove', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();

  const user = ctx.session.selectedUser;
  if (!user) return ctx.reply('❌ Пользователь не выбран.');

  await revokePremium(user.telegram_id);
  await ctx.reply('❌ Премиум удалён.');
});

adminPremiumScene.action('back_to_admin', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  return ctx.scene.enter('adminPanelScene');
});

export default adminPremiumScene;
