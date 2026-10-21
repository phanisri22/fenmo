# Expense Tracker

A minimal full-stack personal expense tracker built with FastAPI (Python) for the backend and Next.js, React, and TypeScript for the frontend.

## Features

- Create a new expense with amount, category, description, and date
- View a list of expenses
- Filter expenses by category
- Sort expenses by date, newest first
- See the total of the currently visible expenses
- Edit existing expenses
- Delete expenses
- View a lightweight summary by category
- Get loading and error states in the UI
- Safely retry expense creation without duplicate records
- Private per-device history with no login required

## Quick start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URLs:

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- App: `http://localhost:3000`

### Frontend environment

Create `frontend/.env.local` with:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Tests

```bash
cd backend
pytest tests/ -v
```

---

## Key design decisions

### 1. Money stored as integer paise

Monetary amounts are stored as integer paise in SQLite, not floating-point values.

Why this matters: money calculations should not drift due to binary floating-point representation. By storing `amount_paise` as an integer, the backend keeps arithmetic exact and only converts to rupees at the API boundary.

### 2. Idempotent POST for duplicate clicks, retries, and refreshes

The assignment explicitly calls out unreliable networks, retries, and browser refreshes. To handle that safely, the frontend generates an `idempotency_key` and stores it in `sessionStorage` until the create request succeeds.

The backend stores that key with a unique constraint and returns the same record if the request is retried. This prevents duplicate expense creation when users click submit multiple times or retry after a failed response.

### 3. SQLite for simple durable persistence

SQLite was chosen because it is lightweight, requires no separate server, and is easy to inspect during development. It is a good fit for a small personal finance tool and keeps the project simple within the timebox.

### 4. Next.js frontend for maintainable UI state

The frontend uses Next.js with React and TypeScript to keep the UI structured and maintainable. React Query handles API fetching, caching, refetching, optimistic deletion updates, loading states, and error handling in a clean way.

### 5. Validation at both backend and frontend layers

- Backend validation is the source of truth and rejects invalid amounts, blank categories, and missing dates
- Frontend validation mirrors those rules for immediate feedback

### 6. Per-device privacy without login

On first visit the frontend generates a random device ID, stores it in `localStorage`, and sends it as an `X-Device-Id` header on every request. The backend stores it with each expense and filters every query by it, so a browser only sees and can only change its own expenses. Requests without the header are rejected with `400`.

Trade-off: clearing browser data or switching browser/device starts a fresh, empty history.

### 7. Render for backend and Vercel for frontend

For deployment, the backend is hosted on Render and the frontend is hosted on Vercel.

- Render is a straightforward fit for FastAPI services and gives a simple deployment flow for Python APIs
- Vercel is the most natural hosting platform for Next.js apps and makes frontend deployment very fast
- Keeping backend and frontend separately deployed mirrors a realistic production setup and simplifies environment configuration

One deployment caveat is that SQLite on many free hosting environments may not be truly persistent across restarts unless persistent storage is configured. For a production-grade multi-user version, I would move persistence to Postgres.

---

## API reference

All endpoints require an `X-Device-Id` header.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/expenses` | Create a new expense (idempotent) |
| `GET`  | `/expenses` | List expenses with optional `category` and `sort=date_desc` |
| `GET`  | `/expenses/categories` | Return distinct category names |
| `PUT`  | `/expenses/{expense_id}` | Update an existing expense |
| `DELETE` | `/expenses/{expense_id}` | Delete an expense |

Interactive docs are available locally at `http://localhost:8000/docs`.

---

## Trade-offs made for the timebox

- No authentication; privacy is per device via an anonymous device ID
- No database migrations such as Alembic
- No pagination
- CORS is open for simplicity during development
- SQLite is used instead of a hosted production database

These trade-offs kept the project focused on correctness, money handling, retry safety, and overall production-readiness of the core expense workflow.

## Intentionally not done

- User accounts / syncing history across devices
- Recurring expenses
- Multi-currency support beyond INR
- Real-time sync
- Docker/container setup
- Postgres migration for hosted durability

## Deployment summary

- GitHub Repository: `https://github.com/phanisri22/fenmo`
- Frontend: deploy `frontend` on Vercel
- Backend: deploy `backend` on Render
- Frontend environment variable:

```bash
NEXT_PUBLIC_API_URL=<your-render-backend-url>
```

## What to verify after deployment

- Expense creation works
- Duplicate submit does not create duplicate expenses
- Refresh after submit does not duplicate records
- Expense list loads correctly
- Filter and sort work
- Total updates for the visible list
- Edit and delete work
- Loading and error states are visible during failed or slow requests
