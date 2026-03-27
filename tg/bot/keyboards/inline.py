from __future__ import annotations

from datetime import datetime, date, timedelta

import pytz
from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from config import TIMEZONE

tz = pytz.timezone(TIMEZONE)


def date_picker_keyboard() -> InlineKeyboardMarkup:
    """Offer today and the next 6 days."""
    builder = InlineKeyboardBuilder()
    today = date.today()
    for i in range(7):
        d = today + timedelta(days=i)
        label = "Today" if i == 0 else ("Tomorrow" if i == 1 else d.strftime("%a, %d %b"))
        builder.button(text=label, callback_data=f"date:{d.isoformat()}")
    builder.adjust(2)
    return builder.as_markup()


def time_slots_keyboard(free_slots: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    """Each free slot is a (start, end) pair formatted as HH:MM."""
    builder = InlineKeyboardBuilder()
    for start, end in free_slots:
        builder.button(
            text=f"{start} – {end}",
            callback_data=f"slot:{start}:{end}",
        )
    builder.button(text="❌ Cancel", callback_data="cancel")
    builder.adjust(2)
    return builder.as_markup()


def confirm_keyboard(start: str, end: str, date_str: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Confirm", callback_data=f"confirm:{date_str}:{start}:{end}")
    builder.button(text="❌ Cancel", callback_data="cancel")
    builder.adjust(2)
    return builder.as_markup()


def _parse_iso(iso_str: str) -> datetime:
    s = iso_str.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


def my_bookings_keyboard(bookings: list[dict], extend_map: dict | None = None) -> InlineKeyboardMarkup:
    """Two buttons per booking: Extend (if available) + Cancel.
    bookings: list of BookingResponse dicts from the backend API.
    """
    builder = InlineKeyboardBuilder()
    extend_map = extend_map or {}
    for b in bookings:
        start_dt = _parse_iso(b["start_time"]).astimezone(tz)
        time_label = start_dt.strftime("%d %b %H:%M")
        if b["id"] in extend_map and extend_map[b["id"]]:
            builder.button(text="⏰ Extend", callback_data=f"extend_booking:{b['id']}")
        builder.button(text=f"🗑 {b['title']} ({time_label})", callback_data=f"cancel_booking:{b['id']}")
    builder.adjust(1)
    return builder.as_markup()


def extend_options_keyboard(booking_id: int, options: list[int]) -> InlineKeyboardMarkup:
    """Options like (+30min, +1h) for extending a booking."""
    from bot.handlers.slots import format_extension_label
    builder = InlineKeyboardBuilder()
    for minutes in options:
        label = format_extension_label(minutes)
        builder.button(text=label, callback_data=f"do_extend:{booking_id}:{minutes}")
    builder.button(text="↩ Back", callback_data="back_to_mybookings")
    builder.adjust(3)
    return builder.as_markup()
