"""
HTTP client for the FastAPI backend.
Replaces direct DB access (db.py) for all CRUD operations.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from urllib.parse import quote

import aiohttp

from config import BACKEND_URL, BOT_TOKEN

logger = logging.getLogger(__name__)

_session: aiohttp.ClientSession | None = None

# JWT cache: telegram_id -> (jwt_token, expires_timestamp)
_jwt_cache: dict[int, tuple[str, float]] = {}


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

async def init_client():
    global _session
    _session = aiohttp.ClientSession(base_url=BACKEND_URL)


async def close_client():
    global _session
    if _session:
        await _session.close()
        _session = None


def _get_session() -> aiohttp.ClientSession:
    if _session is None:
        raise RuntimeError("api_client not initialised — call init_client() first")
    return _session


# ---------------------------------------------------------------------------
# initData construction (HMAC-SHA256 with "WebAppData" key)
# ---------------------------------------------------------------------------

def construct_init_data(
    bot_token: str,
    telegram_id: int,
    username: str | None = None,
    first_name: str = "User",
    last_name: str = "",
) -> str:
    """Build a valid Telegram Mini App initData string that the backend will accept."""
    user_obj: dict = {
        "id": telegram_id,
        "first_name": first_name,
        "is_bot": False,
    }
    if last_name:
        user_obj["last_name"] = last_name
    if username:
        user_obj["username"] = username

    auth_date = str(int(time.time()))
    user_json = json.dumps(user_obj, separators=(",", ":"))

    params = {
        "auth_date": auth_date,
        "user": user_json,
    }

    # data_check_string: sorted key=value pairs joined by \n
    data_check_string = "\n".join(
        f"{k}={params[k]}" for k in sorted(params)
    )

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    # URL-encode values for the final query string
    parts = [f"{k}={quote(params[k])}" for k in sorted(params)]
    parts.append(f"hash={hash_value}")
    return "&".join(parts)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _jwt_expiry(token: str) -> float:
    """Decode the exp claim from a JWT without verification (just base64)."""
    import base64

    parts = token.split(".")
    if len(parts) != 3:
        return 0.0
    payload = parts[1]
    # add padding
    payload += "=" * (-len(payload) % 4)
    data = json.loads(base64.urlsafe_b64decode(payload))
    return float(data.get("exp", 0))


def _get_cached_jwt(telegram_id: int) -> str | None:
    """Return cached JWT if still valid (with 1-hour buffer)."""
    entry = _jwt_cache.get(telegram_id)
    if entry is None:
        return None
    token, expires_at = entry
    if time.time() > expires_at - 3600:
        del _jwt_cache[telegram_id]
        return None
    return token


def _cache_jwt(telegram_id: int, token: str):
    _jwt_cache[telegram_id] = (token, _jwt_expiry(token))


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class APIError(Exception):
    """Raised when the backend returns a non-success status."""
    def __init__(self, status: int, detail: str = ""):
        self.status = status
        self.detail = detail
        super().__init__(f"API {status}: {detail}")


def _auth_header(jwt: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {jwt}"}


async def get_user_jwt(
    telegram_id: int,
    username: str | None = None,
    first_name: str = "User",
    last_name: str = "",
) -> str:
    """
    Get a valid JWT for the given Telegram user.
    Constructs initData and calls /auth/login.
    Raises APIError(404) if user is not registered.
    """
    cached = _get_cached_jwt(telegram_id)
    if cached:
        return cached

    init_data = construct_init_data(BOT_TOKEN, telegram_id, username, first_name, last_name)
    session = _get_session()

    async with session.post(
        "/api/v1/auth/login",
        json={"initData": init_data},
    ) as resp:
        if resp.status == 404:
            raise APIError(404, "User not registered")
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        data = await resp.json()

    token = data["access_token"]
    _cache_jwt(telegram_id, token)
    return token


async def login_with_init_data(init_data: str) -> dict:
    """Login using raw initData from Mini App. Returns full token response."""
    session = _get_session()
    async with session.post(
        "/api/v1/auth/login",
        json={"initData": init_data},
    ) as resp:
        if resp.status == 404:
            raise APIError(404, "User not registered")
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def register_user(
    init_data: str,
    first_name: str,
    last_name: str,
) -> dict:
    """Register new user via initData. Returns token response."""
    session = _get_session()
    async with session.post(
        "/api/v1/auth/register",
        json={
            "initData": init_data,
            "first_name": first_name,
            "last_name": last_name,
        },
    ) as resp:
        if resp.status not in (200, 201):
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def get_me(jwt: str) -> dict:
    """GET /api/v1/auth/me — current user profile."""
    session = _get_session()
    async with session.get("/api/v1/auth/me", headers=_auth_header(jwt)) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

async def get_bookings(jwt: str, date_str: str) -> list[dict]:
    """GET /api/v1/bookings?date_from=&date_to= — bookings for a single date."""
    session = _get_session()
    async with session.get(
        "/api/v1/bookings",
        params={"date_from": date_str, "date_to": date_str},
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def get_bookings_range(jwt: str, date_from: str, date_to: str) -> list[dict]:
    """GET /api/v1/bookings — bookings for a date range."""
    session = _get_session()
    async with session.get(
        "/api/v1/bookings",
        params={"date_from": date_from, "date_to": date_to},
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def get_active_bookings(jwt: str) -> list[dict]:
    """GET /api/v1/bookings/active — current user's upcoming bookings."""
    session = _get_session()
    async with session.get(
        "/api/v1/bookings/active",
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def create_booking(jwt: str, payload: dict) -> list[dict]:
    """
    POST /api/v1/bookings — create booking.
    payload: {title, start_time (ISO), end_time (ISO), description?, guests?: ["@user"]}
    Returns list of created BookingResponse.
    """
    session = _get_session()
    async with session.post(
        "/api/v1/bookings",
        json=payload,
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status == 409:
            raise APIError(409, "Time slot conflict")
        if resp.status not in (200, 201):
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def update_booking(jwt: str, booking_id: int, payload: dict) -> dict:
    """
    PATCH /api/v1/bookings/{id} — update booking.
    payload: {title?, description?, start_time?, end_time?, guests?}
    """
    session = _get_session()
    async with session.patch(
        f"/api/v1/bookings/{booking_id}",
        json=payload,
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status == 409:
            raise APIError(409, "Time slot conflict")
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


async def delete_booking(jwt: str, booking_id: int, delete_series: bool = False):
    """DELETE /api/v1/bookings/{id}."""
    session = _get_session()
    params = {"delete_series": "true"} if delete_series else {}
    async with session.delete(
        f"/api/v1/bookings/{booking_id}",
        params=params,
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status not in (200, 204):
            text = await resp.text()
            raise APIError(resp.status, text)


# ---------------------------------------------------------------------------
# Slots
# ---------------------------------------------------------------------------

async def get_slots(jwt: str, date_str: str) -> list[dict]:
    """GET /api/v1/slots?date= — all slots with availability flag."""
    session = _get_session()
    async with session.get(
        "/api/v1/slots",
        params={"date": date_str},
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()


def filter_free_slots(slots: list[dict]) -> list[tuple[str, str]]:
    """Filter slot list to only available ones, return as (start, end) tuples."""
    return [(s["start"], s["end"]) for s in slots if s["available"]]


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def search_users(jwt: str, query: str) -> list[dict]:
    """GET /api/v1/users/search?q= — search users by name or @username."""
    session = _get_session()
    async with session.get(
        "/api/v1/users/search",
        params={"q": query},
        headers=_auth_header(jwt),
    ) as resp:
        if resp.status != 200:
            text = await resp.text()
            raise APIError(resp.status, text)
        return await resp.json()
