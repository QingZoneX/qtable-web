import { productLocaleCompare } from "../../lib/productI18n";
import { settingsT } from "./settingsI18n";

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
    productLocaleCompare(left.name, right.name),
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

export const workspaceRoleLabel = (role?: string | null): string => {
  if (role === "owner") return settingsT("roleOwner");
  if (role === "editor") return settingsT("roleEditor");
  if (role === "viewer") return settingsT("roleViewer");
  return role || settingsT("roleUnknown");
};
