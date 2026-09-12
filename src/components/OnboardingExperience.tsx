import { useEffect, useMemo, useState } from "react";
import {
  AppstoreAddOutlined,
  BulbOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Space,
  Spin,
  Tooltip,
  Tour,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  CREATE_TABLE,
  CREATE_WORKSPACE,
  GET_WORKSPACE,
  GET_WORKSPACES,
  INSERT_ROWS_WITH_DATA,
} from "../lib/graphql";
import { useAuthStore } from "../store/authStore";
import { GoalWorkspaceModal } from "./GoalWorkspace/GoalWorkspaceModal";
import type { GoalWorkspaceApplyResult } from "./GoalWorkspace/goalWorkspaceTypes";

type WorkspaceSummary = {
  id: string;
  name: string;
  rootId?: string;
};

type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};

type WorkspaceNode = {
  id: string;
  name: string;
  type?: "folder" | "table" | "dashboard";
  defaultViewId?: string | null;
  children?: WorkspaceNode[];
};

type WorkspacePayload = {
  root: WorkspaceNode;
};

type CreatedTable = {
  id: string;
  name?: string;
  defaultViewId?: string | null;
};

const DEMO_TABLE_NAME = "个人博客改版项目";
const DEMO_WORKSPACE_NAME = "QTable 体验空间";
const PROJECT_TEMPLATE_ID = "project_management";

const hasWorkspaceContent = (root?: WorkspaceNode | null): boolean => {
  if (!root) return false;
  if (root.type === "table" || root.type === "dashboard") return true;
  return (root.children || []).some((child) => hasWorkspaceContent(child));
};

const findDemoTable = (root?: WorkspaceNode | null): WorkspaceNode | null => {
  if (!root) return null;
  if (root.type === "table" && root.name === DEMO_TABLE_NAME) return root;
  for (const child of root.children || []) {
    const found = findDemoTable(child);
    if (found) return found;
  }
  return null;
};

const buildDemoRows = () => {
  const today = dayjs().startOf("day");
  const date = (offset: number) => today.add(offset, "day").format("YYYY-MM-DD");
  return [
    { f1: "确认改版目标与成功指标", f2: "opt3", f4: 100, f5: 5, f6: date(-7), f7: date(-6) },
    { f1: "梳理现有内容与信息架构", f2: "opt3", f4: 100, f5: 4, f6: date(-6), f7: date(-4) },
    { f1: "确定首页视觉方向", f2: "opt2", f4: 70, f5: 5, f6: date(-3), f7: date(1) },
    { f1: "重构首页 Hero 与导航", f2: "opt2", f4: 45, f5: 5, f6: date(-1), f7: date(3) },
    { f1: "优化文章列表与标签筛选", f2: "opt2", f4: 30, f5: 4, f6: date(1), f7: date(5) },
    { f1: "补齐文章详情响应式样式", f2: "opt1", f4: 0, f5: 4, f6: date(3), f7: date(7) },
    { f1: "优化图片与首屏加载性能", f2: "opt1", f4: 0, f5: 5, f6: date(5), f7: date(8) },
    { f1: "增加 SEO 与分享元信息", f2: "opt1", f4: 0, f5: 3, f6: date(6), f7: date(9) },
    { f1: "完成多端回归测试", f2: "opt1", f4: 0, f5: 5, f6: date(8), f7: date(11) },
    { f1: "上线并复盘改版效果", f2: "opt1", f4: 0, f5: 4, f6: date(12), f7: date(14) },
  ];
};

