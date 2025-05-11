import { Scenes } from 'telegraf';
import { getSteamProfile, getSteamGames } from '../utils/steamApi.js';
import { updateUserSteamId } from '../services/userService.js';
import db from '../db.js';
import { logToAdmin } from '../utils/logToAdmin.js';

const linkSteamScene = new Scenes.BaseScene('linkSteamScene');

linkSteamScene.enter(async (ctx) => {
  const telegramId = ctx.from.id.toString();

  try {
    const { rows } = await db.query('SELECT id, steam_id FROM profiles WHERE telegram_id = $1', [telegramId]);
    const profile = rows[0];

    if (!profile) {
      try {
        await ctx.reply('❌ Профиль не найден. Пожалуйста, зарегистрируйтесь.');
      } catch (err) {
        console.error('Ошибка отправки сообщения', err);
      }
      return ctx.scene.enter('registrationScene');
    }

    if (profile.steam_id) {
      try {
        await ctx.reply('✅ У вас уже привязан Steam-профиль. Для смены обратитесь к администратору.');
      } catch (err) {
        console.error('Ошибка отправки сообщения', err);
      }
      return ctx.scene.leave();
    }

    await ctx.reply('🔗 Пожалуйста, отправьте ссылку на ваш профиль Steam или ваш Steam ID.');
  } catch (err) {
    console.error('[linkSteamScene] Ошибка при входе в сцену:', err);
    await logToAdmin(`❗ Ошибка при входе в сцену (linkSteamScene): ${err.message}`);
    try {
      await ctx.reply('⚠️ Произошла ошибка при проверке профиля. Попробуйте позже.');
    } catch (err) {
      console.error('Ошибка отправки сообщения', err);
      await logToAdmin(`❗ Ошибка отправки сообщения (linkSteamScene, профиль не найден, enter): ${err.message}`);
    }
    return ctx.scene.leave();
  }
});


async function saveSteamGames(steamId) {
  try {
    const games = await getSteamGames(steamId);

    if (!games.length) {
      console.warn(`Нет игр у steam_id: ${steamId}`);
      return;
    }

    // Очищаем старые записи
    await db.query('DELETE FROM steam_stats WHERE steam_id = $1', [steamId]);

    const inserts = [];
    const params = [];
    let index = 1;

    for (const game of games) {
      inserts.push(`($${index++}, $${index++}, $${index++}, $${index++})`);
      params.push(steamId, game.appid, game.name, Math.round((game.playtime_forever || 0) / 60 * 10) / 10);
    }

    await db.query(
      `INSERT INTO steam_stats (steam_id, appid, game_name, playtime_hours) VALUES ${inserts.join(',')}`,
      params
    );

    console.log(`Игры Steam сохранены для пользователя: ${steamId}`);
  } catch (error) {
    console.error(`Ошибка сохранения Steam игр для ${steamId}:`, error.message);
    await logToAdmin(`❗ Ошибка сохранения Steam игр (linkSteamScene, steamId: ${steamId}): ${error.message}`);
  }
}

linkSteamScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim();

  try {
    const steamData = await getSteamProfile(input);

    if (!steamData) {
      try {
        await ctx.reply('❗ Профиль не найден. Убедитесь, что вы отправили правильную ссылку или Steam ID.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, профиль не найден, on text): ${err.message}`);
      }
      return;
    }

    if (steamData.communityvisibilitystate !== 3) { // 3 = публичный профиль
      try {
        await ctx.reply('🔒 Ваш профиль закрыт. Откройте его в настройках Steam, чтобы привязать.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, уже привязан Steam, on text): ${err.message}`);
      }
      return;
    }

    const telegramId = ctx.from.id.toString();
    const newSteamId = steamData.steamid;

    // 1. Проверяем профиль пользователя
    const { rows } = await db.query('SELECT id, steam_id FROM profiles WHERE telegram_id = $1', [telegramId]);
    const profile = rows[0];

    if (!profile) {
      try {
        await ctx.reply('❌ Профиль не найден. Пожалуйста, зарегистрируйтесь.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, Steam занят другим): ${err.message}`);
      }
      return ctx.scene.leave();
    }

    // 2. Проверяем, привязан ли уже Steam у пользователя
    if (profile.steam_id) {
      try {
        await ctx.reply('✅ У вас уже привязан Steam-профиль. Для смены обратитесь к администратору.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, после привязки): ${err.message}`);
      }
      return ctx.scene.leave();
    }

    // 3. Проверяем, не занят ли этот Steam другим пользователем
    const { rows: existingSteamUsers } = await db.query(
      'SELECT telegram_id FROM profiles WHERE steam_id = $1',
      [newSteamId]
    );

    if (existingSteamUsers.length > 0) {
      try {
        await ctx.reply('❗ Этот Steam-аккаунт уже используется другим пользователем. Обратитесь в поддержку.');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, внутри главного catch): ${err.message}`);
      }
      return ctx.scene.leave();
    }

    // 4. Всё ок — привязываем Steam ID
    await updateUserSteamId(telegramId, newSteamId);

    // 5. Сохраняем игры в steam_stats
    await saveSteamGames(newSteamId);

    // 6. Выдаём премиум на 4 дня
    await db.query(`
      INSERT INTO premium (profile_id, expires_at)
      VALUES ((SELECT id FROM profiles WHERE telegram_id = $1), NOW() + INTERVAL '4 days')
      ON CONFLICT (profile_id) 
      DO UPDATE SET expires_at = GREATEST(premium.expires_at, NOW() + INTERVAL '4 days')
      `, [telegramId]);

      try {
        await ctx.reply('✅ Ваш Steam-профиль успешно привязан!\n\n🎉 Вы получили 4 дня премиум-статуса и повышенное доверие при поиске тиммейтов!');
      } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
        await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, внутри главного catch): ${err.message}`);
      }
    return ctx.scene.leave();

  } catch (error) {
    console.error('Ошибка привязки Steam:', error);
    await logToAdmin(`❗ Ошибка привязки Steam (linkSteamScene): ${error.message}`);
    try {
      await ctx.reply('⚠️ Произошла ошибка при попытке привязать ваш профиль Steam. Попробуйте позже.');
    } catch (err) {
      console.error('Ошибка при отправке сообщения', err);
      await logToAdmin(`❗ Ошибка при отправке сообщения (linkSteamScene, внутри главного catch): ${err.message}`);
    }
    return ctx.scene.leave();
  }
});

linkSteamScene.on('message', (ctx) => ctx.reply('❗ Пожалуйста, отправьте только текстовую ссылку или Steam ID.'));

export default linkSteamScene;
