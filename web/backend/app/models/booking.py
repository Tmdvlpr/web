from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    guests: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    recurrence: Mapped[str] = mapped_column(String(10), nullable=False, default="none", server_default="none")
    recurrence_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurrence_group_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    recurrence_days: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")

    user: Mapped["User"] = relationship("User", back_populates="bookings")  # noqa: F821
