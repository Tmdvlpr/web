"""
Proxy routes: translate between the Mini App's old API format
and the colleague's FastAPI backend (/api/v1/*).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

import pytz
from aiohttp import web

import api_client
from api_client import APIError
from config import TIMEZONE, WORKING_HOURS_START, WORKING_HOURS_END, MIN_SLOT_MINUTES
from bot.handlers.slots import compute_extension_options_from_slots, format_extension_label
from frontend.api.auth import invalidate_cache

tz = pytz.timezone(TIMEZONE)


def _parse_iso(iso_str: str) -> datetime:
    s = iso_str.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

async def register(request: web.Request) -> web.Response:
    """POST /api/register — register user with first + last name via backend."""
    tg_user = request.get("tg_user", {})
    init_data = request.get("init_data", "")

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    first_name = body.get("first_name", "").strip()
    last_name = body.get("last_name", "").strip()

    if not first_name or not last_name:
        return web.json_response(
            {"ok": False, "error": "First name and last name are required"}, status=400
        )

    try:
        token_resp = await api_client.register_user(init_data, first_name, last_name)
        jwt = token_resp["access_token"]
        user = await api_client.get_me(jwt)
        # Invalidate auth cache so next request picks up the new user
        invalidate_cache(tg_user.get("id", 0))
        return web.json_response({
            "ok": True,
            "user": {"id": user["id"], "name": user.get("display_name", first_name)},
        })
    except APIError as e:
        return web.json_response(
            {"ok": False, "error": f"Registration failed: {e.detail}"},
            status=400,
        )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def search_users(request: web.Request) -> web.Response:
    """GET /api/users?q=search — search users via backend."""
    jwt = request["jwt"]
    query = request.query.get("q", "").strip()
    if len(query) < 2:
        return web.json_response({"ok": True, "users": []})

    try:
        users = await api_client.search_users(jwt, query)
    except APIError:
        return web.json_response({"ok": False, "error": "Search failed"}, status=500)

    current_user = request.get("user", {})
    result = [
        {
            "id": u["id"],
            "name": u.get("display_name", f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()),
            "username": u.get("username", ""),
            "telegram_id": u.get("telegram_id", 0),
        }
        for u in users
        if u["id"] != current_user.get("id")
    ]
    return web.json_response({"ok": True, "users": result})


# ---------------------------------------------------------------------------
# Slots
# ---------------------------------------------------------------------------

async def get_slots(request: web.Request) -> web.Response:
    """GET /api/slots?date=YYYY-MM-DD — free slots for a date."""
    jwt = request["jwt"]
    date_str = request.query.get("date")
    if not date_str:
        return web.json_response({"ok": False, "error": "date parameter required"}, status=400)

    try:
        all_slots = await api_client.get_slots(jwt, date_str)
    except APIError:
        return web.json_response({"ok": False, "error": "Failed to load slots"}, status=500)

    # Filter to working hours and free only
    start_min = WORKING_HOURS_START * 60
    end_min = WORKING_HOURS_END * 60
    free = [
        {"start": s["start"], "end": s["end"]}
        for s in all_slots
        if s["available"]
        and _time_to_min(s["start"]) >= start_min
        and _time_to_min(s["end"]) <= end_min
    ]

    return web.json_response({"ok": True, "date": date_str, "slots": free})


def _time_to_min(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

async def get_bookings(request: web.Request) -> web.Response:
    """GET /api/bookings?date=YYYY-MM-DD — all bookings for timeline display."""
    jwt = request["jwt"]
    date_str = request.query.get("date")
    if not date_str:
        return web.json_response({"ok": False, "error": "date parameter required"}, status=400)

    try:
        raw_bookings = await api_client.get_bookings(jwt, date_str)
    except APIError:
        return web.json_response({"ok": False, "error": "Failed to load bookings"}, status=500)

    bookings = []
    for b in raw_bookings:
        s = _parse_iso(b["start_time"]).astimezone(tz)
        e = _parse_iso(b["end_time"]).astimezone(tz)
        user_info = b.get("user", {})
        bookings.append({
            "id": b["id"],
            "title": b["title"],
            "start": s.strftime("%H:%M"),
            "end": e.strftime("%H:%M"),
            "user": user_info.get("display_name", "Unknown"),
            "user_id": b.get("user_id", 0),
        })

    return web.json_response({"ok": True, "date": date_str, "bookings": bookings})


async def create_booking(request: web.Request) -> web.Response:
    """POST /api/bookings — create a new booking via backend."""
    jwt = request["jwt"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    date_str = body.get("date")
    start_str = body.get("start")
    end_str = body.get("end")
    title = body.get("title", "").strip()
    description = body.get("description", "").strip() or None

    if not all([date_str, start_str, end_str, title]):
        return web.json_response({"ok": False, "error": "date, start, end, title are required"}, status=400)

    # Build ISO datetimes
    start_iso = f"{date_str}T{start_str}:00Z"
    end_iso = f"{date_str}T{end_str}:00Z"

    # Process guests: the frontend sends [{id, name, telegram_id}] or ["@username"]
    # We convert to backend format: ["@username"]
    guests_raw = body.get("guests", [])
    guests = []
    for g in guests_raw:
        if isinstance(g, str):
            guests.append(g if g.startswith("@") else f"@{g}")
        elif isinstance(g, dict) and g.get("username"):
            username = g["username"]
            guests.append(username if username.startswith("@") else f"@{username}")

    payload = {
        "title": title,
        "start_time": start_iso,
        "end_time": end_iso,
        "guests": guests,
    }
    if description:
        payload["description"] = description

    try:
        result = await api_client.create_booking(jwt, payload)
        first = result[0] if result else {}
        return web.json_response({
            "ok": True,
            "booking": {
                "id": first.get("id"),
                "title": first.get("title", title),
                "start": start_str,
                "end": end_str,
                "date": date_str,
            },
        })
    except APIError as e:
        if e.status == 409:
            return web.json_response({"ok": False, "error": "Time slot conflict"}, status=409)
        return web.json_response({"ok": False, "error": f"Booking failed: {e.detail}"}, status=400)


# ---------------------------------------------------------------------------
# My Bookings
# ---------------------------------------------------------------------------

async def get_my_bookings(request: web.Request) -> web.Response:
    """GET /api/my-bookings — current user's upcoming bookings with extend options."""
    jwt = request["jwt"]

    try:
        raw_bookings = await api_client.get_active_bookings(jwt)
    except APIError:
        return web.json_response({"ok": False, "error": "Failed to load bookings"}, status=500)

    # Compute extend options using slots API
    date_slots_cache: dict[str, list[dict]] = {}
    bookings = []

    for b in raw_bookings:
        s = _parse_iso(b["start_time"]).astimezone(tz)
        e = _parse_iso(b["end_time"]).astimezone(tz)
        date_str = s.strftime("%Y-%m-%d")

        if date_str not in date_slots_cache:
            try:
                date_slots_cache[date_str] = await api_client.get_slots(jwt, date_str)
            except APIError:
                date_slots_cache[date_str] = []

        end_str = e.strftime("%H:%M")
        ext_options = compute_extension_options_from_slots(end_str, date_slots_cache[date_str])
        extend = [
            {
                "minutes": m,
                "label": format_extension_label(m),
                "new_end": (e + timedelta(minutes=m)).strftime("%H:%M"),
            }
            for m in ext_options
        ]

        bookings.append({
            "id": b["id"],
            "title": b["title"],
            "date": date_str,
            "start": s.strftime("%H:%M"),
            "end": end_str,
            "extend_options": extend,
        })

    return web.json_response({"ok": True, "bookings": bookings})


