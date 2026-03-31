"""
Внутренний роутер /api/v1/internal/*

Доступен только для TG Bot-а. Защищён заголовком X-Bot-Secret.
Пользователи и внешние клиенты к этим эндпоинтам доступа не имеют.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.booking import Booking
from app.models.browser_session import BrowserSession
from app.models.user import User

router = APIRouter(prefix="/internal", tags=["internal"])


# ── Аутентификация бота ───────────────────────────────────────────────────────

def verify_bot_secret(x_bot_secret: str = Header(..., alias="X-Bot-Secret")) -> None:
    """Проверяет секрет бота. 401 если не совпадает или не задан."""
    if not settings.BOT_SECRET or x_bot_secret != settings.BOT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing bot secret",
        )


# ── Схемы ответов ─────────────────────────────────────────────────────────────

class UserBotInfo(BaseModel):
    id: int
    telegram_id: int | None
    username: str | None
    display_name: str

    class Config:
        from_attributes = True


class BookingBotInfo(BaseModel):
    id: int
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    prev_start_time: datetime | None = None
    prev_end_time: datetime | None = None
    guests: list[str]
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime
    user: UserBotInfo

    class Config:
        from_attributes = True


class EnsureUserRequest(BaseModel):
    telegram_id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    full_name: str | None = None


class ConsumeSessionRequest(BaseModel):
    token: str
    telegram_id: int


# ── Эндпоинты: встречи ────────────────────────────────────────────────────────

@router.get(
    "/bookings/since",
    response_model=list[BookingBotInfo],
    summary="Встречи, обновлённые после указанного времени (для уведомлений)",
)
async def bookings_since(
    updated_at: datetime,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> list[BookingBotInfo]:
    """
    Возвращает встречи у которых updated_at >= updated_at.
    Бот использует для отправки уведомлений в группу и гостям.
    """
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.updated_at >= updated_at, Booking.deleted_at.is_(None)))
        .order_by(Booking.updated_at)
    )
    bookings = result.scalars().all()

    return [
        BookingBotInfo(
            id=b.id,
            title=b.title,
            description=b.description,
            start_time=b.start_time,
            end_time=b.end_time,
            guests=b.guests,
            reminder_sent=b.reminder_sent,
            created_at=b.created_at,
            updated_at=b.updated_at,
            user=UserBotInfo(
                id=b.user.id,
                telegram_id=b.user.telegram_id,
                username=b.user.username,
                display_name=b.user.display_name,
            ),
        )
        for b in bookings
    ]


@router.get(
    "/bookings/reminders",
    response_model=list[BookingBotInfo],
    summary="Встречи, которым нужно отправить напоминание (14-16 мин до начала)",
)
async def bookings_for_reminder(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> list[BookingBotInfo]:
    """
    Возвращает встречи где start_time через 14-16 мин и reminder_sent = false.
    Бот вызывает каждые 60 сек.
    """
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=14)
    window_end   = now + timedelta(minutes=16)

    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(
            Booking.start_time >= window_start,
            Booking.start_time <= window_end,
            Booking.reminder_sent == False,  # noqa: E712
            Booking.deleted_at.is_(None),
        ))
    )
    bookings = result.scalars().all()

    return [
        BookingBotInfo(
            id=b.id,
            title=b.title,
            description=b.description,
            start_time=b.start_time,
            end_time=b.end_time,
            guests=b.guests,
            reminder_sent=b.reminder_sent,
            created_at=b.created_at,
            updated_at=b.updated_at,
            user=UserBotInfo(
                id=b.user.id,
                telegram_id=b.user.telegram_id,
                username=b.user.username,
                display_name=b.user.display_name,
            ),
        )
        for b in bookings
    ]


@router.post(
    "/bookings/{booking_id}/mark-reminded",
    summary="Поставить reminder_sent = true для встречи",
)
async def mark_reminded(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> dict:
    """Вызывается ботом после успешной отправки напоминания."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.reminder_sent = True
    await db.commit()
    return {"ok": True, "id": booking_id}


