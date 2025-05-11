import { Markup } from 'telegraf';
/**
 * Обработчик команды /help или кнопки "❓ Помощь"
 */
export default async function handleHelp(ctx) {
  const helpText =
    '🤖 *Что умеет бот:*\n' +
    '• Поиск тиммейтов по играм, возрасту и рангу\n' +
    '• Регистрация с профилем и фильтрами\n' +
    '• Лайки, мэтчи, жалобы, симпатии\n' +
    '• Премиум-функции для расширенного доступа\n' +
    '✅ *Как пользоваться:*\n' +
    '• Начните с регистрации через /start\n' +
    '• Используйте кнопки меню для навигации\n' +
    '• Лайкайте тиммейтов и получайте мэтчи\n' +
    '• Хотите больше функций — оформите премиум\n\n' +
    '⚠️ *Если возникли проблемы:*\n' +
    '• Попробуйте перезапустить бот — /start\n' +
    '• Или напишите администратору';

    const adminUsername = process.env.ADMIN_USERNAME?.split(',')[0];
    const contactAdminUrl = adminUsername ? `https://t.me/${adminUsername}` : 'https://t.me/';
    

  const chunks = splitMessage(helpText, 4000);
  for (const chunk of chunks) {
    await ctx.replyWithMarkdown(chunk);
  }

  await ctx.replyWithMarkdown(
    'Если остались вопросы — нажмите ниже:',
    Markup.inlineKeyboard([
      Markup.button.url('✉️ Связаться с админом', contactAdminUrl)
    ])
  );

  await ctx.reply(
    'Выберите действие:',
    Markup.keyboard([['⬅️ В главное меню']]).resize()
  );
}

function splitMessage(text, limit) {
  const lines = text.split('\n');
  const chunks = [];
  let buffer = '';

  for (const line of lines) {
    if ((buffer + '\n' + line).length > limit) {
      chunks.push(buffer);
      buffer = line;
    } else {
      buffer += (buffer ? '\n' : '') + line;
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}
