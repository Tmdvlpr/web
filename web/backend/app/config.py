from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    TELEGRAM_BOT_TOKEN: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"
    APP_TIMEZONE: str = "Europe/Moscow"

    class Config:
        env_file = ".env"


settings = Settings()
