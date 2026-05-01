from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    TELEGRAM_BOT_TOKEN: str
    PASETO_PRIVATE_KEY_PEM: str
    PASETO_PUBLIC_KEY_PEM: str
    TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"
    APP_TIMEZONE: str = "Europe/Moscow"
    # TG Bot: группа/чат для уведомлений о встречах и напоминаний
    TG_GROUP_CHAT_ID: int = 0
    # Секрет для внутреннего API (bot → backend). Задать в .env
    BOT_SECRET: str = ""
    # Адрес бэкенда для вызовов из бота (внутри одного процесса)
    INTERNAL_API_URL: str = "http://127.0.0.1:8000"
    # Username бота (без @) для QR-авторизации
    TG_BOT_USERNAME: str = "corpmeetbot"
    # Включить dev-login (только для локальной разработки)
    CORPMEET_DEV: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
