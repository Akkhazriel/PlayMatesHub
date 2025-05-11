import db from '../db.js';

export async function findUserWithProfile(identifier) {
  const isUsername = identifier.startsWith('@');
  const query = isUsername
    ? `
      SELECT u.telegram_id, u.username, p.id AS profile_id
      FROM users u
      LEFT JOIN profiles p ON p.telegram_id = u.telegram_id
      WHERE LOWER(u.username) = LOWER($1)
    `
    : `
      SELECT u.telegram_id, u.username, p.id AS profile_id
      FROM users u
      LEFT JOIN profiles p ON p.telegram_id = u.telegram_id
      WHERE u.telegram_id = $1
    `;

  const value = isUsername ? identifier.slice(1) : identifier;
  const res = await db.query(query, [value]);
  return res.rows[0];
}

export async function getPremiumStatus(profileId) {
  const res = await db.query(
    `SELECT expires_at FROM premium WHERE profile_id = $1`,
    [profileId]
  );
  return res.rows[0] || null;
}

export async function countUserMatches(profileId) {
  const res = await db.query(
    `SELECT COUNT(*) FROM matches WHERE user1_profile_id = $1 OR user2_profile_id = $1`,
    [profileId]
  );
  return parseInt(res.rows[0].count, 10);
}

export async function countUserLikes(profileId) {
  const res = await db.query(
    `SELECT COUNT(*) FROM likes WHERE from_profile_id = $1`,
    [profileId]
  );
  return parseInt(res.rows[0].count, 10);
}

export async function countUserComplaints(profileId) {
  const res = await db.query(
    `SELECT COUNT(*) FROM complaints WHERE complainant_profile_id = $1`,
    [profileId]
  );
  return parseInt(res.rows[0].count, 10);
}

export async function countUserEvents(profileId) {
  const res = await db.query(
    `SELECT COUNT(*) FROM stats WHERE profile_id = $1`,
    [profileId]
  );
  return parseInt(res.rows[0].count, 10);
}

export async function getGlobalStats() {
  const queries = await Promise.all([
    db.query(`SELECT COUNT(*) FROM users`),
    db.query(`SELECT COUNT(*) FROM profiles`),
    db.query(`SELECT COUNT(*) FROM profiles WHERE is_banned = false`),
    db.query(`SELECT COUNT(*) FROM profiles WHERE is_banned = true`),
    db.query(`SELECT COUNT(*) FROM premium WHERE expires_at > NOW()`),
    db.query(`SELECT COUNT(*) FROM matches`),
    db.query(`SELECT COUNT(*) FROM likes`),
    db.query(`SELECT COUNT(*) FROM complaints`),
    db.query(`SELECT COUNT(*) FROM stats`)
  ]);

  return {
    users: parseInt(queries[0].rows[0].count, 10),
    profiles: parseInt(queries[1].rows[0].count, 10),
    activeProfiles: parseInt(queries[2].rows[0].count, 10),
    bannedProfiles: parseInt(queries[3].rows[0].count, 10),
    premiumUsers: parseInt(queries[4].rows[0].count, 10),
    matches: parseInt(queries[5].rows[0].count, 10),
    likes: parseInt(queries[6].rows[0].count, 10),
    complaints: parseInt(queries[7].rows[0].count, 10),
    statsEvents: parseInt(queries[8].rows[0].count, 10),
  };
}
