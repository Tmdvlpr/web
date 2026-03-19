import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import check_group_membership, create_access_token, get_current_user, verify_telegram_hash
from config import settings
from database import get_db
from models import QRSession, QRStatus, User
from schemas import QRSessionOut, QRStatusOut, TelegramAuthData, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_AUTH_AGE_SECONDS = 86400  # 24 hours


@router.post("/telegram", response_model=TokenResponse)
async def telegram_login(data: TelegramAuthData, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate via Telegram Login Widget.

    Verifies the HMAC hash, checks that auth_date is fresh,
    confirms group membership, then upserts the user and returns a JWT.

    Raises:
        HTTPException 401: If the Telegram hash is invalid or auth_date is stale.
        HTTPException 403: If the user is not a member of the required group.
    """
    if not verify_telegram_hash(data):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram hash")

    if time.time() - data.auth_date > MAX_AUTH_AGE_SECONDS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication data is stale")

    is_member = await check_group_membership(data.id)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of the required group")

    name = data.first_name
    if data.last_name:
        name = f"{data.first_name} {data.last_name}"

    result = await db.execute(select(User).where(User.telegram_id == data.id))
    user = result.scalar_one_or_none()

    if user:
        user.name = name
        user.username = data.username
    else:
        user = User(telegram_id=data.id, name=name, username=data.username)
        db.add(user)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/qr", response_model=QRSessionOut)
async def create_qr_session(db: AsyncSession = Depends(get_db)) -> QRSessionOut:
    """Create a new QR login session. Returns a token to embed in a deep link."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    session = QRSession(token=token, expires_at=expires_at)
    db.add(session)
    await db.commit()
    return QRSessionOut(token=token, bot_name=settings.TELEGRAM_BOT_NAME)


@router.get("/qr/{token}", response_model=QRStatusOut)
async def poll_qr_session(token: str, db: AsyncSession = Depends(get_db)) -> QRStatusOut:
    """Poll QR session status. Returns JWT when user has authenticated via bot."""
    result = await db.execute(select(QRSession).where(QRSession.token == token))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = datetime.now(timezone.utc)
    if session.status == QRStatus.pending and session.expires_at.replace(tzinfo=timezone.utc) < now:
        session.status = QRStatus.expired
        await db.commit()
        return QRStatusOut(status="expired")

    if session.status == QRStatus.authenticated and session.user_id:
        access_token = create_access_token(session.user_id)
        return QRStatusOut(status="authenticated", access_token=access_token)

    return QRStatusOut(status=session.status.value)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the currently authenticated user's profile."""
    return current_user


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserOut]:
    """Return all registered users (for guest autocomplete)."""
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()