# ---------------------------------------------------------------------------
# Extend Booking
# ---------------------------------------------------------------------------

async def extend_booking_handler(request: web.Request) -> web.Response:
    """PATCH /api/bookings/{id}/extend — extend by N minutes via backend PATCH."""
    jwt = request["jwt"]
    try:
        booking_id = int(request.match_info["id"])
    except (KeyError, ValueError):
        return web.json_response({"ok": False, "error": "Invalid booking id"}, status=400)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    minutes = body.get("minutes", 0)
    if not isinstance(minutes, int) or minutes < MIN_SLOT_MINUTES or minutes % MIN_SLOT_MINUTES != 0:
        return web.json_response(
            {"ok": False, "error": f"minutes must be a positive multiple of {MIN_SLOT_MINUTES}"},
            status=400,
        )

    # Get current booking end_time from active bookings
    try:
        bookings = await api_client.get_active_bookings(jwt)
    except APIError:
        return web.json_response({"ok": False, "error": "Failed to load booking"}, status=500)

    booking = next((b for b in bookings if b["id"] == booking_id), None)
    if not booking:
        return web.json_response({"ok": False, "error": "Booking not found"}, status=404)

    end_dt = _parse_iso(booking["end_time"])
    new_end_dt = end_dt + timedelta(minutes=minutes)
    new_end_iso = new_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        await api_client.update_booking(jwt, booking_id, {"end_time": new_end_iso})
        new_end_local = new_end_dt.astimezone(tz).strftime("%H:%M")
        return web.json_response({
            "ok": True,
            "booking": {"id": booking_id, "end": new_end_local},
        })
    except APIError as e:
        if e.status == 409:
            return web.json_response({"ok": False, "error": "Slot no longer available"}, status=409)
        return web.json_response({"ok": False, "error": "Failed to extend"}, status=400)


