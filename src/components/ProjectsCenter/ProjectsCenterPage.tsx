import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BulbOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Progress,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GET_WORKSPACES } from "../../lib/graphql";
import { useLanguage } from "../../lib/useLanguage";
import { useAuthStore } from "../../store/authStore";
import { MY_WORK_QUERY } from "../Home/homeGraphql";
import type {
  ActivitySectionData,
  DueSectionData,
  MyWorkPayload,
  MyWorkTask,
  ProjectsSectionData,
  ProjectSummary,
  SectionResult,
  TasksSectionData,
} from "../Home/types";
import { ProjectStewardModal } from "../ProjectSteward/ProjectStewardModal";
import {
  collectProjectRiskTasks,
  latestActivityByTable,
  projectHealth,
  projectMatchesHealth,
  projectSearchMatches,
  type ProjectHealthFilter,
} from "./projectsCenterModel";
import { projectsLocale, projectsT } from "./projectsCenterI18n";
import "./projectsCenter.css";

type WorkspaceSummary = {
  id: string;
  name: string;
};

type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

const PROJECT_WINDOW_LIMIT = 100;

const resolveTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const dataOf = <T,>(section?: SectionResult<T>): T | null =>
  section?.status === "ok" ? section.data : null;

const formatTime = (value?: string | null) => {
  if (!value) return projectsT("time.none");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(projectsLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const sectionErrorText = (section?: SectionResult<unknown>) =>
  section?.status === "error"
    ? section.error?.message || projectsT("section.unavailable")
    : null;

const riskTag = (task: MyWorkTask & { riskKinds: Array<"overdue" | "blocked"> }) => (
  <Space size={4} wrap>
    {task.riskKinds.includes("overdue") ? <Tag color="error">{projectsT("risk.overdue")}</Tag> : null}
    {task.riskKinds.includes("blocked") ? <Tag color="warning">{projectsT("risk.blocked")}</Tag> : null}
  </Space>
);

export function ProjectsCenterPage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const timezone = useMemo(() => resolveTimezone(), []);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<ProjectHealthFilter>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [riskProject, setRiskProject] = useState<ProjectSummary | null>(null);
  const [stewardProject, setStewardProject] = useState<ProjectSummary | null>(null);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<{ myWork: MyWorkPayload }>(MY_WORK_QUERY, {
    variables: {
      sections: ["projects", "activity", "tasks", "due"],
      limit: PROJECT_WINDOW_LIMIT,
      cursors: null,
      timezone,
      taskState: "all",
    },
    skip: !token,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: workspaceData,
    error: workspaceError,
    refetch: refetchWorkspaces,
  } = useQuery<{ workspaces: WorkspacesPayload }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });

  const projectsSection = data?.myWork?.sections?.projects;
  const activitySection = data?.myWork?.sections?.activity;
  const tasksSection = data?.myWork?.sections?.tasks;
  const dueSection = data?.myWork?.sections?.due;
  const projects = dataOf<ProjectsSectionData>(projectsSection);
  const activity = dataOf<ActivitySectionData>(activitySection);
  const tasks = dataOf<TasksSectionData>(tasksSection);
  const due = dataOf<DueSectionData>(dueSection);

  const workspaceNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of [
      ...(workspaceData?.workspaces?.owned || []),
      ...(workspaceData?.workspaces?.invited || []),
    ]) {
      map.set(item.id, item.name);
    }
    return map;
  }, [workspaceData?.workspaces?.invited, workspaceData?.workspaces?.owned]);

  const workspaceOptions = useMemo(() => {
    const seen = new Set<string>();
    return (projects?.items || [])
      .filter((project) => {
        if (seen.has(project.workspaceId)) return false;
        seen.add(project.workspaceId);
        return true;
      })
      .map((project) => ({
        value: project.workspaceId,
        label: workspaceNames.get(project.workspaceId) || projectsT("workspace.fallback", { id: project.workspaceId.slice(0, 8) }),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, projectsLocale()));
  }, [language, projects?.items, workspaceNames]);

  const latestActivity = useMemo(
    () => latestActivityByTable(activity?.items || []),
    [activity?.items],
  );

  const visibleProjects = useMemo(() => {
    return [...(projects?.items || [])]
      .filter((project) =>
        workspaceFilter === "all" ? true : project.workspaceId === workspaceFilter,
      )
      .filter((project) => projectMatchesHealth(project, healthFilter))
      .filter((project) =>
        projectSearchMatches(project, search, workspaceNames.get(project.workspaceId)),
      )
      .sort((left, right) => {
        const leftHealth = projectHealth(left) === "healthy" ? 1 : 0;
        const rightHealth = projectHealth(right) === "healthy" ? 1 : 0;
        if (leftHealth !== rightHealth) return leftHealth - rightHealth;
        const leftActivity = latestActivity.get(left.tableId) || "";
        const rightActivity = latestActivity.get(right.tableId) || "";
        if (leftActivity !== rightActivity) return rightActivity.localeCompare(leftActivity);
        return left.tableName.localeCompare(right.tableName, projectsLocale());
      });
  }, [healthFilter, language, latestActivity, projects?.items, search, workspaceFilter, workspaceNames]);

  const riskTasks = useMemo(
    () =>
      riskProject
        ? collectProjectRiskTasks(riskProject.tableId, tasks?.items || [], due)
        : [],
    [due, riskProject, tasks?.items],
  );

  const refresh = async () => {
    await Promise.allSettled([refetch(), refetchWorkspaces()]);
  };

  if (!token) {
    return (
      <div className="qtable-projects-center-state">
        <Alert type="warning" showIcon message={projectsT("auth.required")} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="qtable-projects-center-state">
        <Alert
          type="error"
          showIcon
          message={projectsT("load.failed")}
          description={error.message}
          action={<Button onClick={() => void refetch()}>{projectsT("common.retry")}</Button>}
        />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="qtable-projects-center-state" role="status" aria-label={projectsT("load.loadingAria")}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  const projectsError = sectionErrorText(projectsSection);
  const generatedAt = data?.myWork?.generatedAt;
  const hasMore = Boolean(projects?.pageInfo?.hasMore);

  return (
    <main className="qtable-projects-center">
      <header className="qtable-projects-center-header">
        <div>
          <Typography.Title level={2}>{projectsT("title")}</Typography.Title>
          <Typography.Text type="secondary">{projectsT("description")}</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
          {projectsT("common.refresh")}
        </Button>
      </header>

      <section className="qtable-projects-center-toolbar" aria-label={projectsT("filter.aria")}>
        <Input
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder={projectsT("filter.search")}
          className="qtable-projects-center-search"
        />
        <Segmented
          value={healthFilter}
          onChange={(value) => setHealthFilter(value as ProjectHealthFilter)}
          options={[
            { label: projectsT("filter.all"), value: "all" },
            { label: projectsT("filter.healthy"), value: "healthy" },
            { label: projectsT("filter.attention"), value: "attention" },
          ]}
        />
        <Select
          value={workspaceFilter}
          onChange={setWorkspaceFilter}
          className="qtable-projects-center-workspace"
          options={[{ value: "all", label: projectsT("filter.allWorkspaces") }, ...workspaceOptions]}
          aria-label={projectsT("filter.workspaceAria")}
        />
      </section>

      <div className="qtable-projects-center-summary">
        <Typography.Text type="secondary">
          {projectsT("summary.counts", {
            total: projects?.totalCount ?? projects?.items?.length ?? 0,
            visible: visibleProjects.length,
          })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {generatedAt ? projectsT("summary.generatedAt", { time: formatTime(generatedAt) }) : projectsT("summary.waiting")}
        </Typography.Text>
      </div>

      {projectsError ? (
        <Alert
          type="error"
          showIcon
          message={projectsT("error.projects")}
          description={projectsError}
          action={<Button size="small" onClick={() => void refetch()}>{projectsT("common.retry")}</Button>}
        />
      ) : null}

      {workspaceError ? (
        <Alert
          type="info"
          showIcon
          message={projectsT("error.workspaceNames")}
          description={projectsT("error.workspaceNamesDescription")}
        />
      ) : null}

      {sectionErrorText(activitySection) ? (
        <Alert
          type="info"
          showIcon
          message={projectsT("error.activity")}
          description={projectsT("error.activityDescription")}
        />
      ) : null}

      {hasMore ? (
        <Alert
          type="warning"
          showIcon
          message={projectsT("window.title", { limit: PROJECT_WINDOW_LIMIT })}
          description={projectsT("window.description")}
        />
      ) : null}

      {!projectsError && visibleProjects.length ? (
        <section className="qtable-projects-center-grid" aria-label={projectsT("list.aria")}>
          {visibleProjects.map((project) => {
            const health = projectHealth(project);
            const activityAt = latestActivity.get(project.tableId);
            const workspaceName = workspaceNames.get(project.workspaceId) || projectsT("workspace.current");
            return (
              <article className="qtable-project-card" key={`${project.workspaceId}:${project.tableId}`}>
                <button
                  type="button"
                  className="qtable-project-card-open"
                  onClick={() => navigate(project.deepLink)}
                  aria-label={projectsT("project.openAria", { name: project.tableName })}
                >
                  <span className="qtable-project-card-title-line">
                    <strong>{project.tableName}</strong>
                    {health === "healthy" ? <Tag color="success">{projectsT("health.healthy")}</Tag> : null}
                    {health === "risk" ? <Tag color="warning">{projectsT("health.risk")}</Tag> : null}
                    {health === "configuration" ? <Tag>{projectsT("health.configuration")}</Tag> : null}
                  </span>
                  <span className="qtable-project-card-workspace">{workspaceName}</span>
                  <Progress
                    percent={Math.max(0, Math.min(100, project.progress))}
                    size="small"
                    status={health === "risk" ? "exception" : "normal"}
                  />
                  <span className="qtable-project-card-counts">
                    <span>{projectsT("count.completed", { completed: project.completedTasks, total: project.totalTasks })}</span>
                    <span>{projectsT("count.incomplete", { count: project.incompleteTasks })}</span>
                    <span>{projectsT("count.overdue", { count: project.overdueCount })}</span>
                    <span>{projectsT("count.blocked", { count: project.blockedCount })}</span>
                  </span>
                  <small>{projectsT("activity.latest", { time: formatTime(activityAt) })}</small>
                </button>

                <div className="qtable-project-card-actions">
                  {project.overdueCount > 0 || project.blockedCount > 0 ? (
                    <Button
                      size="small"
                      danger
                      icon={<ExclamationCircleOutlined />}
                      onClick={() => setRiskProject(project)}
                    >
                      {projectsT("action.risks")}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    icon={<BulbOutlined />}
                    onClick={() => setStewardProject(project)}
                  >
                    {projectsT("action.steward")}
                  </Button>
                  {!project.completionKnown ? (
                    <Button
                      size="small"
                      icon={<ApartmentOutlined />}
                      onClick={() => navigate(project.deepLink)}
                    >
                      {projectsT("action.configure")}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    type="text"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(project.deepLink)}
                  >
                    {projectsT("action.open")}
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ) : !projectsError ? (
        <div className="qtable-projects-center-empty">
          <Empty
            description={
              search.trim() || healthFilter !== "all" || workspaceFilter !== "all"
                ? projectsT("empty.filtered")
                : projectsT("empty.none")
            }
          >
            {!search.trim() && healthFilter === "all" && workspaceFilter === "all" ? (
              <Button onClick={() => navigate("/tables")}>
                {projectsT("empty.configure")}
              </Button>
            ) : null}
          </Empty>
        </div>
      ) : null}

      <Modal
        open={Boolean(riskProject)}
        title={riskProject ? projectsT("riskModal.projectTitle", { name: riskProject.tableName }) : projectsT("riskModal.title")}
        footer={null}
        width={720}
        onCancel={() => setRiskProject(null)}
        destroyOnHidden
      >
        {sectionErrorText(tasksSection) || sectionErrorText(dueSection) ? (
          <Alert
            type="warning"
            showIcon
            message={projectsT("riskModal.incomplete")}
            description={projectsT("riskModal.incompleteDescription")}
            action={riskProject ? <Button onClick={() => navigate(riskProject.deepLink)}>{projectsT("action.open")}</Button> : null}
          />
        ) : riskTasks.length ? (
          <div className="qtable-project-risk-list">
            {riskTasks.map((task) => (
              <button
                type="button"
                key={`${task.tableId}:${task.recordId}`}
                className="qtable-project-risk-row"
                onClick={() => navigate(task.deepLink)}
              >
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.statusLabel || task.tableName}</small>
                </span>
                {riskTag(task)}
                <ArrowRightOutlined />
              </button>
            ))}
          </div>
        ) : (
          <Alert
            type="info"
            showIcon
            message={projectsT("riskModal.summaryOnly")}
            description={projectsT("riskModal.summaryOnlyDescription")}
            action={riskProject ? <Button onClick={() => navigate(riskProject.deepLink)}>{projectsT("action.open")}</Button> : null}
          />
        )}
      </Modal>

      {stewardProject ? (
        <ProjectStewardModal
          open
          workspaceId={stewardProject.workspaceId}
          tableId={stewardProject.tableId}
          onClose={() => setStewardProject(null)}
        />
      ) : null}
    </main>
  );
}
