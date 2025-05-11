import db from '../db.js';

export async function getUserByUsernameOrId(identifier) {
  const baseQuery = `
    SELECT 
      u.telegram_id, 
      u.username, 
      p.expires_at AS premium_until
    FROM users u
    LEFT JOIN profiles pr ON pr.telegram_id = u.telegram_id
    LEFT JOIN premium p ON p.profile_id = pr.id
    WHERE %s
  `;

  if (identifier.startsWith('@')) {
    const username = identifier.slice(1).toLowerCase();
    const query = baseQuery.replace('%s', 'LOWER(u.username) = $1');
    const res = await db.query(query, [username]);
    return res.rows[0];
  } else {
    const id = parseInt(identifier, 10);
    if (isNaN(id)) return null;

    const query = baseQuery.replace('%s', 'u.telegram_id = $1');
    const res = await db.query(query, [id]);
    return res.rows[0];
  }
}

export async function upsertPremiumUntil(telegramId, untilDateISO) {
  const profileRes = await db.query(
    'SELECT id FROM profiles WHERE telegram_id = $1',
    [telegramId]
  );
  const profile = profileRes.rows[0];
  if (!profile) throw new Error('Профиль не найден');

  return db.query(`
    INSERT INTO premium (profile_id, expires_at)
    VALUES ($1, $2)
    ON CONFLICT (profile_id) DO UPDATE SET expires_at = EXCLUDED.expires_at
  `, [profile.id, untilDateISO]);
}

export async function removePremiumRecord(telegramId) {
  const profileRes = await db.query(
    'SELECT id FROM profiles WHERE telegram_id = $1',
    [telegramId]
  );
  const profile = profileRes.rows[0];
  if (!profile) throw new Error('Профиль не найден');

  return db.query('DELETE FROM premium WHERE profile_id = $1', [profile.id]);
}
