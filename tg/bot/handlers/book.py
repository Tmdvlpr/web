from __future__ import annotations

import logging
from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

log = logging.getLogger(__name__)

import api_client
from api_client import APIError
from bot.keyboards.inline import confirm_keyboard
from bot.handlers.slots import show_slots_for_date

router = Router()


class BookingFSM(StatesGroup):
    choosing_date = State()
    choosing_slot = State()
    entering_title = State()
    confirming    = State()


# --- date selected ---
@router.callback_query(F.data.startswith("date:"))
async def cb_date_selected(call: CallbackQuery, state: FSMContext):
    date_str = call.data.split(":", 1)[1]
    await state.update_data(date=date_str)
    await state.set_state(BookingFSM.choosing_slot)
    await call.message.delete()
    await show_slots_for_date(
        date_str, call.message,
        telegram_id=call.from_user.id,
        username=call.from_user.username,
    )
    await call.answer()


# --- slot selected ---
@router.callback_query(F.data.startswith("slot:"))
async def cb_slot_selected(call: CallbackQuery, state: FSMContext):
    log.info("slot callback received: %s", call.data)
    # callback_data = "slot:HH:MM:HH:MM" → split into 5 parts
    parts = call.data.split(":")
    start = parts[1] + ":" + parts[2]
    end   = parts[3] + ":" + parts[4]
    await state.update_data(start=start, end=end)
    await state.set_state(BookingFSM.entering_title)
    await call.message.delete()
    await call.message.answer(
        f"🕐 Slot: *{start} – {end}*\n\nPlease enter a title for the meeting:",
        parse_mode="Markdown",
    )
    await call.answer()


# --- title entered ---
@router.message(BookingFSM.entering_title)
async def fsm_title_entered(message: Message, state: FSMContext):
    title = message.text.strip()
    if not title:
        await message.answer("Title cannot be empty. Please enter a meeting title:")
        return

    data = await state.get_data()
    await state.update_data(title=title)
    await state.set_state(BookingFSM.confirming)

    await message.answer(
        f"📋 *Confirm your booking:*\n\n"
        f"📅 Date:  {data['date']}\n"
        f"🕐 Time:  {data['start']} – {data['end']}\n"
        f"📝 Title: {title}",
        parse_mode="Markdown",
        reply_markup=confirm_keyboard(data["start"], data["end"], data["date"]),
    )


# --- confirmed ---
@router.callback_query(F.data.startswith("confirm:"))
async def cb_confirmed(call: CallbackQuery, state: FSMContext):
    log.info("confirm callback received: %s", call.data)
    try:
        parts = call.data.split(":")          # confirm:YYYY-MM-DD:HH:MM:HH:MM
        date_str = parts[1]
        start_str = parts[2] + ":" + parts[3]
        end_str   = parts[4] + ":" + parts[5]

        data = await state.get_data()
        title = data["title"]

        # Build ISO datetimes for the backend
        start_iso = f"{date_str}T{start_str}:00Z"
        end_iso   = f"{date_str}T{end_str}:00Z"

        # Get JWT for this user and create booking via backend
        jwt = await api_client.get_user_jwt(
            call.from_user.id,
            call.from_user.username,
            call.from_user.first_name or "User",
        )

        await api_client.create_booking(jwt, {
            "title": title,
            "start_time": start_iso,
            "end_time": end_iso,
        })

        await state.clear()
        await call.message.edit_text(
            f"✅ Booked!\n\n"
            f"📅 {date_str}  🕐 {start_str} – {end_str}\n"
            f"📝 {title}\n\n"
            "Use /mybookings to manage your bookings."
        )
        await call.answer()

    except APIError as e:
        if e.status == 409:
            await call.message.edit_text(
                "⚠️ Sorry, this slot was just taken. Use /slots to pick another."
            )
        else:
            log.error("Booking API error: %s", e)
            await call.message.edit_text("⚠️ Booking failed. Please try again.")
        await state.clear()
        await call.answer()
    except Exception:
        log.exception("Error in cb_confirmed")


# --- cancel flow ---
@router.callback_query(F.data == "cancel")
async def cb_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("❌ Booking cancelled.")
    await call.answer()
