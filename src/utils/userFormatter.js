import moment from 'moment';

/**
 * Форматирует информацию о пользователе для админ-интерфейса.
 * @param {Object} user
 * @returns {string}
 */
export function formatUserInfo(user) {
  const status = user.is_banned && user.ban_expires_at
    ? `🔒 Заблокирован до ${moment(user.ban_expires_at).format('DD.MM.YYYY HH:mm')}`
    : '✅ Активен';

  return `👤 Пользователь: @${user.username || 'не указан'}\n` +
         `🆔 Telegram ID: ${user.telegram_id}\n` +
         `🔒 Статус: ${status}`;
}
