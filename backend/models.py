import enum
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class QRStatus(str, enum.Enum):
    pending = "pending"
    authenticated = "authenticated"
    expired = "expired"


class Role(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.user, server_default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    qr_sessions: Mapped[list["QRSession"]] = relationship("QRSession", back_populates="user")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    guests: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    recurrence: Mapped[str] = mapped_column(String(10), nullable=False, default="none", server_default="none")
    recurrence_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurrence_group_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    recurrence_days: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")

    user: Mapped["User"] = relationship("User", back_populates="bookings")


class QRSession(Base):
    __tablename__ = "qr_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[QRStatus] = mapped_column(Enum(QRStatus), default=QRStatus.pending, server_default="pending")
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User | None"] = relationship("User", back_populates="qr_sessions")
