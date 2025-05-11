import {
  getUserByUsernameOrId,
  upsertPremiumUntil,
  removePremiumRecord
} from '../repositories/premium.repository.js';

/**
 * Ищет пользователя по @username или Telegram ID.
 */
export async function findUserByUsernameOrId(input) {
  return getUserByUsernameOrId(input);
}

/**
 * Назначает премиум на указанное количество дней.
 */
export async function grantPremiumDays(telegramId, days) {
  const current = new Date();
  const newUntil = new Date(current.setDate(current.getDate() + days));
  return upsertPremiumUntil(telegramId, newUntil.toISOString());
}

/**
 * Удаляет премиум у пользователя.
 */
export async function revokePremium(telegramId) {
  return removePremiumRecord(telegramId);
}
