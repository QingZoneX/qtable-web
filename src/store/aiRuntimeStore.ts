import { create } from "zustand";

// ============================================================
// 1. 意图类型
// ============================================================
export type AgentIntent =
  | "chat"
  | "analyze"
  | "action"
  | "multi_step";

// ============================================================
// 2. Agent 状态机状态
// ============================================================
export type AgentState =
  | "idle"
  | "planning"
  | "preview"
  | "awaiting_confirm"
  | "executing"
  | "observing"
  | "completed"
  | "failed"
  | "stopped";

// ============================================================
// 3. 工具调用记录
// ============================================================
export type ToolCallState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "requires_confirmation";

export interface ToolCallRecord {
  toolCallId: string;
  stepId: string;
  skillName: string;
  functionName: string;
  arguments: Record<string, unknown>;
  state: ToolCallState;
  output?: Record<string, unknown>;
  error?: { code: string; message: string };
  attemptCount: number;
  durationMs: number;
  progress?: number;
  progressMessage?: string;
  timestamp: string;
}

// ============================================================
// 4. 执行计划
// ============================================================
export interface WorkflowStep {
  stepId: string;
  index: number;
  description: string;
  skillName: string;
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "requires_approval";
  dependsOn: string[];
  maxRetries: number;
  retryCount: number;
  requireApproval: boolean;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface WorkflowPlan {
  planId: string;
  goal: string;
  strategy: string;
  reasoning: string;
  steps: WorkflowStep[];
  intent: string;
  intentConfidence: number;
  requiresConfirmation: boolean;
  createdAt: string;
}

// ============================================================
// 5. 预览数据
// ============================================================
export interface RecordChange {
  recordId?: string;
  recordTitle?: string;
  changes: Record<string, unknown>;
  originalValues: Record<string, unknown>;
}

export interface ActionPreview {
  previewId: string;
  stepId: string;
  skillName: string;
  action: "create_record" | "update_record" | "delete_record" | "batch_create" | "batch_update" | "batch_delete" | "custom";
  summary: string;
  affectedCount: number;
  recordChanges: RecordChange[];
  tableId: string;
  tableName?: string;
  isDangerous: boolean;
  dangerReason?: string;
  rawArguments: Record<string, unknown>;
  timestamp: string;
}

// ============================================================
// 6. 确认请求
// ============================================================
export type ConfirmStatus = "pending" | "approved" | "rejected" | "timeout";

export interface ConfirmRequest {
  confirmId: string;
  stepId: string;
  preview: ActionPreview | null;
  status: ConfirmStatus;
  timeoutMs: number;
  createdAt: string;
  resolvedAt?: string;
}

// ============================================================
// 7. 观察记录
// ============================================================
export interface ObservationRecord {
  observationId: string;
  sourceToolCallId: string;
  summary: string;
  insights: string[];
  data: Record<string, unknown>;
  suggestions: string[];
  timestamp: string;
}

// ============================================================
// 8. 意图识别结果
// ============================================================
export interface IntentResult {
  intent: AgentIntent;
  confidence: number;
  reasoning: string;
  requiresConfirmation: boolean;
  suggestedSkills: string[];
}

// ============================================================
// 9. 消息（AI 消息带结构化数据）
// ============================================================
export type AiMessageRole = "user" | "assistant" | "system";

export interface AiMessagePayload {
  intent?: IntentResult;
  plan?: WorkflowPlan;
  toolCalls?: ToolCallRecord[];
  previews?: ActionPreview[];
  confirmRequest?: ConfirmRequest;
  observations?: ObservationRecord[];
}

export interface AiMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  tableIds?: string[];
  payload?: AiMessagePayload;
  createdAt: string;
}

// ============================================================
// 10. 对话
// ============================================================
export interface AiConversation {
  id: string;
  tableId?: string;
  tableIds?: string[];
  title: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 11. Runtime 请求/响应
// ============================================================
export interface RuntimeChatRequest {
  message: string;
  tableId?: string;
  tableIds?: string[];
  model?: string;
  conversationId?: string;
}

export interface RuntimeConfirmRequest {
  confirmId: string;
  approved: boolean;
  tableId?: string;
  tableIds?: string[];
  conversationId?: string;
}

// ============================================================
// 12. 工作区 Layer 可见性
// ============================================================
export type WorkspaceLayerId =
  | "conversation"
  | "reasoning"
  | "tool_calls"
  | "preview"
  | "execution"
  | "approval";

export interface WorkspaceLayerState {
  visible: boolean;
  expanded: boolean;
  badge?: number;
}

export type WorkspaceLayout = Record<WorkspaceLayerId, WorkspaceLayerState>;

// ============================================================
// 13. 执行日志
// ============================================================
export type LogLevel = "info" | "success" | "warning" | "error" | "debug";

export interface ExecutionLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  toolCallId?: string;
  stepId?: string;
  timestamp: string;
  details?: string;
}

