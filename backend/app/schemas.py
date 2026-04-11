from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Shared base — amount / category / description / date validation lives here
# so ExpenseCreate and ExpenseUpdate don't duplicate it.
# ---------------------------------------------------------------------------

class _ExpenseBase(BaseModel):
    amount: Decimal
    category: str
    description: str = ""
    date: date

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: object) -> Decimal:
        """Accept both JSON numbers and strings; convert via str() to avoid float
        precision contamination (e.g. Decimal(103.45) ≠ Decimal('103.45'))."""
        try:
            return Decimal(str(v))
        except InvalidOperation:
            raise ValueError("Invalid amount format")

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be greater than zero")
        # Normalise strips trailing zeros so 103.450 → 103.45 before the check.
        _, _, exponent = v.normalize().as_tuple()
        if exponent < -2:
            raise ValueError("amount must have at most 2 decimal places")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("category is required")
        return v

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        return v.strip()


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class ExpenseCreate(_ExpenseBase):
    # Client-generated UUID. The server uses this to deduplicate retried
    # requests (network failures, page reloads).
    idempotency_key: str

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("idempotency_key is required")
        return v


class ExpenseUpdate(_ExpenseBase):
    """PUT /expenses/{id} — full replacement of mutable fields.

    Edit operations are naturally idempotent (same PUT → same result),
    so no idempotency key is needed here.
    """
    pass


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class ExpenseResponse(BaseModel):
    id: str
    # Returned as a float so JSON consumers receive a plain number (e.g. 103.45).
    # Precision is safe for personal-finance amounts: all paise values up to
    # ₹90 trillion round-trip through float64 without error.
    amount: float
    category: str
    description: str
    date: date
    created_at: datetime