@router.get(
    "/bookings/deleted-since",
    response_model=list[BookingBotInfo],
    summary="Встречи, удалённые после указанного времени (для уведомлений об отмене)",
)
async def bookings_deleted_since(
    since: datetime,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> list[BookingBotInfo]:
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(and_(Booking.deleted_at.isnot(None), Booking.deleted_at >= since))
        .order_by(Booking.deleted_at)
    )
    bookings = result.scalars().all()
    return [
        BookingBotInfo(
            id=b.id, title=b.title, description=b.description,
            start_time=b.start_time, end_time=b.end_time,
            guests=b.guests, reminder_sent=b.reminder_sent,
            created_at=b.created_at, updated_at=b.updated_at,
            user=UserBotInfo(
                id=b.user.id, telegram_id=b.user.telegram_id,
                username=b.user.username, display_name=b.user.display_name,
            ),
        )
        for b in bookings
    ]


# ── Эндпоинты: пользователи ───────────────────────────────────────────────────

@router.post(
    "/users/ensure",
    summary="Создать пользователя по данным Telegram, если ещё не существует",
)
async def ensure_user(
    body: EnsureUserRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> dict:
    """
    Вызывается при /start без токена.
    Создаёт запись User из telegram_id если её нет. Обновляет username если изменился.
    """
    result = await db.execute(
        select(User).where(User.telegram_id == body.telegram_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            telegram_id=body.telegram_id,
            first_name=body.first_name,
            last_name=body.last_name,
            name=body.full_name or f"{body.first_name or ''} {body.last_name or ''}".strip(),
            username=body.username,
            is_registered=False,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        return {"ok": True, "created": True}

    # Обновляем username если изменился
    if body.username and body.username != user.username:
        user.username = body.username
        await db.commit()

    return {"ok": True, "created": False}


@router.get(
    "/users/by-username/{username}",
    summary="Найти пользователя по @username (для отправки личного уведомления)",
)
async def get_user_by_username(
    username: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> dict:
    """Возвращает telegram_id пользователя по username, или 404."""
    clean = username.lstrip("@")
    result = await db.execute(select(User).where(User.username == clean))
    user = result.scalar_one_or_none()
    if not user or not user.telegram_id:
        raise HTTPException(status_code=404, detail="User not found or has no telegram_id")
    return {"telegram_id": user.telegram_id, "display_name": user.display_name}


# ── Эндпоинты: авторизация ────────────────────────────────────────────────────

@router.post(
    "/auth/consume-session",
    summary="Сжечь browser_session токен (QR/deep-link авторизация)",
)
async def consume_session_bot(
    body: ConsumeSessionRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_bot_secret),
) -> dict:
    """
    Вызывается при /start {token}.
    Находит сессию, сжигает токен, привязывает telegram_id к пользователю.
    Браузер забирает JWT отдельно через GET /api/v1/auth/session/{token}.
    """
    result = await db.execute(
        select(BrowserSession).where(BrowserSession.token == body.token)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.used:
        raise HTTPException(status_code=410, detail="Session already used")

    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session expired")

    # Находим пользователя по telegram_id
    user_result = await db.execute(select(User).where(User.telegram_id == body.telegram_id))
    user = user_result.scalar_one_or_none()

    if session.user_id:
        # Обычная сессия (из Mini App) — привязать telegram_id если не задан
        if not user:
            existing = await db.execute(select(User).where(User.id == session.user_id))
            user = existing.scalar_one_or_none()
            if user and not user.telegram_id:
                user.telegram_id = body.telegram_id
    else:
        # QR-сессия (user_id=NULL) — создать юзера если не существует
        if not user:
            user = User(
                telegram_id=body.telegram_id,
                name=f"user_{body.telegram_id}",
                is_registered=True,
                is_active=True,
            )
            db.add(user)
            await db.flush()
        session.user_id = user.id

    # Сжигаем токен
    session.used = True
    session.used_at = datetime.now(timezone.utc)
    await db.commit()

    return {"ok": True}
