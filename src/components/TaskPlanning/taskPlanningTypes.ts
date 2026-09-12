export type TaskPlanningEstimate = {
  optimisticHours?: number;
  likelyHours?: number;
  pessimisticHours?: number;
  bufferedHours?: number;
};

export type TaskPlanningNode = {
  key: string;
  title: string;
  description?: string;
  objective?: string;
  depth?: number;
  priority?: "low" | "medium" | "high" | "urgent" | string;
  milestone?: string;
  suggestedRole?: string;
  sourceReference?: Record<string, unknown> | null;
  estimate?: TaskPlanningEstimate;
  deliverables: string[];
  acceptanceCriteria: string[];
  requiredSkills?: string[];
  tags?: string[];
  dependsOn?: string[];
  children: TaskPlanningNode[];
};

export type TaskPlanningDependency = {
  predecessorKey: string;
  successorKey: string;
  dependencyType?: string;
  rationale?: string;
};

export type TaskPlanningPlan = {
  goal: string;
  summary: string;
  assumptions?: string[];
  risks?: Array<Record<string, unknown>>;
  root: TaskPlanningNode;
  dependencies: TaskPlanningDependency[];
  mermaid?: string;
  warnings?: string[];
};

export type TaskPlanningDuplicateCandidate = {
  recordId: string;
  title: string;
  score: number;
  reason: string;
  recommendedAction?: "reuse" | "review" | string;
};

export type TaskPlanningPreview = {
  planId: string;
  traceId: string;
  provider: string;
  model: string;
  plan: TaskPlanningPlan;
  fieldMapping: Record<string, string>;
  schemaAdditions: Array<{
    semantic: string;
    id: string;
    name: string;
    type: string;
    options?: Array<Record<string, unknown>> | null;
    property?: Record<string, unknown> | null;
  }>;
  duplicates: Record<string, TaskPlanningDuplicateCandidate[]>;
  sourceFingerprint: string;
  parentTaskId?: string | null;
  selectedRecordIds: string[];
  previousApplication?: {
    planId: string;
    appliedRecords?: Record<string, unknown> | null;
    appliedAt?: string | null;
  } | null;
};

export type TaskPlanningDecisionAction =
  | "create"
  | "reuse"
  | "merge"
  | "skip";

export type TaskPlanningDecision = {
  nodeKey: string;
  action: TaskPlanningDecisionAction;
  recordId?: string | null;
};

export type TaskPlanningApplyResult = {
  planId: string;
  traceId: string;
  status: "applied" | "deduplicated" | string;
  idempotent: boolean;
  reusedPreviousPlanId?: string | null;
  result: {
    recordByNodeKey?: Record<string, string>;
    created?: Array<{
      nodeKey: string;
      recordId: string;
      title?: string;
    }>;
    reused?: Array<Record<string, unknown>>;
    merged?: Array<Record<string, unknown>>;
    skipped?: string[];
    fieldMapping?: Record<string, string>;
    schemaAdditions?: Array<Record<string, unknown>>;
    changeSetId?: string;
    parentTaskId?: string | null;
  };
};
