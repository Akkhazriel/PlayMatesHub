import { Scenes } from 'telegraf';
import mainMenuKeyboard from '../keyboards/mainMenu.js';
import handleHelp from '../controllers/help.js';
import { isAdmin } from '../utils/accessManager.js';
import { logToAdmin } from '../utils/logToAdmin.js';

const mainMenuScene = new Scenes.BaseScene('mainMenuScene');

mainMenuScene.enter(async (ctx) => {
  try {
    await ctx.reply('📍 Главное меню', mainMenuKeyboard(isAdmin(ctx)));
  } catch (err) {
    console.error('Ошибка при выводе главного меню:', err);
    await logToAdmin(`❗ Ошибка при выводе главного меню (mainMenuScene): ${err.message}`);
  }
});

mainMenuScene.hears('🔍 Поиск тиммейтов', async (ctx) => {
  try {
    await ctx.scene.enter('searchWizardScene');
  } catch (err) {
    console.error('Ошибка перехода в поиск:', err);
    await logToAdmin(`❗ Ошибка перехода в поиск (mainMenuScene): ${err.message}`);
  }
});

mainMenuScene.hears('👤 Профиль', async (ctx) => {
  try {
    await ctx.scene.enter('profileScene');
  } catch (err) {
    console.error('Ошибка перехода в профиль:', err);
    await logToAdmin(`❗ Ошибка перехода в профиль (mainMenuScene): ${err.message}`);
  }
});

mainMenuScene.hears('💎 Премиум', async (ctx) => {
  try {
    await ctx.scene.enter('premiumScene');
  } catch (err) {
    console.error('Ошибка перехода в премиум-сцену:', err);
    await logToAdmin(`❗ Ошибка перехода в премиум-сцену (mainMenuScene): ${err.message}`);
  }
});

mainMenuScene.hears('❓ Помощь', handleHelp);

mainMenuScene.hears('🛠 Админ-панель', async (ctx) => {
  try {
    if (!isAdmin(ctx)) {
      return await ctx.reply('❌ У вас нет доступа к админ-панели.');
    }
    await ctx.scene.enter('adminPanelScene');
  } catch (err) {
    console.error('Ошибка перехода в админ-панель:', err);
    await logToAdmin(`❗ Ошибка перехода в админ-панель (mainMenuScene): ${err.message}`);
    await ctx.reply('⚠️ Не удалось открыть админ-панель.');
  }
});

export default mainMenuScene;
