import db from '../db.js';

export default async function banCheck(ctx, next) {
  if (!ctx.from) return;

  const telegramId = String(ctx.from.id);
  const res = await db.query(
    `SELECT is_banned, ban_expires_at FROM profiles WHERE telegram_id = $1`,
    [telegramId]
  );

  const profile = res.rows[0];
  if (!profile) return next();

  const now = new Date();
  const banEnd = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;

  if (profile.is_banned && (!banEnd || banEnd > now)) {
    await ctx.reply(`⛔ Вы заблокированы до ${banEnd?.toLocaleString() || '∞'}`);
    return; // не пускаем дальше
  }

  if (profile.is_banned && banEnd && banEnd <= now) {
    await db.query(
      `UPDATE profiles SET is_banned = false, ban_expires_at = NULL WHERE telegram_id = $1`,
      [telegramId]
    );
    return next(); // бан истёк — пускаем
  }

  return next(); // всё ок
}
