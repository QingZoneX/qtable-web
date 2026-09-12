import { getLanguage } from "../lib/i18nRuntime";

const zhCN = {
  title: "工作区成员 ({count})",
  subtitle: "管理成员角色与协作权限",
  inviteSent: "邀请已发送",
  inviteFailed: "邀请失败",
  shareCopied: "分享链接已复制",
  share: "分享空间",
  invite: "邀请成员",
  leaveWorkspace: "退出工作区",
  leave: "退出",
  noAction: "无操作",
  me: "(我)",
  emailPlaceholder: "成员邮箱",
  roleOwner: "Owner",
  roleEditor: "Editor",
  roleViewer: "Viewer",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  title: "Workspace members ({count})",
  subtitle: "Manage member roles and collaboration permissions",
  inviteSent: "Invitation sent",
  inviteFailed: "Invitation failed",
  shareCopied: "Share link copied",
  share: "Share workspace",
  invite: "Invite member",
  leaveWorkspace: "Leave workspace",
  leave: "Leave",
  noAction: "No actions",
  me: "(me)",
  emailPlaceholder: "Member email",
  roleOwner: "Owner",
  roleEditor: "Editor",
  roleViewer: "Viewer",
};

export type WorkspaceMembersMessageKey = keyof typeof zhCN;

export function workspaceMembersT(
  key: WorkspaceMembersMessageKey,
  variables?: Record<string, string | number>,
): string {
  let value = getLanguage() === "en-US" ? enUS[key] : zhCN[key];
  if (variables) {
    for (const [name, replacement] of Object.entries(variables)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}
