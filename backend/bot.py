"""Telegram bot long-polling service.

Handles /start TOKEN messages — authenticates users via QR code flow.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

logger = logging.getLogger(__name__)

from auth import check_group_membership
from config import settings
from database import AsyncSessionLocal
from models import QRSession, QRStatus, User


async def _handle_start(telegram_id: int, first_name: str, last_name: str | None, username: str | None, token: str) -> str:
    # Group check temporarily disabled — enable when TELEGRAM_GROUP_ID is confirmed
    # is_member = await check_group_membership(telegram_id)
    # if not is_member:
    #     return "❌ Вы не являетесь участником группы. Доступ запрещён."

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(QRSession).where(QRSession.token == token))
        session = result.scalar_one_or_none()

        if not session:
            return "❌ Сессия не найдена. Обновите страницу и попробуйте снова."

        expires = session.expires_at.replace(tzinfo=timezone.utc) if session.expires_at.tzinfo is None else session.expires_at
        if session.status == QRStatus.expired or expires < datetime.now(timezone.utc):
            return "❌ QR-код устарел. Обновите страницу и попробуйте снова."

        if session.status == QRStatus.authenticated:
            return "✅ Вы уже авторизованы! Вернитесь в браузер."

        name = f"{first_name} {last_name}".strip() if last_name else first_name

        user_result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = user_result.scalar_one_or_none()

        if user:
            user.name = name
            user.username = username
        else:
            user = User(telegram_id=telegram_id, name=name, username=username)
            db.add(user)

        await db.flush()

        session.status = QRStatus.authenticated
        session.user_id = user.id

        await db.commit()

    return f"✅ Добро пожаловать, {first_name}! Авторизация прошла успешно.\n\nВернитесь в браузер — страница обновится автоматически."


async def _process_updates(updates: list[dict]) -> None:
    async with httpx.AsyncClient() as client:
        for update in updates:
            # Log every chat the bot sees — helps discover the group ID
            for key in ("message", "my_chat_member", "chat_member"):
                if key in update:
                    c = update[key].get("chat", {})
                    msg = f"[BOT] update_id={update['update_id']} key={key} chat_id={c.get('id')} type={c.get('type')} title={c.get('title') or c.get('username') or c.get('first_name')}\n"
                    logger.warning(msg.strip())
                    open("bot_debug.log", "a").write(msg)

            message = update.get("message")
            if not message:
                continue

            text: str = message.get("text", "")
            from_user: dict = message.get("from", {})
            chat_id: int = message["chat"]["id"]
            telegram_id: int = from_user.get("id", 0)
            first_name: str = from_user.get("first_name", "")
            last_name: str | None = from_user.get("last_name")
            username: str | None = from_user.get("username")

            if text.startswith("/start "):
                token = text.split(" ", 1)[1].strip()
                reply = await _handle_start(telegram_id, first_name, last_name, username, token)
            elif text == "/start":
                reply = "👋 Привет! Отсканируйте QR-код на сайте бронирования переговорки, чтобы войти."
            elif text == "/chatid":
                chat = message.get("chat", {})
                reply = f"Chat ID: <code>{chat.get('id')}</code>\nType: {chat.get('type')}\nTitle: {chat.get('title') or chat.get('username') or chat.get('first_name')}"
                logger.warning("[BOT /chatid] chat_id=%s type=%s title=%s", chat.get('id'), chat.get('type'), chat.get('title'))
            else:
                continue

            try:
                await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={"chat_id": chat_id, "text": reply, "parse_mode": "HTML"},
                    timeout=10,
                )
            except Exception:
                pass


async def run_bot_polling() -> None:
    """Long-poll Telegram updates indefinitely."""
    offset = 0
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getUpdates"

    async with httpx.AsyncClient() as client:
        while True:
            try:
                resp = await client.get(
                    url,
                    params={"offset": offset, "timeout": 30, "allowed_updates": ["message"]},
                    timeout=35,
                )
                data = resp.json()
                if data.get("ok") and data.get("result"):
                    updates: list[dict] = data["result"]
                    await _process_updates(updates)
                    offset = updates[-1]["update_id"] + 1
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(2)
