# Expense Tracker

A minimal full-stack personal expense tracker built with FastAPI (Python) and plain HTML/CSS/JS.

## Quick start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

### Frontend

Open `frontend/index.html` directly in a browser, or serve it with any static file server:

```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

The frontend expects the backend at `http://localhost:8000`. Change `API_BASE` at the top of `app.js` if needed.

### Tests

```bash
cd backend
pytest tests/ -v
```

---

## Key design decisions

### 1. Money stored as integer paise

Monetary amounts are stored as `INTEGER` paise (hundredths of a rupee) in SQLite, not as `REAL` or `DECIMAL`.

**Why this matters:** `REAL` (IEEE 754 double) cannot represent most decimal fractions exactly. `0.1 + 0.2 ≠ 0.3` in floating point. Summing many floating-point amounts drifts silently. By storing `amount_paise INT` and converting at the API boundary (`₹103.45 → 10345`), all arithmetic in the database is exact integer arithmetic.

The API returns amounts as JSON numbers (floats), which is conventional. The frontend re-converts to paise (`Math.round(amount * 100)`) before summing, preventing any accumulation error in totals.

### 2. Idempotent POST via client-supplied idempotency key

The spec requires: *"The API should behave correctly even if the client retries the same request due to network issues or page reloads."*

**Approach:** The client generates a UUID (`crypto.randomUUID()`) before the first POST attempt and stores it in `sessionStorage`. If the request fails or the page is reloaded before a response arrives, the same UUID is still in `sessionStorage`. The retry carries the same key, and the server returns the existing record instead of inserting a duplicate.

**Server-side:** `idempotency_key` has a `UNIQUE` constraint. The happy path checks for an existing row before inserting. An `IntegrityError` catch handles the rare concurrent-request race without exposing an error to the caller.

**Key rotation:** On successful submission the frontend rotates to a fresh UUID, so the next expense gets its own idempotency context.

### 3. Persistence: SQLite

SQLite is a file-based relational database with zero configuration. For a personal, single-user finance tool it is a good default: data survives restarts, queries are SQL, and there is no separate server process to manage. The SQLAlchemy ORM layer means switching to Postgres is a one-line change (the `DATABASE_URL`).

### 4. Frontend: plain HTML + CSS + JS (no framework)

A framework would add a build step and significant complexity for what is ultimately a single-page form + table. Vanilla JS with `fetch` and `sessionStorage` handles every acceptance criterion with less code and no dependencies.

### 5. Input validation at two layers

- **Backend (Pydantic):** amount > 0, at most 2 decimal places, non-empty category, valid date. This is the authoritative layer.
- **Frontend:** mirrors the same rules for immediate user feedback before a round-trip. The frontend never assumes the server will accept its data.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/expenses` | Create an expense (idempotent) |
| `GET`  | `/expenses` | List expenses (`?category=X`, `?sort=date_desc`) |
| `GET`  | `/expenses/categories` | All distinct category names (for the filter dropdown) |

Full interactive docs: `http://localhost:8000/docs`

---

## Trade-offs made for the timebox

- **No authentication.** A personal tool for a single user. Adding auth (OAuth2 / session cookies) would be the first extension if this became multi-user.
- **No database migrations (Alembic).** `Base.metadata.create_all` is used on startup. Schema changes would require manual migration or a reset.
- **No pagination.** Acceptable for personal finance volumes (hundreds–thousands of rows). A real production service would add cursor-based pagination.
- **CORS allows all origins.** Fine for local development; a deployed version would pin `allow_origins` to the frontend domain.

## Intentionally not done

- User authentication / multi-tenancy
- Expense editing or deletion
- Recurring expenses
- Currency support beyond INR
- Real-time updates (WebSocket / SSE)
- Containerisation (Docker) — the setup is simple enough without it
