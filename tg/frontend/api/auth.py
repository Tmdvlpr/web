"""
Mini App auth middleware.
Extracts initData from 'tma <initData>' header, obtains JWT from backend,
caches it, and checks Telegram group membership.
"""
from __future__ import annotations

import json
import logging
from urllib.parse import unquote

from aiohttp import web
from aiogram import Bot

import api_client
from api_client import APIError
from config import GROUP_ID

logger = logging.getLogger(__name__)

# Cache: telegram_id -> {jwt, user}
_auth_cache: dict[int, dict] = {}


def _extract_tg_user_from_init_data(init_data: str) -> dict | None:
    """Parse the 'user' JSON from an initData query string."""
    try:
        params = {}
        for pair in init_data.split("&"):
            if "=" not in pair:
                continue
            k, v = pair.split("=", 1)
            params[k] = unquote(v)
        user_json = params.get("user")
        if user_json:
            return json.loads(user_json)
    except Exception:
        pass
    return None


@web.middleware
async def auth_middleware(request: web.Request, handler):
    """
    Authenticates Mini App requests.
    Expects 'Authorization: tma <initData>' header.
    Sets request["jwt"], request["user"], request["tg_user"] on success.
    """
    # Skip auth for static files
    if request.path.startswith("/webapp/"):
        return await handler(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("tma "):
        return web.json_response(
            {"ok": False, "error": "Missing authorization"},
            status=401,
        )

    init_data = auth_header[4:]  # strip "tma "

    # Extract telegram user info from initData
    tg_user = _extract_tg_user_from_init_data(init_data)
    if not tg_user or "id" not in tg_user:
        return web.json_response(
            {"ok": False, "error": "Invalid initData"},
            status=401,
        )

    telegram_id = tg_user["id"]

    # Check group membership via Telegram Bot API
    bot: Bot = request.app["bot"]
    try:
        member = await bot.get_chat_member(chat_id=GROUP_ID, user_id=telegram_id)
        if member.status in ("left", "kicked", "banned"):
            return web.json_response(
                {"ok": False, "error": "Access denied. Not a group member."},
                status=403,
            )
    except Exception as e:
        logger.error("Group check failed for %s: %s", telegram_id, e)
        return web.json_response(
            {"ok": False, "error": "Could not verify group membership"},
            status=403,
        )

    # Store initData and tg_user for possible use by handlers
    request["tg_user"] = tg_user
    request["init_data"] = init_data

    # Try to get cached JWT or login via backend
    cached = _auth_cache.get(telegram_id)
    if cached:
        request["jwt"] = cached["jwt"]
        request["user"] = cached["user"]
        return await handler(request)

    # Login via backend using initData
    try:
        token_resp = await api_client.login_with_init_data(init_data)
        jwt = token_resp["access_token"]
        user = await api_client.get_me(jwt)
        _auth_cache[telegram_id] = {"jwt": jwt, "user": user}
        request["jwt"] = jwt
        request["user"] = user
        return await handler(request)
    except APIError as e:
        if e.status == 404:
            # User not registered
            if request.path == "/api/register":
                request["jwt"] = None
                request["user"] = None
                return await handler(request)
            # Return registration_required so the frontend shows the form
            return web.json_response(
                {"ok": False, "error": "registration_required"},
            )
        logger.error("Backend login failed: %s", e)
        return web.json_response(
            {"ok": False, "error": "Authentication failed"},
            status=401,
        )


def invalidate_cache(telegram_id: int):
    """Remove cached auth for a user (e.g. after registration)."""
    _auth_cache.pop(telegram_id, None)
