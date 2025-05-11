import dotenv from 'dotenv';
import { Telegraf, Scenes, session } from 'telegraf';
import cron from 'node-cron';
import sendEntryAd from './cron/entryAdCron.js';
import expirePremiumCheck from './cron/expirePremiumCheck.js';
import db from './db.js';



import roleMiddleware from './middleware/roleMiddleware.js';
import isRegisteredMiddleware from './middleware/isRegisteredMiddleware.js';
import handleStart from './controllers/start.js';
import mainMenuScene from './scenes/mainMenuScene.js';
import registrationScene from './scenes/registrationScene.js';
import searchWizardScene from './scenes/searchWizardScene.js';
import reportScene from './scenes/reportScene.js';
import profileScene from './scenes/profileScene.js';
import editProfileWizardScene from './scenes/editProfileWizardScene.js';
import editGamesScene from './scenes/editGamesScene.js';
import matchListScene from './scenes/matchListScene.js';
import likedByScene from './scenes/likedByScene.js';
import likedToScene from './scenes/likedToScene.js';
import premiumScene from './scenes/premiumScene.js';
import { registerPremiumPaymentHandlers } from './handlers/premiumPaymentHandler.js';
import handleHelp from './controllers/help.js';
import mainMenuKeyboard from './keyboards/mainMenu.js';
import deleteExpiredMatches from './cron/deleteExpiredMatches.js';
import adminPanelScene from './scenes/adminPanelScene.js';
import adminGamesScene from './scenes/adminGamesScene.js';
import adminRanksScene from './scenes/adminRanksScene.js';
import adminPremiumScene from './scenes/adminPremiumScene.js';
import adminBroadcastScene from './scenes/adminBroadcastScene.js';
import adminStatsScene from './scenes/adminStatsScene.js';
import adminBlockScene from './scenes/adminBlockScene.js';
import adminAdsScene from './scenes/adminAdsScene.js';
import linkSteamScene from './scenes/linkSteamScene.js';
import banCheck from './middleware/banCheck.js';
import premiumMiddleware from './middleware/premiumMiddleware.js';
import setProfileIdMiddleware from './middleware/setProfileIdMiddleware.js';
import './cron/adsCron.js';
import updateSteamStats from './cron/updateSteamStats.js';
import unbanExpiredUsers from './cron/unbanExpiredUsers.js';
import { logToAdmin } from './utils/logToAdmin.js';


const bot = new Telegraf(process.env.BOT_TOKEN);

const stage = new Scenes.Stage([
  mainMenuScene,
  registrationScene,
  searchWizardScene,
  reportScene,
  profileScene,
  editProfileWizardScene,
  editGamesScene,
  matchListScene,
  likedByScene,
  likedToScene,
  premiumScene,
  adminPanelScene,
  adminGamesScene,
  adminRanksScene,
  adminPremiumScene,
  adminBroadcastScene,
  adminStatsScene,
  adminBlockScene,
  adminAdsScene,
  linkSteamScene
  // другие сцены
]);

registerPremiumPaymentHandlers(bot);
// Проверка при запуске
expirePremiumCheck();

bot.use(session());
bot.use(premiumMiddleware);         // сначала устанавливаем isPremium
bot.use(stage.middleware());        // только потом — сцены
bot.use(roleMiddleware);
bot.use(isRegisteredMiddleware);
bot.use(banCheck);
bot.use(setProfileIdMiddleware);


bot.start(handleStart);
bot.command('start', async (ctx) => {
  if (ctx.scene?.current) await ctx.scene.leave();
  return handleStart(ctx);
});

bot.hears('🐾 Войти', async (ctx) => {
  await ctx.replyWithMarkdown(
    `Для старта - нужно зарегистрироваться и выбрать игры.\n
    ➡️ Используй кнопки ниже для навигации.\n`
  );

  return ctx.scene.enter('registrationScene');
});

bot.hears('🔍 Поиск тиммейтов', async (ctx) => {
  try {
    await ctx.deleteMessage(); // чтобы не мешало сцене
  } catch (e) {
    console.warn('Не удалось удалить сообщение:', e);
    // иногда Telegram не даёт удалить старое сообщение - это норм
  }
  await ctx.scene.enter('searchWizardScene');
});



