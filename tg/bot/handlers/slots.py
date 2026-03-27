from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from datetime import date

import api_client
from api_client import APIError
from config import MIN_SLOT_MINUTES, WORKING_HOURS_START, WORKING_HOURS_END
from bot.keyboards.inline import date_picker_keyboard

router = Router()


def filter_working_hours(slots: list[dict]) -> list[dict]:
    """Filter slots to only working hours (09:00-19:00 Tashkent display)."""
    start_min = WORKING_HOURS_START * 60
    end_min = WORKING_HOURS_END * 60
    return [
        s for s in slots
        if _time_to_min(s["start"]) >= start_min
        and _time_to_min(s["end"]) <= end_min
    ]


def _time_to_min(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def compute_extension_options_from_slots(
    booking_end_str: str,
    all_slots: list[dict],
) -> list[int]:
    """
    Compute available extension durations (in minutes) from slot availability.
    Returns e.g. [30, 60, 90] meaning the booking can be extended by 30, 60, or 90 min.
    """
    end_min = _time_to_min(booking_end_str)
    working_end_min = WORKING_HOURS_END * 60

    if end_min >= working_end_min:
        return []

    # Sort slots by start time
    sorted_slots = sorted(all_slots, key=lambda s: s["start"])

    options = []
    accumulated = 0
    for slot in sorted_slots:
        slot_start_min = _time_to_min(slot["start"])
        # Only look at slots starting at or after booking end
        if slot_start_min < end_min:
            continue
        # Stop at working hours end
        if slot_start_min >= working_end_min:
            break

        if slot["available"] and slot_start_min == end_min + accumulated:
            accumulated += MIN_SLOT_MINUTES
            options.append(accumulated)
        else:
            # Either not available or non-contiguous — stop
            break

    return options


def format_extension_label(minutes: int) -> str:
    """Format minutes as a human-readable label: +30min, +1h, +1h30m."""
    hours = minutes // 60
    mins = minutes % 60
    if hours == 0:
        return f"+{mins}min"
    if mins == 0:
        return f"+{hours}h"
    return f"+{hours}h{mins}m"


@router.message(Command("slots"))
async def cmd_slots(message: Message):
    await message.answer(
        "📅 Select a date to see available slots:",
        reply_markup=date_picker_keyboard(),
    )


async def show_slots_for_date(date_str: str, message: Message, telegram_id: int, username: str | None = None):
    """Fetch slots from backend and display free ones."""
    from bot.keyboards.inline import time_slots_keyboard

    try:
        jwt = await api_client.get_user_jwt(telegram_id, username)
        all_slots = await api_client.get_slots(jwt, date_str)
    except APIError:
        await message.answer("⚠️ Failed to load slots. Please try again.")
        return

    # Filter to working hours and free slots
    working = filter_working_hours(all_slots)
    free = [(s["start"], s["end"]) for s in working if s["available"]]

    chosen = date.fromisoformat(date_str)

    if not free:
        await message.answer(f"😔 No available slots on {chosen.strftime('%d %b %Y')}.")
        return

    lines = [f"🟢 {s} – {e}" for s, e in free]
    await message.answer(
        f"Available slots on *{chosen.strftime('%d %b %Y')}*:\n\n" + "\n".join(lines) +
        "\n\nTap a slot to book it:",
        parse_mode="Markdown",
        reply_markup=time_slots_keyboard(free),
    )
