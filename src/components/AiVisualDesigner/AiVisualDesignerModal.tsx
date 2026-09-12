import { useEffect, useMemo, useState } from "react";
import {
  ApartmentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useMutation } from "@apollo/client/react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  APPLY_AI_VISUAL_DESIGN,
  PREVIEW_AI_VISUAL_DESIGN,
} from "../../lib/graphql";
import type {
  AiVisualApplyResult,
  AiVisualEditableProposal,
  AiVisualNormalizedWidget,
  AiVisualPreview,
  AiVisualTargetType,
} from "./types";

const { Text, Title } = Typography;
const { TextArea } = Input;

type AiVisualDesignerModalProps = {
  open: boolean;
  workspaceId: string;
  tableId?: string | null;
  dashboardId?: string | null;
  defaultTargetType?: AiVisualTargetType;
  lockTargetType?: boolean;
  initialPrompt?: string;
  onClose: () => void;
  onApplied?: (result: AiVisualApplyResult) => void | Promise<void>;
};

const cloneProposal = (
  value: AiVisualEditableProposal,
): AiVisualEditableProposal =>
  JSON.parse(JSON.stringify(value)) as AiVisualEditableProposal;

const widgetTypeLabel: Record<string, string> = {
  bar: "柱状图",
  horizontalBar: "条形图",
  line: "折线图",
  pie: "饼图",
  table: "统计表",
  metric: "指标卡",
  progress: "进度条",
};

const viewTypeLabel: Record<string, string> = {
  grid: "表格",
  board: "看板",
  gantt: "甘特图",
  calendar: "日历",
  gallery: "画廊",
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function compactValue(value: unknown): string {
  if (value == null || value === "") return "空";
  if (Array.isArray(value)) return value.map(compactValue).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "复杂值";
    }
  }
  return String(value);
}

