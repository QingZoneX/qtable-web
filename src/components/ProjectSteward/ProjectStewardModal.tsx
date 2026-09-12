import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BulbOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { client } from "../../lib/apollo";
import {
  GET_WORKSPACE,
  PROJECT_STEWARD_ASK,
  PROJECT_STEWARD_DIAGNOSIS,
} from "../../lib/graphql";
import type {
  ProjectStewardConclusion,
  ProjectStewardDiagnosisStatus,
  ProjectStewardResult,
} from "./projectStewardTypes";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type ProjectStewardModalProps = {
  open: boolean;
  workspaceId: string;
  tableId: string;
  onClose: () => void;
};

type WorkspaceNode = {
  type: "folder" | "table" | "dashboard";
  id: string;
  name: string;
  children?: WorkspaceNode[];
};

const findParent = (
  root: WorkspaceNode,
  targetId: string,
): WorkspaceNode | null => {
  for (const child of root.children || []) {
    if (child.id === targetId) return root;
    const nested = findParent(child, targetId);
    if (nested) return nested;
  }
  return null;
};

const collectTables = (node: WorkspaceNode): WorkspaceNode[] => {
  if (node.type === "table") return [node];
  return (node.children || []).flatMap(collectTables);
};

const QUICK_QUESTIONS = [
  "为什么延期？",
  "当前哪里阻塞？",
  "今天最应该推进什么？",
];

const severityColor = (severity: string) => {
  if (severity === "critical") return "red";
  if (severity === "high") return "orange";
  if (severity === "medium") return "gold";
  if (severity === "low") return "blue";
  return "default";
};

