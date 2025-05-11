import db from '../db.js';

/**
 * Добавляет игру и обновляет профили, если это первая игра.
 * @param {string} name
 * @param {boolean} hasRank
 * @param {Telegraf} bot
 * @returns {Promise<number>} ID новой игры
 */
export async function addGame(name, hasRank, bot) {
  const existing = await db.query('SELECT COUNT(*) FROM games');
  const isFirstGame = parseInt(existing.rows[0].count) === 0;

  const res = await db.query(
    'INSERT INTO games (name, has_rank) VALUES ($1, $2) RETURNING id',
    [name, hasRank]
  );

  const newGameId = res.rows[0].id;

  if (isFirstGame) {
    const profiles = await db.query(`
      SELECT p.id, u.telegram_id
      FROM profiles p
      JOIN users u ON u.telegram_id = p.telegram_id
      LEFT JOIN profile_games pg ON pg.profile_id = p.id
      WHERE pg.id IS NULL
    `);

    for (const profile of profiles.rows) {
      await db.query(
        'INSERT INTO profile_games (profile_id, game_id, rank_id) VALUES ($1, $2, $3)',
        [profile.id, newGameId, null]
      );

      try {
        await bot.telegram.sendMessage(
          profile.telegram_id,
          `🎮 Вам была добавлена игра *${name}* после обновления списка.\nВы можете отредактировать свой профиль в любое время.`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.warn(`❗ Не удалось отправить сообщение пользователю ${profile.telegram_id}`);
      }
    }
  }

  return newGameId;
}
