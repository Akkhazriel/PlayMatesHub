import db from '../db.js';
import { getSteamGames } from '../utils/steamApi.js';

// безопасная задержка между запросами
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function updateSteamStats() {
  console.log('[CRON] ▶️ Начало обновления Steam статистики.');

  try {
    const { rows: profiles } = await db.query(`
      SELECT steam_id FROM profiles WHERE steam_id IS NOT NULL
    `);

    let totalInserted = 0;

    for (const profile of profiles) {
      const steamId = profile.steam_id;

      try {
        const games = await getSteamGames(steamId);
        await delay(100); // пауза для избежания rate-limit
      
        if (!Array.isArray(games) || games.length === 0) {
          console.log(`[CRON] Нет игр для ${steamId}, старые данные не тронуты.`);
          continue; // пропускаем профиль, данные не обновляем и НЕ УДАЛЯЕМ
        }
      
        const filtered = games.filter(g => g.playtime_forever > 0 && g.name && g.appid);
      
        if (filtered.length === 0) {
          console.log(`[CRON] Нет подходящих игр для ${steamId}, старые данные не тронуты.`);
          continue; // ничего удалять и записывать не нужно
        }
      
        // ✅ только тут удаляем, потому что точно есть что вставить
        await db.query(`DELETE FROM steam_stats WHERE steam_id = $1`, [steamId]);
      
        for (const game of filtered) {
          await db.query(
            `INSERT INTO steam_stats (steam_id, appid, game_name, playtime_hours)
             VALUES ($1, $2, $3, $4)`,
            [steamId, game.appid, game.name, game.playtime_forever / 60]
          );
        }
      
        totalInserted += filtered.length;
        console.log(`[CRON] Обновлены игры для ${steamId} (${filtered.length})`);
      } catch (err) {
        console.error(`[CRON] Ошибка для ${steamId}:`, err.message);
      }
    }

    console.log(`[CRON] ✅ Обновление завершено. Всего добавлено записей: ${totalInserted}`);
  } catch (error) {
    console.error('[CRON] ❌ Ошибка общего cron Steam:', error.message);
  }
}
