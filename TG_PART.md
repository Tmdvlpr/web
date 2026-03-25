# CorpMeet: Часть TG — Документ для разработчика

> Документ описывает текущую архитектуру WEB-части и что нужно реализовать для TG-части.
> Обновлён: 2026-03-25

---

## 📁 Структура репозитория

```
tg/   (корень репо, ветка web)
│
├── web/                    ← ВЕБ-ЧАСТЬ (реализована)
│   ├── backend/            FastAPI API для веба и мини-приложения
│   └── frontend/           React SPA (Mini App + браузер)
│
└── tg/                     ← ТГ-ЧАСТЬ (тебе реализовать)
    ├── backend/            FastAPI/Python для бота
    └── frontend/           Mini App интерфейс (если нужен отдельный)
```

**Правило:** Web и TG общаются **только через БД**. Никаких прямых вызовов между сервисами.

---

## 🗄️ База данных (общая, PostgreSQL)

**Подключение:**
```
Host:     194.87.138.47
Port:     5432
Database: corpmeet
User:     corpmeet
Password: eW3lA7lU1j
```

### Таблица `users` (общая — читаешь и пишешь)

| Колонка        | Тип             | Описание                         |
|----------------|-----------------|----------------------------------|
| id             | SERIAL PK       | Внутренний ID                    |
| telegram_id    | BIGINT UNIQUE   | ID пользователя в Telegram       |
| name           | VARCHAR(255)    | Полное имя (legacy, не удалять!) |
| first_name     | VARCHAR(100)    | Имя (добавлено web-частью)       |
| last_name      | VARCHAR(100)    | Фамилия (добавлено web-частью)   |
| username       | VARCHAR(255)    | @username в Telegram             |
| role           | ENUM(user/admin)| Роль пользователя                |
| is_active      | BOOLEAN         | Активен ли                       |
| is_registered  | BOOLEAN         | Завершена ли регистрация         |
| created_at     | TIMESTAMPTZ     | Дата создания                    |
| updated_at     | TIMESTAMPTZ     | Дата обновления                  |

**Важно:** поля `name`, `username` — не переименовывать, web-часть их использует.

### Таблица `bookings` (общая — читаешь, пишет в основном web)

| Колонка             | Тип             | Описание                        |
|---------------------|-----------------|---------------------------------|
| id                  | SERIAL PK       |                                 |
| title               | VARCHAR(255)    | Название встречи                |
| description         | VARCHAR(2000)   | Описание                        |
| start_time          | TIMESTAMPTZ     | Начало (UTC)                    |
| end_time            | TIMESTAMPTZ     | Конец (UTC)                     |
| user_id             | INT FK users    | Организатор                     |
| guests              | JSONB           | [`"username1"`, `"username2"`]  |
| recurrence          | VARCHAR(10)     | none / daily / weekly / custom  |
| recurrence_group_id | BIGINT          | Группирует серию встреч         |
| reminder_sent       | BOOLEAN         | Напоминание уже отправлено?     |
| created_at          | TIMESTAMPTZ     |                                 |
| updated_at          | TIMESTAMPTZ     |                                 |

**Для уведомлений:** отслеживай изменения по `updated_at` или используй PostgreSQL LISTEN/NOTIFY.

**Для напоминаний:** ищи записи где `start_time` через 14-16 минут и `reminder_sent = false`, затем ставь `reminder_sent = true`.

### Таблица `browser_sessions` (только web, не трогать)

Используется для авторизации пользователей через браузер. Не удалять, не изменять.

---

## ✅ Что уже сделано в WEB-части

### Backend `web/backend/` (FastAPI, порт 8000)

**API маршруты:**
```
POST /api/v1/auth/register          Регистрация (Mini App initData)
POST /api/v1/auth/login             Вход существующего пользователя
POST /api/v1/auth/browser/session   Создать одноразовый токен для браузера
GET  /api/v1/auth/session/{token}   Обменять токен на JWT (браузер)
GET  /api/v1/auth/me                Текущий пользователь

GET    /api/v1/bookings?date_from=&date_to=   Список встреч по дате
GET    /api/v1/bookings/active                Активные встречи пользователя
POST   /api/v1/bookings                       Создать встречу (+ серия)
PATCH  /api/v1/bookings/{id}                  Изменить встречу
DELETE /api/v1/bookings/{id}                  Удалить встречу
GET    /api/v1/bookings/export                Экспорт ICS

GET /api/v1/slots?date=             Свободные слоты на день
GET /api/v1/users/me                Профиль текущего пользователя
GET /api/v1/users/search?q=         Поиск пользователей
```

**Авторизация:** JWT Bearer token. Верификация initData через HMAC с ключом `WebAppData` (НЕ sha256(bot_token) как в Login Widget).

### Frontend `web/frontend/` (React, порт 5173)

- Календарь бронирований (недельный вид)
- Создание/редактирование/удаление встреч
- Гости с автодополнением
- Повторяющиеся встречи (ежедневно / еженедельно / по дням)
- Авторизация через Mini App initData
- Кнопка "Открыть в браузере" (browser session flow)

---

## 🤖 Что нужно реализовать в TG-части (`tg/` папка)

### 1. Telegram Bot (основная задача)

**Бот уже существовал, вот что он должен делать:**

#### 1.1 Команды и хендлеры

