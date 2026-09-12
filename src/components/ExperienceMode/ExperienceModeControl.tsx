import {
  CheckOutlined,
  ControlOutlined,
  EyeOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Tooltip, message } from "antd";
import type { MenuProps } from "antd";
import { useWorkspaceExperienceMode, type ExperienceMode } from "./useWorkspaceExperienceMode";
import "./experienceMode.css";

const modeLabel = (mode: ExperienceMode) =>
  mode === "advanced" ? "高级" : "简洁";

export function ExperienceModeControl({
  workspaceId,
  compact = false,
}: {
  workspaceId?: string | null;
  compact?: boolean;
}) {
  const {
    preference,
    effectiveMode,
    loading,
    saving,
    error,
    setPersonalMode,
    setWorkspaceDefaultMode,
  } = useWorkspaceExperienceMode(workspaceId);

  const persistent = preference?.persistent !== false;
  const disabled = loading || saving || !persistent || Boolean(error);

  const changePersonalMode = async (mode: ExperienceMode | null) => {
    try {
      await setPersonalMode(mode);
      message.success(
        mode
          ? `已切换为${modeLabel(mode)}模式，仅影响你的界面`
          : "已改为跟随工作区默认模式",
      );
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : "体验模式更新失败，请稍后重试",
      );
    }
  };

  const changeWorkspaceDefault = async (mode: ExperienceMode) => {
    try {
      await setWorkspaceDefaultMode(mode);
      message.success(`工作区默认已设为${modeLabel(mode)}模式`);
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : "工作区默认模式更新失败",
      );
    }
  };

  const personalItems: MenuProps["items"] = [
    {
      type: "group",
      label: "我的界面",
      children: [
        {
          key: "personal:simple",
          icon:
            preference?.userMode === "simple" ? <CheckOutlined /> : <EyeOutlined />,
          label: "简洁模式",
          disabled,
        },
        {
          key: "personal:advanced",
          icon:
            preference?.userMode === "advanced" ? (
              <CheckOutlined />
            ) : (
              <ControlOutlined />
            ),
          label: "高级模式",
          disabled,
        },
        {
          key: "personal:follow",
          icon: preference?.userMode === null ? <CheckOutlined /> : undefined,
          label: `跟随工作区（${modeLabel(preference?.workspaceDefaultMode || "simple")}）`,
          disabled,
        },
      ],
    },
  ];

  const ownerItems: MenuProps["items"] = preference?.canManageWorkspaceDefault
    ? [
        { type: "divider" },
        {
          type: "group",
          label: "工作区默认",
          children: [
            {
              key: "workspace:simple",
              icon:
                preference.workspaceDefaultMode === "simple" ? (
                  <CheckOutlined />
                ) : undefined,
              label: "默认简洁模式",
              disabled,
            },
            {
              key: "workspace:advanced",
              icon:
                preference.workspaceDefaultMode === "advanced" ? (
                  <CheckOutlined />
                ) : undefined,
              label: "默认高级模式",
              disabled,
            },
          ],
        },
      ]
    : [];

  const menu: MenuProps = {
    items: [...personalItems, ...ownerItems],
    onClick: ({ key }) => {
      if (key === "personal:simple") void changePersonalMode("simple");
      if (key === "personal:advanced") void changePersonalMode("advanced");
      if (key === "personal:follow") void changePersonalMode(null);
      if (key === "workspace:simple") void changeWorkspaceDefault("simple");
      if (key === "workspace:advanced") void changeWorkspaceDefault("advanced");
    },
  };

  const unavailableHint = error
    ? "体验偏好加载失败"
    : !persistent
      ? "当前存储模式不支持持久化偏好"
      : effectiveMode === "simple"
        ? "简洁模式：优先展示当前行动，高级能力按需展开"
        : "高级模式：直接展示完整配置能力";

  return (
    <Tooltip title={unavailableHint}>
      <span className="qtable-experience-mode-host">
        <Dropdown menu={menu} trigger={["click"]} placement="bottomRight">
          <Button
            type="text"
            className={`qtable-experience-mode-control${compact ? " is-compact" : ""}`}
            icon={effectiveMode === "simple" ? <EyeOutlined /> : <SettingOutlined />}
            loading={loading || saving}
            disabled={!persistent || Boolean(error)}
            data-experience-mode={effectiveMode}
            aria-label={`体验模式：${modeLabel(effectiveMode)}`}
          >
            <span className="qtable-experience-mode-label">
              {modeLabel(effectiveMode)}
            </span>
          </Button>
        </Dropdown>
      </span>
    </Tooltip>
  );
}
