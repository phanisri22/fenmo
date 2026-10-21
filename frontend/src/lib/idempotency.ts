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
 *
 * If sessionStorage is blocked (some in-app browsers), the key is kept in
 * memory instead, which still protects against double clicks.
 */

const KEY = "expense_pending_key";

let memoryKey: string | null = null;

export function getIdempotencyKey(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    let key = sessionStorage.getItem(KEY);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(KEY, key);
    }
    return key;
  } catch {
    memoryKey ??= crypto.randomUUID();
    return memoryKey;
  }
}

export function rotateIdempotencyKey(): void {
  if (typeof window === "undefined") return;
  memoryKey = crypto.randomUUID();
  try {
    sessionStorage.setItem(KEY, memoryKey);
  } catch {
    // Storage blocked; the in-memory key is enough.
  }
}
