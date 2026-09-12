import { useEffect, useMemo, useState } from "react";
import {
  BranchesOutlined,
  CheckCircleOutlined,
  EditOutlined,
  RobotOutlined,
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
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import {
  APPLY_TASK_PLANNING,
  PREVIEW_TASK_PLANNING,
} from "../../lib/graphql";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import type {
  TaskPlanningApplyResult,
  TaskPlanningDecision,
  TaskPlanningDecisionAction,
  TaskPlanningDuplicateCandidate,
  TaskPlanningNode,
  TaskPlanningPlan,
  TaskPlanningPreview,
} from "./taskPlanningTypes";

const { TextArea } = Input;

type TaskPlanningModalProps = {
  open: boolean;
  workspaceId: string;
  targetTableId: string;
  onClose: () => void;
  onApplied?: (result: TaskPlanningApplyResult) => void | Promise<void>;
  sourceReference?: Record<string, unknown> | null;
};

const priorityOptions = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

const actionOptions = [
  { value: "create", label: "新建任务" },
  { value: "reuse", label: "复用已有任务" },
  { value: "merge", label: "合并到已有任务" },
  { value: "skip", label: "本次跳过" },
];

const clonePlan = (plan: TaskPlanningPlan): TaskPlanningPlan =>
  JSON.parse(JSON.stringify(plan)) as TaskPlanningPlan;

const walkNodes = (
  root: TaskPlanningNode,
  callback: (node: TaskPlanningNode, parent: TaskPlanningNode | null) => void,
  parent: TaskPlanningNode | null = null,
) => {
  callback(root, parent);
  root.children.forEach((child) => walkNodes(child, callback, root));
};

const executableNodes = (plan: TaskPlanningPlan | null) => {
  if (!plan) return [] as TaskPlanningNode[];
  const output: TaskPlanningNode[] = [];
  plan.root.children.forEach((child) =>
    walkNodes(child, (node) => output.push(node)),
  );
  return output;
};

const updateNodeRecursive = (
  node: TaskPlanningNode,
  key: string,
  updater: (node: TaskPlanningNode) => void,
): boolean => {
  if (node.key === key) {
    updater(node);
    return true;
  }
  for (const child of node.children) {
    if (updateNodeRecursive(child, key, updater)) return true;
  }
  return false;
};

const nodeDepthPadding = (depth?: number) =>
  Math.max(0, Math.min(4, Number(depth || 0))) * 14;

const formatPercent = (score: number) => Math.round(score * 100) + "%";

export function TaskPlanningModal({
  open,
  workspaceId,
  targetTableId,
  onClose,
  onApplied,
  sourceReference,
}: TaskPlanningModalProps) {
  const fields = useSmartTableStore((state) => state.fields);
  const records = useSmartTableStore((state) => state.records);
  const selectedRecordIds = useSmartTableStore(
    (state) => state.selectedRecordIds,
  );
  const currentTableName = useSmartTableStore(
    (state) => state.currentTableName,
  );

  const [phase, setPhase] = useState<"input" | "preview" | "result">("input");
  const [goal, setGoal] = useState("");
  const [teamSize, setTeamSize] = useState<number | null>(3);
  const [deadline, setDeadline] = useState<Dayjs | null>(null);
  const [granularity, setGranularity] = useState<
    "coarse" | "balanced" | "fine"
  >("balanced");
  const [sourceNotes, setSourceNotes] = useState("");
  const [useSingleSelectionAsParent, setUseSingleSelectionAsParent] =
    useState(false);
  const [preview, setPreview] = useState<TaskPlanningPreview | null>(null);
  const [plan, setPlan] = useState<TaskPlanningPlan | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, TaskPlanningDecision>
  >({});
  const [allowRepeat, setAllowRepeat] = useState(false);
  const [applyResult, setApplyResult] =
    useState<TaskPlanningApplyResult | null>(null);

  const [previewMutation, { loading: previewLoading }] = useMutation(
    PREVIEW_TASK_PLANNING,
  );
  const [applyMutation, { loading: applyLoading }] =
    useMutation(APPLY_TASK_PLANNING);

  const titleField = fields[0] || null;
  const selectedRecords = useMemo(() => {
    const selected = new Set(selectedRecordIds);
    return records.filter((record) => selected.has(String(record.id)));
  }, [records, selectedRecordIds]);
  const selectedTitles = useMemo(
    () =>
      selectedRecords
        .map((record) =>
          titleField ? String(record[titleField.id] || "").trim() : String(record.id),
        )
        .filter(Boolean),
    [selectedRecords, titleField],
  );

  useEffect(() => {
    if (!open) return;
    setPhase("input");
    setPreview(null);
    setPlan(null);
    setDecisions({});
    setApplyResult(null);
    setAllowRepeat(false);
    setDeadline(null);
    setTeamSize(3);
    setGranularity("balanced");
    setSourceNotes("");
    setUseSingleSelectionAsParent(selectedRecordIds.length === 1);
    if (selectedTitles.length === 1) {
      setGoal("继续拆解任务：“" + selectedTitles[0] + "”，形成可执行子任务");
    } else if (selectedTitles.length > 1) {
      setGoal(
        "基于当前选中的 " +
          selectedTitles.length +
          " 条任务重新规划下一步执行任务",
      );
    } else {
      setGoal(
        currentTableName
          ? "为“" + currentTableName + "”规划下一批可执行任务"
          : "",
      );
    }
  }, [currentTableName, open, selectedRecordIds.length, selectedTitles]);

  const maxDepth =
    granularity === "coarse" ? 2 : granularity === "fine" ? 4 : 3;
  const maxChildrenPerNode =
    granularity === "coarse" ? 6 : granularity === "fine" ? 10 : 8;

  const currentSourceReference = useMemo(() => {
    if (sourceReference) {
      return {
        ...sourceReference,
        ...(sourceNotes.trim() ? { userContext: sourceNotes.trim() } : {}),
      };
    }
    if (!sourceNotes.trim()) return null;
    return {
      type: "manual",
      userContext: sourceNotes.trim(),
    };
  }, [sourceNotes, sourceReference]);

  const initializeDecisions = (payload: TaskPlanningPreview) => {
    const next: Record<string, TaskPlanningDecision> = {};
    const nodes = executableNodes(payload.plan);
    nodes.forEach((node) => {
      const candidate = payload.duplicates[node.key]?.[0];
      if (candidate && candidate.score >= 0.95) {
        next[node.key] = {
          nodeKey: node.key,
          action: "reuse",
          recordId: candidate.recordId,
        };
      } else {
        next[node.key] = {
          nodeKey: node.key,
          action: "create",
        };
      }
    });
    setDecisions(next);
  };

  const handlePreview = async () => {
    if (!goal.trim() || !workspaceId || !targetTableId) return;
    const parentTaskId =
      useSingleSelectionAsParent && selectedRecordIds.length === 1
        ? selectedRecordIds[0]
        : null;
    try {
      const response = await previewMutation({
        variables: {
          goal: goal.trim(),
          workspaceId,
          targetTableId,
          projectId: null,
          parentTaskId,
          selectedRecordIds,
          sourceReference: currentSourceReference,
          deadline: deadline ? deadline.format("YYYY-MM-DD") : null,
          teamSize,
          granularity,
          maxDepth,
          maxChildrenPerNode,
          locale: "zh-CN",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        },
      });
      const payload = (
        response as unknown as {
          data?: { previewTaskPlanning?: TaskPlanningPreview };
        }
      ).data?.previewTaskPlanning;
      if (!payload?.planId || !payload.plan?.root) {
        throw new Error("empty-task-planning-preview");
      }
      setPreview(payload);
      setPlan(clonePlan(payload.plan));
      initializeDecisions(payload);
      setAllowRepeat(false);
      setPhase("preview");
    } catch (error) {
      const text =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
      message.error(text || "AI 任务规划失败，请检查模型配置或稍后重试。");
    }
  };

  const updateNode = (
    key: string,
    updater: (node: TaskPlanningNode) => void,
  ) => {
    setPlan((current) => {
      if (!current) return current;
      const next = clonePlan(current);
      updateNodeRecursive(next.root, key, updater);
      return next;
    });
  };

  const setDecision = (
    nodeKey: string,
    action: TaskPlanningDecisionAction,
    candidate?: TaskPlanningDuplicateCandidate,
  ) => {
    setDecisions((current) => {
      const previous = current[nodeKey];
      const candidates = preview?.duplicates[nodeKey] || [];
      const fallbackRecordId =
        candidate?.recordId ||
        previous?.recordId ||
        candidates[0]?.recordId ||
        null;
      return {
        ...current,
        [nodeKey]: {
          nodeKey,
          action,
          recordId:
            action === "reuse" || action === "merge"
              ? fallbackRecordId
              : undefined,
        },
      };
    });
  };

  const setDecisionRecord = (nodeKey: string, recordId: string) => {
    setDecisions((current) => ({
      ...current,
      [nodeKey]: {
        ...(current[nodeKey] || { nodeKey, action: "reuse" }),
        nodeKey,
        recordId,
      },
    }));
  };

  const handleApply = async () => {
    if (!preview || !plan) return;
    const invalid = Object.values(decisions).find(
      (decision) =>
        (decision.action === "reuse" || decision.action === "merge") &&
        !decision.recordId,
    );
    if (invalid) {
      message.warning("请选择要复用或合并的已有任务。");
      return;
    }
    try {
      const response = await applyMutation({
        variables: {
          planId: preview.planId,
          workspaceId,
          targetTableId,
          plan,
          decisions: Object.values(decisions),
          allowRepeat,
        },
      });
      const payload = (
        response as unknown as {
          data?: { applyTaskPlanning?: TaskPlanningApplyResult };
        }
      ).data?.applyTaskPlanning;
      if (!payload?.planId || !payload.result) {
        throw new Error("empty-task-planning-apply");
      }
      setApplyResult(payload);
      setPhase("result");
      try {
        await onApplied?.(payload);
      } catch {
        // Apply already committed atomically. Refresh failures are separate.
      }
      message.success(
        payload.status === "deduplicated"
          ? "检测到同一来源已应用，已复用原规划结果。"
          : "任务规划已写入当前表。",
      );
    } catch (error) {
      const text =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
      message.error(
        text || "任务规划写入失败；服务端已回滚，不会留下半成品任务。",
      );
    }
  };

  const renderTaskNode = (node: TaskPlanningNode) => {
    const candidates = preview?.duplicates[node.key] || [];
    const decision = decisions[node.key] || {
      nodeKey: node.key,
      action: "create" as const,
    };
    const isSkipped = decision.action === "skip";
    return (
      <Card
        key={node.key}
        size="small"
        style={{
          marginLeft: nodeDepthPadding(node.depth),
          opacity: isSkipped ? 0.58 : 1,
          borderColor:
            candidates.length > 0 && !isSkipped ? "#F59E0B" : undefined,
        }}
        title={
          <Space wrap size={6}>
            <Tag>{node.key}</Tag>
            <span>{node.title || "未命名任务"}</span>
            {node.priority ? (
              <Tag
                color={
                  node.priority === "urgent"
                    ? "red"
                    : node.priority === "high"
                      ? "orange"
                      : "blue"
                }
              >
                {priorityOptions.find((item) => item.value === node.priority)?.label ||
                  node.priority}
              </Tag>
            ) : null}
            {candidates.length > 0 ? (
              <Tag icon={<WarningOutlined />} color="warning">
                {candidates.length} 个相似任务
              </Tag>
            ) : null}
          </Space>
        }
        extra={
          <Select
            size="small"
            value={decision.action}
            options={actionOptions}
            style={{ width: 132 }}
            onChange={(value) =>
              setDecision(node.key, value as TaskPlanningDecisionAction)
            }
          />
        }
      >
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          {(decision.action === "reuse" || decision.action === "merge") && (
            <Select
              value={decision.recordId || undefined}
              style={{ width: "100%" }}
              placeholder="选择已有任务"
              options={candidates.map((candidate) => ({
                value: candidate.recordId,
                label:
                  candidate.title +
                  " · 相似度 " +
                  formatPercent(candidate.score) +
                  " · " +
                  candidate.reason,
              }))}
              onChange={(recordId) => setDecisionRecord(node.key, recordId)}
              notFoundContent="没有可复用的相似任务，请改为新建"
            />
          )}

          <Input
            disabled={isSkipped || decision.action === "reuse"}
            value={node.title}
            prefix={<EditOutlined />}
            onChange={(event) =>
              updateNode(node.key, (draft) => {
                draft.title = event.target.value;
              })
            }
            placeholder="任务标题"
          />
          <TextArea
            disabled={isSkipped || decision.action === "reuse"}
            value={node.description || ""}
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(event) =>
              updateNode(node.key, (draft) => {
                draft.description = event.target.value;
              })
            }
            placeholder="任务描述"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px minmax(0,1fr) minmax(0,1fr) 170px",
              gap: 8,
            }}
          >
            <Select
              disabled={isSkipped || decision.action === "reuse"}
              value={node.priority || "medium"}
              options={priorityOptions}
              onChange={(value) =>
                updateNode(node.key, (draft) => {
                  draft.priority = value;
                })
              }
            />
            <Input
              disabled={isSkipped || decision.action === "reuse"}
              value={node.milestone || ""}
              placeholder="里程碑"
              onChange={(event) =>
                updateNode(node.key, (draft) => {
                  draft.milestone = event.target.value;
                })
              }
            />
            <Input
              disabled={isSkipped || decision.action === "reuse"}
              value={node.suggestedRole || ""}
              placeholder="建议角色"
              onChange={(event) =>
                updateNode(node.key, (draft) => {
                  draft.suggestedRole = event.target.value;
                })
              }
            />
            <InputNumber
              disabled={isSkipped || decision.action === "reuse"}
              min={0}
              precision={1}
              addonAfter="h"
              style={{ width: "100%" }}
              value={
                node.estimate?.bufferedHours ??
                node.estimate?.likelyHours ??
                undefined
              }
              onChange={(value) =>
                updateNode(node.key, (draft) => {
                  draft.estimate = {
                    ...(draft.estimate || {}),
                    bufferedHours: Number(value || 0),
                  };
                })
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <TextArea
              disabled={isSkipped || decision.action === "reuse"}
              value={(node.deliverables || []).join("\n")}
              autoSize={{ minRows: 2, maxRows: 5 }}
              placeholder="交付物，每行一项"
              onChange={(event) =>
                updateNode(node.key, (draft) => {
                  draft.deliverables = event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean);
                })
              }
            />
            <TextArea
              disabled={isSkipped || decision.action === "reuse"}
              value={(node.acceptanceCriteria || []).join("\n")}
              autoSize={{ minRows: 2, maxRows: 5 }}
              placeholder="验收标准，每行一项"
              onChange={(event) =>
                updateNode(node.key, (draft) => {
                  draft.acceptanceCriteria = event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean);
                })
              }
            />
          </div>

          {(node.dependsOn || []).length > 0 ? (
            <Space wrap size={4}>
              <Typography.Text type="secondary">前置依赖：</Typography.Text>
              {(node.dependsOn || []).map((key) => (
                <Tag key={key}>{key}</Tag>
              ))}
            </Space>
          ) : null}

          {candidates.length > 0 ? (
            <Collapse
              size="small"
              items={[
                {
                  key: "duplicates",
                  label: "查看相似任务",
                  children: (
                    <Space orientation="vertical" size={6} style={{ width: "100%" }}>
                      {candidates.map((candidate) => (
                        <div
                          key={candidate.recordId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div>
                            <div>{candidate.title}</div>
                            <Typography.Text type="secondary">
                              相似度 {formatPercent(candidate.score)} · {candidate.reason}
                            </Typography.Text>
                          </div>
                          <Space>
                            <Button
                              size="small"
                              onClick={() =>
                                setDecision(node.key, "reuse", candidate)
                              }
                            >
                              复用
                            </Button>
                            <Button
                              size="small"
                              onClick={() =>
                                setDecision(node.key, "merge", candidate)
                              }
                            >
                              合并
                            </Button>
                          </Space>
                        </div>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          ) : null}
        </Space>
      </Card>
    );
  };

  const planNodes = executableNodes(plan);
  const createdCount = applyResult?.result.created?.length || 0;
  const reusedCount = applyResult?.result.reused?.length || 0;
  const mergedCount = applyResult?.result.merged?.length || 0;
  const skippedCount = applyResult?.result.skipped?.length || 0;

  const footer =
    phase === "input"
      ? [
          <Button key="cancel" onClick={onClose}>
            取消
          </Button>,
          <Button
            key="preview"
            type="primary"
            icon={<RobotOutlined />}
            loading={previewLoading}
            disabled={!goal.trim() || !workspaceId || !targetTableId}
            onClick={() => void handlePreview()}
          >
            生成任务规划
          </Button>,
        ]
      : phase === "preview"
        ? [
            <Button
              key="back"
              disabled={applyLoading}
              onClick={() => setPhase("input")}
            >
              返回修改目标
            </Button>,
            <Button
              key="apply"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={applyLoading}
              disabled={!plan || planNodes.length === 0}
              onClick={() => void handleApply()}
            >
              确认写入任务
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
      width={1060}
      maskClosable={!applyLoading}
      closable={!applyLoading}
      destroyOnHidden
      title={
        <Space>
          <BranchesOutlined style={{ color: "#7C3AED" }} />
          <span>AI 任务规划</span>
          {selectedRecordIds.length > 0 ? (
            <Tag color="purple">已选 {selectedRecordIds.length} 条</Tag>
          ) : null}
        </Space>
      }
    >
      {phase === "input" && (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="先生成任务树并检查，再决定新建、复用、合并或跳过；确认前不会修改当前任务表。"
          />
          <div>
            <Typography.Text strong>要规划什么？</Typography.Text>
            <TextArea
              value={goal}
              autoSize={{ minRows: 3, maxRows: 6 }}
              maxLength={4000}
              showCount
              style={{ marginTop: 8 }}
              placeholder="例如：把博客改版目标拆成可以直接执行和验收的任务"
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>

          {selectedTitles.length > 0 ? (
            <Card size="small" title="当前选中任务">
              <Space wrap>
                {selectedTitles.slice(0, 12).map((title, index) => (
                  <Tag key={selectedRecordIds[index] || title}>{title}</Tag>
                ))}
                {selectedTitles.length > 12 ? (
                  <Tag>+{selectedTitles.length - 12}</Tag>
                ) : null}
              </Space>
              {selectedRecordIds.length === 1 ? (
                <div style={{ marginTop: 10 }}>
                  <Checkbox
                    checked={useSingleSelectionAsParent}
                    onChange={(event) =>
                      setUseSingleSelectionAsParent(event.target.checked)
                    }
                  >
                    将这条任务作为父任务继续向下拆解
                  </Checkbox>
                </div>
              ) : null}
            </Card>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "210px 230px 220px minmax(0,1fr)",
              gap: 10,
            }}
          >
            <div>
              <Typography.Text strong>拆分粒度</Typography.Text>
              <Select
                value={granularity}
                style={{ width: "100%", marginTop: 8 }}
                options={[
                  { value: "coarse", label: "粗粒度 · 2 层" },
                  { value: "balanced", label: "均衡 · 3 层" },
                  { value: "fine", label: "细粒度 · 最多 4 层" },
                ]}
                onChange={setGranularity}
              />
            </div>
            <div>
              <Typography.Text strong>团队人数</Typography.Text>
              <InputNumber
                min={1}
                max={200}
                value={teamSize}
                style={{ width: "100%", marginTop: 8 }}
                onChange={setTeamSize}
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
              <Typography.Text strong>来源资料 / 补充上下文</Typography.Text>
              <Input
                value={sourceNotes}
                style={{ marginTop: 8 }}
                placeholder="可选；QNote 来源也会在这里一起传入"
                onChange={(event) => setSourceNotes(event.target.value)}
              />
            </div>
          </div>
        </Space>
      )}

      {phase === "preview" && preview && plan && (
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="success"
            showIcon
            message={
              "已生成 " +
              planNodes.length +
              " 个执行任务 · " +
              preview.provider +
              " / " +
              preview.model
            }
            description={plan.summary}
          />

          {preview.schemaAdditions.length > 0 ? (
            <Alert
              type="info"
              showIcon
              message="当前任务表缺少部分规划字段"
              description={
                <Space wrap>
                  <span>确认写入时会在同一事务中自动补齐：</span>
                  {preview.schemaAdditions.map((field) => (
                    <Tag key={field.id}>
                      {field.name} · {field.type}
                    </Tag>
                  ))}
                </Space>
              }
            />
          ) : null}

          {preview.previousApplication ? (
            <Alert
              type="warning"
              showIcon
              message="检测到同一来源已经应用过任务规划"
              description={
                <Checkbox
                  checked={allowRepeat}
                  onChange={(event) => setAllowRepeat(event.target.checked)}
                >
                  我确认仍要新建/应用另一套规划；否则服务端会幂等复用原结果
                </Checkbox>
              }
            />
          ) : null}

          {Object.keys(preview.duplicates).length > 0 ? (
            <Alert
              type="warning"
              showIcon
              message="发现与现有任务相似的建议项"
              description="完全重复项默认建议“复用”；你可以逐项改为新建、合并或跳过。合并只填充已有记录中的空字段，不覆盖现有内容。"
            />
          ) : null}

          <Card size="small">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <Typography.Text strong>规划目标</Typography.Text>
              <Input
                value={plan.goal}
                onChange={(event) =>
                  setPlan((current) =>
                    current ? { ...current, goal: event.target.value } : current,
                  )
                }
              />
              {(plan.assumptions || []).length > 0 ? (
                <Space wrap>
                  <Typography.Text type="secondary">假设：</Typography.Text>
                  {(plan.assumptions || []).map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              ) : null}
            </Space>
          </Card>

          <Divider style={{ margin: "0" }} />

          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            {planNodes.map((node) => renderTaskNode(node))}
          </Space>

          <Alert
            type="warning"
            showIcon
            message="点击“确认写入任务”后，字段补齐、任务创建/合并、父子关系、前置依赖和 ChangeSet 审计会在一个服务端事务中完成。"
          />
        </Space>
      )}

      {phase === "result" && applyResult && (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="success"
            showIcon
            message={
              applyResult.status === "deduplicated"
                ? "任务规划已幂等复用"
                : "任务规划已成功写入"
            }
            description={
              applyResult.status === "deduplicated"
                ? "同一来源之前已经应用过，服务端没有重复创建任务。"
                : "所有创建和合并都已提交；如果过程中有异常，服务端会整体回滚。"
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {[
              ["新建", createdCount],
              ["复用", reusedCount],
              ["合并", mergedCount],
              ["跳过", skippedCount],
            ].map(([label, value]) => (
              <Card key={String(label)} size="small">
                <Typography.Text type="secondary">{label}</Typography.Text>
                <Typography.Title level={4} style={{ margin: "4px 0 0" }}>
                  {value}
                </Typography.Title>
              </Card>
            ))}
          </div>

          {applyResult.result.changeSetId ? (
            <Typography.Text type="secondary">
              审计 ChangeSet：{applyResult.result.changeSetId}
            </Typography.Text>
          ) : null}
        </Space>
      )}

      {(previewLoading || applyLoading) && phase !== "input" ? (
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
                ? "正在原子写入任务规划…"
                : "正在理解上下文并生成任务树…"
            }
          />
        </div>
      ) : null}
    </Modal>
  );
}
