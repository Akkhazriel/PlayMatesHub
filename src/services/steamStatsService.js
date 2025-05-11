import db from '../db.js';

/**
 * Получить сохранённые игры и часы по steam_id
 * @param {string} steamId - Steam ID пользователя
 * @returns {Array} Список игр: [{ game_name, playtime_hours }]
 */
export async function getCachedSteamGames(steamId) {
  try {
    const { rows } = await db.query(`
      SELECT game_name, playtime_hours
      FROM steam_stats
      WHERE steam_id = $1
      ORDER BY playtime_hours DESC
      LIMIT 5
    `, [steamId]);

    return rows;
  } catch (error) {
    console.error(`Ошибка при получении Steam игр из БД для ${steamId}:`, error.message);
    return [];
  }
}
