import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.booking import Booking
from app.models.user import Role, User
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
    order = func.coalesce(User.first_name, User.name, User.username)
    if not q.strip():
        result = await db.execute(
            select(User).where(User.id != current_user.id).order_by(order).limit(50)
        )
    else:
        term = f"%{q.strip().lstrip('@')}%"
        result = await db.execute(
            select(User).where(
                or_(
                    User.name.ilike(term),
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.username.ilike(term),
                )
            ).order_by(order).limit(20)
        )
    return result.scalars().all()


@router.post("/feed-token", response_model=dict)
async def get_feed_token(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not current_user.feed_token:
        current_user.feed_token = secrets.token_urlsafe(32)
        await db.commit()
        await db.refresh(current_user)
    return {"feed_token": current_user.feed_token}


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/users", response_model=list[UserResponse])
async def admin_list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserResponse]:
    if current_user.role != Role.admin:
        raise HTTPException(403, "Admin only")
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/admin/users/{user_id}/role")
async def admin_set_role(
    user_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role != Role.admin:
        raise HTTPException(403, "Admin only")
    new_role = body.get("role")
    if new_role not in ("user", "admin"):
        raise HTTPException(400, "role must be 'user' or 'admin'")
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.id == current_user.id:
        raise HTTPException(400, "Cannot change your own role")
    target.role = Role(new_role)
    await db.commit()
    return {"id": target.id, "role": new_role}


class AdminCreateUser(BaseModel):
    name: str
    username: str | None = None
    role: str = "user"


@router.post("/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    body: AdminCreateUser,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    if current_user.role != Role.admin:
        raise HTTPException(403, "Admin only")
    if body.role not in ("user", "admin"):
        raise HTTPException(400, "role must be 'user' or 'admin'")
    user = User(
        telegram_id=0,
        name=body.name,
        first_name=body.name.split()[0] if body.name else None,
        last_name=body.name.split()[1] if body.name and len(body.name.split()) > 1 else None,
        username=body.username,
        role=Role(body.role),
        is_active=True,
        is_registered=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if current_user.role != Role.admin:
        raise HTTPException(403, "Admin only")
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.id == current_user.id:
        raise HTTPException(400, "Cannot delete yourself")
    # Soft-delete all user bookings
    now_utc = datetime.now(timezone.utc)
    bookings_result = await db.execute(
        select(Booking).where(Booking.user_id == user_id, Booking.deleted_at.is_(None))
    )
    for b in bookings_result.scalars().all():
        b.deleted_at = now_utc
    await db.delete(target)
    await db.commit()


@router.get("/admin/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role != Role.admin:
        raise HTTPException(403, "Admin only")
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar_one()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    active_bookings = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.start_time <= now, Booking.end_time >= now
        )
    )).scalar_one()
    return {
        "total_users": total_users,
        "total_bookings": total_bookings,
        "active_bookings": active_bookings,
    }
