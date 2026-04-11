/**
 * Idempotency key management.
 *
 * A UUID is generated once per "pending form session" and stored in
 * sessionStorage so it survives page reloads.
 *
 *  - On first call:   generates a UUID, stores it, returns it.
 *  - On page reload:  reads the same UUID from sessionStorage → safe retry.
 *  - After success:   rotateIdempotencyKey() stores a fresh UUID so the
 *                     next expense gets its own idempotency context.
 */

const KEY = "expense_pending_key";

export function getIdempotencyKey(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  let key = sessionStorage.getItem(KEY);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(KEY, key);
  }
  return key;
}

export function rotateIdempotencyKey(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, crypto.randomUUID());
}
