import db from '../db.js';

/**
 * Возвращает список пользователей для рассылки:
 * - все (если null)
 * - по ID игры
 * - или список игр (если gamesList)
 */
export async function getUsersForBroadcast(gameIdOrType) {
  if (gameIdOrType === 'gamesList') {
    const res = await db.query('SELECT id, name FROM games ORDER BY name');
    return res.rows;
  }

  if (gameIdOrType === null) {
    const res = await db.query(`
      SELECT u.telegram_id FROM users u
      JOIN profiles p ON u.telegram_id = p.telegram_id
      WHERE p.is_banned = false
    `);
    return res.rows.map(u => u.telegram_id);
  }

  const res = await db.query(`
    SELECT DISTINCT u.telegram_id FROM users u
    JOIN profiles p ON u.telegram_id = p.telegram_id
    JOIN profile_games pg ON p.id = pg.profile_id
    WHERE pg.game_id = $1 AND p.is_banned = false
  `, [gameIdOrType]);

  return res.rows.map(u => u.telegram_id);
}

/**
 * Рассылает сообщение пользователям, учитывая антифлуд.
 */
export async function sendBroadcastToUsers(userIds, text, telegram) {
  let success = 0;
  let failed = 0;

  for (const uid of userIds) {
    try {
      await telegram.sendMessage(uid, text, { parse_mode: 'MarkdownV2' });
      await new Promise(res => setTimeout(res, 50)); // антифлуд
      success++;
    } catch (err) {
      console.error(`❌ UID ${uid}: ${err.message}`);
      failed++;
    }
  }

  return { success, failed };
}
