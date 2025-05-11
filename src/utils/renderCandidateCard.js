import { escapeMarkdown } from '../utils/escapeMarkdown.js';
import { Markup } from 'telegraf';

export function renderCandidateCard(profile, options = {}) {
  const { isOwner = false, steamGames = [], isPremium = false } = options;

  let premiumBlock = '';
  if (profile.is_premium) {
    premiumBlock = '━━━━━━━━━━━━━━━━━━━\n🏆 Премиум-профиль\n━━━━━━━━━━━━━━━━━━━\n\n';
  }

  const genderMap = {
    male: 'Мужской',
    female: 'Женский',
    other: 'Другое'
  };

  const genderText = genderMap[profile.gender] || 'Не указан';

  const header = isOwner ? '📜 Твой профиль:' : '📜 Профиль игрока:';

  const verifiedBadge = profile.steam_id ? ' ✅🎮' : '';
  const nameLine = `${escapeMarkdown(profile.name)}, ${profile.age}, ${genderText}${verifiedBadge}`;

  const bio = profile.bio ? escapeMarkdown(profile.bio) : '...';

  const gamesList = (profile.games || []).map(g => {
    const gameName = escapeMarkdown(g.name);
    const rankName = g.rank_name || 'Без ранга';

    let playtimeStr = '';

    if (steamGames.length > 0) {
      const matchedGame = steamGames.find(sg => {
        return sg.name.toLowerCase().includes(g.name.toLowerCase()) ||
               g.name.toLowerCase().includes(sg.name.toLowerCase());
      });

      if (matchedGame && matchedGame.playtime_hours >= 1) {
        playtimeStr = ` (${matchedGame.playtime_hours} ч)`;
      }
    }

    return `• ${gameName} — ${rankName}${playtimeStr}`;
  }).join('\n') || 'Нет добавленных игр';

  let steamStatsBlock = '';
  if (steamGames.length > 0) {
    const gamesWithHours = steamGames
      .filter(game => game.playtime_hours >= 1)
      .sort((a, b) => b.playtime_hours - a.playtime_hours)
      .slice(0, 5);

    if (gamesWithHours.length > 0) {
      steamStatsBlock = '\n🏆 Активность в Steam:\n\n';
      steamStatsBlock += `🏆 ${escapeMarkdown(gamesWithHours[0].name)} — ${gamesWithHours[0].playtime_hours} ч\n`;
      for (let i = 1; i < gamesWithHours.length; i++) {
        steamStatsBlock += `• ${escapeMarkdown(gamesWithHours[i].name)} — ${gamesWithHours[i].playtime_hours} ч\n`;
      }
    } else {
      steamStatsBlock = '\n🏆 Активность в Steam:\n\nНет данных об активности\n';
    }
  } else {
    steamStatsBlock = '\n🏆 Активность в Steam:\n\nНет данных об активности\n';
  }

  const text = `${premiumBlock}${header}\n\n${nameLine}\n\n📖 О себе:\n${bio}\n\n🎮 Игры:\n${gamesList}\n${steamStatsBlock}`;

  const buttons = [
    [
      Markup.button.callback('❤️ Лайк', 'search_like'),
      Markup.button.callback('❌ Пропустить', 'search_skip')
    ],
    [
      Markup.button.callback('🚫 Жалоба', 'search_report'),
      ...(isPremium ? [Markup.button.callback('🔄 Вернуть', 'search_undo')] : [])
    ],
    [
      Markup.button.callback('⛔ Выйти', 'search_exit')
    ]
  ];

  return { text, buttons };
}
