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

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.booking import Booking
from app.models.user import Role, User
from app.schemas.booking import BookingCreate, BookingResponse, BookingUpdate

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/feed/{feed_token}")
async def public_ical_feed(
    feed_token: str,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    from sqlalchemy import select as _select
    user_result = await db.execute(
        _select(User).where(User.feed_token == feed_token)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(404, "Feed not found")

    result = await db.execute(
        _select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.user_id == user.id, Booking.deleted_at.is_(None)))
        .order_by(Booking.start_time)
    )
    bookings = result.scalars().all()

    def fmt_dt(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")

    lines: list[str] = [
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "PRODID:-//CorpMeet//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
        f"X-PUBLISHED-TTL:PT15M",
    ]
    for b in bookings:
        guests_note = ("\\nГости: " + ", ".join(f"@{g}" for g in b.guests)) if b.guests else ""
        desc = ((b.description or "").replace("\n", "\\n") + guests_note).strip()
        lines += [
            "BEGIN:VEVENT",
            f"UID:corpmeet-{b.id}@corpmeet",
            f"DTSTAMP:{fmt_dt(datetime.now(timezone.utc))}",
            f"DTSTART:{fmt_dt(b.start_time)}",
            f"DTEND:{fmt_dt(b.end_time)}",
            f"SUMMARY:{b.title}",
            f"ORGANIZER;CN={b.user.display_name}:mailto:noreply@corpmeet",
            *(["DESCRIPTION:" + desc] if desc else []),
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    content = "\r\n".join(lines)
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": "inline; filename=corpmeet.ics"},
    )


ADMIN_ROLES = {Role.admin, Role.superadmin}


@router.get("/admin/all", response_model=list[BookingResponse])
async def admin_list_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookingResponse]:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(403, "Admin only")
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(Booking.deleted_at.is_(None))
        .order_by(Booking.start_time.desc())
        .limit(200)
    )
    return result.scalars().all()


def _local(dt: datetime) -> datetime:
    try:
        tz = ZoneInfo(settings.APP_TIMEZONE)
    except Exception:
        tz = timezone.utc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz)


@router.get("/export")
async def export_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.user_id == current_user.id, Booking.deleted_at.is_(None)))
        .order_by(Booking.start_time)
    )
    bookings = result.scalars().all()

    def fmt_dt(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")

    lines: list[str] = [
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "PRODID:-//CorpMeet//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ]
    for b in bookings:
        guests_note = ("\\nГости: " + ", ".join(f"@{g}" for g in b.guests)) if b.guests else ""
        desc = ((b.description or "").replace("\n", "\\n") + guests_note).strip()
        lines += [
            "BEGIN:VEVENT",
            f"UID:corpmeet-{b.id}@corpmeet",
            f"DTSTAMP:{fmt_dt(datetime.now(timezone.utc))}",
            f"DTSTART:{fmt_dt(b.start_time)}",
            f"DTEND:{fmt_dt(b.end_time)}",
            f"SUMMARY:{b.title}",
            f"ORGANIZER;CN={b.user.display_name}:mailto:noreply@corpmeet",
            *(["DESCRIPTION:" + desc] if desc else []),
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    content = "\r\n".join(lines)
    filename = f"corpmeet_{datetime.now().strftime('%Y%m%d')}.ics"
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/active", response_model=list[BookingResponse])
async def list_active(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookingResponse]:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(
            Booking.end_time >= now,
            Booking.start_time <= now + timedelta(days=30),
            Booking.user_id == current_user.id,
            Booking.deleted_at.is_(None),
        ))
        .order_by(Booking.start_time)
    )
    return result.scalars().all()


@router.get("", response_model=list[BookingResponse])
async def list_bookings(
    date_from: date = Query(alias="date_from", description="Start date (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, alias="date_to", description="End date (YYYY-MM-DD), defaults to date_from"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[BookingResponse]:
    end_date = date_to or date_from
    day_start = datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.start_time >= day_start, Booking.start_time <= day_end, Booking.deleted_at.is_(None)))
        .order_by(Booking.start_time)
    )
    return result.scalars().all()


