import {
  ApiOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Card,
  Empty,
  List,
  Radio,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GET_WORKSPACES } from "../../lib/graphql";
import { GET_AI_CONFIGS } from "../../lib/aiApi";
import { useLanguage } from "../../lib/useLanguage";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";
import { useAuthStore } from "../../store/authStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import {
  getLandingPreference,
  setLandingPreference,
  type LandingPreference,
} from "../Home/homePreferences";
import {
  useWorkspaceExperienceMode,
  type ExperienceMode,
} from "../ExperienceMode/useWorkspaceExperienceMode";
import AiConfigModal from "../AiAssistant/AiConfigModal";
import {
  mergeSettingsWorkspaces,
  resolveSettingsWorkspaceId,
  workspaceRoleLabel,
  type WorkspacesPayload,
} from "./settingsModel";
import { settingsT } from "./settingsI18n";
import "./settings.css";

const { Paragraph, Text, Title } = Typography;

type AiConfigItem = {
  id: string;
  provider: string;
  model: string;
  createdAt?: string;
  updatedAt?: string;
};

type AiConfigsQueryData = {
  aiConfigs: AiConfigItem[];
};

const experienceLabel = (mode: ExperienceMode) =>
  mode === "advanced" ? settingsT("advancedMode") : settingsT("simpleMode");