# ---------------------------------------------------------------------------
# Cancel Booking
# ---------------------------------------------------------------------------

async def cancel_booking(request: web.Request) -> web.Response:
    """DELETE /api/bookings/{id} — cancel own booking via backend."""
    jwt = request["jwt"]
    try:
        booking_id = int(request.match_info["id"])
    except (KeyError, ValueError):
        return web.json_response({"ok": False, "error": "Invalid booking id"}, status=400)

    try:
        await api_client.delete_booking(jwt, booking_id)
        return web.json_response({"ok": True})
    except APIError:
        return web.json_response({"ok": False, "error": "Booking not found or not yours"}, status=404)


# ---------------------------------------------------------------------------
# Guest Bookings
# ---------------------------------------------------------------------------

async def get_guest_bookings(request: web.Request) -> web.Response:
    """GET /api/guest-bookings — bookings where current user is a guest."""
    jwt = request["jwt"]
    user = request.get("user", {})
    username = user.get("username", "")

    if not username:
        return web.json_response({"ok": True, "bookings": []})

    # Fetch bookings for next 30 days and filter client-side
    today = date.today().isoformat()
    future = (date.today() + timedelta(days=30)).isoformat()

    try:
        all_bookings = await api_client.get_bookings_range(jwt, today, future)
    except APIError:
        return web.json_response({"ok": False, "error": "Failed to load bookings"}, status=500)

    # Filter: user's @username in guests, and user is not the organizer
    at_username = f"@{username}"
    current_user_id = user.get("id", 0)

    bookings = []
    for b in all_bookings:
        guests = b.get("guests", [])
        if at_username not in guests:
            continue
        if b.get("user_id") == current_user_id:
            continue

        s = _parse_iso(b["start_time"]).astimezone(tz)
        e = _parse_iso(b["end_time"]).astimezone(tz)
        host = b.get("user", {}).get("display_name", "Unknown")

        bookings.append({
            "id": b["id"],
            "title": b["title"],
            "date": s.strftime("%Y-%m-%d"),
            "start": s.strftime("%H:%M"),
            "end": e.strftime("%H:%M"),
            "host": host,
        })

    return web.json_response({"ok": True, "bookings": bookings})


async def decline_booking(request: web.Request) -> web.Response:
    """POST /api/bookings/{id}/decline — not supported by current backend."""
    return web.json_response(
        {"ok": False, "error": "Decline is not supported yet. Please contact the organizer."},
        status=501,
    )
