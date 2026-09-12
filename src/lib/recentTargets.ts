export type RecentSearchTarget = {
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  deepLink: string;
  workspace?: { id: string; name: string } | null;
  table?: { id: string; name: string; defaultViewId?: string | null } | null;
  visitedAt: number;
};

const RECENT_TARGETS_PREFIX = "qtable.recentTargets.v1.";
const MAX_RECENT_TARGETS = 8;

const storageKey = (userKey: string) =>
  `${RECENT_TARGETS_PREFIX}${userKey || "anonymous"}`;

export function loadRecentTargets(userKey: string): RecentSearchTarget[] {
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentSearchTarget =>
          Boolean(
            item &&
              typeof item.entityType === "string" &&
              typeof item.entityId === "string" &&
              typeof item.title === "string" &&
              typeof item.deepLink === "string",
          ),
      )
      .sort((a, b) => Number(b.visitedAt || 0) - Number(a.visitedAt || 0))
      .slice(0, MAX_RECENT_TARGETS);
  } catch {
    return [];
  }
}

export function rememberRecentTarget(
  userKey: string,
  target: Omit<RecentSearchTarget, "visitedAt">,
): RecentSearchTarget[] {
  const next: RecentSearchTarget = {
    ...target,
    visitedAt: Date.now(),
  };
  const existing = loadRecentTargets(userKey).filter(
    (item) =>
      !(
        item.entityType === next.entityType &&
        item.entityId === next.entityId &&
        item.deepLink === next.deepLink
      ),
  );
  const updated = [next, ...existing].slice(0, MAX_RECENT_TARGETS);
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify(updated));
  } catch {
    // Search/navigation should continue even if storage is unavailable.
  }
  return updated;
}
