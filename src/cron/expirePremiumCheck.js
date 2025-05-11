import db from '../db.js';
import bot from '../bot.js';

export default async function expirePremiumCheck() {
  try {
    const now = new Date();

    const result = await db.query(`
      WITH expired AS (
        SELECT pr.profile_id, pr.expires_at, u.telegram_id
        FROM premium pr
        JOIN profiles p ON pr.profile_id = p.id
        JOIN users u ON p.telegram_id = u.telegram_id
        WHERE pr.expires_at < $1
      )
      DELETE FROM premium
      USING expired
      WHERE premium.profile_id = expired.profile_id
      RETURNING expired.profile_id, expired.telegram_id
    `, [now]);

    console.log(`🧹 Удалено истекших подписок: ${result.rowCount}`);

    for (const row of result.rows) {
      console.log(`⛔ Премиум удалён у profile_id=${row.profile_id}`);

      try {
        await bot.telegram.sendMessage(
          row.telegram_id,
          '💡 Ваша премиум-подписка завершена. Вы можете продлить её в разделе «💎 Премиум».'
        );
      } catch (err) {
        console.warn(`⚠️ Не удалось уведомить ${row.telegram_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Ошибка при удалении истекших премиум-записей:', err.message);
  }
}
