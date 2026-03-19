import io
from datetime import date, datetime, time, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from config import settings
from database import get_db
from models import Booking, Role, User
from schemas import BookingCreate, BookingOut, BookingUpdate
from telegram import send_notification, send_guest_notifications

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _local(dt: datetime) -> datetime:
    """Convert UTC-aware datetime to the configured local timezone."""
    try:
        tz = ZoneInfo(settings.APP_TIMEZONE)
    except Exception:
        # Fallback: parse "UTC+5" style or use UTC
        tz = timezone.utc
    # Ensure dt is timezone-aware (treat naive as UTC)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz)


@router.get("/export")
async def export_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Export current user's bookings as ICS calendar file."""
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.start_time)
    )
    bookings = result.scalars().all()

    def fmt_dt(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")

    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Meetaholic//RU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    for b in bookings:
        guests_note = ""
        if b.guests:
            guests_note = "\\nГости: " + ", ".join(f"@{g}" for g in b.guests)
        desc = ((b.description or "").replace("\n", "\\n") + guests_note).strip()
        lines += [
            "BEGIN:VEVENT",
            f"UID:meetaholic-{b.id}@meetaholic",
            f"DTSTAMP:{fmt_dt(datetime.now(timezone.utc))}",
            f"DTSTART:{fmt_dt(b.start_time)}",
            f"DTEND:{fmt_dt(b.end_time)}",
            f"SUMMARY:{b.title}",
            f"ORGANIZER;CN={b.user.name}:mailto:noreply@meetaholic",
            *(["DESCRIPTION:" + desc] if desc else []),
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")

    content = "\r\n".join(lines)
    filename = f"meetaholic_history_{datetime.now().strftime('%Y%m%d')}.ics"
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/active", response_model=list[BookingOut])
async def list_active_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookingOut]:
    """Return current user's bookings happening or starting within the next 30 days."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=30)
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.end_time >= now, Booking.start_time <= window_end, Booking.user_id == current_user.id))
        .order_by(Booking.start_time)
    )
    return result.scalars().all()


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    date_param: date = Query(alias="date", description="Filter by date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[BookingOut]:
    """Return all bookings for the given date (UTC day boundaries)."""
    day_start = datetime.combine(date_param, time.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(date_param, time.max).replace(tzinfo=timezone.utc)

    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.start_time >= day_start, Booking.start_time <= day_end))
        .order_by(Booking.start_time)
    )
    return result.scalars().all()


@router.post("", response_model=list[BookingOut], status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookingOut]:
    """Create one or more bookings. Returns a list (multiple for recurring)."""
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Время начала должно быть раньше времени окончания")
    duration_minutes = (payload.end_time - payload.start_time).total_seconds() / 60
    if duration_minutes < 15:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Минимальная длительность встречи — 15 минут")
    if duration_minutes > 480:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Максимальная длительность встречи — 8 часов")

    now_utc = datetime.now(timezone.utc)
    start_aware = payload.start_time if payload.start_time.tzinfo else payload.start_time.replace(tzinfo=timezone.utc)
    if start_aware < now_utc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя бронировать время в прошлом")

    # Build list of (start, end) pairs to create
    duration = payload.end_time - payload.start_time
    slots: list[tuple[datetime, datetime]] = [(payload.start_time, payload.end_time)]

    # Default recurrence_until if not provided: 30 days for daily, 90 for weekly/custom
    effective_until = payload.recurrence_until
    if payload.recurrence != "none" and not effective_until:
        default_days = 30 if payload.recurrence == "daily" else 90
        effective_until = (payload.start_time + timedelta(days=default_days)).date()

    if payload.recurrence != "none" and effective_until:
        until_dt = datetime.combine(effective_until, time.max).replace(tzinfo=timezone.utc)
        MAX_OCCURRENCES = 90

        if payload.recurrence == "custom" and payload.recurrence_days:
            # Walk day by day and include only matching weekdays (0=Mon..6=Sun)
            cur = payload.start_time + timedelta(days=1)
            while cur <= until_dt and len(slots) < MAX_OCCURRENCES:
                # Python weekday(): Mon=0..Sun=6
                if cur.weekday() in payload.recurrence_days:
                    slots.append((cur, cur + duration))
                cur += timedelta(days=1)
        else:
            delta = timedelta(days=1 if payload.recurrence == "daily" else 7)
            cur = payload.start_time + delta
            while cur <= until_dt and len(slots) < MAX_OCCURRENCES:
                slots.append((cur, cur + duration))
                cur += delta

    # Check overlap only for the first slot (fast path); recurring may have some clashes — skip those
    if payload.recurrence == "none":
        overlap = await db.execute(
            select(Booking).where(
                and_(Booking.start_time < payload.end_time, Booking.end_time > payload.start_time)
            )
        )
        if overlap.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Время пересекается с существующим бронированием")

    group_id = int(datetime.now(timezone.utc).timestamp() * 1000) if len(slots) > 1 else None

    created: list[Booking] = []
    for s, e in slots:
        if payload.recurrence != "none":
            # Skip instances that overlap existing bookings
            ov = await db.execute(
                select(Booking).where(and_(Booking.start_time < e, Booking.end_time > s))
            )
            if ov.scalar_one_or_none():
                continue

        b = Booking(
            title=payload.title,
            description=payload.description,
            start_time=s,
            end_time=e,
            user_id=current_user.id,
            guests=payload.guests,
            recurrence=payload.recurrence,
            recurrence_until=effective_until,
            recurrence_group_id=group_id,
            recurrence_days=payload.recurrence_days,
        )
        db.add(b)
        created.append(b)

    if not created:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Все временные слоты заняты")

    await db.commit()

    # Reload with user relation
    ids = []
    for b in created:
        await db.refresh(b)
        ids.append(b.id)

    result = await db.execute(
        select(Booking).options(selectinload(Booking.user))
        .where(Booking.id.in_(ids))
        .order_by(Booking.start_time)
    )
    bookings = list(result.scalars().all())
    first = bookings[0]

    start_fmt = _local(first.start_time).strftime("%d.%m.%Y %H:%M")
    end_fmt = _local(first.end_time).strftime("%H:%M")
    recurring_note = f"\n🔄 Серия: {len(bookings)} встреч" if len(bookings) > 1 else ""
    guests_line = f"\n👥 Гости: {', '.join('@' + g for g in payload.guests)}" if payload.guests else ""
    await send_notification(
        f"📅 <b>Новое бронирование</b>\n"
        f"👤 {current_user.name}\n"
        f"📌 {payload.title}\n"
        f"🕐 {start_fmt} – {end_fmt}"
        f"{recurring_note}{guests_line}"
    )

    if payload.guests:
        await send_guest_notifications(
            db=db,
            guest_usernames=payload.guests,
            message=(
                f"📅 Вас пригласили на встречу!\n"
                f"📌 <b>{payload.title}</b>\n"
                f"🕐 {start_fmt} – {end_fmt}\n"
                f"👤 Организатор: {current_user.name}"
            ),
        )

    return bookings


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: int,
    delete_series: bool = Query(default=False, description="Удалить всю серию повторяющихся встреч"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.user_id != current_user.id and current_user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this booking")

    owner_name = booking.user.name
    start_fmt = _local(booking.start_time).strftime("%d.%m.%Y %H:%M")
    end_fmt = _local(booking.end_time).strftime("%H:%M")
    title = booking.title
    guests = list(booking.guests or [])

    if delete_series and booking.recurrence_group_id:
        # Delete all future bookings in the same series (including this one)
        now_utc = datetime.now(timezone.utc)
        series_result = await db.execute(
            select(Booking).where(
                and_(
                    Booking.recurrence_group_id == booking.recurrence_group_id,
                    Booking.start_time >= now_utc,
                )
            )
        )
        for b in series_result.scalars().all():
            await db.delete(b)
        count_note = " (серия)"
    else:
        await db.delete(booking)
        count_note = ""

    await db.commit()

    await send_notification(
        f"❌ <b>Бронирование отменено{count_note}</b>\n"
        f"👤 {owner_name}\n"
        f"📌 {title}\n"
        f"🕐 {start_fmt} – {end_fmt}"
    )

    # Notify guests on cancellation
    if guests:
        await send_guest_notifications(
            db=db,
            guest_usernames=guests,
            message=(
                f"❌ Встреча отменена\n"
                f"📌 <b>{title}</b>\n"
                f"🕐 {start_fmt} – {end_fmt}"
            ),
        )


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingOut:
    """Update title/times of a booking. Only owner or admin."""
    result = await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.user_id != current_user.id and current_user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to edit this booking")

    new_start = payload.start_time or booking.start_time
    new_end = payload.end_time or booking.end_time

    if new_start >= new_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_time must be before end_time")

    overlap = await db.execute(
        select(Booking).where(
            and_(
                Booking.id != booking_id,
                Booking.start_time < new_end,
                Booking.end_time > new_start,
            )
        )
    )
    if overlap.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Время пересекается с существующим бронированием")

    changes: list[str] = []
    if payload.title is not None and payload.title != booking.title:
        changes.append(f"📝 Название: <s>{booking.title}</s> → <b>{payload.title}</b>")
        booking.title = payload.title
    if payload.description is not None:
        booking.description = payload.description
    if payload.start_time is not None and payload.start_time != booking.start_time:
        changes.append(f"🕐 Начало: {_local(booking.start_time).strftime('%d.%m %H:%M')} → {_local(payload.start_time).strftime('%d.%m %H:%M')}")
        booking.start_time = payload.start_time
        booking.reminder_sent = False
    if payload.end_time is not None and payload.end_time != booking.end_time:
        changes.append(f"🕑 Конец: {_local(booking.end_time).strftime('%H:%M')} → {_local(payload.end_time).strftime('%H:%M')}")
        booking.end_time = payload.end_time

    new_guests: list[str] | None = None
    if payload.guests is not None:
        old_guests: set[str] = set(booking.guests or [])
        added = set(payload.guests) - old_guests
        if added:
            changes.append(f"👥 Новые гости: {', '.join('@' + g for g in added)}")
            new_guests = payload.guests
        elif set(payload.guests) != old_guests:
            new_guests = payload.guests
        booking.guests = payload.guests

    await db.commit()
    await db.refresh(booking)

    result2 = await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(Booking.id == booking.id)
    )
    updated = result2.scalar_one()

    if changes:
        changes_text = "\n".join(changes)
        await send_notification(
            f"✏️ <b>Бронирование изменено</b>\n"
            f"👤 {current_user.name}\n"
            f"📌 {updated.title}\n"
            f"{changes_text}"
        )
        if current_user.id != updated.user_id:
            await send_notification(
                f"⚠️ Ваша встреча <b>«{updated.title}»</b> была изменена администратором.\n{changes_text}",
                chat_id=str(updated.user.telegram_id),
            )

    if new_guests:
        start_fmt = _local(updated.start_time).strftime("%d.%m.%Y %H:%M")
        end_fmt = _local(updated.end_time).strftime("%H:%M")
        await send_guest_notifications(
            db=db,
            guest_usernames=new_guests,
            message=(
                f"📅 Вас пригласили на встречу!\n"
                f"📌 <b>{updated.title}</b>\n"
                f"🕐 {start_fmt} – {end_fmt}\n"
                f"👤 Организатор: {updated.user.name}"
            ),
        )

    return updated
