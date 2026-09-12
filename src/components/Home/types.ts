export type MyWorkTaskState = "all" | "in_progress" | "not_started" | "completed";
export type MyWorkSectionName =
  | "tasks"
  | "due"
  | "projects"
  | "recent"
  | "activity"
  | "kpi";

export type PageInfo = {
  offset?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  scannedCount?: number;
};

export type MyWorkTask = {
  recordId: string;
  tableId: string;
  tableName: string;
  workspaceId: string;
  title: string;
  status?: unknown;
  statusLabel?: string | null;
  assignees?: unknown;
  priority?: unknown;
  priorityRank?: number;
  startAt?: unknown;
  dueAt?: unknown;
  progress?: number | null;
  isCompleted?: boolean;
  isBlocked?: boolean;
  isNotStarted?: boolean;
  timingBucket?: string;
  deepLink: string;
};

export type TasksSectionData = {
  items: MyWorkTask[];
  totalCount: number;
  state: MyWorkTaskState;
  skippedTables?: Array<Record<string, unknown>>;
  pageInfo?: PageInfo;
};

export type DueBucket = {
  items: MyWorkTask[];
  totalCount: number;
  pageInfo?: PageInfo;
};

export type DueSectionData = {
  overdue: DueBucket;
  today: DueBucket;
  next24h: DueBucket;
  next3d: DueBucket;
  next7d: DueBucket;
};

export type ProjectSummary = {
  tableId: string;
  tableName: string;
  workspaceId: string;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  progress: number;
  overdueCount: number;
  blockedCount: number;
  completionKnown: boolean;
  deepLink: string;
};

export type ProjectsSectionData = {
  items: ProjectSummary[];
  totalCount: number;
  pageInfo?: PageInfo;
};

export type RecentTarget = {
  entityType: "table" | "dashboard" | "record";
  entityId: string;
  workspaceId?: string | null;
  tableId?: string | null;
  viewId?: string | null;
  title: string;
  subtitle?: string | null;
  deepLink: string;
  visitedAt?: string | null;
};

export type RecentSectionData = {
  items: RecentTarget[];
  totalCount: number;
  pageInfo?: PageInfo;
};

export type ActivityItem = {
  changeSetId: string;
  time?: string | null;
  actor?: {
    id?: number | null;
    type?: string | null;
    name?: string | null;
  } | null;
  entity: {
    type: string;
    id: string;
    title: string;
    tableId: string;
    tableName: string;
    workspaceId: string;
  };
  kinds: string[];
  operation?: string | null;
  summary?: string | null;
  deepLink: string;
};

export type ActivitySectionData = {
  items: ActivityItem[];
  pageInfo?: PageInfo;
};

export type KpiSectionData = {
  myIncompleteCount: number;
  completedThisWeekCount: number;
  activeProjectCount: number;
  overdueOrRiskCount: number;
};

export type SectionResult<T> =
  | { status: "ok"; data: T }
  | {
      status: "error";
      error?: { code?: string; message?: string };
    };

export type MyWorkSections = {
  tasks?: SectionResult<TasksSectionData>;
  due?: SectionResult<DueSectionData>;
  projects?: SectionResult<ProjectsSectionData>;
  recent?: SectionResult<RecentSectionData>;
  activity?: SectionResult<ActivitySectionData>;
  kpi?: SectionResult<KpiSectionData>;
};

export type MyWorkPayload = {
  generatedAt?: string;
  timezone?: string;
  taskState?: MyWorkTaskState;
  sections: MyWorkSections;
  performance?: {
    sectionMs?: Partial<Record<MyWorkSectionName, number>>;
    totalMs?: number;
  };
};
