const ADMIN_IDS = process.env.ADMIN_IDS?.split(',') || [];

/**
 * Middleware: определяет, является ли пользователь админом.
 * Записывает результат в ctx.session и ctx.state.
 */
export default async function roleMiddleware(ctx, next) {
  if (!ctx.from) return next();

  const telegramId = ctx.from.id.toString();

  const isAdmin = ADMIN_IDS.includes(telegramId);

  if (!ctx.session) ctx.session = {};
  ctx.session.isAdmin = isAdmin;

  ctx.state.isAdmin = isAdmin;

  return next();
}
