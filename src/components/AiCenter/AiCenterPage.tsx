import {
  BarChartOutlined,
  BranchesOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Tag, Typography, message } from "antd";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productT } from "../../lib/productI18n";
import { useLanguage } from "../../lib/useLanguage";
import { useAiAssistantStore } from "../../store/aiAssistantStore";
import {
  permissionAllows,
  useSmartTableStore,
} from "../../store/useSmartTableStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import AiAssistant from "../AiAssistant";
import { AiVisualDesignerModal } from "../AiVisualDesigner/AiVisualDesignerModal";
import type { AiVisualApplyResult } from "../AiVisualDesigner/types";
import { ProjectStewardModal } from "../ProjectSteward/ProjectStewardModal";
import { TaskPlanningModal } from "../TaskPlanning/TaskPlanningModal";
import { WorkloadPlanningModal } from "../WorkloadPlanning/WorkloadPlanningModal";
import { AiContextSummary } from "./AiContextSummary";
import "./aiCenter.css";

const { Paragraph, Text, Title } = Typography;

type AiActionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
  permissionHint: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

function AiActionCard({
  icon,
  title,
  description,
  badge,
  permissionHint,
  disabled,
  disabledReason,
  onClick,
}: AiActionCardProps) {
  return (
    <Card className="qtable-ai-action-card" bordered={false}>
      <div className="qtable-ai-action-card-head">
        <span className="qtable-ai-action-icon" aria-hidden="true">
          {icon}
        </span>
        <Tag bordered={false}>{badge}</Tag>
      </div>
      <div className="qtable-ai-action-copy">
        <Title level={4}>{title}</Title>
        <Paragraph type="secondary">{description}</Paragraph>
      </div>
      <div className="qtable-ai-action-footer">
        <Text type="secondary" className="qtable-ai-action-permission">
          {disabled && disabledReason ? disabledReason : permissionHint}
        </Text>
        <Button type="primary" ghost disabled={disabled} onClick={onClick}>
          {productT("ai.open")}
        </Button>
      </div>
    </Card>
  );
}