export function AiVisualDesignerModal({
  open,
  workspaceId,
  tableId,
  dashboardId,
  defaultTargetType = "view",
  lockTargetType = false,
  initialPrompt = "",
  onClose,
  onApplied,
}: AiVisualDesignerModalProps) {
  const [phase, setPhase] = useState<"input" | "preview" | "result">("input");
  const [targetType, setTargetType] =
    useState<AiVisualTargetType>(defaultTargetType);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [refinement, setRefinement] = useState("");
  const [preview, setPreview] = useState<AiVisualPreview | null>(null);
  const [editableProposal, setEditableProposal] =
    useState<AiVisualEditableProposal | null>(null);
  const [applyResult, setApplyResult] = useState<AiVisualApplyResult | null>(
    null,
  );

  const [previewMutation, { loading: previewLoading }] = useMutation(
    PREVIEW_AI_VISUAL_DESIGN,
  );
  const [applyMutation, { loading: applyLoading }] = useMutation(
    APPLY_AI_VISUAL_DESIGN,
  );

  useEffect(() => {
    if (!open) return;
    setPhase("input");
    setTargetType(dashboardId ? "dashboard" : defaultTargetType);
    setPrompt(
      initialPrompt ||
        (dashboardId ? "优化当前仪表盘，让项目风险和进展更容易理解" : ""),
    );
    setRefinement("");
    setPreview(null);
    setEditableProposal(null);
    setApplyResult(null);
  }, [dashboardId, defaultTargetType, initialPrompt, open]);

  const canGenerate =
    Boolean(
      workspaceId &&
        prompt.trim() &&
        (targetType === "dashboard" || tableId),
    ) &&
    !previewLoading &&
    !applyLoading;

  const updateEditable = (
    updater: (draft: AiVisualEditableProposal) => void,
  ) => {
    setEditableProposal((current) => {
      if (!current) return current;
      const next = cloneProposal(current);
      updater(next);
      return next;
    });
  };

  const requestPreview = async (
    currentProposal?: AiVisualEditableProposal | null,
    instruction?: string | null,
  ) => {
    if (!workspaceId || !prompt.trim()) return;
    try {
      const response = await previewMutation({
        variables: {
          workspaceId,
          prompt: prompt.trim(),
          targetType: dashboardId ? "dashboard" : targetType,
          tableId: tableId || null,
          parentId: null,
          dashboardId: dashboardId || null,
          currentProposal: currentProposal || null,
          instruction: instruction || null,
          model: null,
        },
      });
      const payload = (
        response as unknown as {
          data?: { previewAiVisualDesign?: AiVisualPreview };
        }
      ).data?.previewAiVisualDesign;
      if (!payload?.planId || !payload.editableProposal) {
        throw new Error("AI 设计预览为空");
      }
      setPreview(payload);
      setEditableProposal(payload.editableProposal);
      setTargetType(payload.target.type);
      setRefinement("");
      setPhase("preview");
    } catch (error) {
      message.error(errorMessage(error, "AI 视图设计生成失败"));
    }
  };

  const handleGenerate = () => {
    void requestPreview(null, null);
  };

  const handleRefine = () => {
    if (!editableProposal || !refinement.trim()) return;
    void requestPreview(editableProposal, refinement.trim());
  };

  const handleApply = async () => {
    if (!preview?.planId || !editableProposal) return;
    try {
      const response = await applyMutation({
        variables: {
          planId: preview.planId,
          proposal: editableProposal,
        },
      });
      const result = (
        response as unknown as {
          data?: { applyAiVisualDesign?: AiVisualApplyResult };
        }
      ).data?.applyAiVisualDesign;
      if (!result || result.status !== "applied") {
        throw new Error("AI 设计保存失败");
      }
      setApplyResult(result);
      setPhase("result");
      try {
        await onApplied?.(result);
      } catch {
        // The server result is already committed. A refresh callback failure
        // must not be presented as a failed design apply.
      }
      message.success(
        result.idempotent
          ? "该设计已经保存过，已返回现有结果"
          : result.targetType === "view"
            ? "AI 视图已保存"
            : "AI 仪表盘已保存",
      );
    } catch (error) {
      message.error(errorMessage(error, "保存失败，请重新生成预览后再试"));
    }
  };

  const currentName = useMemo(() => {
    if (!editableProposal) return "";
    return editableProposal.kind === "view"
      ? editableProposal.view.name
      : editableProposal.dashboard.name;
  }, [editableProposal]);

  const renderPreviewBody = () => {
    if (!preview || !editableProposal) return null;

    if (preview.proposal.kind === "view" && preview.proposal.view) {
      const view = preview.proposal.view;
      const explanation = view.explanation || {};
      return (
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <Card size="small">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <Text strong>视图名称</Text>
              <Input
                value={
                  editableProposal.kind === "view"
                    ? editableProposal.view.name
                    : ""
                }
                maxLength={120}
                onChange={(event) =>
                  updateEditable((draft) => {
                    if (draft.kind === "view") {
                      draft.view.name = event.target.value;
                    }
                  })
                }
              />
              <Space wrap>
                <Tag color="blue">{viewTypeLabel[view.type] || view.type}</Tag>
                <Tag>
                  {explanation.visibleFieldCount ?? "全部"} 个可见字段
                </Tag>
                {explanation.groupFieldName ? (
                  <Tag icon={<ApartmentOutlined />}>
                    按 {explanation.groupFieldName} 分组
                  </Tag>
                ) : null}
              </Space>
            </Space>
          </Card>

          <Card size="small" title="筛选与排序">
            {(explanation.filters?.length || 0) === 0 &&
            (explanation.sorts?.length || 0) === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="没有额外筛选或排序"
              />
            ) : (
              <Space orientation="vertical" size={6} style={{ width: "100%" }}>
                {(explanation.filters || []).map((item, index) => (
                  <div key={"filter-" + index}>
                    <Tag>筛选</Tag>
                    <Text>
                      {String(item.fieldName || item.fieldId || "字段")} ·{" "}
                      {String(item.operator || "")} ·{" "}
                      {compactValue(item.value)}
                    </Text>
                  </div>
                ))}
                {(explanation.sorts || []).map((item, index) => (
                  <div key={"sort-" + index}>
                    <Tag>排序</Tag>
                    <Text>
                      {String(item.fieldName || item.fieldId || "字段")} ·{" "}
                      {String(item.order || "asc").toUpperCase()}
                    </Text>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Space>
      );
    }

    const widgets = preview.proposal.dashboard?.widgets || [];
    return (
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Card size="small">
          <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <Text strong>仪表盘名称</Text>
            <Input
              value={
                editableProposal.kind === "dashboard"
                  ? editableProposal.dashboard.name
                  : ""
              }
              maxLength={120}
              onChange={(event) =>
                updateEditable((draft) => {
                  if (draft.kind === "dashboard") {
                    draft.dashboard.name = event.target.value;
                  }
                })
              }
            />
            <TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={500}
              value={
                editableProposal.kind === "dashboard"
                  ? editableProposal.dashboard.description || ""
                  : ""
              }
              placeholder="仪表盘说明"
              onChange={(event) =>
                updateEditable((draft) => {
                  if (draft.kind === "dashboard") {
                    draft.dashboard.description = event.target.value;
                  }
                })
              }
            />
          </Space>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {widgets.map((widget: AiVisualNormalizedWidget, index: number) => {
            const editableWidget =
              editableProposal.kind === "dashboard"
                ? editableProposal.dashboard.widgets[index]
                : undefined;
            return (
              <Card
                key={widget.key || String(index)}
                size="small"
                title={
                  <Space>
                    <BarChartOutlined />
                    <span>{widgetTypeLabel[widget.type] || widget.type}</span>
                  </Space>
                }
              >
                <Space orientation="vertical" size={6} style={{ width: "100%" }}>
                  <Input
                    size="small"
                    value={editableWidget?.title || widget.title}
                    maxLength={255}
                    onChange={(event) =>
                      updateEditable((draft) => {
                        if (draft.kind === "dashboard") {
                          const target = draft.dashboard.widgets[index];
                          if (target) target.title = event.target.value;
                        }
                      })
                    }
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {widget.purpose || "项目分析组件"}
                  </Text>
                  <Space wrap size={4}>
                    <Tag>
                      {widget.source?.tableName || widget.source?.tableId || "数据表"}
                    </Tag>
                    {widget.source?.dimensionFieldName ? (
                      <Tag>维度：{widget.source.dimensionFieldName}</Tag>
                    ) : null}
                    <Tag>
                      {widget.source?.aggregation || "count"}
                      {widget.source?.metricFieldName
                        ? " · " + widget.source.metricFieldName
                        : ""}
                    </Tag>
                  </Space>
                </Space>
              </Card>
            );
          })}
        </div>
      </Space>
    );
  };

  const footer =
    phase === "input"
      ? [
          <Button key="cancel" onClick={onClose}>
            取消
          </Button>,
          <Button
            key="generate"
            type="primary"
            icon={<RobotOutlined />}
            loading={previewLoading}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            生成预览
          </Button>,
        ]
      : phase === "preview"
        ? [
            <Button
              key="back"
              disabled={applyLoading}
              onClick={() => setPhase("input")}
            >
              返回修改
            </Button>,
            <Button
              key="apply"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={applyLoading}
              disabled={!editableProposal || !currentName.trim()}
              onClick={() => void handleApply()}
            >
              确认并保存
            </Button>,
          ]
        : [
            <Button key="done" type="primary" onClick={onClose}>
              完成
            </Button>,
          ];

  return (
    <Modal
      open={open}
      onCancel={applyLoading ? undefined : onClose}
      footer={footer}
      width={960}
      destroyOnHidden
      maskClosable={!applyLoading}
      closable={!applyLoading}
      title={
        <Space>
          <RobotOutlined style={{ color: "#7C3AED" }} />
          <span>
            {dashboardId ? "AI 设计当前仪表盘" : "AI 生成视图与仪表盘"}
          </span>
        </Space>
      }
    >
      {phase === "input" ? (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="先生成结构预览，确认前不会创建或修改视图/仪表盘"
            description="AI 设计阶段只读取字段结构与权限，不扫描整表记录；图表数据仍使用现有服务端聚合与缓存。"
          />
          {!lockTargetType && !dashboardId ? (
            <div>
              <Text strong>生成类型</Text>
              <Select
                value={targetType}
                onChange={(value: AiVisualTargetType) => setTargetType(value)}
                style={{ width: "100%", marginTop: 8 }}
                options={[
                  { value: "view", label: "命名视图" },
                  { value: "dashboard", label: "项目仪表盘" },
                ]}
              />
            </div>
          ) : null}
          <div>
            <Text strong>你想看到什么？</Text>
            <TextArea
              autoSize={{ minRows: 4, maxRows: 8 }}
              value={prompt}
              maxLength={3000}
              showCount
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                targetType === "view"
                  ? "例如：只看高优先级任务，按负责人分组，截止日期从近到远排序。"
                  : "例如：做一个上线前风险仪表盘，包含逾期任务、负责人负载和状态分布。"
              }
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      ) : null}

      {phase === "preview" && preview ? (
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type={preview.generationMode === "ai" ? "success" : "warning"}
            showIcon
            message={
              preview.generationMode === "ai"
                ? "已生成 AI 设计预览"
                : "已使用安全规则生成可用预览"
            }
            description={
              preview.warnings?.length
                ? preview.warnings.join("；")
                : preview.proposal.rationale
            }
          />

          <Space wrap>
            <Tag icon={<SafetyCertificateOutlined />} color="green">
              仅结构分析
            </Tag>
            <Tag>扫描数据行：{preview.performance.recordRowsScanned}</Tag>
            <Tag>数据源：{preview.performance.sourceTableCount} 张表</Tag>
            {preview.performance.dashboardWidgetsUseServerAggregation ? (
              <Tag icon={<ThunderboltOutlined />} color="blue">
                服务端聚合
              </Tag>
            ) : null}
          </Space>

          {renderPreviewBody()}

          <Divider style={{ margin: "2px 0" }} />
          <Card size="small">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <Text strong>继续用自然语言调整</Text>
              <Input
                value={refinement}
                maxLength={2000}
                onChange={(event) => setRefinement(event.target.value)}
                onPressEnter={handleRefine}
                placeholder={
                  preview.target.type === "view"
                    ? "例如：只看高优先级；按负责人分组；改成看板"
                    : "例如：把主要图表换成折线图；只看最近 30 天"
                }
                suffix={
                  <Button
                    type="link"
                    size="small"
                    loading={previewLoading}
                    disabled={!refinement.trim()}
                    onClick={handleRefine}
                  >
                    重新生成
                  </Button>
                }
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                名称和组件标题可在预览中直接修改；保存后仍可使用现有视图和仪表盘编辑器继续调整。
              </Text>
            </Space>
          </Card>
        </Space>
      ) : null}

      {phase === "result" && applyResult ? (
        <div style={{ padding: "28px 0", textAlign: "center" }}>
          <CheckCircleOutlined
            style={{ color: "#16A34A", fontSize: 42, marginBottom: 12 }}
          />
          <Title level={4} style={{ margin: "0 0 8px" }}>
            {applyResult.targetType === "view"
              ? "命名视图已经创建"
              : dashboardId
                ? "仪表盘已经更新"
                : "仪表盘已经创建"}
          </Title>
          <Text type="secondary">
            已保存为普通 QTable{" "}
            {applyResult.targetType === "view" ? "View" : "Dashboard"}，
            后续可继续使用现有编辑能力手工调整。
          </Text>
        </div>
      ) : null}
    </Modal>
  );
}
