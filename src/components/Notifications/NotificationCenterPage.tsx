import {
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Button,
  Empty,
  Segmented,
  Select,
  Skeleton,
  Space,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../lib/useLanguage";
import { NotificationListItem } from "./NotificationListItem";
import { getNotificationTypeOptions } from "./notificationFormatters";
import {
  MARK_ALL_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
  NOTIFICATIONS,
} from "./notificationGraphql";
import { notificationT } from "./notificationI18n";
import {
  NOTIFICATION_CHANGE_EVENT,
  useNotificationRealtime,
} from "./notificationRealtime";
import type { NotificationItem, NotificationPage } from "./types";

const PAGE_SIZE = 30;

const dedupeItems = (items: NotificationItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export function NotificationCenterPage() {
  useLanguage();
  const navigate = useNavigate();
  const [scope, setScope] = useState<"all" | "unread">("all");
  const [type, setType] = useState<string | undefined>(undefined);
  const [extraItems, setExtraItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreOverride, setHasMoreOverride] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { unreadCount, timezone, refreshUnread } = useNotificationRealtime();

  const variables = useMemo(
    () => ({
      cursor: null,
      limit: PAGE_SIZE,
      unreadOnly: scope === "unread",
      types: type ? [type] : null,
      timezone,
    }),
    [scope, timezone, type],
  );

  const {
    data,
    loading,
    error,
    refetch,
    fetchMore,
  } = useQuery<{ notifications: NotificationPage }>(NOTIFICATIONS, {
    variables,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead, { loading: markingAll }] = useMutation(
    MARK_ALL_NOTIFICATIONS_READ,
  );

  const basePage = data?.notifications;
  const items = useMemo(
    () => dedupeItems([...(basePage?.items || []), ...extraItems]),
    [basePage?.items, extraItems],
  );
  const effectiveNextCursor = nextCursor ?? basePage?.pageInfo.nextCursor ?? null;
  const hasMore =
    hasMoreOverride ?? Boolean(basePage?.pageInfo.hasMore && effectiveNextCursor);

  const resetPaging = () => {
    setExtraItems([]);
    setNextCursor(null);
    setHasMoreOverride(null);
  };

  const refresh = async () => {
    resetPaging();
    await Promise.all([refetch(variables), refreshUnread()]);
  };

  useEffect(() => {
    const onNotificationChange = () => {
      setExtraItems([]);
      setNextCursor(null);
      setHasMoreOverride(null);
      void refetch(variables);
    };
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, onNotificationChange);
    return () =>
      window.removeEventListener(NOTIFICATION_CHANGE_EVENT, onNotificationChange);
  }, [refetch, variables]);

  const loadMore = async () => {
    if (!effectiveNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchMore({
        variables: { ...variables, cursor: effectiveNextCursor },
      });
      const page = result.data?.notifications;
      if (!page) return;
      setExtraItems((current) => dedupeItems([...current, ...page.items]));
      setNextCursor(page.pageInfo.nextCursor || null);
      setHasMoreOverride(page.pageInfo.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const markItemRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    await markRead({ variables: { notificationId: item.id } });
    await refresh();
  };

  const openItem = async (item: NotificationItem) => {
    await markItemRead(item);
    if (item.deepLink) navigate(item.deepLink);
  };

  const markEverythingRead = async () => {
    await markAllRead({ variables: { types: type ? [type] : null } });
    await refresh();
  };

  return (
    <div className="qtable-notification-center">
      <header className="qtable-notification-page-header">
        <div>
          <Typography.Title level={1}>{notificationT("center.title")}</Typography.Title>
          <Typography.Paragraph>{notificationT("center.description")}</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void refresh()}
            loading={loading}
          >
            {notificationT("center.refresh")}
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={!unreadCount}
            loading={markingAll}
            onClick={() => void markEverythingRead()}
          >
            {notificationT("center.markAllRead")}
          </Button>
        </Space>
      </header>

      <section className="qtable-notification-summary-card" aria-label={notificationT("center.summaryAria")}>
        <div>
          <span className="qtable-notification-summary-label">{notificationT("center.unread")}</span>
          <strong>{unreadCount}</strong>
        </div>
        <div>
          <span className="qtable-notification-summary-label">{notificationT("center.currentResults")}</span>
          <strong>{basePage?.totalCount ?? 0}</strong>
        </div>
        <div className="qtable-notification-summary-hint">
          {notificationT("center.securityHint")}
        </div>
      </section>

      <div className="qtable-notification-toolbar">
        <Segmented
          aria-label={notificationT("center.scopeAria")}
          value={scope}
          options={[
            { label: notificationT("center.all"), value: "all" },
            { label: notificationT("center.unreadCount", { count: unreadCount ? ` ${unreadCount}` : "" }), value: "unread" },
          ]}
          onChange={(value) => {
            resetPaging();
            setScope(value as "all" | "unread");
          }}
        />
        <Select
          allowClear
          aria-label={notificationT("center.typeAria")}
          className="qtable-notification-type-filter"
          placeholder={notificationT("center.allTypes")}
          value={type}
          options={getNotificationTypeOptions()}
          onChange={(value) => {
            resetPaging();
            setType(value);
          }}
        />
      </div>

      <section className="qtable-notification-feed" aria-live="polite">
        {loading && !data ? (
          <div className="qtable-notification-page-loading">
            <Skeleton active paragraph={{ rows: 7 }} />
          </div>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            message={notificationT("center.loadFailed")}
            description={error.message}
            action={
              <Button size="small" onClick={() => void refresh()}>
                {notificationT("common.retry")}
              </Button>
            }
          />
        ) : items.length ? (
          <>
            <div className="qtable-notification-feed-list">
              {items.map((item) => (
                <NotificationListItem
                  key={item.id}
                  item={item}
                  onOpen={(next) => void openItem(next)}
                  onMarkRead={(next) => void markItemRead(next)}
                />
              ))}
            </div>
            {hasMore ? (
              <div className="qtable-notification-load-more">
                <Button loading={loadingMore} onClick={() => void loadMore()}>
                  {notificationT("common.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={scope === "unread" ? notificationT("center.noUnread") : notificationT("center.empty")}
            className="qtable-notification-page-empty"
          />
        )}
      </section>
    </div>
  );
}
