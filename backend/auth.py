import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User
from schemas import TelegramAuthData

bearer_scheme = HTTPBearer()


def verify_telegram_hash(data: TelegramAuthData) -> bool:
    """Verify HMAC-SHA256 signature from Telegram Login Widget."""
    bot_token_hash = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()

    fields = {
        "id": str(data.id),
        "first_name": data.first_name,
        "auth_date": str(data.auth_date),
    }
    if data.last_name:
        fields["last_name"] = data.last_name
    if data.username:
        fields["username"] = data.username
    if data.photo_url:
        fields["photo_url"] = data.photo_url

    check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    expected_hash = hmac.new(bot_token_hash, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_hash, data.hash)


async def check_group_membership(telegram_id: int) -> bool:
    """Call getChatMember to verify user is in the required group.

    Tries the configured TELEGRAM_GROUP_ID as-is, then with -100 prefix
    (needed for supergroups when only the bare ID is provided).
    """
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getChatMember"
    raw_id = settings.TELEGRAM_GROUP_ID.lstrip("-")
    candidates = [settings.TELEGRAM_GROUP_ID, f"-100{raw_id}", f"-{raw_id}"]

    async with httpx.AsyncClient() as client:
        for chat_id in candidates:
            try:
                resp = await client.get(url, params={"chat_id": chat_id, "user_id": telegram_id}, timeout=10)
                data = resp.json()
                logger.info("getChatMember chat_id=%s user_id=%s → %s", chat_id, telegram_id, data)
                if data.get("ok"):
                    allowed = {"member", "administrator", "creator"}
                    return data["result"]["status"] in allowed
            except Exception as e:
                logger.warning("getChatMember error for chat_id=%s: %s", chat_id, e)
    return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
