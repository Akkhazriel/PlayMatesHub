import { Scenes, Markup } from 'telegraf';
import db from '../db.js';
import { validateName, validateAge, validateBio } from '../utils/validators.js';
import { logToAdmin } from '../utils/logToAdmin.js';


const getMainKeyboard = () => Markup.keyboard([
  ['✏️ Имя', '📅 Возраст'],
  ['👤 Пол', '💬 Описание'],
  ['🎮 Игры и ранги'],
  ['🔙 В главное меню']
]).resize();

const editProfileWizardScene = new Scenes.WizardScene(
  'editProfileWizardScene',

  // Шаг 0: Главное меню редактирования
  async (ctx) => {
    try {
      await ctx.reply('🛠 Что вы хотите отредактировать?', getMainKeyboard());
    } catch (err) {
      console.error('Ошибка при отправке сообщение', err);
    }
    return ctx.wizard.next();
  },

  // Шаг 1: Обработка выбора
  async (ctx) => {
    const choice = ctx.message?.text;

    switch (choice) {
      case '✏️ Имя':
        ctx.wizard.state.editing = 'name';
        try {
          await ctx.reply('Введите новое имя (до 50 символов):');
        } catch (err) {
          console.error('Ошибка при отправке сообщение', err);
        }
        return ctx.wizard.selectStep(2);

      case '📅 Возраст':
        ctx.wizard.state.editing = 'age';
        try {
          await ctx.reply('Введите новый возраст (от 12 до 99):');
        } catch (err) {
          console.error('Ошибка при отправке сообщение', err);
        }
        return ctx.wizard.selectStep(2);

      case '👤 Пол':
        ctx.wizard.state.editing = 'gender';
        try {
          await ctx.reply('Выберите пол:', Markup.inlineKeyboard([
            [Markup.button.callback('👨 Мужской', 'gender_male')],
            [Markup.button.callback('👩 Женский', 'gender_female')],
            [Markup.button.callback('❓ Не указывать', 'gender_unspecified')],
            [Markup.button.callback('⬅️ Назад', 'back_to_main')]
          ]));
        } catch (err) {
          console.error('Ошибка при отправке сообщение', err);
        }
        return;

      case '💬 Описание':
        ctx.wizard.state.editing = 'bio';
        try {
          await ctx.reply('Введите описание (до 300 символов):');
        } catch (err) {
          console.error('Ошибка при отправке сообщение', err);
        }
        return ctx.wizard.selectStep(2);

      case '🎮 Игры и ранги':
        return ctx.scene.enter('editGamesScene');

      case '🔙 В главное меню':
        return ctx.scene.enter('profileScene');

      default:
        try {
          return ctx.reply('❌ Неверный выбор. Пожалуйста, используйте кнопки.');
        } catch (err) {
          console.error('Ошибка при отправке сообщение', err);
        }
    }
  },

  // Шаг 2: Обработка ввода текста
  async (ctx) => {
    const value = ctx.message?.text?.trim();
    const { editing } = ctx.wizard.state;
    const telegramId = ctx.from.id.toString();

    if (value === '🔙 В главное меню') {
      return ctx.scene.enter('profileScene');
    }

    try {
      if (editing === 'name') {
        if (!validateName(value)) {
          try {
            return ctx.reply('❌ Имя должно содержать только буквы и пробелы, до 50 символов.');
          } catch (err) {
            console.error('Ошибка при отправке сообщение', err);
          }
        }
        try {
          await db.query('UPDATE profiles SET name = $1 WHERE telegram_id = $2', [value, telegramId]);
          await ctx.reply('✅ Имя обновлено!');
        } catch (err) {
          console.error('Ошибка при обновлении имени:', err);
          await logToAdmin(`❗ Ошибка при обновлении имени (editProfileWizardScene): ${err.message}`);
          await ctx.reply('⚠️ Не удалось обновить имя. Попробуйте позже.');
          return ctx.scene.enter('editProfileWizardScene');
        }

      }

      else if (editing === 'age') {
        const age = parseInt(value, 10);
        if (!validateAge(age)) {
          try {
            return ctx.reply('❌ Возраст должен быть числом от 12 до 99.');
          } catch (err) {
            console.error('Ошибка при отправке сообщение', err);
            await logToAdmin(`❗ Ошибка при отправке сообщение (editProfileWizardScene): ${err.message}`);
          }
        }
        try {
          await db.query('UPDATE profiles SET age = $1 WHERE telegram_id = $2', [age, telegramId]);
          await ctx.reply('✅ Возраст обновлён!');
        } catch (err) {
          console.error('Ошибка при обновлении возраста:', err);
          await logToAdmin(`❗ Ошибка при обновлении возраста (editProfileWizardScene): ${err.message}`);
          await ctx.reply('⚠️ Не удалось обновить возраст. Попробуйте позже.');
          return ctx.scene.enter('editProfileWizardScene');
        }

      }

      else if (editing === 'bio') {
        if (!validateBio(value)) {
          try {
            return ctx.reply('❌ Описание должно быть до 300 символов.');
          } catch (err) {
            console.error('Ошибка при отправке сообщение', err);
          }
        }
        try {
          await db.query('UPDATE profiles SET bio = $1 WHERE telegram_id = $2', [value, telegramId]);
          await ctx.reply('✅ Описание обновлено!');
        } catch (err) {
          console.error('Ошибка при обновлении описания:', err);
          await logToAdmin(`❗ Ошибка при обновлении описания (editProfileWizardScene): ${err.message}`);
          await ctx.reply('⚠️ Не удалось обновить описание. Попробуйте позже.');
          return ctx.scene.enter('editProfileWizardScene');
        }

      }

      return ctx.scene.enter('editProfileWizardScene');
    } catch (err) {
      console.error('Ошибка при обновлении данных:', err);
      await logToAdmin(`❗ Ошибка при обновлении данных (editProfileWizardScene): ${err.message}`);
      try {
        return ctx.reply('⚠️ Не удалось сохранить изменения. Попробуйте позже.');
      } catch (err) {
        console.error('Ошибка при отправке сообщение', err);
      }
    }
  }
);