// ============================================================
// 14. 长任务信息
// ============================================================
export interface LongTaskInfo {
  taskId: string;
  description: string;
  progress: number;
  progressMessage: string;
  estimatedDurationMs?: number;
  elapsedMs: number;
  startedAt: string;
}

// ============================================================
// 15. 工作区 Tab
// ============================================================
export type WorkspaceTab = "chat" | "plan" | "logs";

// ============================================================
// 16. Store 状态与操作
// ============================================================
export interface AiRuntimeState {
  // ----- 窗口状态 -----
  drawerOpen: boolean;
  drawerWidth: number;

  // ----- 配置 -----
  configStatus: {
    configured: boolean;
    provider: string;
    model: string;
  } | null;

  // ----- 对话 -----
  conversations: AiConversation[];
  currentConversationId: string | null;

  // ----- 数据表 -----
  selectedTableIds: string[];

  // ----- Agent 运行时 -----
  agentState: AgentState;
  activePlan: WorkflowPlan | null;
  toolCalls: Record<string, ToolCallRecord>;
  toolCallsList: ToolCallRecord[];
  previews: ActionPreview[];
  confirmRequests: ConfirmRequest[];
  observations: ObservationRecord[];
  lastIntent: IntentResult | null;

  // ----- 流式状态 -----
  streaming: boolean;
  streamContent: string;
  abortController: AbortController | null;

  // ----- 错误 -----
  error: { code: string; message: string } | null;

  // ----- 工作区 -----
  workspaceLayout: WorkspaceLayout;
  executionLogs: ExecutionLogEntry[];
  longTasks: Record<string, LongTaskInfo>;
  activeTab: WorkspaceTab;

  // ====================================
  // Actions
  // ====================================

  // 窗口
  openDrawer: () => void;
  closeDrawer: () => void;
  setDrawerWidth: (width: number) => void;

  // 配置
  setConfigStatus: (status: AiRuntimeState["configStatus"]) => void;

  // 对话 CRUD
  setConversations: (conversations: AiConversation[]) => void;
  upsertConversation: (conversation: AiConversation) => void;
  removeConversation: (id: string) => void;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: AiMessage) => void;
  updateMessagePayload: (
    conversationId: string,
    messageId: string,
    payload: AiMessagePayload
  ) => void;
  updateMessageContent: (
    conversationId: string,
    messageId: string,
    content: string
  ) => void;
  updateConversationTitle: (id: string, title: string) => void;
  clearCurrentConversation: () => void;

  // 数据表
  setSelectedTableIds: (ids: string[]) => void;
  addSelectedTableId: (id: string) => void;
  removeSelectedTableId: (id: string) => void;

  // ====================================
  // Agent Runtime Actions
  // ====================================
  setAgentState: (state: AgentState) => void;
  setActivePlan: (plan: WorkflowPlan | null) => void;
  upsertToolCall: (call: ToolCallRecord) => void;
  updateToolCallProgress: (
    toolCallId: string,
    progress: number,
    message?: string
  ) => void;
  addPreview: (preview: ActionPreview) => void;
  clearPreviews: () => void;
  addConfirmRequest: (request: ConfirmRequest) => void;
  resolveConfirmRequest: (
    confirmId: string,
    status: "approved" | "rejected"
  ) => void;
  clearConfirmRequests: () => void;
  addObservation: (observation: ObservationRecord) => void;
  setLastIntent: (intent: IntentResult | null) => void;

  // 流式控制
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  resetStreamContent: () => void;
  setAbortController: (ctrl: AbortController | null) => void;
  abort: () => void;

  // 错误
  setError: (error: { code: string; message: string } | null) => void;

  /** 重置运行时状态（每轮对话开始时调用） */
  resetRuntime: () => void;

  // 工作区操作
  setLayerVisible: (layerId: WorkspaceLayerId, visible: boolean) => void;
  toggleLayerExpanded: (layerId: WorkspaceLayerId) => void;
  setLayerExpanded: (layerId: WorkspaceLayerId, expanded: boolean) => void;
  addExecutionLog: (entry: ExecutionLogEntry) => void;
  clearExecutionLogs: () => void;
  upsertLongTask: (task: LongTaskInfo) => void;
  removeLongTask: (taskId: string) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
}

