import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # Client-supplied UUID that makes POST idempotent across retries / page reloads.
    idempotency_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    # Stored in paise (1/100 of a rupee) as an integer to avoid all floating-point
    # representation issues. ₹103.45 → 10345.
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
