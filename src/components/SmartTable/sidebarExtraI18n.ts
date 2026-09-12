import { getLanguage } from "../../lib/i18nRuntime";

const zhCN = {
  "workspaceContent": "工作区内容",
  "manageWorkspace": "管理工作区",
  "permission.manageDescription": "拥有该文件的所有操作权限",
  "permission.editDescription": "在「只可更新」基础上，还可以编辑和分享文件",
  "permission.updateDescription": "在「只可阅读」基础上，还可以新增和编辑记录",
  "permission.readDescription": "只可查看该文件夹下的内容",
  "itemFallback": "该项",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  "workspaceContent": "Workspace contents",
  "manageWorkspace": "Manage workspaces",
  "permission.manageDescription": "Full access to all operations for this item",
  "permission.editDescription": "Includes update access, plus editing and sharing",
  "permission.updateDescription": "Includes read access, plus creating and editing records",
  "permission.readDescription": "View contents under this folder only",
  "itemFallback": "this item",
};

export type SidebarExtraKey = keyof typeof zhCN;

export function sidebarExtraT(key: SidebarExtraKey): string {
  return getLanguage() === "en-US" ? enUS[key] : zhCN[key];
}
