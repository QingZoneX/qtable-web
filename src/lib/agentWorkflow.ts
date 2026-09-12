import { useAuthStore } from "../store/authStore";

export type WorkflowStatus =
  | "initializing"
  | "planning"
  | "executing"
  | "observing"
  | "awaiting_approval"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "requires_approval";

export interface WorkflowConfig {
  maxSteps?: number;
  maxRetriesPerStep?: number;
  timeoutSeconds?: number;
  requireApprovalForWrite?: boolean;
  parallelToolExecution?: boolean;
  enableStreaming?: boolean;
}

export interface WorkflowRunRequest {
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
  allowedSkills?: string[];
  deniedSkills?: string[];
  config?: WorkflowConfig;
  locale?: string;
  timezone?: string;
}

export interface WorkflowResumeRequest {
  workflowId: string;
  approvalId: string;
  approved: boolean;
}

export interface WorkflowStepInfo {
  stepId: string;
  index: number;
  description: string;
  skillName?: string;
  arguments: Record<string, unknown>;
  status: WorkflowStepStatus;
  dependsOn: string[];
  maxRetries: number;
  retryCount: number;
  retryDelayMs: number;
  requireApproval: boolean;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowPlanInfo {
  planId: string;
  goal: string;
  strategy: string;
  steps: WorkflowStepInfo[];
  reasoning: string;
  createdAt: string;
}

export interface HumanApprovalRequestInfo {
  approvalId: string;
  callId: string;
  skillName: string;
  functionName: string;
  arguments: Record<string, unknown>;
  reason: string;
  preview: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
}

export interface WorkflowEvent {
  type: string;
  workflowId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WorkflowStatusResponse {
  workflowId: string;
  status: WorkflowStatus;
  plan?: WorkflowPlanInfo;
  stepsCompleted: number;
  stepsTotal: number;
  toolCalls: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  pendingApprovals: HumanApprovalRequestInfo[];
  finalResponse?: string;
  error?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

type WorkflowEventCallback = (event: WorkflowEvent) => void;

class AgentWorkflowClient {
  private baseUrl: string;

  constructor(baseUrl = "/api/agent-workflow") {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    try {
      return useAuthStore.getState().token;
    } catch {
      return null;
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async runWorkflow(
    request: WorkflowRunRequest,
    onEvent: WorkflowEventCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/run`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Workflow run failed: ${response.status} ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
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
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as WorkflowEvent;
              if (event.type === "error") {
                onEvent(event);
                return;
              }
              onEvent(event);
              if (
                event.type === "workflow_completed" ||
                event.type === "workflow_failed" ||
                event.type === "requires_approval"
              ) {
                return;
              }
            } catch {
              // skip malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async resumeWorkflow(
    request: WorkflowResumeRequest,
    onEvent: WorkflowEventCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/resume`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Workflow resume failed: ${response.status} ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
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
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as WorkflowEvent;
              if (event.type === "error") {
                onEvent(event);
                return;
              }
              onEvent(event);
              if (
                event.type === "workflow_completed" ||
                event.type === "workflow_failed" ||
                event.type === "requires_approval"
              ) {
                return;
              }
            } catch {
              // skip malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    const response = await fetch(`${this.baseUrl}/status/${workflowId}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Get workflow status failed: ${response.status} ${errorBody}`);
    }

    return response.json();
  }

  async getSessionWorkflows(sessionId: string): Promise<{ sessionId: string; workflowIds: string[] }> {
    const response = await fetch(`${this.baseUrl}/session/${sessionId}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Get session workflows failed: ${response.status} ${errorBody}`);
    }

    return response.json();
  }
}

export const agentWorkflowClient = new AgentWorkflowClient();
