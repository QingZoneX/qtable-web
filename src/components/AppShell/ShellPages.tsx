import { Empty, Result, Skeleton } from "antd";
import { t } from "../../lib/i18nRuntime";
import { useLanguage } from "../../lib/useLanguage";
import { AiCenterPage } from "../AiCenter/AiCenterPage";
import { AutomationCenterPage } from "../Automations/AutomationCenterPage";
import "../Automations/automationShellLayout.css";
import { DashboardCenterPage } from "../DashboardCenter/DashboardCenterPage";
import { HelpCenterPage } from "../Help/HelpCenterPage";
import { HomeExperiencePage } from "../Home/HomeExperiencePage";
import { NotificationCenterPage } from "../Notifications/NotificationCenterPage";
import { ProjectsCenterPage } from "../ProjectsCenter/ProjectsCenterPage";
import { RecycleBinPage } from "../RecycleBin/RecycleBinPage";
import { SettingsCenterPage } from "../Settings/SettingsCenterPage";

export function RouteLoadingFallback() {
  useLanguage();
  return (
    <div
      className="qtable-shell-loading"
      role="status"
      aria-live="polite"
      aria-label={t("shell.pageLoading")}
    >
      <Skeleton active title paragraph={{ rows: 5 }} />
    </div>
  );
}

export function TableLandingPage() {
  useLanguage();
  return (
    <div className="qtable-shell-state-page">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("shell.selectTable")}
      />
    </div>
  );
}

export const HomeShellPage = HomeExperiencePage;

export const DashboardsShellPage = DashboardCenterPage;

export const ProjectsShellPage = ProjectsCenterPage;

export const AutomationsShellPage = AutomationCenterPage;

export const AiShellPage = AiCenterPage;

export const NotificationsShellPage = NotificationCenterPage;

export const RecycleBinShellPage = RecycleBinPage;

export const SettingsShellPage = SettingsCenterPage;

export const HelpShellPage = HelpCenterPage;

export function ShellForbiddenPage() {
  useLanguage();
  return (
    <div className="qtable-shell-state-page">
      <Result
        status="403"
        title={t("shell.forbiddenTitle")}
        subTitle={t("shell.forbiddenSubtitle")}
      />
    </div>
  );
}

export function ShellNotFoundPage() {
  useLanguage();
  return (
    <div className="qtable-shell-state-page">
      <Result
        status="404"
        title={t("shell.notFoundTitle")}
        subTitle={t("shell.notFoundSubtitle")}
      />
    </div>
  );
}
