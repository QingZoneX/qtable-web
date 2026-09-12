import {
  CheckOutlined,
  ControlOutlined,
  EyeOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Tooltip, message } from "antd";
import type { MenuProps } from "antd";
import { useLanguage } from "../../lib/useLanguage";
import { useWorkspaceExperienceMode, type ExperienceMode } from "./useWorkspaceExperienceMode";
import { experienceModeLabel, experienceModeT } from "./experienceModeI18n";
import "./experienceMode.css";

export function ExperienceModeControl({
  workspaceId,
  compact = false,
}: {
  workspaceId?: string | null;
  compact?: boolean;
}) {
  useLanguage();
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
          ? experienceModeT("switchedPersonal", { mode: experienceModeLabel(mode) })
          : experienceModeT("followSaved"),
      );
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : experienceModeT("updateFailed"),
      );
    }
  };

  const changeWorkspaceDefault = async (mode: ExperienceMode) => {
    try {
      await setWorkspaceDefaultMode(mode);
      message.success(
        experienceModeT("workspaceDefaultSaved", { mode: experienceModeLabel(mode) }),
      );
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : experienceModeT("workspaceDefaultFailed"),
      );
    }
  };

  const personalItems: MenuProps["items"] = [
    {
      type: "group",
      label: experienceModeT("myInterface"),
      children: [
        {
          key: "personal:simple",
          icon:
            preference?.userMode === "simple" ? <CheckOutlined /> : <EyeOutlined />,
          label: experienceModeLabel("simple"),
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
          label: experienceModeLabel("advanced"),
          disabled,
        },
        {
          key: "personal:follow",
          icon: preference?.userMode === null ? <CheckOutlined /> : undefined,
          label: experienceModeT("followWorkspace", {
            mode: experienceModeLabel(preference?.workspaceDefaultMode || "simple"),
          }),
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
          label: experienceModeT("workspaceDefault"),
          children: [
            {
              key: "workspace:simple",
              icon:
                preference.workspaceDefaultMode === "simple" ? (
                  <CheckOutlined />
                ) : undefined,
              label: experienceModeT("defaultSimple"),
              disabled,
            },
            {
              key: "workspace:advanced",
              icon:
                preference.workspaceDefaultMode === "advanced" ? (
                  <CheckOutlined />
                ) : undefined,
              label: experienceModeT("defaultAdvanced"),
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
    ? experienceModeT("loadFailed")
    : !persistent
      ? experienceModeT("persistenceUnavailable")
      : effectiveMode === "simple"
        ? experienceModeT("simpleHint")
        : experienceModeT("advancedHint");

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
            aria-label={experienceModeT("aria", { mode: experienceModeLabel(effectiveMode) })}
          >
            <span className="qtable-experience-mode-label">
              {experienceModeLabel(effectiveMode, true)}
            </span>
          </Button>
        </Dropdown>
      </span>
    </Tooltip>
  );
}
