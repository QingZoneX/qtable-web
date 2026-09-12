import {
  DownOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import {
  Avatar,
  Button,
  Divider,
  Dropdown,
  Space,
  Tooltip,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { GET_WORKSPACES } from "../../lib/graphql";
import {
  setLanguage,
  t,
  type Language,
} from "../../lib/i18nRuntime";
import {
  openGlobalCommandPalette,
  openWorkspaceManager,
} from "../../lib/shellEvents";
import { useLanguage } from "../../lib/useLanguage";
import { useAuthStore } from "../../store/authStore";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import { ExperienceModeControl } from "../ExperienceMode/ExperienceModeControl";
import { NotificationBell } from "../Notifications/NotificationBell";

type WorkspaceSummary = {
  id: string;
  name: string;
  rootId?: string;
};

type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

const routeLabel = (pathname: string) => {
  if (pathname === "/home") return t("shell.home");
  if (pathname === "/tables") return t("shell.tables");
  if (pathname === "/dashboards") return t("shell.dashboards");
  if (pathname === "/projects") return t("shell.projects");
  if (pathname === "/automations") return t("shell.automations");
  if (pathname === "/ai") return t("shell.ai");
  if (pathname === "/notifications") return t("shell.notifications");
  if (pathname === "/recycle-bin") return t("shell.recycleBin");
  if (pathname === "/settings") return t("shell.settings");
  if (pathname === "/help") return t("shell.help");
  if (pathname.startsWith("/workspace/")) return t("shell.members");
  return "";
};

export function TopAppBar({
  showContextSidebar,
}: {
  showContextSidebar: boolean;
}) {
  const language = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const currentTableName = useSmartTableStore((state) => state.currentTableName);
  const currentViewId = useSmartTableStore((state) => state.currentViewId);
  const views = useSmartTableStore((state) => state.views);
  const sidebarCollapsed = useSmartTableStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useSmartTableStore(
    (state) => state.toggleSidebarCollapsed,
  );
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const setWorkspaceId = useWorkspaceNavigationStore(
    (state) => state.setWorkspaceId,
  );

  const { data, loading: workspaceLoading, error: workspaceError } = useQuery<{
    workspaces: WorkspacesPayload;
  }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });

  const owned = data?.workspaces?.owned ?? [];
  const invited = data?.workspaces?.invited ?? [];
  const allWorkspaces = [...owned, ...invited];
  const currentWorkspace =
    allWorkspaces.find((workspace) => workspace.id === workspaceId) ||
    allWorkspaces[0];

  const currentView = views.find((view) => view.id === currentViewId);
  const isWorkbench = location.pathname.startsWith("/workbench/");
  const isDashboardWorkbench = /^\/workbench\/dsb/i.test(location.pathname);
  const breadcrumbItems: Array<{ key: string; label: string }> = [
    {
      key: "workspace",
      label:
        currentWorkspace?.name ||
        (workspaceLoading ? t("shell.workspaceLoading") : t("shell.workspace")),
    },
  ];

  if (isWorkbench && !isDashboardWorkbench) {
    breadcrumbItems.push({
      key: "table",
      label: currentTableName || t("shell.table"),
    });
    if (currentView?.name) {
      breadcrumbItems.push({ key: "view", label: currentView.name });
    }
  } else if (isDashboardWorkbench) {
    breadcrumbItems.push({ key: "dashboard", label: t("shell.dashboard") });
  } else {
    const label = routeLabel(location.pathname);
    if (label) breadcrumbItems.push({ key: "route", label });
  }

  const workspaceItems: MenuProps["items"] = [
    ...(owned.length
      ? [
          {
            key: "owned-group",
            type: "group" as const,
            label: t("shell.ownedWorkspaces"),
            children: owned.map((workspace) => ({
              key: `workspace:${workspace.id}`,
              label: workspace.name,
            })),
          },
        ]
      : []),
    ...(invited.length
      ? [
          {
            key: "invited-group",
            type: "group" as const,
            label: t("shell.invitedWorkspaces"),
            children: invited.map((workspace) => ({
              key: `workspace:${workspace.id}`,
              label: workspace.name,
            })),
          },
        ]
      : []),
    ...(workspaceLoading && !allWorkspaces.length
      ? [{ key: "workspace-loading", label: t("shell.loading"), disabled: true }]
      : []),
    ...(workspaceError
      ? [{ key: "workspace-error", label: t("shell.workspaceLoadFailed"), disabled: true }]
      : []),
    { type: "divider" as const },
    {
      key: "workspace-manager",
      icon: <SettingOutlined />,
      label: t("shell.workspaceManage"),
    },
    ...(currentWorkspace?.id
      ? [
          {
            key: "workspace-members",
            icon: <TeamOutlined />,
            label: t("shell.members"),
          },
        ]
      : []),
  ];

  const userDisplayName = user?.name || user?.email || t("shell.user");
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  const languageItems: MenuProps["items"] = [
    {
      key: "zh-CN",
      label: t("shell.languageZhCN"),
    },
    {
      key: "en-US",
      label: t("shell.languageEnUS"),
    },
  ];

  return (
    <header className="qtable-top-app-bar">
      <div className="qtable-top-app-bar-left">
        {showContextSidebar ? (
          <Tooltip
            title={
              sidebarCollapsed
                ? t("shell.expandDataNav")
                : t("shell.collapseDataNav")
            }
          >
            <Button
              type="text"
              className="qtable-topbar-icon-button"
              aria-label={
                sidebarCollapsed
                  ? t("shell.expandDataNav")
                  : t("shell.collapseDataNav")
              }
              icon={
                sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
              }
              onClick={toggleSidebarCollapsed}
            />
          </Tooltip>
        ) : null}

        <nav className="qtable-breadcrumbs" aria-label={t("shell.currentLocation")}>
          {breadcrumbItems.map((item, index) => (
            <span key={item.key} className="qtable-breadcrumb-item">
              {index > 0 ? (
                <span className="qtable-breadcrumb-separator" aria-hidden="true">
                  /
                </span>
              ) : null}
              <Typography.Text ellipsis>{item.label}</Typography.Text>
            </span>
          ))}
        </nav>
      </div>

      <div className="qtable-top-app-bar-actions">
        <button
          type="button"
          className="qtable-global-search-trigger"
          onClick={openGlobalCommandPalette}
          aria-label={t("shell.globalSearch")}
        >
          <SearchOutlined />
          <span className="qtable-global-search-label">
            {t("shell.searchPlaceholder")}
          </span>
          <span className="qtable-global-search-shortcut">
            {isMac ? "⌘K" : "Ctrl K"}
          </span>
        </button>

        <ExperienceModeControl workspaceId={currentWorkspace?.id} />
        <NotificationBell />

        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "help",
                icon: <QuestionCircleOutlined />,
                label: t("shell.help"),
              },
              {
                key: "search",
                icon: <SearchOutlined />,
                label: `${t("shell.globalSearch")}（${isMac ? "⌘K" : "Ctrl K"}）`,
              },
              {
                key: "members",
                icon: <TeamOutlined />,
                label: t("shell.members"),
                disabled: !currentWorkspace?.id,
              },
            ],
            onClick: ({ key }) => {
              if (key === "help") navigate("/help");
              if (key === "search") openGlobalCommandPalette();
              if (key === "members" && currentWorkspace?.id) {
                navigate(`/workspace/${currentWorkspace.id}`);
              }
            },
          }}
        >
          <Button
            type="text"
            className="qtable-topbar-icon-button"
            aria-label={t("shell.helpAndShortcuts")}
            icon={<QuestionCircleOutlined />}
          />
        </Dropdown>

        <Dropdown
          trigger={["click"]}
          menu={{
            items: languageItems,
            selectedKeys: [language],
            onClick: ({ key }) => setLanguage(key as Language),
          }}
        >
          <Button
            type="text"
            className="qtable-language-switcher"
            aria-label={t("shell.language")}
            icon={<GlobalOutlined />}
          >
            <span className="qtable-language-switcher-label">
              {language === "zh-CN" ? "中文" : "EN"}
            </span>
          </Button>
        </Dropdown>

        <Divider type="vertical" className="qtable-topbar-divider" />

        <Dropdown
          trigger={["click"]}
          menu={{
            items: workspaceItems,
            selectedKeys: currentWorkspace?.id
              ? [`workspace:${currentWorkspace.id}`]
              : [],
            onClick: ({ key }) => {
              if (key === "workspace-manager") {
                openWorkspaceManager();
                return;
              }
              if (key === "workspace-members" && currentWorkspace?.id) {
                navigate(`/workspace/${currentWorkspace.id}`);
                return;
              }
              if (!String(key).startsWith("workspace:")) return;
              const nextWorkspaceId = String(key).slice("workspace:".length);
              setWorkspaceId(nextWorkspaceId);
              if (location.pathname.startsWith("/workspace/")) {
                navigate(`/workspace/${nextWorkspaceId}`);
              }
            },
          }}
        >
          <Button
            type="text"
            className="qtable-workspace-topbar-switcher"
            aria-label={t("shell.workspaceSwitch")}
          >
            <span className="qtable-workspace-topbar-avatar">
              {(currentWorkspace?.name || "Q").charAt(0).toUpperCase()}
            </span>
            <span className="qtable-workspace-topbar-name">
              {currentWorkspace?.name ||
                (workspaceLoading ? t("shell.loading") : t("shell.workspaceSelect"))}
            </span>
            <DownOutlined />
          </Button>
        </Dropdown>

        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "profile",
                icon: <UserOutlined />,
                label: (
                  <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{userDisplayName}</Typography.Text>
                    {user?.email && user?.email !== userDisplayName ? (
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {user.email}
                      </Typography.Text>
                    ) : null}
                  </Space>
                ),
                disabled: true,
              },
              { type: "divider" },
              {
                key: "settings",
                icon: <SettingOutlined />,
                label: t("shell.settings"),
              },
              {
                key: "logout",
                label: t("shell.logout"),
                danger: true,
              },
            ],
            onClick: ({ key }) => {
              if (key === "settings") {
                navigate("/settings");
                return;
              }
              if (key === "logout") {
                logout();
                navigate("/login", { replace: true });
              }
            },
          }}
        >
          <Button
            type="text"
            className="qtable-user-menu-trigger"
            aria-label={t("shell.userMenu")}
          >
            <Avatar size={30} className="qtable-user-avatar">
              {userInitial}
            </Avatar>
          </Button>
        </Dropdown>
      </div>
    </header>
  );
}
