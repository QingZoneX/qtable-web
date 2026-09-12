import {
  Alert,
  Button,
  Divider,
  Drawer,
  Empty,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  BulbOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
import { useEffect, useMemo, useState } from "react";
import { ADD_FIELD } from "../../lib/graphql";
import { t } from "../../lib/i18nRuntime";
import {
  permissionAllows,
  type Field,
  useSmartTableStore,
} from "../../store/useSmartTableStore";
import {
  CLEAR_TASK_PROFILE,
  EMPTY_TASK_PROFILE,
  SUGGEST_TASK_PROFILE_QUERY,
  TASK_PROFILE_FIELD_META,
  TASK_PROFILE_OPEN_EVENT,
  TASK_PROFILE_QUERY,
  TASK_PROFILE_STATUS_META,
  UPDATE_TASK_PROFILE,
  fieldTypeLabel,
  isFieldCompatibleWithSemantic,
  normalizeTaskProfileConfig,
  type TaskProfileConfig,
  type TaskProfileFieldKey,
  type TaskProfilePayload,
  type TaskProfileStatusKey,
  type TaskProfileSuggestion,
} from "./taskProfile";

const { Text, Title } = Typography;

type TaskProfileQueryData = {
  taskProfile: TaskProfilePayload | null;
};

type TaskProfileSuggestionData = {
  suggestTaskProfile: TaskProfileSuggestion;
};

type TaskProfileMutationData = {
  updateTaskProfile: TaskProfilePayload;
};

type AddFieldData = {
  addField: Field;
};

const RECOMMENDED_FIELDS: Partial<
  Record<
    TaskProfileFieldKey,
    Pick<Field, "name" | "type" | "options" | "property">
  >
> = {
  titleFieldId: { name: "任务名称", type: "text" },
  statusFieldId: {
    name: "状态",
    type: "select",
    options: [
      { id: "todo", label: "待开始", color: "#E5E7EB" },
      { id: "in_progress", label: "进行中", color: "#BFDBFE" },
      { id: "blocked", label: "阻塞", color: "#FDE68A" },
      { id: "done", label: "已完成", color: "#BBF7D0" },
    ],
  },
  assigneeFieldId: { name: "负责人", type: "member", property: { multiple: true } },
  priorityFieldId: {
    name: "优先级",
    type: "select",
    options: [
      { id: "high", label: "高", color: "#FECACA" },
      { id: "medium", label: "中", color: "#FDE68A" },
      { id: "low", label: "低", color: "#DBEAFE" },
    ],
  },
  startDateFieldId: { name: "开始日期", type: "date" },
  dueDateFieldId: { name: "截止日期", type: "date" },
  progressFieldId: { name: "进度", type: "progress", property: { max: 100 } },
  workloadFieldId: { name: "工作量", type: "number", property: { suffix: "h" } },
};

const createFieldId = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `fld_${Date.now().toString(36)}_${random}`;
};

const fieldOptionLabel = (field: Field) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span>{field.name}</span>
    <Tag bordered={false} style={{ marginInlineEnd: 0, fontSize: 10 }}>
      {fieldTypeLabel(field)}
    </Tag>
  </span>
);

const invalidMappedFieldOption = (
  fieldId: string,
  fields: Field[],
  key: TaskProfileFieldKey,
) => {
  const existing = fields.find((field) => field.id === fieldId);
  if (!existing) {
    return {
      value: fieldId,
      label: `已删除字段 · ${fieldId}`,
      disabled: true,
    };
  }
  if (!isFieldCompatibleWithSemantic(key, existing)) {
    return {
      value: fieldId,
      label: `${existing.name} · 类型已不兼容（${fieldTypeLabel(existing)}）`,
      disabled: true,
    };
  }
  return null;
};

