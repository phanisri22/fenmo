import type { CreateExpenseInput, Expense } from "@/types/expense";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
    );
  }
  // 204 No Content (e.g. DELETE) — body is empty, skip JSON parse
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface GetExpensesParams {
  category?: string;
  sort?: "date_desc";
}

export interface UpdateExpenseInput {
  amount: string;   // decimal string
  category: string;
  description: string;
  date: string;
}

export const api = {
  getExpenses(params: GetExpensesParams = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.sort)     qs.set("sort", params.sort);
    return fetchJSON<Expense[]>(`/expenses?${qs}`);
  },

  getCategories() {
    return fetchJSON<string[]>("/expenses/categories");
  },

  createExpense(payload: CreateExpenseInput) {
    return fetchJSON<Expense>("/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateExpense(id: string, payload: UpdateExpenseInput) {
    return fetchJSON<Expense>(`/expenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  deleteExpense(id: string) {
    return fetchJSON<void>(`/expenses/${id}`, { method: "DELETE" });
  },
};
