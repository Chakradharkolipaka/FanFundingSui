import type { ZkLoginSession } from "./types";

const STORAGE_KEY = "fanfunding:zklogin-session:v1";
const EVENT_NAME = "fanfunding:zklogin-session-changed";

function emitChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function loadZkLoginSession(): ZkLoginSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ZkLoginSession;
    if (!parsed?.jwt || !parsed?.address) return null;

    // Expire session if JWT exp is in the past (with small skew).
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.jwtExp && parsed.jwtExp < nowSec + 10) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveZkLoginSession(session: ZkLoginSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  emitChanged();
}

export function clearZkLoginSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitChanged();
}

export function subscribeZkLoginSessionChanged(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
