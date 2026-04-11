export interface Expense {
  id: string;
  amount: number;       // rupees, e.g. 103.45
  category: string;
  description: string;
  date: string;         // YYYY-MM-DD
  created_at: string;   // ISO datetime
}

export interface CreateExpenseInput {
  idempotency_key: string;
  amount: string;       // decimal string, e.g. "103.45"
  category: string;
  description: string;
  date: string;
}
