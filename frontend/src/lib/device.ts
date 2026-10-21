/**
 * Anonymous device ID, stored in localStorage and sent with every API call.
 * The backend only returns expenses created with the same ID, so each
 * browser sees just its own data without needing a login.
 */

const KEY = "expense_device_id";

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
