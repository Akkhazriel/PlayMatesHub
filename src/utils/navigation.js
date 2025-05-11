import db from '../db.js';

export async function exitToMainMenu(ctx) {
  await ctx.scene.leave();
  await ctx.scene.enter('mainMenuScene');
}

export async function getProfileId(ctx) {
  const telegramId = ctx.from?.id?.toString();
  const res = await db.query(`SELECT id FROM profiles WHERE telegram_id = $1`, [telegramId]);
  return res.rows[0]?.id || null;
}
