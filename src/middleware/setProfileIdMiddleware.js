import db from '../db.js';

/**
 * Middleware: подставляет profileId в ctx.session, если он отсутствует.
 */
export default async function setProfileIdMiddleware(ctx, next) {
  try {
    if (!ctx.from || ctx.session?.profileId) return next();

    const telegramId = ctx.from.id.toString();

    const res = await db.query(
      'SELECT id FROM profiles WHERE telegram_id = $1',
      [telegramId]
    );

    if (res.rows[0]) {
      ctx.session.profileId = res.rows[0].id;
    }

    return next();
  } catch (error) {
    console.error('[setProfileIdMiddleware] Ошибка:', error);
    return next();
  }
}
