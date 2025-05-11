import db from '../db.js';

export async function getGames() {
  const res = await db.query('SELECT id, name, has_rank FROM games ORDER BY name');
  return res.rows;
}

export async function getGame(id) {
  const res = await db.query('SELECT id, name, has_rank FROM games WHERE id = $1', [id]);
  return res.rows[0];
}

export async function insertGame(name, hasRank) {
  return db.query(`
    INSERT INTO games (name, has_rank)
    VALUES ($1, $2)
    ON CONFLICT (name) DO NOTHING
  `, [name, hasRank]);
}

export async function updateGameData(id, name, hasRank) {
  return db.query('UPDATE games SET name = $1, has_rank = $2 WHERE id = $3', [name, hasRank, id]);
}

export async function deleteGameById(id) {
  return db.query('DELETE FROM games WHERE id = $1', [id]);
}

export async function findDuplicateName(name, excludeId) {
  const res = await db.query('SELECT 1 FROM games WHERE name = $1 AND id != $2', [name, excludeId]);
  return res.rowCount > 0;
}