const RIGHT_PANEL_WIDTH_STORAGE_KEY = "qtable.rightPanelWidth";
const RIGHT_PANEL_OPEN_STORAGE_KEY = "qtable.rightPanelOpen";
const RIGHT_PANEL_MIN_WIDTH = 360;
const RIGHT_PANEL_MAX_WIDTH = 760;
const RIGHT_PANEL_DEFAULT_WIDTH = 480;

function clampRightPanelWidth(width: number): number {
  return Math.min(Math.max(width, RIGHT_PANEL_MIN_WIDTH), RIGHT_PANEL_MAX_WIDTH);
}

function loadRightPanelWidth(): number {
  try {
    const raw = Number(localStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw > 0) {
      return clampRightPanelWidth(raw);
    }
  } catch {
    // ignore storage errors
  }
  return RIGHT_PANEL_DEFAULT_WIDTH;
}

function saveRightPanelWidth(width: number): void {
  try {
    localStorage.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(clampRightPanelWidth(width)));
  } catch {
    // ignore storage errors
  }
}

function loadRightPanelOpen(): boolean {
  try {
    return localStorage.getItem(RIGHT_PANEL_OPEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveRightPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(RIGHT_PANEL_OPEN_STORAGE_KEY, String(open));
  } catch {
    // ignore storage errors
  }
}

export const useAiRuntimeStore = create<AiRuntimeState>((set) => ({
  drawerOpen: loadRightPanelOpen(),
  drawerWidth: loadRightPanelWidth(),
  configStatus: null,
  conversations: [],
  currentConversationId: null,
  selectedTableIds: [],
  agentState: "idle",
  activePlan: null,
  toolCalls: {},
  toolCallsList: [],
  previews: [],
  confirmRequests: [],
  observations: [],
  lastIntent: null,
  streaming: false,
  streamContent: "",
  abortController: null,
  error: null,

  workspaceLayout: {
    conversation: { visible: true, expanded: true },
    reasoning: { visible: false, expanded: false },
    tool_calls: { visible: false, expanded: true },
    preview: { visible: false, expanded: true },
    execution: { visible: false, expanded: false },
    approval: { visible: false, expanded: true },
  },
  executionLogs: [],
  longTasks: {},
  activeTab: "chat",

  openDrawer: () =>
    set(() => {
      saveRightPanelOpen(true);
      return { drawerOpen: true };
    }),
  closeDrawer: () =>
    set(() => {
      saveRightPanelOpen(false);
      return { drawerOpen: false };
    }),
  setDrawerWidth: (width) =>
    set(() => {
      const nextWidth = clampRightPanelWidth(width);
      saveRightPanelWidth(nextWidth);
      return { drawerWidth: nextWidth };
    }),

  setConfigStatus: (status) => set({ configStatus: status }),

  setConversations: (conversations) => set({ conversations }),
  upsertConversation: (conversation) =>
    set((state) => {
      const exists = state.conversations.some((item) => item.id === conversation.id);
      if (exists) {
        return {
          conversations: state.conversations.map((item) =>
            item.id === conversation.id ? conversation : item
          ),
        };
      }
      return { conversations: [conversation, ...state.conversations] };
    }),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((item) => item.id !== id),
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
    })),
  setCurrentConversation: (id) =>
    set({ currentConversationId: id, streamContent: "" }),
  addMessage: (conversationId, message) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c
      );
      return { conversations };
    }),
  updateMessagePayload: (conversationId, messageId, payload) =>
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, payload: { ...m.payload, ...payload } } : m
          ),
        };
      });
      return { conversations };
    }),
  updateMessageContent: (conversationId, messageId, content) =>
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content } : m
          ),
        };
      });
      return { conversations };
    }),
  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    })),
  clearCurrentConversation: () =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === state.currentConversationId ? { ...c, messages: [] } : c
      );
      return { conversations, streamContent: "" };
    }),

  setSelectedTableIds: (ids) => set({ selectedTableIds: ids }),
  addSelectedTableId: (id) =>
    set((state) => {
      if (state.selectedTableIds.includes(id)) return state;
      return { selectedTableIds: [...state.selectedTableIds, id] };
    }),
  removeSelectedTableId: (id) =>
    set((state) => ({
      selectedTableIds: state.selectedTableIds.filter((tid) => tid !== id),
    })),

  setAgentState: (agentState) => set({ agentState }),
  setActivePlan: (plan) => set({ activePlan: plan }),
  upsertToolCall: (call) =>
    set((state) => {
      const toolCalls = { ...state.toolCalls, [call.toolCallId]: call };
      const toolCallsList = state.toolCallsList.some((tc) => tc.toolCallId === call.toolCallId)
        ? state.toolCallsList.map((tc) => (tc.toolCallId === call.toolCallId ? call : tc))
        : [...state.toolCallsList, call];
      return { toolCalls, toolCallsList };
    }),
  updateToolCallProgress: (toolCallId, progress, message) =>
    set((state) => {
      const existing = state.toolCalls[toolCallId];
      if (!existing) return state;
      const updated = { ...existing, progress, progressMessage: message || existing.progressMessage };
      return {
        toolCalls: { ...state.toolCalls, [toolCallId]: updated },
        toolCallsList: state.toolCallsList.map((tc) =>
          tc.toolCallId === toolCallId ? updated : tc
        ),
      };
    }),
  addPreview: (preview) =>
    set((state) => ({ previews: [...state.previews, preview] })),
  clearPreviews: () => set({ previews: [] }),
  addConfirmRequest: (request) =>
    set((state) => ({ confirmRequests: [...state.confirmRequests, request] })),
  resolveConfirmRequest: (confirmId, status) =>
    set((state) => ({
      confirmRequests: state.confirmRequests.map((c) =>
        c.confirmId === confirmId
          ? { ...c, status, resolvedAt: new Date().toISOString() }
          : c
      ),
    })),
  clearConfirmRequests: () => set({ confirmRequests: [] }),
  addObservation: (observation) =>
    set((state) => ({ observations: [...state.observations, observation] })),
  setLastIntent: (intent) => set({ lastIntent: intent }),

  setStreaming: (streaming) => set({ streaming }),
  appendStreamContent: (content) =>
    set((state) => ({ streamContent: state.streamContent + content })),
  resetStreamContent: () => set({ streamContent: "" }),
  setAbortController: (ctrl) => set({ abortController: ctrl }),
  abort: () =>
    set((state) => {
      if (state.abortController) {
        state.abortController.abort();
      }
      return { abortController: null, streaming: false };
    }),

  setError: (error) => set({ error }),

  resetRuntime: () =>
    set({
      agentState: "idle",
      activePlan: null,
      toolCalls: {},
      toolCallsList: [],
      previews: [],
      confirmRequests: [],
      observations: [],
      lastIntent: null,
      error: null,
      executionLogs: [],
      longTasks: {},
      workspaceLayout: {
        conversation: { visible: true, expanded: true },
        reasoning: { visible: false, expanded: false },
        tool_calls: { visible: false, expanded: true },
        preview: { visible: false, expanded: true },
        execution: { visible: false, expanded: false },
        approval: { visible: false, expanded: true },
      },
    }),

  setLayerVisible: (layerId, visible) =>
    set((state) => ({
      workspaceLayout: {
        ...state.workspaceLayout,
        [layerId]: {
          ...state.workspaceLayout[layerId],
          visible,
        },
      },
    })),

  toggleLayerExpanded: (layerId) =>
    set((state) => ({
      workspaceLayout: {
        ...state.workspaceLayout,
        [layerId]: {
          ...state.workspaceLayout[layerId],
          expanded: !state.workspaceLayout[layerId].expanded,
        },
      },
    })),

  setLayerExpanded: (layerId, expanded) =>
    set((state) => ({
      workspaceLayout: {
        ...state.workspaceLayout,
        [layerId]: {
          ...state.workspaceLayout[layerId],
          expanded,
        },
      },
    })),

  addExecutionLog: (entry) =>
    set((state) => ({
      executionLogs: [...state.executionLogs, entry],
    })),

  clearExecutionLogs: () => set({ executionLogs: [] }),

  upsertLongTask: (task) =>
    set((state) => ({
      longTasks: { ...state.longTasks, [task.taskId]: task },
    })),

  removeLongTask: (taskId) =>
    set((state) => {
      const longTasks = { ...state.longTasks };
      delete longTasks[taskId];
      return { longTasks };
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
