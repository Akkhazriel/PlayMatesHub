import db from '../db.js';
import fs from 'fs';
import path from 'path';

/**
 * Разблокирует пользователей, срок бана которых истёк, и логирует их.
 */
export default async function unbanExpiredUsers() {
  try {
    const { rows } = await db.query(`
      UPDATE profiles
      SET is_banned = false, ban_expires_at = NULL
      WHERE is_banned = true AND ban_expires_at <= NOW()
      RETURNING id, telegram_id
    `);

    console.log(`[CRON] ✅ Разблокировано: ${rows.length}`);

    if (rows.length > 0) {
      const logDir = path.resolve('logs');
      const logPath = path.join(logDir, 'unbans.log');

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
      }

      const now = new Date().toISOString();
      const lines = rows.map(row =>
        `[${now}] Разблокирован профиль: id=${row.id}, telegram_id=${row.telegram_id}`
      ).join('\n') + '\n';

      fs.appendFileSync(logPath, lines, 'utf-8');
    }
  } catch (err) {
    console.error('[CRON] ❌ Ошибка при разблокировке:', err);
  }
}
