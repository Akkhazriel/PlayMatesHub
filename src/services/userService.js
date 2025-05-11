import db from '../db.js';


// Обновить steam_id у пользователя
export async function updateUserSteamId(telegramId, steamId) {
  await db.query(
    `
    UPDATE profiles
    SET steam_id = $1
    WHERE telegram_id = $2
  `,
    [steamId, telegramId]
  );
}
