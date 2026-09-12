import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  PlusOutlined,
  ProjectOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
  TableOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  message,
  Progress,
  Segmented,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../../lib/apollo";
import { useAuthStore } from "../../store/authStore";
import { buildHomeRiskInsights, type HomeRiskInsight } from "./homeInsights";
import { homeT } from "./homeI18n";
import {
  MY_WORK_QUERY,
  REMOVE_RECENT_TARGET,
} from "./homeGraphql";
import {
  getFavoriteTargetKeys,
  getLandingPreference,
  recentTargetKey,
  setLandingPreference,
  toggleFavoriteTarget,
  type LandingPreference,
} from "./homePreferences";
import type {
  ActivityItem,
  ActivitySectionData,
  DueSectionData,
  KpiSectionData,
  MyWorkPayload,
  MyWorkSectionName,
  MyWorkSections,
  MyWorkTask,
  MyWorkTaskState,
  ProjectSummary,
  ProjectsSectionData,
  RecentSectionData,
  RecentTarget,
  SectionResult,
  TasksSectionData,
} from "./types";
import "./home.css";

const ALL_SECTIONS: MyWorkSectionName[] = [
  "tasks",
  "due",
  "projects",
  "recent",
  "activity",
  "kpi",
];

const DUE_SECTION_ID = "qtable-home-due";

const resolveTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const dataOf = <T,>(section?: SectionResult<T>): T | null =>
  section?.status === "ok" ? section.data : null;

const asList = (value: unknown) =>
  Array.isArray(value) ? value : value == null ? [] : [value];

const formatDue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return homeT("noDue");
  }
  const parsed = dayjs(String(value));
  if (!parsed.isValid()) return String(value);
  const today = dayjs().startOf("day");
  if (parsed.isSame(today, "day")) {
    return `${homeT("today")} · ${parsed.format("MM-DD")}`;
  }
  if (parsed.isSame(today.add(1, "day"), "day")) {
    return `${homeT("tomorrow")} · ${parsed.format("MM-DD")}`;
  }
  return parsed.format("YYYY-MM-DD");
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MM-DD HH:mm") : value;
};

const activityLabel = (item: ActivityItem) => {
  const kinds = new Set(item.kinds || []);
  if (kinds.has("task.status_changed")) return homeT("activityStatusChanged");
  if (kinds.has("task.assignee_changed")) return homeT("activityAssigneeChanged");
  if (kinds.has("record.created")) return homeT("activityRecordCreated");
  if (kinds.has("comment.created")) return homeT("activityCommentCreated");
  if (kinds.has("record.deleted")) return homeT("activityRecordDeleted");
  return item.summary || homeT("activityRecordUpdated");
};

const recentTypeLabel = (target: RecentTarget) => {
  if (target.entityType === "dashboard") return homeT("recentTypeDashboard");
  if (target.entityType === "record") return homeT("recentTypeRecord");
  return homeT("recentTypeTable");
};

const insightCopy = (insight: HomeRiskInsight) => {
  if (insight.kind === "overdue") {
    return {
      title: homeT("overdueInsightTitle", { count: insight.count }),
      body: homeT("overdueInsightBody", {
        title: insight.task.title,
        table: insight.task.tableName,
      }),
    };
  }
  if (insight.kind === "project-risk") {
    return {
      title: homeT("projectRiskInsightTitle", {
        project: insight.project.tableName,
      }),
      body: homeT("projectRiskInsightBody", {
        overdue: insight.overdueCount,
        blocked: insight.blockedCount,
      }),
    };
  }
  return {
    title: homeT("dueSoonInsightTitle", { count: insight.count }),
    body: homeT("dueSoonInsightBody", {
      title: insight.task.title,
      table: insight.task.tableName,
    }),
  };
};

