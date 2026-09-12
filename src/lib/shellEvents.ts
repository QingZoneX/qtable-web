export const GLOBAL_SEARCH_OPEN_EVENT = "qtable:open-global-search";
export const WORKSPACE_MANAGER_OPEN_EVENT = "qtable:open-workspace-manager";

const dispatchShellEvent = (eventName: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
};

export const openGlobalCommandPalette = () =>
  dispatchShellEvent(GLOBAL_SEARCH_OPEN_EVENT);

export const openWorkspaceManager = () =>
  dispatchShellEvent(WORKSPACE_MANAGER_OPEN_EVENT);
