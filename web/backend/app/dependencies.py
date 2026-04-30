import json
from datetime import datetime, timezone

import pyseto
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pyseto import Key
from pyseto.exceptions import DecryptError, PysetoError, VerifyError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()

try:
    _PUBLIC_KEY = Key.new(
        version=4,
        purpose="public",
        key=settings.PASETO_PUBLIC_KEY_PEM.encode("utf-8"),
    )
except Exception as e:
    raise RuntimeError(
        f"PASETO_PUBLIC_KEY_PEM is missing or invalid — check .env. Underlying error: {e}"
    ) from e


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        decoded = pyseto.decode(_PUBLIC_KEY, token)
        payload = json.loads(decoded.payload)
        user_id = int(payload["sub"])
        exp_str = payload["exp"]
        # Accept "...Z" or "...+00:00"
        exp = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except HTTPException:
        raise
    except (VerifyError, DecryptError, PysetoError, ValueError, KeyError, json.JSONDecodeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account deactivated")
    return user
