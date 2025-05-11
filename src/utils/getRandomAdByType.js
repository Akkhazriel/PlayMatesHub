import db from '../db.js';

/**
 * Возвращает случайную активную рекламу указанного типа.
 * @param {'entry' | 'search' | 'interval'} type
 * @returns {Promise<Object|null>}
 */
export async function getRandomAdByType(type = 'entry') {
  try {
    const res = await db.query(`
      SELECT * FROM ads
      WHERE active = true AND type = $1
      ORDER BY RANDOM()
      LIMIT 1
    `, [type]);

    return res.rows[0] || null;
  } catch (e) {
    console.error(`Ошибка при получении рекламы типа ${type}:`, e);
    return null;
  }
}

export default getRandomAdByType;
