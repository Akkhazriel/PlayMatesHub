// Регулярное выражение для валидации имени
const nameRegex = /^[A-Za-zА-Яа-яЁё\s]{1,50}$/;

// Максимальные значения
const bioMaxLength = 300;
const minAge = 12;
const maxAge = 99;

/**
 * Проверка имени — только буквы, пробелы, до 50 символов
 */
export function validateName(name) {
  return typeof name === 'string' && nameRegex.test(name.trim());
}

/**
 * Проверка возраста — число от 12 до 99
 */
export function validateAge(age) {
  return Number.isInteger(age) && age >= minAge && age <= maxAge;
}

/**
 * Проверка био — строка до 300 символов
 */
export function validateBio(bio) {
  return typeof bio === 'string' && bio.trim().length <= bioMaxLength;
}

/**
 * Проверка URL — http/https
 */
export function validateUrl(str) {
  try {
    const url = new URL(str);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Проверка количества выбранных игр в зависимости от премиум-статуса
 */
export function validateGameSelection(selectedGames, isPremium) {
  if (!Array.isArray(selectedGames)) return false;
  const limit = isPremium ? 6 : 3;
  return selectedGames.length >= 1 && selectedGames.length <= limit;
}

/**
 * Проверка, что для каждой игры с has_rank = true выбран корректный ранг
 */
export function validateRankSelection(selectedRanks, selectedGamesWithRanks) {
  return selectedGamesWithRanks.every((game) => {
    const rank = selectedRanks[game.id];
    if (rank === null) return true; // "Без ранга" — допустимо
    return game.availableRanks.some((r) => r.id === rank); // выбранный ранг существует у игры
  });
}
