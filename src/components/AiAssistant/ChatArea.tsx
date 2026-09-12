import React, { useEffect, useMemo, useState } from "react";
import { Bubble, Conversations, Prompts, Sender, Welcome } from "@ant-design/x";
import type { BubbleItemType } from "@ant-design/x";
import {
  DeleteOutlined,
  MessageOutlined,
  SettingOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Spin, Typography, message } from "antd";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  useAiAssistantStore,
  type AiConversation,
  type AiMessage,
} from "../../store/aiAssistantStore";
import {
  CREATE_CONVERSATION,
  DELETE_CONVERSATION,
  GET_CONVERSATIONS,
  streamAnalyze,
} from "../../lib/aiApi";

const { Text } = Typography;

type ConversationsQueryData = {
  conversations: AiConversation[];
};

type CreateConversationMutationData = {
  createConversation: AiConversation;
};

type DeleteConversationMutationData = {
  deleteConversation: boolean;
};

type ChatAreaProps = {
  onOpenConfig: () => void;
};

const PROMPT_ITEMS = [
  {
    key: "请先总结当前数据表的核心信息，并指出值得关注的指标。",
    label: "总结表格",
    description: "快速概览当前表数据",
  },
  {
    key: "请分析当前数据表里最异常的记录，并解释可能原因。",
    label: "识别异常",
    description: "找出异常数据与风险点",
  },
  {
    key: "请基于当前数据表给出适合的图表建议，并说明理由。",
    label: "图表建议",
    description: "推荐更合适的可视化方式",
  },
];

