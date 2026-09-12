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
  mode === "advanced" ? "高级模式" : "简洁模式";

export function SettingsCenterPage() {
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
      message.error("启动页偏好未能写入此浏览器，请检查浏览器存储权限");
      return;
    }
    setLandingPreferenceState(value);
    message.success("启动页偏好已保存到此浏览器");
  };

  const handlePersonalMode = async (value: "follow" | ExperienceMode) => {
    try {
      await setPersonalMode(value === "follow" ? null : value);
      message.success(
        value === "follow"
          ? "已改为跟随工作区默认体验模式"
          : `你的界面已切换为${experienceLabel(value)}`,
      );
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : "体验模式更新失败",
      );
    }
  };

  const handleWorkspaceDefault = async (value: ExperienceMode) => {
    try {
      await setWorkspaceDefaultMode(value);
      message.success(`工作区默认已设为${experienceLabel(value)}`);
    } catch (reason) {
      message.error(
        reason instanceof Error ? reason.message : "工作区默认模式更新失败",
      );
    }
  };

  const personalModeValue = experiencePreference?.userMode || "follow";
  const experiencePersistent = experiencePreference?.persistent !== false;

  return (
    <div className="qtable-settings-center">
      <header className="qtable-settings-header">
        <div>
          <Title level={2}>设置</Title>
          <Paragraph type="secondary">
            这里仅收口当前已经真实存在的配置能力。不同设置会明确标注浏览器级或服务端持久化作用域。
          </Paragraph>
        </div>
        <div className="qtable-settings-account" aria-label="当前账号">
          <UserOutlined />
          <div>
            <Text strong>{user?.name || user?.email || "当前用户"}</Text>
            {user?.email ? <Text type="secondary">{user.email}</Text> : null}
          </div>
        </div>
      </header>

      <section className="qtable-settings-section" aria-labelledby="settings-personal-title">
        <div className="qtable-settings-section-title">
          <HomeOutlined />
          <div>
            <Title level={4} id="settings-personal-title">个人偏好</Title>
            <Text type="secondary">启动行为与当前工作区体验模式</Text>
          </div>
        </div>

        <div className="qtable-settings-grid">
          <Card title="启动页" className="qtable-settings-card">
            <Paragraph type="secondary">
              此偏好仅保存在此浏览器，不会同步到其他设备或账号会话。
            </Paragraph>
            <Radio.Group
              value={landingPreference}
              onChange={(event) =>
                handleLandingPreference(event.target.value as LandingPreference)
              }
            >
              <Space direction="vertical">
                <Radio value="home">始终进入 Home</Radio>
                <Radio value="last_workbench">返回最近一次数据工作台</Radio>
              </Space>
            </Radio.Group>
          </Card>

          <Card title="体验模式" className="qtable-settings-card">
            {!workspaceId ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择一个工作区" />
            ) : experienceLoading && !experiencePreference ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : experienceError ? (
              <Alert
                type="error"
                showIcon
                message="体验模式读取失败"
                description={experienceError.message}
                action={<Button onClick={() => void refreshExperience()}>重试</Button>}
              />
            ) : !experiencePersistent ? (
              <Alert
                type="warning"
                showIcon
                message="当前存储后端不支持持久化体验偏好"
                description="为避免制造假保存，本页不会提供不可持久化的修改操作。"
              />
            ) : (
              <Space direction="vertical" size={14} className="qtable-settings-full-width">
                <div>
                  <Text strong>我的界面</Text>
                  <Paragraph type="secondary" className="qtable-settings-help-copy">
                    个人选择由服务端保存；跟随工作区时会采用管理员设置的默认模式。
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
                      <Radio value="simple">简洁模式</Radio>
                      <Radio value="advanced">高级模式</Radio>
                      <Radio value="follow">
                        跟随工作区（{experienceLabel(experiencePreference?.workspaceDefaultMode || "simple")}）
                      </Radio>
                    </Space>
                  </Radio.Group>
                </div>

                <div className="qtable-settings-subsection">
                  <Space size={8} wrap>
                    <Text strong>当前生效</Text>
                    <Tag color={effectiveMode === "advanced" ? "purple" : "blue"}>
                      {experienceLabel(effectiveMode)}
                    </Tag>
                    <Tag>{workspaceRoleLabel(experiencePreference?.role)}</Tag>
                  </Space>
                </div>

                {experiencePreference?.canManageWorkspaceDefault ? (
                  <div className="qtable-settings-subsection">
                    <Text strong>工作区默认模式</Text>
                    <Paragraph type="secondary" className="qtable-settings-help-copy">
                      只有具备管理权限的用户可以修改，保存以后端响应为准。
                    </Paragraph>
                    <Select<ExperienceMode>
                      value={experiencePreference.workspaceDefaultMode}
                      disabled={experienceSaving}
                      onChange={(value) => void handleWorkspaceDefault(value)}
                      options={[
                        { value: "simple", label: "简洁模式" },
                        { value: "advanced", label: "高级模式" },
                      ]}
                      className="qtable-settings-select"
                    />
                  </div>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message="工作区默认模式为只读"
                    description="你可以修改自己的体验模式，但当前角色不能修改工作区默认值。"
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
            <Title level={4} id="settings-workspace-title">Workspace</Title>
            <Text type="secondary">选择当前设置作用域，并进入真实成员管理</Text>
          </div>
        </div>

        <Card className="qtable-settings-card">
          {workspacesLoading && !workspacesData ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : workspacesError ? (
            <Alert
              type="error"
              showIcon
              message="工作区读取失败"
              description={workspacesError.message}
              action={<Button onClick={() => void refetchWorkspaces()}>重试</Button>}
            />
          ) : workspaces.length === 0 ? (
            <Empty description="当前账号没有可访问的工作区" />
          ) : (
            <Space direction="vertical" size={16} className="qtable-settings-full-width">
              <div>
                <Text strong>当前工作区</Text>
                <Paragraph type="secondary" className="qtable-settings-help-copy">
                  切换会更新 QTable 当前工作区上下文，并影响工作区级设置和 AI 请求上下文。
                </Paragraph>
                <Select
                  value={workspaceId || undefined}
                  onChange={setWorkspaceId}
                  options={workspaces.map((item) => ({
                    value: item.id,
                    label: `${item.name}${item.owned ? " · 我的工作区" : " · 已加入"}`,
                  }))}
                  className="qtable-settings-workspace-select"
                  aria-label="选择设置工作区"
                />
              </div>

              <div className="qtable-settings-workspace-summary">
                <div>
                  <Text type="secondary">名称</Text>
                  <Text strong>{workspace?.name || workspaceId}</Text>
                </div>
                <div>
                  <Text type="secondary">当前角色</Text>
                  <Text strong>
                    {membersLoading ? "读取中…" : workspaceRoleLabel(currentRole)}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">成员</Text>
                  <Text strong>{membersLoading ? "读取中…" : `${members.length} 人`}</Text>
                </div>
              </div>

              {membersAccessDenied ? (
                <Alert
                  type="warning"
                  showIcon
                  message="没有权限读取工作区成员"
                  description="成员详情不会展示，也不会提供无效的管理操作。"
                />
              ) : membersError ? (
                <Alert
                  type="error"
                  showIcon
                  message="成员信息读取失败"
                  description={membersError.message}
                  action={<Button onClick={() => void refetchMembers()}>重试</Button>}
                />
              ) : null}

              <div>
                <Button
                  type="primary"
                  disabled={!workspaceId || membersAccessDenied}
                  onClick={() => navigate(`/workspace/${workspaceId}`)}
                >
                  打开成员与权限管理
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
            <Title level={4} id="settings-ai-title">AI / 集成</Title>
            <Text type="secondary">只展示当前真实可保存的 AI 模型配置</Text>
          </div>
        </div>

        <Card className="qtable-settings-card">
          <Space direction="vertical" size={14} className="qtable-settings-full-width">
            <Alert
              type="info"
              showIcon
              icon={<ApiOutlined />}
              message="API Key 不会从服务端回显"
              description="QTable 只读取模型配置的 provider、model 和标识信息；编辑密钥时必须重新输入。"
            />

            {aiConfigsLoading && !aiConfigsData ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : aiConfigsError ? (
              <Alert
                type="error"
                showIcon
                message="AI 模型配置读取失败"
                description={aiConfigsError.message}
                action={<Button onClick={() => void refetchAiConfigs()}>重试</Button>}
              />
            ) : aiConfigs.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="尚未配置 AI 模型"
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
                管理 AI 模型配置
              </Button>
            </div>
          </Space>
        </Card>
      </section>

      <section className="qtable-settings-section" aria-labelledby="settings-about-title">
        <div className="qtable-settings-section-title">
          <InfoCircleOutlined />
          <div>
            <Title level={4} id="settings-about-title">About / Version</Title>
            <Text type="secondary">当前前端构建与开源支持入口</Text>
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
              开源仓库
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
              反馈问题
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
