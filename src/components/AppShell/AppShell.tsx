import { Alert } from "antd";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { t } from "../../lib/i18nRuntime";
import { useLanguage } from "../../lib/useLanguage";
import { RecentTargetTracker } from "../Home/RecentTargetTracker";
import { NotificationRealtimeProvider } from "../Notifications/NotificationRealtimeProvider";
import { Sidebar } from "../SmartTable/Sidebar";
import { PrimaryRail } from "./PrimaryRail";
import { RouteLoadingFallback } from "./ShellPages";
import { TopAppBar } from "./TopAppBar";
import "./appShell.css";
import "./contextSidebarLayout.css";
import "./accessibilityResponsive.css";

const shouldShowContextSidebar = (pathname: string) =>
  pathname === "/tables" ||
  pathname === "/dashboards" ||
  pathname.startsWith("/workbench/") ||
  pathname.startsWith("/workspace/");

export function AppShell() {
  useLanguage();
  const location = useLocation();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const showContextSidebar = shouldShowContextSidebar(location.pathname);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="qtable-app-shell">
      <a className="qtable-skip-link" href="#qtable-main-content">
        {t("shell.skipToMain")}
      </a>
      <RecentTargetTracker />
      <PrimaryRail />
      <div
        className={
          showContextSidebar
            ? "qtable-context-sidebar-host"
            : "qtable-context-sidebar-host is-hidden"
        }
        aria-hidden={!showContextSidebar}
      >
        <Sidebar />
      </div>
      <NotificationRealtimeProvider>
        <div className="qtable-shell-main">
          <TopAppBar showContextSidebar={showContextSidebar} />
          {!online ? (
            <Alert
              banner
              showIcon
              type="warning"
              className="qtable-offline-banner"
              message={t("shell.offline")}
            />
          ) : null}
          <main
            id="qtable-main-content"
            className="qtable-shell-content"
            tabIndex={-1}
          >
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </NotificationRealtimeProvider>
    </div>
  );
}