// Inline: установка пола
editProfileWizardScene.action(/^gender_(male|female|unspecified)$/, async (ctx) => {
  const gender = ctx.match[1];
  const telegramId = ctx.from.id.toString();

  try {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(null).catch((err) => {
      if (!err.description?.includes('message is not modified')) {
        console.error('Ошибка очистки кнопок:', err);
        logToAdmin(`❗ Ошибка очистки кнопок (editProfileWizardScene): ${err.message}`);
      }
    });

    try {
      await db.query('UPDATE profiles SET gender = $1 WHERE telegram_id = $2', [gender, telegramId]);
      await ctx.reply('✅ Пол обновлён!');
    } catch (err) {
      console.error('Ошибка при обновлении пола:', err);
      await logToAdmin(`❗ Ошибка при обновлении пола (editProfileWizardScene, основной блок): ${err.message}`);
      await ctx.reply('⚠️ Не удалось обновить пол. Попробуйте позже.');
      return ctx.scene.enter('editProfileWizardScene');
    }

    try {
      await ctx.reply('🛠 Что вы хотите отредактировать?', getMainKeyboard());
    } catch (err) {
      console.error('Ошибка при отправке сообщение', err);
    }
    return ctx.wizard.selectStep(1);
  } catch (err) {
    console.error('Ошибка при обновлении пола:', err);
    try {
      return ctx.reply('⚠️ Не удалось сохранить пол. Попробуйте позже.');
    } catch (err) {
      console.error('Ошибка при отправке сообщение', err);
    }
  }
});

// Inline: возврат назад
editProfileWizardScene.action('back_to_main', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null).catch((err) => {
    if (!err.description?.includes('message is not modified')) {
      console.error('Ошибка очистки reply_markup:', err);
      logToAdmin(`❗ Ошибка очистки reply_markup (editProfileWizardScene): ${err.message}`);
    }
  });
  try {
    await ctx.reply('🛠 Что вы хотите отредактировать?', getMainKeyboard());
  } catch (err) {
    console.error('Ошибка при отправке сообщение', err);
  }
  return ctx.wizard.selectStep(1);
});

export default editProfileWizardScene;