export function SettingsCenterPage() {
  useLanguage();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const preferredWorkspaceId = useWorkspaceNavigationStore(
    (state) => state.workspaceId,
  );
  const setWorkspaceId = useWorkspaceNavigationStore(
    (state) => state.setWorkspaceId,
  );
  const [landingPreference, setLandingPreferenceState] = useState(
    getLandingPreference,
  );
  const [aiConfigOpen, setAiConfigOpen] = useState(false);

  const {
    data: workspacesData,
    loading: workspacesLoading,
    error: workspacesError,
    refetch: refetchWorkspaces,
  } = useQuery<{ workspaces: WorkspacesPayload }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });

  const workspaces = useMemo(
    () => mergeSettingsWorkspaces(workspacesData?.workspaces),
    [workspacesData?.workspaces],
  );
  const workspaceId = resolveSettingsWorkspaceId(
    preferredWorkspaceId,
    workspaces,
  );
  const workspace = workspaces.find((item) => item.id === workspaceId) || null;

  const {
    preference: experiencePreference,
    effectiveMode,
    loading: experienceLoading,
    saving: experienceSaving,
    error: experienceError,
    refresh: refreshExperience,
    setPersonalMode,
    setWorkspaceDefaultMode,
  } = useWorkspaceExperienceMode(workspaceId);

  const {
    members,
    loading: membersLoading,
    error: membersError,
    accessDenied: membersAccessDenied,
    refetch: refetchMembers,
  } = useWorkspaceAccess(workspaceId || undefined);
  const currentRole = members.find((member) => member.email === user?.email)?.role;

  const {
    data: aiConfigsData,
    loading: aiConfigsLoading,
    error: aiConfigsError,
    refetch: refetchAiConfigs,
  } = useQuery<AiConfigsQueryData>(GET_AI_CONFIGS, {
    skip: !token,
    fetchPolicy: "cache-and-network",
  });
  const aiConfigs = aiConfigsData?.aiConfigs || [];

  const handleLandingPreference = (value: LandingPreference) => {
    if (!setLandingPreference(value)) {
      message.error(settingsT("landingSaveFailed"));
      return;
    }
    setLandingPreferenceState(value);
    message.success(settingsT("landingSaved"));
  };

  const handlePersonalMode = async (value: "follow" | ExperienceMode) => {
    try {
      await setPersonalMode(value === "follow" ? null : value);
      message.success(
        value === "follow"
          ? settingsT("followSaved")
          : settingsT("personalModeSaved", { mode: experienceLabel(value) }),
      );
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : settingsT("experienceUpdateFailed"),
      );
    }
  };

  const handleWorkspaceDefault = async (value: ExperienceMode) => {
    try {
      await setWorkspaceDefaultMode(value);
      message.success(settingsT("workspaceDefaultSaved", { mode: experienceLabel(value) }));
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : settingsT("workspaceDefaultFailed"),
      );
    }
  };

  const personalModeValue = experiencePreference?.userMode || "follow";
  const experiencePersistent = experiencePreference?.persistent !== false;

  return (
    <div className="qtable-settings-center">
      <header className="qtable-settings-header">
        <div>
          <Title level={2}>{settingsT("title")}</Title>
          <Paragraph type="secondary">{settingsT("description")}</Paragraph>
        </div>
        <div className="qtable-settings-account" aria-label={settingsT("currentAccount")}>
          <UserOutlined />
          <div>
            <Text strong>{user?.name || user?.email || settingsT("currentUser")}</Text>
            {user?.email ? <Text type="secondary">{user.email}</Text> : null}
          </div>
        </div>
      </header>

      <section className="qtable-settings-section" aria-labelledby="settings-personal-title">
        <div className="qtable-settings-section-title">
          <HomeOutlined />
          <div>
            <Title level={4} id="settings-personal-title">{settingsT("personalTitle")}</Title>
            <Text type="secondary">{settingsT("personalSubtitle")}</Text>
          </div>
        </div>

        <div className="qtable-settings-grid">
          <Card title={settingsT("landingTitle")} className="qtable-settings-card">
            <Paragraph type="secondary">{settingsT("landingHelp")}</Paragraph>
            <Radio.Group
              value={landingPreference}
              onChange={(event) =>
                handleLandingPreference(event.target.value as LandingPreference)
              }
            >
              <Space direction="vertical">
                <Radio value="home">{settingsT("landingHome")}</Radio>
                <Radio value="last_workbench">{settingsT("landingLastWorkbench")}</Radio>
              </Space>
            </Radio.Group>
          </Card>

          <Card title={settingsT("experienceTitle")} className="qtable-settings-card">
            {!workspaceId ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={settingsT("chooseWorkspace")} />
            ) : experienceLoading && !experiencePreference ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : experienceError ? (
              <Alert
                type="error"
                showIcon
                message={settingsT("experienceLoadFailed")}
                description={experienceError.message}
                action={<Button onClick={() => void refreshExperience()}>{settingsT("retry")}</Button>}
              />
            ) : !experiencePersistent ? (
              <Alert
                type="warning"
                showIcon
                message={settingsT("experiencePersistenceUnavailable")}
                description={settingsT("experiencePersistenceHelp")}
              />
            ) : (
              <Space direction="vertical" size={14} className="qtable-settings-full-width">
                <div>
                  <Text strong>{settingsT("myInterface")}</Text>
                  <Paragraph type="secondary" className="qtable-settings-help-copy">
                    {settingsT("myInterfaceHelp")}
                  </Paragraph>
                  <Radio.Group
                    value={personalModeValue}
                    disabled={experienceSaving}
                    onChange={(event) =>
                      void handlePersonalMode(
                        event.target.value as "follow" | ExperienceMode,
                      )
                    }
                  >
                    <Space direction="vertical">
                      <Radio value="simple">{settingsT("simpleMode")}</Radio>
                      <Radio value="advanced">{settingsT("advancedMode")}</Radio>
                      <Radio value="follow">
                        {settingsT("followWorkspace", {
                          mode: experienceLabel(experiencePreference?.workspaceDefaultMode || "simple"),
                        })}
                      </Radio>
                    </Space>
                  </Radio.Group>
                </div>

                <div className="qtable-settings-subsection">
                  <Space size={8} wrap>
                    <Text strong>{settingsT("currentEffective")}</Text>
                    <Tag color={effectiveMode === "advanced" ? "purple" : "blue"}>
                      {experienceLabel(effectiveMode)}
                    </Tag>
                    <Tag>{workspaceRoleLabel(experiencePreference?.role)}</Tag>
                  </Space>
                </div>

                {experiencePreference?.canManageWorkspaceDefault ? (
                  <div className="qtable-settings-subsection">
                    <Text strong>{settingsT("workspaceDefaultMode")}</Text>
                    <Paragraph type="secondary" className="qtable-settings-help-copy">
                      {settingsT("workspaceDefaultHelp")}
                    </Paragraph>
                    <Select<ExperienceMode>
                      value={experiencePreference.workspaceDefaultMode}
                      disabled={experienceSaving}
                      onChange={(value) => void handleWorkspaceDefault(value)}
                      options={[
                        { value: "simple", label: settingsT("simpleMode") },
                        { value: "advanced", label: settingsT("advancedMode") },
                      ]}
                      className="qtable-settings-select"
                    />
                  </div>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message={settingsT("workspaceDefaultReadonly")}
                    description={settingsT("workspaceDefaultReadonlyHelp")}
                  />
                )}
              </Space>
            )}
          </Card>
        </div>
      </section>

      <section className="qtable-settings-section" aria-labelledby="settings-workspace-title">
        <div className="qtable-settings-section-title">
          <TeamOutlined />
          <div>
            <Title level={4} id="settings-workspace-title">{settingsT("workspaceTitle")}</Title>
            <Text type="secondary">{settingsT("workspaceSubtitle")}</Text>
          </div>
        </div>

        <Card className="qtable-settings-card">
          {workspacesLoading && !workspacesData ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : workspacesError ? (
            <Alert
              type="error"
              showIcon
              message={settingsT("workspaceLoadFailed")}
              description={workspacesError.message}
              action={<Button onClick={() => void refetchWorkspaces()}>{settingsT("retry")}</Button>}
            />
          ) : workspaces.length === 0 ? (
            <Empty description={settingsT("noWorkspaces")} />
          ) : (
            <Space direction="vertical" size={16} className="qtable-settings-full-width">
              <div>
                <Text strong>{settingsT("currentWorkspace")}</Text>
                <Paragraph type="secondary" className="qtable-settings-help-copy">
                  {settingsT("currentWorkspaceHelp")}
                </Paragraph>
                <Select
                  value={workspaceId || undefined}
                  onChange={setWorkspaceId}
                  options={workspaces.map((item) => ({
                    value: item.id,
                    label: `${item.name}${item.owned ? ` · ${settingsT("ownedWorkspace")}` : ` · ${settingsT("joinedWorkspace")}`}`,
                  }))}
                  className="qtable-settings-workspace-select"
                  aria-label={settingsT("selectSettingsWorkspace")}
                />
              </div>

              <div className="qtable-settings-workspace-summary">
                <div>
                  <Text type="secondary">{settingsT("name")}</Text>
                  <Text strong>{workspace?.name || workspaceId}</Text>
                </div>
                <div>
                  <Text type="secondary">{settingsT("currentRole")}</Text>
                  <Text strong>
                    {membersLoading ? settingsT("loading") : workspaceRoleLabel(currentRole)}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">{settingsT("members")}</Text>
                  <Text strong>
                    {membersLoading
                      ? settingsT("loading")
                      : settingsT("memberCount", { count: members.length })}
                  </Text>
                </div>
              </div>

              {membersAccessDenied ? (
                <Alert
                  type="warning"
                  showIcon
                  message={settingsT("membersDenied")}
                  description={settingsT("membersDeniedHelp")}
                />
              ) : membersError ? (
                <Alert
                  type="error"
                  showIcon
                  message={settingsT("membersLoadFailed")}
                  description={membersError.message}
                  action={<Button onClick={() => void refetchMembers()}>{settingsT("retry")}</Button>}
                />
              ) : null}

              <div>
                <Button
                  type="primary"
                  disabled={!workspaceId || membersAccessDenied}
                  onClick={() => navigate(`/workspace/${workspaceId}`)}
                >
                  {settingsT("openMembers")}
                </Button>
              </div>
            </Space>
          )}
        </Card>
      </section>

      <section className="qtable-settings-section" aria-labelledby="settings-ai-title">
        <div className="qtable-settings-section-title">
          <RobotOutlined />
          <div>
            <Title level={4} id="settings-ai-title">{settingsT("aiTitle")}</Title>
            <Text type="secondary">{settingsT("aiSubtitle")}</Text>
          </div>
        </div>

        <Card className="qtable-settings-card">
          <Space direction="vertical" size={14} className="qtable-settings-full-width">
            <Alert
              type="info"
              showIcon
              icon={<ApiOutlined />}
              message={settingsT("apiKeyHidden")}
              description={settingsT("apiKeyHiddenHelp")}
            />

            {aiConfigsLoading && !aiConfigsData ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : aiConfigsError ? (
              <Alert
                type="error"
                showIcon
                message={settingsT("aiConfigLoadFailed")}
                description={aiConfigsError.message}
                action={<Button onClick={() => void refetchAiConfigs()}>{settingsT("retry")}</Button>}
              />
            ) : aiConfigs.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={settingsT("aiNotConfigured")}
              />
            ) : (
              <List
                size="small"
                dataSource={aiConfigs}
                renderItem={(config) => (
                  <List.Item>
                    <Space wrap>
                      <Text strong>{config.provider}</Text>
                      <Tag>{config.model}</Tag>
                      <Text type="secondary">ID {config.id.slice(0, 8)}…</Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}

            <div>
              <Button type="primary" onClick={() => setAiConfigOpen(true)}>
                {settingsT("manageAiConfig")}
              </Button>
            </div>
          </Space>
        </Card>
      </section>

      <section className="qtable-settings-section" aria-labelledby="settings-about-title">
        <div className="qtable-settings-section-title">
          <InfoCircleOutlined />
          <div>
            <Title level={4} id="settings-about-title">{settingsT("aboutTitle")}</Title>
            <Text type="secondary">{settingsT("aboutSubtitle")}</Text>
          </div>
        </div>

        <Card className="qtable-settings-card">
          <div className="qtable-settings-about-grid">
            <div>
              <Text type="secondary">QTableUI version</Text>
              <Text code>{__QTABLE_UI_VERSION__}</Text>
            </div>
            <div>
              <Text type="secondary">Build mode</Text>
              <Text code>{import.meta.env.MODE}</Text>
            </div>
          </div>
          <Space wrap className="qtable-settings-links">
            <Typography.Link
              href="https://github.com/QingZoneX/QTableUI"
              target="_blank"
              rel="noreferrer"
            >
              {settingsT("repository")}
            </Typography.Link>
            <Typography.Link
              href="https://github.com/QingZoneX/QTableUI/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              Apache-2.0 License
            </Typography.Link>
            <Typography.Link
              href="https://github.com/QingZoneX/QTableUI/issues"
              target="_blank"
              rel="noreferrer"
            >
              {settingsT("reportIssue")}
            </Typography.Link>
          </Space>
        </Card>
      </section>

      <AiConfigModal
        open={aiConfigOpen}
        onClose={() => setAiConfigOpen(false)}
        onConfigSaved={async () => {
          await refetchAiConfigs();
        }}
      />
    </div>
  );
}
