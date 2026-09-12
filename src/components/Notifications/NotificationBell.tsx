import { BellOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Button, Empty, Popover, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../lib/useLanguage";
import { NotificationListItem } from "./NotificationListItem";
import {
  MARK_ALL_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
  NOTIFICATIONS,
} from "./notificationGraphql";
import { notificationT } from "./notificationI18n";
import { useNotificationRealtime } from "./notificationRealtime";
import type { NotificationItem, NotificationPage } from "./types";
import "./notificationCenter.css";

export function NotificationBell() {
  useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { unreadCount, eventVersion, timezone, refreshUnread } =
    useNotificationRealtime();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<{ notifications: NotificationPage }>(NOTIFICATIONS, {
    variables: {
      cursor: null,
      limit: 6,
      unreadOnly: false,
      types: null,
      timezone,
    },
    skip: !open,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead, { loading: markingAll }] = useMutation(
    MARK_ALL_NOTIFICATIONS_READ,
  );

  useEffect(() => {
    if (!open) return;
    void refetch();
  }, [eventVersion, open, refetch]);

  const markItemRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    await markRead({ variables: { notificationId: item.id } });
    await Promise.all([refetch(), refreshUnread()]);
  };

  const openItem = async (item: NotificationItem) => {
    await markItemRead(item);
    if (!item.deepLink) return;
    setOpen(false);
    navigate(item.deepLink);
  };

  const markEverythingRead = async () => {
    await markAllRead({ variables: { types: null } });
    await Promise.all([refetch(), refreshUnread()]);
  };

  const content = (
    <div className="qtable-notification-popover" role="region" aria-label={notificationT("bell.quickAria")}>
      <div className="qtable-notification-popover-header">
        <div>
          <strong>{notificationT("bell.title")}</strong>
          <span>{unreadCount ? notificationT("bell.unreadCount", { count: unreadCount }) : notificationT("bell.noUnread")}</span>
        </div>
        <Button
          type="link"
          size="small"
          disabled={!unreadCount}
          loading={markingAll}
          onClick={() => void markEverythingRead()}
        >
          {notificationT("bell.markAllRead")}
        </Button>
      </div>

      <div className="qtable-notification-popover-list">
        {loading && !data ? (
          <div className="qtable-notification-popover-loading">
            <Skeleton active paragraph={{ rows: 4 }} title={false} />
          </div>
        ) : error ? (
          <div className="qtable-notification-popover-state">
            <span>{notificationT("center.loadFailed")}</span>
            <Button size="small" onClick={() => void refetch()}>
              {notificationT("common.retry")}
            </Button>
          </div>
        ) : data?.notifications.items.length ? (
          data.notifications.items.map((item) => (
            <NotificationListItem
              key={item.id}
              compact
              item={item}
              onOpen={(next) => void openItem(next)}
              onMarkRead={(next) => void markItemRead(next)}
            />
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={notificationT("center.empty")}
            className="qtable-notification-popover-empty"
          />
        )}
      </div>

      <button
        type="button"
        className="qtable-notification-popover-footer"
        onClick={() => {
          setOpen(false);
          navigate("/notifications");
        }}
      >
        {notificationT("bell.viewAll")}
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      arrow={false}
      open={open}
      onOpenChange={setOpen}
      content={content}
      overlayClassName="qtable-notification-popover-overlay"
    >
      <Badge count={unreadCount} overflowCount={99} size="small" offset={[-3, 4]}>
        <Button
          type="text"
          className="qtable-topbar-icon-button qtable-notification-bell"
          aria-label={unreadCount ? notificationT("bell.ariaUnread", { count: unreadCount }) : notificationT("bell.aria")}
          icon={<BellOutlined />}
        />
      </Badge>
    </Popover>
  );
}
