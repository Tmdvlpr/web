# CorpMeet — План разработки и разделение ответственности

> **Тимур** — Web-фронтенд + бэкенд (FastAPI, React, PostgreSQL)
> **Коллега** — TG-часть (aiogram бот, Mini App фронтенд, фоновые задачи)

---

## Полный список эндпоинтов

### Публичные эндпоинты `/api/v1/` — используют JWT Bearer

| Метод | Путь | Описание | Статус | Кто вызывает |
|-------|------|----------|--------|--------------|
| POST | `/auth/register` | Регистрация через initData | ✅ Тимур | Mini App |
| POST | `/auth/login` | Вход через initData | ✅ Тимур | Mini App |
| POST | `/auth/browser/session` | Создать одноразовый токен для браузера | ✅ Тимур | Mini App |
| GET | `/auth/session/{token}` | Обменять токен на JWT (браузер) | ✅ Тимур | Web Browser |
| GET | `/auth/me` | Текущий пользователь | ✅ Тимур | Mini App + Web |
| POST | `/auth/dev-login` | Dev-логин без Telegram | ✅ Тимур | Dev только |
| GET | `/bookings` | Список встреч по дате | ✅ Тимур | Mini App + Web |
| GET | `/bookings/active` | Активные встречи (30 дней) | ✅ Тимур | Mini App + Web |
| POST | `/bookings` | Создать встречу (+ серия) | ✅ Тимур | Mini App + Web |
| PATCH | `/bookings/{id}` | Изменить встречу | ✅ Тимур | Mini App + Web |
| DELETE | `/bookings/{id}` | Удалить встречу (soft-delete) | ✅ Тимур | Mini App + Web |
| GET | `/bookings/export` | Экспорт ICS (личный) | ✅ Тимур | Web |
| GET | `/bookings/feed/{token}` | Публичный iCal-фид | ✅ Тимур | Календарь |
| GET | `/bookings/admin/all` | Все встречи (админ) | ✅ Тимур | Web |
| GET | `/slots?date=` | Свободные слоты на день | ✅ Тимур | Mini App + Web |
| GET | `/users/me` | Профиль пользователя | ✅ Тимур | Mini App + Web |
| GET | `/users/search?q=` | Поиск пользователей | ✅ Тимур | Mini App + Web |
| POST | `/users/feed-token` | Получить feed-токен | ✅ Тимур | Web |
| GET | `/users/admin/users` | Список юзеров (админ) | ✅ Тимур | Web |
| PATCH | `/users/admin/users/{id}/role` | Сменить роль (админ) | ✅ Тимур | Web |
| POST | `/users/admin/users` | Создать пользователя (админ) | ✅ Тимур | Web |
| DELETE | `/users/admin/users/{id}` | Удалить пользователя (админ) | ✅ Тимур | Web |
| GET | `/users/admin/stats` | Статистика (админ) | ✅ Тимур | Web |

### Внутренние эндпоинты `/api/v1/internal/` — используют `X-Bot-Secret`

| Метод | Путь | Описание | Статус | Кто вызывает |
|-------|------|----------|--------|--------------|
| GET | `/internal/bookings/since?updated_at=` | Встречи, изменённые после метки | ✅ Тимур | TG Bot задача |
| GET | `/internal/bookings/reminders` | Встречи для напоминания (14-16 мин) | ✅ Тимур | TG Bot задача |
| POST | `/internal/bookings/{id}/mark-reminded` | Пометить reminder_sent = true | ✅ Тимур | TG Bot задача |
| GET | `/internal/bookings/deleted-since?since=` | Встречи, удалённые после метки (soft-delete) | ✅ Тимур | TG Bot задача |
| POST | `/internal/users/ensure` | Создать юзера из Telegram данных | ✅ Тимур | TG Bot хендлер |
| GET | `/internal/users/by-username/{username}` | telegram_id по @username | ✅ Тимур | TG Bot задача |
| POST | `/internal/auth/consume-session` | QR/deep-link авторизация | ✅ Тимур | TG Bot хендлер |

---

