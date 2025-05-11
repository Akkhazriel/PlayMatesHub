import bot from '../bot.js';
import dotenv from 'dotenv';

dotenv.config(); // Подгружаем переменные из .env

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

export async function logToAdmin(message) {
    if (process.env.NODE_ENV !== 'production') return; // пропускаем в dev
    try {
        await bot.telegram.sendMessage(ADMIN_TELEGRAM_ID, message);
    } catch (err) {
        console.error('❗ Ошибка при отправке логов администратору:', err);
    }
}
