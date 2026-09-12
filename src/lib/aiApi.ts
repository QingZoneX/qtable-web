import { gql } from "@apollo/client";
import { useAuthStore } from "../store/authStore";
import { apiUrl } from "./apiUrl";
import type { ToolContextState, ToolExecutionTrace } from "./aiToolRouter";

/**
 * 获取当前 Workspace ID（从 localStorage 读取，与 Sidebar 保持一致）
 */
function getWorkspaceId(): string {
  try {
    return localStorage.getItem("qtable.workspaceId") || "";
  } catch {
    return "";
  }
}

/**
 * 构建请求头（包含认证和上下文信息）
 */
function buildRequestHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const workspaceId = getWorkspaceId();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }
  return headers;
}

export const GET_AI_CONFIGS = gql`
  query GetAiConfigs {
    aiConfigs {
      id
      provider
      model
      createdAt
      updatedAt
    }
  }
`;

export const GET_AI_CONFIG = gql`
  query GetAiConfig {
    aiConfig {
      id
      provider
      model
      createdAt
      updatedAt
    }
  }
`;

export const SAVE_AI_CONFIG = gql`
  mutation SaveAiConfig($input: AiConfigInput!) {
    saveAiConfig(input: $input) {
      id
      provider
      model
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_AI_CONFIG = gql`
  mutation DeleteAiConfig($id: ID!) {
    deleteAiConfig(id: $id)
  }
`;

export const GET_CONVERSATIONS = gql`
  query GetConversations {
    conversations {
      id
      title
      createdAt
      updatedAt
      messages {
        id
        role
        content
        tableIds
        createdAt
      }
    }
  }
`;

export const CREATE_CONVERSATION = gql`
  mutation CreateConversation($title: String) {
    createConversation(title: $title) {
      id
      title
      createdAt
      updatedAt
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;

export const DELETE_CONVERSATION = gql`
  mutation DeleteConversation($id: ID!) {
    deleteConversation(id: $id)
  }
`;

export const UPDATE_CONVERSATION = gql`
  mutation UpdateConversation($id: ID!, $title: String!) {
    updateConversation(id: $id, title: $title) {
      id
      title
      createdAt
      updatedAt
      messages {
        id
        role
        content
        tableIds
        createdAt
      }
    }
  }
`;

export const CLEAR_CONVERSATION_MESSAGES = gql`
  mutation ClearConversationMessages($id: ID!) {
    clearConversationMessages(id: $id)
  }
`;

export interface SSEEvent {
  type?: "content" | "result" | "done" | "error";
  content?: string;
  done?: boolean;
  error?: boolean;
  message?: string;
  code?: string;
  status?: "completed" | "requires_confirmation" | "failed";
  answer?: string;
  provider?: string;
  model?: string;
  traceId?: string;
  steps?: number;
  toolCalls?: ToolExecutionTrace[];
  toolContext?: ToolContextState;
  pendingConfirmation?: Record<string, unknown>;
  result?: ChatRunResult;
}

export interface ChatRequest {
  tableId?: string;
  tableIds?: string[];
  model?: string;
  question: string;
  conversationId?: string;
  mode?: 'chat' | 'agent' | 'ask'; // ask 仅用于兼容旧参数
}

export interface ChatRunResult {
  status: "completed" | "requires_confirmation" | "failed";
  answer: string;
  provider?: string;
  model?: string;
  traceId?: string;
  steps?: number;
  toolCalls?: ToolExecutionTrace[];
  toolContext?: ToolContextState;
  pendingConfirmation?: Record<string, unknown>;
  error?: Record<string, unknown> | null;
}

export async function streamAnalyze(params: {
  tableId?: string;
  tableIds?: string[];
  model?: string;
  question: string;
  conversationId?: string;
  mode?: 'chat' | 'agent' | 'ask';
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onResult?: (result: ChatRunResult) => void;
}): Promise<void> {
  const { tableId, tableIds, model, question, conversationId, mode = 'chat', onChunk, onDone, onError, onResult } = params;
  const token = useAuthStore.getState().token;

  if (!token) {
    onError("Unauthorized");
    return;
  }

  // 合并 tableId 和 tableIds
  let allTableIds = tableIds || [];
  if (tableId && !allTableIds.includes(tableId)) {
    allTableIds = [tableId, ...allTableIds];
  }

  try {
    const response = await fetch(apiUrl("/api/ai/chat"), {
      method: "POST",
      headers: buildRequestHeaders(),
      body: JSON.stringify({ tableId, tableIds: allTableIds, model, question, conversationId, mode }),
    });

    if (!response.ok) {
      onError(`Request failed: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("Stream not available");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const data: SSEEvent = JSON.parse(jsonStr);
          if (data.error) {
            onError(data.message || "Unknown error");
            return;
          }
          if (data.type === "result") {
            onResult?.({
              status: data.status || "failed",
              answer: data.answer || "",
              provider: data.provider,
              model: data.model,
              traceId: data.traceId,
              steps: data.steps,
              toolCalls: data.toolCalls,
              toolContext: data.toolContext,
              pendingConfirmation: data.pendingConfirmation,
              error: null,
            });
          }
          if (data.done) {
            onDone();
            return;
          }
          if (data.content) {
            onChunk(data.content);
          }
        } catch {
          // skip invalid JSON
        }
      }
    }
    onDone();
  } catch (err: unknown) {
    onError(err instanceof Error ? err.message : "Network error");
  }
}

export interface AgentRunResponse {
  success: boolean;
  data: Record<string, unknown> | null;
  tableId: string | null;
  message?: string;
  requiresConfirmation?: boolean;
  toolTraceId?: string;
  toolStatus?: "completed" | "requires_confirmation" | "failed";
  toolCalls?: ToolExecutionTrace[];
  toolContext?: ToolContextState;
  pendingConfirmation?: Record<string, unknown>;
  provider?: string;
  model?: string;
  error?: Record<string, unknown> | null;
}

export async function runAgent(params: {
  tableId?: string;
  tableIds?: string[];
  model?: string;
  question: string;
  autoCreate?: boolean;
  conversationId?: string;
}): Promise<AgentRunResponse> {
  const { tableId, tableIds, model, question, autoCreate = false, conversationId } = params;
  const token = useAuthStore.getState().token;

  if (!token) {
    throw new Error("Unauthorized");
  }

  let allTableIds = tableIds || [];
  if (tableId && !allTableIds.includes(tableId)) {
    allTableIds = [tableId, ...allTableIds];
  }

  const response = await fetch(apiUrl("/api/ai/agent"), {
    method: "POST",
    headers: buildRequestHeaders(),
    body: JSON.stringify({ tableId, tableIds: allTableIds, model, question, autoCreate, conversationId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
