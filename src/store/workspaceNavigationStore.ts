import { create } from "zustand";

const WORKSPACE_STORAGE_KEY = "qtable.workspaceId";

const loadWorkspaceId = () => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const persistWorkspaceId = (workspaceId: string) => {
  if (typeof window === "undefined") return;
  try {
    if (workspaceId) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  } catch {
    // Storage is best-effort; in-memory navigation still works.
  }
};

type WorkspaceNavigationState = {
  workspaceId: string;
  setWorkspaceId: (workspaceId: string) => void;
  resetWorkspaceId: () => void;
};

export const useWorkspaceNavigationStore = create<WorkspaceNavigationState>(
  (set) => ({
    workspaceId: loadWorkspaceId(),
    setWorkspaceId: (workspaceId) => {
      persistWorkspaceId(workspaceId);
      set({ workspaceId });
    },
    resetWorkspaceId: () => {
      persistWorkspaceId("");
      set({ workspaceId: "" });
    },
  }),
);

export const resetWorkspaceNavigation = () =>
  useWorkspaceNavigationStore.getState().resetWorkspaceId();
