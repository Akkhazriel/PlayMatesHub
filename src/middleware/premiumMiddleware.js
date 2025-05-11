import db from '../db.js';
import { isPremiumActive } from '../utils/premium.js';

export default async function premiumMiddleware(ctx, next) {
  try {
    if (!ctx.session) ctx.session = {};
    if (!ctx.from) return next();

    const telegramId = ctx.from.id.toString();

    const { rows } = await db.query(`
      SELECT pr.expires_at
      FROM profiles p
      LEFT JOIN premium pr ON pr.profile_id = p.id
      WHERE p.telegram_id = $1
    `, [telegramId]);

    const premiumRow = rows[0] ?? {}; // безопасно, даже если rows пустой

    ctx.session.isPremium = isPremiumActive(premiumRow);
  } catch (err) {
    console.warn('premiumMiddleware error:', err.message);
    ctx.session = ctx.session || {};
    ctx.session.isPremium = false;
  }

  return next();
}
