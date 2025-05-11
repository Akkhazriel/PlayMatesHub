// accessManager.js — централизованное управление правами доступа
let adminIds = new Set();

// Загрузка из ENV при старте
function loadFromEnv() {
  const ids = process.env.ADMIN_IDS
    ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
    : [];
  adminIds = new Set(ids);
  console.log(`🔐 Загружено ${adminIds.size} админов из ENV`);
}

// Проверка: является ли пользователь админом
export function isAdmin(telegramId) {
  return adminIds.has(telegramId.toString());
}

// Принудительное обновление (например, через команду)
export function updateAdminIds(newIds) {
  adminIds = new Set(newIds.map(id => id.toString()));
  console.log(`🔁 Список админов обновлён: ${[...adminIds].join(', ')}`);
}

// Получение текущего списка (например, для вывода)
export function getAdminIds() {
  return [...adminIds];
}

// Первичная инициализация
loadFromEnv();
