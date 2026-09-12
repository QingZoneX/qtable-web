import { useAuthStore } from "../store/authStore";

export type PMPhase =
  | "requirement_analysis"
  | "module_split"
  | "task_tree"
  | "workload_estimate"
  | "member_assignment"
  | "milestone"
  | "gantt"
  | "risk_analysis"
  | "workflow_design"
  | "report";

export type PMPhaseStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "requires_approval";

export const PM_PHASE_LABELS: Record<PMPhase, string> = {
  requirement_analysis: "需求分析",
  module_split: "模块拆分",
  task_tree: "任务树",
  workload_estimate: "工时评估",
  member_assignment: "成员分配",
  milestone: "里程碑",
  gantt: "甘特图",
  risk_analysis: "风险识别",
  workflow_design: "工作流设计",
  report: "项目报告",
};

export const PM_PHASE_ICONS: Record<PMPhase, string> = {
  requirement_analysis: "📋",
  module_split: "🧩",
  task_tree: "🌳",
  workload_estimate: "⏱️",
  member_assignment: "👥",
  milestone: "🏁",
  gantt: "📊",
  risk_analysis: "⚠️",
  workflow_design: "🔄",
  report: "📄",
};

export const PM_PHASE_ORDER: PMPhase[] = [
  "requirement_analysis",
  "module_split",
  "task_tree",
  "workload_estimate",
  "member_assignment",
  "milestone",
  "gantt",
  "risk_analysis",
  "workflow_design",
  "report",
];

export interface PMAgentPhaseInfo {
  phase: PMPhase;
  status: PMPhaseStatus;
  startedAt?: string;
  completedAt?: string;
  data?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export interface PMAgentRunRequest {
  message: string;
  model?: string;
  sessionId?: string;
  conversationId?: string;
  workspaceId?: string;
  projectId?: string;
  tableIds?: string[];
  viewId?: string;
  taskId?: string;
  teamId?: string;
  organizationId?: string;
  workflowDefId?: string;
  agentId?: string;
  locale?: string;
  timezone?: string;
  streamingEnabled?: boolean;
}

export interface PMAgentStatusResponse {
  workflowId: string;
  status: string;
  pmPhase?: PMPhase;
  phaseSequence: PMPhase[];
  completedPhases: number;
  totalPhases: number;
  phaseResults: PMAgentPhaseInfo[];
  requirements?: Record<string, unknown>[];
  modules?: Record<string, unknown>[];
  taskTree?: Record<string, unknown>[];
  workloadEstimates?: Record<string, unknown>[];
  memberAssignments?: Record<string, unknown>[];
  milestones?: Record<string, unknown>[];
  ganttTasks?: Record<string, unknown>[];
  risks?: Record<string, unknown>[];
  projectReport?: Record<string, unknown>;
  finalResponse?: string;
  error?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PMAgentEvent {
  type: string;
  workflowId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type PMAgentEventCallback = (event: PMAgentEvent) => void;

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function runPMAgent(
  request: PMAgentRunRequest,
  onEvent: PMAgentEventCallback,
  signal?: AbortSignal,
): Promise<void> {
  const headers = {
    ...getAuthHeaders(),
    "Accept": "text/event-stream",
  };

  const response = await fetch("/api/pm-agent/run", {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`PM Agent run failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body reader available");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event: PMAgentEvent = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // skip parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getPMAgentStatus(workflowId: string): Promise<PMAgentStatusResponse> {
  const response = await fetch(`/api/pm-agent/status/${workflowId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get PM Agent status: ${response.status}`);
  }

  return response.json();
}

export async function getPMAgentHistory(
  offset = 0,
  limit = 20,
): Promise<{ workflowIds: string[]; total: number; offset: number; limit: number }> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const response = await fetch(`/api/pm-agent/history?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get PM Agent history: ${response.status}`);
  }

  return response.json();
}
