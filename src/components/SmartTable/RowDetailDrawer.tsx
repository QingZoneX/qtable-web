import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  Rate,
  Select,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ShareAltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import { t } from "../../lib/i18nRuntime";
import dayjs from "dayjs";
import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Field, TableRecord } from "../../store/useSmartTableStore";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { client } from "../../lib/apollo";
import { RECORD_BY_ID } from "../../lib/graphql";
import { apiUrl } from "../../lib/apiUrl";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import {
  TASK_PROFILE_FIELD_META,
  type TaskProfileConfig,
} from "../TaskProfile/taskProfile";
import { useTaskProfile } from "../TaskProfile/useTaskProfile";
import { SOURCE_INBOX_ITEMS } from "../SourceInbox/sourceInboxGraphql";
import type { SourceInboxPage } from "../SourceInbox/types";
import { SourceContextSection } from "../SourceInbox/SourceContextSection";
import { RecordActivity } from "../Notifications/RecordActivity";
import { RecordComments } from "../Notifications/RecordComments";
import { RelationRecordSelect } from "./relation/RelationRecordSelect";
import { getRelationProperty } from "./relation/relationTypes";
import { formatAutoNumber } from "./utils/autoNumber";
import "./recordWorkspace.css";

type OptionItem = { value: string; label: string; color?: string };
type AttachmentItem = {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
};

type RowDetailDrawerProps = {
  open: boolean;
  title: string;
  record: TableRecord | null;
  fields: Field[];
  canUpdate: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  onUpdateRecord: (recordId: string, fieldId: string, value: unknown) => void;
};

