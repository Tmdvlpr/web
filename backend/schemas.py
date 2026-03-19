from datetime import date, datetime

from pydantic import BaseModel


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    telegram_id: int
    name: str
    username: str | None
    role: str

    class Config:
        from_attributes = True


class QRSessionOut(BaseModel):
    token: str
    bot_name: str


class QRStatusOut(BaseModel):
    status: str
    access_token: str | None = None
    token_type: str = "bearer"


class BookingCreate(BaseModel):
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    guests: list[str] = []
    recurrence: str = "none"          # none | daily | weekly | custom
    recurrence_until: date | None = None
    recurrence_days: list[int] = []   # 0=Mon..6=Sun (used when recurrence="custom")


class BookingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    guests: list[str] | None = None


class BookingOut(BaseModel):
    id: int
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    user_id: int
    user: UserOut
    created_at: datetime
    guests: list[str] = []
    recurrence: str = "none"
    recurrence_until: date | None = None
    recurrence_group_id: int | None = None
    recurrence_days: list[int] = []

    class Config:
        from_attributes = True
