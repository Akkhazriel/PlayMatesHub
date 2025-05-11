import { Scenes } from 'telegraf';
import { getUserStats, getGlobalStats } from '../services/stats.service.js';
import { escapeMarkdown } from '../utils/escapeMarkdown.js'; // добавлен импорт

const adminStatsScene = new Scenes.WizardScene('adminStatsScene',

  async (ctx) => {
    const global = await getGlobalStats();

    await ctx.replyWithMarkdown(
      `📊 *Общая статистика*\n\n` +
      `👥 Пользователей: ${global.users}\n` +
      `📄 Профилей: ${global.profiles}\n` +
      `🟢 Активных: ${global.activeProfiles}\n` +
      `🚫 Забаненных: ${global.bannedProfiles}\n` +
      `💎 Премиумов: ${global.premiumUsers}\n\n` +
      `💬 Мэтчей: ${global.matches}\n` +
      `❤️ Лайков: ${global.likes}\n` +
      `🚫 Жалоб: ${global.complaints}\n` +
      `📈 Событий: ${global.statsEvents}`
    );

    await ctx.reply('✍ Введите @username или Telegram ID пользователя для просмотра персональной статистики:');

    return ctx.wizard.next();
  },

  async (ctx) => {
    const input = ctx.message.text.trim();
    const stats = await getUserStats(input);

    if (!stats) {
      await ctx.reply('❌ Пользователь не найден.');
      return ctx.scene.reenter();
    }

    const {
      telegram_id,
      username,
      profile_id,
      premium_status,
      matches,
      likes,
      complaints,
      events
    } = stats;

    const premiumLabel = premium_status ? '💎 Премиум' : '👤 Обычный';

    await ctx.replyWithMarkdown(
      `📊 *Статистика пользователя*\n\n` +
      `👤 Username: @${escapeMarkdown(String(username || '—'))}\n` +
      `🆔 Telegram ID: ${escapeMarkdown(String(telegram_id))}\n` +
      `📄 Profile ID: ${escapeMarkdown(String(profile_id))}\n` +
      `💠 Статус: ${escapeMarkdown(String(premiumLabel))}\n\n` +
      `💬 Матчи: ${matches}\n` +
      `❤️ Лайки: ${likes}\n` +
      `🚫 Жалобы: ${complaints}\n` +
      `📈 Действия (stats): ${events}`
    );

    return ctx.scene.leave();
  }
);

export default adminStatsScene;
