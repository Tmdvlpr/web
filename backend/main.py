import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from bot import run_bot_polling
from config import settings
from database import AsyncSessionLocal, Base, engine
from models import Booking
from routers import auth, bookings
from telegram import send_notification

logger = logging.getLogger(__name__)


async def run_reminder_task() -> None:
    """Every 60s: send Telegram + store flag for meetings starting in ~15 min."""
    while True:
        try:
            await asyncio.sleep(60)
            now = datetime.now(timezone.utc)
            window_start = now + timedelta(minutes=14)
            window_end   = now + timedelta(minutes=16)

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Booking)
                    .options(selectinload(Booking.user))
                    .where(
                        and_(
                            Booking.start_time >= window_start,
                            Booking.start_time <= window_end,
                            Booking.reminder_sent.is_(False),
                        )
                    )
                )
                due: list[Booking] = list(result.scalars().all())

                for booking in due:
                    try:
                        tz = ZoneInfo(settings.APP_TIMEZONE)
                    except Exception:
                        tz = timezone.utc
                    st = booking.start_time
                    if st.tzinfo is None:
                        st = st.replace(tzinfo=timezone.utc)
                    start_local = st.astimezone(tz)
                    start_fmt = start_local.strftime("%H:%M")
                    msg = (
                        f"⏰ <b>Напоминание!</b> Через 15 минут:\n"
                        f"📌 <b>{booking.title}</b>\n"
                        f"🕐 {start_fmt}\n"
                        f"👤 {booking.user.name}"
                    )
                    # Notify group channel
                    await send_notification(msg)
                    # Notify owner personally only if different from notify chat
                    owner_id = str(booking.user.telegram_id)
                    if owner_id != settings.TELEGRAM_NOTIFY_CHAT_ID:
                        try:
                            await send_notification(msg, chat_id=owner_id)
                        except Exception:
                            pass

                    booking.reminder_sent = True

                if due:
                    await db.commit()

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Reminder task error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns if they don't exist (safe migration)
        for sql in [
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS description VARCHAR(2000)",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guests JSONB NOT NULL DEFAULT '[]'",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence VARCHAR(10) NOT NULL DEFAULT 'none'",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_until DATE",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_group_id INTEGER",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_days JSONB NOT NULL DEFAULT '[]'",
        ]:
            try:
                await conn.execute(__import__("sqlalchemy").text(sql))
            except Exception:
                pass
    bot_task      = asyncio.create_task(run_bot_polling())
    reminder_task = asyncio.create_task(run_reminder_task())
    yield
    bot_task.cancel()
    reminder_task.cancel()
    for t in (bot_task, reminder_task):
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Meetaholic",
    description="Telegram-authenticated meeting room booking service",
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

app.include_router(auth.router)
app.include_router(bookings.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
