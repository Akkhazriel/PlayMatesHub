import { escapeMarkdown } from './escapeMarkdown.js';

export function formatTavernCard(user, { showContacts = false, isOwner = false, premiumUntil = null, steamGames = [] } = {}) {
  const genderMap = {
    male: 'Мужской',
    female: 'Женский',
    other: 'Другое'
  };

  let header = `${user.name}, ${user.age}`;
  const gender = genderMap[user.gender] || 'Не указано';
  header += `, ${gender}`;

  if (user.steam_id) {
    header += ' ✅🎮';
  }

  const bio = user.bio || '...';

  // 🎮 Формируем список выбранных игр без дублей и подтягиваем часы из Steam
  let gamesText = 'Нет добавленных игр';

  if (user.games && Array.isArray(user.games) && user.games.length > 0) {
    // Нормализуем игры
    const normalizedGames = user.games.map(g => (typeof g === 'string' ? { name: g } : g));
    const seenNames = new Set();
    const uniqueGames = [];

    for (const game of normalizedGames) {
      if (game.name && !seenNames.has(game.name)) {
        uniqueGames.push(game);
        seenNames.add(game.name);
      }
    }

    if (uniqueGames.length > 0) {
      gamesText = uniqueGames.map(game => {
        let line = `• ${escapeMarkdown(game.name)}`;
        if (game.rank) {
            line += ` — ${game.rank}`;
        }

        const normalize = str => str.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, '').trim();
        const normalizedProfileName = normalize(game.name);

        const matchingSteamGame = steamGames.find(sg => {
          const normalizedSteamName = sg.game_name ? normalize(sg.game_name) : '';
          return normalizedSteamName.startsWith(normalizedProfileName) || normalizedProfileName.startsWith(normalizedSteamName);
        });

        if (matchingSteamGame && matchingSteamGame.playtime_hours > 0) {
          const hours = Math.round(matchingSteamGame.playtime_hours);
          line += ` (${hours} ч)`;
        }

        return line;
      }).join('\n');
    }
  }

  // 🏆 Формируем список топ-игр из Steam
  let steamActivityText = 'Нет данных об активности';
  if (steamGames && steamGames.length > 0) {
    const sorted = steamGames
      .filter(g => g.playtime_hours > 0 && g.game_name && g.game_name.trim() !== '')
      .sort((a, b) => b.playtime_hours - a.playtime_hours)
      .slice(0, 5);

    if (sorted.length > 0) {
      steamActivityText = sorted.map((g, idx) => {
        const gameName = g.game_name ? escapeMarkdown(g.game_name) : 'Без названия';
        const hours = g.playtime_hours.toFixed(1);
        if (idx === 0) {
          return `🏆 *${gameName}* — *${hours} ч*`;
        }
        return `• ${gameName} — ${hours} ч`;
      }).join('\n');
    }
  }

  const status = user.isBanned ? '🚫 Пользователь заблокирован' : '';

  let contactBlock = '';
  if (showContacts) {
    if (user.username) {
      contactBlock += `📩 [Связаться в Telegram](https://t.me/${escapeMarkdown(user.username)})\n`;
    }
    if (user.steam_id) {
      contactBlock += `✅ [Профиль в Steam](https://steamcommunity.com/profiles/${user.steam_id})\n`;
    }
    if (contactBlock) {
      contactBlock += `\n`;
    }
  }

  let premiumBlock = '';
  if (user.is_premium) {
    premiumBlock = '━━━━━━━━━━━━━━━━━━━\n🏆 Премиум-профиль\n━━━━━━━━━━━━━━━━━━━\n\n';
  }

  return (
    premiumBlock +
    `📜 ${isOwner ? 'Твой профиль' : 'Профиль игрока'}:\n\n` +
    `*${escapeMarkdown(header)}*\n\n` +
    `📖 *О себе:*\n${escapeMarkdown(bio)}\n\n` +
    `🎮 *Игры:*\n${gamesText}\n\n` +
    `🏆 *Активность в Steam:*\n\n${steamActivityText}\n\n` +
    contactBlock +
    status
  );
}

export default formatTavernCard;
