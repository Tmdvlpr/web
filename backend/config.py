from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_GROUP_ID: str
    TELEGRAM_NOTIFY_CHAT_ID: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7
    TELEGRAM_BOT_NAME: str = "corpmeetbot"
    FRONTEND_URL: str = "http://localhost:5173"
    APP_TIMEZONE: str = "Europe/Moscow"

    class Config:
        env_file = ".env"


settings = Settings()
