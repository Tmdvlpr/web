"""
Background task: notify group about new/changed bookings.
Polls GET /internal/bookings/since every 60 seconds.
Detects: new bookings, time changes (prev_start_time/prev_end_time set).
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


async def _send(bot: Bot, chat_id: int, text: str):
    try:
        await bot.send_message(chat_id, text, parse_mode="HTML")
    except Exception as e:
        logger.error("Failed to send to %s: %s", chat_id, e)


async def _notify_guests(bot: Bot, guests: list[str], text: str):
    """Send personal notification to each guest by @username."""
    for username in guests:
        guest = await bot_api.get_user_by_username(username)
        if guest and guest.get("telegram_id"):
            await _send(bot, guest["telegram_id"], text)


async def run_notification_task(bot: Bot):
    """Run forever, polling every 60 seconds."""
    global _last_check
    await asyncio.sleep(10)
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
                title = b["title"]
                organizer = user.get("display_name", "?")
                guests = b.get("guests", [])

                created = datetime.fromisoformat(b["created_at"].replace("Z", "+00:00"))
                prev_start = b.get("prev_start_time")
                prev_end = b.get("prev_end_time")

                if prev_start and prev_end:
                    # --- Time was changed ---
                    old_start = _fmt_time(prev_start)
                    old_end = _fmt_time(prev_end)
                    old_date = _fmt_date(prev_start)

                    text = (
                        f"🔄 <b>Встреча перенесена</b>\n\n"
                        f"📝 {title}\n"
                        f"👤 {organizer}\n\n"
                        f"❌ Было: {old_date}  {old_start} – {old_end}\n"
                        f"✅ Стало: {date}  {start} – {end}"
                    )

                    if GROUP_ID:
                        await _send(bot, GROUP_ID, text)
                    await _notify_guests(bot, guests, text)

                elif created >= _last_check:
                    # --- New booking ---
                    text = (
                        f"📅 <b>Новая встреча</b>\n\n"
                        f"📝 {title}\n"
                        f"🗓 {date}  🕐 {start} – {end}\n"
                        f"👤 {organizer}"
                    )
                    if guests:
                        text += f"\n👥 Гости: {', '.join('@' + g for g in guests)}"

                    if GROUP_ID:
                        await _send(bot, GROUP_ID, text)
                    await _notify_guests(bot, guests,
                        f"📅 <b>Вас пригласили на встречу</b>\n\n"
                        f"📝 {title}\n"
                        f"🗓 {date}  🕐 {start} – {end}\n"
                        f"👤 Организатор: {organizer}"
                    )

            _last_check = now

        except Exception:
            logger.exception("Notification task error")

        await asyncio.sleep(60)
