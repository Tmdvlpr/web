import logging

import httpx
from aiogram import Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import Message

from app.config import settings

router = Router()
logger = logging.getLogger(__name__)


def _client() -> httpx.AsyncClient:
    """HTTP-клиент для вызовов внутреннего API бэкенда."""
    return httpx.AsyncClient(
        base_url=settings.INTERNAL_API_URL,
        headers={"X-Bot-Secret": settings.BOT_SECRET},
        timeout=10.0,
    )


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject) -> None:
    """
    /start           — приветствие, создать User через /internal/users/ensure
    /start {token}   — QR/deep-link авторизация через /internal/auth/consume-session
    """
    token = command.args

    if token:
        async with _client() as client:
            resp = await client.post(
                "/api/v1/internal/auth/consume-session",
                json={
                    "token": token,
                    "telegram_id": message.from_user.id,
                },
            )

        if resp.status_code == 200:
            await message.answer(
                "✅ Авторизация подтверждена!\n"
                "Вернитесь в браузер — страница обновится автоматически."
            )
        elif resp.status_code == 410:
            detail = resp.json().get("detail", "")
            if "expired" in detail.lower():
                await message.answer("❌ Ссылка устарела. Создайте новую в приложении.")
            else:
                await message.answer("❌ Ссылка уже использована.")
        else:
            await message.answer("❌ Ссылка недействительна.")
        return

    # /start без токена — создаём/обновляем пользователя
    async with _client() as client:
        await client.post(
            "/api/v1/internal/users/ensure",
            json={
                "telegram_id": message.from_user.id,
                "first_name": message.from_user.first_name,
                "last_name": message.from_user.last_name,
                "username": message.from_user.username,
                "full_name": message.from_user.full_name,
            },
        )

    await message.answer(
        "👋 Привет! Это <b>CorpMeet</b> — система бронирования переговорных.\n\n"
        "Откройте мини-приложение чтобы посмотреть расписание и забронировать время."
    )


@router.message(Command("chatid"))
async def cmd_chatid(message: Message) -> None:
    """/chatid — вернуть ID текущего чата (для настройки TG_GROUP_CHAT_ID в .env)."""
    await message.answer(
        f"💬 <b>Chat ID:</b> <code>{message.chat.id}</code>\n"
        f"👤 <b>User ID:</b> <code>{message.from_user.id}</code>"
    )
