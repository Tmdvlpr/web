"""
Background task: send reminders for bookings starting in 14-16 minutes.
Polls GET /internal/bookings/reminders every 60 seconds.
"""
import asyncio
import logging
from datetime import datetime

from aiogram import Bot

import bot_api
from config import GROUP_ID

logger = logging.getLogger(__name__)


def _fmt_time(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%H:%M")


async def run_reminder_task(bot: Bot):
    """Run forever, polling every 60 seconds."""
    await asyncio.sleep(5)  # initial delay
    logger.info("Reminder task started")

    while True:
        try:
            bookings = await bot_api.get_reminders()
            for b in bookings:
                user = b.get("user", {})
                start = _fmt_time(b["start_time"])
                end = _fmt_time(b["end_time"])
                title = b["title"]

                text = (
                    f"⏰ <b>Напоминание:</b> встреча через 15 минут\n\n"
                    f"📝 {title}\n"
                    f"🕐 {start} – {end}\n"
                    f"👤 {user.get('display_name', '?')}"
                )

                # Notify group
                if GROUP_ID:
                    try:
                        await bot.send_message(GROUP_ID, text, parse_mode="HTML")
                    except Exception as e:
                        logger.error("Failed to send reminder to group: %s", e)

                # Notify organizer personally
                tg_id = user.get("telegram_id")
                if tg_id:
                    try:
                        await bot.send_message(tg_id, text, parse_mode="HTML")
                    except Exception:
                        pass

                # Notify guests
                for guest_username in b.get("guests", []):
                    guest = await bot_api.get_user_by_username(guest_username)
                    if guest and guest.get("telegram_id"):
                        try:
                            await bot.send_message(
                                guest["telegram_id"],
                                f"⏰ <b>Напоминание:</b> вы приглашены на встречу через 15 мин\n\n"
                                f"📝 {title}\n🕐 {start} – {end}",
                                parse_mode="HTML",
                            )
                        except Exception:
                            pass

                # Mark as reminded
                await bot_api.mark_reminded(b["id"])
                logger.info("Reminder sent for booking #%d", b["id"])

        except Exception:
            logger.exception("Reminder task error")

        await asyncio.sleep(60)
