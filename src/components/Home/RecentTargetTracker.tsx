import { useMutation } from "@apollo/client/react";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { IMPORT_RECENT_TARGETS, UPSERT_RECENT_TARGET } from "./homeGraphql";
import { rememberWorkbenchRoute } from "./homePreferences";

const LEGACY_RECENT_KEY = "qtable.recentTargets";
const MIGRATION_DONE_KEY = "qtable.recentTargets.serverMigration.v1";

const parseLegacyTargets = (): Array<Record<string, unknown>> => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_RECENT_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).slice(0, 50)
      : [];
  } catch {
    return [];
  }
};

const migrationDone = () => {
  try {
    return localStorage.getItem(MIGRATION_DONE_KEY) === "1";
  } catch {
    return true;
  }
};

const markMigrationDone = () => {
  try {
    localStorage.setItem(MIGRATION_DONE_KEY, "1");
    localStorage.removeItem(LEGACY_RECENT_KEY);
  } catch {
    // Migration is best-effort; server tracking below still works.
  }
};

export function RecentTargetTracker() {
  const location = useLocation();
  const [importRecentTargets] = useMutation(IMPORT_RECENT_TARGETS);
  const [upsertRecentTarget] = useMutation(UPSERT_RECENT_TARGET);
  const lastTrackedRouteRef = useRef("");

  useEffect(() => {
    if (migrationDone()) return;
    const targets = parseLegacyTargets();
    if (!targets.length) {
      markMigrationDone();
      return;
    }
    void importRecentTargets({ variables: { targets } })
      .then(() => markMigrationDone())
      .catch(() => {
        // Keep the local payload so a later authenticated session can retry.
      });
  }, [importRecentTargets]);

  useEffect(() => {
    if (!location.pathname.startsWith("/workbench/")) return;
    const fullRoute = `${location.pathname}${location.search}`;
    rememberWorkbenchRoute(fullRoute);
    if (lastTrackedRouteRef.current === fullRoute) return;
    lastTrackedRouteRef.current = fullRoute;

    const segments = location.pathname.split("/").filter(Boolean);
    const entityId = segments[1];
    const viewId = segments[2] || undefined;
    if (!entityId) return;

    const recordId = new URLSearchParams(location.search).get("recordId");
    const isDashboard = /^dsb/i.test(entityId);
    const target = recordId
      ? {
          entityType: "record",
          entityId: recordId,
          tableId: entityId,
          viewId,
          visitedAt: new Date().toISOString(),
        }
      : isDashboard
        ? {
            entityType: "dashboard",
            entityId,
            visitedAt: new Date().toISOString(),
          }
        : {
            entityType: "table",
            entityId,
            tableId: entityId,
            viewId,
            visitedAt: new Date().toISOString(),
          };

    void upsertRecentTarget({ variables: { target } }).catch(() => {
      // Recent history must never block the workbench itself.
    });
  }, [location.pathname, location.search, upsertRecentTarget]);

  return null;
}
