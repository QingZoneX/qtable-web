import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { Bubble, CodeHighlighter, Sender } from "@ant-design/x";
import type { BubbleItemType } from "@ant-design/x";
import { useXChat } from "@ant-design/x-sdk";
import { XMarkdown } from "@ant-design/x-markdown";
import type { ComponentProps } from "@ant-design/x-markdown";
import {
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useMutation, useQuery } from "@apollo/client/react";
import { t } from "../../lib/i18nRuntime";
import {
  useAiAssistantStore,
  type AiConversation,
  type AiMessage,
} from "../../store/aiAssistantStore";
import {
  CREATE_CONVERSATION,
  UPDATE_CONVERSATION,
  GET_AI_CONFIGS,
  GET_CONVERSATIONS,
  streamAnalyze,
  runAgent,
  type ChatRunResult,
} from "../../lib/aiApi";
import type { ToolExecutionTrace } from "../../lib/aiToolRouter";
import TableSelector from "./TableSelector";
import "./chatArea.css";
import { useSmartTableStore } from "../../store/useSmartTableStore";

const { Paragraph, Text, Title } = Typography;

type ConversationsQueryData = {
  conversations: AiConversation[];
};

type CreateConversationMutationData = {
  createConversation: AiConversation;
};

type AiConfigsQueryData = {
  aiConfigs: Array<{
    id: string;
    provider: string;
    model: string;
    createdAt: string;
    updatedAt?: string;
  }>;
};

// type DeleteConversationMutationData = {
//   deleteConversation: boolean;
// };

type ChatAreaProps = {
  onOpenConfig: () => void;
};

type PromptItem = {
  key: string;
  label: string;
  description: string;
  accent: string;
};

type ChatRenderMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  tableIds?: string[];
  streaming?: boolean;
  error?: boolean;
};

type ToolTraceSnapshot = {
  traceId?: string;
  status: "completed" | "requires_confirmation" | "failed";
  answer?: string;
  provider?: string;
  model?: string;
  toolCalls: ToolExecutionTrace[];
  pendingConfirmation?: Record<string, unknown>;
  updatedAt: string;
  mode: "chat" | "agent";
};

const PROMPT_ITEMS: PromptItem[] = [
  {
    key: "请先总结当前数据表的核心信息，并指出值得关注的指标。",
    label: "总结表格",
    description: "快速概览当前表数据",
    accent: "#1677FF",
  },
  {
    key: "请分析当前数据表里最异常的记录，并解释可能原因。",
    label: "识别异常",
    description: "找出异常数据与风险点",
    accent: "#722ED1",
  },
  {
    key: "请基于当前数据表给出适合的图表建议，并说明理由。",
    label: "图表建议",
    description: "推荐更合适的可视化方式",
    accent: "#13C2C2",
  },
];

// 默认模型选项（如果没有配置，显示这些）
const DEFAULT_MODEL_OPTIONS = [
  { label: "deepseek-chat", value: "deepseek-chat" },
  { label: "deepseek-reasoner", value: "deepseek-reasoner" },
  { label: "deepseek-v3", value: "deepseek-v3" },
  { label: "deepseek-v4-flash", value: "deepseek-v4-flash" },
];

const toPlainText = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(toPlainText).join("");
  }

  return "";
};

const formatMessageTime = (value?: string) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MarkdownCode = ({ children, block, lang }: ComponentProps) => {
  const code = toPlainText(children).replace(/\n$/, "");

  if (!block) {
    return <code className="ai-chat-inline-code">{children}</code>;
  }

  return (
    <CodeHighlighter
      className="ai-chat-code-block"
      lang={lang}
      header={lang ? () => <span>{lang}</span> : false}
      styles={{
        root: { margin: 0 },
      }}
    >
      {code}
    </CodeHighlighter>
  );
};

const markdownComponents = {
  code: MarkdownCode,
};

type AssistantMessageContentProps = {
  content: string;
  status?: string;
  streaming?: boolean;
  error?: boolean;
};

const AssistantMessageContent: React.FC<AssistantMessageContentProps> = ({
  content,
  status,
  streaming,
  error,
}) => {
  // 检查是否是思考中的消息
  const isThinking = content.includes("正在分析") || content.includes("思考中");
  
  if (isThinking) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Spin size="small" />
        <Text type="secondary">{content}</Text>
      </div>
    );
  }
  
  return (
    <div
      className={
        error ? "ai-chat-markdown ai-chat-markdown-error" : "ai-chat-markdown"
      }
    >
      <XMarkdown
        content={content}
        components={markdownComponents}
        openLinksInNewTab
        escapeRawHtml
        streaming={
          streaming || status === "loading"
            ? {
                hasNextChunk: true,
                enableAnimation: true,
                tail: true,
              }
            : undefined
        }
      />
    </div>
  );
};

