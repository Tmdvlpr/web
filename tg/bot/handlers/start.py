"""
/start handler — uses internal API with X-Bot-Secret.
/start         → ensure user, show welcome
/start {token} → QR/deep-link auth (consume session)
"""
from __future__ import annotations

from aiogram import Router
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

import bot_api
from config import WEBAPP_URL

router = Router()


def _booking_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    if WEBAPP_URL:
        buttons.append([InlineKeyboardButton(
            text="Open Booking App",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _welcome_text(name: str) -> str:
    return (
        f"Hello, {name}!\n\n"
        "I help you book the meeting room.\n\n"
        "Commands:\n"
        "/slots — view available slots & book\n"
        "/mybookings — your upcoming bookings\n\n"
        "Or tap the button below to open the booking app:"
    )


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject):
    user = message.from_user
    token = command.args

    # --- QR/deep-link auth: /start {token} ---
    if token:
        # First ensure user exists
        await bot_api.ensure_user(
            telegram_id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            username=user.username,
            full_name=user.full_name,
        )
        # Consume browser session
        ok = await bot_api.consume_session(token, user.id)
        if ok:
            await message.answer(
                "✅ Авторизация подтверждена!\n"
                "Вернитесь в браузер — страница обновится автоматически."
            )
        else:
            await message.answer("❌ Ссылка недействительна или устарела.")
        return

    # --- Regular /start — ensure user, show welcome ---
    result = await bot_api.ensure_user(
        telegram_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        username=user.username,
        full_name=user.full_name,
    )

    display_name = user.first_name or "there"
    await message.answer(
        _welcome_text(display_name),
        reply_markup=_booking_keyboard(),
    )