## Разделение зон ответственности

### Тимур: Web + Бэкенд — ✅ ВСЁ ГОТОВО

**Бэкенд (FastAPI):**
- ✅ FastAPI приложение (`app/main.py`, lifespan с миграциями + запуском бота)
- ✅ Публичные роутеры: `auth.py`, `bookings.py`, `slots.py`, `users.py` — 23 эндпоинта
- ✅ Внутренний роутер: `internal.py` — 7 эндпоинтов для бота
- ✅ Модели ORM: `User`, `Booking`, `BrowserSession`
- ✅ Soft-delete для bookings (`deleted_at` колонка, фильтрация во всех запросах)
- ✅ Сервисы: `auth_service.py`, `slot_service.py`
- ✅ Конфигурация: `config.py` с `BOT_SECRET`, `TG_GROUP_CHAT_ID`, `INTERNAL_API_URL`
- ✅ База данных: `database.py`, все миграции в lifespan
- ✅ `.env` настроен: `BOT_SECRET`, `TG_GROUP_CHAT_ID`, `INTERNAL_API_URL`
- ✅ Зависимости `aiogram` и `httpx` установлены

**Фронтенд (React + TypeScript + Vite):**
- ✅ Календарь (недельный вид, 7:00–22:00, drag-and-drop перенос встреч)
- ✅ Создание/редактирование/удаление встреч (BookingModal)
- ✅ Серийные встречи (daily / weekly / custom weekdays)
- ✅ Автодополнение гостей
- ✅ Подсветка свободных слотов
- ✅ Скелетон-лоадеры, оптимистичные обновления
- ✅ Уведомления (NotificationCenter) + Web Notifications
- ✅ Экспорт iCal + подписка на фид
- ✅ Админ-панель (статистика, управление пользователями и ролями, создание/удаление юзеров)
- ✅ Dev-логин (для тестирования без Telegram)
- ✅ Тёмная/светлая тема
- ✅ Шрифты: Manrope + Unbounded

**Скелет бота (для коллеги):**
- ✅ `app/bot/bot.py` — инициализация aiogram Bot + Dispatcher
- ✅ `app/bot/handlers/start.py` — хендлеры /start и /chatid (через httpx)
- ✅ `app/bot/tasks/notifications.py` — задача уведомлений (через httpx)
- ✅ `app/bot/tasks/reminders.py` — задача напоминаний (через httpx)

---

### Коллега: TG Bot + Mini App — ⏳ В РАБОТЕ

**Уже готов скелет (написал Тимур):**
- `app/bot/bot.py` — инициализация бота
- `app/bot/handlers/start.py` — /start, /chatid
- `app/bot/tasks/notifications.py` — фоновая задача уведомлений
- `app/bot/tasks/reminders.py` — фоновая задача напоминаний

**Что нужно доработать коллеге:**

#### Этап 2. Проверка и доработка бота
- [ ] Отправить /start боту — убедиться что юзер создаётся через `/internal/users/ensure`
- [ ] Создать встречу через Web — проверить что уведомление приходит в группу
- [ ] Создать встречу через 15 мин — дождаться напоминания
- [ ] Проверить QR-авторизацию: /start {token} → `/internal/auth/consume-session`
- [ ] Доработать шаблоны уведомлений — тексты сообщений, кнопки (InlineKeyboard)
- [ ] Добавить уведомление об отмене встречи — использовать `GET /internal/bookings/deleted-since`

#### Этап 3. Mini App фронтенд
- [ ] Настроить React-проект для Mini App (отдельный `tg/frontend/`)
- [ ] Авторизация через `initData` → POST `/api/v1/auth/register` и `/auth/login`
- [ ] Экран календаря — GET `/api/v1/bookings`, GET `/api/v1/slots`
- [ ] Создание встречи — POST `/api/v1/bookings`
- [ ] Редактирование/удаление — PATCH/DELETE `/api/v1/bookings/{id}`
- [ ] Поиск гостей — GET `/api/v1/users/search?q=`
- [ ] Кнопка «Открыть в браузере» — POST `/api/v1/auth/browser/session`

