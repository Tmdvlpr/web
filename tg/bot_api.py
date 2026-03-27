"""
Internal API client for the TG Bot.
Uses X-Bot-Secret header — calls /api/v1/internal/* endpoints ONLY.
This is separate from api_client.py which uses JWT for Mini App.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import aiohttp

from config import BACKEND_URL

logger = logging.getLogger(__name__)

_session: aiohttp.ClientSession | None = None
_bot_secret: str = ""


async def init(bot_secret: str):
    """Initialize the internal API client with bot secret."""
    global _session, _bot_secret
    _bot_secret = bot_secret
    _session = aiohttp.ClientSession(
        base_url=BACKEND_URL,
        headers={"X-Bot-Secret": bot_secret},
    )


async def close():
    global _session
    if _session:
        await _session.close()
        _session = None


def _s() -> aiohttp.ClientSession:
    if _session is None:
        raise RuntimeError("bot_api not initialised — call bot_api.init() first")
    return _session


# ── Users ────────────────────────────────────────────────────────────────────

async def ensure_user(
    telegram_id: int,
    first_name: str | None = None,
    last_name: str | None = None,
    username: str | None = None,
    full_name: str | None = None,
) -> dict:
    """POST /internal/users/ensure — create or update user from Telegram data."""
    async with _s().post("/api/v1/internal/users/ensure", json={
        "telegram_id": telegram_id,
        "first_name": first_name,
        "last_name": last_name,
        "username": username,
        "full_name": full_name,
    }) as resp:
        return await resp.json()


async def get_user_by_username(username: str) -> dict | None:
    """GET /internal/users/by-username/{username} — resolve @username to telegram_id."""
    clean = username.lstrip("@")
    async with _s().get(f"/api/v1/internal/users/by-username/{clean}") as resp:
        if resp.status == 404:
            return None
        return await resp.json()


# ── Bookings ─────────────────────────────────────────────────────────────────

async def get_bookings_since(updated_at: datetime) -> list[dict]:
    """GET /internal/bookings/since — recently changed bookings for notifications."""
    async with _s().get("/api/v1/internal/bookings/since", params={
        "updated_at": updated_at.isoformat(),
    }) as resp:
        if resp.status != 200:
            return []
        return await resp.json()


async def get_reminders() -> list[dict]:
    """GET /internal/bookings/reminders — bookings needing reminder (14-16 min away)."""
    async with _s().get("/api/v1/internal/bookings/reminders") as resp:
        if resp.status != 200:
            return []
        return await resp.json()


async def mark_reminded(booking_id: int) -> bool:
    """POST /internal/bookings/{id}/mark-reminded."""
    async with _s().post(f"/api/v1/internal/bookings/{booking_id}/mark-reminded") as resp:
        return resp.status == 200


async def get_deleted_since(since: datetime) -> list[dict]:
    """GET /internal/bookings/deleted-since — soft-deleted bookings for cancellation notifications."""
    async with _s().get("/api/v1/internal/bookings/deleted-since", params={
        "since": since.isoformat(),
    }) as resp:
        if resp.status != 200:
            return []
        return await resp.json()


# ── Auth ─────────────────────────────────────────────────────────────────────

async def consume_session(token: str, telegram_id: int) -> bool:
    """POST /internal/auth/consume-session — QR/deep-link auth."""
    async with _s().post("/api/v1/internal/auth/consume-session", json={
        "token": token,
        "telegram_id": telegram_id,
    }) as resp:
        return resp.status == 200
