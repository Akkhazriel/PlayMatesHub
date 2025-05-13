import { Scenes } from 'telegraf';
import db from '../db.js';
import { profileMenuKeyboard } from '../keyboards/profileKeyboards.js';
import { isPremiumActive } from '../utils/premium.js';
import formatTavernCard from '../utils/formatTavernCard.js';
import { logToAdmin } from '../utils/logToAdmin.js';

const profileScene = new Scenes.BaseScene('profileScene');

profileScene.enter(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    let user;
    try {
      const res = await db.query(`
      SELECT 
        p.id, 
        p.name, 
        p.age, 
        p.gender, 
        p.bio,
        p.steam_id,
        pr.expires_at,
        COALESCE(
          ARRAY_AGG(DISTINCT g.name || ' — ' || COALESCE(r.name, 'Без ранга')) FILTER (WHERE g.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS games
      FROM profiles p
      LEFT JOIN premium pr ON pr.profile_id = p.id
      LEFT JOIN profile_games pg ON pg.profile_id = p.id
      LEFT JOIN games g ON g.id = pg.game_id
      LEFT JOIN ranks r ON r.id = pg.rank_id
      WHERE p.telegram_id = $1
      GROUP BY p.id, pr.expires_at
    `, [telegramId]);

      if (res.rows.length === 0) {
        console.warn(`❗ Профиль не найден для telegramId: ${telegramId}`);
        await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируем вас заново!');
        return ctx.scene.enter('registrationScene');
      }
      user = res.rows[0];
    } catch (err) {
      console.error('[profileScene] Ошибка при запросе профиля:', err);
      await logToAdmin(`❗ Ошибка при запросе профиля (profileScene): ${err.message}`);
      await ctx.reply('⚠️ Не удалось загрузить профиль.');
      return;
    }

    if (!user) return await ctx.reply('❌ Профиль не найден.');

    // 👇 ДОБАВИТЬ ЭТО
    user.is_premium = user.expires_at && new Date(user.expires_at) > new Date();

    const isPremium = isPremiumActive(user);
    ctx.state.isPremium = isPremium;
    ctx.session.isPremium = isPremium;

    // ⬇️ Добавляем загрузку Steam игр
    let steamGames = [];
    if (user.steam_id) {
      try {
        const { rows } = await db.query(
          'SELECT appid, game_name, playtime_hours FROM steam_stats WHERE steam_id = $1',
          [user.steam_id]
        );
        steamGames = rows;
      } catch (err) {
        console.error(`❗ Ошибка при запросе Steam-игр для steam_id: ${user.steam_id}`, err);
        // Не уведомляем пользователя — просто показываем профиль без этих данных
        steamGames = [];
      }
    }

    const text = formatTavernCard(user, {
      isOwner: true,
      premiumUntil: user.expires_at,
      showContacts: true, 
      steamGames // ⬅️ Передаём!
    });

    try {
      await ctx.replyWithMarkdown(text, profileMenuKeyboard(isPremium));
    } catch (err) {
      console.error('Ошибка при отправке текста', err);
      await logToAdmin(`❗ Ошибка при отправке текста (profileScene): ${err.message}`);
    }
  } catch (err) {
    console.error('[profileScene] Ошибка при загрузке профиля:', err);
    await logToAdmin(`❗ Ошибка при загрузке профиля (profileScene, верхний catch): ${err.message}`);
    try {
      await ctx.reply('⚠️ Не удалось загрузить профиль');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (profileScene, верхний catch): ${err.message}`);
    }
  }
});

profileScene.hears('✏️ Редактировать', (ctx) => ctx.scene.enter('editProfileWizardScene'));
profileScene.hears('💬 Мои мэтчи', (ctx) => ctx.scene.enter('matchListScene'));
profileScene.hears('👁 Кто меня лайкнул', (ctx) => ctx.scene.enter('likedByScene'));

profileScene.hears('📌 Кого я лайкнул', async (ctx) => {
  if (!ctx.session?.isPremium) {
    try {
      return await ctx.reply('🔒 Эта функция доступна только премиум-пользователям.');
    } catch (error) {
      console.error('Ошибка при отправке сообщения', error)
    }
  }
  return ctx.scene.enter('likedToScene');
});

profileScene.hears('🔗 Привязать Steam-профиль', (ctx) => ctx.scene.enter('linkSteamScene'));


profileScene.hears('⬅️ В главное меню', (ctx) => ctx.scene.enter('mainMenuScene'));

export default profileScene;