export function OnboardingExperience() {
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [preparingGoal, setPreparingGoal] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalTarget, setGoalTarget] = useState<{
    workspaceId: string;
    parentId: string;
  } | null>(null);
  const [progressText, setProgressText] = useState("");

  const storageKey = useMemo(
    () => `qtable.onboarding.v1.${user?.id ?? user?.email ?? "anonymous"}`,
    [user?.email, user?.id],
  );
  const tourStorageKey = `${storageKey}.tourPending`;

  const {
    data: workspaceListData,
    loading: workspaceListLoading,
    refetch: refetchWorkspaces,
  } = useQuery<{ workspaces: WorkspacesPayload }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "network-only",
  });

  const ownedWorkspaces = workspaceListData?.workspaces?.owned || [];
  const preferredWorkspace = ownedWorkspaces[0];

  const {
    data: workspaceData,
    loading: workspaceLoading,
  } = useQuery<{ workspace: WorkspacePayload }>(GET_WORKSPACE, {
    variables: { workspaceId: preferredWorkspace?.id },
    skip: !token || !preferredWorkspace?.id,
    fetchPolicy: "network-only",
  });

  const [createWorkspace] = useMutation(CREATE_WORKSPACE);
  const [createTable] = useMutation(CREATE_TABLE);
  const [insertRows] = useMutation(INSERT_ROWS_WITH_DATA);

  useEffect(() => {
    if (!token || workspaceListLoading) return;
    if (preferredWorkspace && workspaceLoading) return;
    if (localStorage.getItem(storageKey)) return;

    const root = workspaceData?.workspace?.root;
    if (!preferredWorkspace || !hasWorkspaceContent(root)) {
      setOpen(true);
    }
  }, [
    preferredWorkspace,
    storageKey,
    token,
    workspaceData?.workspace?.root,
    workspaceListLoading,
    workspaceLoading,
  ]);

  useEffect(() => {
    if (!token) return;
    if (localStorage.getItem(tourStorageKey) !== "true") return;
    localStorage.removeItem(tourStorageKey);
    setTourOpen(true);
  }, [token, tourStorageKey]);

  const persistState = (state: "completed" | "skipped") => {
    localStorage.setItem(storageKey, state);
  };

  const handleSkip = () => {
    persistState("skipped");
    setOpen(false);
  };

  const handleGoalStart = async () => {
    if (preparingGoal) return;
    setPreparingGoal(true);
    try {
      let targetWorkspace: WorkspaceSummary | undefined = preferredWorkspace;
      let root = workspaceData?.workspace?.root || null;

      if (!targetWorkspace) {
        const workspaceResult = await createWorkspace({
          variables: { name: "我的 QTable 空间" },
        });
        targetWorkspace = (
          workspaceResult as unknown as {
            data?: { createWorkspace?: WorkspaceSummary };
          }
        ).data?.createWorkspace;

        if (!targetWorkspace?.id) {
          throw new Error("workspace-create-failed");
        }

        localStorage.setItem("qtable.workspaceId", targetWorkspace.id);
        root = await fetchWorkspaceRoot(targetWorkspace.id);
        await refetchWorkspaces();
      }

      if (!targetWorkspace?.id) {
        throw new Error("workspace-unavailable");
      }

      if (!root) {
        root = await fetchWorkspaceRoot(targetWorkspace.id);
      }

      const parentId = root?.id || targetWorkspace.rootId;
      if (!parentId) {
        throw new Error("workspace-root-unavailable");
      }

      localStorage.setItem("qtable.workspaceId", targetWorkspace.id);
      setGoalTarget({
        workspaceId: targetWorkspace.id,
        parentId,
      });
      setOpen(false);
      setGoalOpen(true);
    } catch {
      message.error("无法准备目标驱动创建所需的工作空间，请稍后重试。");
    } finally {
      setPreparingGoal(false);
    }
  };

  const handleTemplateStart = () => {
    persistState("completed");
    setOpen(false);
    navigate("/");
    message.info("请点击左侧“+”，选择“从模板创建”开始。");
  };

  const fetchWorkspaceRoot = async (workspaceId: string) => {
    const result = await apollo.query<{ workspace: WorkspacePayload }>({
      query: GET_WORKSPACE,
      variables: { workspaceId },
      fetchPolicy: "network-only",
    });
    return result.data?.workspace?.root || null;
  };

  const openTable = (table: CreatedTable) => {
    navigate(`/workbench/${table.id}/${table.defaultViewId || "v1"}`);
  };

  const scheduleTourAfterNavigation = () => {
    localStorage.setItem(tourStorageKey, "true");
  };

  const handleCreateDemo = async () => {
    if (creatingDemo) return;
    setCreatingDemo(true);
    setProgressText("正在准备体验空间…");

    let createdTable: CreatedTable | null = null;
    try {
      let targetWorkspace: WorkspaceSummary | undefined = preferredWorkspace;
      let root = workspaceData?.workspace?.root || null;

      if (!targetWorkspace) {
        const workspaceResult = await createWorkspace({
          variables: { name: DEMO_WORKSPACE_NAME },
        });
        targetWorkspace = (
          workspaceResult as unknown as {
            data?: { createWorkspace?: WorkspaceSummary };
          }
        ).data?.createWorkspace;

        if (!targetWorkspace?.id) {
          throw new Error("workspace-create-failed");
        }

        localStorage.setItem("qtable.workspaceId", targetWorkspace.id);
        setProgressText("正在初始化工作区…");
        root = await fetchWorkspaceRoot(targetWorkspace.id);
        await refetchWorkspaces();
      }

      if (!targetWorkspace?.id) {
        throw new Error("workspace-unavailable");
      }

      if (!root) {
        root = await fetchWorkspaceRoot(targetWorkspace.id);
      }

      const existingDemo = findDemoTable(root);
      if (existingDemo) {
        persistState("completed");
        setOpen(false);
        scheduleTourAfterNavigation();
        openTable({
          id: existingDemo.id,
          defaultViewId: existingDemo.defaultViewId,
        });
        message.success("已打开你的 QTable Demo 项目");
        return;
      }

      const parentId = root?.id || targetWorkspace.rootId;
      if (!parentId) {
        throw new Error("workspace-root-unavailable");
      }

      setProgressText("正在创建项目管理表…");
      const tableResult = await createTable({
        variables: {
          name: DEMO_TABLE_NAME,
          parentId,
          workspaceId: targetWorkspace.id,
          templateId: PROJECT_TEMPLATE_ID,
        },
      });

      createdTable = (
        tableResult as unknown as { data?: { createTable?: CreatedTable } }
      ).data?.createTable || null;

      if (!createdTable?.id) {
        throw new Error("table-create-failed");
      }

      localStorage.setItem("qtable.workspaceId", targetWorkspace.id);
      localStorage.setItem(
        `${storageKey}.demoTableId`,
        createdTable.id,
      );

      setProgressText("正在写入示例任务…");
      await insertRows({
        variables: {
          tableId: createdTable.id,
          recordsData: buildDemoRows(),
        },
      });

      persistState("completed");
      setOpen(false);
      scheduleTourAfterNavigation();
      openTable(createdTable);
      message.success("Demo 已创建：你现在看到的是真实可编辑的 QTable 项目");
    } catch {
      if (createdTable?.id) {
        persistState("completed");
        setOpen(false);
        scheduleTourAfterNavigation();
        openTable(createdTable);
        message.warning(
          "Demo 表已经创建，但示例任务写入失败。表本身仍可正常编辑，不会重复创建。",
        );
      } else {
        message.error("Demo 创建失败，请稍后重试。不会覆盖你已有的数据。");
      }
    } finally {
      setCreatingDemo(false);
      setProgressText("");
    }
  };

  const tourSteps = [
    {
      title: "1. 一个项目，多种工作视角",
      description:
        "同一批任务可以在表格、看板、甘特和日历之间切换，不需要维护多份数据。",
    },
    {
      title: "2. 每一行都是可执行任务",
      description:
        "状态、优先级、进度和日期都可以直接编辑。先把真实工作放进来，再逐步增加高级配置。",
    },
    {
      title: "3. AI 应该理解项目，而不是只生成文字",
      description:
        "后续可以从任务拆解、工作量估算到项目诊断，逐步把 AI 变成项目助手。",
    },
    {
      title: "4. 现在就动手改一条",
      description:
        "建议先把一条示例任务改成你自己的真实任务，或者切换到看板看看同一份数据的不同视角。",
    },
  ];

  if (!token) return null;

  return (
    <>
      {!open && (
        <Tooltip title="重新打开新手引导">
          <Button
            aria-label="重新打开新手引导"
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={() => setOpen(true)}
            style={{
              position: "fixed",
              right: 24,
              bottom: 24,
              zIndex: 900,
              boxShadow: "0 6px 20px rgba(15, 23, 42, 0.12)",
            }}
          />
        </Tooltip>
      )}

      <Modal
        open={open}
        onCancel={handleSkip}
        footer={
          <Button type="text" onClick={handleSkip} disabled={creatingDemo || preparingGoal}>
            暂时跳过
          </Button>
        }
        width={820}
        maskClosable={!creatingDemo && !preparingGoal}
        closable={!creatingDemo && !preparingGoal}
        title={
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              欢迎使用 QTable
            </Typography.Title>
            <Typography.Text type="secondary">
              不需要先学习“多维表格怎么配置”，先选择你想完成的事情。
            </Typography.Text>
          </div>
        }
      >
        <Alert
          type="info"
          showIcon
          message="目标：3 分钟内得到一个可以真正编辑和继续工作的项目"
          style={{ marginBottom: 18 }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <Card
            hoverable
            onClick={() => void handleGoalStart()}
            styles={{ body: { padding: 18 } }}
          >
            <Space orientation="vertical" size={10}>
              <RocketOutlined style={{ fontSize: 26, color: "#2563eb" }} />
              <Typography.Text strong>描述我的目标</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                例如“我要做一个 3 人参与的博客改版项目”，后续由 AI 自动设计工作结构。
              </Typography.Text>
              <Button type="link" style={{ padding: 0 }} loading={preparingGoal}>
                立即生成项目蓝图
              </Button>
            </Space>
          </Card>

          <Card
            hoverable
            onClick={() => void handleCreateDemo()}
            styles={{ body: { padding: 18 } }}
            style={{ borderColor: "#bfdbfe", background: "#f8fbff" }}
          >
            <Space orientation="vertical" size={10}>
              <PlayCircleOutlined
                style={{ fontSize: 26, color: "#2563eb" }}
              />
              <Typography.Text strong>体验 Demo 项目</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                一键创建“个人博客改版项目”，包含 10 条任务和项目管理多视图。
              </Typography.Text>
              <Button type="primary" loading={creatingDemo}>
                立即创建
              </Button>
            </Space>
          </Card>

          <Card
            hoverable
            onClick={handleTemplateStart}
            styles={{ body: { padding: 18 } }}
          >
            <Space orientation="vertical" size={10}>
              <AppstoreAddOutlined
                style={{ fontSize: 26, color: "#7c3aed" }}
              />
              <Typography.Text strong>从模板 / 数据开始</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                已经知道自己要做什么？直接使用现有模板，或继续导入已有数据。
              </Typography.Text>
              <Button type="link" style={{ padding: 0 }}>
                使用现有能力
              </Button>
            </Space>
          </Card>
        </div>

        {creatingDemo && (
          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <Space>
              <Spin size="small" />
              <Typography.Text>{progressText}</Typography.Text>
            </Space>
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <Space>
            <BulbOutlined style={{ color: "#f59e0b" }} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Demo 创建的是正常 QTable 数据，不是截图；你可以直接改、删、复制或继续添加真实任务。
            </Typography.Text>
          </Space>
        </div>
      </Modal>

      <GoalWorkspaceModal
        open={goalOpen}
        workspaceId={goalTarget?.workspaceId || ""}
        parentId={goalTarget?.parentId || ""}
        initialGoal="我要管理一个 3 人完成的个人博客改版项目，预计 3 周完成。"
        onClose={() => {
          setGoalOpen(false);
          if (!localStorage.getItem(storageKey)) {
            setOpen(true);
          }
        }}
        onCreated={(result: GoalWorkspaceApplyResult) => {
          persistState("completed");
          localStorage.setItem(
            "qtable.workspaceId",
            goalTarget?.workspaceId || "",
          );
          const firstTable = result.created.tables?.[0];
          if (firstTable?.id) {
            localStorage.setItem(
              storageKey + ".goalTableId",
              firstTable.id,
            );
          }
          void refetchWorkspaces();
        }}
      />

      <Tour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />
    </>
  );
}
