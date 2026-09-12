import "./App.css";
import { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/zh-cn";
import { useAuthStore } from "./store/authStore";
import { OnboardingExperience } from "./components/OnboardingExperience";
import { GlobalCommandPalette } from "./components/GlobalCommandPalette";
import { SourceInboxLauncher } from "./components/SourceInbox/SourceInboxLauncher";
import { WriteFeedbackHost } from "./components/WriteFeedbackHost";
import { AppShell } from "./components/AppShell/AppShell";
import {
  AiShellPage,
  AutomationsShellPage,
  DashboardsShellPage,
  HelpShellPage,
  HomeShellPage,
  NotificationsShellPage,
  ProjectsShellPage,
  RecycleBinShellPage,
  RouteLoadingFallback,
  SettingsShellPage,
  ShellForbiddenPage,
  ShellNotFoundPage,
  TableLandingPage,
} from "./components/AppShell/ShellPages";
import { resolveLandingRoute } from "./components/Home/homePreferences";
import { useLanguage } from "./lib/useLanguage";
import { qtableTheme } from "./styles/tokens";

const SmartTable = lazy(() =>
  import("./components/SmartTable").then((mod) => ({ default: mod.SmartTable })),
);
const WorkspaceMembersPage = lazy(() => import("./components/WorkspaceMembersPage"));
const AuthPage = lazy(() => import("./components/AuthPage"));
const OAuthCallbackPage = lazy(() => import("./components/OAuthCallbackPage"));
const OAuthAuthorizePage = lazy(() => import("./components/OAuthAuthorizePage"));
const OAuthSuccessPage = lazy(() => import("./components/OAuthSuccessPage"));
const DashboardWorkbench = lazy(() =>
  import("./components/DashboardWorkbench").then((mod) => ({
    default: mod.DashboardWorkbench,
  })),
);
const PublicDashboardPage = lazy(() =>
  import("./components/PublicDashboardPage").then((mod) => ({
    default: mod.PublicDashboardPage,
  })),
);

const WorkbenchEntry = () => {
  const { tableId } = useParams();
  const isDashboard = Boolean(tableId && tableId.startsWith("dsb"));
  return (
    <div className="qtable-page-fill">
      {isDashboard ? <DashboardWorkbench embedded /> : <SmartTable embedded />}
    </div>
  );
};

const DashboardLegacyRedirect = () => {
  const { dashboardId } = useParams();
  return <Navigate to={`/workbench/${dashboardId || ""}`} replace />;
};

const LandingRedirect = () => <Navigate to={resolveLandingRoute()} replace />;

const RequireAuth = () => {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return (
    <>
      <WriteFeedbackHost />
      <OnboardingExperience />
      <GlobalCommandPalette />
      <SourceInboxLauncher />
      <AppShell />
    </>
  );
};

function App() {
  const language = useLanguage();

  useEffect(() => {
    dayjs.locale(language === "zh-CN" ? "zh-cn" : "en");
  }, [language]);

  return (
    <ConfigProvider
      theme={qtableTheme}
      locale={language === "zh-CN" ? zhCN : enUS}
    >
      <div className="App">
        <title>QTable</title>
        <meta
          name="description"
          content="QTable Enterprise Suite - Smart Table"
        />
        <BrowserRouter>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/share/dashboard/:token" element={<PublicDashboardPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
              <Route path="/reset-password" element={<AuthPage mode="reset" />} />
              <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
              <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
              <Route path="/oauth/success" element={<OAuthSuccessPage />} />

              <Route element={<RequireAuth />}>
                <Route index element={<LandingRedirect />} />
                <Route path="home" element={<HomeShellPage />} />
                <Route path="tables" element={<TableLandingPage />} />
                <Route path="workbench/:tableId/:viewId" element={<WorkbenchEntry />} />
                <Route path="workbench/:tableId" element={<WorkbenchEntry />} />
                <Route
                  path="dashboard/:dashboardId"
                  element={<DashboardLegacyRedirect />}
                />
                <Route path="dashboards" element={<DashboardsShellPage />} />
                <Route path="projects" element={<ProjectsShellPage />} />
                <Route path="automations" element={<AutomationsShellPage />} />
                <Route path="ai" element={<AiShellPage />} />
                <Route path="notifications" element={<NotificationsShellPage />} />
                <Route path="recycle-bin" element={<RecycleBinShellPage />} />
                <Route path="settings" element={<SettingsShellPage />} />
                <Route path="help" element={<HelpShellPage />} />
                <Route path="workspace/:id" element={<WorkspaceMembersPage />} />
                <Route path="unauthorized" element={<ShellForbiddenPage />} />
                <Route path="*" element={<ShellNotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </div>
    </ConfigProvider>
  );
}

export default App;
