import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
from app.api.v1 import auth, bookings, internal, slots, users

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── 1. Миграции БД ────────────────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Safe migrations — add new columns and tables if missing
        migrations = [
            # users table new columns
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_registered BOOLEAN NOT NULL DEFAULT false",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
            # Backfill first_name/last_name from legacy name field
            """
            UPDATE users SET
              first_name = TRIM(SPLIT_PART(name, ' ', 1)),
              last_name = NULLIF(TRIM(SPLIT_PART(name, ' ', 2)), ''),
              is_registered = true,
              is_active = true
            WHERE first_name IS NULL AND name IS NOT NULL
            """,
            # bookings table
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS description VARCHAR(2000)",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guests JSONB NOT NULL DEFAULT '[]'",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence VARCHAR(10) NOT NULL DEFAULT 'none'",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_until DATE",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_group_id BIGINT",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_days JSONB NOT NULL DEFAULT '[]'",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
            # browser_sessions table
            """
            CREATE TABLE IF NOT EXISTS browser_sessions (
                id SERIAL PRIMARY KEY,
                token VARCHAR(128) UNIQUE NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                used BOOLEAN NOT NULL DEFAULT false,
                used_at TIMESTAMPTZ,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_browser_sessions_token ON browser_sessions(token)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS feed_token VARCHAR(64) UNIQUE",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_feed_token ON users(feed_token) WHERE feed_token IS NOT NULL",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass

    # ── 2. Запуск TG Bot + фоновых задач ─────────────────────────────────────
    from app.bot.bot import create_bot_and_dispatcher
    from app.bot.tasks.notifications import run_notification_task
    from app.bot.tasks.reminders import run_reminder_task

    bot, dp = create_bot_and_dispatcher()

    bg_tasks = [
        asyncio.create_task(
            dp.start_polling(bot, handle_signals=False),
            name="bot_polling",
        ),
        asyncio.create_task(
            run_notification_task(bot),
            name="bot_notifications",
        ),
        asyncio.create_task(
            run_reminder_task(bot),
            name="bot_reminders",
        ),
    ]
    logger.info("TG Bot started (polling + notification + reminder tasks)")

    yield  # ← FastAPI обрабатывает HTTP-запросы

    # ── 3. Graceful shutdown ──────────────────────────────────────────────────
    logger.info("Shutting down TG Bot tasks...")
    for task in bg_tasks:
        task.cancel()
    await asyncio.gather(*bg_tasks, return_exceptions=True)
    await bot.session.close()
    logger.info("TG Bot stopped.")


app = FastAPI(
    title="CorpMeet API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(slots.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(internal.router, prefix="/api/v1")  # только для TG Bot


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
