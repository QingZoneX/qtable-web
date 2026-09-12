import {
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  FolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Result,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";
import {
  CREATE_DASHBOARD,
  DELETE_ITEM,
  GET_DASHBOARD,
  GET_WORKSPACE,
  GET_WORKSPACES,
  RENAME_ITEM,
} from "../../lib/graphql";
import { t } from "../../lib/i18nRuntime";
import { useLanguage } from "../../lib/useLanguage";
import { useAuthStore } from "../../store/authStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import type { DashboardPayload } from "../Dashboard";
import { MY_WORK_QUERY, REMOVE_RECENT_TARGET } from "../Home/homeGraphql";
import type {
  MyWorkPayload,
  RecentSectionData,
  RecentTarget,
} from "../Home/types";
import {
  dashboardRecentMap,
  dashboardSearchMatches,
  flattenDashboards,
  type DashboardCenterItem,
  type DashboardTreeNode,
} from "./dashboardCenterModel";
import { dashboardCenterLocale, dashboardCenterT } from "./dashboardCenterI18n";
import "./dashboardCenter.css";

type WorkspaceSummary = {
  id: string;
  name: string;
  rootId?: string;
};

type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

type DashboardMeta = {
  isPublic?: boolean;
  description?: string;
};

const roleCanEdit = (role?: string | null) =>
  role === "owner" || role === "editor";

const resolveTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object" && "message" in error) {
    const candidate = String((error as { message?: unknown }).message || "").trim();
    if (candidate) return candidate;
  }
  return fallback;
};

