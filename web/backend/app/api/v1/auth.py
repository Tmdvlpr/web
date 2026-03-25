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


@router.get("/session/{session_token}", response_model=TokenResponse)
async def consume_session(session_token: str, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Exchange a one-time session token for a JWT (browser auth)."""
    token = await consume_browser_session(session_token, db)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session token")
    return TokenResponse(access_token=token, expires_in=_EXPIRE_IN)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user
