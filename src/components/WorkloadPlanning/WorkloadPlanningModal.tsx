import { useEffect, useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useMutation } from "@apollo/client/react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  DatePicker,
  Divider,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import {
  APPLY_WORKLOAD_PLANNING,
  PREVIEW_WORKLOAD_PLANNING,
  SUBMIT_WORKLOAD_PLANNING_FEEDBACK,
  WORKLOAD_PLANNING_WHAT_IF,
} from "../../lib/graphql";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { FieldTypeIcon } from "../SmartTable/FieldTypeIcon";
import type {
  WorkloadPlanningAggregate,
  WorkloadPlanningApplyResult,
  WorkloadPlanningFeedbackResult,
  WorkloadPlanningPreview,
  WorkloadPlanningTask,
  WorkloadPlanningWhatIfResult,
} from "./workloadPlanningTypes";

type WorkloadPlanningModalProps = {
  open: boolean;
  workspaceId: string;
  tableId: string;
  onClose: () => void;
  onApplied?: (
    result: WorkloadPlanningApplyResult,
  ) => void | Promise<void>;
  canApply: boolean;
  sourceReference?: Record<string, unknown> | null;
};

type FeedbackTarget = {
  batchId: string;
  recordId: string;
  estimateId?: string | null;
  title: string;
};

const riskColor = (level?: string) => {
  if (level === "critical") return "red";
  if (level === "high") return "orange";
  if (level === "medium") return "gold";
  return "green";
};

const confidenceColor = (score: number) => {
  if (score >= 0.75) return "#16A34A";
  if (score >= 0.45) return "#D97706";
  return "#DC2626";
};

const parseTrace = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const taskHistoryCount = (task: WorkloadPlanningTask) =>
  Number(task.basis?.historicalLearning?.sampleCount || 0);

const formatHours = (value: number) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });

const formatDays = (value: number) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

