from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse


class BookingCreate(BaseModel):
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    guests: list[str] = []
    recurrence: str = "none"
    recurrence_until: date | None = None
    recurrence_days: list[int] = []


class BookingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    guests: list[str] | None = None


class BookingResponse(BaseModel):
    id: int
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    user_id: int
    user: UserResponse
    created_at: datetime
    guests: list[str] = []
    recurrence: str = "none"
    recurrence_until: date | None = None
    recurrence_group_id: int | None = None
    recurrence_days: list[int] = []

    class Config:
        from_attributes = True