const ChatArea: React.FC<ChatAreaProps> = ({ onOpenConfig }) => {
  const {
    configStatus,
    currentConversationId,
    conversations,
    streaming,
    streamContent,
    selectedTableIds,
    setConversations,
    upsertConversation,
    removeConversation,
    setStreaming,
    appendStreamContent,
    resetStreamContent,
    setCurrentConversation,
    addMessage,
  } = useAiAssistantStore();

  const [question, setQuestion] = useState("");
  const [streamError, setStreamError] = useState<{
    tableIds: string[] | null;
    conversationId: string | null;
    message: string;
  } | null>(null);

  const {
    data,
    loading: conversationsLoading,
    refetch: refetchConversations,
  } = useQuery<ConversationsQueryData>(GET_CONVERSATIONS, {
    // 不传递 table_id 以获取所有对话，或者传递 undefined
    variables: { tableId: undefined },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const [createConversation, { loading: creatingConversation }] =
    useMutation<CreateConversationMutationData>(CREATE_CONVERSATION);
  const [deleteConversation] = useMutation<DeleteConversationMutationData>(
    DELETE_CONVERSATION,
  );

  useEffect(() => {
    // 当没有选中任何表时，清空对话列表
    if (selectedTableIds.length === 0) {
      setConversations([]);
      setCurrentConversation(null);
      resetStreamContent();
    }
    // 当有选中的表时，保持当前对话不变，只是加载对话列表
  }, [selectedTableIds, setConversations, setCurrentConversation, resetStreamContent]);

  useEffect(() => {
    const nextConversations = data?.conversations ?? [];
    setConversations(nextConversations);

    if (!nextConversations.length) {
      setCurrentConversation(null);
      return;
    }

    if (!currentConversationId) {
      setCurrentConversation(nextConversations[0].id);
      return;
    }

    if (!nextConversations.some((conversation) => conversation.id === currentConversationId)) {
      setCurrentConversation(nextConversations[0].id);
    }
  }, [currentConversationId, data?.conversations, setConversations, setCurrentConversation]);

  useEffect(() => {
    resetStreamContent();
  }, [currentConversationId, resetStreamContent]);

  const currentConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === currentConversationId) ?? null,
    [conversations, currentConversationId],
  );

  const conversationItems = useMemo(
    () =>
      conversations.map((conversation) => ({
        key: conversation.id,
        label: conversation.title || "未命名会话",
        icon: <MessageOutlined />,
      })),
    [conversations],
  );

  const bubbleItems = useMemo<BubbleItemType[]>(() => {
    const items: BubbleItemType[] = (currentConversation?.messages ?? []).map((msg) => ({
      key: msg.id,
      role: msg.role === "user" ? "user" : "ai",
      content: msg.content,
    }));

    if (streaming) {
      items.push({
        key: "streaming",
        role: "ai",
        content: streamContent || "正在分析当前数据表...",
        loading: !streamContent,
        typing: true,
        streaming: true,
      });
    }

    if (
      !streaming &&
      streamError &&
      // 检查 streamError 的 tableIds 是否与当前选中的表匹配
      streamError.tableIds?.every((id) => selectedTableIds.includes(id)) &&
      streamError.conversationId === (currentConversationId ?? null)
    ) {
      items.push({
        key: "stream-error",
        role: "ai",
        content: `本次请求失败：${streamError.message}`,
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

  const canChat = Boolean(selectedTableIds.length > 0 && configStatus?.configured);
  const showWelcome = bubbleItems.length === 0 && !conversationsLoading;

  const refreshConversations = async () => {
    const result = await refetchConversations({ tableId: undefined });
    const nextConversations = result.data?.conversations ?? [];
    setConversations(nextConversations);
    return nextConversations;
  };

  const handleCreateConversation = () => {
    setCurrentConversation(null);
    resetStreamContent();
    setStreamError(null);
    setQuestion("");
  };

  const handleDeleteConversation = async (conversationId: string) => {
    await deleteConversation({
      variables: { id: conversationId },
    });

    removeConversation(conversationId);
    await refreshConversations();
    message.success("会话已删除");
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

    setStreamError(null);
    resetStreamContent();

    try {
      let conversation = currentConversation;

      if (!conversation) {
        const result = await createConversation({
          variables: {
            tableId: selectedTableIds[0] || null,
            tableIds: selectedTableIds,
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
        id: `temp-user-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      addMessage(conversation.id, userMessage);
      setQuestion("");
      setStreaming(true);

      let requestError: string | null = null;

      await streamAnalyze({
        tableId: selectedTableIds[0] || undefined,
        tableIds: selectedTableIds,
        question: content,
        conversationId: conversation.id,
        onChunk: (chunk) => {
          appendStreamContent(chunk);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
        <Conversations
          items={conversationItems}
          activeKey={currentConversationId ?? undefined}
          onActiveChange={(value) => {
            setCurrentConversation(String(value));
          }}
          menu={(conversation) => ({
            items: [
              {
                key: "delete",
                label: "删除会话",
                icon: <DeleteOutlined />,
                danger: true,
              },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === "delete") {
                void handleDeleteConversation(conversation.key);
              }
            },
          })}
          creation={{
            label: "新建会话",
            onClick: handleCreateConversation,
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "0 16px 16px",
        }}
      >
        {!configStatus?.configured && (
          <Alert
            type="warning"
            showIcon
            message="AI API Key 尚未配置"
            description="请先配置 AI Key 后再开始对话，配置完成后即可基于当前数据表进行连续分析。"
            action={
              <Button type="primary" size="small" icon={<SettingOutlined />} onClick={onOpenConfig}>
                立即配置
              </Button>
            }
          />
        )}

        {selectedTableIds.length === 0 && (
          <Alert
            type="info"
            showIcon
            message="请选择需要分析的数据表"
            description="顶部下拉框会展示当前工作空间下的全部数据表，选择后即可开始 AI 对话。"
          />
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: "1px solid #F0F0F0",
            borderRadius: 12,
            background: "#FAFAFA",
            overflow: "hidden",
          }}
        >
          {conversationsLoading && !currentConversation ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin />
            </div>
          ) : showWelcome ? (
            <div
              style={{
                height: "100%",
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {canChat ? (
                <>
                  <Welcome
                    icon={<TableOutlined />}
                    title="开始新的 AI 分析"
                    description="选择一个推荐问题，或直接在下方输入你的分析需求。"
                  />
                  <Prompts
                    title="推荐提问"
                    items={PROMPT_ITEMS}
                    vertical
                    onItemClick={({ data: prompt }) => {
                      void handleSend(String(prompt.key));
                    }}
                  />
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
              style={{ height: "100%", padding: 16, overflowY: "auto" }}
              autoScroll
              items={bubbleItems}
              role={{
                ai: {
                  placement: "start",
                  variant: "shadow",
                },
                user: {
                  placement: "end",
                  variant: "filled",
                },
              }}
            />
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #F0F0F0", padding: "12px 16px 16px" }}>
        <Sender
          value={question}
          onChange={(value) => setQuestion(value)}
          onSubmit={(value) => {
            void handleSend(value);
          }}
          loading={streaming || creatingConversation}
          disabled={!canChat}
          placeholder={
            selectedTableIds.length === 0
              ? "请先选择数据表"
              : !configStatus?.configured
                ? "请先配置 AI API Key"
                : "请输入你想分析的问题"
          }
          autoSize={{ minRows: 1, maxRows: 4 }}
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                fontSize: 12,
                color: "#8C8C8C",
              }}
            >
              <Text type="secondary">
                {selectedTableIds.length > 0
                  ? `已选数据表：${selectedTableIds.length} 个`
                  : "尚未选择数据表"}
              </Text>
              <Text type="secondary">
                {configStatus?.configured
                  ? `模型：${configStatus.model || configStatus.provider}`
                  : "AI 未配置"}
              </Text>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ChatArea;
