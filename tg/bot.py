import asyncio
import logging
import os

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import MenuButtonWebApp, WebAppInfo

from config import BOT_TOKEN, BOT_SECRET, WEBAPP_PORT, WEBAPP_URL
import api_client
import bot_api
# from bot.middlewares.auth import GroupMemberMiddleware
from bot.handlers import start, slots, book, mybookings
from bot.tasks.reminders import run_reminder_task
from bot.tasks.notifications import run_notification_task
from bot.tasks.deletions import run_deletion_task
from frontend.api import setup_api_routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    # Initialize HTTP clients
    await api_client.init_client()        # JWT client for Mini App proxy
    await bot_api.init(BOT_SECRET)        # X-Bot-Secret client for bot internal API

    bot = Bot(token=BOT_TOKEN)
    dp  = Dispatcher(storage=MemoryStorage())

    # Group membership middleware — disabled for dev (bot not in group yet)
    # dp.message.middleware(GroupMemberMiddleware())
    # dp.callback_query.middleware(GroupMemberMiddleware())

    # register routers
    dp.include_router(start.router)
    dp.include_router(slots.router)
    dp.include_router(book.router)
    dp.include_router(mybookings.router)

    # --- aiohttp web server for Mini App ---
    app = web.Application()
    app["bot_token"] = BOT_TOKEN
    app["bot"] = bot
    setup_api_routes(app)

    static_path = os.path.join(os.path.dirname(__file__), "frontend", "static")

    async def serve_index(_request):
        return web.FileResponse(os.path.join(static_path, "index.html"))

    app.router.add_get("/webapp/", serve_index)
    app.router.add_get("/webapp/index.html", serve_index)
    app.router.add_static("/webapp/", path=static_path, name="webapp")

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", WEBAPP_PORT)
    await site.start()
    logger.info("Mini App server started on port %s", WEBAPP_PORT)

    # set menu button
    if WEBAPP_URL:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Book Room",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            )
        except Exception as e:
            logger.warning("Could not set menu button: %s", e)

    # --- Background tasks (internal API) ---
    bg_tasks = []
    if BOT_SECRET:
        bg_tasks = [
            asyncio.create_task(run_reminder_task(bot), name="reminders"),
            asyncio.create_task(run_notification_task(bot), name="notifications"),
            asyncio.create_task(run_deletion_task(bot), name="deletions"),
        ]
        logger.info("Background tasks started (reminders, notifications, deletions)")
    else:
        logger.warning("BOT_SECRET not set — background tasks disabled")

    try:
        await dp.start_polling(bot)
    finally:
        for task in bg_tasks:
            task.cancel()
        await asyncio.gather(*bg_tasks, return_exceptions=True)
        await runner.cleanup()
        await bot_api.close()
        await api_client.close_client()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
