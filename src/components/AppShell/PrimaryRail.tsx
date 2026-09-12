import {
  AppstoreOutlined,
  BellOutlined,
  DashboardOutlined,
  DeleteOutlined,
  HomeOutlined,
  InboxOutlined,
  ProjectOutlined,
  RobotOutlined,
  SettingOutlined,
  TableOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { t } from "../../lib/i18nRuntime";
import { useLanguage } from "../../lib/useLanguage";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import { openSourceInbox } from "../SourceInbox/sourceInboxEvents";

type RailItem = {
  key: string;
  label: string;
  icon: ReactNode;
  route: string;
  active: (pathname: string) => boolean;
};

export function PrimaryRail() {
  useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);

  const items: RailItem[] = [
    {
      key: "home",
      label: t("shell.home"),
      icon: <HomeOutlined />,
      route: "/home",
      active: (pathname) => pathname === "/home",
    },
    {
      key: "tables",
      label: t("shell.tables"),
      icon: <TableOutlined />,
      route: "/tables",
      active: (pathname) =>
        pathname === "/tables" ||
        (pathname.startsWith("/workbench/") &&
          !/^\/workbench\/dsb/i.test(pathname)),
    },
    {
      key: "dashboards",
      label: t("shell.dashboards"),
      icon: <DashboardOutlined />,
      route: "/dashboards",
      active: (pathname) =>
        pathname === "/dashboards" || /^\/workbench\/dsb/i.test(pathname),
    },
    {
      key: "projects",
      label: t("shell.projects"),
      icon: <ProjectOutlined />,
      route: "/projects",
      active: (pathname) => pathname === "/projects",
    },
    {
      key: "automations",
      label: t("shell.automations"),
      icon: <ThunderboltOutlined />,
      route: "/automations",
      active: (pathname) => pathname === "/automations",
    },
  ];

  const utilityItems: RailItem[] = [
    {
      key: "ai",
      label: t("shell.ai"),
      icon: <RobotOutlined />,
      route: "/ai",
      active: (pathname) => pathname === "/ai",
    },
    {
      key: "notifications",
      label: t("shell.notifications"),
      icon: <BellOutlined />,
      route: "/notifications",
      active: (pathname) => pathname === "/notifications",
    },
    {
      key: "recycle-bin",
      label: t("shell.recycleBin"),
      icon: <DeleteOutlined />,
      route: "/recycle-bin",
      active: (pathname) => pathname === "/recycle-bin",
    },
    {
      key: "settings",
      label: t("shell.settings"),
      icon: <SettingOutlined />,
      route: "/settings",
      active: (pathname) =>
        pathname === "/settings" || pathname.startsWith("/workspace/"),
    },
  ];

  const renderItem = (item: RailItem) => {
    const active = item.active(location.pathname);
    return (
      <Tooltip key={item.key} title={item.label} placement="right">
        <button
          type="button"
          className={`qtable-primary-rail-item${active ? " is-active" : ""}`}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          onClick={() => navigate(item.route)}
        >
          {item.icon}
        </button>
      </Tooltip>
    );
  };

  return (
    <aside className="qtable-primary-rail" aria-label={t("shell.nav.main")}>
      <Tooltip title={t("shell.workbench")} placement="right">
        <button
          type="button"
          className="qtable-primary-rail-brand"
          aria-label={t("shell.workbench")}
          onClick={() => navigate("/home")}
        >
          <AppstoreOutlined />
        </button>
      </Tooltip>
      <nav className="qtable-primary-rail-nav" aria-label={t("shell.nav.product")}>
        {items.map(renderItem)}
      </nav>
      <div className="qtable-primary-rail-spacer" />
      <nav
        className="qtable-primary-rail-nav qtable-primary-rail-utilities"
        aria-label={t("shell.nav.utility")}
      >
        {workspaceId ? (
          <Tooltip title={t("shell.sourceInbox")} placement="right">
            <button
              type="button"
              className="qtable-primary-rail-item"
              aria-label={t("shell.sourceInbox")}
              aria-haspopup="dialog"
              onClick={openSourceInbox}
            >
              <InboxOutlined />
            </button>
          </Tooltip>
        ) : null}
        {utilityItems.map(renderItem)}
      </nav>
    </aside>
  );
}
