import { Scenes, Markup } from 'telegraf';

const adminPanelScene = new Scenes.BaseScene('adminPanelScene');

const adminSections = [
  { label: '🕹 Редактировать игры', scene: 'adminGamesScene' },
  { label: '🏅 Редактировать ранги', scene: 'adminRanksScene' },
  { label: '💎 Премиум', scene: 'adminPremiumScene' },
  { label: '📢 Реклама', scene: 'adminAdsScene' },
  { label: '📊 Статистика', scene: 'adminStatsScene' },
  { label: '📬 Рассылка', scene: 'adminBroadcastScene' },
  { label: '⛔ Блокировка пользователя', scene: 'adminBlockScene' },
];

adminPanelScene.enter(async (ctx) => {
  if (!ctx.session.isAdmin) {
    return ctx.reply('❌ У вас нет доступа к админ-панели.');
  }

  const keyboard = [
    ['🕹 Редактировать игры', '🏅 Редактировать ранги'],
    ['💎 Премиум', '📢 Реклама'],
    ['📊 Статистика', '📬 Рассылка'],
    ['⛔ Блокировка пользователя'],
    ['⬅️ В главное меню']
  ];

  await ctx.reply(
    '🛠 Добро пожаловать в админ-панель. Выберите раздел:',
    Markup.keyboard(keyboard).resize()
  );
});

adminPanelScene.hears('⬅️ В главное меню', (ctx) => ctx.scene.enter('mainMenuScene'));

// Автоматическая генерация переходов
adminSections.forEach(({ label, scene }) => {
  adminPanelScene.hears(label, (ctx) => ctx.scene.enter(scene));
});

export default adminPanelScene;
