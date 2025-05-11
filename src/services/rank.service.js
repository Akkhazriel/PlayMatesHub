import {
  getGamesWithRanksDB,
  getRanksByGameDB,
  insertRank,
  updateRankById,
  deleteRankById,
  reorderRank
} from '../repositories/rank.repository.js';

export async function getGamesWithRanks() {
  return getGamesWithRanksDB();
}

export async function getRanksByGame(gameId) {
  return getRanksByGameDB(gameId);
}

export async function createRank(gameId, name) {
  return insertRank(gameId, name);
}

export async function updateRank(id, name) {
  return updateRankById(id, name);
}

export async function deleteRank(id) {
  return deleteRankById(id);
}

export async function moveRank(id, direction) {
  return reorderRank(id, direction);
}
