import {
    getGames,
    getGame,
    insertGame,
    updateGameData,
    deleteGameById,
    findDuplicateName
  } from '../repositories/game.repository.js';
  
  export async function getAllGames() {
    return await getGames();
  }
  
  export async function getGameById(id) {
    return await getGame(id);
  }
  
  export async function createGame(name, hasRank) {
    return await insertGame(name, hasRank);
  }
  
  export async function updateGame(id, name, hasRank) {
    return await updateGameData(id, name, hasRank);
  }
  
  export async function deleteGame(id) {
    return await deleteGameById(id);
  }
  
  export async function isDuplicateName(name, excludeId) {
    return await findDuplicateName(name, excludeId);
  }
  