const ChatAreaEnhanced: React.FC<ChatAreaProps> = ({ onOpenConfig }) => {
  const {
    configStatus,
    currentConversationId,
    conversations,
    streaming,
    streamContent,
    selectedTableIds,
    mode,
    selectedModelOverride,
    setConversations,
    upsertConversation,
    updateConversationTitle,
    setStreaming,
    appendStreamContent,
    resetStreamContent,
    setCurrentConversation,
    addMessage,
    setMode,
    setSelectedModelOverride,
  } = useAiAssistantStore();

  const { insertRowsWithData, fields: tableFields } = useSmartTableStore();

  const [question, setQuestion] = useState("");
  const [draftMessageSeq, setDraftMessageSeq] = useState(0);
  const [streamError, setStreamError] = useState<{
    tableIds: string[] | null;
    conversationId: string | null;
    message: string;
  } | null>(null);
  
  // AI创建记录相关状态
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [showRecordPreview, setShowRecordPreview] = useState(false);
  const [editableRecords, setEditableRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [conversationTraceMap, setConversationTraceMap] = useState<Record<string, ToolTraceSnapshot>>({});
  // 表格行内编辑状态：{ rowKey: fieldId } 表示正在编辑该行该字段
  const [editingCell, setEditingCell] = useState<{ rowKey: string; fieldId: string } | null>(null);
  
  // 构建 AI 数据键 -> 表字段 ID 的映射
  const fieldKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const field of tableFields) {
      // 按字段名（大小写不敏感）以及字段 ID 进行映射
      map.set(field.name.toLowerCase(), field.id);
      map.set(field.id.toLowerCase(), field.id);
    }
    return map;
  }, [tableFields]);
  
  // 将 AI 返回的单条记录数据映射为表字段键值对
  const mapAiRecordToFieldKeys = useCallback(
    (aiRecord: Record<string, unknown>): Record<string, unknown> => {
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(aiRecord)) {
        const fieldId = fieldKeyMap.get(key.toLowerCase());
        if (fieldId) {
          mapped[fieldId] = value;
        }
      }
      return mapped;
    },
    [fieldKeyMap],
  );
  
  // 将 AI 返回的数据数组映射为表字段键值对数组，并添加行索引
  const mapAiRecordsToFieldKeys = useCallback(
    (aiRecords: Record<string, unknown>[]): Record<string, unknown>[] => {
      return aiRecords.map((record, index) => ({
        _rowKey: `ai-record-${index}`,
        ...mapAiRecordToFieldKeys(record),
      }));
    },
    [mapAiRecordToFieldKeys],
  );
  
  // 更新表格中指定行的指定字段值
  const updateCellValue = useCallback((rowKey: string, fieldId: string, value: unknown) => {
    setEditableRecords(prev =>
      prev.map(record =>
        record._rowKey === rowKey ? { ...record, [fieldId]: value } : record
      )
    );
  }, []);
  
  // 输入框高度相关状态
  const [composerHeight, setComposerHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);

  const minComposerHeight = 180;
  const maxComposerHeight = 500;

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartHeight(composerHeight);
    e.preventDefault();
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaY = dragStartY - e.clientY;
    const newHeight = dragStartHeight + deltaY;
    
    const clampedHeight = Math.max(minComposerHeight, Math.min(maxComposerHeight, newHeight));
    setComposerHeight(clampedHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, dragStartY, dragStartHeight]);

  const {
    data,
    loading: conversationsLoading,
    refetch: refetchConversations,
  } = useQuery<ConversationsQueryData>(GET_CONVERSATIONS, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const [createConversation, { loading: creatingConversation }] =
    useMutation<CreateConversationMutationData>(CREATE_CONVERSATION);
  const [updateConversation] = useMutation(UPDATE_CONVERSATION);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingConversation, setEditingConversation] = useState<AiConversation | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: aiConfigsData } = useQuery<AiConfigsQueryData>(GET_AI_CONFIGS);

  const { parsedMessages, setMessages } = useXChat<
    ChatRenderMessage,
    ChatRenderMessage
  >({
    conversationKey:
      currentConversationId ?? selectedTableIds[0] ?? "ai-assistant-draft",
    defaultMessages: [],
    parser: (chatMessage) => chatMessage,
  });

  // 跟踪是否已经执行过首次自动选择（避免用户显式"新建对话"后被覆盖）
  const didAutoSelectRef = useRef(false);

  useEffect(() => {
    const nextConversations = data?.conversations ?? [];
    setConversations(nextConversations);

    if (!nextConversations.length) {
      setCurrentConversation(null);
      didAutoSelectRef.current = false;
      return;
    }

    // 仅在首次加载对话列表、且用户未主动选择过对话时，自动选中第一条
    if (!currentConversationId && !didAutoSelectRef.current) {
      setCurrentConversation(nextConversations[0].id);
      didAutoSelectRef.current = true;
      return;
    }

    // 当前选中的对话已被删除，则回退到第一条
    if (
      currentConversationId &&
      !nextConversations.some(
        (conversation) => conversation.id === currentConversationId,
      )
    ) {
      setCurrentConversation(nextConversations[0].id);
    }
    // currentConversationId 刻意不加入 deps，避免用户"新建对话"后被自动回选
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data?.conversations,
    setConversations,
    setCurrentConversation,
  ]);

  useEffect(() => {
    resetStreamContent();
  }, [currentConversationId, resetStreamContent]);

  const currentConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === currentConversationId,
      ) ?? null,
    [conversations, currentConversationId],
  );
  const currentToolTrace = useMemo(
    () => (currentConversationId ? conversationTraceMap[currentConversationId] ?? null : null),
    [conversationTraceMap, currentConversationId],
  );

  const renderMessages = useMemo<ChatRenderMessage[]>(() => {
    const items: ChatRenderMessage[] = (
      currentConversation?.messages ?? []
    ).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      tableIds: msg.tableIds,
      createdAt: msg.createdAt,
    }));

    if (streaming) {
      items.push({
        id: "streaming",
        role: "assistant",
        content: streamContent || "正在分析当前数据表...",
        createdAt: new Date().toISOString(),
        streaming: true,
      });
    }

    if (
      !streaming &&
      streamError &&
      streamError.tableIds?.every((id) => selectedTableIds.includes(id)) &&
      streamError.conversationId === (currentConversationId ?? null)
    ) {
      items.push({
        id: "stream-error",
        role: "assistant",
        content: `### 请求失败\n\n${streamError.message}\n\n请检查 AI Key、网络状态或稍后重试。`,
        createdAt: new Date().toISOString(),
        error: true,
      });
    }

    return items;
  }, [
    currentConversation?.messages,
    currentConversationId,
    selectedTableIds,
    streamContent,
    streamError,
    streaming,
  ]);

  useEffect(() => {
    setMessages(
      renderMessages.map((item) => ({
        id: item.id,
        status: item.error ? "error" : item.streaming ? "loading" : "success",
        message: item,
      })),
    );
  }, [renderMessages, setMessages]);

  const bubbleItems = useMemo<BubbleItemType[]>(
    () =>
      parsedMessages.map(({ id, message: chatMessage, status }) => ({
        key: id,
        role: chatMessage.role === "user" ? "user" : "ai",
        content: chatMessage.content,
        status,
        loading: status === "loading" && !chatMessage.content,
        streaming: Boolean(chatMessage.streaming),
        extraInfo: {
          createdAt: chatMessage.createdAt,
          tableIds: chatMessage.tableIds,
          streaming: chatMessage.streaming,
          error: chatMessage.error,
        },
      })),
    [parsedMessages],
  );

  const canChat = Boolean(selectedTableIds.length > 0 && configStatus?.configured);
  const showWelcome = bubbleItems.length === 0 && !conversationsLoading;

  // 模式切换处理
  const updateConversationTrace = (
    conversationId: string,
    snapshot: ToolTraceSnapshot,
  ) => {
    setConversationTraceMap((prev) => ({
      ...prev,
      [conversationId]: snapshot,
    }));
  };

  const handleModeChange = (newMode: 'chat' | 'agent') => {
    setMode(newMode);
    const modeName = newMode === 'chat' ? 'Chat 对话' : 'Agent 代理';
    message.info(`已切换到 ${modeName} 模式`);
  };

  // 动态生成模型选项：优先使用用户配置的模型，否则使用默认选项
  const modelOptions = useMemo(() => {
    const configs = aiConfigsData?.aiConfigs ?? [];
    if (configs.length > 0) {
      return configs.map((config: { model: string; provider: string }) => ({
        label: `${config.model} (${config.provider})`,
        value: config.model,
      }));
    }
    return DEFAULT_MODEL_OPTIONS;
  }, [aiConfigsData]);

  const defaultModel =
    configStatus?.model || configStatus?.provider || "deepseek-chat";
  const selectedModel = configStatus?.configured
    ? selectedModelOverride || defaultModel
    : "";
  const currentModelLabel = selectedModel || "未配置模型";
  const refreshConversations = async () => {
    const result = await refetchConversations();
    const nextConversations = result.data?.conversations ?? [];
    setConversations(nextConversations);
    return nextConversations;
  };

  const handleSend = async (nextQuestion?: string) => {
    const content = (nextQuestion ?? question).trim();
    if (!content || streaming) return;

    if (selectedTableIds.length === 0) {
      message.warning("请先选择数据表");
      return;
    }

    if (!configStatus?.configured) {
      setStreamError({
        tableIds: selectedTableIds,
        conversationId: currentConversationId,
        message: "未配置 AI API Key，请先完成配置。",
      });
      return;
    }

    // 根据模式决定处理方式
    if (mode === 'agent') {
      // AGENT模式：尝试执行操作
      await handleAgentMode(content);
    } else {
      // CHAT模式：正常的对话分析
      await handleChatMode(content);
    }
  };

  // CHAT模式处理
  const handleChatMode = async (content: string) => {
    setStreamError(null);
    resetStreamContent();

    try {
      let conversation = currentConversation;

      if (!conversation) {
        const result = await createConversation({
          variables: {
            title: content.slice(0, 50),
          },
        });

        conversation = result.data?.createConversation ?? null;
        if (!conversation) {
          throw new Error("创建会话失败");
        }

        upsertConversation(conversation);
        setCurrentConversation(conversation.id);
      }

      const userMessage: AiMessage = {
        id: `temp-user-${draftMessageSeq}`,
        role: "user",
        content,
        tableIds: [...selectedTableIds],
        createdAt: new Date().toISOString(),
      };

      addMessage(conversation.id, userMessage);
      setDraftMessageSeq((value) => value + 1);
      setQuestion("");
      setStreaming(true);

      let requestError: string | null = null;

      await streamAnalyze({
        tableId: selectedTableIds[0] || undefined,
        tableIds: selectedTableIds,
        model: selectedModel || undefined,
        question: content,
        conversationId: conversation.id,
        mode: 'chat',
        onChunk: (chunk) => {
          appendStreamContent(chunk);
        },
        onResult: (result: ChatRunResult) => {
          updateConversationTrace(conversation!.id, {
            traceId: result.traceId,
            status: result.status,
            answer: result.answer,
            provider: result.provider,
            model: result.model,
            toolCalls: result.toolCalls ?? [],
            pendingConfirmation: result.pendingConfirmation,
            updatedAt: new Date().toISOString(),
            mode: "chat",
          });
        },
        onDone: () => {
          // handled after await to keep logic linear
        },
        onError: (msg) => {
          requestError = msg;
        },
      });

      if (requestError) {
        setStreamError({
          tableIds: selectedTableIds,
          conversationId: conversation.id,
          message: requestError,
        });
        return;
      }

      await refreshConversations();
      resetStreamContent();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "发送消息时发生未知错误";
      setStreamError({
        tableIds: selectedTableIds,
        conversationId: currentConversation?.id ?? currentConversationId,
        message: errorMessage,
      });
      message.error(errorMessage);
    } finally {
      setStreaming(false);
    }
  };

  // AGENT模式处理
  const handleAgentMode = async (content: string) => {
    if (!configStatus?.configured) {
      message.error("未配置 AI API Key");
      return;
    }

    setCreatingRecord(true);
    
    // 先添加用户消息
    let conversation = currentConversation;
    if (!conversation) {
      try {
        const result = await createConversation({
          variables: {
            title: content.slice(0, 50),
          },
        });
        conversation = result.data?.createConversation ?? null;
        if (conversation) {
          upsertConversation(conversation);
          setCurrentConversation(conversation.id);
        }
      } catch {
        message.error("创建会话失败");
        setCreatingRecord(false);
        return;
      }
    }

    if (conversation) {
      const userMessage: AiMessage = {
        id: `temp-user-${draftMessageSeq}`,
        role: "user",
        content,
        tableIds: [...selectedTableIds],
        createdAt: new Date().toISOString(),
      };
      addMessage(conversation.id, userMessage);
      setDraftMessageSeq((value) => value + 1);
    }
    
    setQuestion("");
    
    // 显示AI正在思考的消息
    const thinkingMessageId = `thinking-${draftMessageSeq}`;
    if (conversation) {
      const thinkingMessage: AiMessage = {
        id: thinkingMessageId,
        role: "assistant",
        content: "🤔 正在分析你的需求...",
        createdAt: new Date().toISOString(),
      };
      addMessage(conversation.id, thinkingMessage);
    }
    
    try {
      const result = await runAgent({
        tableId: selectedTableIds[0],
        tableIds: selectedTableIds,
        model: selectedModel || undefined,
        question: content,
        conversationId: conversation?.id,
      });

      // 移除思考消息
      if (conversation) {
        // 通过重新加载对话来移除临时消息
        await refreshConversations();
      }

      if (result.success && result.data) {
        if (conversation) {
          updateConversationTrace(conversation.id, {
            traceId: result.toolTraceId,
            status: result.toolStatus || "requires_confirmation",
            answer: result.message,
            provider: result.provider,
            model: result.model,
            toolCalls: result.toolCalls ?? [],
            pendingConfirmation: result.pendingConfirmation,
            updatedAt: new Date().toISOString(),
            mode: "agent",
          });
        }
        
        // 从 AI 返回的数据中提取记录数组
        const aiData = result.data as Record<string, unknown>;
        let rawRecords: Record<string, unknown>[] = [];
        
        // 尝试从 data.tasks / data.records / data.rows 等常见键中提取数组
        const arrayKeys = ['tasks', 'records', 'rows', 'items', 'data'];
        for (const key of arrayKeys) {
          if (Array.isArray(aiData[key])) {
            rawRecords = aiData[key] as Record<string, unknown>[];
            break;
          }
        }
        
        // 如果没有找到数组键，尝试将整个 data 作为单条记录
        if (rawRecords.length === 0) {
          const hasArrayValue = Object.values(aiData).some(v => Array.isArray(v));
          if (!hasArrayValue) {
            rawRecords = [aiData];
          }
        }
        
        if (rawRecords.length > 0) {
          const mappedRecords = mapAiRecordsToFieldKeys(rawRecords);
          setEditableRecords(mappedRecords);
          // 默认全选所有行
          setSelectedRowKeys(mappedRecords.map((r) => String(r._rowKey)));
          setShowRecordPreview(true);
          message.success(`✨ AI已生成 ${rawRecords.length} 条记录数据，请确认后创建`);
        } else {
          message.error("AI未能生成有效的记录数据，请尝试更详细的描述");
        }
      } else {
        message.error("AI未能生成有效的记录数据，请尝试更详细的描述");
      }
    } catch (error) {
      // 移除思考消息
      if (conversation) {
        await refreshConversations();
      }
      
      // 解析错误信息
      let errorMessage = "创建记录失败";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 根据错误代码提供更具体的提示
        if (errorMessage.includes("AI_CONFIG_NOT_FOUND")) {
          errorMessage = "未配置AI，请先在设置中配置AI API Key";
        } else if (errorMessage.includes("NO_FIELDS")) {
          errorMessage = "当前表没有字段，无法创建记录";
        } else if (errorMessage.includes("EMPTY_DATA")) {
          errorMessage = "AI未能提取到有效数据，请尝试更详细的描述";
        } else if (errorMessage.includes("AI_PARSE_ERROR")) {
          errorMessage = "AI响应解析失败，请重试";
        } else if (errorMessage.includes("UNAUTHORIZED")) {
          errorMessage = "未授权，请重新登录";
        }
      }
      
      message.error(errorMessage);
      console.error("AI create record error:", error);
    } finally {
      setCreatingRecord(false);
    }
  };

  // 确认创建记录（仅创建已勾选的记录，使用批量插入接口）
  const handleConfirmCreateRecord = async () => {
    if (editableRecords.length === 0) return;
    if (selectedRowKeys.length === 0) {
      message.warning("请至少勾选一条记录");
      return;
    }
    
    // 只保留已勾选的行
    const selectedRecords = editableRecords.filter(
      (r) => selectedRowKeys.includes(String(r._rowKey))
    );
    
    try {
      // 去掉内部的 _rowKey 等元数据字段，构建批量数据
      const recordsToInsert: Record<string, unknown>[] = [];
      for (const record of selectedRecords) {
        const dataToInsert: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record)) {
          if (!key.startsWith('_')) {
            dataToInsert[key] = value;
          }
        }
        recordsToInsert.push(dataToInsert);
      }
      
      const results = await insertRowsWithData(recordsToInsert);
      
      if (results.length > 0) {
        message.success(`成功创建 ${results.length} 条记录`);
        // 刷新对话列表以确保最新数据同步显示
        await refreshConversations();
      } else {
        message.warning("未成功创建任何记录，请重试");
      }
      setShowRecordPreview(false);
      setEditableRecords([]);
      setSelectedRowKeys([]);
      setQuestion("");
    } catch {
      message.error("创建记录失败");
    }
  };

  // 取消创建记录
  const handleCancelCreateRecord = () => {
    setShowRecordPreview(false);
    setEditableRecords([]);
    setSelectedRowKeys([]);
    setEditingCell(null);
  };

  const handleUpdateTitle = async () => {
    if (!editingConversation || !editTitle.trim()) return;
    
    await updateConversation({
      variables: { id: editingConversation.id, title: editTitle.trim() },
    });
    
    updateConversationTitle(editingConversation.id, editTitle.trim());
    setEditModalOpen(false);
    setEditingConversation(null);
    message.success("会话名称已更新");
  };

  return (
    <>
      <div className="ai-chat-shell">
        <div className="ai-chat-main ai-chat-main-assistant">
          {/* <div className="ai-assistant-header">
            <div className="ai-assistant-header-title">
              <RobotOutlined />
              <span>AI 助手</span>
            </div>
            <Space size={4}>
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={handleCreateConversation}
              />
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={onOpenConfig}
              />
              <Button
                type="text"
                icon={<DeleteOutlined />}
                disabled={!currentConversationId}
                onClick={() => {
                  if (!currentConversationId) return;
                  void handleDeleteConversation(currentConversationId);
                }}
              />
            </Space>
          </div> */}

        <div className="ai-assistant-context-bar">
          <Space size={[8, 8]} wrap>
            <Tag bordered={false} color={selectedTableIds.length > 0 ? "blue" : "default"}>
              {selectedTableIds.length > 0 ? `已选 ${selectedTableIds.length} 个数据表` : "未选择数据表"}
            </Tag>
            <Tag
              bordered={false}
              color={configStatus?.configured ? "green" : "default"}
            >
              {configStatus?.configured
                ? `模型 ${currentModelLabel}`
                : "模型未配置"}
            </Tag>
          </Space>
        </div>

        {!configStatus?.configured && (
          <Alert
            type="warning"
            showIcon
            className="ai-chat-inline-alert"
            message="AI API Key 尚未配置"
            description="请先配置 AI Key 后再开始对话，配置完成后即可基于当前数据表进行连续分析。"
            action={
              <Button
                type="primary"
                size="small"
                icon={<SettingOutlined />}
                onClick={onOpenConfig}
              >
                立即配置
              </Button>
            }
          />
        )}

        {selectedTableIds.length === 0 && (
          <Alert
            type="info"
            showIcon
            className="ai-chat-inline-alert"
            message="请选择需要分析的数据表"
            description="请在下方选择数据表（可多选），再开始当前分析会话。"
          />
        )}

        <div className="ai-chat-thread ai-assistant-thread">
          {conversationsLoading && !currentConversation ? (
            <div className="ai-chat-loading">
              <Spin />
            </div>
          ) : showWelcome ? (
            <div className="ai-chat-welcome ai-assistant-welcome">
              {canChat ? (
                <>
                  {/* Work with Agent 头部 */}
                  <div className="ai-assistant-work-with-agent">
                    <Avatar
                      size={48}
                      className="ai-chat-avatar ai-chat-avatar-assistant ai-chat-avatar-lg"
                      icon={<RobotOutlined style={{ fontSize: 24 }} />}
                    />
                    <Title level={4} style={{ margin: 0, color: "#0f172a" }}>
                      Work with Agent
                    </Title>
                    <Paragraph type="secondary" style={{ margin: 0, maxWidth: 360, textAlign: "center" }}>
                      我会基于当前数据表和模型配置，协助你做分析、总结和连续追问。
                    </Paragraph>
                  </div>

                  {/* 快捷提问 */}
                  <div className="ai-chat-prompt-grid ai-assistant-prompt-grid">
                    {PROMPT_ITEMS.map((prompt) => (
                      <button
                        key={prompt.key}
                        type="button"
                        className="ai-chat-prompt-card ai-assistant-prompt-card"
                        onClick={() => {
                          void handleSend(prompt.key);
                        }}
                      >
                        <Text strong>{prompt.label}</Text>
                        <Text className="ai-chat-prompt-question">
                          {prompt.key}
                        </Text>
                      </button>
                    ))}
                  </div>

                  {/* Past Conversations 区域 */}
                  {conversations.length > 0 && (
                    <div className="ai-assistant-past-conversations">
                      <div className="ai-assistant-past-conversations-header">
                        <MessageOutlined style={{ color: "#8c8c8c", fontSize: 13 }} />
                        <Text strong style={{ fontSize: 13, color: "#8c8c8c" }}>
                          历史对话
                        </Text>
                      </div>
                      <div className="ai-assistant-past-conversations-list">
                        {conversations.slice(0, 5).map((conv) => {
                          const dateStr = conv.updatedAt
                            ? new Date(conv.updatedAt).toLocaleDateString("zh-CN")
                            : "";
                          const previewText = conv.title || "未命名会话";
                          return (
                            <button
                              key={conv.id}
                              type="button"
                              className="ai-assistant-past-conv-item"
                              onClick={() => setCurrentConversation(conv.id)}
                            >
                              <div className="ai-assistant-past-conv-icon">
                                <MessageOutlined style={{ fontSize: 12, color: "#bfbfbf" }} />
                              </div>
                              <div className="ai-assistant-past-conv-body">
                                <Text
                                  style={{
                                    fontSize: 13,
                                    display: "block",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: "#262626",
                                  }}
                                >
                                  {previewText}
                                </Text>
                              </div>
                              <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                                {dateStr}
                              </Text>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="完成配置并选择数据表后，即可开始 AI 对话"
                />
              )}
            </div>
          ) : (
            <Bubble.List
              className="ai-chat-list"
              style={{ height: "100%" }}
              autoScroll
              items={bubbleItems}
              role={{
                ai: (data) => ({
                  placement: "start",
                  variant: "borderless",
                  avatar: (
                    <Avatar
                      size={32}
                      className="ai-chat-avatar ai-chat-avatar-assistant"
                      icon={<RobotOutlined />}
                    />
                  ),
                  classNames: {
                    root: "ai-chat-bubble ai-chat-bubble-assistant",
                    content: "ai-chat-bubble-content",
                  },
                  header: () => (
                    <div className="ai-chat-bubble-meta">
                      <Text strong>QTable AI</Text>
                      {data.extraInfo?.tableIds && data.extraInfo.tableIds.length > 0 && (
                        <Tag color="blue" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                          表: {data.extraInfo.tableIds.length}
                        </Tag>
                      )}
                      <Text type="secondary">
                        {formatMessageTime(
                          String(data.extraInfo?.createdAt || ""),
                        )}
                      </Text>
                    </div>
                  ),
                  contentRender: (content, info) => (
                    <AssistantMessageContent
                      content={String(content)}
                      status={info.status}
                      streaming={Boolean(data.extraInfo?.streaming)}
                      error={Boolean(data.extraInfo?.error)}
                    />
                  ),
                }),
                user: (data) => ({
                  placement: "end",
                  variant: "filled",
                  avatar: (
                    <Avatar
                      size={32}
                      className="ai-chat-avatar ai-chat-avatar-user"
                      icon={<UserOutlined />}
                    />
                  ),
                  classNames: {
                    root: "ai-chat-bubble ai-chat-bubble-user",
                    content: "ai-chat-bubble-content",
                  },
                  header: () => (
                    <div className="ai-chat-bubble-meta ai-chat-bubble-meta-user">
                      {data.extraInfo?.tableIds && data.extraInfo.tableIds.length > 0 && (
                        <Tag color="blue" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                          表: {data.extraInfo.tableIds.length}
                        </Tag>
                      )}
                      <Text type="secondary">
                        {formatMessageTime(
                          String(data.extraInfo?.createdAt || ""),
                        )}
                      </Text>
                    </div>
                  ),
                }),
              }}
            />
          )}

          {currentToolTrace && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <Space size={8} wrap>
                  <Text strong>工具调用过程</Text>
                  <Tag color={currentToolTrace.mode === "agent" ? "purple" : "blue"}>
                    {currentToolTrace.mode === "agent" ? "Agent" : "Chat"}
                  </Tag>
                  <Tag color={currentToolTrace.status === "failed" ? "red" : currentToolTrace.status === "requires_confirmation" ? "orange" : "green"}>
                    {currentToolTrace.status}
                  </Tag>
                  {currentToolTrace.traceId && <Text type="secondary">Trace: {currentToolTrace.traceId}</Text>}
                </Space>
                <Text type="secondary">
                  {formatMessageTime(currentToolTrace.updatedAt)}
                </Text>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {currentToolTrace.toolCalls.length > 0 ? (
                  currentToolTrace.toolCalls.map((toolCall) => (
                    <div
                      key={toolCall.toolCallId}
                      style={{
                        background: "#fff",
                        border: "1px solid #f0f0f0",
                        borderRadius: 6,
                        padding: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <Space size={8} wrap>
                          <Text strong>{toolCall.skillName}</Text>
                          <Tag>{toolCall.state}</Tag>
                          <Tag color="geekblue">attempts: {toolCall.attemptCount}</Tag>
                        </Space>
                        <Text type="secondary">{toolCall.functionName}</Text>
                      </div>
                      <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                        <Text type="secondary">参数：</Text>
                      </Paragraph>
                      <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
                        {JSON.stringify(toolCall.arguments, null, 2)}
                      </pre>
                      {toolCall.error && (
                        <>
                          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                            <Text type="danger">错误：</Text>
                          </Paragraph>
                          <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "#cf1322" }}>
                            {JSON.stringify(toolCall.error, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <Text type="secondary">本次回答未触发工具调用。</Text>
                )}
                {currentToolTrace.pendingConfirmation && (
                  <Alert
                    type="info"
                    showIcon
                    message="本次运行包含待确认操作"
                    description={
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
                        {JSON.stringify(currentToolTrace.pendingConfirmation, null, 2)}
                      </pre>
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div 
        className="ai-chat-composer-wrapper"
        style={{ height: `${composerHeight}px` }}
      >
        <div 
          className="ai-chat-composer-resize-handle"
          onMouseDown={handleDragStart}
        />
        
        <div className="ai-chat-composer">
          <div className="ai-mode-switcher" style={{
            display: 'flex', 
            gap: 8, 
            padding: '8px 12px',
            borderBottom: '1px solid #f0f0f0',
            background: mode === 'chat' ? '#e6f4ff' : '#f9f0ff'
          }}>
            <Button
              type={mode === 'chat' ? 'primary' : 'default'}
              icon={<MessageOutlined />}
              onClick={() => handleModeChange('chat')}
              size="small"
            >
              Chat 对话
            </Button>
            <Button
              type={mode === 'agent' ? 'primary' : 'default'}
              icon={<ThunderboltOutlined />}
              onClick={() => handleModeChange('agent')}
              size="small"
            >
              AGENT 代理
            </Button>
            <div style={{ flex: 1 }} />
            <Text type="secondary" style={{ fontSize: 12, lineHeight: '24px' }}>
              {mode === 'chat' 
                ? '分析数据、回答问题' 
                : '⚠️ 执行操作、修改数据'}
            </Text>
          </div>

          
          <Sender
            className="ai-chat-sender"
            value={question}
            onChange={(value) => setQuestion(value)}
            onSubmit={(value) => {
              void handleSend(value);
            }}
            loading={streaming || creatingConversation || creatingRecord}
            disabled={!canChat && !creatingRecord}
            placeholder={
              selectedTableIds.length === 0
                ? "请先选择数据表"
                : !configStatus?.configured
                  ? "请先配置 AI API Key"
                  : creatingRecord
                    ? "AI正在思考中..."
                    : "请输入你想分析的问题，支持连续追问与结果补充"
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
            footer={
              <div className="ai-chat-sender-footer">
                <div className="ai-chat-sender-summary-item" style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>数据表</Text>
                  <div className="ai-chat-sender-summary-select">
                    <TableSelector />
                  </div>
                </div>
                <div className="ai-chat-sender-summary-item">
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>模型</Text>
                  <Select
                    size="small"
                    style={{ width: 130 }}
                    popupMatchSelectWidth={false}
                    popupStyle={{ width: 260 }}
                    value={selectedModel || undefined}
                    placeholder="请选择模型"
                    options={[
                      ...modelOptions,
                      { label: "➕ 新增模型配置", value: "__add_new__" },
                    ]}
                    disabled={!configStatus?.configured && modelOptions.length === 0}
                    onChange={(value) => {
                      if (value === "__add_new__") {
                        onOpenConfig();
                      } else {
                        setSelectedModelOverride(String(value));
                      }
                    }}
                  />
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>

    {/* AI创建记录预览Modal - 表格形式展示多条记录，支持勾选 */}
    <Modal
      title={`AI生成的记录数据（已勾选 ${selectedRowKeys.length}/${editableRecords.length} 条）`}
      open={showRecordPreview}
      onOk={() => { void handleConfirmCreateRecord(); }}
      onCancel={handleCancelCreateRecord}
      okText={`确认创建（${selectedRowKeys.length} 条）`}
      cancelText={t("common.cancel")}
      okButtonProps={{ disabled: selectedRowKeys.length === 0 }}
      width={Math.max(900, Math.min(1200, tableFields.length * 150 + 60))}
      destroyOnClose
      confirmLoading={false}
    >
      {editableRecords.length > 0 && tableFields.length > 0 ? (
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <Table
            dataSource={editableRecords}
            rowKey="_rowKey"
            size="small"
            bordered
            scroll={{ x: "max-content", y: 400 }}
            pagination={editableRecords.length > 15 ? { pageSize: 15, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` } : false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as string[]),
              columnWidth: 40,
              fixed: true,
            }}
            columns={[
              {
                title: "#",
                key: "_index",
                width: 50,
                fixed: "left",
                render: (_: unknown, __: unknown, index: number) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>{index + 1}</Text>
                ),
              },
              ...tableFields.map((field) => ({
                title: (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Text strong style={{ fontSize: 12, whiteSpace: "nowrap" }}>{field.name}</Text>
                    <Tag color="blue" style={{ fontSize: 9, lineHeight: "14px", padding: "0 3px" }}>
                      {field.type}
                    </Tag>
                  </div>
                ),
                dataIndex: field.id,
                key: field.id,
                width: Math.max(130, Math.min(220, field.name.length * 16 + 60)),
                render: (value: unknown, record: Record<string, unknown>) => {
                  const rowKey = String(record._rowKey || "");
                  const isEditing = editingCell?.rowKey === rowKey && editingCell?.fieldId === field.id;
                  
                  // 辅助：渲染显示值
                  const renderDisplayValue = () => {
                    const isEmpty = value === null || value === undefined || value === "";
                    
                    if (field.type === "select") {
                      const opt = field.options?.find(o => o.id === String(value));
                      return isEmpty ? (
                        <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>
                      ) : (
                        <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>
                          {opt ? opt.label : String(value)}
                        </Tag>
                      );
                    }
                    if (field.type === "multiSelect") {
                      if (!Array.isArray(value) || value.length === 0) {
                        return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                      }
                      return (
                        <Space size={2} wrap>
                          {value.map((v: string, i: number) => {
                            const opt = field.options?.find(o => o.id === v);
                            return (
                              <Tag key={i} color="geekblue" style={{ fontSize: 10, lineHeight: "16px", margin: 0 }}>
                                {opt ? opt.label : v}
                              </Tag>
                            );
                          })}
                        </Space>
                      );
                    }
                    if (field.type === "member") {
                      if (Array.isArray(value) && value.length > 0) {
                        return (
                          <Space size={2} wrap>
                            {value.map((v: unknown, i: number) => {
                              const displayName = typeof v === "object" && v !== null
                                ? String((v as Record<string, unknown>).name || (v as Record<string, unknown>).id || (v as Record<string, unknown>).userName || v)
                                : String(v);
                              return (
                                <Tag key={i} color="purple" style={{ fontSize: 10, lineHeight: "16px", margin: 0 }}>
                                  {displayName}
                                </Tag>
                              );
                            })}
                          </Space>
                        );
                      }
                      return isEmpty ? (
                        <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>
                      ) : (
                        <Text style={{ fontSize: 12 }}>{String(value)}</Text>
                      );
                    }
                    if (field.type === "date") {
                      if (isEmpty) return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                      try {
                        const dateVal = typeof value === "string" && value.includes("-")
                          ? new Date(value).toLocaleDateString("zh-CN")
                          : typeof value === "number"
                            ? new Date(value).toLocaleDateString("zh-CN")
                            : String(value);
                        return <Text style={{ fontSize: 12 }}>{dateVal}</Text>;
                      } catch {
                        return <Text style={{ fontSize: 12 }}>{String(value)}</Text>;
                      }
                    }
                    if (field.type === "progress") {
                      if (isEmpty) return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                      const num = Number(value);
                      return <Text style={{ fontSize: 12 }}>{isNaN(num) ? String(value) : `${num}%`}</Text>;
                    }
                    if (field.type === "rating") {
                      if (isEmpty) return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                      const num = Number(value);
                      const max = field.property?.max || 5;
                      return <Text style={{ fontSize: 12, color: "#faad14" }}>{isNaN(num) ? String(value) : `${"★".repeat(Math.min(num, max))}${"☆".repeat(Math.max(0, max - num))}`}</Text>;
                    }
                    if (field.type === "number") {
                      if (isEmpty) return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                      const num = Number(value);
                      if (!isNaN(num)) {
                        const prefix = field.property?.prefix || "";
                        const suffix = field.property?.suffix || "";
                        return <Text style={{ fontSize: 12 }}>{prefix}{num.toLocaleString()}{suffix}</Text>;
                      }
                      return <Text style={{ fontSize: 12 }}>{String(value)}</Text>;
                    }
                    if (field.type === "url") {
                      if (isEmpty) return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                      return (
                        <a href={String(value)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                          {String(value)}
                        </a>
                      );
                    }
                    if ((field.type as string) === "checkbox") {
                      return <Text style={{ fontSize: 12 }}>{value ? "☑ 是" : "☐ 否"}</Text>;
                    }
                    // 默认文本显示
                    if (isEmpty) return <Text type="secondary" italic style={{ fontSize: 12 }}>(空)</Text>;
                    return <Text style={{ fontSize: 12 }}>{String(value)}</Text>;
                  };
                  
                  // 如果是编辑状态，渲染编辑器
                  if (isEditing) {
                    const handleBlur = () => setEditingCell(null);
                    const handleChange = (newVal: unknown) => {
                      updateCellValue(rowKey, field.id, newVal);
                      setEditingCell(null);
                    };
                    
                    // select 编辑器
                    if (field.type === "select") {
                      return (
                        <Select
                          autoFocus
                          size="small"
                          style={{ width: "100%", minWidth: 100 }}
                          value={value ? String(value) : undefined}
                          onChange={(v) => handleChange(v)}
                          onBlur={handleBlur}
                          placeholder="选择"
                          options={field.options?.map(opt => ({ label: opt.label, value: opt.id })) || []}
                        />
                      );
                    }
                    
                    // multiSelect 编辑器
                    if (field.type === "multiSelect") {
                      return (
                        <Select
                          autoFocus
                          mode="multiple"
                          size="small"
                          style={{ width: "100%", minWidth: 120 }}
                          value={Array.isArray(value) ? value as string[] : []}
                          onChange={(v) => handleChange(v)}
                          onBlur={handleBlur}
                          placeholder="选择"
                          options={field.options?.map(opt => ({ label: opt.label, value: opt.id })) || []}
                        />
                      );
                    }
                    
                    // number / progress / rating 编辑器
                    if (field.type === "number" || field.type === "progress" || field.type === "rating") {
                      return (
                        <InputNumber
                          autoFocus
                          size="small"
                          style={{ width: "100%", minWidth: 80 }}
                          value={value !== null && value !== undefined ? Number(value) : undefined}
                          onChange={(v) => handleChange(v)}
                          onBlur={handleBlur}
                          onPressEnter={() => setEditingCell(null)}
                          min={field.type === "progress" || field.type === "rating" ? 0 : undefined}
                          max={field.type === "progress" ? 100 : field.type === "rating" ? (field.property?.max || 5) : undefined}
                          step={field.type === "number" && field.property?.precision === 0 ? 1 : undefined}
                        />
                      );
                    }
                    
                    // date 编辑器
                    if (field.type === "date") {
                      return (
                        <DatePicker
                          autoFocus
                          size="small"
                          style={{ width: "100%", minWidth: 120 }}
                          value={value ? (typeof value === "number" ? dayjs(value) : dayjs(String(value))) : null}
                          onChange={(date) => {
                            if (date) {
                              handleChange(date.valueOf());
                            } else {
                              handleChange(null);
                            }
                          }}
                          onOpenChange={(open) => {
                            if (!open) setEditingCell(null);
                          }}
                        />
                      );
                    }
                    
                    // checkbox 编辑器
                    if ((field.type as string) === "checkbox") {
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            autoFocus
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => handleChange(e.target.checked)}
                            onBlur={handleBlur}
                          />
                        </div>
                      );
                    }
                    
                    // 默认：文本编辑器
                    return (
                      <Input
                        autoFocus
                        size="small"
                        style={{ width: "100%", minWidth: 80 }}
                        value={value ? String(value) : ""}
                        onChange={(e) => updateCellValue(rowKey, field.id, e.target.value)}
                        onBlur={handleBlur}
                        onPressEnter={() => setEditingCell(null)}
                        placeholder="输入"
                      />
                    );
                  }
                  
                  // 非编辑状态：可点击进入编辑模式
                  return (
                    <div
                      onClick={() => setEditingCell({ rowKey, fieldId: field.id })}
                      style={{
                        cursor: "pointer",
                        minHeight: 24,
                        display: "flex",
                        alignItems: "center",
                        padding: "2px 4px",
                        borderRadius: 4,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "#f0f5ff";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {renderDisplayValue()}
                    </div>
                  );
                },
              })),
            ]}
          />
        </div>
      ) : (
        <Empty description="暂无生成数据" />
      )}
      <Alert
        message={`即将创建 ${selectedRowKeys.length} 条记录，请仔细核对数据`}
        description={`共 ${editableRecords.length} 条记录，已勾选 ${selectedRowKeys.length} 条。确认后数据将写入当前数据表，可在表格中查看和编辑。未勾选的记录将被忽略。`}
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Modal>

    <Modal
      title="修改会话名称"
      open={editModalOpen}
      onOk={handleUpdateTitle}
      onCancel={() => {
        setEditModalOpen(false);
        setEditingConversation(null);
      }}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      destroyOnClose
    >
      <Input
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        placeholder="请输入会话名称"
        maxLength={255}
        showCount
        onPressEnter={handleUpdateTitle}
      />
    </Modal>
  </>
);};

export default ChatAreaEnhanced;