bot.hears('ℹ️ О Боте', (ctx) => ctx.reply(
  `🎮 Добро пожаловать в PlayerHub!\n\n` +
  `Этот бот создан, чтобы помочь тебе найти напарников и собрать идеальную команду для онлайн-игр.\n\n` +
  `👥 Общайся, находи единомышленников, формируй пати по интересующим тебя играм.\n` +
  `🏅 Выбирай игры, указывай ранги и фильтруй кандидатов, чтобы находить подходящих тиммейтов.\n` +
  `💎 Оформи премиум, чтобы открыть расширенные возможности: больше игр в профиле, приоритетный поиск, вкладки лайков, участие в ивентах и турнирах.\n\n` +
  `🚀 Начни свой путь уже сейчас — выбирай игры и ищи тиммейтов!\n`
));

bot.command('profile', (ctx) => ctx.scene.enter('profileScene'));
bot.hears('👤 Профиль', (ctx) => ctx.scene.enter('profileScene'));

bot.hears('💎 Премиум', (ctx) => ctx.scene.enter('premiumScene'));


bot.command('menu', (ctx) => ctx.scene.enter('mainMenuScene'));

bot.command('help', handleHelp);
bot.hears('❓ Помощь', handleHelp);

// Возврат в главное меню
bot.hears('⬅️ В главное меню', (ctx) => {
  const isAdmin = ctx.session?.isAdmin || false;
  return ctx.reply('🏠 Главное меню', mainMenuKeyboard(isAdmin));
});

function setupCronJobs() {
  const timezone = 'Europe/Moscow';
  // Раз в 12 часов
  cron.schedule('0 */12 * * *', () => {
    console.log('[CRON] Запуск проверки премиума');
    expirePremiumCheck();
  }, { timezone });

  // Задача каждый день в 14:00, показ рекламы entry
  cron.schedule('0 14 * * *', () => {
    sendEntryAd();
  }, { timezone });

  // Ежедневное обновление статистики Steam в 4:00 утра по серверу
  cron.schedule('0 4 * * *', async () => {
    console.log('[CRON] Запущено обновление Steam статистики.');
    await updateSteamStats();
  }, { timezone });

  cron.schedule('0 */3 * * *', async () => {
    console.log('⏰ Запуск ежедневной рассылки онлайн-числа');

    try {
      const res = await db.query('SELECT telegram_id FROM users');
      const userIds = res.rows.map(r => r.telegram_id);

      const profilesRes = await db.query('SELECT COUNT(*) FROM profiles');
      const totalProfiles = parseInt(profilesRes.rows[0].count, 10);

      const maxOnline = Math.floor(totalProfiles * 0.65);
      const randomOnline = Math.floor(Math.random() * maxOnline) + 1;

      for (const userId of userIds) {
        try {
          await bot.telegram.sendMessage(userId, `🔥 Текущий онлайн: ${randomOnline} игроков`);
        } catch (err) {
          if (err.code === 403 || (err.response && err.response.error_code === 403)) {
            console.warn(`❗ Пользователь ${userId} заблокировал бота.`);
          } else {
            console.error(`❗ Ошибка отправки пользователю ${userId}:`, err);
            if (typeof logToAdmin === 'function') {
              await logToAdmin(`❗ Ошибка отправки пользователю ${userId}: ${err.message}`);
            }
          }
        }
      }

      console.log('✅ Ежедневная рассылка завершена.');
    } catch (err) {
      console.error('❗ Ошибка при выполнении рассылки:', err);
      if (typeof logToAdmin === 'function') {
        await logToAdmin(`❗ Ошибка при выполнении рассылки: ${err.message}`);
      }
    }
  }, { timezone });

  cron.schedule('0 3 * * *', deleteExpiredMatches, { timezone });
  cron.schedule('0 3 * * *', unbanExpiredUsers, { timezone });
}

async function init() {
  try {
    console.log('🔄 Инициализация cron-задач...');
    setupCronJobs();

    console.log('🔄 Запускаю первичную проверку премиум-статусов...');
    await expirePremiumCheck();

    console.log('🔄 Запускаю первичное обновление Steam статистики...');
    await updateSteamStats();

    await bot.launch();
    console.log('🚀 Бот успешно запущен и готов к работе!');

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

  } catch (error) {
    console.error('❗ Ошибка во время инициализации:', error);
    if (typeof logToAdmin === 'function') {
      await logToAdmin(`❗ Критическая ошибка инициализации: ${error.message}`);
    }
    process.exit(1);
  }
}

init();
export default bot;