@router.post("", response_model=list[BookingResponse], status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookingResponse]:
    if payload.start_time >= payload.end_time:
        raise HTTPException(400, "start_time must be before end_time")
    duration_min = (payload.end_time - payload.start_time).total_seconds() / 60
    if duration_min < 15:
        raise HTTPException(400, "Минимальная длительность — 15 минут")
    if duration_min > 480:
        raise HTTPException(400, "Максимальная длительность — 8 часов")

    now_utc = datetime.now(timezone.utc)
    start_aware = payload.start_time if payload.start_time.tzinfo else payload.start_time.replace(tzinfo=timezone.utc)
    if start_aware < now_utc:
        raise HTTPException(400, "Нельзя бронировать время в прошлом")

    duration = payload.end_time - payload.start_time
    slots: list[tuple[datetime, datetime]] = [(payload.start_time, payload.end_time)]

    effective_until = payload.recurrence_until
    if payload.recurrence != "none" and not effective_until:
        default_days = 30 if payload.recurrence == "daily" else 90
        effective_until = (payload.start_time + timedelta(days=default_days)).date()

    if payload.recurrence != "none" and effective_until:
        until_dt = datetime.combine(effective_until, time.max).replace(tzinfo=timezone.utc)
        MAX_OCC = 90
        if payload.recurrence == "custom" and payload.recurrence_days:
            cur = payload.start_time + timedelta(days=1)
            while cur <= until_dt and len(slots) < MAX_OCC:
                if cur.weekday() in payload.recurrence_days:
                    slots.append((cur, cur + duration))
                cur += timedelta(days=1)
        else:
            delta = timedelta(days=1 if payload.recurrence == "daily" else 7)
            cur = payload.start_time + delta
            while cur <= until_dt and len(slots) < MAX_OCC:
                slots.append((cur, cur + duration))
                cur += delta

    if payload.recurrence == "none":
        ov = await db.execute(
            select(Booking).where(and_(Booking.start_time < payload.end_time, Booking.end_time > payload.start_time, Booking.deleted_at.is_(None))).with_for_update()
        )
        if ov.scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "Время пересекается с существующим бронированием")

    group_id = int(now_utc.timestamp() * 1000) if len(slots) > 1 else None
    created: list[Booking] = []

    for s, e in slots:
        if payload.recurrence != "none":
            ov = await db.execute(select(Booking).where(and_(Booking.start_time < e, Booking.end_time > s, Booking.deleted_at.is_(None))).with_for_update())
            if ov.scalar_one_or_none():
                continue
        b = Booking(
            title=payload.title, description=payload.description,
            start_time=s, end_time=e, user_id=current_user.id,
            guests=payload.guests, recurrence=payload.recurrence,
            recurrence_until=effective_until, recurrence_group_id=group_id,
            recurrence_days=payload.recurrence_days,
        )
        db.add(b)
        created.append(b)

    if not created:
        raise HTTPException(status.HTTP_409_CONFLICT, "Все временные слоты заняты")

    await db.commit()
    ids = [b.id for b in created]
    for b in created:
        await db.refresh(b)

    result = await db.execute(
        select(Booking).options(selectinload(Booking.user))
        .where(Booking.id.in_(ids)).order_by(Booking.start_time)
    )
    return list(result.scalars().all())


@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    result = await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.user_id != current_user.id and current_user.role not in ADMIN_ROLES:
        raise HTTPException(403, "Not allowed")

    new_start = payload.start_time or booking.start_time
    new_end = payload.end_time or booking.end_time
    if new_start >= new_end:
        raise HTTPException(400, "start_time must be before end_time")

    ov = await db.execute(
        select(Booking).where(and_(
            Booking.id != booking_id,
            Booking.start_time < new_end,
            Booking.end_time > new_start,
            Booking.deleted_at.is_(None),
        )).with_for_update()
    )
    if ov.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Время пересекается с существующим бронированием")

    if payload.title is not None:
        booking.title = payload.title
    if payload.description is not None:
        booking.description = payload.description
    # Save previous time before changing (for notification with old→new)
    if payload.start_time is not None or payload.end_time is not None:
        booking.prev_start_time = booking.start_time
        booking.prev_end_time = booking.end_time
    if payload.start_time is not None:
        booking.start_time = payload.start_time
        booking.reminder_sent = False
    if payload.end_time is not None:
        booking.end_time = payload.end_time
    if payload.guests is not None:
        booking.guests = payload.guests

    await db.commit()
    await db.refresh(booking)

    result2 = await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(Booking.id == booking.id)
    )
    return result2.scalar_one()


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: int,
    delete_series: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.deleted_at.is_(None))
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.user_id != current_user.id and current_user.role not in ADMIN_ROLES:
        raise HTTPException(403, "Not allowed")

    now_utc = datetime.now(timezone.utc)
    if delete_series and booking.recurrence_group_id:
        series = await db.execute(
            select(Booking).where(and_(
                Booking.recurrence_group_id == booking.recurrence_group_id,
                Booking.start_time >= now_utc,
                Booking.deleted_at.is_(None),
            ))
        )
        for b in series.scalars().all():
            b.deleted_at = now_utc
    else:
        booking.deleted_at = now_utc

    await db.commit()
