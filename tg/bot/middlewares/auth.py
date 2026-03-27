from __future__ import annotations

from typing import Any, Awaitable, Callable
from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Message, CallbackQuery
from config import GROUP_ID


class GroupMemberMiddleware(BaseMiddleware):
    """Allow only members of GROUP_ID to interact with the bot."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        bot = data["bot"]

        if isinstance(event, Message):
            user = event.from_user
            reply = event.answer
        elif isinstance(event, CallbackQuery):
            user = event.from_user
            reply = event.message.answer
        else:
            return await handler(event, data)

        if user is None:
            return

        try:
            member = await bot.get_chat_member(chat_id=GROUP_ID, user_id=user.id)
            if member.status in ("left", "kicked", "banned"):
                await reply("⛔ Access denied. You must be a member of the corporate group.")
                return
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Group membership check failed for user %s: %s", user.id, e)
            await reply("⛔ Could not verify your group membership. Please try again later.")
            return

        return await handler(event, data)