function ConclusionList({
  title,
  tag,
  items,
  onEvidenceClick,
}: {
  title: string;
  tag: string;
  items: ProjectStewardConclusion[];
  onEvidenceClick: (deepLink: string) => void;
}) {
  if (!items.length) return null;

  return (
    <div>
      <Space size={8} style={{ marginBottom: 10 }}>
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>
          {title}
        </Title>
        <Tag>{tag}</Tag>
      </Space>
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        {items.map((item) => (
          <Card
            key={item.id}
            size="small"
            styles={{ body: { padding: 12 } }}
          >
            <Space
              align="start"
              style={{ width: "100%", justifyContent: "space-between" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <Space size={6} wrap>
                  <Text strong>{item.title}</Text>
                  <Tag color={severityColor(item.severity)}>
                    {item.severity}
                  </Tag>
                </Space>
                <Paragraph
                  style={{
                    margin: "6px 0 8px",
                    color: "#475467",
                    fontSize: 13,
                  }}
                >
                  {item.detail}
                </Paragraph>
                {item.evidence.length > 0 ? (
                  <Space size={[4, 4]} wrap>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      证据：
                    </Text>
                    {item.evidence.map((evidence) => (
                      <Button
                        key={`${evidence.tableId}:${evidence.recordId}`}
                        type="link"
                        size="small"
                        icon={<LinkOutlined />}
                        onClick={() => onEvidenceClick(evidence.deepLink)}
                        style={{ padding: "0 4px", height: 22 }}
                      >
                        {evidence.title}
                      </Button>
                    ))}
                  </Space>
                ) : null}
              </div>
            </Space>
          </Card>
        ))}
      </Space>
    </div>
  );
}

export function ProjectStewardModal({
  open,
  workspaceId,
  tableId,
  onClose,
}: ProjectStewardModalProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState(QUICK_QUESTIONS[0]);
  const [result, setResult] = useState<ProjectStewardResult | null>(null);
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [checkingFreshness, setCheckingFreshness] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);

  const { data: workspaceData } = useQuery<{
    workspace: { root: WorkspaceNode };
  }>(GET_WORKSPACE, {
    variables: { workspaceId: workspaceId || undefined },
    skip: !open || !workspaceId,
    fetchPolicy: "network-only",
  });

  const [askSteward, { loading }] = useMutation<{
    projectStewardAsk: ProjectStewardResult;
  }>(PROJECT_STEWARD_ASK);

  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    [],
  );

  const allTableOptions = useMemo(
    () =>
      workspaceData?.workspace?.root
        ? collectTables(workspaceData.workspace.root).map((item) => ({
            label: item.name,
            value: item.id,
          }))
        : tableId
          ? [{ label: tableId, value: tableId }]
          : [],
    [tableId, workspaceData?.workspace?.root],
  );

  const defaultScopeIds = useMemo(() => {
    const root = workspaceData?.workspace?.root;
    if (!root || !tableId) return tableId ? [tableId] : [];
    const parent = findParent(root, tableId);
    if (!parent || parent.id === root.id) return [tableId];
    const siblingProjectTables = collectTables(parent)
      .map((item) => item.id)
      .slice(0, 8);
    return siblingProjectTables.includes(tableId)
      ? siblingProjectTables
      : [tableId, ...siblingProjectTables].slice(0, 8);
  }, [tableId, workspaceData?.workspace?.root]);

  const defaultScopeKey = defaultScopeIds.join("|");
  useEffect(() => {
    if (!open) return;
    setSelectedTableIds(defaultScopeIds);
  }, [defaultScopeKey, open]);

  const checkFreshness = useCallback(async () => {
    if (!diagnosisId) return;
    setCheckingFreshness(true);
    try {
      const response = await client.query<{
        projectStewardDiagnosis: ProjectStewardDiagnosisStatus | null;
      }>({
        query: PROJECT_STEWARD_DIAGNOSIS,
        variables: { diagnosisId },
        fetchPolicy: "network-only",
      });
      const status = response.data?.projectStewardDiagnosis;
      if (!status) {
        setResult(null);
        setStaleReason("诊断记录已不可用，请重新分析。");
        return;
      }
      if (status.isStale) {
        // Security requirement: once stale (including permission-scope changes),
        // do not keep rendering the previous evidence snapshot.
        setResult(null);
        setStaleReason(
          status.staleReason ||
            "项目数据或权限范围已经变化，请重新运行项目管家。",
        );
        return;
      }
      setStaleReason(null);
      if (status.result) {
        setResult(status.result);
      }
    } catch (error) {
      const text =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
      message.error(text || "诊断新鲜度检查失败");
    } finally {
      setCheckingFreshness(false);
    }
  }, [diagnosisId]);

  useEffect(() => {
    if (open && diagnosisId) {
      void checkFreshness();
    }
  }, [checkFreshness, diagnosisId, open]);

  const handleAsk = async () => {
    const prompt = question.trim();
    if (!prompt) {
      message.warning("请输入你想让项目管家分析的问题");
      return;
    }
    if (!workspaceId || !tableId) {
      message.error("当前项目或任务表上下文不可用");
      return;
    }

    try {
      const response = await askSteward({
        variables: {
          workspaceId,
          tableIds:
            selectedTableIds.length > 0 ? selectedTableIds : [tableId],
          question: prompt,
          timezone: browserTimezone,
          dueSoonDays: 3,
          staleTaskDays: 7,
          overloadHours: 40,
          overloadWindowDays: 7,
          maxRecords: 500,
        },
      });
      const payload = response.data?.projectStewardAsk;
      if (!payload) {
        throw new Error("项目管家没有返回诊断结果");
      }
      setResult(payload);
      setDiagnosisId(payload.diagnosisId);
      setStaleReason(null);
    } catch (error) {
      const text =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
      message.error(text || "AI 项目管家分析失败，请稍后重试");
    }
  };

  const handleEvidenceClick = (deepLink: string) => {
    onClose();
    navigate(deepLink);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={860}
      destroyOnHidden={false}
      title={
        <Space size={8}>
          <BulbOutlined style={{ color: "#7C3AED" }} />
          <span>AI 项目管家</span>
          <Tag color="purple">只读分析</Tag>
        </Space>
      }
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="只分析当前账号可见的项目数据"
          description="项目管家不会修改任务、字段或排期。隐藏记录不会进入计数、依赖推断、关键路径或证据链接。"
        />

        <div>
          <Text strong>你想了解什么？</Text>
          <Space size={[6, 6]} wrap style={{ margin: "8px 0" }}>
            {QUICK_QUESTIONS.map((item) => (
              <Button
                key={item}
                size="small"
                type={question === item ? "primary" : "default"}
                onClick={() => setQuestion(item)}
              >
                {item}
              </Button>
            ))}
          </Space>
          <div style={{ marginBottom: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              项目上下文表（默认同一项目文件夹，最多 8 张）
            </Text>
            <Select
              mode="multiple"
              value={selectedTableIds}
              options={allTableOptions}
              onChange={(values) => {
                const next = values.slice(0, 8);
                if (!next.includes(tableId)) {
                  message.warning("当前任务表必须保留在项目上下文中");
                  return;
                }
                setSelectedTableIds(next);
              }}
              maxTagCount="responsive"
              style={{ width: "100%", marginTop: 6 }}
              placeholder="选择项目表和任务表"
            />
          </div>
          <TextArea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            autoSize={{ minRows: 2, maxRows: 5 }}
            maxLength={2000}
            placeholder="例如：为什么这个项目延期？当前最主要的阻塞在哪里？"
          />
          <Space style={{ marginTop: 10 }}>
            <Button
              type="primary"
              onClick={() => void handleAsk()}
              loading={loading}
              icon={<BulbOutlined />}
            >
              开始诊断
            </Button>
            {diagnosisId ? (
              <Button
                onClick={() => void checkFreshness()}
                loading={checkingFreshness}
                icon={<ReloadOutlined />}
              >
                检查数据是否变化
              </Button>
            ) : null}
          </Space>
        </div>

        {staleReason ? (
          <Alert
            type="warning"
            showIcon
            message="旧诊断已过期"
            description={staleReason}
            action={
              <Button
                size="small"
                type="primary"
                onClick={() => void handleAsk()}
                loading={loading}
              >
                重新分析
              </Button>
            }
          />
        ) : null}

        {loading && !result ? (
          <div
            style={{
              minHeight: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spin tip="正在读取当前可见项目上下文并诊断..." />
          </div>
        ) : null}

        {result ? (
          <>
            <Divider style={{ margin: "2px 0" }} />
            <Space size={[6, 6]} wrap>
              <Tag>
                快照：
                {dayjs(result.snapshot.capturedAt).format("YYYY-MM-DD HH:mm:ss")}
              </Tag>
              <Tag>{result.snapshot.visibleRecordCount} 条可见记录</Tag>
              <Tag color={result.snapshot.isStale ? "orange" : "green"}>
                {result.snapshot.isStale ? "已过期" : "当前快照"}
              </Tag>
              <Tag>{result.provider}</Tag>
            </Space>

            {result.snapshot.truncated ? (
              <Alert
                type="warning"
                showIcon
                message="当前诊断已达到记录上限"
                description="下面的结论不能视为全项目完整结论。请缩小分析范围后重新运行。"
              />
            ) : null}

            <Card size="small" style={{ background: "#F9FAFB" }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                对当前问题的结构化回答
              </Text>
              <Paragraph
                style={{
                  whiteSpace: "pre-line",
                  margin: "6px 0 0",
                  fontSize: 14,
                }}
              >
                {result.answer}
              </Paragraph>
            </Card>

            <ConclusionList
              title="事实"
              tag="直接来自当前数据"
              items={result.facts}
              onEvidenceClick={handleEvidenceClick}
            />
            <ConclusionList
              title="推断"
              tag="基于依赖与规则计算"
              items={result.inferences}
              onEvidenceClick={handleEvidenceClick}
            />
            <ConclusionList
              title="建议"
              tag="行动优先级"
              items={result.suggestions}
              onEvidenceClick={handleEvidenceClick}
            />
          </>
        ) : null}
      </Space>
    </Modal>
  );
}
