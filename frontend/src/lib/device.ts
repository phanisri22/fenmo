/**
 * Anonymous device ID, sent with every API call.
 * The backend only returns expenses created with the same ID, so each
 * browser sees just its own data without needing a login.
 *
 * Some browsers (in-app webviews, blocked cookies) deny storage access and
 * throw, so we fall back: localStorage -> cookie -> in-memory for this tab.
 */

const KEY = "expense_device_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

let memoryId: string | null = null;
let persistent = true;

function fromLocalStorage(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function fromCookie(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`));
    if (match) return match[1];
    const id = crypto.randomUUID();
    document.cookie = `${KEY}=${id}; max-age=${ONE_YEAR}; path=/; SameSite=Lax`;
    // Re-read to confirm the browser actually kept it.
    return document.cookie.includes(`${KEY}=${id}`) ? id : null;
  } catch {
    return null;
  }
}

export function getDeviceId(): string {
  if (memoryId) return memoryId;
  const id = fromLocalStorage() ?? fromCookie();
  if (id) return id;
  persistent = false;
  memoryId = crypto.randomUUID();
  return memoryId;
}

/** False when no storage is available and expenses won't survive a reload. */
export function isDeviceIdPersistent(): boolean {
  getDeviceId();
  return persistent;
}
