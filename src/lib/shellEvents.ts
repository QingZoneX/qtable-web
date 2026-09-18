export const GLOBAL_SEARCH_OPEN_EVENT = "qtable:open-global-search";
export const WORKSPACE_MANAGER_OPEN_EVENT = "qtable:open-workspace-manager";
export const ONBOARDING_OPEN_EVENT = "qtable:open-onboarding";

const dispatchShellEvent = (eventName: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
};

export const openGlobalCommandPalette = () =>
  dispatchShellEvent(GLOBAL_SEARCH_OPEN_EVENT);

export const openWorkspaceManager = () =>
  dispatchShellEvent(WORKSPACE_MANAGER_OPEN_EVENT);

// 悬浮入口在 AI 面板打开时会避让，因此帮助中心需要一条独立的重开通道。
export const openOnboardingGuide = () =>
  dispatchShellEvent(ONBOARDING_OPEN_EVENT);