const formatVisitedAt = (value?: string) => {
  if (!value) return dashboardCenterT("time.none");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(dashboardCenterLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

export function DashboardCenterPage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const storedWorkspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const setWorkspaceId = useWorkspaceNavigationStore((state) => state.setWorkspaceId);
  const timezone = useMemo(() => resolveTimezone(), []);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DashboardCenterItem | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [metaById, setMetaById] = useState<Record<string, DashboardMeta>>({});

  const {
    data: workspaceListData,
    loading: workspaceListLoading,
    error: workspaceListError,
    refetch: refetchWorkspaces,
  } = useQuery<{ workspaces: WorkspacesPayload }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "network-only",
  });

  const workspaceBuckets = workspaceListData?.workspaces || {
    owned: [],
    invited: [],
  };
  const workspaces = useMemo(
    () => [...(workspaceBuckets.owned || []), ...(workspaceBuckets.invited || [])],
    [workspaceBuckets.invited, workspaceBuckets.owned],
  );
  const resolvedWorkspaceId =
    workspaces.find((workspace) => workspace.id === storedWorkspaceId)?.id ||
    workspaces[0]?.id ||
    storedWorkspaceId ||
    "";
  const currentWorkspace = workspaces.find(
    (workspace) => workspace.id === resolvedWorkspaceId,
  );

  useEffect(() => {
    if (resolvedWorkspaceId && resolvedWorkspaceId !== storedWorkspaceId) {
      setWorkspaceId(resolvedWorkspaceId);
    }
  }, [resolvedWorkspaceId, setWorkspaceId, storedWorkspaceId]);

  const {
    data: workspaceData,
    loading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useQuery<{ workspace: { root: DashboardTreeNode } }>(GET_WORKSPACE, {
    variables: { workspaceId: resolvedWorkspaceId || undefined },
    skip: !token || !resolvedWorkspaceId,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const root = workspaceData?.workspace?.root;
  const dashboards = useMemo(() => flattenDashboards(root), [root]);

  const {
    members,
    loading: membersLoading,
    error: membersError,
    accessDenied,
    refetch: refetchMembers,
  } = useWorkspaceAccess(resolvedWorkspaceId || undefined);
  const workspaceRole = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return members.find((member) => member.email?.toLowerCase() === email)?.role || null;
  }, [members, user?.email]);
  const canEdit = !membersLoading && roleCanEdit(workspaceRole);

  const {
    data: recentData,
    loading: recentLoading,
    error: recentError,
    refetch: refetchRecent,
  } = useQuery<{ myWork: MyWorkPayload }>(MY_WORK_QUERY, {
    variables: {
      sections: ["recent"],
      limit: 50,
      cursors: null,
      timezone,
      taskState: "all",
    },
    skip: !token,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const recentSection = recentData?.myWork?.sections?.recent;
  const recentItems = useMemo<RecentTarget[]>(() => {
    if (recentSection?.status !== "ok") return [];
    const data = recentSection.data as RecentSectionData;
    return (data.items || []).filter(
      (item) => !item.workspaceId || item.workspaceId === resolvedWorkspaceId,
    );
  }, [recentSection, resolvedWorkspaceId]);
  const recentById = useMemo(() => dashboardRecentMap(recentItems), [recentItems]);

  const [createDashboard] = useMutation<{
    createDashboard?: DashboardTreeNode | null;
  }>(CREATE_DASHBOARD);
  const [renameItem] = useMutation(RENAME_ITEM);
  const [deleteItem] = useMutation(DELETE_ITEM);
  const [removeRecentTarget] = useMutation(REMOVE_RECENT_TARGET);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedWorkspaceId || !dashboards.length) return () => undefined;

    const load = async () => {
      const next: Record<string, DashboardMeta> = {};
      const batchSize = 4;
      for (let offset = 0; offset < dashboards.length; offset += batchSize) {
        if (cancelled) return;
        const batch = dashboards.slice(offset, offset + batchSize);
        const results = await Promise.all(
          batch.map(async (dashboard) => {
            try {
              const response = await apollo.query<{ dashboard: DashboardPayload }>({
                query: GET_DASHBOARD,
                variables: {
                  dashboardId: dashboard.id,
                  workspaceId: resolvedWorkspaceId,
                },
                fetchPolicy: "network-only",
              });
              return {
                id: dashboard.id,
                meta: {
                  isPublic: response.data?.dashboard?.isPublic,
                  description: response.data?.dashboard?.description,
                } satisfies DashboardMeta,
              };
            } catch {
              return null;
            }
          }),
        );
        for (const result of results) {
          if (result) next[result.id] = result.meta;
        }
        if (!cancelled) setMetaById({ ...next });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [apollo, dashboards, resolvedWorkspaceId]);

  const visibleDashboards = useMemo(() => {
    return dashboards
      .filter((dashboard) => dashboardSearchMatches(dashboard, search))
      .sort((left, right) => {
        const leftVisited = recentById.get(left.id) || "";
        const rightVisited = recentById.get(right.id) || "";
        if (leftVisited !== rightVisited) return rightVisited.localeCompare(leftVisited);
        return left.name.localeCompare(right.name, dashboardCenterLocale());
      });
  }, [dashboards, language, recentById, search]);

  const refresh = async () => {
    const jobs: Promise<unknown>[] = [refetchWorkspaces()];
    if (resolvedWorkspaceId) {
      jobs.push(refetchWorkspace({ workspaceId: resolvedWorkspaceId }));
      jobs.push(refetchMembers());
    }
    jobs.push(
      refetchRecent({
        sections: ["recent"],
        limit: 50,
        cursors: null,
        timezone,
        taskState: "all",
      }),
    );
    await Promise.allSettled(jobs);
  };

  const openDashboard = (dashboardId: string) => {
    if (resolvedWorkspaceId) setWorkspaceId(resolvedWorkspaceId);
    navigate(`/workbench/${dashboardId}`);
  };

  const openCreate = () => {
    if (!canEdit || !root?.id) {
      message.warning(dashboardCenterT("readonly.create"));
      return;
    }
    setCreateName("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name || !root?.id || !resolvedWorkspaceId) return;
    setCreating(true);
    try {
      const result = await createDashboard({
        variables: { name, parentId: root.id, workspaceId: resolvedWorkspaceId },
      });
      const created = result.data?.createDashboard;
      if (!created?.id) {
        throw new Error(dashboardCenterT("create.missingId"));
      }
      setCreateOpen(false);
      message.success(dashboardCenterT("create.success"));
      try {
        await refetchWorkspace({ workspaceId: resolvedWorkspaceId });
      } catch {
        message.warning(dashboardCenterT("create.refreshFailed"));
      }
      openDashboard(created.id);
    } catch (error) {
      message.error(errorMessage(error, dashboardCenterT("create.failed")));
    } finally {
      setCreating(false);
    }
  };

  const openRename = (dashboard: DashboardCenterItem) => {
    if (!canEdit) {
      message.warning(dashboardCenterT("readonly.rename"));
      return;
    }
    setRenameTarget(dashboard);
    setRenameName(dashboard.name);
  };

  const submitRename = async () => {
    const name = renameName.trim();
    if (!renameTarget || !name || !resolvedWorkspaceId) return;
    setRenaming(true);
    try {
      await renameItem({
        variables: {
          itemId: renameTarget.id,
          name,
          workspaceId: resolvedWorkspaceId,
        },
      });
      setRenameTarget(null);
      message.success(dashboardCenterT("rename.success"));
      try {
        await refetchWorkspace({ workspaceId: resolvedWorkspaceId });
      } catch {
        message.warning(dashboardCenterT("rename.refreshFailed"));
      }
    } catch (error) {
      message.error(errorMessage(error, dashboardCenterT("rename.failed")));
    } finally {
      setRenaming(false);
    }
  };

  const deleteDashboard = (dashboard: DashboardCenterItem) => {
    if (!canEdit || !resolvedWorkspaceId) {
      message.warning(dashboardCenterT("readonly.delete"));
      return;
    }
    Modal.confirm({
      title: t("dashboard.deleteTitle", { name: dashboard.name }),
      content: t("dashboard.deleteContent"),
      okText: t("common.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        setDeletingId(dashboard.id);
        try {
          await deleteItem({
            variables: {
              itemId: dashboard.id,
              workspaceId: resolvedWorkspaceId,
            },
          });
          const syncResults = await Promise.allSettled([
            refetchWorkspace({ workspaceId: resolvedWorkspaceId }),
            removeRecentTarget({
              variables: {
                entityType: "dashboard",
                entityId: dashboard.id,
                tableId: null,
              },
            }),
          ]);
          if (syncResults.some((result) => result.status === "rejected")) {
            message.warning(dashboardCenterT("delete.partialRefresh"));
          } else {
            message.success(dashboardCenterT("delete.success"));
            void refetchRecent();
          }
        } catch (error) {
          message.error(errorMessage(error, dashboardCenterT("delete.failed")));
          throw error;
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const dashboardMenu = (dashboard: DashboardCenterItem): MenuProps => ({
    items: canEdit
      ? [
          { key: "rename", icon: <EditOutlined />, label: dashboardCenterT("menu.rename") },
          { type: "divider" },
          { key: "delete", icon: <DeleteOutlined />, label: dashboardCenterT("menu.delete"), danger: true },
        ]
      : [],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === "rename") openRename(dashboard);
      if (key === "delete") deleteDashboard(dashboard);
    },
  });

  if (!token) {
    return (
      <div className="qtable-dashboard-center-state">
        <Result status="403" title={dashboardCenterT("auth.title")} subTitle={dashboardCenterT("auth.subtitle")} />
      </div>
    );
  }

  if (workspaceListLoading && !workspaceListData) {
    return (
      <div className="qtable-dashboard-center-state" role="status" aria-label={dashboardCenterT("loading.aria")}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (workspaceListError) {
    return (
      <div className="qtable-dashboard-center-state">
        <Alert
          type="error"
          showIcon
          message={dashboardCenterT("workspace.loadFailed")}
          description={workspaceListError.message}
          action={<Button onClick={() => void refetchWorkspaces()}>{dashboardCenterT("common.retry")}</Button>}
        />
      </div>
    );
  }

  if (!workspaces.length) {
    return (
      <div className="qtable-dashboard-center-state">
        <Empty description={dashboardCenterT("workspace.empty")} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="qtable-dashboard-center-state">
        <Result
          status="403"
          title={dashboardCenterT("access.title")}
          subTitle={dashboardCenterT("access.subtitle")}
        />
      </div>
    );
  }

  return (
    <main className="qtable-dashboard-center">
      <header className="qtable-dashboard-center-header">
        <div>
          <Typography.Title level={2}>{dashboardCenterT("title")}</Typography.Title>
          <Typography.Text type="secondary">{dashboardCenterT("description")}</Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>
            {dashboardCenterT("common.refresh")}
          </Button>
          {canEdit ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!root?.id}>
              {dashboardCenterT("create.button")}
            </Button>
          ) : null}
        </Space>
      </header>

      <section className="qtable-dashboard-center-toolbar" aria-label={dashboardCenterT("filter.aria")}>
        <Select
          value={resolvedWorkspaceId || undefined}
          options={workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
          onChange={(value) => setWorkspaceId(value)}
          className="qtable-dashboard-center-workspace"
          aria-label={dashboardCenterT("filter.workspaceAria")}
        />
        <Input
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder={dashboardCenterT("filter.search")}
          className="qtable-dashboard-center-search"
        />
        <Typography.Text type="secondary">
          {dashboardCenterT("summary.workspace", {
            name: currentWorkspace?.name || dashboardCenterT("workspace.current"),
            count: dashboards.length,
          })}
        </Typography.Text>
      </section>

      {membersError && !accessDenied ? (
        <Alert
          type="warning"
          showIcon
          message={dashboardCenterT("permission.loadFailed")}
          description={membersError.message}
          action={<Button size="small" onClick={() => void refetchMembers()}>{dashboardCenterT("common.retry")}</Button>}
        />
      ) : null}

      {recentError || recentSection?.status === "error" ? (
        <Alert
          type="info"
          showIcon
          message={dashboardCenterT("recent.unavailable")}
          description={dashboardCenterT("recent.unavailableDescription")}
        />
      ) : null}

      {workspaceError ? (
        <Alert
          type="error"
          showIcon
          message={dashboardCenterT("list.loadFailed")}
          description={workspaceError.message}
          action={
            <Button size="small" onClick={() => void refetchWorkspace({ workspaceId: resolvedWorkspaceId })}>
              {dashboardCenterT("common.retry")}
            </Button>
          }
        />
      ) : workspaceLoading && !root ? (
        <div className="qtable-dashboard-center-grid" role="status" aria-label={dashboardCenterT("loading.aria")}>
          {Array.from({ length: 6 }, (_, index) => (
            <div className="qtable-dashboard-center-skeleton" key={index}>
              <Skeleton active title paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : visibleDashboards.length ? (
        <section className="qtable-dashboard-center-grid" aria-label={dashboardCenterT("list.aria")}>
          {visibleDashboards.map((dashboard) => {
            const meta = metaById[dashboard.id];
            const visitedAt = recentById.get(dashboard.id);
            const folderLabel = dashboard.folderPath.length
              ? dashboard.folderPath.join(" / ")
              : dashboardCenterT("folder.root");
            return (
              <article className="qtable-dashboard-card" key={dashboard.id}>
                <button
                  type="button"
                  className="qtable-dashboard-card-open"
                  onClick={() => openDashboard(dashboard.id)}
                  aria-label={dashboardCenterT("open.aria", { name: dashboard.name })}
                >
                  <span className="qtable-dashboard-card-icon" aria-hidden="true">
                    <DashboardOutlined />
                  </span>
                  <span className="qtable-dashboard-card-copy">
                    <span className="qtable-dashboard-card-title-line">
                      <strong>{dashboard.name}</strong>
                      {typeof meta?.isPublic === "boolean" ? (
                        <Tag color={meta.isPublic ? "blue" : "default"}>
                          {meta.isPublic ? dashboardCenterT("visibility.public") : dashboardCenterT("visibility.private")}
                        </Tag>
                      ) : null}
                    </span>
                    {meta?.description ? (
                      <span className="qtable-dashboard-card-description">{meta.description}</span>
                    ) : null}
                    <span className="qtable-dashboard-card-path">
                      <FolderOutlined /> {folderLabel}
                    </span>
                    <small>
                      {recentLoading && !visitedAt
                        ? dashboardCenterT("recent.loading")
                        : dashboardCenterT("recent.value", { time: formatVisitedAt(visitedAt) })}
                    </small>
                  </span>
                </button>
                {canEdit ? (
                  <Dropdown menu={dashboardMenu(dashboard)} trigger={["click"]}>
                    <Button
                      type="text"
                      icon={<EllipsisOutlined />}
                      loading={deletingId === dashboard.id}
                      aria-label={dashboardCenterT("more.aria", { name: dashboard.name })}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </Dropdown>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <div className="qtable-dashboard-center-empty">
          <Empty
            description={
              search.trim()
                ? dashboardCenterT("empty.search")
                : canEdit
                  ? dashboardCenterT("empty.editable")
                  : dashboardCenterT("empty.readonly")
            }
          >
            {!search.trim() && canEdit ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!root?.id}>
                {dashboardCenterT("empty.createFirst")}
              </Button>
            ) : null}
          </Empty>
        </div>
      )}

      <Modal
        open={createOpen}
        title={dashboardCenterT("create.title")}
        okText={t("common.createAndOpen")}
        cancelText={t("common.cancel")}
        confirmLoading={creating}
        okButtonProps={{ disabled: !createName.trim() }}
        onOk={() => void submitCreate()}
        onCancel={() => !creating && setCreateOpen(false)}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          placeholder={dashboardCenterT("create.placeholder")}
          maxLength={120}
          onPressEnter={() => {
            if (createName.trim()) void submitCreate();
          }}
        />
        <Typography.Paragraph type="secondary" className="qtable-dashboard-center-modal-note">
          {dashboardCenterT("create.note")}
        </Typography.Paragraph>
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        title={dashboardCenterT("rename.title")}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        confirmLoading={renaming}
        okButtonProps={{ disabled: !renameName.trim() }}
        onOk={() => void submitRename()}
        onCancel={() => !renaming && setRenameTarget(null)}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={renameName}
          onChange={(event) => setRenameName(event.target.value)}
          placeholder={dashboardCenterT("rename.placeholder")}
          maxLength={120}
          onPressEnter={() => {
            if (renameName.trim()) void submitRename();
          }}
        />
      </Modal>
    </main>
  );
}