```
/start {token}
  → Авторизация через QR/deep link (если ты оставляешь этот flow)
  → Ищешь сессию по token, создаёшь/обновляешь User, отмечаешь authenticated

/start (без токена)
  → Приветствие: "Привет! Открой мини-приложение CorpMeet"

/chatid
  → Отправить chat_id (для отладки)
```

#### 1.2 Уведомления о встречах

Web-часть **больше не отправляет уведомления в Telegram**. Это теперь твоя задача.

Варианты реализации:

**Вариант A: Polling БД (проще)**
```python
# Каждые 60 секунд
async def check_new_bookings():
    # Ищем bookings.created_at > last_check_time
    # Ищем bookings.updated_at > last_check_time (для изменений)
    # Отправляем уведомления в группу и гостям
```

**Вариант B: PostgreSQL LISTEN/NOTIFY (надёжнее)**
```sql
-- Триггер на bookings
CREATE OR REPLACE FUNCTION notify_booking_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('booking_changes', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_change_trigger
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION notify_booking_change();
```

#### 1.3 Напоминания за 15 минут

```python
async def reminder_task():
    while True:
        await asyncio.sleep(60)
        now = datetime.now(utc)
        # bookings где start_time между now+14min и now+16min
        # И reminder_sent = false
        # → отправить уведомление в группу + личное сообщение организатору
        # → UPDATE bookings SET reminder_sent = true WHERE id = ...
```

### 2. Структура `tg/` папки (предлагаемая)

```
tg/
├── backend/
│   ├── bot.py              Основной бот (long-polling или webhook)
│   ├── handlers/
│   │   ├── start.py        /start команда
│   │   └── notifications.py Отправка уведомлений
│   ├── tasks/
│   │   └── reminders.py    Фоновая задача напоминаний
│   ├── database.py         Подключение к той же PostgreSQL
│   ├── models.py           ORM модели (User, Booking) — можешь скопировать из web/backend/app/models/
│   ├── config.py           Настройки (.env)
│   ├── main.py             Точка входа
│   ├── requirements.txt
│   └── .env
└── (frontend/ если нужен отдельный Mini App интерфейс для TG)
```

### 3. Настройки `.env` для TG-части

```env
DATABASE_URL=postgresql+asyncpg://corpmeet:eW3lA7lU1j@194.87.138.47:5432/corpmeet
TELEGRAM_BOT_TOKEN=8248745865:AAHYIlw0_CR0iyXuHNE_ZO52tAEOESMuYfA
TELEGRAM_GROUP_ID=5292448370
TELEGRAM_NOTIFY_CHAT_ID=5292448370
APP_TIMEZONE=Asia/Yekaterinburg
```

### 4. Шаблоны уведомлений

```python
# Новое бронирование
"📅 <b>Новое бронирование</b>\n"
"👤 {user.display_name}\n"
"📌 {booking.title}\n"
"🕐 {start_local} – {end_local}"

# Встреча изменена
"✏️ <b>Бронирование изменено</b>\n"
"👤 {user.display_name}\n"
"📌 {booking.title}\n"
{changes}

# Встреча отменена
"❌ <b>Бронирование отменено</b>\n"
"👤 {user.display_name}\n"
"📌 {booking.title}\n"
"🕐 {start_local} – {end_local}"

# Напоминание за 15 минут
"⏰ <b>Напоминание!</b> Через 15 минут:\n"
"📌 <b>{booking.title}</b>\n"
"🕐 {start_local}\n"
"👤 {user.display_name}"

# Приглашение гостя
"📅 Вас пригласили на встречу!\n"
"📌 <b>{booking.title}</b>\n"
"🕐 {start_local} – {end_local}\n"
"👤 Организатор: {organizer.display_name}"
```

### 5. Как получить telegram_id пользователя для личных уведомлений

```python
# По username
result = await db.execute(
    select(User).where(User.username == guest_username)
)
user = result.scalar_one_or_none()
if user:
    await send_message(chat_id=user.telegram_id, text=message)
```

---

## 🔄 Контракт взаимодействия WEB ↔ TG

| Операция                  | Кто делает        | Как                          |
|---------------------------|-------------------|------------------------------|
| Создать пользователя      | Web (при логине)  | INSERT INTO users            |
| Создать/изменить booking  | Web               | INSERT/UPDATE bookings       |
| Отправить уведомление     | **TG (ты)**       | Читаешь из bookings, шлёшь   |
| Напоминание за 15 мин     | **TG (ты)**       | Polling + reminder_sent flag |
| Авторизация через QR      | TG (опционально)  | qr_sessions таблица          |

**Таблица `qr_sessions`** — осталась в БД (web больше не использует). Можешь использовать для QR-авторизации в боте если нужно, или создать свою логику.

---

## 🚀 Запуск TG-части (после реализации)

```bash
cd tg/backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
# или
python main.py  # если bot.py без FastAPI
```

---

## ⚠️ Важные договорённости

1. **Не переименовывать** поля `name`, `username` в таблице `users`
2. **Не удалять** таблицу `browser_sessions`
3. **Не менять** типы существующих полей в `bookings`
4. Новые таблицы для TG-части — с префиксом `tg_` или в отдельной схеме
5. **Ветка `web`** — только папка `web/`. Ветка `tg` (или `main`) — для TG-части
6. Pull request делаем в разные ветки — конфликтов не будет

---

## 🔑 Токен бота

```
8248745865:AAHYIlw0_CR0iyXuHNE_ZO52tAEOESMuYfA
```
Бот: `@corpmeetbot`
Группа для уведомлений: `5292448370`
