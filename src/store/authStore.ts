import { create } from "zustand";
import { apiUrl } from "../lib/apiUrl";
import { clearPrivateBusinessCaches } from "../lib/serviceWorkerCache";
import {
  sanitizePasswordResetResponse,
  type PasswordResetRequestResult,
} from "./passwordResetResponse";
import { resetWorkspaceNavigation } from "./workspaceNavigationStore";

export type AuthUser = {
  id?: number;
  name?: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<string | null>;
  setUser: (user: AuthUser | null) => void;
};

const tokenStorageKey = "qtable_token";
const refreshTokenStorageKey = "qtable_refresh_token";
const userStorageKey = "qtable_user";
let authExpiredRedirecting = false;

const loadToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(tokenStorageKey);

const loadUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(userStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

const saveToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(tokenStorageKey, token);
  } else {
    localStorage.removeItem(tokenStorageKey);
  }
};

const saveRefreshToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(refreshTokenStorageKey, token);
  else localStorage.removeItem(refreshTokenStorageKey);
};

let refreshInFlight: Promise<string | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const tokenExpiresAt = (token: string): number | null => {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const scheduleSessionRefresh = (token: string | null) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!token || typeof window === "undefined") return;
  const expiresAt = tokenExpiresAt(token);
  const delay = expiresAt
    ? Math.max(5_000, expiresAt - Date.now() - 5 * 60_000)
    : 60 * 60_000;
  refreshTimer = setTimeout(() => {
    void useAuthStore.getState().refreshSession().then((next) => {
      if (next) scheduleSessionRefresh(next);
      else {
        refreshTimer = setTimeout(
          () => scheduleSessionRefresh(useAuthStore.getState().token),
          60_000,
        );
      }
    });
  }, Math.min(delay, 2_147_000_000));
};

const saveUser = (user: AuthUser | null) => {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(userStorageKey, JSON.stringify(user));
  } else {
    localStorage.removeItem(userStorageKey);
  }
};

const parseErrorMessage = async (res: Response) => {
  try {
    const data = await res.json();
    if (data?.detail) return String(data.detail);
  } catch {
    return "Request failed";
  }
  return "Request failed";
};

export const useAuthStore = create<AuthState>((set) => ({
  token: loadToken(),
  user: loadUser(),
  setUser: (user) => {
    saveUser(user);
    set({ user });
  },
  logout: () => {
    saveToken(null);
    saveRefreshToken(null);
    saveUser(null);
    resetWorkspaceNavigation();
    set({ token: null, user: null });
    scheduleSessionRefresh(null);
    void clearPrivateBusinessCaches();
  },
  refreshSession: async () => {
    if (refreshInFlight) return refreshInFlight;
    const refreshToken =
      typeof window === "undefined"
        ? null
        : localStorage.getItem(refreshTokenStorageKey);
    if (!refreshToken) return null;
    const job = (async () => {
      try {
        const res = await fetch(apiUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            saveToken(null);
            saveRefreshToken(null);
            saveUser(null);
            resetWorkspaceNavigation();
            set({ token: null, user: null });
            scheduleSessionRefresh(null);
            await clearPrivateBusinessCaches();
          }
          return null;
        }
        const data = (await res.json()) as {
          access_token: string;
          refresh_token: string;
        };
        saveToken(data.access_token);
        saveRefreshToken(data.refresh_token);
        set({ token: data.access_token });
        scheduleSessionRefresh(data.access_token);
        return data.access_token;
      } catch {
        return null;
      }
    })();
    refreshInFlight = job;
    try {
      return await job;
    } finally {
      if (refreshInFlight === job) refreshInFlight = null;
    }
  },
  login: async (email, password) => {
    // Clear any QTable-owned Cache Storage before establishing a new identity.
    // This protects A -> B account switches even if the previous session ended
    // outside the normal logout path on an older vulnerable release.
    await clearPrivateBusinessCaches();
    const res = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    saveToken(data.access_token);
    saveRefreshToken(data.refresh_token);
    const user = { email, name: email.split("@")[0] };
    saveUser(user);
    set({ token: data.access_token, user });
    scheduleSessionRefresh(data.access_token);
  },
  register: async (email, password, name) => {
    await clearPrivateBusinessCaches();
    const res = await fetch(apiUrl("/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    saveToken(data.access_token);
    saveRefreshToken(data.refresh_token);
    const user = { email, name };
    saveUser(user);
    set({ token: data.access_token, user });
    scheduleSessionRefresh(data.access_token);
  },
  requestPasswordReset: async (email) => {
    const res = await fetch(apiUrl("/auth/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }
    // Deliberately project only the generic message. Even if a development
    // backend explicitly emits a debug credential, production UI code has no
    // path to expose, copy, persist, or navigate with that raw value.
    return sanitizePasswordResetResponse(await res.json());
  },
  resetPassword: async (token, newPassword) => {
    const res = await fetch(apiUrl("/auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res));
    }
  },
}));

scheduleSessionRefresh(useAuthStore.getState().token);

export const handleAuthExpired = async () => {
  const refreshed = await useAuthStore.getState().refreshSession();
  if (refreshed) {
    if (typeof window !== "undefined") window.location.reload();
    return;
  }
  useAuthStore.getState().logout();
  // Await cleanup before navigation so a session-expiry redirect cannot race a
  // later same-browser identity against historical QTable caches.
  await clearPrivateBusinessCaches();
  if (typeof window === "undefined") return;
  if (authExpiredRedirecting) return;
  authExpiredRedirecting = true;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (window.location.pathname === "/login") {
    window.location.replace("/login");
    return;
  }
  const next = encodeURIComponent(current || "/");
  window.location.replace(`/login?next=${next}`);
};
