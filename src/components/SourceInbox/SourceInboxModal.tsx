import { useEffect, useMemo, useState } from "react";
import { CheckCircleOutlined, CloseCircleOutlined, InboxOutlined, LinkOutlined, RobotOutlined, WarningOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import { Alert, Button, Card, Checkbox, Empty, Image, Input, InputNumber, List, Modal, Pagination, Select, Space, Spin, Tabs, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { CONVERT_SOURCE_INBOX_ITEM, PREVIEW_SOURCE_INBOX_ITEM, SOURCE_INBOX_ITEMS, UPDATE_SOURCE_INBOX_STATUS } from "./sourceInboxGraphql";
import type { SimilarTask, SourceInboxConvertResult, SourceInboxItem, SourceInboxPage, SourceInboxPreview, SourceInboxStatus } from "./types";

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;
const PAGE_SIZE = 30;
const STATUS_LABELS: Record<SourceInboxStatus, string> = { pending: "待处理", converted: "已转任务", archived: "已归档", ignored: "已忽略", duplicate: "疑似重复" };
const STATUS_COLORS: Record<SourceInboxStatus, string> = { pending: "blue", converted: "green", archived: "default", ignored: "default", duplicate: "orange" };
const PRIORITIES = [{ value: "low", label: "低" }, { value: "medium", label: "中" }, { value: "high", label: "高" }, { value: "urgent", label: "紧急" }];

const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message.trim() ? error.message : fallback;
const itemTitle = (item: SourceInboxItem) => item.pageTitle?.trim() || item.annotation?.trim() || item.quote?.trim() || item.sourceId;
const excerpt = (item: SourceInboxItem) => {
  const value = item.annotation?.trim() || item.quote?.trim() || item.url?.trim() || "";
  return value.length > 120 ? `${value.slice(0, 120)}…` : value;
};

export function SourceInboxModal({ open, workspaceId, onClose }: { open: boolean; workspaceId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SourceInboxStatus>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [currentId, setCurrentId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<SourceInboxPreview | null>(null);
  const [targetTableId, setTargetTableId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeUserId, setAssigneeUserId] = useState<number | undefined>();
  const [workloadHours, setWorkloadHours] = useState<number | null>(null);

  const { data, loading, error, refetch } = useQuery<{ sourceInboxItems: SourceInboxPage }>(SOURCE_INBOX_ITEMS, {
    variables: { workspaceId, status, search: search || null, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE },
    skip: !open || !workspaceId,
    fetchPolicy: "network-only",
  });
  const [previewMutation, { loading: previewLoading }] = useMutation(PREVIEW_SOURCE_INBOX_ITEM);
  const [convertMutation, { loading: converting }] = useMutation(CONVERT_SOURCE_INBOX_ITEM);
  const [statusMutation, { loading: statusUpdating }] = useMutation(UPDATE_SOURCE_INBOX_STATUS);
  const pageData = data?.sourceInboxItems;
  const items = pageData?.items || [];
  const current = useMemo(() => items.find((item) => item.id === currentId) || null, [items, currentId]);

  useEffect(() => {
    if (!open) return;
    setPage(1); setCurrentId(""); setSelectedIds([]); setPreview(null);
  }, [open, status, search, workspaceId]);

  useEffect(() => {
    if (currentId && !items.some((item) => item.id === currentId)) {
      setCurrentId(items[0]?.id || ""); setPreview(null);
    }
  }, [items, currentId]);

  const applyPreview = (value: SourceInboxPreview) => {
    setPreview(value); setTargetTableId(value.targetTable.tableId); setTitle(value.suggestion.title || "");
    setDescription(value.suggestion.description || ""); setPriority(value.suggestion.priority || "medium");
    setAssigneeUserId(value.suggestion.suggestedAssigneeUserId ?? undefined); setWorkloadHours(value.suggestion.workloadHours ?? null);
  };

  const generatePreview = async (tableId?: string) => {
    if (!current) return;
    try {
      const response = await previewMutation({ variables: { itemId: current.id, targetTableId: tableId || targetTableId || null, model: null } });
      const value = (response as unknown as { data?: { previewSourceInboxItem?: SourceInboxPreview } }).data?.previewSourceInboxItem;
      if (!value?.suggestion) throw new Error("没有生成可用建议");
      applyPreview(value);
    } catch (e) { message.error(errorText(e, "生成任务建议失败")); }
  };

  const updateStatus = async (ids: string[], next: "pending" | "archived" | "ignored") => {
    if (!ids.length) return;
    try {
      await statusMutation({ variables: { itemIds: ids, status: next } });
      message.success(next === "archived" ? "已归档" : next === "ignored" ? "已忽略" : "已恢复待处理");
      setSelectedIds([]); setCurrentId(""); setPreview(null); await refetch();
    } catch (e) { message.error(errorText(e, "更新状态失败")); }
  };

  const convert = async () => {
    if (!current || !preview || !targetTableId || !title.trim()) return;
    try {
      const response = await convertMutation({ variables: { itemId: current.id, targetTableId, title: title.trim(), description: description.trim(), priority, assigneeUserId: assigneeUserId ?? null, workloadHours } });
      const result = (response as unknown as { data?: { convertSourceInboxItem?: SourceInboxConvertResult } }).data?.convertSourceInboxItem;
      if (!result?.task?.recordId) throw new Error("任务创建结果为空");
      message.success(result.idempotent ? "该来源已经转过任务" : "已创建任务并保留来源回链");
      await refetch();
      navigate(result.task.deepLink); onClose();
    } catch (e) { message.error(errorText(e, "转为任务失败")); }
  };

  const renderSimilar = (task: SimilarTask) => (
    <Card key={task.recordId} size="small" style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div><Text strong>{task.title}</Text><div style={{ marginTop: 4 }}><Tag>{Math.round(task.similarity * 100)}% 相似</Tag>{task.status ? <Tag>{task.status}</Tag> : null}{task.owner ? <Tag>{task.owner}</Tag> : null}</div></div>
        <Button type="link" size="small" onClick={() => { navigate(task.deepLink); onClose(); }}>打开</Button>
      </div>
    </Card>
  );

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1180} style={{ top: 28 }} destroyOnHidden title={<Space><InboxOutlined style={{ color: "#2563EB" }} /><span>来源任务收件箱</span><Tag color="blue">QNote / Clipper</Tag></Space>}>
      <Alert type="info" showIcon message="来源先进入收件箱，只有明确确认后才写入正式任务" description="收件箱按当前用户隔离；相似任务与 AI 上下文只使用你有权限看到的数据。" style={{ marginBottom: 10 }} />
      <Tabs activeKey={status} onChange={(key) => setStatus(key as SourceInboxStatus)} items={(Object.keys(STATUS_LABELS) as SourceInboxStatus[]).map((key) => ({ key, label: STATUS_LABELS[key] }))} />
      <div style={{ display: "flex", gap: 14, height: "68vh", minHeight: 520 }}>
        <div style={{ width: 400, borderRight: "1px solid #EAECF0", paddingRight: 14, display: "flex", flexDirection: "column" }}>
          <Input.Search value={searchInput} allowClear placeholder="搜索标题、批注、摘录或 URL" onChange={(e) => setSearchInput(e.target.value)} onSearch={(value) => setSearch(value.trim())} style={{ marginBottom: 9 }} />
          {selectedIds.length && status !== "converted" ? <Space size={5} wrap style={{ marginBottom: 8 }}><Text type="secondary">已选 {selectedIds.length} 项</Text><Button size="small" loading={statusUpdating} onClick={() => void updateStatus(selectedIds, "archived")}>批量归档</Button><Button size="small" icon={<CloseCircleOutlined />} loading={statusUpdating} onClick={() => void updateStatus(selectedIds, "ignored")}>批量忽略</Button></Space> : null}
          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? <div style={{ textAlign: "center", padding: 40 }}><Spin /></div> : error ? <Alert type="error" message="收件箱加载失败" description={error.message} /> : !items.length ? <Empty description="当前分类没有来源资料" /> : <List dataSource={items} renderItem={(item) => (
              <List.Item onClick={() => { setCurrentId(item.id); setPreview(null); }} style={{ cursor: "pointer", padding: "9px 7px", background: item.id === currentId ? "#EFF6FF" : undefined, borderRadius: 8, marginBottom: 3, alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 7, width: "100%" }}>{item.status !== "converted" ? <Checkbox checked={selectedIds.includes(item.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setSelectedIds((old) => e.target.checked ? Array.from(new Set([...old, item.id])) : old.filter((id) => id !== item.id))} /> : null}<div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 5 }}><Text strong ellipsis style={{ maxWidth: 245 }}>{itemTitle(item)}</Text><Tag color={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Tag></div><Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ margin: "4px 0 0", fontSize: 12 }}>{excerpt(item)}</Paragraph></div></div>
              </List.Item>
            )} />}
          </div>
          <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={pageData?.totalCount || 0} showSizeChanger={false} onChange={setPage} style={{ marginTop: 8, alignSelf: "center" }} />
        </div>

        <div style={{ flex: 1, overflow: "auto", paddingRight: 2 }}>
          {!current ? <Empty description="选择一条来源资料进行整理" style={{ marginTop: 120 }} /> : <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><Title level={5} style={{ margin: 0 }}>{itemTitle(current)}</Title><Space size={5} wrap style={{ marginTop: 7 }}><Tag color={STATUS_COLORS[current.status]}>{STATUS_LABELS[current.status]}</Tag><Tag>{current.sourceType}</Tag>{current.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space></div>{current.url ? <Button icon={<LinkOutlined />} onClick={() => window.open(current.url || "", "_blank", "noopener,noreferrer")}>打开原文</Button> : null}</div>
            {current.status === "duplicate" ? <Alert type="warning" showIcon icon={<WarningOutlined />} message="疑似重复来源" description={`内容与 ${current.duplicateOfId || "另一条来源"} 相同；系统不会自动合并。`} style={{ marginTop: 10 }} /> : null}
            {current.annotation ? <Card size="small" title="批注" style={{ marginTop: 10 }}><Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{current.annotation}</Paragraph></Card> : null}
            {current.quote ? <Card size="small" title="原文摘录" style={{ marginTop: 8 }}><Paragraph type="secondary" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{current.quote}</Paragraph></Card> : null}
            {current.screenshotUrl ? <Card size="small" title="截图" style={{ marginTop: 8 }}><Image src={current.screenshotUrl} style={{ maxHeight: 220, objectFit: "contain" }} /></Card> : null}

            {current.status === "converted" ? <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="已转换为正式任务" action={current.targetTableId && current.targetRecordId ? <Button size="small" onClick={() => { navigate(`/workbench/${current.targetTableId}?recordId=${current.targetRecordId}`); onClose(); }}>打开任务</Button> : undefined} style={{ marginTop: 12 }} /> : <>
              <Card size="small" title="任务建议" style={{ marginTop: 12 }}>
                {!preview ? <div style={{ textAlign: "center", padding: "16px 0" }}><Button type="primary" icon={<RobotOutlined />} loading={previewLoading} onClick={() => void generatePreview()}>AI 生成任务建议</Button><div style={{ fontSize: 12, color: "#6B7280", marginTop: 7 }}>只生成预览，不会创建任务</div></div> : <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {preview.warnings?.length ? <Alert type="warning" showIcon message={preview.warnings.join("；")} /> : null}
                  <label><Text type="secondary">目标项目表</Text><Select value={targetTableId} style={{ width: "100%", marginTop: 4 }} options={preview.availableTables.map((table) => ({ value: table.tableId, label: table.name }))} onChange={(value) => { setTargetTableId(value); void generatePreview(value); }} /></label>
                  <label><Text type="secondary">任务标题</Text><Input value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} style={{ marginTop: 4 }} /></label>
                  <label><Text type="secondary">任务描述</Text><TextArea value={description} maxLength={10000} autoSize={{ minRows: 4, maxRows: 8 }} onChange={(e) => setDescription(e.target.value)} style={{ marginTop: 4 }} /></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><label><Text type="secondary">优先级</Text><Select value={priority} options={PRIORITIES} onChange={setPriority} style={{ width: "100%", marginTop: 4 }} /></label><label><Text type="secondary">负责人</Text><Select allowClear value={assigneeUserId} placeholder="暂不指定" onChange={setAssigneeUserId} options={preview.members.map((m) => ({ value: m.userId, label: `${m.name}${m.role ? ` · ${m.role}` : ""}` }))} style={{ width: "100%", marginTop: 4 }} /></label><label><Text type="secondary">预计工时</Text><InputNumber min={0} max={10000} value={workloadHours} onChange={setWorkloadHours} style={{ width: "100%", marginTop: 4 }} /></label></div>
                  <Alert type={preview.suggestion.shouldConvert ? "success" : "info"} showIcon message={preview.suggestion.shouldConvert ? "建议转为任务" : "建议先保留为资料"} description={`${preview.suggestion.reason || ""} 置信度 ${Math.round(preview.suggestion.confidence * 100)}%`} />
                  {preview.fieldPlan.schemaAdditions.length ? <div><Text type="secondary">确认后补充字段：</Text><Space size={4} wrap>{preview.fieldPlan.schemaAdditions.map((field) => <Tag key={field.id}>{field.name}</Tag>)}</Space></div> : null}
                  {preview.similarTasks.length ? <div><Text strong>疑似相似任务</Text><div style={{ marginTop: 6 }}>{preview.similarTasks.map(renderSimilar)}</div>{preview.similarityScanTruncated ? <Text type="secondary" style={{ fontSize: 12 }}>扫描达到安全上限，候选可能非全量。</Text> : null}</div> : null}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}><Button loading={statusUpdating} onClick={() => void updateStatus([current.id], "archived")}>仅归档</Button><Button loading={statusUpdating} onClick={() => void updateStatus([current.id], "ignored")}>忽略</Button><Button type="primary" icon={<CheckCircleOutlined />} loading={converting} disabled={!title.trim() || !targetTableId} onClick={() => void convert()}>确认并转为任务</Button></div>
                </div>}
              </Card>
              {!preview ? <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 8 }}><Button loading={statusUpdating} onClick={() => void updateStatus([current.id], "archived")}>仅归档</Button><Button loading={statusUpdating} onClick={() => void updateStatus([current.id], "ignored")}>忽略</Button></div> : null}
            </>}
          </div>}
        </div>
      </div>
    </Modal>
  );
}
