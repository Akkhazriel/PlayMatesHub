import { findUserByClause, updateBanStatus } from '../repositories/user.repository.js';

/**
 * Поиск пользователя по username или telegram_id
 */
export async function findUserForAdmin(identifier) {
  const clause = identifier.startsWith('@')
    ? { username: identifier.slice(1) }
    : /^\d+$/.test(identifier)
      ? { telegram_id: identifier }
      : null;

  if (!clause) return null;
  return await findUserByClause(clause);
}

/**
 * Забанить пользователя на N дней
 */
export async function blockUser(telegramId, days) {
  const interval = days === 9999 ? '100 years' : `${days} days`;
  return await updateBanStatus(telegramId, true, interval);
}

/**
 * Разбанить пользователя
 */
export async function unblockUser(telegramId) {
  return await updateBanStatus(telegramId, false, null);
}
