import { Scenes, Markup } from 'telegraf';
import {
  saveAd,
  getAdsList,
  removeAd,
  switchAdStatus
} from '../services/ads.service.js';

import {
  buildAdPreview,
  buildAdTypeLabel
} from '../utils/adFormatter.js';

import {
  mainKeyboard,
  buildAdTypeButtons
} from '../keyboards/adminAds.js';

import { validateUrl } from '../utils/validators.js';
import { isCallbackHandled } from '../utils/callbackGuard.js';

import { logScene } from '../scenes/sceneLogger.js';

const adminAdsScene = new Scenes.WizardScene(
  'adminAdsScene',

  // Шаг 0: Главное меню
  async (ctx) => {
    logScene('adminAdsScene', 'Сцена открыта админом.');
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      if (!ctx.session.isAdmin) {
        await ctx.reply('❌ Доступ запрещен.');
        return;
      }
      ctx.session.adDraft = {};
      await ctx.reply('📢 Управление рекламой:', mainKeyboard());
      return ctx.wizard.next();
    } finally {
      ctx.session.isProcessing = false;
    }
  },

  // Шаг 1: Обработка команды
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      const input = ctx.message?.text;
      console.log('[adminAdsScene] Получено:', input);

      if (!input) {
        return ctx.wizard.selectStep(1);
      }

      if (input === '➕ Добавить новую') {
        console.log('[adminAdsScene] Переход к шагу 2 (ввод текста)');
        ctx.wizard.state.editingAd = null;
        await ctx.reply('✍ Введите текст рекламного сообщения:');
        return ctx.wizard.selectStep(2);
      }

      if (input === '⬅️ Назад') {
        await ctx.scene.enter('adminPanelScene');
        return;
      }

      if (['📂 Все', '👣 Entry', '🔍 Search', '⏱ Interval'].includes(input)) {
        let type = null;
        if (input === '👣 Entry') type = 'entry';
        if (input === '🔍 Search') type = 'search';
        if (input === '⏱ Interval') type = 'interval';

        const ads = await getAdsList(type);
        if (ads.length === 0) {
          await ctx.reply('❗️ Объявления не найдены.');
        } else {
          for (const ad of ads) {
            await ctx.reply(buildAdPreview(ad), {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✏ Редактировать', callback_data: `edit_ad_${ad.id}` }],
                  [{ text: ad.active ? '🚫 Выключить' : '✅ Включить', callback_data: `toggle_ad_${ad.id}` }],
                  [{ text: '🗑 Удалить', callback_data: `delete_ad_${ad.id}` }],
                ]
              }
            });
          }
        }

        return ctx.wizard.selectStep(1);
      }

      await ctx.reply('⚠ Неизвестная команда. Выберите из меню.');
      return ctx.wizard.selectStep(1);
    } finally {
      ctx.session.isProcessing = false;
    }
  },

  // Шаг 2: Ввод текста
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      const input = ctx.message?.text;
      if (!input) {
        await ctx.reply('Введите текст объявления.');
        return;
      }

      ctx.session.adDraft.content = input;
      await ctx.reply('Выберите тип объявления:', adTypeKeyboard());
      return ctx.wizard.selectStep(3);
    } finally {
      ctx.session.isProcessing = false;
    }
  },

  // Шаг 3: Выбор типа объявления
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      if (!ctx.session.adDraft) {
        await ctx.reply('❗️ Данные объявления не найдены. Вернитесь в начало.');
        return;
      }

      const input = ctx.message?.text;
      if (!input) {
        await ctx.reply('Выберите тип объявления.');
        return;
      }

      if (!['👣 Entry', '🔍 Search', '⏱ Interval'].includes(input)) {
        await ctx.reply('❗️ Неверный тип. Выберите один из предложенных вариантов.');
        return;
      }

      if (input === '👣 Entry') ctx.session.adDraft.type = 'entry';
      if (input === '🔍 Search') ctx.session.adDraft.type = 'search';
      if (input === '⏱ Interval') ctx.session.adDraft.type = 'interval';

      await ctx.reply('Если хотите добавить медиа, отправьте файл сейчас. Если нет — отправьте "-"');
      return ctx.wizard.selectStep(4);
    } finally {
      ctx.session.isProcessing = false;
    }
  },

  // Шаг 4: Загрузка медиа
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      const fileId = ctx.message?.photo?.pop()?.file_id ||
        ctx.message?.document?.file_id ||
        ctx.message?.video?.file_id ||
        ctx.message?.animation?.file_id;

      if (fileId) {
        ctx.session.adDraft.media = fileId;
        await ctx.reply('Медиа добавлено ✅. Отправьте ссылку (или "-" если не требуется):');
        return ctx.wizard.selectStep(5);
      }

      const input = ctx.message?.text;
      if (!input) {
        await ctx.reply('Отправьте медиафайл или "-" чтобы пропустить.');
        return;
      }

      if (input === '-') {
        await ctx.reply('Медиа не добавлено. Отправьте ссылку (или "-" если не требуется):');
        return ctx.wizard.selectStep(5);
      }

      await ctx.reply('❗️ Неизвестный формат. Отправьте файл или "-"');
      return ctx.wizard.selectStep(4);
    } finally {
      ctx.session.isProcessing = false;
    }
  },


  // Шаг 5: Ссылка
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      const input = ctx.message?.text;
      if (!input) {
        await ctx.reply('Отправьте ссылку (или "-" если не требуется):');
        return;
      }

      if (input === '-') {
        ctx.session.adDraft.link = null;
      } else if (!validateUrl(input)) {
        await ctx.reply('❗️ Некорректный URL. Введите корректную ссылку или "-" чтобы пропустить.');
        return;
      } else {
        ctx.session.adDraft.link = input;
      }

      await ctx.reply('Введите частоту показа (в минутах, от 1 до 1440):');
      return ctx.wizard.selectStep(6);
    } finally {
      ctx.session.isProcessing = false;
    }
  },

  // Шаг 6: Частота
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      const input = ctx.message?.text;
      const freq = parseInt(input);
      if (isNaN(freq) || freq < 1 || freq > 1440) {
        await ctx.reply('❗️ Введите число от 1 до 1440.');
        return;
      }

      ctx.session.adDraft.frequency = freq;
      await ctx.reply(buildAdPreview(ctx.session.adDraft), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Сохранить', callback_data: 'ad_save' }],
            [{ text: '✏ Редактировать', callback_data: 'ad_edit' }],
            [{ text: '❌ Отменить', callback_data: 'ad_cancel' }]
          ]
        }
      });

      return ctx.wizard.selectStep(7);
    } finally {
      ctx.session.isProcessing = false;
    }
  },


  // Шаг 7: Предпросмотр
  async (ctx) => {
    if (ctx.session.isProcessing) return;
    ctx.session.isProcessing = true;
    try {
      await ctx.reply(buildAdPreview(ctx.session.adDraft), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Сохранить', callback_data: 'ad_save' }],
            [{ text: '✏ Редактировать', callback_data: 'ad_edit' }],
            [{ text: '❌ Отменить', callback_data: 'ad_cancel' }]
          ]
        }
      });

      return ctx.wizard.selectStep(7);
    } finally {
      ctx.session.isProcessing = false;
    }
  },

);

