# 📄 Business Requirements Document (BRD) — PlayMatesHub

## 1. Название проекта

**PlayMatesHub** — Telegram-бот для поиска тиммейтов по онлайн-играм

---

## 2. Цель проекта

PlayMatesHub — это карманный «Tinder для геймеров», упрощающий поиск тиммейтов для совместной игры.

В отличие от громоздких внешних платформ, бот работает внутри Telegram, предлагая интуитивный, быстрый и понятный способ знакомств в игровом контексте.

---

## 3. Целевая аудитория

- Геймеры, ищущие тиммейтов для ранговых матчей
- Игроки-любители для кооперативных сессий
- Мелкие стримеры и контент-мейкеры
- Люди, ищущие игровые знакомства по интересам

---

## 4. Область действия (Scope)

### ✅ Входит в Scope (реализовано):

- Регистрация профиля: имя, пол, возраст, описание
- Выбор до 3 игр (для премиум — до 6)
- Выбор рангов (если игра поддерживает `has_rank=true`)
- Поиск кандидатов: по играм, возрасту (±2 года), рангам
- Интерфейс свайпа: кнопки `like / skip / report / undo / back`
- Lazy загрузка кандидатов
- Просмотр профиля, отображение лайков и мэтчей
- Возможность изменять/удалять данные профиля
- Подключение Steam
- Telegram Payments: оплата премиума через карту
- Премиум-функции:
    - Приоритетный поиск
    - Расширение профиля (до 6 игр)
    - Участие в ивентах
    - Префикс "Premium"
    - Вкладка “Кого я лайкнул”
- Связь с админом, базовый FAQ
- Редактирование общего списка игр и рангов
- Ручное управление премиумом
- Админ-функции: статистика, блокировки, рассылки
- Сбор и логирование активности

---

## 5. Ограничения

- Продукт работает только в рамках Telegram
- Нет мобильного приложения или десктопного клиента
- Ограниченный бюджет на продвижение
- Сложности при реализации функции “онлайн-статус”

---

## 6. Интеграции и зависимости

- **Steam API** — для получения игрового профиля
- **Telegram Bot API** — основа работы бота
- **PostgreSQL** — база данных
- **Telegram Payments** — монетизация (банковская оплата премиума)

---

## 7. Метрики успеха (KPI)

### 📊 Количественные метрики:

- 87% пользователей завершают регистрацию (на основе логов)
- 50% пользователей используют базовый функционал
- Среднее количество лайков и мэтчей на пользователя

### 📈 Ключевые показатели:

- Общая база зарегистрированных пользователей
- Конверсия из регистрации в мэтч
- Кол-во возвращающихся пользователей (Ret D1/D3)

---

## 8. Бизнес-риски

- ❌ Эффект "пустой комнаты": низкий трафик = низкое вовлечение
- ❌ Бесплатные каналы продвижения часто игнорируются или вызывают агрессию в комьюнити
- ❌ Узкая ниша и отсутствие женской аудитории ограничивают масштаб
- ❌ Зависимость от Telegram: невозможность масштабирования за пределы мессенджера без дополнительных разработок

---

📌 *Версия: май 2025*

✍️ *Автор: Даниил Рогулин*