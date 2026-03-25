from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(default="", description="Search by name or @username"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserResponse]:
    if not q.strip():
        result = await db.execute(
            select(User).where(User.id != current_user.id).order_by(User.first_name).limit(50)
        )
    else:
        term = f"%{q.strip().lstrip('@')}%"
        result = await db.execute(
            select(User).where(
                or_(
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.username.ilike(term),
                )
            ).order_by(User.first_name).limit(20)
        )
    return result.scalars().all()
