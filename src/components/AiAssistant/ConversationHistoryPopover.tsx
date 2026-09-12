import React, { useMemo } from "react";
import { Popover, Typography, Spin, Empty, Button } from "antd";
import {
  HistoryOutlined,
  MessageOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { AiConversation } from "../../store/aiAssistantStore";

const { Text } = Typography;

// ============================================================
// 时间分组工具
// ============================================================

type TimeGroupKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "thisYear" | "older";

const TIME_GROUP_LABELS: Record<TimeGroupKey, string> = {
  today: "今天",
  yesterday: "昨天",
  thisWeek: "本周",
  thisMonth: "本月",
  thisYear: "今年",
  older: "更早",
};

function getTimeGroup(dateStr: string): TimeGroupKey {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  if (date >= todayStart) return "today";
  if (date >= yesterdayStart) return "yesterday";
  if (date >= weekStart) return "thisWeek";
  if (date >= monthStart) return "thisMonth";
  if (date >= yearStart) return "thisYear";
  return "older";
}

function groupConversations(conversations: AiConversation[]): Map<TimeGroupKey, AiConversation[]> {
  const groups = new Map<TimeGroupKey, AiConversation[]>();
  for (const conv of conversations) {
    const key = getTimeGroup(conv.updatedAt || conv.createdAt);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(conv);
  }
  return groups;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ============================================================
// Props
// ============================================================

type ConversationHistoryPopoverProps = {
  conversations: AiConversation[];
  currentConversationId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => Promise<void>;
  triggerElement: React.ReactNode;
};

// ============================================================
// 组件
// ============================================================

export const ConversationHistoryPopover: React.FC<ConversationHistoryPopoverProps> = ({
  conversations,
  currentConversationId,
  loading,
  onSelect,
  onDelete,
  onRefresh,
  triggerElement,
}) => {
  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  // 按时间顺序排列分组键
  const orderedKeys: TimeGroupKey[] = useMemo(() => {
    const keys = Array.from(grouped.keys());
    const order: TimeGroupKey[] = ["today", "yesterday", "thisWeek", "thisMonth", "thisYear", "older"];
    return order.filter((k) => keys.includes(k));
  }, [grouped]);

  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    onDelete(conversationId);
  };

  const content = (
    <div style={{ width: 320, maxHeight: 420, display: "flex", flexDirection: "column" }}>
      {/* 头部 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0 12px",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HistoryOutlined style={{ color: "#8c8c8c" }} />
          <Text strong style={{ fontSize: 14 }}>历史对话</Text>
        </div>
        <Button
          type="text"
          size="small"
          loading={loading}
          onClick={() => void onRefresh()}
          style={{ fontSize: 11, color: "#8c8c8c" }}
        >
          刷新
        </Button>
      </div>

      {/* 列表区域 */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading && conversations.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : orderedKeys.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无历史对话"
            style={{ padding: "16px 0" }}
          />
        ) : (
          orderedKeys.map((key) => (
            <div key={key} style={{ marginBottom: 4 }}>
              {/* 分组标题 */}
              <Text
                type="secondary"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "6px 0 4px",
                  display: "block",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {TIME_GROUP_LABELS[key]}
              </Text>

              {/* 分组内的对话列表 */}
              {grouped.get(key)!.map((conv) => {
                const isActive = conv.id === currentConversationId;
                const previewText = conv.title || "未命名会话";
                const dateStr = formatShortDate(conv.updatedAt || conv.createdAt);

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: 8,
                      background: isActive ? "#e6f4ff" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      gap: 8,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = "#f5f5f5";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }
                    }}
                  >
                    <MessageOutlined
                      style={{
                        color: isActive ? "#1677ff" : "#bfbfbf",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        strong={isActive}
                        style={{
                          fontSize: 13,
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: isActive ? "#1677ff" : "#262626",
                        }}
                      >
                        {previewText}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                      {dateStr}
                    </Text>
                    <DeleteOutlined
                      onClick={(e: unknown) => handleDelete(e as React.MouseEvent, conv.id)}
                      style={{
                        fontSize: 12,
                        color: "#bfbfbf",
                        opacity: 0,
                        transition: "opacity 0.15s",
                        cursor: "pointer",
                        flexShrink: 0,
                        padding: 2,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "#ff4d4f";
                        (e.currentTarget as HTMLElement).style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "#bfbfbf";
                        (e.currentTarget as HTMLElement).style.opacity = "0";
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      overlayInnerStyle={{ padding: "12px 14px" }}
      destroyTooltipOnHide
    >
      {triggerElement}
    </Popover>
  );
};

export default ConversationHistoryPopover;
