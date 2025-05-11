import db from '../db.js';

export async function loadCandidates(profileId, gameId, ownRank, ageMin, ageMax, excludedIds, hasRank) {
  const baseValues = [profileId, gameId, ageMin, ageMax];
  const conditions = [
      `p.id != $1`,
      `pg.game_id = $2`,
      `p.age BETWEEN $3 AND $4`,
      `p.is_banned = false`,
      `p.id NOT IN (
          SELECT to_profile_id
          FROM likes
          WHERE from_profile_id = $1
      )`,
      `p.id NOT IN (
          SELECT to_profile_id
          FROM skips
          WHERE from_profile_id = $1
            AND created_at >= NOW() - INTERVAL '12 hours'
      )`
  ];

  let paramIndex = 5;

  if (hasRank && ownRank !== null) {
    conditions.push(`(pg.rank_id IS NULL OR ABS(pg.rank_id - $${paramIndex}) <= 1)`);
    baseValues.push(ownRank);
    paramIndex++;
  }

  if (excludedIds.length > 0) {
    const excludedPlaceholders = excludedIds.map((_, i) => `$${paramIndex + i}`);
    conditions.push(`p.id NOT IN (${excludedPlaceholders.join(', ')})`);
    baseValues.push(...excludedIds);
  }

  const query = `
    SELECT p.id, p.name, p.age, p.bio, p.gender, p.steam_id, u.telegram_id,
          g.name AS game_name,
          r.name AS rank_name,
          CASE WHEN pr.expires_at > NOW() THEN true ELSE false END AS is_premium,
          p.is_banned
    FROM profiles p
    JOIN users u ON u.telegram_id = p.telegram_id
    JOIN profile_games pg ON pg.profile_id = p.id
    JOIN games g ON pg.game_id = g.id
    LEFT JOIN ranks r ON r.id = pg.rank_id
    LEFT JOIN premium pr ON pr.profile_id = p.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY pr.expires_at DESC NULLS LAST, RANDOM()
    LIMIT 50
  `;

  const res = await db.query(query, baseValues);
  return res.rows;
}

export async function logSearch(profileId, candidateId, action) {
  try {
    await db.query(`
      INSERT INTO search_logs (profile_id, target_profile_id, action)
      VALUES ($1, $2, $3)
    `, [profileId, candidateId, action]);
  } catch (err) {
    console.warn('Не удалось записать лог поиска:', err.message);
  }
}

export async function fakeLikeOnly(fromId, toId) {
  try {
    await db.query(`
      INSERT INTO likes (from_profile_id, to_profile_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [fromId, toId]);
  } catch (err) {
    console.error('[matchService] fakeLikeOnly error:', err);
  }
}
