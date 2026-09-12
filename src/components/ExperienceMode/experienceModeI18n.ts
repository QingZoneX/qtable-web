import { getLanguage } from "../../lib/i18nRuntime";
import type { ExperienceMode } from "./useWorkspaceExperienceMode";

const zhCN = {
  simpleShort: "简洁",
  advancedShort: "高级",
  simple: "简洁模式",
  advanced: "高级模式",
  switchedPersonal: "已切换为{mode}，仅影响你的界面",
  followSaved: "已改为跟随工作区默认模式",
  updateFailed: "体验模式更新失败，请稍后重试",
  workspaceDefaultSaved: "工作区默认已设为{mode}",
  workspaceDefaultFailed: "工作区默认模式更新失败",
  myInterface: "我的界面",
  followWorkspace: "跟随工作区（{mode}）",
  workspaceDefault: "工作区默认",
  defaultSimple: "默认简洁模式",
  defaultAdvanced: "默认高级模式",
  loadFailed: "体验偏好加载失败",
  persistenceUnavailable: "当前存储模式不支持持久化偏好",
  simpleHint: "简洁模式：优先展示当前行动，高级能力按需展开",
  advancedHint: "高级模式：直接展示完整配置能力",
  aria: "体验模式：{mode}",
} as const;

const enUS: Record<keyof typeof zhCN, string> = {
  simpleShort: "Simple",
  advancedShort: "Advanced",
  simple: "Simple mode",
  advanced: "Advanced mode",
  switchedPersonal: "Switched to {mode}; this affects only your interface",
  followSaved: "Now following the workspace default experience mode",
  updateFailed: "Failed to update experience mode. Please try again later.",
  workspaceDefaultSaved: "Workspace default set to {mode}",
  workspaceDefaultFailed: "Failed to update workspace default mode",
  myInterface: "My interface",
  followWorkspace: "Follow workspace ({mode})",
  workspaceDefault: "Workspace default",
  defaultSimple: "Default to Simple mode",
  defaultAdvanced: "Default to Advanced mode",
  loadFailed: "Failed to load experience preferences",
  persistenceUnavailable: "The current storage mode does not support persistent preferences",
  simpleHint: "Simple mode prioritizes current actions and reveals advanced capabilities when needed",
  advancedHint: "Advanced mode shows the full configuration surface directly",
  aria: "Experience mode: {mode}",
};

export type ExperienceModeMessageKey = keyof typeof zhCN;

export function experienceModeT(
  key: ExperienceModeMessageKey,
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

export function experienceModeLabel(mode: ExperienceMode, short = false): string {
  if (mode === "advanced") return experienceModeT(short ? "advancedShort" : "advanced");
  return experienceModeT(short ? "simpleShort" : "simple");
}
