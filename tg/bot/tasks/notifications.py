"""
Background task: notify group about new/changed bookings.
Polls GET /internal/bookings/since every 60 seconds.
"""
import asyncio
import logging
from datetime import datetime, timezone

from aiogram import Bot

import bot_api
from config import GROUP_ID

logger = logging.getLogger(__name__)

# Track last poll time
_last_check: datetime | None = None


def _fmt_time(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%H:%M")


def _fmt_date(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%d.%m.%Y")


async def run_notification_task(bot: Bot):
    """Run forever, polling every 60 seconds."""
    global _last_check
    await asyncio.sleep(10)  # initial delay
    _last_check = datetime.now(timezone.utc)
    logger.info("Notification task started")

    while True:
        try:
            bookings = await bot_api.get_bookings_since(_last_check)
            now = datetime.now(timezone.utc)

            for b in bookings:
                user = b.get("user", {})
                start = _fmt_time(b["start_time"])
                end = _fmt_time(b["end_time"])
                date = _fmt_date(b["start_time"])

                # Only notify about bookings created after last check
                created = datetime.fromisoformat(b["created_at"].replace("Z", "+00:00"))
                if created >= _last_check:
                    text = (
                        f"📅 <b>Новая встреча</b>\n\n"
                        f"📝 {b['title']}\n"
                        f"🗓 {date}  🕐 {start} – {end}\n"
                        f"👤 {user.get('display_name', '?')}"
                    )
                    guests = b.get("guests", [])
                    if guests:
                        text += f"\n👥 Гости: {', '.join('@' + g for g in guests)}"

                    if GROUP_ID:
                        try:
                            await bot.send_message(GROUP_ID, text, parse_mode="HTML")
                        except Exception as e:
                            logger.error("Failed to send notification: %s", e)

            _last_check = now

        except Exception:
            logger.exception("Notification task error")

        await asyncio.sleep(60)
