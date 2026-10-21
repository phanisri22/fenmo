"""
Integration tests for the Expense Tracker API.

Each test gets a fresh in-memory SQLite database so tests are fully isolated.
The production DB (expense_tracker.db) is never touched during the test run.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.main import app, get_db

# ---------------------------------------------------------------------------
# Test database setup
#
# StaticPool is required for SQLite :memory: tests: without it every
# SQLAlchemy checkout gets a *different* connection (and therefore a different
# database), so tables created by the fixture are invisible to the session
# that handles the request.  StaticPool pins every checkout to one shared
# connection, giving everyone the same in-memory database.
# ---------------------------------------------------------------------------

_test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(bind=_test_engine, autoflush=False, autocommit=False)


def _override_get_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def _fresh_db():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture
def client():
    return TestClient(app, headers={"X-Device-Id": "device-a"})


@pytest.fixture
def other_client():
    return TestClient(app, headers={"X-Device-Id": "device-b"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _expense(**overrides):
    """Return a valid expense payload with sensible defaults."""
    payload = {
        "idempotency_key": str(uuid.uuid4()),
        "amount": "150.50",
        "category": "Food",
        "description": "Lunch",
        "date": "2024-01-15",
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# POST /expenses
# ---------------------------------------------------------------------------

class TestCreateExpense:
    def test_creates_expense_and_returns_201(self, client):
        r = client.post("/expenses", json=_expense())
        assert r.status_code == 201
        body = r.json()
        assert body["amount"] == 150.50
        assert body["category"] == "Food"
        assert body["description"] == "Lunch"
        assert body["date"] == "2024-01-15"
        assert "id" in body
        assert "created_at" in body

    def test_idempotency_same_key_returns_same_record(self, client):
        key = str(uuid.uuid4())
        r1 = client.post("/expenses", json=_expense(idempotency_key=key))
        r2 = client.post("/expenses", json=_expense(idempotency_key=key))

        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["id"] == r2.json()["id"], (
            "Retried request must return the same record, not create a duplicate"
        )

    def test_idempotency_only_one_record_in_db(self, client):
        key = str(uuid.uuid4())
        payload = _expense(idempotency_key=key)
        client.post("/expenses", json=payload)
        client.post("/expenses", json=payload)

        all_expenses = client.get("/expenses").json()
        assert len(all_expenses) == 1

    def test_different_keys_create_separate_records(self, client):
        client.post("/expenses", json=_expense(idempotency_key=str(uuid.uuid4())))
        client.post("/expenses", json=_expense(idempotency_key=str(uuid.uuid4())))

        assert len(client.get("/expenses").json()) == 2

    # -- Validation --

    def test_negative_amount_rejected(self, client):
        r = client.post("/expenses", json=_expense(amount="-10"))
        assert r.status_code == 422

    def test_zero_amount_rejected(self, client):
        r = client.post("/expenses", json=_expense(amount="0"))
        assert r.status_code == 422

    def test_more_than_two_decimal_places_rejected(self, client):
        r = client.post("/expenses", json=_expense(amount="10.999"))
        assert r.status_code == 422

    def test_two_decimal_places_accepted(self, client):
        r = client.post("/expenses", json=_expense(amount="10.99"))
        assert r.status_code == 201
        assert r.json()["amount"] == 10.99

    def test_blank_category_rejected(self, client):
        r = client.post("/expenses", json=_expense(category=""))
        assert r.status_code == 422

    def test_missing_date_rejected(self, client):
        payload = _expense()
        del payload["date"]
        r = client.post("/expenses", json=payload)
        assert r.status_code == 422

    def test_description_is_optional(self, client):
        payload = _expense()
        del payload["description"]
        r = client.post("/expenses", json=payload)
        assert r.status_code == 201
        assert r.json()["description"] == ""

    # -- Money precision --

    def test_amount_stored_as_exact_paise(self, client):
        """Verify that amounts with 2 decimal places survive a round-trip without
        floating-point drift (e.g. 103.45 must not come back as 103.44999...)."""
        r = client.post("/expenses", json=_expense(amount="103.45"))
        assert r.status_code == 201
        # The response amount must round-trip as exactly 103.45.
        assert abs(r.json()["amount"] - 103.45) < 1e-9


# ---------------------------------------------------------------------------
# GET /expenses
# ---------------------------------------------------------------------------

class TestListExpenses:
    def _seed(self, client, expenses):
        for e in expenses:
            client.post("/expenses", json=e)

    def test_returns_empty_list_initially(self, client):
        r = client.get("/expenses")
        assert r.status_code == 200
        assert r.json() == []

    def test_filter_by_category(self, client):
        self._seed(client, [
            _expense(category="Food"),
            _expense(category="Transport"),
            _expense(category="Food"),
        ])
        r = client.get("/expenses?category=Food")
        assert r.status_code == 200
        results = r.json()
        assert len(results) == 2
        assert all(e["category"] == "Food" for e in results)

    def test_filter_unknown_category_returns_empty(self, client):
        self._seed(client, [_expense(category="Food")])
        r = client.get("/expenses?category=Nonexistent")
        assert r.json() == []

    def test_sort_date_desc(self, client):
        self._seed(client, [
            _expense(date="2024-01-01"),
            _expense(date="2024-03-15"),
            _expense(date="2024-02-20"),
        ])
        r = client.get("/expenses?sort=date_desc")
        dates = [e["date"] for e in r.json()]
        assert dates == ["2024-03-15", "2024-02-20", "2024-01-01"]

    def test_filter_and_sort_combined(self, client):
        self._seed(client, [
            _expense(category="Food", date="2024-03-01"),
            _expense(category="Travel", date="2024-04-10"),
            _expense(category="Food", date="2024-01-05"),
        ])
        r = client.get("/expenses?category=Food&sort=date_desc")
        results = r.json()
        assert len(results) == 2
        assert results[0]["date"] == "2024-03-01"
        assert results[1]["date"] == "2024-01-05"


# ---------------------------------------------------------------------------
# GET /expenses/categories
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# PUT /expenses/{id}
# ---------------------------------------------------------------------------

class TestUpdateExpense:
    def _create(self, client, **overrides):
        r = client.post("/expenses", json=_expense(**overrides))
        assert r.status_code == 201
        return r.json()

    def test_update_all_fields(self, client):
        created = self._create(client, amount="100", category="Food", date="2024-01-01")
        r = client.put(f"/expenses/{created['id']}", json={
            "amount": "250.50",
            "category": "Transport",
            "description": "Taxi home",
            "date": "2024-06-15",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == created["id"]        # same record
        assert body["amount"] == 250.50
        assert body["category"] == "Transport"
        assert body["description"] == "Taxi home"
        assert body["date"] == "2024-06-15"

    def test_update_preserves_id_and_created_at(self, client):
        created = self._create(client)
        r = client.put(f"/expenses/{created['id']}", json={
            "amount": "50", "category": "Food", "description": "", "date": "2024-02-01",
        })
        body = r.json()
        assert body["id"] == created["id"]
        assert body["created_at"] == created["created_at"]

    def test_update_nonexistent_returns_404(self, client):
        r = client.put("/expenses/does-not-exist", json={
            "amount": "100", "category": "Food", "description": "", "date": "2024-01-01",
        })
        assert r.status_code == 404

    def test_update_validates_negative_amount(self, client):
        created = self._create(client)
        r = client.put(f"/expenses/{created['id']}", json={
            "amount": "-10", "category": "Food", "description": "", "date": "2024-01-01",
        })
        assert r.status_code == 422

    def test_update_validates_blank_category(self, client):
        created = self._create(client)
        r = client.put(f"/expenses/{created['id']}", json={
            "amount": "100", "category": "  ", "description": "", "date": "2024-01-01",
        })
        assert r.status_code == 422

    def test_update_is_idempotent(self, client):
        """Sending the same PUT twice produces the same result."""
        created = self._create(client)
        payload = {"amount": "99", "category": "Food", "description": "", "date": "2024-03-01"}
        r1 = client.put(f"/expenses/{created['id']}", json=payload)
        r2 = client.put(f"/expenses/{created['id']}", json=payload)
        assert r1.json()["amount"] == r2.json()["amount"] == 99.0


# ---------------------------------------------------------------------------
# DELETE /expenses/{id}
# ---------------------------------------------------------------------------

class TestDeleteExpense:
    def _create(self, client, **overrides):
        r = client.post("/expenses", json=_expense(**overrides))
        assert r.status_code == 201
        return r.json()

    def test_delete_removes_expense(self, client):
        created = self._create(client)
        r = client.delete(f"/expenses/{created['id']}")
        assert r.status_code == 204

        remaining = client.get("/expenses").json()
        assert not any(e["id"] == created["id"] for e in remaining)

    def test_delete_returns_no_body(self, client):
        created = self._create(client)
        r = client.delete(f"/expenses/{created['id']}")
        assert r.status_code == 204
        assert r.content == b""

    def test_delete_nonexistent_returns_404(self, client):
        r = client.delete("/expenses/does-not-exist")
        assert r.status_code == 404

    def test_delete_does_not_affect_other_expenses(self, client):
        e1 = self._create(client, category="Food")
        e2 = self._create(client, category="Transport")
        client.delete(f"/expenses/{e1['id']}")
        remaining = client.get("/expenses").json()
        assert len(remaining) == 1
        assert remaining[0]["id"] == e2["id"]


class TestListCategories:
    def test_returns_distinct_sorted_categories(self, client):
        for cat in ["Transport", "Food", "Food", "Utilities"]:
            client.post("/expenses", json=_expense(category=cat))

        r = client.get("/expenses/categories")
        assert r.status_code == 200
        assert r.json() == ["Food", "Transport", "Utilities"]

    def test_empty_when_no_expenses(self, client):
        r = client.get("/expenses/categories")
        assert r.json() == []


class TestDeviceIsolation:
    def test_missing_device_header_rejected(self):
        r = TestClient(app).get("/expenses")
        assert r.status_code == 400

    def test_other_device_cannot_see_expenses(self, client, other_client):
        client.post("/expenses", json=_expense(category="Food"))
        assert other_client.get("/expenses").json() == []
        assert other_client.get("/expenses/categories").json() == []

    def test_other_device_cannot_edit_or_delete(self, client, other_client):
        created = client.post("/expenses", json=_expense()).json()
        payload = {"amount": "1", "category": "X", "description": "", "date": "2024-01-01"}
        assert other_client.put(f"/expenses/{created['id']}", json=payload).status_code == 404
        assert other_client.delete(f"/expenses/{created['id']}").status_code == 404
        assert client.get("/expenses").json()[0]["amount"] == 150.50

    def test_same_idempotency_key_on_two_devices_creates_two_records(self, client, other_client):
        key = str(uuid.uuid4())
        r1 = client.post("/expenses", json=_expense(idempotency_key=key))
        r2 = other_client.post("/expenses", json=_expense(idempotency_key=key))
        assert r1.status_code == r2.status_code == 201
        assert r1.json()["id"] != r2.json()["id"]
