import db from '../db.js';

export default async function isRegisteredMiddleware(ctx, next) {
  const telegramId = ctx.from?.id?.toString();

  // 1. Пользователь уже внутри любой сцены (в том числе регистрации) — пропускаем
  if (ctx.scene?.session) {
    return next();
  }

  // 2. Команды, доступные до регистрации
  if (ctx.message && ['/start', '🚀 Зарегистрироваться', 'ℹ️ О боте'].includes(ctx.message.text)) {
    return next();
  }

  // 3. Проверка регистрации
  const res = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);

  if (!res.rowCount) {
    await ctx.reply('❗ Пожалуйста, сначала зарегистрируйтесь.');

    // Безопасно вызываем переход в сцену, только если scene инициализирован
    if (ctx.scene?.enter) {
      return ctx.scene.enter('registrationScene');
    }

    return; // просто выходим, если сцена недоступна
  }

  ctx.state.user = res.rows[0];
  return next();
}
