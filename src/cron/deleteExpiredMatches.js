import db from '../db.js';

/**
 * Удаляет мэтчи, которым больше 14 дней.
 */
export default async function deleteExpiredMatches() {
  try {
    const result = await db.query(
      "DELETE FROM matches WHERE matched_at < NOW() - INTERVAL '14 days' RETURNING id"
    );
    console.log(`🧹 Удалено устаревших мэтчей: ${result.rowCount}`);
  } catch (error) {
    console.error('❌ Ошибка при удалении мэтчей:', error);
  }
}
