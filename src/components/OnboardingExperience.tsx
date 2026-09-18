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
import { useAiAssistantStore } from "../store/aiAssistantStore";
import { useLanguage } from "../lib/useLanguage";
import { ONBOARDING_OPEN_EVENT } from "../lib/shellEvents";
import { GoalWorkspaceModal } from "./GoalWorkspace/GoalWorkspaceModal";
import type { GoalWorkspaceApplyResult } from "./GoalWorkspace/goalWorkspaceTypes";
import {
  ONBOARDING_DEMO_TABLE_NAMES,
  onboardingCatalog,
  onboardingT,
} from "./onboardingI18n";

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

const PROJECT_TEMPLATE_ID = "project_management";

const hasWorkspaceContent = (root?: WorkspaceNode | null): boolean => {
  if (!root) return false;
  if (root.type === "table" || root.type === "dashboard") return true;
  return (root.children || []).some((child) => hasWorkspaceContent(child));
};

// Demo 表名跟随界面语言，所以按名称查找时要接受全部语言的写法。
const findDemoTable = (root?: WorkspaceNode | null): WorkspaceNode | null => {
  if (!root) return null;
  if (root.type === "table" && ONBOARDING_DEMO_TABLE_NAMES.includes(root.name)) {
    return root;
  }
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
    { f1: onboardingT("demoRowGoals"), f2: "opt3", f4: 100, f5: 5, f6: date(-7), f7: date(-6) },
    { f1: onboardingT("demoRowContentAudit"), f2: "opt3", f4: 100, f5: 4, f6: date(-6), f7: date(-4) },
    { f1: onboardingT("demoRowVisualDirection"), f2: "opt2", f4: 70, f5: 5, f6: date(-3), f7: date(1) },
    { f1: onboardingT("demoRowHeroNav"), f2: "opt2", f4: 45, f5: 5, f6: date(-1), f7: date(3) },
    { f1: onboardingT("demoRowArticleList"), f2: "opt2", f4: 30, f5: 4, f6: date(1), f7: date(5) },
    { f1: onboardingT("demoRowArticleDetail"), f2: "opt1", f4: 0, f5: 4, f6: date(3), f7: date(7) },
    { f1: onboardingT("demoRowPerformance"), f2: "opt1", f4: 0, f5: 5, f6: date(5), f7: date(8) },
    { f1: onboardingT("demoRowSeo"), f2: "opt1", f4: 0, f5: 3, f6: date(6), f7: date(9) },
    { f1: onboardingT("demoRowRegression"), f2: "opt1", f4: 0, f5: 5, f6: date(8), f7: date(11) },
    { f1: onboardingT("demoRowLaunchReview"), f2: "opt1", f4: 0, f5: 4, f6: date(12), f7: date(14) },
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
  const aiPanelOpen = useAiAssistantStore((state) => state.drawerOpen);
  const language = useLanguage();

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

  // 帮助中心等入口通过 shell 事件重新打开引导（AI 面板占据右下角时悬浮入口会避让）。
  useEffect(() => {
    const openFromShell = () => setOpen(true);
    window.addEventListener(ONBOARDING_OPEN_EVENT, openFromShell);
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, openFromShell);
  }, []);

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
          variables: { name: onboardingT("workspaceName") },
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
      message.error(onboardingT("goalPrepareFailed"));
    } finally {
      setPreparingGoal(false);
    }
  };

  const handleTemplateStart = () => {
    persistState("completed");
    setOpen(false);
    navigate("/");
    message.info(onboardingT("templateHint"));
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
    setProgressText(onboardingT("progressPreparingDemo"));

    let createdTable: CreatedTable | null = null;
    try {
      let targetWorkspace: WorkspaceSummary | undefined = preferredWorkspace;
      let root = workspaceData?.workspace?.root || null;

      if (!targetWorkspace) {
        const workspaceResult = await createWorkspace({
          variables: { name: onboardingT("demoWorkspaceName") },
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
        setProgressText(onboardingT("progressInitializingWorkspace"));
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
        message.success(onboardingT("demoOpened"));
        return;
      }

      const parentId = root?.id || targetWorkspace.rootId;
      if (!parentId) {
        throw new Error("workspace-root-unavailable");
      }

      setProgressText(onboardingT("progressCreatingTable"));
      const tableResult = await createTable({
        variables: {
          name: onboardingT("demoTableName"),
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

      setProgressText(onboardingT("progressWritingRows"));
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
      message.success(onboardingT("demoCreated"));
    } catch {
      if (createdTable?.id) {
        persistState("completed");
        setOpen(false);
        scheduleTourAfterNavigation();
        openTable(createdTable);
        message.warning(onboardingT("demoRowsFailed"));
      } else {
        message.error(onboardingT("demoFailed"));
      }
    } finally {
      setCreatingDemo(false);
      setProgressText("");
    }
  };

  // 分步引导的文案跟随当前语言，所以按 language 重算整组 steps。
  const tourSteps = useMemo(() => {
    const copy = onboardingCatalog(language);
    return [
      { title: copy.tourStep1Title, description: copy.tourStep1Body },
      { title: copy.tourStep2Title, description: copy.tourStep2Body },
      { title: copy.tourStep3Title, description: copy.tourStep3Body },
      { title: copy.tourStep4Title, description: copy.tourStep4Body },
    ];
  }, [language]);

  if (!token) return null;

  return (
    <>
      {!open && (
        <Tooltip title={onboardingT("reopenGuide")}>
          <Button
            aria-label={onboardingT("reopenGuide")}
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={() => setOpen(true)}
            style={{
              position: "fixed",
              right: 24,
              bottom: 24,
              zIndex: 900,
              boxShadow: "0 6px 20px rgba(15, 23, 42, 0.12)",
              // AI 面板停靠在视口右侧，其右下角是发送按钮的地盘；
              // 面板打开时让引导入口整体退出该角落，避免两个按钮重叠。
              transition: "opacity 0.2s ease, transform 0.2s ease",
              opacity: aiPanelOpen ? 0 : 1,
              transform: aiPanelOpen ? "scale(0.9)" : "scale(1)",
              visibility: aiPanelOpen ? "hidden" : "visible",
              pointerEvents: aiPanelOpen ? "none" : "auto",
            }}
          />
        </Tooltip>
      )}

      <Modal
        open={open}
        onCancel={handleSkip}
        footer={
          <Button type="text" onClick={handleSkip} disabled={creatingDemo || preparingGoal}>
            {onboardingT("skip")}
          </Button>
        }
        width={820}
        maskClosable={!creatingDemo && !preparingGoal}
        closable={!creatingDemo && !preparingGoal}
        title={
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {onboardingT("welcomeTitle")}
            </Typography.Title>
            <Typography.Text type="secondary">
              {onboardingT("welcomeSubtitle")}
            </Typography.Text>
          </div>
        }
      >
        <Alert
          type="info"
          showIcon
          message={onboardingT("goalAlert")}
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
              <Typography.Text strong>
                {onboardingT("goalCardTitle")}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {onboardingT("goalCardBody")}
              </Typography.Text>
              <Button type="link" style={{ padding: 0 }} loading={preparingGoal}>
                {onboardingT("goalCardAction")}
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
              <Typography.Text strong>
                {onboardingT("demoCardTitle")}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {onboardingT("demoCardBody")}
              </Typography.Text>
              <Button type="primary" loading={creatingDemo}>
                {onboardingT("demoCardAction")}
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
              <Typography.Text strong>
                {onboardingT("templateCardTitle")}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {onboardingT("templateCardBody")}
              </Typography.Text>
              <Button type="link" style={{ padding: 0 }}>
                {onboardingT("templateCardAction")}
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
              {onboardingT("demoDataTip")}
            </Typography.Text>
          </Space>
        </div>
      </Modal>

      <GoalWorkspaceModal
        open={goalOpen}
        workspaceId={goalTarget?.workspaceId || ""}
        parentId={goalTarget?.parentId || ""}
        initialGoal={onboardingT("initialGoal")}
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
