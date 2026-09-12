import { gql } from "@apollo/client";
import type { Field } from "../../store/useSmartTableStore";

export const TASK_PROFILE_QUERY = gql`
  query TaskProfile($tableId: String!) {
    taskProfile(tableId: $tableId)
  }
`;

export const SUGGEST_TASK_PROFILE_QUERY = gql`
  query SuggestTaskProfile($tableId: String!) {
    suggestTaskProfile(tableId: $tableId)
  }
`;

export const UPDATE_TASK_PROFILE = gql`
  mutation UpdateTaskProfile($tableId: String!, $profile: JSON!) {
    updateTaskProfile(tableId: $tableId, profile: $profile)
  }
`;

export const CLEAR_TASK_PROFILE = gql`
  mutation ClearTaskProfile($tableId: String!) {
    clearTaskProfile(tableId: $tableId)
  }
`;

export const TASK_PROFILE_OPEN_EVENT = "qtable:open-task-profile";

export const openTaskProfileSettings = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TASK_PROFILE_OPEN_EVENT));
};

export type TaskProfileFieldKey =
  | "titleFieldId"
  | "statusFieldId"
  | "assigneeFieldId"
  | "priorityFieldId"
  | "startDateFieldId"
  | "dueDateFieldId"
  | "progressFieldId"
  | "parentFieldId"
  | "dependencyFieldId"
  | "workloadFieldId";

export type TaskProfileStatusKey =
  | "completedStatusValues"
  | "blockedStatusValues"
  | "notStartedStatusValues";

export type TaskProfileConfig = {
  schemaVersion: number;
} & Record<TaskProfileFieldKey, string | null> &
  Record<TaskProfileStatusKey, string[]>;

export type TaskProfileIssue = {
  key: TaskProfileFieldKey | TaskProfileStatusKey | string;
  code: string;
  message: string;
  fieldId?: string | null;
};

export type TaskProfilePayload = {
  tableId: string;
  version: number;
  config: TaskProfileConfig;
  valid: boolean;
  issues: TaskProfileIssue[];
  updatedByUserId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TaskProfileSuggestion = {
  config: TaskProfileConfig;
  confidence: Partial<Record<TaskProfileFieldKey, number>>;
  reasons: Partial<Record<TaskProfileFieldKey, string>>;
  requiresConfirmation: boolean;
};

export const EMPTY_TASK_PROFILE: TaskProfileConfig = {
  schemaVersion: 1,
  titleFieldId: null,
  statusFieldId: null,
  assigneeFieldId: null,
  priorityFieldId: null,
  startDateFieldId: null,
  dueDateFieldId: null,
  progressFieldId: null,
  parentFieldId: null,
  dependencyFieldId: null,
  workloadFieldId: null,
  completedStatusValues: [],
  blockedStatusValues: [],
  notStartedStatusValues: [],
};

export const normalizeTaskProfileConfig = (
  config?: Partial<TaskProfileConfig> | null,
): TaskProfileConfig => ({
  ...EMPTY_TASK_PROFILE,
  ...config,
  schemaVersion: 1,
  completedStatusValues: [...(config?.completedStatusValues || [])],
  blockedStatusValues: [...(config?.blockedStatusValues || [])],
  notStartedStatusValues: [...(config?.notStartedStatusValues || [])],
});

const fieldType = (field: Field) => String(field.type || "").toLowerCase();

const ALLOWED_TYPES: Record<TaskProfileFieldKey, Set<string>> = {
  titleFieldId: new Set(["text", "long_text", "textarea", "email", "url", "formula"]),
  statusFieldId: new Set(["select", "single_select"]),
  assigneeFieldId: new Set(["member"]),
  priorityFieldId: new Set(["select", "single_select", "rating", "number"]),
  startDateFieldId: new Set(["date", "datetime"]),
  dueDateFieldId: new Set(["date", "datetime"]),
  progressFieldId: new Set(["progress", "number", "rating"]),
  parentFieldId: new Set(["relation"]),
  dependencyFieldId: new Set(["relation"]),
  workloadFieldId: new Set(["number", "progress", "rating", "duration"]),
};

export const isFieldCompatibleWithSemantic = (
  key: TaskProfileFieldKey,
  field: Field,
) => ALLOWED_TYPES[key].has(fieldType(field));

export const TASK_PROFILE_FIELD_META: Array<{
  key: TaskProfileFieldKey;
  label: string;
  description: string;
  requiredForKanban?: boolean;
}> = [
  {
    key: "titleFieldId",
    label: "记录标题",
    description: "任务、卡片和后续工作台中用于展示记录名称的字段。",
  },
  {
    key: "statusFieldId",
    label: "状态",
    description: "看板列、完成判断、提醒和项目健康度共用的状态字段。",
    requiredForKanban: true,
  },
  {
    key: "assigneeFieldId",
    label: "负责人",
    description: "任务负责人 / 执行人的成员字段。",
  },
  {
    key: "priorityFieldId",
    label: "优先级",
    description: "任务优先级，用于排序、提醒与 AI 规划。",
  },
  {
    key: "startDateFieldId",
    label: "开始日期",
    description: "计划开始时间。",
  },
  {
    key: "dueDateFieldId",
    label: "截止日期",
    description: "计划完成时间，后续到期提醒将直接消费该映射。",
  },
  {
    key: "progressFieldId",
    label: "进度",
    description: "用于项目摘要与任务完成度展示。",
  },
  {
    key: "parentFieldId",
    label: "父任务",
    description: "可选的单值自关联字段，用于任务层级。",
  },
  {
    key: "dependencyFieldId",
    label: "依赖任务",
    description: "可选的多值自关联字段，用于前置依赖。",
  },
  {
    key: "workloadFieldId",
    label: "工作量",
    description: "工时 / 工作量，用于负载规划。",
  },
];

export const TASK_PROFILE_STATUS_META: Array<{
  key: TaskProfileStatusKey;
  label: string;
  description: string;
}> = [
  {
    key: "notStartedStatusValues",
    label: "未开始状态",
    description: "例如：待开始、Backlog、Planned。",
  },
  {
    key: "completedStatusValues",
    label: "完成状态",
    description: "例如：已完成、Done、Closed。",
  },
  {
    key: "blockedStatusValues",
    label: "阻塞状态",
    description: "例如：阻塞、Blocked。",
  },
];

export const fieldTypeLabel = (field: Field) => {
  const type = fieldType(field);
  const labels: Record<string, string> = {
    text: "文本",
    long_text: "长文本",
    textarea: "长文本",
    select: "单选",
    single_select: "单选",
    member: "成员",
    date: "日期",
    datetime: "日期时间",
    progress: "进度",
    number: "数字",
    rating: "评分",
    relation: "关联记录",
    duration: "时长",
    email: "邮箱",
    url: "链接",
    formula: "公式",
  };
  return labels[type] || type || "未知类型";
};