export function AiCenterPage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const currentTableId = useSmartTableStore((state) => state.currentTableId);
  const currentTableName = useSmartTableStore((state) => state.currentTableName);
  const currentPermission = useSmartTableStore((state) => state.currentPermission);
  const selectedRecordIds = useSmartTableStore((state) => state.selectedRecordIds);

  const drawerOpen = useAiAssistantStore((state) => state.drawerOpen);
  const openDrawer = useAiAssistantStore((state) => state.openDrawer);
  const selectedTableIds = useAiAssistantStore((state) => state.selectedTableIds);
  const setSelectedTableIds = useAiAssistantStore((state) => state.setSelectedTableIds);
  const setMode = useAiAssistantStore((state) => state.setMode);

  const [taskPlanningOpen, setTaskPlanningOpen] = useState(false);
  const [workloadPlanningOpen, setWorkloadPlanningOpen] = useState(false);
  const [projectStewardOpen, setProjectStewardOpen] = useState(false);
  const [visualDesignerOpen, setVisualDesignerOpen] = useState(false);

  const canRead = permissionAllows(currentPermission, "read");
  const canEdit = permissionAllows(currentPermission, "edit");

  const scopeDescription = useMemo(() => {
    if (!currentTableId) {
      return productT("ai.scope.noTable");
    }
    const table = currentTableName || productT("ai.tableFallback");
    if (selectedRecordIds.length > 0) {
      return productT("ai.scope.selectedRecords", {
        table,
        count: selectedRecordIds.length,
      });
    }
    return productT("ai.scope.table", { table });
  }, [currentTableId, currentTableName, language, selectedRecordIds.length]);

  const openAssistant = (agentMode = false) => {
    if (currentTableId && selectedTableIds.length === 0) {
      setSelectedTableIds([currentTableId]);
    }
    if (agentMode) setMode("agent");
    openDrawer();
  };

  useEffect(() => {
    openAssistant(false);
    // The route is the stable global AI entry. Opening once on mount makes the
    // existing conversation workspace immediately usable while preserving the
    // user's explicit multi-table selection when one already exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVisualApplied = (result: AiVisualApplyResult) => {
    message.success(productT("ai.visualSaved"));
    if (result.targetType === "view" && result.view) {
      navigate(`/workbench/${result.view.tableId}/${result.view.id}`);
      return;
    }
    if (result.targetType === "dashboard" && result.dashboard) {
      navigate(`/workbench/${result.dashboard.id}`);
    }
  };

  const noTableReason = productT("ai.noTableReason");

  return (
    <div className={`qtable-ai-center-layout${drawerOpen ? " is-assistant-open" : ""}`}>
      <main className="qtable-ai-center-main">
        <div className="qtable-ai-center-content">
          <section className="qtable-ai-center-hero" aria-labelledby="qtable-ai-center-title">
            <div className="qtable-ai-center-hero-copy">
              <Tag color="purple" bordered={false}>AI Workspace</Tag>
              <Title id="qtable-ai-center-title" level={1}>
                {productT("ai.heroTitle")}
              </Title>
              <Paragraph>{productT("ai.heroDescription")}</Paragraph>
            </div>
            <div className="qtable-ai-center-hero-actions">
              <Button
                type="primary"
                size="large"
                icon={<RobotOutlined />}
                onClick={() => openAssistant(false)}
              >
                {productT("ai.openAssistant")}
              </Button>
              <Button size="large" onClick={() => navigate("/tables")}>
                {productT("ai.selectTable")}
              </Button>
            </div>
          </section>

          <AiContextSummary />

          <Alert
            className="qtable-ai-scope-alert"
            type={currentTableId ? "info" : "warning"}
            showIcon
            message={currentTableId ? productT("ai.contextReady") : productT("ai.contextRequired")}
            description={scopeDescription}
          />

          <section className="qtable-ai-actions-section" aria-labelledby="qtable-ai-actions-title">
            <div className="qtable-ai-section-heading">
              <div>
                <Title id="qtable-ai-actions-title" level={2}>{productT("ai.actionsTitle")}</Title>
                <Paragraph type="secondary">{productT("ai.actionsDescription")}</Paragraph>
              </div>
            </div>

            <div className="qtable-ai-actions-grid">
              <AiActionCard
                icon={<BranchesOutlined />}
                title={productT("ai.taskBreakdown.title")}
                description={productT("ai.taskBreakdown.description")}
                badge={selectedRecordIds.length ? productT("ai.taskBreakdown.selectedBadge", { count: selectedRecordIds.length }) : productT("ai.taskBreakdown.badge")}
                permissionHint={productT("ai.taskBreakdown.permission")}
                disabled={!currentTableId || !canEdit}
                disabledReason={!currentTableId ? noTableReason : productT("ai.taskBreakdown.readonly")}
                onClick={() => setTaskPlanningOpen(true)}
              />

              <AiActionCard
                icon={<ClockCircleOutlined />}
                title={productT("ai.workload.title")}
                description={productT("ai.workload.description")}
                badge={selectedRecordIds.length ? productT("ai.workload.selectedBadge", { count: selectedRecordIds.length }) : productT("ai.workload.badge")}
                permissionHint={canEdit ? productT("ai.workload.permissionEdit") : productT("ai.workload.permissionRead")}
                disabled={!currentTableId || !canRead}
                disabledReason={!currentTableId ? noTableReason : productT("ai.readDenied")}
                onClick={() => setWorkloadPlanningOpen(true)}
              />

              <AiActionCard
                icon={<BulbOutlined />}
                title={productT("ai.projectDiagnosis.title")}
                description={productT("ai.projectDiagnosis.description")}
                badge={productT("ai.projectDiagnosis.badge")}
                permissionHint={productT("ai.projectDiagnosis.permission")}
                disabled={!currentTableId || !canRead}
                disabledReason={!currentTableId ? noTableReason : productT("ai.readDenied")}
                onClick={() => setProjectStewardOpen(true)}
              />

              <AiActionCard
                icon={<BarChartOutlined />}
                title={productT("ai.visual.title")}
                description={productT("ai.visual.description")}
                badge={productT("ai.visual.badge")}
                permissionHint={productT("ai.visual.permission")}
                disabled={!currentTableId || !canEdit}
                disabledReason={!currentTableId ? noTableReason : productT("ai.visual.readonly")}
                onClick={() => setVisualDesignerOpen(true)}
              />

              <AiActionCard
                icon={<TeamOutlined />}
                title={productT("ai.assignment.title")}
                description={productT("ai.assignment.description")}
                badge={productT("ai.assignment.badge")}
                permissionHint={productT("ai.assignment.permission")}
                disabled={!currentTableId || !canRead}
                disabledReason={!currentTableId ? noTableReason : productT("ai.readDenied")}
                onClick={() => {
                  openAssistant(true);
                  message.info(productT("ai.assignment.agentEnabled"));
                }}
              />

              <AiActionCard
                icon={<RobotOutlined />}
                title={productT("ai.conversation.title")}
                description={productT("ai.conversation.description")}
                badge={productT("ai.conversation.badge")}
                permissionHint={productT("ai.conversation.permission")}
                onClick={() => openAssistant(false)}
              />
            </div>
          </section>
        </div>
      </main>

      <AiAssistant />

      <TaskPlanningModal
        open={taskPlanningOpen}
        workspaceId={workspaceId}
        targetTableId={currentTableId || ""}
        onClose={() => setTaskPlanningOpen(false)}
        onApplied={() => {
          message.success(productT("ai.taskPlanApplied"));
          setTaskPlanningOpen(false);
        }}
      />
      <WorkloadPlanningModal
        open={workloadPlanningOpen}
        workspaceId={workspaceId}
        tableId={currentTableId || ""}
        onClose={() => setWorkloadPlanningOpen(false)}
        onApplied={() => {
          message.success(productT("ai.workloadApplied"));
          setWorkloadPlanningOpen(false);
        }}
        canApply={canEdit}
      />
      <ProjectStewardModal
        open={projectStewardOpen}
        workspaceId={workspaceId}
        tableId={currentTableId || ""}
        onClose={() => setProjectStewardOpen(false)}
      />
      <AiVisualDesignerModal
        open={visualDesignerOpen}
        workspaceId={workspaceId}
        tableId={currentTableId || ""}
        defaultTargetType="view"
        onClose={() => setVisualDesignerOpen(false)}
        onApplied={handleVisualApplied}
      />
    </div>
  );
}
