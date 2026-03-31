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
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prev_start_time TIMESTAMPTZ",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prev_end_time TIMESTAMPTZ",
            "ALTER TABLE browser_sessions ALTER COLUMN user_id DROP NOT NULL",
            "ALTER TABLE users ALTER COLUMN name DROP NOT NULL",
            "ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_feed_token ON users(feed_token) WHERE feed_token IS NOT NULL",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass

    # ── 2. TG Bot polling запускается отдельно (tg/tg/bot.py) ─────────────────
    # Бэкенд НЕ делает polling — это зона ответственности коллеги (tg-bot контейнер).
    # Бэкенд только предоставляет internal API для бота.
    logger.info("Backend ready. TG Bot runs separately (tg/tg/bot.py)")

    yield  # ← FastAPI обрабатывает HTTP-запросы

    logger.info("Backend shutting down.")


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


# ── Serve production frontend build ─────────────────────────────────────────
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if _DIST.is_dir():
    # Serve static assets (js, css, images)
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    # Serve other static files from dist root (logo, vite.svg, etc.)
    for f in _DIST.iterdir():
        if f.is_file() and f.name != "index.html":
            app.mount(f"/{f.name}", StaticFiles(directory=str(_DIST)), name=f"static-{f.name}")

    # SPA fallback: all non-API routes → index.html
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Don't intercept API and docs routes
        if full_path.startswith(("api/", "docs", "openapi.json", "health")):
            return
        file = _DIST / full_path
        if file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(_DIST / "index.html"))
