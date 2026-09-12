import { Avatar, Button, Tag, Tooltip } from "antd";
import { CheckOutlined, LockOutlined } from "@ant-design/icons";
import { useLanguage } from "../../lib/useLanguage";
import { exactTime, notificationTypeMeta, relativeTime } from "./notificationFormatters";
import { notificationT } from "./notificationI18n";
import type { NotificationItem } from "./types";

export function NotificationListItem({
  item,
  compact = false,
  onOpen,
  onMarkRead,
}: {
  item: NotificationItem;
  compact?: boolean;
  onOpen?: (item: NotificationItem) => void;
  onMarkRead?: (item: NotificationItem) => void;
}) {
  useLanguage();
  const meta = notificationTypeMeta(item.type);
  const unread = !item.readAt;
  const actorName = item.actor?.name || notificationT("common.system");
  const actorInitial = actorName.charAt(0).toUpperCase();

  return (
    <div
      className={`qtable-notification-item${unread ? " is-unread" : ""}${
        item.accessible ? "" : " is-inaccessible"
      }${compact ? " is-compact" : ""}`}
    >
      <button
        type="button"
        className="qtable-notification-main"
        onClick={() => item.accessible && onOpen?.(item)}
        disabled={!item.accessible}
        aria-label={`${meta.label}: ${item.title}, ${item.summary}`}
      >
        <div className={`qtable-notification-type-icon is-${meta.tone}`}>
          {meta.icon}
        </div>
        <div className="qtable-notification-copy">
          <div className="qtable-notification-title-row">
            <span className="qtable-notification-title">{item.title}</span>
            {unread ? <span className="qtable-notification-unread-dot" /> : null}
          </div>
          <div className="qtable-notification-summary">{item.summary}</div>
          <div className="qtable-notification-meta">
            <Avatar size={18} className="qtable-notification-actor-avatar">
              {actorInitial}
            </Avatar>
            <span className="qtable-notification-actor-name">{actorName}</span>
            <Tag bordered={false} className={`qtable-notification-type-tag is-${meta.tone}`}>
              {meta.label}
            </Tag>
            <Tooltip title={exactTime(item.createdAt)}>
              <span className="qtable-notification-time">{relativeTime(item.createdAt)}</span>
            </Tooltip>
            {!item.accessible ? (
              <span className="qtable-notification-access-state">
                <LockOutlined /> {notificationT("common.inaccessible")}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {unread && onMarkRead ? (
        <Tooltip title={notificationT("common.markRead")}>
          <Button
            type="text"
            size="small"
            className="qtable-notification-read-button"
            aria-label={notificationT("common.markRead")}
            icon={<CheckOutlined />}
            onClick={() => onMarkRead(item)}
          />
        </Tooltip>
      ) : null}
    </div>
  );
}
