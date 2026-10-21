from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .models import Expense
from .schemas import ExpenseCreate, ExpenseResponse, ExpenseUpdate


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist on startup. In a production service this would be
    # Alembic migrations; create_all is fine for this scope.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Expense Tracker API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your domain in production
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_device_id(x_device_id: Optional[str] = Header(None)) -> str:
    """Anonymous per-browser ID sent by the frontend; scopes every query."""
    device_id = (x_device_id or "").strip()
    if not device_id or len(device_id) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Device-Id header is required",
        )
    return device_id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(expense: Expense) -> ExpenseResponse:
    """Convert ORM row → API response, converting paise → rupees."""
    return ExpenseResponse(
        id=expense.id,
        amount=float(Decimal(expense.amount_paise) / Decimal(100)),
        category=expense.category,
        description=expense.description,
        date=expense.date,
        created_at=expense.created_at,
    )


def _get_expense_or_404(expense_id: str, device_id: str, db: Session) -> Expense:
    # Another device's expense is reported as not found, so IDs can't be probed.
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.device_id == device_id)
        .first()
    )
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense '{expense_id}' not found",
        )
    return expense


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post(
    "/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new expense (idempotent)",
)
def create_expense(
    body: ExpenseCreate,
    device_id: str = Depends(get_device_id),
    db: Session = Depends(get_db),
):
    """
    Create a new expense.

    **Idempotency**: the client must supply a unique `idempotency_key` (UUID).
    If the server has already processed a request with that key it returns the
    existing record unchanged — making it safe to retry on network failures or
    after a browser refresh without creating duplicates.
    """
    def find_existing():
        return (
            db.query(Expense)
            .filter(
                Expense.device_id == device_id,
                Expense.idempotency_key == body.idempotency_key,
            )
            .first()
        )

    existing = find_existing()
    if existing:
        return _to_response(existing)

    expense = Expense(
        device_id=device_id,
        idempotency_key=body.idempotency_key,
        amount_paise=int(body.amount * 100),
        category=body.category,
        description=body.description,
        date=body.date,
    )
    db.add(expense)
    try:
        db.commit()
        db.refresh(expense)
    except IntegrityError:
        # Two concurrent requests raced on the same idempotency_key.
        db.rollback()
        existing = find_existing()
        if existing:
            return _to_response(existing)
        raise HTTPException(status_code=500, detail="Unexpected integrity error")

    return _to_response(expense)


@app.get(
    "/expenses",
    response_model=list[ExpenseResponse],
    summary="List expenses with optional filtering and sorting",
)
def list_expenses(
    category: Optional[str] = Query(None, description="Filter by exact category name"),
    sort: Optional[str] = Query(None, description="Use 'date_desc' to sort newest first"),
    device_id: str = Depends(get_device_id),
    db: Session = Depends(get_db),
):
    query = db.query(Expense).filter(Expense.device_id == device_id)

    if category:
        query = query.filter(Expense.category == category)

    if sort == "date_desc":
        # Secondary sort by created_at breaks ties within the same calendar day.
        query = query.order_by(Expense.date.desc(), Expense.created_at.desc())

    return [_to_response(e) for e in query.all()]


@app.get(
    "/expenses/categories",
    response_model=list[str],
    summary="Return all distinct category names",
)
def list_categories(
    device_id: str = Depends(get_device_id),
    db: Session = Depends(get_db),
):
    """Used by the frontend to populate the filter and edit dropdowns."""
    rows = (
        db.query(Expense.category)
        .filter(Expense.device_id == device_id)
        .distinct()
        .order_by(Expense.category)
        .all()
    )
    return [r[0] for r in rows]


@app.put(
    "/expenses/{expense_id}",
    response_model=ExpenseResponse,
    summary="Update an existing expense (full replacement of mutable fields)",
)
def update_expense(
    expense_id: str,
    body: ExpenseUpdate,
    device_id: str = Depends(get_device_id),
    db: Session = Depends(get_db),
):
    """
    Replace all mutable fields of an expense.

    PUT is naturally idempotent — sending the same request twice produces the
    same result, so no idempotency key is required for edit operations.
    """
    expense = _get_expense_or_404(expense_id, device_id, db)
    expense.amount_paise = int(body.amount * 100)
    expense.category = body.category
    expense.description = body.description
    expense.date = body.date
    db.commit()
    db.refresh(expense)
    return _to_response(expense)


@app.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expense",
)
def delete_expense(
    expense_id: str,
    device_id: str = Depends(get_device_id),
    db: Session = Depends(get_db),
):
    expense = _get_expense_or_404(expense_id, device_id, db)
    db.delete(expense)
    db.commit()
