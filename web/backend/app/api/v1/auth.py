from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import BrowserSessionResponse, LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.auth_service import (
    consume_browser_session,
    create_browser_session,
    login_user,
    register_user,
    settings,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_EXPIRE_IN = settings.JWT_EXPIRE_DAYS * 86400


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Register a new Mini App user (first time only)."""
    if not request.first_name.strip() or not request.last_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="first_name and last_name are required")

    token = await register_user(request.initData, request.first_name.strip(), request.last_name.strip(), db)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid initData or user already registered",
        )
    return TokenResponse(access_token=token, expires_in=_EXPIRE_IN)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Login existing Mini App user via initData."""
    token = await login_user(request.initData, db)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered",
        )
    return TokenResponse(access_token=token, expires_in=_EXPIRE_IN)


@router.post("/browser/session", response_model=BrowserSessionResponse)
async def create_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrowserSessionResponse:
    """Create a one-time browser session token for opening the web app from Mini App."""
    session_token = await create_browser_session(current_user.id, db)
    browser_url = f"{settings.FRONTEND_URL}/auth/session/{session_token}"
    return BrowserSessionResponse(session_token=session_token, browser_url=browser_url)


@router.post("/qr-session")
async def create_qr_session(db: AsyncSession = Depends(get_db)) -> dict:
    """Create a QR session (no auth). Returns token + bot deep-link for scanning."""
    import secrets
    from datetime import datetime, timedelta, timezone
    from app.models.browser_session import BrowserSession

    token = secrets.token_urlsafe(32)
    session = BrowserSession(
        token=token,
        user_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(session)
    await db.commit()

    bot_url = f"https://t.me/{settings.TG_BOT_USERNAME}?start={token}" if settings.TG_BOT_USERNAME else None
    return {"token": token, "bot_url": bot_url, "expires_in": 300}


@router.get("/session/{session_token}")
async def consume_session(session_token: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Check/consume a session token. Returns JWT if ready, 202 if pending."""
    from sqlalchemy import select
    from app.models.browser_session import BrowserSession

    result = await db.execute(select(BrowserSession).where(BrowserSession.token == session_token))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from datetime import datetime, timezone
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session expired")

    # QR session: user_id might not be set yet (bot hasn't consumed)
    if not session.user_id:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=202, content={"status": "pending"})

    # Session has user — consume and return JWT
    if not session.used:
        session.used = True
        session.used_at = datetime.now(timezone.utc)
        await db.commit()

    from app.services.auth_service import create_access_token
    token = create_access_token(session.user_id)
    return {"access_token": token, "expires_in": _EXPIRE_IN}


@router.post("/web-register")
async def web_register(body: dict, db: AsyncSession = Depends(get_db)) -> dict:
    """Register directly from web (no Telegram required). Creates user + returns JWT."""
    from sqlalchemy import select
    from app.models.user import User
    from app.services.auth_service import create_access_token

    first_name = (body.get("first_name") or "").strip()
    last_name = (body.get("last_name") or "").strip()
    if not first_name:
        raise HTTPException(400, "first_name is required")

    display = f"{first_name} {last_name}".strip()
    user = User(
        telegram_id=0,
        name=display,
        first_name=first_name,
        last_name=last_name or None,
        is_registered=True,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return {"access_token": token, "expires_in": settings.JWT_EXPIRE_DAYS * 86400, "user_id": user.id}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Dev-only: instant login as a test user (no Telegram required)."""
    from sqlalchemy import select as _select
    DEV_TG_ID = 999_000_001
    result = await db.execute(_select(User).where(User.telegram_id == DEV_TG_ID))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            telegram_id=DEV_TG_ID,
            first_name="Dev",
            last_name="User",
            name="Dev User",
            username="devuser",
            role="admin",
            is_registered=True,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    from app.services.auth_service import create_access_token
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=_EXPIRE_IN)
