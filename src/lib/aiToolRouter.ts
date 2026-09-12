import { useAuthStore } from "../store/authStore";
import { apiUrl } from "./apiUrl";

export type RouterStatus = "completed" | "requires_confirmation" | "failed";

export interface ToolRetryPolicy {
  maxAttempts?: number;
  backoffMs?: number;
}

export interface ToolContextState {
  sessionId?: string;
  workspaceId?: string;
  tableIds?: string[];
  variables?: Record<string, unknown>;
  toolResults?: Array<Record<string, unknown>>;
  notes?: string[];
  chainDepth?: number;
  retryPolicy?: ToolRetryPolicy;
}

export interface ToolRouterRequest {
  message: string;
  workspaceId?: string;
  tableIds?: string[];
  conversation?: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    name?: string;
  }>;
  toolContext?: ToolContextState;
  allowedSkills?: string[];
  deniedSkills?: string[];
  maxSteps?: number;
  toolLimit?: number;
  confirmed?: boolean;
  locale?: string;
  timezone?: string;
}

export interface ToolExecutionTrace {
  toolCallId: string;
  skillName: string;
  functionName: string;
  arguments: Record<string, unknown>;
  attemptCount: number;
  state: string;
  output?: Record<string, unknown>;
  error?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface RouterUsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ToolRouterResponse {
  status: RouterStatus;
  answer: string;
  provider: string;
  model: string;
  traceId: string;
  steps: number;
  toolCalls: ToolExecutionTrace[];
  toolContext: ToolContextState;
  usage?: RouterUsageInfo;
  pendingConfirmation?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

const TOOL_ROUTER_API_BASE = apiUrl("/api/ai/router");

function buildHeaders(workspaceId?: string): HeadersInit {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Unauthorized");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
  };
}

export async function runToolRouter(request: ToolRouterRequest): Promise<ToolRouterResponse> {
  const response = await fetch(`${TOOL_ROUTER_API_BASE}/run`, {
    method: "POST",
    headers: buildHeaders(request.workspaceId),
    body: JSON.stringify({
      conversation: [],
      toolContext: {
        tableIds: request.tableIds ?? [],
        toolResults: [],
        variables: {},
        notes: [],
        chainDepth: 0,
        retryPolicy: {
          maxAttempts: 2,
          backoffMs: 350,
        },
      },
      maxSteps: 6,
      toolLimit: 12,
      confirmed: false,
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      ...request,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || detail?.code || `Tool router request failed: ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as ToolRouterResponse;
}

export async function confirmToolRouterRun(
  request: ToolRouterRequest,
): Promise<ToolRouterResponse> {
  return runToolRouter({
    ...request,
    confirmed: true,
  });
}

// Example:
// const result = await runToolRouter({
//   message: "帮我查看延期任务，并按负责人汇总",
//   workspaceId: "wkbDefault",
//   tableIds: ["dstDefault"],
//   allowedSkills: ["qtable.record.query"],
// });
