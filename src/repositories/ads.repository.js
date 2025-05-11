import db from '../db.js';

export async function insertAd({ content, link, media, frequency, type }) {
  const result = await db.query(
    `INSERT INTO ads (content, link, media, active, frequency, type)
     VALUES ($1, $2, $3, true, $4, $5) RETURNING *`,
    [content, link, media || null, frequency, type]
  );
  return result.rows[0];
}

export async function getAllAds(type = null) {
  const result = type
    ? await db.query('SELECT * FROM ads WHERE type = $1 ORDER BY id DESC', [type])
    : await db.query('SELECT * FROM ads ORDER BY id DESC');
  return result.rows;
}

export async function deleteAd(id) {
  await db.query('DELETE FROM ads WHERE id = $1', [id]);
}

export async function toggleAd(id) {
  const res = await db.query(
    'UPDATE ads SET active = NOT active WHERE id = $1 RETURNING active',
    [id]
  );
  return res.rows[0]?.active;
}
