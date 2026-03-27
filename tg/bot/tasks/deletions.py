"""
Background task: notify about cancelled (soft-deleted) bookings.
Polls GET /internal/bookings/deleted-since every 60 seconds.
"""
import asyncio
import logging
from datetime import datetime, timezone

from aiogram import Bot

import bot_api
from config import GROUP_ID

logger = logging.getLogger(__name__)

_last_check: datetime | None = None


def _fmt_time(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%H:%M")


def _fmt_date(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%d.%m.%Y")


async def run_deletion_task(bot: Bot):
    """Run forever, polling every 60 seconds."""
    global _last_check
    await asyncio.sleep(15)  # initial delay
    _last_check = datetime.now(timezone.utc)
    logger.info("Deletion notification task started")

    while True:
        try:
            deleted = await bot_api.get_deleted_since(_last_check)
            now = datetime.now(timezone.utc)

            for b in deleted:
                user = b.get("user", {})
                start = _fmt_time(b["start_time"])
                end = _fmt_time(b["end_time"])
                date = _fmt_date(b["start_time"])

                text = (
                    f"🗑 <b>Встреча отменена</b>\n\n"
                    f"📝 {b['title']}\n"
                    f"🗓 {date}  🕐 {start} – {end}\n"
                    f"👤 {user.get('display_name', '?')}"
                )

                if GROUP_ID:
                    try:
                        await bot.send_message(GROUP_ID, text, parse_mode="HTML")
                    except Exception as e:
                        logger.error("Failed to send deletion notification: %s", e)

                # Notify guests
                for guest_username in b.get("guests", []):
                    guest = await bot_api.get_user_by_username(guest_username)
                    if guest and guest.get("telegram_id"):
                        try:
                            await bot.send_message(
                                guest["telegram_id"],
                                f"🗑 <b>Встреча отменена</b>\n\n📝 {b['title']}\n🗓 {date}  🕐 {start} – {end}",
                                parse_mode="HTML",
                            )
                        except Exception:
                            pass

            _last_check = now

        except Exception:
            logger.exception("Deletion task error")

        await asyncio.sleep(60)