function TaskProfileEditor({
  tableId,
  profile,
  fields,
  canEdit,
}: {
  tableId: string;
  profile: TaskProfilePayload | null;
  fields: Field[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<TaskProfileConfig>(() =>
    normalizeTaskProfileConfig(profile?.config),
  );
  const [createdFields, setCreatedFields] = useState<Field[]>([]);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const effectiveFields = useMemo(() => {
    const byId = new Map(fields.map((field) => [field.id, field]));
    createdFields.forEach((field) => byId.set(field.id, field));
    return Array.from(byId.values());
  }, [createdFields, fields]);

  const [loadSuggestion, { loading: suggestionLoading }] =
    useLazyQuery<TaskProfileSuggestionData>(SUGGEST_TASK_PROFILE_QUERY, {
      fetchPolicy: "network-only",
    });
  const [saveProfile, { loading: saving }] =
    useMutation<TaskProfileMutationData>(UPDATE_TASK_PROFILE);
  const [clearProfile, { loading: clearing }] = useMutation(CLEAR_TASK_PROFILE);
  const [createField, { loading: creatingField }] =
    useMutation<AddFieldData>(ADD_FIELD);

  const mappedStatusField = draft.statusFieldId
    ? effectiveFields.find((field) => field.id === draft.statusFieldId)
    : undefined;
  const statusOptions = mappedStatusField?.options || [];

  const setFieldMapping = (key: TaskProfileFieldKey, value?: string) => {
    setDraft((current) => ({ ...current, [key]: value || null }));
  };

  const setStatusMapping = (key: TaskProfileStatusKey, values: string[]) => {
    setDraft((current) => ({ ...current, [key]: values }));
  };

  const applySuggestion = async () => {
    try {
      const result = await loadSuggestion({ variables: { tableId } });
      const suggestion = result.data?.suggestTaskProfile;
      if (!suggestion) {
        message.info("当前字段结构没有可用的语义建议");
        return;
      }
      setDraft(normalizeTaskProfileConfig(suggestion.config));
      setSuggestionApplied(true);
      message.success("建议已应用到草稿，请检查后再保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取智能建议失败");
    }
  };

  const save = async () => {
    if (!canEdit) return;
    try {
      const result = await saveProfile({
        variables: { tableId, profile: draft },
        refetchQueries: [{ query: TASK_PROFILE_QUERY, variables: { tableId } }],
        awaitRefetchQueries: true,
      });
      const saved = result.data?.updateTaskProfile;
      if (saved?.config) setDraft(normalizeTaskProfileConfig(saved.config));
      setSuggestionApplied(false);
      message.success("业务语义已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存业务语义失败");
    }
  };

  const clear = async () => {
    if (!canEdit || !profile) return;
    try {
      await clearProfile({
        variables: { tableId },
        refetchQueries: [{ query: TASK_PROFILE_QUERY, variables: { tableId } }],
        awaitRefetchQueries: true,
      });
      setDraft({ ...EMPTY_TASK_PROFILE });
      setSuggestionApplied(false);
      message.success("业务语义配置已清除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "清除业务语义失败");
    }
  };

  const createRecommendedField = async (key: TaskProfileFieldKey) => {
    if (!canEdit) return;
    const template = RECOMMENDED_FIELDS[key];
    if (!template) {
      message.info("关联类字段请先在表格中创建，并确保指向当前表后再进行映射");
      return;
    }
    const provisional: Field = {
      id: createFieldId(),
      name: template.name,
      type: template.type,
      options: template.options,
      property: template.property,
    };
    try {
      const result = await createField({
        variables: { tableId, field: provisional, index: null },
      });
      const created = result.data?.addField || provisional;
      setCreatedFields((current) => [
        ...current.filter((field) => field.id !== created.id),
        created,
      ]);
      setFieldMapping(key, created.id);
      if (key === "statusFieldId") {
        setDraft((current) => ({
          ...current,
          statusFieldId: created.id,
          notStartedStatusValues: ["todo"],
          blockedStatusValues: ["blocked"],
          completedStatusValues: ["done"],
        }));
      }
      message.success(`已创建并映射「${created.name}」字段`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建推荐字段失败");
    }
  };

  const statusValueOwner = (value: string, except: TaskProfileStatusKey) => {
    for (const meta of TASK_PROFILE_STATUS_META) {
      if (meta.key === except) continue;
      if (draft[meta.key].includes(value)) return meta.label;
    }
    return null;
  };

  return (
    <div className="qtable-task-profile-editor">
      {!canEdit ? (
        <Alert
          type="info"
          showIcon
          message="只读模式"
          description="你可以查看当前字段语义，但只有具备编辑或管理权限的成员才能修改并保存。"
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {profile && !profile.valid ? (
        <Alert
          type="warning"
          showIcon
          message="当前业务语义需要修复"
          description={
            <ul style={{ margin: "8px 0 0", paddingInlineStart: 18 }}>
              {(profile.issues || []).map((issue, index) => (
                <li key={`${issue.key}:${issue.code}:${index}`}>{issue.message}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {suggestionApplied ? (
        <Alert
          type="info"
          showIcon
          message="智能建议仅应用到了本地草稿"
          description="QTable 不会根据字段名称静默建立业务语义。请检查映射和状态含义，确认无误后再点击保存。"
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={5} style={{ margin: 0 }}>
            字段业务语义
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            看板、工作台、自动化和 AI 只读取这里保存的稳定字段 ID，不再根据列名猜测。
          </Text>
        </div>
        <Button
          icon={<BulbOutlined />}
          loading={suggestionLoading}
          onClick={() => void applySuggestion()}
        >
          智能建议
        </Button>
      </div>

      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        {TASK_PROFILE_FIELD_META.map((meta) => {
          const selectedId = draft[meta.key];
          const compatible = effectiveFields.filter((field) =>
            isFieldCompatibleWithSemantic(meta.key, field),
          );
          const invalidOption = selectedId
            ? invalidMappedFieldOption(selectedId, effectiveFields, meta.key)
            : null;
          const options = [
            ...(invalidOption ? [invalidOption] : []),
            ...compatible
              .filter((field) => field.id !== invalidOption?.value)
              .map((field) => ({ value: field.id, label: fieldOptionLabel(field) })),
          ];
          const canCreate = Boolean(RECOMMENDED_FIELDS[meta.key]);
          return (
            <div
              key={meta.key}
              style={{
                display: "grid",
                gridTemplateColumns: "180px minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Space size={6}>
                  <Text strong style={{ fontSize: 13 }}>
                    {meta.label}
                  </Text>
                  {meta.requiredForKanban ? (
                    <Tooltip title="看板必须配置">
                      <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                        看板必需
                      </Tag>
                    </Tooltip>
                  ) : null}
                </Space>
                <Text
                  type="secondary"
                  style={{ display: "block", fontSize: 11, lineHeight: 1.45 }}
                >
                  {meta.description}
                </Text>
              </div>
              <Select
                value={selectedId || undefined}
                allowClear
                disabled={!canEdit}
                placeholder="未映射"
                options={options}
                optionLabelProp="label"
                style={{ width: "100%" }}
                onChange={(value) => setFieldMapping(meta.key, value)}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  String(option?.value || "")
                    .toLowerCase()
                    .includes(input.toLowerCase()) ||
                  effectiveFields.some(
                    (field) =>
                      field.id === option?.value &&
                      field.name.toLowerCase().includes(input.toLowerCase()),
                  )
                }
              />
              {canEdit ? (
                <Tooltip
                  title={
                    canCreate
                      ? `创建推荐的「${meta.label}」字段`
                      : "请先创建符合要求的自关联字段"
                  }
                >
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    loading={creatingField}
                    onClick={() => void createRecommendedField(meta.key)}
                    aria-label={`创建${meta.label}字段`}
                  />
                </Tooltip>
              ) : null}
            </div>
          );
        })}
      </Space>

      <Divider />

      <div style={{ marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          工作流状态语义
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          同一个状态值只能属于“未开始 / 完成 / 阻塞”中的一种。保存时后端还会再次校验。
        </Text>
      </div>

      {!draft.statusFieldId ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="先映射状态字段后，才能定义状态语义"
          style={{ marginBlock: 12 }}
        />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {TASK_PROFILE_STATUS_META.map((meta) => (
            <div
              key={meta.key}
              style={{
                display: "grid",
                gridTemplateColumns: "180px minmax(0, 1fr)",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <Text strong style={{ fontSize: 13 }}>
                  {meta.label}
                </Text>
                <Text
                  type="secondary"
                  style={{ display: "block", fontSize: 11 }}
                >
                  {meta.description}
                </Text>
              </div>
              <Select
                mode="multiple"
                allowClear
                value={draft[meta.key]}
                disabled={!canEdit || !statusOptions.length}
                placeholder={statusOptions.length ? "选择状态值" : "状态字段没有可用选项"}
                options={statusOptions.map((option) => {
                  const owner = statusValueOwner(option.id, meta.key);
                  return {
                    value: option.id,
                    label: owner ? `${option.label} · 已用于${owner}` : option.label,
                    disabled: Boolean(owner),
                  };
                })}
                onChange={(values) => setStatusMapping(meta.key, values)}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </Space>
      )}

      <Divider />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          {profile ? (
            <Space size={6}>
              <SafetyCertificateOutlined
                style={{ color: profile.valid ? "#16A34A" : "#D97706" }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                配置版本 v{profile.version}
                {profile.updatedAt ? ` · 更新于 ${new Date(profile.updatedAt).toLocaleString()}` : ""}
              </Text>
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>
              当前表尚未启用业务语义；普通数据表可以保持为空。
            </Text>
          )}
        </div>
        <Space>
          {canEdit && profile ? (
            <Popconfirm
              title="清除业务语义配置？"
              description="不会删除任何字段或记录，只会取消语义映射。"
              okText={t("common.clear")}
              cancelText={t("common.cancel")}
              onConfirm={() => void clear()}
            >
              <Button danger icon={<DeleteOutlined />} loading={clearing}>
                清除配置
              </Button>
            </Popconfirm>
          ) : null}
          {canEdit ? (
            <Button type="primary" loading={saving} onClick={() => void save()}>
              保存业务语义
            </Button>
          ) : null}
        </Space>
      </div>
    </div>
  );
}

export function TaskProfileDrawer({ tableId }: { tableId?: string }) {
  const [open, setOpen] = useState(false);
  const fields = useSmartTableStore((state) => state.fields);
  const currentPermission = useSmartTableStore((state) => state.currentPermission);
  const canEdit = permissionAllows(currentPermission, "edit");
  const { data, loading, error, refetch } = useQuery<TaskProfileQueryData>(
    TASK_PROFILE_QUERY,
    {
      variables: { tableId: tableId || "" },
      skip: !tableId,
      fetchPolicy: "cache-and-network",
    },
  );

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true);
      if (tableId) void refetch({ tableId });
    };
    window.addEventListener(TASK_PROFILE_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(TASK_PROFILE_OPEN_EVENT, handleOpen);
  }, [refetch, tableId]);

  const profile = data?.taskProfile || null;

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      width={760}
      title="业务语义 / Task Profile"
      destroyOnHidden
      styles={{ body: { padding: 20 } }}
    >
      {!tableId ? (
        <Empty description="当前没有打开的数据表" />
      ) : loading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : error ? (
        <Alert
          type="error"
          showIcon
          message="业务语义加载失败"
          description={error.message}
          action={<Button onClick={() => void refetch()}>重试</Button>}
        />
      ) : (
        <TaskProfileEditor
          key={`${tableId}:${profile?.version || 0}`}
          tableId={tableId}
          profile={profile}
          fields={fields}
          canEdit={canEdit}
        />
      )}
    </Drawer>
  );
}
