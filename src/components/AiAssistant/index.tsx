import React, { useState, useCallback } from "react";
import { Button, Space, message, Tooltip } from "antd";
import {
  PlusOutlined,
  HistoryOutlined,
  ExpandOutlined,
  CloseOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAiAssistantStore } from "../../store/aiAssistantStore";
import { useAiRuntimeStore } from "../../store/aiRuntimeStore";
import AiConfigModal from "./AiConfigModal";
import ChatArea from "./ChatAreaEnhanced";
import ConversationHistoryPopover from "./ConversationHistoryPopover";
import { CLEAR_CONVERSATION_MESSAGES, GET_AI_CONFIG, GET_CONVERSATIONS } from "../../lib/aiApi";
import { useMutation, useQuery } from "@apollo/client/react";
import { useParams } from "react-router-dom";
import { AiWorkspacePanel } from "../AiWorkspace";

type AiConfigQueryData = {
  aiConfig?: {
    provider: string;
    model: string;
  } | null;
};

const AiAssistant: React.FC = () => {
  const {
    drawerOpen,
    currentConversationId,
    conversations,
    drawerWidth,
    closeDrawer,
    clearCurrentConversation,
    setConfigStatus,
    setDrawerWidth,
    removeConversation,
    setCurrentConversation,
  } = useAiAssistantStore();

  const { tableId } = useParams<{ tableId?: string }>();
  const setSelectedTableIds = useAiAssistantStore((s) => s.setSelectedTableIds);
  const selectedTableIds = useAiAssistantStore((s) => s.selectedTableIds);

  const resetRuntime = useAiRuntimeStore((s) => s.resetRuntime);

  const {
    data: configData,
    error: configError,
    refetch: refetchAiConfig,
  } = useQuery<AiConfigQueryData>(GET_AI_CONFIG, {
    skip: !drawerOpen,
    fetchPolicy: "network-only",
  });

  React.useEffect(() => {
    if (!drawerOpen) return;
    if (configError) {
      setConfigStatus({ configured: false, provider: "", model: "" });
      return;
    }
    if (configData?.aiConfig) {
      setConfigStatus({
        configured: true,
        provider: configData.aiConfig.provider,
        model: configData.aiConfig.model,
      });
      return;
    }
    if (configData) {
      setConfigStatus({ configured: false, provider: "", model: "" });
    }
  }, [configData, configError, drawerOpen, setConfigStatus]);

  React.useEffect(() => {
    if (drawerOpen && tableId && selectedTableIds.length === 0) {
      setSelectedTableIds([tableId]);
    }
  }, [drawerOpen, tableId, selectedTableIds.length, setSelectedTableIds]);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 用于触发历史对话数据刷新
  const [refreshKey, setRefreshKey] = useState(0);

  const [clearConversationMessages, { loading: clearingConversation }] = useMutation(
    CLEAR_CONVERSATION_MESSAGES,
  );

  // ========================================================
  // 工具栏操作
  // ========================================================

  /** 新建对话 - 清空当前上下文，回到欢迎页 */
  const handleNewConversation = useCallback(() => {
    setCurrentConversation(null);
    resetRuntime();
  }, [setCurrentConversation, resetRuntime]);

  /** 关闭面板 */
  const handleClose = useCallback(() => {
    closeDrawer();
    resetRuntime();
  }, [closeDrawer, resetRuntime]);

  /** 清除当前会话 */
  const handleClear = useCallback(async () => {
    if (!currentConversationId) return;

    await clearConversationMessages({
      variables: { id: currentConversationId },
      refetchQueries: [
        {
          query: GET_CONVERSATIONS,
        },
      ],
      awaitRefetchQueries: true,
    });

    clearCurrentConversation();
    resetRuntime();
    message.success("当前会话已清空");
  }, [currentConversationId, clearConversationMessages, clearCurrentConversation, resetRuntime]);

  /** 选中历史对话 */
  const handleSelectHistory = useCallback(
    (id: string) => {
      setCurrentConversation(id);
    },
    [setCurrentConversation],
  );

  /** 删除历史对话 */
  const handleDeleteHistory = useCallback(
    (id: string) => {
      removeConversation(id);
      setRefreshKey((k) => k + 1);
      message.success("会话已删除");
    },
    [removeConversation],
  );

  /** 刷新历史对话数据 */
  const handleRefreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setRefreshKey((k) => k + 1);
    } finally {
      setTimeout(() => setHistoryLoading(false), 300);
    }
  }, []);

  // ========================================================
  // 渲染工具栏
  // ========================================================

  const headerExtra = (
    <Space size={2}>
      {/* 新建对话 */}
      <Tooltip title="新建对话" placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleNewConversation}
          className="ai-toolbar-btn"
        />
      </Tooltip>

      {/* 历史对话 */}
      <ConversationHistoryPopover
        conversations={conversations}
        currentConversationId={currentConversationId}
        loading={historyLoading}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
        onRefresh={handleRefreshHistory}
        triggerElement={
          <Tooltip title="历史对话" placement="bottom">
            <Button
              type="text"
              size="small"
              icon={<HistoryOutlined />}
              className="ai-toolbar-btn"
            />
          </Tooltip>
        }
      />

      {/* 设置 */}
      <Tooltip title="AI 设置" placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setConfigModalOpen(true)}
          className="ai-toolbar-btn"
        />
      </Tooltip>

      {/* 分隔线 */}
      <div
        style={{
          width: 1,
          height: 18,
          background: "#e8e8e8",
          margin: "0 4px",
        }}
      />

      {/* 清空当前会话 */}
      <Tooltip title="清空当前会话" placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<ExpandOutlined />}
          disabled={!currentConversationId}
          loading={clearingConversation}
          onClick={() => void handleClear()}
          className="ai-toolbar-btn"
        />
      </Tooltip>

      {/* 关闭面板 */}
      <Tooltip title="关闭" placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleClose}
          className="ai-toolbar-btn"
        />
      </Tooltip>
    </Space>
  );

  return (
    <>
      <AiWorkspacePanel
        drawerOpen={drawerOpen}
        drawerWidth={drawerWidth}
        onWidthChange={setDrawerWidth}
        headerExtra={headerExtra}
      >
        <ChatArea
          key={refreshKey}
          onOpenConfig={() => setConfigModalOpen(true)}
        />
      </AiWorkspacePanel>

      <AiConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onConfigSaved={async () => {
          await refetchAiConfig();
        }}
      />
    </>
  );
};

export default AiAssistant;
