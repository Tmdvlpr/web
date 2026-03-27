# CorpMeet TG — Telegram Bot + Mini App

Telegram-часть сервиса бронирования переговорной CorpMeet.
Бот и Mini App работают через единый FastAPI бекенд коллеги (`/api/v1/*`), без прямого доступа к БД.

---

## Структура проекта

```
tg/
├── bot.py                  # Точка входа: запускает aiogram polling + aiohttp сервер
├── api_client.py           # HTTP-клиент к бекенду (JWT, initData, CRUD-обёртки)
├── config.py               # Конфигурация из .env
├── requirements.txt
├── .env.example
│
├── bot/                    # Telegram-бот (aiogram)
│   ├── handlers/
│   │   ├── start.py        #   /start — регистрация и приветствие
│   │   ├── slots.py        #   /slots — выбор даты и свободных слотов
│   │   ├── book.py         #   FSM бронирования (дата → слот → название → подтверждение)
│   │   └── mybookings.py   #   /mybookings — список, расширение, отмена
│   ├── keyboards/
│   │   └── inline.py       #   Inline-клавиатуры (даты, слоты, подтверждение, extend)
│   └── middlewares/
│       └── auth.py         #   Проверка членства в Telegram-группе
│
└── frontend/               # Telegram Mini App
    ├── api/                #   Proxy-слой (aiohttp → бекенд /api/v1/*)
    │   ├── __init__.py     #     Регистрация маршрутов
    │   ├── auth.py         #     Аутентификация: initData → JWT, кеш, проверка группы
    │   └── routes.py       #     Proxy-обработчики с трансляцией форматов
    └── static/             #   Клиентская часть (vanilla JS)
        ├── index.html      #     HTML: регистрация, вкладки, модальное окно
        ├── app.js          #     Логика: авторизация, бронирование, гости, вкладки
        ├── calendar.js     #     Компонент календаря (месячный вид)
        ├── timeline.js     #     Компонент таймлайна (09:00–19:00, 30-мин слоты)
        └── style.css       #     Стили (Telegram theme variables, адаптивный дизайн)
```

---

## Почему такая структура

### Разделение на `bot/` и `frontend/`

Бот и Mini App — два разных продукта с разными задачами:

- **`bot/`** — обработка команд в чате Telegram (`/start`, `/slots`, `/book`, `/mybookings`). Использует aiogram FSM, inline-клавиатуры, middleware для проверки группы. Работает через long-polling.

- **`frontend/`** — веб-интерфейс внутри Telegram (Mini App). Включает два слоя:
  - `static/` — HTML/JS/CSS, отображается в WebView Telegram
  - `api/` — Python proxy-слой (aiohttp), который принимает запросы от JS-фронтенда и транслирует их к бекенду коллеги

Разделение позволяет независимо развивать бот-команды и Mini App, а также упрощает навигацию по коду.

### Почему proxy-слой (`frontend/api/`), а не прямые вызовы к бекенду

1. **CORS** — бекенд коллеги не включает домен Mini App (ngrok/cloudflared) в `allow_origins`. Proxy обходит это, т.к. запросы идут с сервера, не из браузера.

2. **Формат ответов** — бекенд возвращает `BookingResponse[]`, а JS-фронтенд ожидает `{ok: true, bookings: [...]}` с упрощёнными полями. Proxy транслирует форматы, минимизируя изменения в JS-коде.

3. **Авторизация** — Mini App отправляет `tma <initData>` в заголовке. Proxy обменивает это на JWT через бекенд и кеширует токен. JS-коду не нужно управлять JWT.

### Почему `api_client.py` и `config.py` в корне

Оба модуля используются и ботом (`bot/handlers/`), и Mini App (`frontend/api/`). Вынос в корень избегает дублирования и циклических зависимостей.

### Почему нет `db.py`

В предыдущей версии бот обращался к PostgreSQL напрямую через asyncpg. Теперь все CRUD-операции идут через бекенд коллеги. `api_client.py` заменяет `db.py`:

| Было (db.py) | Стало (api_client.py) |
|---|---|
| `db.get_user_by_telegram_id()` | `api_client.get_user_jwt()` → `POST /auth/login` |
| `db.create_user()` | `api_client.register_user()` → `POST /auth/register` |
| `db.create_booking()` | `api_client.create_booking()` → `POST /bookings` |
| `db.get_bookings_for_date()` | `api_client.get_bookings()` → `GET /bookings` |
| `db.get_user_upcoming_bookings()` | `api_client.get_active_bookings()` → `GET /bookings/active` |
| `db.delete_booking()` | `api_client.delete_booking()` → `DELETE /bookings/{id}` |
| `db.extend_booking()` | `api_client.update_booking()` → `PATCH /bookings/{id}` |
| `db.has_conflict()` | Бекенд возвращает 409 при конфликте |

---

## Аутентификация

### Бот → Бекенд

Бот владеет `BOT_TOKEN` и может конструировать валидный `initData` (HMAC-SHA256 с ключом `"WebAppData"`) для любого `telegram_id`. Это позволяет получать JWT от бекенда для каждого пользователя и выполнять действия от его имени.

JWT кешируется в памяти (7 дней, с буфером 1 час).

### Mini App → Proxy → Бекенд

1. JS-фронтенд отправляет `Authorization: tma <initData>` при каждом запросе
2. Proxy (`frontend/api/auth.py`) вызывает `POST /api/v1/auth/login` с `initData`
3. Бекенд проверяет HMAC, возвращает JWT
4. Proxy кеширует JWT по `telegram_id`
5. Все последующие запросы к бекенду идут с `Bearer <JWT>`

---

## Запуск

```bash
# 1. Бекенд коллеги (порт 8000)
cd web/backend && source .venv/bin/activate && uvicorn main:app --port 8000

# 2. Бот + Mini App
cd tg/
cp .env.example .env   # заполнить параметры
pip install -r requirements.txt
python bot.py
```

Mini App будет доступен на `http://localhost:{WEBAPP_PORT}/webapp/`.
Для Telegram нужен HTTPS — используйте cloudflared или деплой на сервер с nginx + Let's Encrypt.

---

## Известные ограничения

- **Decline guest booking** — бекенд не имеет эндпоинта для отказа от приглашения; кнопка отключена
- **Уведомления/напоминания** — запланированы на следующую итерацию (потребуют прямого доступа к БД)
- **Рекуррентные бронирования** — бекенд поддерживает, но бот и Mini App пока не используют
- **Часовой пояс** — бекенд слоты 07:00–22:00 UTC, proxy фильтрует до 09:00–19:00 для Ташкента