function SectionFrame({
  id,
  title,
  extra,
  section,
  loading,
  onRetry,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  extra?: ReactNode;
  section?: SectionResult<unknown>;
  loading?: boolean;
  onRetry: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className={`qtable-home-card ${className}`}
    >
      <header className="qtable-home-card-header">
        <Typography.Title level={4}>{title}</Typography.Title>
        {extra}
      </header>
      {loading ? (
        <div
          className="qtable-home-section-skeleton"
          role="status"
          aria-label={homeT("loading")}
        >
          <Skeleton active title={false} paragraph={{ rows: 4 }} />
        </div>
      ) : section?.status === "error" ? (
        <div className="qtable-home-section-error">
          <Alert
            type="warning"
            showIcon
            message={homeT("sectionFailed")}
            description={section.error?.message}
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                {homeT("retry")}
              </Button>
            }
          />
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function TaskRow({ task, onOpen }: { task: MyWorkTask; onOpen: () => void }) {
  const assigneeCount = asList(task.assignees).length;
  const assigneeLabel =
    assigneeCount > 1
      ? homeT("assignedMultiple", { count: assigneeCount })
      : assigneeCount === 1
        ? homeT("assignedMe")
        : homeT("unassigned");

  return (
    <button type="button" className="qtable-home-task-row" onClick={onOpen}>
      <div className="qtable-home-task-main">
        <div className="qtable-home-task-title-line">
          <span className="qtable-home-task-title">{task.title}</span>
          {task.isBlocked ? <Tag color="warning">{homeT("blocked")}</Tag> : null}
          {task.timingBucket === "overdue" && !task.isCompleted ? (
            <Tag color="error">{homeT("overdue")}</Tag>
          ) : null}
        </div>
        <div className="qtable-home-task-meta">
          <span>{task.tableName}</span>
          <span>{assigneeLabel}</span>
          <span>{formatDue(task.dueAt)}</span>
          {task.statusLabel ? <span>{task.statusLabel}</span> : null}
          {task.priority !== null &&
          task.priority !== undefined &&
          task.priority !== "" ? (
            <span>{String(task.priority)}</span>
          ) : null}
        </div>
      </div>
      <div className="qtable-home-task-progress">
        {typeof task.progress === "number" ? (
          <Progress
            percent={Math.max(0, Math.min(100, task.progress))}
            size="small"
            showInfo={false}
          />
        ) : null}
      </div>
      <ArrowRightOutlined className="qtable-home-row-arrow" />
    </button>
  );
}

function RecentCard({
  target,
  favorite,
  onOpen,
  onFavorite,
  onRemove,
}: {
  target: RecentTarget;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onRemove: () => void;
}) {
  const icon =
    target.entityType === "dashboard" ? (
      <DashboardOutlined />
    ) : target.entityType === "record" ? (
      <HistoryOutlined />
    ) : (
      <TableOutlined />
    );

  const menu: MenuProps = {
    items: [
      {
        key: "favorite",
        icon: favorite ? <StarFilled /> : <StarOutlined />,
        label: favorite ? homeT("unfavorite") : homeT("favorite"),
      },
      { key: "remove", danger: true, label: homeT("removeRecent") },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === "favorite") onFavorite();
      if (key === "remove") onRemove();
    },
  };

  return (
    <article className="qtable-home-recent-card">
      <button
        type="button"
        className="qtable-home-recent-open"
        onClick={onOpen}
        aria-label={`${homeT("open")} ${target.title}`}
      >
        <span className="qtable-home-recent-icon">{icon}</span>
        <span className="qtable-home-recent-copy">
          <strong>{target.title}</strong>
          <span>{target.subtitle || recentTypeLabel(target)}</span>
          <small>
            {homeT("visited")} {formatTime(target.visitedAt)}
          </small>
        </span>
      </button>
      <Dropdown menu={menu} trigger={["click"]}>
        <Button
          type="text"
          size="small"
          aria-label={homeT("moreActions")}
          icon={<EllipsisOutlined />}
        />
      </Dropdown>
      {favorite ? <StarFilled className="qtable-home-favorite-mark" /> : null}
    </article>
  );
}

function ProjectRow({
  project,
  onOpen,
}: {
  project: ProjectSummary;
  onOpen: () => void;
}) {
  const risk = project.overdueCount > 0 || project.blockedCount > 0;
  const status = risk
    ? homeT("projectNeedsAttention")
    : project.completionKnown
      ? homeT("projectHealthy")
      : homeT("projectSemanticsIncomplete");
  const statusColor = risk ? "warning" : project.completionKnown ? "success" : "default";

  return (
    <button type="button" className="qtable-home-project-row" onClick={onOpen}>
      <div className="qtable-home-project-topline">
        <strong>{project.tableName}</strong>
        <Tag color={statusColor}>{status}</Tag>
      </div>
      <Progress
        percent={Math.max(0, Math.min(100, project.progress))}
        size="small"
      />
      <div className="qtable-home-project-meta">
        <span>
          {homeT("completed")} {project.completedTasks}/{project.totalTasks}
        </span>
        <span>
          {homeT("overdueCount")} {project.overdueCount}
        </span>
        <span>
          {homeT("blocked")} {project.blockedCount}
        </span>
      </div>
    </button>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const timezone = useMemo(() => resolveTimezone(), []);
  const [taskState, setTaskState] = useState<MyWorkTaskState>("all");
  const [sectionOverrides, setSectionOverrides] =
    useState<Partial<MyWorkSections>>({});
  const [sectionLoading, setSectionLoading] = useState<
    Partial<Record<MyWorkSectionName, boolean>>
  >({});
  const [landingPreference, setLandingPreferenceState] =
    useState<LandingPreference>(() => getLandingPreference());
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => [
    ...getFavoriteTargetKeys(),
  ]);
  const [removeRecentTarget] = useMutation(REMOVE_RECENT_TARGET);

  const { data, loading, error, refetch } = useQuery<{
    myWork: MyWorkPayload;
  }>(MY_WORK_QUERY, {
    variables: {
      sections: ALL_SECTIONS,
      limit: 12,
      cursors: null,
      timezone,
      taskState: "all",
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const baseSections = data?.myWork?.sections || {};
  const section = <K extends keyof MyWorkSections>(
    key: K,
  ): MyWorkSections[K] =>
    (sectionOverrides[key] || baseSections[key]) as MyWorkSections[K];

  const loadSection = async (
    name: MyWorkSectionName,
    nextTaskState = taskState,
  ) => {
    setSectionLoading((current) => ({ ...current, [name]: true }));
    try {
      const result = await client.query<{ myWork: MyWorkPayload }>({
        query: MY_WORK_QUERY,
        variables: {
          sections: [name],
          limit: 12,
          cursors: null,
          timezone,
          taskState: nextTaskState,
        },
        fetchPolicy: "network-only",
      });
      const next = result.data?.myWork?.sections?.[name];
      if (next) {
        setSectionOverrides((current) => ({ ...current, [name]: next }));
      }
    } catch (reason) {
      const failure = {
        status: "error" as const,
        error: {
          code: "CLIENT_SECTION_FAILED",
          message:
            reason instanceof Error ? reason.message : homeT("sectionFailed"),
        },
      };
      setSectionOverrides(
        (current) =>
          ({ ...current, [name]: failure }) as Partial<MyWorkSections>,
      );
    } finally {
      setSectionLoading((current) => ({ ...current, [name]: false }));
    }
  };

  const tasksSection = section("tasks");
  const dueSection = section("due");
  const projectsSection = section("projects");
  const recentSection = section("recent");
  const activitySection = section("activity");
  const kpiSection = section("kpi");

  const tasks = dataOf<TasksSectionData>(tasksSection);
  const due = dataOf<DueSectionData>(dueSection);
  const projects = dataOf<ProjectsSectionData>(projectsSection);
  const recent = dataOf<RecentSectionData>(recentSection);
  const activity = dataOf<ActivitySectionData>(activitySection);
  const kpi = dataOf<KpiSectionData>(kpiSection);
  const riskInsights = useMemo(
    () => buildHomeRiskInsights({ due, projects, kpi }),
    [due, projects, kpi],
  );
  const insightSourceError = [dueSection, projectsSection, kpiSection].some(
    (value) => value?.status === "error",
  );

  const sortedRecent = useMemo(() => {
    const favorites = new Set(favoriteKeys);
    return [...(recent?.items || [])]
      .sort((left, right) => {
        const leftFav = favorites.has(recentTargetKey(left)) ? 1 : 0;
        const rightFav = favorites.has(recentTargetKey(right)) ? 1 : 0;
        if (leftFav !== rightFav) return rightFav - leftFav;
        return String(right.visitedAt || "").localeCompare(
          String(left.visitedAt || ""),
        );
      })
      .slice(0, 6);
  }, [favoriteKeys, recent?.items]);

  const dueItems = useMemo(() => {
    if (!due) return [] as Array<{ bucket: string; item: MyWorkTask }>;
    const seen = new Set<string>();
    const result: Array<{ bucket: string; item: MyWorkTask }> = [];
    (
      [
        [homeT("overdue"), due.overdue?.items || []],
        [homeT("today"), due.today?.items || []],
        [homeT("next24"), due.next24h?.items || []],
      ] as Array<[string, MyWorkTask[]]>
    ).forEach(([bucket, items]) => {
      items.forEach((item) => {
        if (seen.has(item.recordId)) return;
        seen.add(item.recordId);
        result.push({ bucket, item });
      });
    });
    return result.slice(0, 6);
  }, [due]);

  const taskTargetItems: MenuProps["items"] = [
    ...(projects?.items || []).slice(0, 5).map((project) => ({
      key: `project:${project.deepLink}`,
      icon: <ProjectOutlined />,
      label: project.tableName,
    })),
    ...(recent?.items || [])
      .filter((item) => item.entityType === "table")
      .slice(0, 3)
      .map((item) => ({
        key: `recent:${item.deepLink}`,
        icon: <TableOutlined />,
        label: item.title,
      })),
    { type: "divider" },
    { key: "tables", icon: <TableOutlined />, label: homeT("openTables") },
  ];

  const handleTaskState = (value: string | number) => {
    const next = String(value) as MyWorkTaskState;
    setTaskState(next);
    void loadSection("tasks", next);
  };

  const handleRefreshAll = () => {
    setTaskState("all");
    setSectionOverrides({});
    void refetch({
      sections: ALL_SECTIONS,
      limit: 12,
      cursors: null,
      timezone,
      taskState: "all",
    }).catch(() => undefined);
  };

  const handleLandingPreference = (value: string | number) => {
    const next = String(value) as LandingPreference;
    setLandingPreference(next);
    setLandingPreferenceState(next);
  };

  const handleRemoveRecent = async (target: RecentTarget) => {
    try {
      await removeRecentTarget({
        variables: {
          entityType: target.entityType,
          entityId: target.entityId,
          tableId: target.tableId || null,
        },
      });
      message.success(homeT("recentRemoved"));
      await loadSection("recent");
    } catch {
      message.error(homeT("recentRemoveFailed"));
    }
  };

  const isNewUser = Boolean(
    kpi &&
      kpi.myIncompleteCount === 0 &&
      kpi.activeProjectCount === 0 &&
      (tasks?.totalCount || 0) === 0 &&
      (recent?.totalCount || 0) === 0,
  );

  if (error && !data?.myWork) {
    return (
      <div className="qtable-home-page qtable-home-page-error">
        <Alert
          type="error"
          showIcon
          message={homeT("pageFailed")}
          description={error.message}
          action={
            <Button icon={<ReloadOutlined />} onClick={handleRefreshAll}>
              {homeT("retryAll")}
            </Button>
          }
        />
      </div>
    );
  }

  const displayName = user?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="qtable-home-page">
      <header className="qtable-home-hero">
        <div>
          <Typography.Title level={2}>
            {homeT("title")}
            {displayName ? ` · ${displayName}` : ""}
          </Typography.Title>
          <Typography.Paragraph>{homeT("subtitle")}</Typography.Paragraph>
          <div className="qtable-home-scope-hint">{homeT("scopeHint")}</div>
        </div>
        <div className="qtable-home-hero-actions">
          <div className="qtable-home-landing-setting">
            <span>{homeT("landing")}</span>
            <Segmented
              size="small"
              value={landingPreference}
              options={[
                { value: "home", label: homeT("landingHome") },
                { value: "last_workbench", label: homeT("landingLast") },
              ]}
              onChange={handleLandingPreference}
            />
          </div>
          <Tooltip
            title={
              data?.myWork?.generatedAt
                ? `${homeT("refreshed")} ${formatTime(data.myWork.generatedAt)}`
                : homeT("refresh")
            }
          >
            <Button
              icon={<ReloadOutlined />}
              loading={loading && Boolean(data)}
              onClick={handleRefreshAll}
            >
              {homeT("refresh")}
            </Button>
          </Tooltip>
        </div>
      </header>

      {isNewUser ? (
        <section className="qtable-home-onboarding">
          <div className="qtable-home-onboarding-icon">
            <ProjectOutlined />
          </div>
          <div>
            <Typography.Title level={3}>
              {homeT("onboardingTitle")}
            </Typography.Title>
            <Typography.Paragraph>
              {homeT("onboardingBody")}
            </Typography.Paragraph>
          </div>
          <Button type="primary" onClick={() => navigate("/tables")}>
            {homeT("onboardingAction")}
          </Button>
        </section>
      ) : null}

      <SectionFrame
        title=""
        section={kpiSection as SectionResult<unknown>}
        loading={loading && !kpiSection}
        onRetry={() => void loadSection("kpi")}
        className="qtable-home-kpi-frame"
      >
        <div className="qtable-home-kpi-grid">
          {[
            {
              label: homeT("kpiTodo"),
              value: kpi?.myIncompleteCount ?? 0,
              icon: <ClockCircleOutlined />,
            },
            {
              label: homeT("kpiDone"),
              value: kpi?.completedThisWeekCount ?? 0,
              icon: <CheckCircleOutlined />,
            },
            {
              label: homeT("kpiProjects"),
              value: kpi?.activeProjectCount ?? 0,
              icon: <ProjectOutlined />,
            },
            {
              label: homeT("kpiRisk"),
              value: kpi?.overdueOrRiskCount ?? 0,
              icon: <WarningOutlined />,
              danger: Boolean(kpi?.overdueOrRiskCount),
            },
          ].map((item) => (
            <article
              key={item.label}
              className={`qtable-home-kpi${item.danger ? " is-danger" : ""}`}
            >
              <div className="qtable-home-kpi-icon">{item.icon}</div>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            </article>
          ))}
        </div>
      </SectionFrame>

      <div className="qtable-home-grid qtable-home-grid-top">
        <SectionFrame
          title={homeT("tasks")}
          section={tasksSection as SectionResult<unknown>}
          loading={(loading && !tasksSection) || Boolean(sectionLoading.tasks)}
          onRetry={() => void loadSection("tasks")}
          extra={
            <div className="qtable-home-card-actions">
              <Segmented
                size="small"
                value={taskState}
                options={[
                  { value: "all", label: homeT("taskAll") },
                  { value: "in_progress", label: homeT("taskDoing") },
                  { value: "not_started", label: homeT("taskTodo") },
                  { value: "completed", label: homeT("taskDone") },
                ]}
                onChange={handleTaskState}
              />
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: taskTargetItems,
                  onClick: ({ key }) => {
                    const value = String(key);
                    if (value === "tables") {
                      navigate("/tables");
                    } else {
                      navigate(value.slice(value.indexOf(":") + 1));
                    }
                  },
                }}
              >
                <Button type="primary" size="small" icon={<PlusOutlined />}>
                  {homeT("newTask")}
                </Button>
              </Dropdown>
            </div>
          }
        >
          {tasks?.skippedTables?.length ? (
            <Alert
              type="info"
              showIcon
              message={homeT("semanticWarning")}
              className="qtable-home-inline-alert"
            />
          ) : null}
          {tasks?.items?.length ? (
            <div className="qtable-home-list">
              {tasks.items.slice(0, 7).map((task) => (
                <TaskRow
                  key={`${task.tableId}:${task.recordId}`}
                  task={task}
                  onOpen={() => navigate(task.deepLink)}
                />
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={homeT("taskEmpty")}
            />
          )}
        </SectionFrame>

        <SectionFrame
          id={DUE_SECTION_ID}
          title={homeT("due")}
          section={dueSection as SectionResult<unknown>}
          loading={(loading && !dueSection) || Boolean(sectionLoading.due)}
          onRetry={() => void loadSection("due")}
        >
          {dueItems.length ? (
            <div className="qtable-home-due-list">
              {dueItems.map(({ bucket, item }) => (
                <button
                  key={`${bucket}:${item.tableId}:${item.recordId}`}
                  type="button"
                  className="qtable-home-due-row"
                  onClick={() => navigate(item.deepLink)}
                >
                  <span
                    className={`qtable-home-due-dot${
                      bucket === homeT("overdue") ? " is-danger" : ""
                    }`}
                  />
                  <span className="qtable-home-due-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {item.tableName} · {formatDue(item.dueAt)}
                    </small>
                  </span>
                  <Tag
                    color={
                      bucket === homeT("overdue")
                        ? "error"
                        : bucket === homeT("today")
                          ? "warning"
                          : "blue"
                    }
                  >
                    {bucket}
                  </Tag>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={homeT("dueEmpty")}
            />
          )}
        </SectionFrame>
      </div>

      <SectionFrame
        title={homeT("recent")}
        section={recentSection as SectionResult<unknown>}
        loading={(loading && !recentSection) || Boolean(sectionLoading.recent)}
        onRetry={() => void loadSection("recent")}
      >
        {sortedRecent.length ? (
          <div className="qtable-home-recent-grid">
            {sortedRecent.map((target) => {
              const favorite = favoriteKeys.includes(recentTargetKey(target));
              return (
                <RecentCard
                  key={recentTargetKey(target)}
                  target={target}
                  favorite={favorite}
                  onOpen={() => navigate(target.deepLink)}
                  onFavorite={() =>
                    setFavoriteKeys([...toggleFavoriteTarget(target)])
                  }
                  onRemove={() => void handleRemoveRecent(target)}
                />
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={homeT("recentEmpty")}
          />
        )}
      </SectionFrame>

      <div className="qtable-home-grid qtable-home-grid-bottom">
        <SectionFrame
          title={homeT("projects")}
          section={projectsSection as SectionResult<unknown>}
          loading={(loading && !projectsSection) || Boolean(sectionLoading.projects)}
          onRetry={() => void loadSection("projects")}
        >
          {projects?.items?.length ? (
            <div className="qtable-home-project-list">
              {projects.items.slice(0, 5).map((project) => (
                <ProjectRow
                  key={project.tableId}
                  project={project}
                  onOpen={() => navigate(project.deepLink)}
                />
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={homeT("projectsEmpty")}
            />
          )}
        </SectionFrame>

        <SectionFrame
          title={homeT("activity")}
          section={activitySection as SectionResult<unknown>}
          loading={(loading && !activitySection) || Boolean(sectionLoading.activity)}
          onRetry={() => void loadSection("activity")}
        >
          {activity?.items?.length ? (
            <div className="qtable-home-activity-list">
              {activity.items.slice(0, 7).map((item) => (
                <button
                  key={`${item.changeSetId}:${item.entity.id}`}
                  type="button"
                  className="qtable-home-activity-row"
                  onClick={() => navigate(item.deepLink)}
                >
                  <span className="qtable-home-activity-avatar">
                    {(item.actor?.name || "Q").charAt(0).toUpperCase()}
                  </span>
                  <span className="qtable-home-activity-copy">
                    <strong>
                      {item.actor?.name || "QTable"} {activityLabel(item)}
                    </strong>
                    <small>
                      {item.entity.title} · {item.entity.tableName}
                    </small>
                  </span>
                  <time>{formatTime(item.time)}</time>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={homeT("activityEmpty")}
            />
          )}
        </SectionFrame>

        <section
          className="qtable-home-card qtable-home-insights"
          aria-labelledby="qtable-home-insights-title"
        >
          <header className="qtable-home-card-header">
            <Typography.Title id="qtable-home-insights-title" level={4}>
              {homeT("insights")}
            </Typography.Title>
            <WarningOutlined />
          </header>
          <div className="qtable-home-insight-empty">
            <small>{homeT("insightsSource")}</small>
          </div>
          {insightSourceError ? (
            <div className="qtable-home-section-error">
              <Alert
                type="warning"
                showIcon
                message={homeT("insightsPartial")}
                action={
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={handleRefreshAll}
                  >
                    {homeT("retry")}
                  </Button>
                }
              />
            </div>
          ) : null}
          {loading && !data?.myWork ? (
            <div
              className="qtable-home-section-skeleton"
              role="status"
              aria-label={homeT("loading")}
            >
              <Skeleton active title={false} paragraph={{ rows: 3 }} />
            </div>
          ) : riskInsights.items.length ? (
            <div>
              {riskInsights.items.map((insight) => {
                const copy = insightCopy(insight);
                const icon =
                  insight.kind === "overdue" ? (
                    <ExclamationCircleOutlined />
                  ) : insight.kind === "project-risk" ? (
                    <WarningOutlined />
                  ) : (
                    <ClockCircleOutlined />
                  );
                return (
                  <div key={insight.id} className="qtable-home-insight-action">
                    <span className="qtable-home-insight-icon">{icon}</span>
                    <div>
                      <strong>{copy.title}</strong>
                      <p>{copy.body}</p>
                      <small>{homeT("generated")}</small>
                    </div>
                    <Button size="small" onClick={() => navigate(insight.deepLink)}>
                      {homeT("openEvidence")}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : riskInsights.hasUnlocatedRisk ? (
            <div className="qtable-home-insight-empty">
              <WarningOutlined />
              <strong>
                {homeT("insightsUnlocatedTitle", {
                  count: riskInsights.reportedRiskCount,
                })}
              </strong>
              <p>{homeT("insightsUnlocatedBody")}</p>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefreshAll}
              >
                {homeT("refresh")}
              </Button>
            </div>
          ) : (
            <div className="qtable-home-insight-empty">
              <CheckCircleOutlined />
              <strong>{homeT("insightsHealthyTitle")}</strong>
              <p>{homeT("insightsHealthyBody")}</p>
            </div>
          )}
          <div className="qtable-home-insight-empty">
            <p>{homeT("aiOptionalHint")}</p>
            <Button size="small" onClick={() => navigate("/ai")}>
              {homeT("analyzeWithAi")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
