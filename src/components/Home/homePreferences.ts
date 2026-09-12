import type { RecentTarget } from "./types";

export type LandingPreference = "home" | "last_workbench";

const LANDING_KEY = "qtable.landingPreference";
const LAST_WORKBENCH_KEY = "qtable.lastWorkbenchRoute";
const FAVORITES_KEY = "qtable.home.favoriteTargets";

const safeStorage = () => (typeof window === "undefined" ? null : window.localStorage);

export const getLandingPreference = (): LandingPreference => {
  try {
    return safeStorage()?.getItem(LANDING_KEY) === "last_workbench"
      ? "last_workbench"
      : "home";
  } catch {
    return "home";
  }
};

export const setLandingPreference = (value: LandingPreference): boolean => {
  try {
    const storage = safeStorage();
    if (!storage) return false;
    storage.setItem(LANDING_KEY, value);
    return true;
  } catch {
    return false;
  }
};

const safeWorkbenchRoute = (value: string | null): string | null => {
  if (!value || !value.startsWith("/workbench/") || value.startsWith("//")) {
    return null;
  }
  return value;
};

export const rememberWorkbenchRoute = (route: string) => {
  const safe = safeWorkbenchRoute(route);
  if (!safe) return;
  try {
    safeStorage()?.setItem(LAST_WORKBENCH_KEY, safe);
  } catch {
    // Best-effort preference only.
  }
};

export const resolveLandingRoute = () => {
  if (getLandingPreference() !== "last_workbench") return "/home";
  try {
    return safeWorkbenchRoute(safeStorage()?.getItem(LAST_WORKBENCH_KEY) || null) || "/home";
  } catch {
    return "/home";
  }
};

export const recentTargetKey = (target: Pick<RecentTarget, "entityType" | "entityId" | "tableId">) =>
  `${target.entityType}:${target.tableId || ""}:${target.entityId}`;

const loadFavoriteKeys = (): string[] => {
  try {
    const value = JSON.parse(safeStorage()?.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export const getFavoriteTargetKeys = () => new Set(loadFavoriteKeys());

export const toggleFavoriteTarget = (target: RecentTarget) => {
  const key = recentTargetKey(target);
  const next = getFavoriteTargetKeys();
  if (next.has(key)) next.delete(key);
  else next.add(key);
  try {
    safeStorage()?.setItem(FAVORITES_KEY, JSON.stringify([...next].slice(0, 100)));
  } catch {
    // UI-only preference; server recent history remains authoritative.
  }
  return next;
};
