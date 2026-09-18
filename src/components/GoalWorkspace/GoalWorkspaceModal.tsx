import { useEffect, useMemo, useState } from "react";
import {
  ApartmentOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  ProjectOutlined,
  RobotOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { useMutation } from "@apollo/client/react";
import { FieldTypeIcon } from "../SmartTable/FieldTypeIcon";
import {
  Alert,
  Button,
  Card,
  Collapse,
  DatePicker,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  APPLY_GOAL_WORKSPACE_BLUEPRINT,
  PREVIEW_GOAL_WORKSPACE,
} from "../../lib/graphql";
import type {
  GoalWorkspaceApplyResult,
  GoalWorkspaceBlueprint,
  GoalWorkspacePreview,
} from "./goalWorkspaceTypes";

const { TextArea } = Input;

type GoalWorkspaceModalProps = {
  open: boolean;
  workspaceId: string;
  parentId: string;
  initialGoal?: string;
  onClose: () => void;
  onCreated?: (result: GoalWorkspaceApplyResult) => void | Promise<void>;
};

const fieldTypeLabel: Record<string, string> = {
  text: "文本",
  number: "数字",
  select: "单选",
  multiSelect: "多选",
  member: "成员",
  date: "日期",
  progress: "进度",
  rating: "评分",
  url: "网址",
  email: "邮箱",
  phone: "电话",
  attachment: "附件",
  autoNumber: "自动编号",
  relation: "关联记录",
};

const viewIcon = (type: string) => {
  if (type === "gantt") return <ProjectOutlined />;
  if (type === "calendar") return <CalendarOutlined />;
  if (type === "board") return <ApartmentOutlined />;
  return <TableOutlined />;
};

const cloneBlueprint = (value: GoalWorkspaceBlueprint): GoalWorkspaceBlueprint =>
  JSON.parse(JSON.stringify(value)) as GoalWorkspaceBlueprint;

const sanitizeFieldRemoval = (
  blueprint: GoalWorkspaceBlueprint,
  tableKey: string,
  fieldKey: string,
) => {
  for (const table of blueprint.tables) {
    for (const field of table.fields) {
      if (field.type !== "relation" || !field.property) continue;
      const targetTableKey = String(field.property.targetTableKey || table.key);
      const displayFieldKey = String(field.property.displayFieldKey || "");
      if (targetTableKey === tableKey && displayFieldKey === fieldKey) {
        const nextProperty = { ...field.property };
        delete nextProperty.displayFieldKey;
        field.property = nextProperty;
      }
    }
  }

  const targetTable = blueprint.tables.find((table) => table.key === tableKey);
  if (targetTable) {
    for (const view of targetTable.views) {
      const config = { ...(view.config || {}) };
      for (const key of [
        "groupFieldKey",
        "startFieldKey",
        "endFieldKey",
        "progressFieldKey",
        "coverFieldKey",
        "titleFieldKey",
      ]) {
        if (String(config[key] || "") === fieldKey) {
          delete config[key];
        }
      }
      view.config = config;
    }
  }

  for (const dashboard of blueprint.dashboards) {
    for (const widget of dashboard.widgets) {
      if (widget.tableKey !== tableKey) continue;
      if (widget.dimensionFieldKey === fieldKey) {
        delete widget.dimensionFieldKey;
      }
      if (widget.metric?.fieldKey === fieldKey) {
        widget.metric = { aggregation: "count" };
      }
    }
  }
};

export function GoalWorkspaceModal({
  open,
  workspaceId,
  parentId,
  initialGoal = "",
  onClose,
  onCreated,
}: GoalWorkspaceModalProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"input" | "preview" | "result">("input");
  const [goal, setGoal] = useState(initialGoal);
  const [teamSize, setTeamSize] = useState<number | null>(3);
  const [deadline, setDeadline] = useState<Dayjs | null>(null);
  const [context, setContext] = useState("");
  const [refinement, setRefinement] = useState("");
  const [traceId, setTraceId] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [blueprint, setBlueprint] = useState<GoalWorkspaceBlueprint | null>(null);
  const [applyResult, setApplyResult] = useState<GoalWorkspaceApplyResult | null>(null);

  const [previewMutation, { loading: previewLoading }] = useMutation(
    PREVIEW_GOAL_WORKSPACE,
  );
  const [applyMutation, { loading: applyLoading }] = useMutation(
    APPLY_GOAL_WORKSPACE_BLUEPRINT,
  );

  useEffect(() => {
    if (!open) return;
    setPhase("input");
    setGoal(initialGoal);
    setTeamSize(3);
    setDeadline(null);
    setContext("");
    setRefinement("");
    setTraceId("");
    setGenerationMode("");
    setWarnings([]);
    setBlueprint(null);
    setApplyResult(null);
  }, [initialGoal, open]);

  const firstCreatedTable = applyResult?.created.tables?.[0] || null;
  const canGenerate =
    Boolean(workspaceId && parentId && goal.trim()) && !previewLoading && !applyLoading;

  const summary = useMemo(() => {
    if (!blueprint) return null;
    return {
      tables: blueprint.tables.length,
      fields: blueprint.tables.reduce((sum, table) => sum + table.fields.length, 0),
      views: blueprint.tables.reduce((sum, table) => sum + table.views.length, 0),
      dashboards: blueprint.dashboards.length,
    };
  }, [blueprint]);

  const requestPreview = async (
    currentBlueprint?: GoalWorkspaceBlueprint | null,
    instruction?: string | null,
  ) => {
    if (!workspaceId || !parentId || !goal.trim()) return;
    try {
      const response = await previewMutation({
        variables: {
          goal: goal.trim(),
          workspaceId,
          parentId,
          teamSize,
          deadline: deadline ? deadline.format("YYYY-MM-DD") : null,
          currentBlueprint: currentBlueprint || null,
          instruction: instruction || null,
        },
      });
      const payload = (
        response as unknown as {
          data?: { previewGoalWorkspace?: GoalWorkspacePreview };
        }
      ).data?.previewGoalWorkspace;
      if (!payload?.traceId || !payload.blueprint) {
        throw new Error("preview-empty");
      }
      setTraceId(payload.traceId);
      setGenerationMode(payload.generationMode || "");
      setWarnings(payload.warnings || []);
      setBlueprint(payload.blueprint);
      setPhase("preview");
      setRefinement("");
    } catch {
      message.error("项目蓝图生成失败，请检查 AI 配置或稍后重试。");
    }
  };

  const handleGenerate = () => {
    const instruction = context.trim() || null;
    void requestPreview(null, instruction);
  };

  const handleRefine = () => {
    if (!blueprint || !refinement.trim()) return;
    void requestPreview(blueprint, refinement.trim());
  };

  const updateBlueprint = (
    updater: (draft: GoalWorkspaceBlueprint) => void,
  ) => {
    setBlueprint((current) => {
      if (!current) return current;
      const next = cloneBlueprint(current);
      updater(next);
      return next;
    });
  };

  const removeTable = (tableIndex: number) => {
    updateBlueprint((draft) => {
      if (draft.tables.length <= 1) return;
      const removedKey = draft.tables[tableIndex]?.key;
      if (!removedKey) return;
      draft.tables.splice(tableIndex, 1);
      for (const table of draft.tables) {
        table.fields = table.fields.filter((field) => {
          if (field.type !== "relation") return true;
          const target = String(field.property?.targetTableKey || table.key);
          return target !== removedKey;
        });
      }
      for (const dashboard of draft.dashboards) {
        dashboard.widgets = dashboard.widgets.filter(
          (widget) => widget.tableKey !== removedKey,
        );
      }
    });
  };

  const removeField = (tableIndex: number, fieldIndex: number) => {
    updateBlueprint((draft) => {
      const table = draft.tables[tableIndex];
      if (!table || table.fields.length <= 1) return;
      const field = table.fields[fieldIndex];
      if (!field) return;
      table.fields.splice(fieldIndex, 1);
      sanitizeFieldRemoval(draft, table.key, field.key);
    });
  };

  const removeView = (tableIndex: number, viewIndex: number) => {
    updateBlueprint((draft) => {
      const table = draft.tables[tableIndex];
      if (!table || table.views.length <= 1) return;
      table.views.splice(viewIndex, 1);
    });
  };

  const handleApply = async () => {
    if (!blueprint || !traceId || !workspaceId || !parentId) return;
    try {
      const response = await applyMutation({
        variables: {
          traceId,
          blueprint,
          workspaceId,
          parentId,
        },
      });
      const payload = (
        response as unknown as {
          data?: { applyGoalWorkspaceBlueprint?: GoalWorkspaceApplyResult };
        }
      ).data?.applyGoalWorkspaceBlueprint;
      if (!payload || payload.status !== "applied") {
        throw new Error("apply-failed");
      }
      setApplyResult(payload);
      setPhase("result");
      try {
        await onCreated?.(payload);
      } catch {
        // The workspace itself is already committed. A refresh callback failure
        // must never be presented as a failed atomic creation.
      }
      message.success(
        payload.idempotent
          ? "该项目已经创建过，已返回原创建结果。"
          : "项目工作区创建完成。",
      );
    } catch {
      message.error("创建失败，服务端已回滚本次操作，不会留下半成品。");
    }
  };

  const openCreatedTable = () => {
    if (!firstCreatedTable) return;
    onClose();
    navigate(
      "/workbench/" +
        firstCreatedTable.id +
        "/" +
        (firstCreatedTable.defaultViewId || "v1"),
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
            disabled={!canGenerate}
            loading={previewLoading}
            onClick={handleGenerate}
          >
            生成项目蓝图
          </Button>,
        ]
      : phase === "preview"
        ? [
            <Button key="back" onClick={() => setPhase("input")} disabled={applyLoading}>
              返回修改目标
            </Button>,
            <Button
              key="apply"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={applyLoading}
              disabled={!blueprint || !traceId || blueprint.tables.length === 0}
              onClick={() => void handleApply()}
            >
              确认并创建
            </Button>,
          ]
        : [
            <Button key="close" onClick={onClose}>
              稍后再看
            </Button>,
            <Button
              key="open"
              type="primary"
              disabled={!firstCreatedTable}
              onClick={openCreatedTable}
            >
              打开任务表
            </Button>,
          ];

  return (
    <Modal
      open={open}
      onCancel={applyLoading ? undefined : onClose}
      footer={footer}
      width={960}
      maskClosable={!applyLoading}
      closable={!applyLoading}
      destroyOnHidden
      title={
        <Space>
          <RobotOutlined style={{ color: "#2563eb" }} />
          <span>描述目标，创建可直接工作的项目</span>
        </Space>
      }
    >
      {phase === "input" && (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="AI 只生成 Blueprint。确认之前不会创建表、视图或仪表盘。"
          />
          {!workspaceId || !parentId ? (
            <Alert
              type="error"
              showIcon
              message="当前工作空间尚未准备好，无法生成项目。"
            />
          ) : null}
          <div>
            <Typography.Text strong>你想完成什么？</Typography.Text>
            <TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              value={goal}
              maxLength={2000}
              showCount
              onChange={(event) => setGoal(event.target.value)}
              placeholder="例如：我要管理一个 3 人完成的个人博客改版项目，预计 3 周完成，需要拆任务、看进度和风险。"
              style={{ marginTop: 8 }}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 260px minmax(0, 1fr)",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div>
              <Typography.Text strong>团队人数</Typography.Text>
              <InputNumber
                min={1}
                max={200}
                value={teamSize}
                onChange={(value) => setTeamSize(value)}
                style={{ width: "100%", marginTop: 8 }}
                placeholder="可选"
              />
            </div>
            <div>
              <Typography.Text strong>目标截止时间</Typography.Text>
              <DatePicker
                value={deadline}
                onChange={setDeadline}
                style={{ width: "100%", marginTop: 8 }}
                placeholder="可选"
              />
            </div>
            <div>
              <Typography.Text strong>已有资料 / 额外约束</Typography.Text>
              <Input
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="例如：已有设计稿；不要工时字段；需要上线环境"
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        </Space>
      )}

      {phase === "preview" && blueprint && (
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type={generationMode === "ai" ? "success" : "warning"}
            showIcon
            message={
              generationMode === "ai"
                ? "已根据目标生成 AI Blueprint"
                : "当前使用安全项目模板生成 Blueprint"
            }
            description={
              warnings.length > 0 ? warnings.join("；") : blueprint.rationale || undefined
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
              ["数据表", summary?.tables || 0],
              ["字段", summary?.fields || 0],
              ["视图", summary?.views || 0],
              ["仪表盘", summary?.dashboards || 0],
            ].map(([label, value]) => (
              <Card key={String(label)} size="small">
                <Typography.Text type="secondary">{label}</Typography.Text>
                <Typography.Title level={4} style={{ margin: "3px 0 0" }}>
                  {value}
                </Typography.Title>
              </Card>
            ))}
          </div>

          <Card size="small">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <Typography.Text strong>项目名称</Typography.Text>
              <Input
                value={blueprint.projectName}
                onChange={(event) =>
                  updateBlueprint((draft) => {
                    draft.projectName = event.target.value;
                    if (draft.folder?.create) {
                      draft.folder.name = event.target.value;
                    }
                  })
                }
                prefix={<EditOutlined />}
              />
              {blueprint.rationale ? (
                <Typography.Text type="secondary">
                  {blueprint.rationale}
                </Typography.Text>
              ) : null}
            </Space>
          </Card>

          <Collapse
            items={blueprint.tables.map((table, tableIndex) => ({
              key: table.key,
              label: (
                <Space>
                  <TableOutlined />
                  <span>{table.name}</span>
                  <Tag>{table.fields.length} 字段</Tag>
                  <Tag>{table.views.length} 视图</Tag>
                </Space>
              ),
              extra: (
                <Popconfirm
                  title="删除这张表？"
                  description="关联到这张表的关系字段和仪表盘组件也会从蓝图中移除。"
                  disabled={blueprint.tables.length <= 1}
                  onConfirm={() => removeTable(tableIndex)}
                  onCancel={(event) => event?.stopPropagation()}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={blueprint.tables.length <= 1}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Popconfirm>
              ),
              children: (
                <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                  <Input
                    value={table.name}
                    onChange={(event) =>
                      updateBlueprint((draft) => {
                        draft.tables[tableIndex].name = event.target.value;
                      })
                    }
                    addonBefore="表名"
                  />

                  <div>
                    <Typography.Text strong>字段</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      {table.fields.map((field, fieldIndex) => (
                        <div
                          key={field.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) 120px 36px",
                            gap: 8,
                            alignItems: "center",
                            padding: "6px 0",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <Input
                            size="small"
                            value={field.name}
                            onChange={(event) =>
                              updateBlueprint((draft) => {
                                draft.tables[tableIndex].fields[fieldIndex].name =
                                  event.target.value;
                              })
                            }
                          />
                          <Tag
                            style={{
                              margin: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <FieldTypeIcon type={field.type} />
                            {fieldTypeLabel[field.type] || field.type}
                          </Tag>
                          <Popconfirm
                            title="删除字段？"
                            disabled={table.fields.length <= 1}
                            onConfirm={() => removeField(tableIndex, fieldIndex)}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              disabled={table.fields.length <= 1}
                            />
                          </Popconfirm>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Typography.Text strong>视图</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      {table.views.map((view, viewIndex) => (
                        <div
                          key={view.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "30px minmax(0, 1fr) 110px 36px",
                            gap: 8,
                            alignItems: "center",
                            padding: "6px 0",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <span style={{ color: "#6366f1" }}>{viewIcon(view.type)}</span>
                          <Input
                            size="small"
                            value={view.name}
                            onChange={(event) =>
                              updateBlueprint((draft) => {
                                draft.tables[tableIndex].views[viewIndex].name =
                                  event.target.value;
                              })
                            }
                          />
                          <Tag style={{ margin: 0 }}>{view.type}</Tag>
                          <Popconfirm
                            title="删除视图？"
                            disabled={table.views.length <= 1}
                            onConfirm={() => removeView(tableIndex, viewIndex)}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              disabled={table.views.length <= 1}
                            />
                          </Popconfirm>
                        </div>
                      ))}
                    </div>
                  </div>
                </Space>
              ),
            }))}
          />

          {blueprint.dashboards.length > 0 ? (
            <Card size="small" title={<Space><DashboardOutlined />仪表盘</Space>}>
              <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                {blueprint.dashboards.map((dashboard, dashboardIndex) => (
                  <div
                    key={dashboard.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 120px 36px",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <Input
                      size="small"
                      value={dashboard.name}
                      onChange={(event) =>
                        updateBlueprint((draft) => {
                          draft.dashboards[dashboardIndex].name = event.target.value;
                        })
                      }
                    />
                    <Tag>{dashboard.widgets.length} 组件</Tag>
                    <Popconfirm
                      title="删除仪表盘？"
                      onConfirm={() =>
                        updateBlueprint((draft) => {
                          draft.dashboards.splice(dashboardIndex, 1);
                        })
                      }
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </div>
                ))}
              </Space>
            </Card>
          ) : null}

          <Divider style={{ margin: "2px 0" }} />

          <Card size="small" title="继续用自然语言调整">
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={refinement}
                onChange={(event) => setRefinement(event.target.value)}
                onPressEnter={handleRefine}
                placeholder="例如：不要工时字段；增加上线环境；把截止时间改成里程碑"
              />
              <Button
                icon={<RobotOutlined />}
                loading={previewLoading}
                disabled={!refinement.trim() || previewLoading}
                onClick={handleRefine}
              >
                重新生成
              </Button>
            </Space.Compact>
          </Card>

          <Alert
            type="warning"
            showIcon
            message="只有点击“确认并创建”后才会写入工作空间；服务端会在一个事务中完成全部创建。"
          />
        </Space>
      )}

      {phase === "result" && applyResult && (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="success"
            showIcon
            message="项目工作区已经创建完成"
            description={
              applyResult.idempotent
                ? "这是同一生成 trace 的已存在结果，没有重复创建任何对象。"
                : "数据表、视图、关系字段和仪表盘已在一次原子事务中创建。"
            }
          />

          <Card size="small" title="创建结果">
            <Space orientation="vertical" size={10} style={{ width: "100%" }}>
              {applyResult.created.folder ? (
                <Typography.Text>
                  项目文件夹：<strong>{applyResult.created.folder.name}</strong>
                </Typography.Text>
              ) : null}
              {applyResult.created.tables.map((table) => (
                <div
                  key={table.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <Space>
                    <TableOutlined />
                    <span>{table.name}</span>
                  </Space>
                  <Button
                    size="small"
                    onClick={() => {
                      onClose();
                      navigate(
                        "/workbench/" +
                          table.id +
                          "/" +
                          (table.defaultViewId || "v1"),
                      );
                    }}
                  >
                    打开
                  </Button>
                </div>
              ))}
              {applyResult.created.dashboards.map((dashboard) => (
                <div
                  key={dashboard.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 0",
                  }}
                >
                  <Space>
                    <DashboardOutlined />
                    <span>{dashboard.name}</span>
                  </Space>
                  <Button
                    size="small"
                    onClick={() => {
                      onClose();
                      navigate("/workbench/" + dashboard.id);
                    }}
                  >
                    打开
                  </Button>
                </div>
              ))}
            </Space>
          </Card>

          <Card size="small" title="建议下一步">
            {applyResult.created.nextActions.length > 0 ? (
              <Space wrap>
                {applyResult.created.nextActions.map((action) => (
                  <Tag key={action.id} color="blue" style={{ padding: "5px 10px" }}>
                    {action.label}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无建议" />
            )}
          </Card>
        </Space>
      )}

      {(previewLoading || applyLoading) && phase !== "input" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.65)",
            zIndex: 20,
          }}
        >
          <Spin
            tip={
              applyLoading
                ? "正在原子创建项目工作区…"
                : "正在理解目标并生成 Blueprint…"
            }
          />
        </div>
      ) : null}
    </Modal>
  );
}