export function WorkloadPlanningModal({
  open,
  workspaceId,
  tableId,
  onClose,
  onApplied,
  canApply,
  sourceReference,
}: WorkloadPlanningModalProps) {
  const fields = useSmartTableStore((state) => state.fields);
  const records = useSmartTableStore((state) => state.records);
  const selectedRecordIds = useSmartTableStore(
    (state) => state.selectedRecordIds,
  );
  const [phase, setPhase] = useState<
    "input" | "preview" | "result" | "feedback"
  >("input");
  const [teamSize, setTeamSize] = useState(3);
  const [parallelStreams, setParallelStreams] = useState(2);
  const [deadline, setDeadline] = useState<Dayjs | null>(null);
  const [businessDomain, setBusinessDomain] = useState("");
  const [qualityBar, setQualityBar] = useState<
    "prototype" | "production" | "enterprise"
  >("production");
  const [preview, setPreview] =
    useState<WorkloadPlanningPreview | null>(null);
  const [selectedForApply, setSelectedForApply] = useState<Set<string>>(
    new Set(),
  );
  const [whatIfResult, setWhatIfResult] =
    useState<WorkloadPlanningWhatIfResult | null>(null);
  const [scenarioTeamSize, setScenarioTeamSize] = useState(3);
  const [scenarioStreams, setScenarioStreams] = useState(2);
  const [scenarioDeadline, setScenarioDeadline] = useState<Dayjs | null>(null);
  const [applyResult, setApplyResult] =
    useState<WorkloadPlanningApplyResult | null>(null);
  const [feedbackTarget, setFeedbackTarget] =
    useState<FeedbackTarget | null>(null);
  const [actualHours, setActualHours] = useState<number | null>(null);
  const [actualStoryPoints, setActualStoryPoints] =
    useState<number | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<
    "better_than_expected" | "on_track" | "worse_than_expected"
  >("on_track");
  const [accuracyRating, setAccuracyRating] = useState<number | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");

  const [previewMutation, { loading: previewLoading }] = useMutation(
    PREVIEW_WORKLOAD_PLANNING,
  );
  const [applyMutation, { loading: applyLoading }] = useMutation(
    APPLY_WORKLOAD_PLANNING,
  );
  const [whatIfMutation, { loading: whatIfLoading }] = useMutation(
    WORKLOAD_PLANNING_WHAT_IF,
  );
  const [feedbackMutation, { loading: feedbackLoading }] = useMutation(
    SUBMIT_WORKLOAD_PLANNING_FEEDBACK,
  );

  const titleField = useMemo(
    () =>
      fields.find(
        (field) =>
          field.type === "text" &&
          /任务名称|任务标题|标题|名称|title|name/i.test(field.name),
      ) || fields.find((field) => field.type === "text"),
    [fields],
  );

  const traceField = useMemo(
    () =>
      fields.find((field) =>
        /估算\s*trace|估算追踪|workload\s*trace|estimate\s*trace/i.test(
          field.name,
        ),
      ),
    [fields],
  );

  const selectedRecords = useMemo(() => {
    const ids = new Set(selectedRecordIds);
    return records.filter((record) => ids.has(String(record.id)));
  }, [records, selectedRecordIds]);

  const selectedTitles = useMemo(
    () =>
      selectedRecords.map((record) =>
        titleField
          ? String(record[titleField.id] || record.id)
          : String(record.id),
      ),
    [selectedRecords, titleField],
  );

  const existingFeedbackTarget = useMemo<FeedbackTarget | null>(() => {
    if (selectedRecords.length !== 1 || !traceField) return null;
    const record = selectedRecords[0];
    const trace = parseTrace(record[traceField.id]);
    if (!trace?.batchId || !trace?.recordId) return null;
    return {
      batchId: String(trace.batchId),
      recordId: String(trace.recordId),
      estimateId: trace.estimateId ? String(trace.estimateId) : null,
      title:
        (titleField && String(record[titleField.id] || "").trim()) ||
        String(record.id),
    };
  }, [selectedRecords, titleField, traceField]);

  useEffect(() => {
    if (!open) return;
    setPhase("input");
    setTeamSize(3);
    setParallelStreams(2);
    setDeadline(null);
    setBusinessDomain("");
    setQualityBar("production");
    setPreview(null);
    setSelectedForApply(new Set());
    setWhatIfResult(null);
    setApplyResult(null);
    setFeedbackTarget(null);
    setActualHours(null);
    setActualStoryPoints(null);
    setOutcomeStatus("on_track");
    setAccuracyRating(null);
    setFeedbackNotes("");
  }, [open]);

  useEffect(() => {
    setParallelStreams((current) => Math.max(1, Math.min(current, teamSize)));
  }, [teamSize]);

  const taskById = useMemo(() => {
    const map = new Map<string, WorkloadPlanningTask>();
    preview?.tasks.forEach((task) => map.set(task.recordId, task));
    return map;
  }, [preview]);

  const criticalPathTitles = useMemo(
    () =>
      (preview?.aggregate.criticalPathRecordIds || []).map(
        (recordId) => taskById.get(recordId)?.title || recordId,
      ),
    [preview?.aggregate.criticalPathRecordIds, taskById],
  );

  const runPreview = async () => {
    if (!workspaceId || !tableId) return;
    try {
      const response = await previewMutation({
        variables: {
          workspaceId,
          tableId,
          recordIds: selectedRecordIds,
          deadline: deadline ? deadline.format("YYYY-MM-DD") : null,
          teamSize,
          parallelStreams,
          businessDomain: businessDomain.trim() || null,
          qualityBar,
          sourceReference: sourceReference || null,
        },
      });
      const payload = (
        response as unknown as {
          data?: { previewWorkloadPlanning?: WorkloadPlanningPreview };
        }
      ).data?.previewWorkloadPlanning;
      if (!payload?.batchId || !payload.tasks?.length) {
        throw new Error("empty workload planning preview");
      }
      setPreview(payload);
      setSelectedForApply(new Set(payload.recordIds));
      setScenarioTeamSize(teamSize);
      setScenarioStreams(parallelStreams);
      setScenarioDeadline(deadline);
      setWhatIfResult(null);
      setPhase("preview");
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "工作量估算失败，请检查 AI 配置或任务范围。",
      );
    }
  };

  const toggleApplyRecord = (recordId: string, checked: boolean) => {
    setSelectedForApply((current) => {
      const next = new Set(current);
      if (checked) next.add(recordId);
      else next.delete(recordId);
      return next;
    });
  };

  const runWhatIf = async () => {
    if (!preview) return;
    try {
      const response = await whatIfMutation({
        variables: {
          batchId: preview.batchId,
          teamSize: scenarioTeamSize,
          parallelStreams: Math.min(scenarioStreams, scenarioTeamSize),
          deadline: scenarioDeadline
            ? scenarioDeadline.format("YYYY-MM-DD")
            : null,
        },
      });
      const payload = (
        response as unknown as {
          data?: { workloadPlanningWhatIf?: WorkloadPlanningWhatIfResult };
        }
      ).data?.workloadPlanningWhatIf;
      if (!payload?.scenario) throw new Error("empty what-if result");
      setWhatIfResult(payload);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "What-if 计算失败。",
      );
    }
  };

  const applyEstimate = async () => {
    if (!preview || selectedForApply.size === 0) return;
    try {
      const response = await applyMutation({
        variables: {
          batchId: preview.batchId,
          workspaceId,
          tableId,
          recordIds: Array.from(selectedForApply),
        },
      });
      const payload = (
        response as unknown as {
          data?: { applyWorkloadPlanning?: WorkloadPlanningApplyResult };
        }
      ).data?.applyWorkloadPlanning;
      if (!payload?.batchId) throw new Error("empty workload apply result");
      setApplyResult(payload);
      setPhase("result");
      try {
        await onApplied?.(payload);
      } catch {
        // The server transaction is already committed. Refresh errors are separate.
      }
      message.success(
        payload.idempotent
          ? "这些任务已经回填过相同估算。"
          : "估算结果已回填到任务表。",
      );
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "估算回填失败；服务端已回滚本次修改。",
      );
    }
  };

  const openFeedback = () => {
    if (!existingFeedbackTarget) return;
    setFeedbackTarget(existingFeedbackTarget);
    setActualHours(null);
    setActualStoryPoints(null);
    setOutcomeStatus("on_track");
    setAccuracyRating(null);
    setFeedbackNotes("");
    setPhase("feedback");
  };

  const submitFeedback = async () => {
    if (!feedbackTarget) return;
    if (actualHours === null && actualStoryPoints === null) {
      message.warning("请至少填写实际工时或实际 Story Point。");
      return;
    }
    try {
      const response = await feedbackMutation({
        variables: {
          batchId: feedbackTarget.batchId,
          recordId: feedbackTarget.recordId,
          actualStoryPoints,
          actualHours,
          outcomeStatus,
          accuracyRating,
          notes: feedbackNotes.trim(),
        },
      });
      const payload = (
        response as unknown as {
          data?: {
            submitWorkloadPlanningFeedback?: WorkloadPlanningFeedbackResult;
          };
        }
      ).data?.submitWorkloadPlanningFeedback;
      if (!payload?.estimateId) throw new Error("empty feedback result");
      message.success("实际结果已记录，将用于后续估算校准。");
      setPhase("input");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "估算反馈提交失败。",
      );
    }
  };

  const aggregateCards = (
    aggregate: WorkloadPlanningAggregate,
    prefix = "",
  ) => [
    {
      label: prefix + "总工作量 P50",
      value: formatHours(aggregate.totalWorkP50Hours) + "h",
    },
    {
      label: prefix + "日历 P50",
      value: formatDays(aggregate.calendarP50Days) + " 天",
    },
    {
      label: prefix + "日历 P90",
      value: formatDays(aggregate.calendarP90Days) + " 天",
    },
    {
      label: prefix + "Story Point",
      value: String(aggregate.totalStoryPoints),
    },
  ];

  const footer =
    phase === "input"
      ? [
          <Button key="cancel" onClick={onClose}>
            取消
          </Button>,
          <Button
            key="preview"
            type="primary"
            icon={<ClockCircleOutlined />}
            loading={previewLoading}
            disabled={!workspaceId || !tableId}
            onClick={() => void runPreview()}
          >
            生成估算预览
          </Button>,
        ]
      : phase === "preview"
        ? [
            <Button
              key="back"
              disabled={applyLoading}
              onClick={() => setPhase("input")}
            >
              返回调整范围
            </Button>,
            <Button
              key="apply"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={applyLoading}
              disabled={!canApply || selectedForApply.size === 0}
              onClick={() => void applyEstimate()}
            >
              {canApply
                ? `回填 ${selectedForApply.size} 条任务`
                : "只读预览"}
            </Button>,
          ]
        : phase === "feedback"
          ? [
              <Button key="back" onClick={() => setPhase("input")}>
                返回
              </Button>,
              <Button
                key="feedback"
                type="primary"
                loading={feedbackLoading}
                onClick={() => void submitFeedback()}
              >
                提交实际结果
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
      onCancel={applyLoading || feedbackLoading ? undefined : onClose}
      footer={footer}
      width={1080}
      maskClosable={!applyLoading && !feedbackLoading}
      closable={!applyLoading && !feedbackLoading}
      destroyOnHidden
      title={
        <Space>
          <ClockCircleOutlined style={{ color: "#0F766E" }} />
          <span>AI 工作量与工期估算</span>
          {selectedRecordIds.length > 0 ? (
            <Tag color="cyan">已选 {selectedRecordIds.length} 条</Tag>
          ) : (
            <Tag>当前项目范围</Tag>
          )}
        </Space>
      }
    >
      {phase === "input" && (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="估算先预览，不会直接修改任务。P50 表示更可能达到的估算，P90 用于保守计划。"
            description={
              selectedRecordIds.length > 0
                ? "将估算当前勾选的任务。"
                : "未勾选任务时会估算当前用户可见的项目任务；单批最多 50 条。"
            }
          />

          {selectedTitles.length > 0 ? (
            <Card size="small" title="当前估算范围">
              <Space wrap>
                {selectedTitles.slice(0, 15).map((title, index) => (
                  <Tag key={selectedRecordIds[index] || title}>{title}</Tag>
                ))}
                {selectedTitles.length > 15 ? (
                  <Tag>+{selectedTitles.length - 15}</Tag>
                ) : null}
              </Space>
            </Card>
          ) : null}

          {existingFeedbackTarget ? (
            <Alert
              type="success"
              showIcon
              icon={<HistoryOutlined />}
              message={"“" + existingFeedbackTarget.title + "”已有已回填估算"}
              description={
                <Button size="small" onClick={openFeedback}>
                  提交实际工时 / Story Point
                </Button>
              }
            />
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "180px 190px 220px 180px minmax(0, 1fr)",
              gap: 10,
            }}
          >
            <div>
              <Typography.Text strong>团队人数</Typography.Text>
              <InputNumber
                min={1}
                max={50}
                value={teamSize}
                style={{ width: "100%", marginTop: 8 }}
                onChange={(value) => setTeamSize(Number(value || 1))}
              />
            </div>
            <div>
              <Typography.Text strong>并行工作流</Typography.Text>
              <InputNumber
                min={1}
                max={teamSize}
                value={parallelStreams}
                style={{ width: "100%", marginTop: 8 }}
                onChange={(value) =>
                  setParallelStreams(
                    Math.max(1, Math.min(Number(value || 1), teamSize)),
                  )
                }
              />
            </div>
            <div>
              <Typography.Text strong>目标截止时间</Typography.Text>
              <DatePicker
                value={deadline}
                style={{ width: "100%", marginTop: 8 }}
                onChange={setDeadline}
                placeholder="可选"
              />
            </div>
            <div>
              <Typography.Text strong>质量目标</Typography.Text>
              <Select
                value={qualityBar}
                style={{ width: "100%", marginTop: 8 }}
                options={[
                  { value: "prototype", label: "原型" },
                  { value: "production", label: "生产" },
                  { value: "enterprise", label: "企业级" },
                ]}
                onChange={setQualityBar}
              />
            </div>
            <div>
              <Typography.Text strong>业务领域</Typography.Text>
              <Input
                value={businessDomain}
                style={{ marginTop: 8 }}
                placeholder="可选，例如：内容平台 / 电力设计"
                onChange={(event) => setBusinessDomain(event.target.value)}
              />
            </div>
          </div>
        </Space>
      )}

      {phase === "preview" && preview && (
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {aggregateCards(preview.aggregate).map((item) => (
              <Card key={item.label} size="small">
                <Typography.Text type="secondary">
                  {item.label}
                </Typography.Text>
                <Typography.Title level={4} style={{ margin: "4px 0 0" }}>
                  {item.value}
                </Typography.Title>
              </Card>
            ))}
          </div>

          <Alert
            type="info"
            showIcon
            message={
              "关键路径：" +
              (criticalPathTitles.length
                ? criticalPathTitles.join(" → ")
                : "暂无依赖链")
            }
            description={
              "关键路径 P50 " +
              formatHours(preview.aggregate.criticalPathP50Hours) +
              "h；有效并行流 " +
              preview.aggregate.effectiveParallelStreams +
              "。总工作量不会直接当作日历工期。"
            }
          />

          {(preview.aggregate.externalDependencies || []).length > 0 ? (
            <Alert
              type="warning"
              showIcon
              message="当前估算范围存在外部前置依赖"
              description={
                "有 " +
                (preview.aggregate.externalDependencies || []).length +
                " 条依赖指向本次未估算的任务；这些外部任务的等待时间没有计入当前日历工期，计划时应额外保留余量。"
              }
            />
          ) : null}

          {preview.aggregate.deadlineRisk ? (
            <Alert
              type={
                preview.aggregate.deadlineRisk.level === "critical"
                  ? "error"
                  : preview.aggregate.deadlineRisk.level === "high"
                    ? "warning"
                    : "info"
              }
              showIcon
              message={
                "截止风险：" +
                preview.aggregate.deadlineRisk.level.toUpperCase()
              }
              description={
                "P50 余量 " +
                formatDays(preview.aggregate.deadlineRisk.p50SlackDays) +
                " 天；P90 余量 " +
                formatDays(preview.aggregate.deadlineRisk.p90SlackDays) +
                " 天。"
              }
            />
          ) : null}

          {!canApply ? (
            <Alert
              type="info"
              showIcon
              message="当前为只读估算预览"
              description="你可以查看 P50/P90、关键路径、风险和 What-if，但当前权限不能把估算结果写回任务表。"
            />
          ) : null}

          {preview.schemaAdditions.length > 0 ? (
            <Alert
              type="info"
              showIcon
              message="确认回填时会在同一事务中补齐缺失的估算字段"
              description={
                <Space wrap>
                  {preview.schemaAdditions.map((field) => (
                    <Tag
                      key={field.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FieldTypeIcon type={field.type} />
                      {field.name} · {field.type}
                    </Tag>
                  ))}
                </Space>
              }
            />
          ) : null}

          <Card size="small" title="任务估算明细">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              {preview.tasks.map((task) => {
                const onCriticalPath =
                  preview.aggregate.criticalPathRecordIds.includes(
                    task.recordId,
                  );
                const historyCount = taskHistoryCount(task);
                return (
                  <div
                    key={task.recordId}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "28px minmax(180px, 1.6fr) 80px 90px 90px 135px 110px",
                      gap: 10,
                      alignItems: "center",
                      padding: "9px 0",
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    <Checkbox
                      checked={selectedForApply.has(task.recordId)}
                      onChange={(event) =>
                        toggleApplyRecord(
                          task.recordId,
                          event.target.checked,
                        )
                      }
                    />
                    <div style={{ minWidth: 0 }}>
                      <Space size={5}>
                        <Typography.Text strong ellipsis>
                          {task.title}
                        </Typography.Text>
                        {onCriticalPath ? (
                          <Tag color="purple">关键路径</Tag>
                        ) : null}
                      </Space>
                    </div>
                    <Tag>{task.storyPoints} SP</Tag>
                    <span>{formatHours(task.p50Hours)}h</span>
                    <span>{formatHours(task.p90Hours)}h</span>
                    <div>
                      <Progress
                        percent={Math.round(task.confidenceScore * 100)}
                        size="small"
                        strokeColor={confidenceColor(
                          task.confidenceScore,
                        )}
                      />
                    </div>
                    <Tag color={historyCount > 0 ? "blue" : "default"}>
                      历史 {historyCount} 条
                    </Tag>
                    <div
                      style={{
                        gridColumn: "2 / -1",
                        minWidth: 0,
                        maxWidth: "100%",
                      }}
                    >
                      <Collapse
                        ghost
                        size="small"
                        items={[
                          {
                            key: "why",
                            label: "为什么这样估",
                            children: (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                  minWidth: 0,
                                  maxWidth: "100%",
                                  maxHeight: 300,
                                  overflowY: "auto",
                                  overflowX: "hidden",
                                  paddingRight: 8,
                                }}
                              >
                                <Typography.Paragraph
                                  style={{
                                    margin: 0,
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                    lineHeight: 1.65,
                                  }}
                                >
                                  {task.summary}
                                </Typography.Paragraph>
                                <Typography.Paragraph
                                  type="secondary"
                                  style={{
                                    margin: 0,
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                    lineHeight: 1.65,
                                  }}
                                >
                                  {task.confidenceRationale}
                                </Typography.Paragraph>
                                {(task.basis?.assumptions || []).length >
                                0 ? (
                                  <Space wrap>
                                    {(task.basis?.assumptions || []).map(
                                      (item) => (
                                        <Tag key={item}>{item}</Tag>
                                      ),
                                    )}
                                  </Space>
                                ) : null}
                                {(task.risks || []).map((risk, index) => (
                                  <Alert
                                    key={
                                      String(risk.title || "risk") + index
                                    }
                                    type="warning"
                                    showIcon
                                    message={risk.title || "估算风险"}
                                    description={risk.impact}
                                  />
                                ))}
                              </div>
                            ),
                          },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </Space>
          </Card>

          {preview.aggregate.topUncertainty.length > 0 ? (
            <Card
              size="small"
              title={
                <Space>
                  <WarningOutlined />
                  不确定性最高的任务
                </Space>
              }
            >
              <Space wrap>
                {preview.aggregate.topUncertainty.slice(0, 5).map((item) => (
                  <Tag
                    key={item.recordId}
                    color={riskColor(
                      item.spreadRatio >= 0.8
                        ? "high"
                        : item.spreadRatio >= 0.4
                          ? "medium"
                          : "low",
                    )}
                  >
                    {item.title} · P90-P50 {formatHours(item.spreadHours)}h
                  </Tag>
                ))}
              </Space>
            </Card>
          ) : null}

          <Divider style={{ margin: "0" }} />

          <Card
            size="small"
            title={
              <Space>
                <ExperimentOutlined />
                What-if
              </Space>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "170px 190px 230px 140px",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <Typography.Text>团队人数</Typography.Text>
                <InputNumber
                  min={1}
                  max={50}
                  value={scenarioTeamSize}
                  style={{ width: "100%", marginTop: 6 }}
                  onChange={(value) =>
                    setScenarioTeamSize(Number(value || 1))
                  }
                />
              </div>
              <div>
                <Typography.Text>并行工作流</Typography.Text>
                <InputNumber
                  min={1}
                  max={scenarioTeamSize}
                  value={scenarioStreams}
                  style={{ width: "100%", marginTop: 6 }}
                  onChange={(value) =>
                    setScenarioStreams(
                      Math.max(
                        1,
                        Math.min(
                          Number(value || 1),
                          scenarioTeamSize,
                        ),
                      ),
                    )
                  }
                />
              </div>
              <div>
                <Typography.Text>新的截止时间</Typography.Text>
                <DatePicker
                  value={scenarioDeadline}
                  style={{ width: "100%", marginTop: 6 }}
                  onChange={setScenarioDeadline}
                  placeholder="保持原截止时间"
                />
              </div>
              <Button
                icon={<ExperimentOutlined />}
                loading={whatIfLoading}
                onClick={() => void runWhatIf()}
              >
                重新计算
              </Button>
            </div>

            {whatIfResult ? (
              <div style={{ marginTop: 14 }}>
                <Alert
                  type={
                    whatIfResult.delta.calendarP90Days < 0
                      ? "success"
                      : whatIfResult.delta.calendarP90Days > 0
                        ? "warning"
                        : "info"
                  }
                  showIcon
                  message={
                    "P50 日历工期变化 " +
                    (whatIfResult.delta.calendarP50Days > 0 ? "+" : "") +
                    formatDays(
                      whatIfResult.delta.calendarP50Days,
                    ) +
                    " 天；P90 " +
                    (whatIfResult.delta.calendarP90Days > 0 ? "+" : "") +
                    formatDays(
                      whatIfResult.delta.calendarP90Days,
                    ) +
                    " 天"
                  }
                  description={
                    whatIfResult.scenario.deadlineRisk
                      ? "新场景截止风险：" +
                        whatIfResult.scenario.deadlineRisk.level
                      : "未设置截止时间。"
                  }
                />
              </div>
            ) : null}
          </Card>

          <Alert
            type="warning"
            showIcon
            message="只有点击“回填任务”后才会写入 Story Point / P50 / P90 / 置信度 / Trace；记录在预览后被他人修改会触发版本冲突并整体拒绝。"
          />
        </Space>
      )}

      {phase === "feedback" && feedbackTarget && (
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message={"反馈实际结果：" + feedbackTarget.title}
            description="反馈会进入当前用户、当前 Workspace 的历史校准样本，不会跨 Workspace 泄漏。"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.2fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <Typography.Text strong>实际工时</Typography.Text>
              <InputNumber
                min={0}
                precision={1}
                addonAfter="h"
                value={actualHours}
                style={{ width: "100%", marginTop: 8 }}
                onChange={(value) =>
                  setActualHours(
                    value === null ? null : Number(value),
                  )
                }
              />
            </div>
            <div>
              <Typography.Text strong>实际 Story Point</Typography.Text>
              <InputNumber
                min={0}
                precision={1}
                value={actualStoryPoints}
                style={{ width: "100%", marginTop: 8 }}
                onChange={(value) =>
                  setActualStoryPoints(
                    value === null ? null : Number(value),
                  )
                }
              />
            </div>
            <div>
              <Typography.Text strong>结果</Typography.Text>
              <Select
                value={outcomeStatus}
                style={{ width: "100%", marginTop: 8 }}
                options={[
                  {
                    value: "better_than_expected",
                    label: "比预期更快",
                  },
                  { value: "on_track", label: "基本符合" },
                  {
                    value: "worse_than_expected",
                    label: "比预期更慢",
                  },
                ]}
                onChange={setOutcomeStatus}
              />
            </div>
            <div>
              <Typography.Text strong>准确度评分</Typography.Text>
              <InputNumber
                min={1}
                max={5}
                value={accuracyRating}
                style={{ width: "100%", marginTop: 8 }}
                onChange={(value) =>
                  setAccuracyRating(
                    value === null ? null : Number(value),
                  )
                }
              />
            </div>
          </div>
          <div>
            <Typography.Text strong>备注</Typography.Text>
            <Input.TextArea
              value={feedbackNotes}
              autoSize={{ minRows: 2, maxRows: 5 }}
              style={{ marginTop: 8 }}
              placeholder="例如：需求范围中途扩大；接口联调比预期复杂"
              onChange={(event) =>
                setFeedbackNotes(event.target.value)
              }
            />
          </div>
        </Space>
      )}

      {phase === "result" && applyResult && (
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="success"
            showIcon
            message={
              applyResult.idempotent
                ? "估算结果已存在，没有重复写入"
                : "估算结果已安全回填"
            }
            description={
              "已覆盖 " +
              applyResult.appliedRecordIds.length +
              " 条任务；ChangeSet " +
              (applyResult.changeSetIds.join(", ") || "无新增修改")
            }
          />
          <Card size="small" title="后续校准">
            <Typography.Text type="secondary">
              任务完成后，勾选一条已回填估算的任务并重新打开“AI 估工期”，即可提交实际工时 / Story Point；后续估算会显示使用的历史样本数量。
            </Typography.Text>
          </Card>
        </Space>
      )}

      {(previewLoading ||
        applyLoading ||
        whatIfLoading ||
        feedbackLoading) &&
      phase !== "input" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.68)",
          }}
        >
          <Spin
            tip={
              applyLoading
                ? "正在原子回填估算结果…"
                : feedbackLoading
                  ? "正在记录实际结果…"
                  : whatIfLoading
                    ? "正在重新计算场景…"
                    : "正在估算任务工作量与依赖工期…"
            }
          />
        </div>
      ) : null}
    </Modal>
  );
}
