import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const STEAM_API_KEY = process.env.STEAM_API_KEY;

if (!STEAM_API_KEY) {
  throw new Error('STEAM_API_KEY не найден в переменных окружения.');
}

export async function getSteamGames(steamId, retries = 3, delayMs = 60000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/', {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          format: 'json',
          include_played_free_games: true,
          include_appinfo: true
        }
      });

      if (response.status === 429) {
        console.warn(`[STEAM_API] 429 Too Many Requests, attempt ${attempt}/${retries}, waiting ${delayMs / 1000}s...`);
        await new Promise(res => setTimeout(res, delayMs));
        continue;
      }

      if (response.data?.response?.games) {
        return response.data.response.games;
      }

      return [];
    } catch (error) {
      if (error.response?.status === 429 && attempt < retries) {
        console.warn(`[STEAM_API] Ошибка 429 (rate limit), попытка ${attempt}/${retries}, ждем ${delayMs / 1000}s...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error(`[STEAM_API] Ошибка получения игр для ${steamId}:`, error.message);
        return [];
      }
    }
  }

  console.error(`[STEAM_API] Все попытки получить данные Steam для ${steamId} исчерпаны.`);
  return [];
}

function extractSteamId(input) {
  const vanityRegex = /https?:\/\/steamcommunity\.com\/id\/([^/]+)/i;
  const profileRegex = /https?:\/\/steamcommunity\.com\/profiles\/(\d{17})/i;

  const vanityMatch = input.match(vanityRegex);
  const profileMatch = input.match(profileRegex);

  if (profileMatch) return profileMatch[1];
  if (vanityMatch) return vanityMatch[1];
  if (/^\d{17}$/.test(input)) return input; // Прямой SteamID64

  return null;
}

export async function getSteamProfile(input) {
  const steamIdOrVanity = extractSteamId(input);

  if (!steamIdOrVanity) {
    throw new Error('Некорректный формат Steam ссылки или ID.');
  }

  let steamId = steamIdOrVanity;

  if (!/^\d{17}$/.test(steamIdOrVanity)) {
    try {
      const { data } = await axios.get('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/', {
        params: { key: STEAM_API_KEY, vanityurl: steamIdOrVanity }
      });

      if (data.response.success !== 1) {
        throw new Error('Не удалось разрешить Vanity URL в Steam ID.');
      }

      steamId = data.response.steamid;
    } catch (err) {
      console.error(`[STEAM_API] Ошибка разрешения Vanity URL (${steamIdOrVanity}):`, err.message);
      throw new Error('Ошибка при разрешении Vanity URL.');
    }
  }

  try {
    const { data } = await axios.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', {
      params: { key: STEAM_API_KEY, steamids: steamId }
    });

    const player = data.response.players[0];

    if (!player) return null;

    return player;
  } catch (err) {
    console.error(`[STEAM_API] Ошибка получения данных профиля для ${steamId}:`, err.message);
    return null;
  }
}
