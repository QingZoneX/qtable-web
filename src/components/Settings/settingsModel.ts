import { getLanguage } from "../../lib/i18n.ts";

export type WorkspaceSummary = {
  id: string;
  name: string;
};

export type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

export type SettingsWorkspace = WorkspaceSummary & {
  owned: boolean;
};

export const mergeSettingsWorkspaces = (
  payload?: WorkspacesPayload | null,
): SettingsWorkspace[] => {
  const byId = new Map<string, SettingsWorkspace>();
  for (const workspace of payload?.owned || []) {
    if (!workspace.id) continue;
    byId.set(workspace.id, { ...workspace, owned: true });
  }
  for (const workspace of payload?.invited || []) {
    if (!workspace.id || byId.has(workspace.id)) continue;
    byId.set(workspace.id, { ...workspace, owned: false });
  }
  return [...byId.values()].sort((left, right) =>
    left.name.localeCompare(right.name, getLanguage()),
  );
};

export const resolveSettingsWorkspaceId = (
  preferredWorkspaceId: string,
  workspaces: SettingsWorkspace[],
): string => {
  if (workspaces.some((workspace) => workspace.id === preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }
  return workspaces[0]?.id || "";
};

const roleLabels = {
  "zh-CN": {
    owner: "所有者",
    editor: "编辑者",
    viewer: "查看者",
    unknown: "未知",
  },
  "en-US": {
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
    unknown: "Unknown",
  },
} as const;

export const workspaceRoleLabel = (role?: string | null): string => {
  const labels = roleLabels[getLanguage()];
  if (role === "owner") return labels.owner;
  if (role === "editor") return labels.editor;
  if (role === "viewer") return labels.viewer;
  return role || labels.unknown;
};