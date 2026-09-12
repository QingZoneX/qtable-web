import { create } from "zustand";

const RIGHT_PANEL_WIDTH_STORAGE_KEY = "qtable.rightPanelWidth";
const RIGHT_PANEL_OPEN_STORAGE_KEY = "qtable.rightPanelOpen";
const CHAT_MODE_STORAGE_KEY = "qtable.chatMode";
const SELECTED_TABLE_IDS_STORAGE_KEY = "qtable.selectedTableIds";
const SELECTED_MODEL_OVERRIDE_STORAGE_KEY = "qtable.selectedModelOverride";
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

function loadChatMode(): 'chat' | 'agent' {
  try {
    const mode = localStorage.getItem(CHAT_MODE_STORAGE_KEY);
    if (mode === 'chat' || mode === 'agent') {
      return mode;
    }
  } catch {
    // ignore storage errors
  }
  return 'chat';
}

function saveChatMode(mode: 'chat' | 'agent'): void {
  try {
    localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

function loadSelectedTableIds(): string[] {
  try {
    const raw = localStorage.getItem(SELECTED_TABLE_IDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function saveSelectedTableIds(ids: string[]): void {
  try {
    localStorage.setItem(SELECTED_TABLE_IDS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

function loadSelectedModelOverride(): string | null {
  try {
    const model = localStorage.getItem(SELECTED_MODEL_OVERRIDE_STORAGE_KEY);
    if (model && model.length > 0) {
      return model;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveSelectedModelOverride(model: string | null): void {
  try {
    if (model) {
      localStorage.setItem(SELECTED_MODEL_OVERRIDE_STORAGE_KEY, model);
    } else {
      localStorage.removeItem(SELECTED_MODEL_OVERRIDE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export type AiConfigStatus = {
  configured: boolean;
  provider: string;
  model: string;
};

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tableIds?: string[];  // 此消息关联的数据表ID列表
  createdAt: string;
};

/**
 * 对话 - 独立存在，不与数据表绑定。
 * 每条消息通过其 tableIds 字段单独关联当时选中的数据表。
 */
export type AiConversation = {
  id: string;
  /** @deprecated 对话不再绑定数据表，使用消息级 tableIds */
  tableId?: string;
  /** @deprecated 对话不再绑定数据表，使用消息级 tableIds */
  tableIds?: string[];
  title: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
};

export type PendingAction = {
  id: string;
  type: 'create_record' | 'update_record' | 'delete_record';
  data: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executing' | 'completed' | 'failed';
  createdAt: string;
};

type AiAssistantState = {
  drawerOpen: boolean;
  configStatus: AiConfigStatus | null;
  conversations: AiConversation[];
  currentConversationId: string | null;
  streaming: boolean;
  streamContent: string;
  selectedTableIds: string[];
  mode: 'chat' | 'agent'; // CHAT模式或AGENT模式
  selectedModelOverride: string | null; // 用户选择覆盖的模型
  pendingActions: PendingAction[]; // 待确认的操作
  drawerWidth: number;

  openDrawer: () => void;
  closeDrawer: () => void;
  setConfigStatus: (status: AiConfigStatus | null) => void;
  setConversations: (conversations: AiConversation[]) => void;
  upsertConversation: (conversation: AiConversation) => void;
  removeConversation: (id: string) => void;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: AiMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  resetStreamContent: () => void;
  setSelectedTableIds: (ids: string[]) => void;
  addSelectedTableId: (id: string) => void;
  removeSelectedTableId: (id: string) => void;
  clearSelectedTableIds: () => void;
  setMode: (mode: 'chat' | 'agent') => void;
  setSelectedModelOverride: (model: string | null) => void;
  addPendingAction: (action: PendingAction) => void;
  removePendingAction: (actionId: string) => void;
  clearPendingActions: () => void;
  setDrawerWidth: (width: number) => void;
  clearCurrentConversation: () => void;
  updateConversationTitle: (id: string, title: string) => void;
};

export const useAiAssistantStore = create<AiAssistantState>((set) => ({
  drawerOpen: loadRightPanelOpen(),
  configStatus: null,
  conversations: [],
  currentConversationId: null,
  streaming: false,
  streamContent: "",
  selectedTableIds: loadSelectedTableIds(),
  mode: loadChatMode(),
  selectedModelOverride: loadSelectedModelOverride(),
  pendingActions: [],
  drawerWidth: loadRightPanelWidth(),

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
  setConfigStatus: (status) => set({ configStatus: status }),
  setConversations: (conversations) => set({ conversations }),
  upsertConversation: (conversation) =>
    set((state) => {
      const exists = state.conversations.some((item) => item.id === conversation.id);
      if (exists) {
        return {
          conversations: state.conversations.map((item) =>
            item.id === conversation.id ? conversation : item,
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
  setStreaming: (streaming) => set({ streaming }),
  appendStreamContent: (content) =>
    set((state) => ({ streamContent: state.streamContent + content })),
  resetStreamContent: () => set({ streamContent: "" }),
  setSelectedTableIds: (ids) =>
    set(() => {
      saveSelectedTableIds(ids);
      return { selectedTableIds: ids };
    }),
  addSelectedTableId: (id) =>
    set((state) => {
      if (state.selectedTableIds.includes(id)) {
        return state;
      }
      const nextIds = [...state.selectedTableIds, id];
      saveSelectedTableIds(nextIds);
      return { selectedTableIds: nextIds };
    }),
  removeSelectedTableId: (id) =>
    set((state) => {
      const nextIds = state.selectedTableIds.filter((tid) => tid !== id);
      saveSelectedTableIds(nextIds);
      return { selectedTableIds: nextIds };
    }),
  clearSelectedTableIds: () =>
    set(() => {
      saveSelectedTableIds([]);
      return { selectedTableIds: [] };
    }),
  setMode: (mode) =>
    set(() => {
      saveChatMode(mode);
      return { mode };
    }),
  setSelectedModelOverride: (model) =>
    set(() => {
      saveSelectedModelOverride(model);
      return { selectedModelOverride: model };
    }),
  addPendingAction: (action) =>
    set((state) => ({
      pendingActions: [...state.pendingActions, action],
    })),
  removePendingAction: (actionId) =>
    set((state) => ({
      pendingActions: state.pendingActions.filter((a) => a.id !== actionId),
    })),
  clearPendingActions: () => set({ pendingActions: [] }),
  setDrawerWidth: (width) =>
    set(() => {
      const nextWidth = clampRightPanelWidth(width);
      saveRightPanelWidth(nextWidth);
      return { drawerWidth: nextWidth };
    }),
  updateConversationTitle: (id: string, title: string) =>
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
}));