const valuesEqual = (left: unknown, right: unknown) => {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const formatFormulaValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const formatBytes = (size?: number) => {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const normalizeAttachments = (value: unknown): AttachmentItem[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is AttachmentItem =>
          Boolean(
            item &&
              typeof item === "object" &&
              "url" in item &&
              "name" in item,
          ),
      )
    : [];

const relationContains = (value: unknown, recordId: string) => {
  if (Array.isArray(value)) {
    return value.some((item) => String(item) === recordId);
  }
  if (value && typeof value === "object") {
    const candidate = value as {
      id?: unknown;
      recordId?: unknown;
      value?: unknown;
    };
    return (
      String(candidate.id ?? candidate.recordId ?? candidate.value ?? "") ===
      recordId
    );
  }
  return String(value ?? "") === recordId;
};

const mappedFieldIds = (config?: TaskProfileConfig | null) =>
  new Set(
    config
      ? (TASK_PROFILE_FIELD_META.map((meta) => config[meta.key]).filter(
          Boolean,
        ) as string[])
      : [],
  );

export function RowDetailDrawer(props: RowDetailDrawerProps) {
  const recordKey = props.record?.id ? String(props.record.id) : "empty";
  return <RecordWorkspace key={recordKey} {...props} />;
}

function RecordWorkspace({
  open,
  record,
  fields,
  canUpdate,
  loading = false,
  error = null,
  onRetry,
  onClose,
  onUpdateRecord,
}: RowDetailDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentTableId = useSmartTableStore((state) => state.currentTableId);
  const records = useSmartTableStore((state) => state.records);
  const currentTableName = useSmartTableStore((state) => state.currentTableName);
  const insertRow = useSmartTableStore((state) => state.insertRow);
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const { profile } = useTaskProfile(currentTableId);
  const commentId = new URLSearchParams(location.search).get("commentId");
  const [draftRecord, setDraftRecord] = useState<TableRecord | null>(record);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState("");
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [selectedTab, setSelectedTab] = useState(commentId ? "comments" : "detail");
  const [activityRevision, setActivityRevision] = useState(0);
  const writeRevisionRef = useRef<Record<string, number>>({});

  const sourceQuery = useQuery<{ sourceInboxItems: SourceInboxPage }>(
    SOURCE_INBOX_ITEMS,
    {
      variables: {
        workspaceId: workspaceId || "",
        status: "converted",
        search: null,
        offset: 0,
        limit: 100,
      },
      skip: !open || !workspaceId || !draftRecord?.id,
      fetchPolicy: "cache-and-network",
    },
  );

  const config = profile?.config || null;
  const fieldById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const titleField = config?.titleFieldId
    ? fieldById.get(config.titleFieldId)
    : undefined;
  const statusField = config?.statusFieldId
    ? fieldById.get(config.statusFieldId)
    : undefined;
  const priorityField = config?.priorityFieldId
    ? fieldById.get(config.priorityFieldId)
    : undefined;
  const parentField = config?.parentFieldId
    ? fieldById.get(config.parentFieldId)
    : undefined;
  const semanticIds = mappedFieldIds(config);
  const longTextField = fields.find((field) => {
    const type = String(field.type).toLowerCase();
    return (
      field.id !== titleField?.id &&
      (type === "long_text" || type === "textarea")
    );
  });
  const attachmentFields = fields.filter(
    (field) => String(field.type) === "attachment",
  );
  const excludedPropertyIds = new Set(
    [
      titleField?.id,
      longTextField?.id,
      ...attachmentFields.map((field) => field.id),
    ].filter(Boolean) as string[],
  );
  const orderedProperties = [
    ...TASK_PROFILE_FIELD_META.map((meta) => config?.[meta.key])
      .filter((id): id is string => Boolean(id))
      .map((id) => fieldById.get(id))
      .filter(
        (field): field is Field =>
          field !== undefined && !excludedPropertyIds.has(field.id),
      ),
    ...fields.filter(
      (field) =>
        !semanticIds.has(field.id) && !excludedPropertyIds.has(field.id),
    ),
  ];
  const visibleProperties = showAllProperties
    ? orderedProperties
    : orderedProperties.slice(0, 8);

  const recordIndex = draftRecord
    ? records.findIndex(
        (item) => String(item.id) === String(draftRecord.id),
      )
    : -1;
  const previousRecord = recordIndex > 0 ? records[recordIndex - 1] : null;
  const nextRecord =
    recordIndex >= 0 && recordIndex < records.length - 1
      ? records[recordIndex + 1]
      : null;

  const sourceItems = (sourceQuery.data?.sourceInboxItems?.items || []).filter(
    (item) =>
      String(item.targetRecordId || "") === String(draftRecord?.id || ""),
  );
  const subtasks =
    parentField && draftRecord
      ? records.filter(
          (item) =>
            item.id !== draftRecord.id &&
            relationContains(
              item[parentField.id],
              String(draftRecord.id),
            ),
        )
      : [];

  const openRecord = (recordId: string) => {
    const params = new URLSearchParams(location.search);
    params.set("recordId", recordId);
    params.delete("commentId");
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
    });
  };

  const changeTab = (key: string) => {
    setSelectedTab(key);
    if (!commentId || key === "comments") return;
    const params = new URLSearchParams(location.search);
    params.delete("commentId");
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}` },
      { replace: true },
    );
  };

  const verifyPersistedValue = async (
    recordId: string,
    fieldId: string,
    expected: unknown,
  ) => {
    if (!currentTableId) {
      return { ok: false, serverValue: undefined as unknown };
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 240));
      try {
        const response = await client.query<{ recordById: TableRecord }>({
          query: RECORD_BY_ID,
          variables: { tableId: currentTableId, recordId },
          fetchPolicy: "network-only",
        });
        const serverValue = response.data?.recordById?.[fieldId];
        if (valuesEqual(serverValue, expected)) {
          return { ok: true, serverValue };
        }
        if (attempt === 4) return { ok: false, serverValue };
      } catch {
        if (attempt === 4) {
          return { ok: false, serverValue: undefined as unknown };
        }
      }
    }
    return { ok: false, serverValue: undefined as unknown };
  };

  const commitValue = async (field: Field, value: unknown) => {
    if (!draftRecord || !canUpdate) return;
    const recordId = String(draftRecord.id);
    const previous = draftRecord[field.id];
    if (valuesEqual(previous, value)) return;

    const revision = (writeRevisionRef.current[field.id] || 0) + 1;
    writeRevisionRef.current[field.id] = revision;
    setDraftRecord((current) =>
      current ? { ...current, [field.id]: value } : current,
    );
    setSaveState("saving");
    setSaveError("");
    onUpdateRecord(recordId, field.id, value);

    const verified = await verifyPersistedValue(recordId, field.id, value);
    if (writeRevisionRef.current[field.id] !== revision) return;
    if (verified.ok) {
      setSaveState("saved");
      setActivityRevision((value) => value + 1);
      window.setTimeout(
        () =>
          setSaveState((current) =>
            current === "saved" ? "idle" : current,
          ),
        1600,
      );
      return;
    }

    const rollbackValue =
      verified.serverValue === undefined ? previous : verified.serverValue;
    setDraftRecord((current) =>
      current ? { ...current, [field.id]: rollbackValue } : current,
    );
    useSmartTableStore.setState((state) => ({
      records: state.records.map((item) =>
        String(item.id) === recordId
          ? { ...item, [field.id]: rollbackValue }
          : item,
      ),
    }));
    setSaveState("error");
    setSaveError(`“${field.name}”未能保存，已恢复服务器中的值。`);
  };

  const buildOptionItems = (field: Field): OptionItem[] =>
    (field.options || []).map((option) => ({
      value: option.id,
      label: option.label,
      color: option.color,
    }));

  const normalizeOptionValue = (value: unknown, options: OptionItem[]) => {
    if (value === null || value === undefined) return undefined;
    if (options.some((option) => option.value === String(value))) {
      return String(value);
    }
    return (
      options.find((option) => option.label === String(value))?.value ||
      String(value)
    );
  };

  const renderFieldControl = (field: Field, value: unknown) => {
    const type = String(field.type);
    if (type === "formula") {
      return (
        <div className="qtable-record-readonly-control">
          <Tag bordered={false}>fx</Tag>
          {formatFormulaValue(value)}
        </div>
      );
    }
    if (type === "autoNumber") {
      return (
        <div className="qtable-record-readonly-control">
          {formatAutoNumber(field, value) || "—"}
        </div>
      );
    }
    if (type === "relation") {
      if (!currentTableId) return <Input disabled value="缺少当前表上下文" />;
      const relation = getRelationProperty(field);
      return (
        <RelationRecordSelect
          tableId={currentTableId}
          fieldId={field.id}
          value={value}
          multiple={relation.multiple !== false}
          disabled={!canUpdate}
          onChange={(next) => void commitValue(field, next)}
        />
      );
    }
    if (type === "select" || type === "single_select") {
      const options = buildOptionItems(field);
      return (
        <Select
          allowClear
          disabled={!canUpdate}
          value={normalizeOptionValue(value, options)}
          options={options}
          style={{ width: "100%" }}
          placeholder="请选择"
          onChange={(next) => void commitValue(field, next ?? null)}
        />
      );
    }
    if (type === "multiSelect") {
      const options = buildOptionItems(field);
      const raw = Array.isArray(value) ? value : value == null ? [] : [value];
      return (
        <Select
          mode="multiple"
          disabled={!canUpdate}
          value={raw
            .map((item) => normalizeOptionValue(item, options))
            .filter(Boolean)}
          options={options}
          style={{ width: "100%" }}
          onChange={(next) => void commitValue(field, next)}
        />
      );
    }
    if (type === "member") {
      const options = buildOptionItems(field);
      const multiple = field.property?.multiple !== false;
      const raw = value == null ? [] : Array.isArray(value) ? value : [value];
      return (
        <Select
          mode={multiple ? "multiple" : undefined}
          disabled={!canUpdate}
          value={
            multiple
              ? raw.map(String)
              : raw[0] == null
                ? undefined
                : String(raw[0])
          }
          options={options}
          style={{ width: "100%" }}
          placeholder="请选择成员"
          onChange={(next) => void commitValue(field, next ?? null)}
        />
      );
    }
    if (type === "date" || type === "datetime") {
      const parsed = value ? dayjs(value as string | number) : null;
      return (
        <DatePicker
          showTime={type === "datetime"}
          disabled={!canUpdate}
          value={parsed?.isValid() ? parsed : null}
          style={{ width: "100%" }}
          onChange={(date) =>
            void commitValue(field, date ? date.valueOf() : null)
          }
        />
      );
    }
    if (type === "number" || type === "progress") {
      return (
        <InputNumber
          disabled={!canUpdate}
          value={
            typeof value === "number"
              ? value
              : value == null
                ? undefined
                : Number(value)
          }
          min={type === "progress" ? 0 : undefined}
          max={
            type === "progress" ? field.property?.max ?? 100 : undefined
          }
          style={{ width: "100%" }}
          onChange={(next) => void commitValue(field, next ?? null)}
        />
      );
    }
    if (type === "rating") {
      return (
        <Rate
          disabled={!canUpdate}
          count={field.property?.max ?? 5}
          value={typeof value === "number" ? value : Number(value || 0)}
          onChange={(next) => void commitValue(field, next)}
        />
      );
    }
    if (type === "url" || type === "email" || type === "phone") {
      return (
        <Input
          disabled={!canUpdate}
          defaultValue={value == null ? "" : String(value)}
          key={`${draftRecord?.id}:${field.id}:${String(value ?? "")}`}
          placeholder={t("common.inputPlaceholder")}
          onBlur={(event) => void commitValue(field, event.target.value)}
        />
      );
    }
    return (
      <Input.TextArea
        disabled={!canUpdate}
        autoSize={{
          minRows: 1,
          maxRows: type === "long_text" || type === "textarea" ? 10 : 4,
        }}
        defaultValue={value == null ? "" : String(value)}
        key={`${draftRecord?.id}:${field.id}:${String(value ?? "")}`}
        placeholder={t("common.inputPlaceholder")}
        onBlur={(event) => void commitValue(field, event.target.value)}
      />
    );
  };

  const uploadAttachment = async (field: Field, file: File) => {
    if (!draftRecord || !canUpdate) return;
    setUploadingFieldId(field.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(apiUrl("/api/attachments/upload"), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("upload failed");
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("missing url");
      const current = normalizeAttachments(draftRecord[field.id]);
      await commitValue(field, [
        ...current,
        {
          id: payload.url,
          name: file.name,
          url: payload.url,
          size: file.size,
          type: file.type,
        },
      ]);
    } catch {
      message.error(`上传“${file.name}”失败`);
    } finally {
      setUploadingFieldId(null);
    }
  };

  const copyDeepLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message.success("记录链接已复制");
    } catch {
      message.error("复制链接失败");
    }
  };

  const shareRecord = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title:
            titleField && draftRecord
              ? String(draftRecord[titleField.id] || "记录")
              : "记录",
          url: window.location.href,
        });
        return;
      } catch {
        return;
      }
    }
    await copyDeepLink();
  };

  const createSubtask = async () => {
    if (!draftRecord || !parentField || !titleField || !canUpdate) return;
    const created = await insertRow({
      [titleField.id]: "新子任务",
      [parentField.id]: draftRecord.id,
    });
    if (!created) {
      message.error("创建子任务失败");
      return;
    }
    message.success("子任务已创建");
    openRecord(String(created.id));
  };

  const headerTitle =
    titleField && draftRecord
      ? String(draftRecord[titleField.id] || "未命名记录")
      : draftRecord
        ? `记录 ${draftRecord.id}`
        : "记录详情";

  const detailTab = draftRecord ? (
    <>
      {longTextField ? (
        <section className="qtable-record-workspace-section">
          <div className="qtable-record-workspace-section-title">
            <h3>描述</h3>
          </div>
          {renderFieldControl(longTextField, draftRecord[longTextField.id])}
        </section>
      ) : null}

      <section className="qtable-record-workspace-section">
        <div className="qtable-record-workspace-section-title">
          <h3>基本信息</h3>
          {orderedProperties.length > 8 ? (
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => setShowAllProperties((value) => !value)}
            >
              {showAllProperties
                ? "收起"
                : `更多属性（${orderedProperties.length - 8}）`}
            </Button>
          ) : null}
        </div>
        <div className="qtable-record-property-grid">
          {visibleProperties.map((field) => (
            <div
              className={`qtable-record-property${
                String(field.type) === "relation" ? " is-wide" : ""
              }`}
              key={field.id}
            >
              <span className="qtable-record-property-label">
                {field.name}
              </span>
              {renderFieldControl(field, draftRecord[field.id])}
            </div>
          ))}
        </div>
      </section>

      <SourceContextSection
        items={sourceItems}
        loading={sourceQuery.loading}
        hasMore={sourceQuery.data?.sourceInboxItems?.hasMore}
        fields={fields}
        record={draftRecord}
      />

      {parentField ? (
        <section className="qtable-record-workspace-section">
          <div className="qtable-record-workspace-section-title">
            <h3>子任务</h3>
            {canUpdate && titleField ? (
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => void createSubtask()}
              >
                添加子任务
              </Button>
            ) : null}
          </div>
          {subtasks.length ? (
            <div className="qtable-record-subtask-list">
              {subtasks.map((subtask) => (
                <button
                  type="button"
                  className="qtable-record-subtask"
                  key={subtask.id}
                  onClick={() => openRecord(String(subtask.id))}
                >
                  <div className="qtable-record-subtask-main">
                    <div className="qtable-record-subtask-title">
                      {titleField
                        ? String(subtask[titleField.id] || "未命名子任务")
                        : String(subtask.id)}
                    </div>
                    <div className="qtable-record-subtask-meta">
                      记录 {subtask.id}
                    </div>
                  </div>
                  <ArrowRightOutlined />
                </button>
              ))}
            </div>
          ) : (
            <div className="qtable-record-workspace-empty">
              当前已加载记录中没有子任务。
            </div>
          )}
        </section>
      ) : null}

      {attachmentFields.map((field) => {
        const attachments = normalizeAttachments(draftRecord[field.id]);
        return (
          <section className="qtable-record-workspace-section" key={field.id}>
            <div className="qtable-record-workspace-section-title">
              <h3>{field.name || "附件"}</h3>
              {canUpdate ? (
                <label>
                  <input
                    type="file"
                    hidden
                    disabled={uploadingFieldId === field.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAttachment(field, file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Button
                    size="small"
                    loading={uploadingFieldId === field.id}
                    icon={<UploadOutlined />}
                    onClick={(event) => {
                      const input = event.currentTarget.parentElement?.querySelector(
                        "input[type=file]",
                      ) as HTMLInputElement | null;
                      input?.click();
                    }}
                  >
                    上传附件
                  </Button>
                </label>
              ) : null}
            </div>
            {attachments.length ? (
              <div className="qtable-record-attachment-list">
                {attachments.map((attachment) => (
                  <div
                    className="qtable-record-attachment"
                    key={attachment.id || attachment.url}
                  >
                    <FileOutlined />
                    <div className="qtable-record-attachment-main">
                      <div className="qtable-record-attachment-name">
                        {attachment.name}
                      </div>
                      <div className="qtable-record-attachment-meta">
                        {formatBytes(attachment.size) || attachment.type || "附件"}
                      </div>
                    </div>
                    <Tooltip title="打开 / 下载">
                      <Button
                        type="text"
                        size="small"
                        icon={<PaperClipOutlined />}
                        href={attachment.url}
                        target="_blank"
                      />
                    </Tooltip>
                    {canUpdate ? (
                      <Tooltip title="移除">
                        <Button
                          danger
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            void commitValue(
                              field,
                              attachments.filter(
                                (item) => item.id !== attachment.id,
                              ),
                            )
                          }
                        />
                      </Tooltip>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="qtable-record-workspace-empty">暂无附件。</div>
            )}
          </section>
        );
      })}
    </>
  ) : null;

  const activityTab =
    currentTableId && draftRecord ? (
      <RecordActivity
        key={`${draftRecord.id}:${activityRevision}`}
        tableId={currentTableId}
        recordId={String(draftRecord.id)}
      />
    ) : null;

  const commentsTab =
    currentTableId && draftRecord ? (
      <RecordComments
        tableId={currentTableId}
        recordId={String(draftRecord.id)}
        canUpdate={canUpdate}
        highlightCommentId={commentId}
      />
    ) : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={null}
      closable={false}
      width="min(700px, calc(100vw - 24px))"
      rootClassName="qtable-record-workspace"
    >
      {error ? (
        <div style={{ padding: 24 }}>
          <Alert
            type="error"
            showIcon
            message="无法打开记录"
            description={error}
            action={
              onRetry ? (
                <Button size="small" onClick={onRetry}>
                  重试
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : loading ? (
        <div
          style={{
            minHeight: 320,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Spin tip="正在加载记录…" />
        </div>
      ) : draftRecord ? (
        <div className="qtable-record-workspace-shell">
          <header className="qtable-record-workspace-header">
            <div className="qtable-record-workspace-toolbar">
              <span className="qtable-record-workspace-context">
                {currentTableName || "数据表"} / {draftRecord.id}
              </span>
              <div className="qtable-record-workspace-toolbar-actions">
                <Tooltip title="上一条">
                  <Button
                    type="text"
                    size="small"
                    disabled={!previousRecord}
                    icon={<ArrowLeftOutlined />}
                    onClick={() =>
                      previousRecord && openRecord(String(previousRecord.id))
                    }
                  />
                </Tooltip>
                <Tooltip title="下一条">
                  <Button
                    type="text"
                    size="small"
                    disabled={!nextRecord}
                    icon={<ArrowRightOutlined />}
                    onClick={() => nextRecord && openRecord(String(nextRecord.id))}
                  />
                </Tooltip>
                <Tooltip title="复制记录链接">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => void copyDeepLink()}
                  />
                </Tooltip>
                <Tooltip title="分享">
                  <Button
                    type="text"
                    size="small"
                    icon={<ShareAltOutlined />}
                    onClick={() => void shareRecord()}
                  />
                </Tooltip>
                <Button type="text" size="small" onClick={onClose}>
                  关闭
                </Button>
              </div>
            </div>

            <div className="qtable-record-workspace-title-row">
              {titleField && canUpdate ? (
                <Input
                  className="qtable-record-workspace-title-input"
                  key={`${draftRecord.id}:${titleField.id}:${String(
                    draftRecord[titleField.id] ?? "",
                  )}`}
                  defaultValue={String(draftRecord[titleField.id] ?? "")}
                  placeholder="未命名记录"
                  onBlur={(event) =>
                    void commitValue(titleField, event.target.value)
                  }
                />
              ) : (
                <h2 className="qtable-record-workspace-title">
                  {headerTitle}
                </h2>
              )}
            </div>

            <div className="qtable-record-workspace-meta">
              {statusField ? (
                <Tag>
                  {String(draftRecord[statusField.id] ?? "未设置状态")}
                </Tag>
              ) : null}
              {priorityField ? (
                <Tag>
                  {String(draftRecord[priorityField.id] ?? "未设置优先级")}
                </Tag>
              ) : null}
              {!profile ? <Tag>通用记录</Tag> : null}
              <span className={`qtable-record-save-state is-${saveState}`}>
                {saveState === "saving"
                  ? "正在保存…"
                  : saveState === "saved"
                    ? "已保存"
                    : saveState === "error"
                      ? "保存失败"
                      : ""}
              </span>
            </div>
            {saveError ? (
              <Alert
                style={{ marginTop: 10 }}
                type="error"
                showIcon
                message={saveError}
                closable
                onClose={() => setSaveError("")}
              />
            ) : null}
          </header>

          <Tabs
            className="qtable-record-workspace-tabs"
            activeKey={commentId ? "comments" : selectedTab}
            onChange={changeTab}
            items={[
              { key: "detail", label: "详情", children: detailTab },
              { key: "activity", label: "活动", children: activityTab },
              { key: "comments", label: "评论", children: commentsTab },
            ]}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
