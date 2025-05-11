import db from '../db.js';

export async function getGamesWithRanksDB() {
  const res = await db.query('SELECT id, name FROM games WHERE has_rank = true ORDER BY name');
  return res.rows;
}

export async function getRanksByGameDB(gameId) {
  const res = await db.query('SELECT id, name FROM ranks WHERE game_id = $1 ORDER BY "order"', [gameId]);
  return res.rows;
}

export async function insertRank(gameId, name) {
  const { rows } = await db.query(
    'SELECT MAX("order") AS max FROM ranks WHERE game_id = $1',
    [gameId]
  );
  const order = (rows[0].max || 0) + 1;
  return db.query('INSERT INTO ranks (game_id, name, "order") VALUES ($1, $2, $3)', [gameId, name, order]);
}

export async function updateRankById(id, name) {
  return db.query('UPDATE ranks SET name = $1 WHERE id = $2', [name, id]);
}

export async function deleteRankById(id) {
  return db.query('DELETE FROM ranks WHERE id = $1', [id]);
}

export async function reorderRank(id, direction) {
  const { rows } = await db.query('SELECT game_id, "order" FROM ranks WHERE id = $1', [id]);
  if (!rows[0]) return;

  const { game_id, order } = rows[0];
  const newOrder = order + direction;

  await db.query('BEGIN');

  const swap = await db.query(
    'UPDATE ranks SET "order" = $1 WHERE game_id = $2 AND "order" = $3 RETURNING id',
    [order, game_id, newOrder]
  );

  if (swap.rowCount) {
    await db.query('UPDATE ranks SET "order" = $1 WHERE id = $2', [newOrder, id]);
  }

  await db.query('COMMIT');
}
