import {
  ClockCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import { Avatar, Button, Empty, Spin, Tag, Tooltip } from "antd";
import { useMemo, useState } from "react";
import { useLanguage } from "../../lib/useLanguage";
import { RECORD_ACTIVITY } from "./notificationGraphql";
import { exactTime, relativeTime } from "./notificationFormatters";
import { notificationT } from "./notificationI18n";
import type { RecordActivityItem, RecordActivityPage } from "./types";

const PAGE_SIZE = 50;

const dedupe = (items: RecordActivityItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const sourceMeta = (source?: string | null) => {
  const normalized = String(source || "").toLowerCase();
  if (normalized.includes("ai")) {
    return { label: "AI", tone: "ai", icon: <RobotOutlined /> };
  }
  if (normalized.includes("automation")) {
    return { label: notificationT("type.automation"), tone: "warning", icon: <ThunderboltOutlined /> };
  }
  return source
    ? { label: source, tone: "neutral", icon: <ClockCircleOutlined /> }
    : null;
};

export function RecordActivity({
  tableId,
  recordId,
}: {
  tableId: string;
  recordId: string;
}) {
  useLanguage();
  const [extraItems, setExtraItems] = useState<RecordActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreOverride, setHasMoreOverride] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useQuery<{ recordActivity: RecordActivityPage }>(RECORD_ACTIVITY, {
    variables: { tableId, recordId, cursor: null, limit: PAGE_SIZE },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const page = query.data?.recordActivity;
  const items = useMemo(
    () => dedupe([...(page?.items || []), ...extraItems]),
    [extraItems, page?.items],
  );
  const effectiveCursor = nextCursor ?? page?.pageInfo.nextCursor ?? null;
  const hasMore =
    hasMoreOverride ?? Boolean(page?.pageInfo.hasMore && effectiveCursor);

  const loadMore = async () => {
    if (!effectiveCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await query.fetchMore({
        variables: { tableId, recordId, cursor: effectiveCursor, limit: PAGE_SIZE },
      });
      const next = result.data?.recordActivity;
      if (!next) return;
      setExtraItems((current) => dedupe([...current, ...next.items]));
      setNextCursor(next.pageInfo.nextCursor || null);
      setHasMoreOverride(next.pageInfo.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  if (query.loading && !query.data) {
    return <div className="qtable-record-collab-loading"><Spin /></div>;
  }

  if (query.error) {
    return (
      <div className="qtable-record-workspace-empty">
        <div>{notificationT("activity.loadFailed", { message: query.error.message })}</div>
        <Button size="small" onClick={() => void query.refetch()}>
          {notificationT("common.retry")}
        </Button>
      </div>
    );
  }

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={notificationT("activity.empty")} />;
  }

  return (
    <div className="qtable-record-activity-list">
      {items.map((item) => {
        const actorName = item.actor?.name || notificationT("common.system");
        const source = sourceMeta(item.source);
        return (
          <article className="qtable-record-activity-item" key={item.id}>
            <Avatar size={28} className="qtable-record-activity-avatar">
              {item.actor?.id ? actorName.charAt(0).toUpperCase() : <UserOutlined />}
            </Avatar>
            <div className="qtable-record-activity-body">
              <div className="qtable-record-activity-head">
                <div>
                  <strong>{actorName}</strong>
                  <span>{item.summary}</span>
                </div>
                <Tooltip title={exactTime(item.createdAt)}>
                  <time>{relativeTime(item.createdAt)}</time>
                </Tooltip>
              </div>
              <div className="qtable-record-activity-meta">
                {source ? (
                  <Tag bordered={false} className={`is-${source.tone}`} icon={source.icon}>
                    {source.label}
                  </Tag>
                ) : null}
                {(item.kinds || []).slice(0, 3).map((kind) => (
                  <Tag bordered={false} key={kind}>{kind}</Tag>
                ))}
              </div>
            </div>
          </article>
        );
      })}
      {hasMore ? (
        <div className="qtable-record-activity-load-more">
          <Button loading={loadingMore} onClick={() => void loadMore()}>
            {notificationT("activity.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
