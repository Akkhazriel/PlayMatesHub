import db from '../db.js';

export async function findUserByClause(clauseObj) {
  const key = Object.keys(clauseObj)[0];
  const val = clauseObj[key];

  const query = `
    SELECT u.telegram_id, u.username, p.is_banned, p.ban_expires_at
    FROM users u
    JOIN profiles p ON u.telegram_id = p.telegram_id
    WHERE u.${key} = $1
    LIMIT 1
  `;
  const res = await db.query(query, [val]);
  return res.rows[0];
}

export async function updateBanStatus(telegramId, banned, interval) {
  if (banned && interval) {
    return db.query(
      `UPDATE profiles 
       SET is_banned = true, ban_expires_at = NOW() + INTERVAL '${interval}'
       WHERE telegram_id = $1`,
      [telegramId]
    );
  } else {
    return db.query(
      `UPDATE profiles 
       SET is_banned = false, ban_expires_at = NULL
       WHERE telegram_id = $1`,
      [telegramId]
    );
  }
}
