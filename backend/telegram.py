from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import httpx
from sqlalchemy import select

from config import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def send_notification(text: str, chat_id: str | None = None) -> None:
    """Send a message to the Telegram notification chat."""
    target = chat_id or settings.TELEGRAM_NOTIFY_CHAT_ID
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json={
                "chat_id": target,
                "text": text,
                "parse_mode": "HTML",
            }, timeout=10)
            if not resp.json().get("ok"):
                logger.warning("Telegram sendMessage failed chat_id=%s: %s", target, resp.text)
        except Exception as exc:
            logger.warning("Telegram sendMessage error chat_id=%s: %s", target, exc)


async def send_guest_notifications(db: "AsyncSession", guest_usernames: list[str], message: str) -> None:
    """Send a Telegram DM to each guest who is a registered user in the system."""
    from models import User  # local import to avoid circular deps

    if not guest_usernames:
        return
    result = await db.execute(
        select(User).where(User.username.in_(guest_usernames))
    )
    users = result.scalars().all()
    for user in users:
        await send_notification(message, chat_id=str(user.telegram_id))
