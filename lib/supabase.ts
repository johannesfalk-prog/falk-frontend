import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const PERSIST_FLAG_KEY = "falk_keep_logged_in";
const EXPIRES_AT_KEY = "falk_session_expires_at";
const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // 2 dagar (48 timmar)

function clearExpiredOrAllAuthKeys() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PERSIST_FLAG_KEY);
    window.localStorage.removeItem(EXPIRES_AT_KEY);
    for (const store of [window.localStorage, window.sessionStorage]) {
      const keysToRemove = [];
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => store.removeItem(k));
    }
  } catch {}
}

function isPersistentSessionValid() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(PERSIST_FLAG_KEY) !== "1") return false;
    const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) || "0");
    if (!expiresAt || Date.now() > expiresAt) {
      clearExpiredOrAllAuthKeys();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setSessionPersistence(keepLoggedIn = false) {
  if (typeof window === "undefined") return;
  try {
    if (keepLoggedIn) {
      window.localStorage.setItem(PERSIST_FLAG_KEY, "1");
      window.localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + SESSION_TTL_MS));
    } else {
      window.localStorage.removeItem(PERSIST_FLAG_KEY);
      window.localStorage.removeItem(EXPIRES_AT_KEY);
    }
  } catch {}
}

const falkAuthStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      if (isPersistentSessionValid()) {
        return window.localStorage.getItem(key);
      }
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      if (isPersistentSessionValid()) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {}
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: falkAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function enforceSessionExpiry() {
  if (typeof window === "undefined") return false;
  try {
    const hasFlag = window.localStorage.getItem(PERSIST_FLAG_KEY) === "1";
    if (!hasFlag) return false;
    const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) || "0");
    if (!expiresAt || Date.now() > expiresAt) {
      clearExpiredOrAllAuthKeys();
      await supabase.auth.signOut({ scope: "local" });
      return true;
    }
  } catch {}
  return false;
}

export async function getAuthHeaders() {
  await enforceSessionExpiry();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
