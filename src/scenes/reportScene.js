import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';
import { logToAdmin } from '../utils/logToAdmin.js';


const reportScene = new Scenes.WizardScene(
    'reportScene',

    // Шаг 0: Подтверждение намерения
    async (ctx) => {
        try {
            await ctx.reply(
                '⚠️ Вы хотите пожаловаться на пользователя. Подтвердите действие:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Подтвердить', 'confirm_report')],
                    [Markup.button.callback('❌ Отмена', 'cancel_report')],
                ])
            );
        } catch (err) {
            console.error('Ошибка отправки кнопок подтверждения:', err);
            await logToAdmin(`❗ Ошибка отправки кнопок подтверждения: ${err.message}`);
        }

    },

    // Шаг 1: Ввод причины
    async (ctx) => {
        if (!ctx.message?.text || ctx.message.text.length > 500) {
            try {
                return ctx.reply('❗ Введите причину (до 500 символов)');
            } catch (err) {
                console.error('Ошибка отправки сообщения', err);
                await logToAdmin(`❗ Ошибка отправки сообщения (шаг 1): ${err.message}`);
            }
        }

        const reason = ctx.message.text.trim();
        const fromTelegramId = ctx.from.id.toString();
        const targetProfileId = ctx.scene.state.reportTargetId;

        let fromId;
        try {
            const res = await db.query(
                'SELECT id FROM profiles WHERE telegram_id = $1',
                [fromTelegramId]
            );
            if (res.rows.length === 0) {
                console.error(`❗ Пользователь ${fromTelegramId} не найден в profiles`);
                await ctx.reply('❗ Ваш профиль отсутствует. Давайте зарегистрируемся заново!');
                return ctx.scene.enter('registrationScene');
            }
            fromId = res.rows[0].id;
        } catch (err) {
            console.error('❗ Ошибка при запросе профиля:', err);
            await logToAdmin(`❗ Ошибка при запросе профиля (reportScene): ${err.message}`);
            return ctx.reply('❗ Произошла ошибка при обработке вашего запроса.');
        }

        try {
            await db.query(`
                INSERT INTO complaints (complainant_profile_id, target_profile_id, reason)
                VALUES ($1, $2, $3)
            `, [fromId, targetProfileId, reason]);
        } catch (err) {
            console.error('❗ Ошибка при вставке жалобы:', err);
            await logToAdmin(`❗ Ошибка при вставке жалобы: ${err.message}`);
            return ctx.reply('❗ Не удалось сохранить вашу жалобу. Попробуйте позже.');
        }


        // Добавим временное скрытие пользователя из поиска (на 7 дней)
        try {
            await db.query(`
                INSERT INTO hidden_after_complaint (from_profile_id, to_profile_id, hidden_until)
                VALUES ($1, $2, NOW() + interval '7 days')
                ON CONFLICT (from_profile_id, to_profile_id) DO UPDATE
                SET hidden_until = NOW() + interval '7 days'
            `, [fromId, targetProfileId]);
        } catch (err) {
            console.error('❗ Ошибка при обновлении скрытия после жалобы:', err);
            await logToAdmin(`❗ Ошибка при обновлении скрытия после жалобы: ${err.message}`);
            return ctx.reply('❗ Не удалось обновить скрытие пользователя. Попробуйте позже.');
        }

        try {
            await ctx.reply('📨 Ваша жалоба отправлена. Спасибо за обратную связь.');
        } catch (err) {
            console.error('Ошибка при отправке сообщения', err);
        }

        // Проверка количества жалоб на пользователя
        let complaintsCount;
        try {
            const res = await db.query(`
                SELECT COUNT(*) FROM complaints WHERE target_profile_id = $1
            `, [targetProfileId]);
            complaintsCount = parseInt(res.rows[0].count);
        } catch (err) {
            console.error('❗ Ошибка при подсчёте жалоб:', err);
            await logToAdmin(`❗ Ошибка при подсчёте жалоб: ${err.message}`);
            return ctx.reply('❗ Не удалось проверить количество жалоб. Попробуйте позже.');
            
        }

        if (parseInt(complaintsCount.rows[0].count) >= 5) {
            try {
                await db.query(`
                    UPDATE profiles SET is_banned = TRUE WHERE id = $1
                `, [targetProfileId]);
            } catch (err) {
                console.error('❗ Ошибка при автоматической блокировке:', err);
                await logToAdmin(`❗ Ошибка при автоматической блокировке: ${err.message}`);
                return ctx.reply('❗ Не удалось заблокировать пользователя. Администратор будет уведомлён.');
            }

            try {
                await ctx.reply('🚫 Пользователь был автоматически заблокирован по количеству жалоб.');
            } catch (err) {
                console.error('Ошибка при отправке сообщения', err);
                await logToAdmin(`❗ Ошибка при отправке сообщения (блокировка): ${err.message}`);
            }
        }


        // Возврат в предыдущую FSM-сцену
        const returnScene = ctx.scene.state.returnTo || 'mainMenuScene';
        return ctx.scene.enter(returnScene);
    }
);

// 🔘 Подтверждение жалобы
reportScene.action('confirm_report', async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    const fromTelegramId = ctx.from.id.toString();
    const targetProfileId = ctx.scene.state.reportTargetId;

    let fromId;
    try {
        const res = await db.query('SELECT id FROM profiles WHERE telegram_id = $1', [fromTelegramId]);
        if (res.rows.length === 0) {
            console.error(`❗ Пользователь ${fromTelegramId} не найден в profiles`);
            return ctx.reply('❗ Ошибка: ваш профиль не найден.');
        }
        fromId = res.rows[0].id;
    } catch (err) {
        console.error('❗ Ошибка при запросе профиля (confirm_report):', err);
        await logToAdmin(`❗ Ошибка при запросе профиля (confirm_report): ${err.message}`);
        return ctx.reply('❗ Произошла ошибка при обработке вашего запроса.');
    }

    let existing;
    try {
        existing = await db.query(`
                SELECT 1 FROM complaints
                WHERE complainant_profile_id = $1 AND target_profile_id = $2
                AND created_at > NOW() - INTERVAL '24 hours'
            `, [fromId, targetProfileId]);
    } catch (err) {
        console.error('❗ Ошибка при проверке предыдущих жалоб:', err);
        return ctx.reply('❗ Не удалось проверить предыдущие жалобы. Попробуйте позже.');
    }

    if (existing.rowCount > 0) {
        try {
            await ctx.reply('⚠️ Вы уже отправляли жалобу на этого пользователя в течение последних 24 часов.');
        } catch (err) {
            console.error('Ошибка при отправке сообщения', err);
        }
        const returnScene = ctx.scene.state.returnTo || 'mainMenuScene';
        return ctx.scene.enter(returnScene);
    }

    try {
        await ctx.answerCbQuery();
        await ctx.reply('✍️ Пожалуйста, напишите причину жалобы (до 500 символов):');
    } catch (err) {
        console.error('Ошибка при отправке сообщения', err);
    }

    return ctx.wizard.next();
});

// ❌ Отмена жалобы
reportScene.action('cancel_report', async (ctx) => {
    if (isCallbackHandled(ctx)) return;
    try {
        await ctx.answerCbQuery('Отмена жалобы');
        await ctx.reply('🚫 Жалоба отменена.');
    } catch (err) {
        console.error('Ошибка при нажатии кнопки', err);
    }

    const returnScene = ctx.scene.state.returnTo || 'mainMenuScene';
    return ctx.scene.enter(returnScene);
});

export default reportScene;