#### Этап 4. Дополнительные фичи (вместе)
- [ ] Inline-кнопки в уведомлениях бота (ссылка на встречу в Mini App)
- [ ] Уведомление при изменении списка гостей
- [ ] Команда /mybookings — показать свои ближайшие встречи через бота
- [ ] Webhook вместо polling (для продакшена)

---

## Поток данных: кто к чему обращается

```
   Пользователь
     │
     ├── Web Browser ──── HTTP ──── /api/v1/* (JWT) ──── PostgreSQL
     │
     ├── Mini App ──────── HTTP ──── /api/v1/* (JWT) ──── PostgreSQL
     │
     └── Telegram чат
           │
           └── aiogram Bot ── HTTP ── /api/v1/internal/* (X-Bot-Secret) ── PostgreSQL
                 │
                 ├── handlers: /start, /chatid
                 ├── задача уведомлений (каждые 60 сек)
                 ├── задача напоминаний (каждые 60 сек)
                 └── задача отслеживания отмен (deleted-since)

   ⚠️ Бот НЕ обращается к PostgreSQL напрямую — только через эндпоинты бэкенда
```

---

## Переменные окружения `.env`

```env
# === БД ===
DATABASE_URL=postgresql+asyncpg://corpmeet:eW3lA7lU1j@194.87.138.47:5432/corpmeet

# === JWT ===
JWT_SECRET=f7k2mX9pQ3nR8vL1wA6sD4tY5uB0cE
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7

# === Telegram ===
TELEGRAM_BOT_TOKEN=8248745865:AAHYIlw0_CR0iyXuHNE_ZO52tAEOESMuYfA

# === Фронтенд ===
FRONTEND_URL=http://localhost:5173
APP_TIMEZONE=Asia/Yekaterinburg

# === TG Bot → Backend (внутренний API) ===
BOT_SECRET=UP8uTzjDVbEjv1gskcCF7P_E_4yHVmhL_xuYO9ORPI_81sNw6ssek23izOfiPFsF
TG_GROUP_CHAT_ID=5292448370
INTERNAL_API_URL=http://127.0.0.1:8000
```

---

## Структура файлов проекта

```
web/backend/
├── app/
│   ├── api/v1/
│   │   ├── auth.py            ✅ Тимур
│   │   ├── bookings.py        ✅ Тимур (+ soft-delete)
│   │   ├── slots.py           ✅ Тимур
│   │   ├── users.py           ✅ Тимур (+ admin CRUD)
│   │   └── internal.py        ✅ Тимур (7 эндпоинтов для бота)
│   │
│   ├── bot/                   ⏳ Коллега (скелет готов, доработка)
│   │   ├── bot.py
│   │   ├── handlers/
│   │   │   └── start.py       ← httpx → /internal/*
│   │   └── tasks/
│   │       ├── notifications.py  ← httpx → /internal/*
│   │       └── reminders.py      ← httpx → /internal/*
│   │
│   ├── models/                ✅ Тимур (User, Booking, BrowserSession)
│   ├── schemas/               ✅ Тимур (UserResponse, BookingResponse, BookingCreate/Update)
│   ├── services/              ✅ Тимур (auth_service, slot_service)
│   ├── config.py              ✅ Тимур
│   ├── database.py            ✅ Тимур
│   ├── dependencies.py        ✅ Тимур
│   └── main.py                ✅ Тимур
│
├── requirements.txt           ✅ (aiogram, httpx, fastapi, sqlalchemy, etc.)
└── .env                       ✅ Настроен

web/frontend/                  ✅ Тимур
├── src/
│   ├── api/                   auth.ts, bookings.ts, slots.ts, users.ts
│   ├── components/            Calendar, Dashboard, Auth, Common, MiniApp
│   ├── contexts/              ThemeContext, CalendarDragContext
│   ├── hooks/                 useAuth, useBookings, useTelegram
│   └── types/                 index.ts

tg/frontend/                   ⏳ Коллега (TODO)
└── (Mini App React)
```