// ==== ACTIONS ====

adminAdsScene.action(/^ad_type_(entry|search|interval)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const type = ctx.match[1];
  ctx.session.adDraft.type = type;
  await ctx.answerCbQuery();
  try { await ctx.editMessageReplyMarkup(); } catch { }
  await ctx.reply('📎 Отправьте медиа или напишите "нет":');
  return ctx.wizard.selectStep(4);
});

adminAdsScene.action('ad_save', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery();
  const ad = ctx.session.adDraft;

  if (!ad || !ad.content || !ad.type || !ad.frequency) {
    return ctx.reply('❌ Недостаточно данных. Отмена.');
  }

  try {
    await saveAd(ad); // <== теперь универсальная функция
    ctx.session.adDraft = null;
    ctx.wizard.state.editingAd = null;
    try { await ctx.deleteMessage(); } catch { }
    await ctx.reply('✅ Реклама сохранена.');
    return ctx.wizard.selectStep(0);
  } catch (err) {
    console.error('Ошибка сохранения рекламы:', err);
    return ctx.reply('❌ Ошибка при сохранении.');
  }
});

adminAdsScene.action('ad_edit', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('✍ Введите новый текст рекламного сообщения:');
  return ctx.wizard.selectStep(2);
});

adminAdsScene.action('ad_cancel', async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  await ctx.answerCbQuery('❌ Отменено');
  ctx.session.adDraft = null;
  try { await ctx.editMessageText('❌ Добавление рекламы отменено.'); } catch { }
  return ctx.wizard.selectStep(0);
});

adminAdsScene.action(/^ad_delete_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const id = parseInt(ctx.match[1], 10);
  try {
    await removeAd(id);
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🗑 Реклама ID ${id} удалена.`);
  } catch (err) {
    console.error('Ошибка удаления рекламы:', err);
    await ctx.answerCbQuery('❌ Ошибка удаления.');
  }
});

adminAdsScene.action(/^ad_toggle_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const id = parseInt(ctx.match[1], 10);
  try {
    const active = await switchAdStatus(id);
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🔄 Реклама ID ${id} теперь ${active ? '✅ активна' : '🚫 отключена'}.`);
  } catch (err) {
    console.error('Ошибка переключения:', err);
    await ctx.answerCbQuery('❌ Не удалось переключить.');
  }
});

adminAdsScene.action(/^edit_ad_(\d+)$/, async (ctx) => {
  if (isCallbackHandled(ctx)) return;
  const id = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery();

  const ads = await getAdsList(); // получим все рекламы
  const ad = ads.find(a => a.id === id);
  if (!ad) {
    return ctx.reply('❌ Реклама не найдена.');
  }

  ctx.session.adDraft = { ...ad };
  ctx.wizard.state.editingAd = id;

  try { await ctx.deleteMessage(); } catch { }

  await ctx.reply('✍ Введите новый текст рекламы:');
  return ctx.wizard.selectStep(2); // переход к шагу редактирования текста
});

export default adminAdsScene;