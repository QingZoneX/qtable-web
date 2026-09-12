export type WorkloadPlanningHistoricalLearning = {
  sampleCount?: number;
  feedbackSampleCount?: number;
  averageHoursPerStoryPoint?: number;
  averageBias?: number;
  notes?: string[];
  examples?: Array<Record<string, unknown>>;
};

export type WorkloadPlanningTask = {
  recordId: string;
  recordVersion: number;
  title: string;
  storyPoints: number;
  p50Hours: number;
  p90Hours: number;
  confidenceScore: number;
  confidenceLevel: "low" | "medium" | "high" | string;
  confidenceRationale?: string;
  summary?: string;
  basis?: {
    context?: Record<string, unknown>;
    formula?: string;
    assumptions?: string[];
    historicalLearning?: WorkloadPlanningHistoricalLearning;
  };
  risks?: Array<{
    title?: string;
    level?: string;
    impact?: string;
    mitigation?: string;
  }>;
  dependencyRecordIds?: string[];
  estimateId: string;
  traceId: string;
};

export type WorkloadPlanningDeadlineRisk = {
  deadline?: string | null;
  availableBusinessDays: number;
  level: "low" | "medium" | "high" | "critical" | string;
  p50SlackDays: number;
  p90SlackDays: number;
};

export type WorkloadPlanningAggregate = {
  taskCount: number;
  totalStoryPoints: number;
  totalWorkP50Hours: number;
  totalWorkP90Hours: number;
  criticalPathP50Hours: number;
  criticalPathP90Hours: number;
  criticalPathRecordIds: string[];
  effectiveParallelStreams: number;
  calendarP50Hours: number;
  calendarP90Hours: number;
  calendarP50Days: number;
  calendarP90Days: number;
  confidenceScore: number;
  topUncertainty: Array<{
    recordId: string;
    title: string;
    spreadHours: number;
    spreadRatio: number;
    confidenceScore: number;
  }>;
  externalDependencies?: Array<{
    recordId: string;
    dependencyRecordId: string;
  }>;
  deadlineRisk?: WorkloadPlanningDeadlineRisk | null;
  calculation?: string;
};

export type WorkloadPlanningPreview = {
  batchId: string;
  tasks: WorkloadPlanningTask[];
  aggregate: WorkloadPlanningAggregate;
  fieldMapping: Record<string, string>;
  schemaAdditions: Array<{
    semantic: string;
    id: string;
    name: string;
    type: string;
    property?: Record<string, unknown> | null;
  }>;
  recordIds: string[];
};

export type WorkloadPlanningApplyResult = {
  batchId: string;
  status: string;
  idempotent: boolean;
  appliedRecordIds: string[];
  changeSetIds: string[];
  fieldMapping: Record<string, string>;
};

export type WorkloadPlanningWhatIfResult = {
  batchId: string;
  base: WorkloadPlanningAggregate;
  scenario: WorkloadPlanningAggregate;
  delta: {
    teamSize: number;
    calendarP50Days: number;
    calendarP90Days: number;
  };
  riskRecordIds: string[];
};

export type WorkloadPlanningFeedbackResult = {
  batchId: string;
  recordId: string;
  estimateId: string;
  status: string;
  actualStoryPoints?: number | null;
  actualHours?: number | null;
  outcomeStatus?: string | null;
  accuracyRating?: number | null;
  feedbackAt?: string | null;
};
