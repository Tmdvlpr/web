from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery

import api_client
from api_client import APIError
from config import TIMEZONE
from bot.handlers.slots import compute_extension_options_from_slots, format_extension_label
from bot.keyboards.inline import my_bookings_keyboard, extend_options_keyboard

import pytz

router = Router()
tz = pytz.timezone(TIMEZONE)
log = logging.getLogger(__name__)


def _parse_iso(iso_str: str) -> datetime:
    """Parse ISO datetime string from backend response."""
    # Handle both "2026-03-27T10:00:00+00:00" and "2026-03-27T10:00:00Z"
    s = iso_str.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


async def _build_mybookings_message(telegram_id: int, username: str | None = None):
    """Fetch bookings via API, compute extend options, return (text, keyboard)."""
    try:
        jwt = await api_client.get_user_jwt(telegram_id, username)
        bookings = await api_client.get_active_bookings(jwt)
    except APIError:
        return "⚠️ Failed to load bookings.", None

    if not bookings:
        return "You have no upcoming bookings.", None

    # Compute extension options per booking using slots API
    date_slots_cache: dict[str, list[dict]] = {}
    extend_map: dict[int, list[int]] = {}

    lines = []
    for b in bookings:
        start_dt = _parse_iso(b["start_time"]).astimezone(tz)
        end_dt = _parse_iso(b["end_time"]).astimezone(tz)

        start_str = start_dt.strftime("%d %b %H:%M")
        end_str = end_dt.strftime("%H:%M")
        lines.append(f"• *{b['title']}* — {start_str}–{end_str}")

        date_str = start_dt.strftime("%Y-%m-%d")
        if date_str not in date_slots_cache:
            try:
                date_slots_cache[date_str] = await api_client.get_slots(jwt, date_str)
            except APIError:
                date_slots_cache[date_str] = []

        end_time_str = end_dt.strftime("%H:%M")
        ext = compute_extension_options_from_slots(end_time_str, date_slots_cache[date_str])
        if ext:
            extend_map[b["id"]] = ext

    text = (
        "📋 *Your upcoming bookings:*\n\n" + "\n".join(lines) +
        "\n\nTap to extend or cancel:"
    )
    kb = my_bookings_keyboard(bookings, extend_map)
    return text, kb


@router.message(Command("mybookings"))
async def cmd_mybookings(message: Message):
    try:
        await api_client.get_user_jwt(message.from_user.id, message.from_user.username)
    except APIError:
        await message.answer("Please run /start first.")
        return

    text, kb = await _build_mybookings_message(
        message.from_user.id, message.from_user.username,
    )
    await message.answer(text, parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data == "back_to_mybookings")
async def cb_back_to_mybookings(call: CallbackQuery):
    text, kb = await _build_mybookings_message(
        call.from_user.id, call.from_user.username,
    )
    await call.message.edit_text(text, parse_mode="Markdown", reply_markup=kb)
    await call.answer()


@router.callback_query(F.data.startswith("extend_booking:"))
async def cb_extend_booking(call: CallbackQuery):
    booking_id = int(call.data.split(":")[1])

    try:
        jwt = await api_client.get_user_jwt(call.from_user.id, call.from_user.username)
        bookings = await api_client.get_active_bookings(jwt)
    except APIError:
        await call.answer("Please run /start first.", show_alert=True)
        return

    booking = next((b for b in bookings if b["id"] == booking_id), None)
    if not booking:
        await call.answer("Booking not found.", show_alert=True)
        return

    end_dt = _parse_iso(booking["end_time"]).astimezone(tz)
    date_str = _parse_iso(booking["start_time"]).astimezone(tz).strftime("%Y-%m-%d")
    end_str = end_dt.strftime("%H:%M")

    try:
        all_slots = await api_client.get_slots(jwt, date_str)
    except APIError:
        await call.answer("Failed to load slots.", show_alert=True)
        return

    options = compute_extension_options_from_slots(end_str, all_slots)
    if not options:
        await call.answer("No available slots to extend into.", show_alert=True)
        return

    await call.message.edit_text(
        f"⏰ Extend *{booking['title']}* (currently ends at {end_str}).\n\nChoose extension:",
        parse_mode="Markdown",
        reply_markup=extend_options_keyboard(booking_id, options),
    )
    await call.answer()


@router.callback_query(F.data.startswith("do_extend:"))
async def cb_do_extend(call: CallbackQuery):
    parts = call.data.split(":")
    booking_id = int(parts[1])
    minutes = int(parts[2])

    try:
        jwt = await api_client.get_user_jwt(call.from_user.id, call.from_user.username)
        # Get current booking to compute new end_time
        bookings = await api_client.get_active_bookings(jwt)
    except APIError:
        await call.answer("Please run /start first.", show_alert=True)
        return

    booking = next((b for b in bookings if b["id"] == booking_id), None)
    if not booking:
        await call.answer("Booking not found.", show_alert=True)
        return

    end_dt = _parse_iso(booking["end_time"])
    new_end_dt = end_dt + timedelta(minutes=minutes)
    new_end_iso = new_end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        await api_client.update_booking(jwt, booking_id, {"end_time": new_end_iso})
        new_end_local = new_end_dt.astimezone(tz).strftime("%H:%M")
        await call.answer(f"Extended to {new_end_local}!", show_alert=False)
        # Refresh the bookings list
        text, kb = await _build_mybookings_message(call.from_user.id, call.from_user.username)
        await call.message.edit_text(text, parse_mode="Markdown", reply_markup=kb)
    except APIError as e:
        if e.status == 409:
            await call.answer("Slot no longer available.", show_alert=True)
        else:
            await call.answer("Failed to extend.", show_alert=True)


@router.callback_query(F.data.startswith("cancel_booking:"))
async def cb_cancel_booking(call: CallbackQuery):
    booking_id = int(call.data.split(":")[1])

    try:
        jwt = await api_client.get_user_jwt(call.from_user.id, call.from_user.username)
        await api_client.delete_booking(jwt, booking_id)
    except APIError:
        await call.answer("Booking not found or already cancelled.", show_alert=True)
        return

    await call.answer("Booking cancelled.", show_alert=False)
    text, kb = await _build_mybookings_message(call.from_user.id, call.from_user.username)
    if kb:
        await call.message.edit_text(text, parse_mode="Markdown", reply_markup=kb)
    else:
        await call.message.edit_text("✅ Booking cancelled. No more upcoming bookings.")
