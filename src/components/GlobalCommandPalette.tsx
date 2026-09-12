import {
  AppstoreOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FolderOutlined,
  SearchOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { useApolloClient } from "@apollo/client/react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { GLOBAL_SEARCH } from "../lib/graphql";
import {
  loadRecentTargets,
  rememberRecentTarget,
  type RecentSearchTarget,
} from "../lib/recentTargets";
import { useAuthStore } from "../store/authStore";
import { GLOBAL_SEARCH_OPEN_EVENT } from "../lib/shellEvents";

type SearchContext = {
  id: string;
  name: string;
};

export type GlobalSearchResult = {
  entityType: "workspace" | "folder" | "table" | "dashboard" | "record" | string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  snippet?: string | null;
  workspace?: SearchContext | null;
  table?: (SearchContext & { defaultViewId?: string | null }) | null;
  deepLink: string;
  score?: number;
  matchedFields?: Array<{ id: string; name: string }>;
  sourceService?: string;
};

type GlobalSearchPayload = {
  query: string;
  results: GlobalSearchResult[];
  nextCursor?: string | null;
  hasMore?: boolean;
  sourceServices?: string[];
  truncated?: boolean;
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PAGE_SIZE = 20;

const GROUP_ORDER = ["record", "table", "dashboard", "folder", "workspace"] as const;
const GROUP_LABELS: Record<string, string> = {
  record: "记录与任务",
  table: "数据表",
  dashboard: "仪表盘",
  folder: "文件夹",
  workspace: "工作空间",
  recent: "最近访问",
};

const entityIcon = (entityType: string): ReactNode => {
  if (entityType === "record") return <FileTextOutlined />;
  if (entityType === "table") return <TableOutlined />;
  if (entityType === "dashboard") return <DashboardOutlined />;
  if (entityType === "folder") return <FolderOutlined />;
  return <AppstoreOutlined />;
};

const userStorageKey = (
  user: { id?: number | string; email?: string | null } | null | undefined,
) => String(user?.id ?? user?.email ?? "anonymous");

const toRecentTarget = (
  item: GlobalSearchResult,
): Omit<RecentSearchTarget, "visitedAt"> => ({
  entityType: item.entityType,
  entityId: item.entityId,
  title: item.title,
  subtitle: item.subtitle,
  deepLink: item.deepLink,
  workspace: item.workspace,
  table: item.table,
});

const fromRecentTarget = (item: RecentSearchTarget): GlobalSearchResult => ({
  entityType: item.entityType,
  entityId: item.entityId,
  title: item.title,
  subtitle: item.subtitle,
  deepLink: item.deepLink,
  workspace: item.workspace,
  table: item.table,
  sourceService: "recent",
});

export function GlobalCommandPalette() {
  const apollo = useApolloClient();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [recent, setRecent] = useState<RecentSearchTarget[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const requestSeqRef = useRef(0);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const storageUserKey = useMemo(() => userStorageKey(user), [user]);

  const activeResults = useMemo(
    () =>
      keyword.trim()
        ? results
        : recent.map((item) => fromRecentTarget(item)),
    [keyword, recent, results],
  );

  const grouped = useMemo(() => {
    if (!keyword.trim()) {
      return [{ key: "recent", items: activeResults }];
    }
    const byType = new Map<string, GlobalSearchResult[]>();
    for (const item of activeResults) {
      const list = byType.get(item.entityType) || [];
      list.push(item);
      byType.set(item.entityType, list);
    }
    const groups: Array<{
      key: string;
      items: GlobalSearchResult[];
    }> = GROUP_ORDER.map((key) => ({
      key,
      items: byType.get(key) || [],
    })).filter((group) => group.items.length > 0);
    for (const [key, items] of byType.entries()) {
      if (!GROUP_ORDER.includes(key as (typeof GROUP_ORDER)[number])) {
        groups.push({ key, items });
      }
    }
    return groups;
  }, [activeResults, keyword]);

  const flattened = useMemo(
    () => grouped.flatMap((group) => group.items),
    [grouped],
  );

  const refreshRecent = useCallback(() => {
    setRecent(loadRecentTargets(storageUserKey));
  }, [storageUserKey]);

  useEffect(() => {
    const openFromShell = () => setOpen(true);
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, openFromShell);
    return () =>
      window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, openFromShell);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      requestSeqRef.current += 1;
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    refreshRecent();
    setSelectedIndex(0);
  }, [open, refreshRecent]);

  useEffect(() => {
    if (!open || !token) return;
    const query = keyword.trim();
    const requestId = ++requestSeqRef.current;

    if (!query) {
      setResults([]);
      setNextCursor(null);
      setHasMore(false);
      setTruncated(false);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apollo.query<{ globalSearch: GlobalSearchPayload }>({
          query: GLOBAL_SEARCH,
          variables: {
            keyword: query,
            cursor: null,
            limit: SEARCH_PAGE_SIZE,
          },
          fetchPolicy: "network-only",
        });
        if (requestId !== requestSeqRef.current) return;
        const payload = response.data?.globalSearch;
        setResults(payload?.results || []);
        setNextCursor(payload?.nextCursor || null);
        setHasMore(Boolean(payload?.hasMore));
        setTruncated(Boolean(payload?.truncated));
        setSelectedIndex(0);
      } catch (reason) {
        if (requestId !== requestSeqRef.current) return;
        setResults([]);
        setNextCursor(null);
        setHasMore(false);
        setTruncated(false);
        setError(
          reason instanceof Error ? reason.message : "全局搜索暂时不可用",
        );
      } finally {
        if (requestId === requestSeqRef.current) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [apollo, keyword, open, token]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const openResult = useCallback(
    (item: GlobalSearchResult) => {
      const updated = rememberRecentTarget(storageUserKey, toRecentTarget(item));
      setRecent(updated);
      setOpen(false);
      setKeyword("");
      navigate(item.deepLink);
    },
    [navigate, storageUserKey],
  );

  const loadMore = useCallback(async () => {
    const query = keyword.trim();
    if (!query || !nextCursor || loadingMore) return;
    const requestId = ++requestSeqRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await apollo.query<{ globalSearch: GlobalSearchPayload }>({
        query: GLOBAL_SEARCH,
        variables: {
          keyword: query,
          cursor: nextCursor,
          limit: SEARCH_PAGE_SIZE,
        },
        fetchPolicy: "network-only",
      });
      if (requestId !== requestSeqRef.current) return;
      const payload = response.data?.globalSearch;
      setResults((current) => {
        const seen = new Set(
          current.map((item) => `${item.entityType}:${item.entityId}`),
        );
        return [
          ...current,
          ...(payload?.results || []).filter(
            (item) => !seen.has(`${item.entityType}:${item.entityId}`),
          ),
        ];
      });
      setNextCursor(payload?.nextCursor || null);
      setHasMore(Boolean(payload?.hasMore));
      setTruncated(Boolean(payload?.truncated));
    } catch (reason) {
      if (requestId !== requestSeqRef.current) return;
      setError(reason instanceof Error ? reason.message : "加载更多失败");
    } finally {
      if (requestId === requestSeqRef.current) setLoadingMore(false);
    }
  }, [apollo, keyword, loadingMore, nextCursor]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (flattened.length) {
        setSelectedIndex((index) => (index + 1) % flattened.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flattened.length) {
        setSelectedIndex(
          (index) => (index - 1 + flattened.length) % flattened.length,
        );
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = flattened[selectedIndex];
      if (selected) openResult(selected);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  let flatIndex = -1;

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      width={720}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
      title={null}
    >
      <div style={{ padding: "18px 18px 10px" }}>
        <Input
          autoFocus
          size="large"
          allowClear
          value={keyword}
          prefix={<SearchOutlined style={{ color: "#98A2B3" }} />}
          suffix={
            <Tag bordered={false} style={{ margin: 0 }}>
              {navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"}
            </Tag>
          }
          placeholder="搜索项目、数据表、任务或记录…"
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      <div
        style={{
          maxHeight: "min(62vh, 620px)",
          overflowY: "auto",
          padding: "4px 10px 12px",
        }}
      >
        {error ? (
          <Alert
            type="error"
            showIcon
            message="搜索失败"
            description={error}
            style={{ margin: 8 }}
          />
        ) : null}

        {truncated ? (
          <Alert
            type="warning"
            showIcon
            message="匹配内容较多，结果已达到安全扫描上限。请增加关键词缩小范围。"
            style={{ margin: 8 }}
          />
        ) : null}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Spin />
          </div>
        ) : flattened.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              keyword.trim()
                ? "没有找到可访问的匹配内容"
                : "还没有最近访问记录，开始打开一张表后这里会自动出现"
            }
            style={{ padding: "34px 0" }}
          />
        ) : (
          grouped.map((group) => (
            <Fragment key={group.key}>
              <Typography.Text
                type="secondary"
                style={{
                  display: "block",
                  padding: "10px 10px 6px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {GROUP_LABELS[group.key] || group.key.toUpperCase()}
              </Typography.Text>
              {group.items.map((item) => {
                flatIndex += 1;
                const index = flatIndex;
                const selected = index === selectedIndex;
                return (
                  <button
                    key={`${item.entityType}:${item.entityId}:${item.deepLink}`}
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => openResult(item)}
                    style={{
                      width: "100%",
                      border: 0,
                      borderRadius: 8,
                      background: selected ? "#F2F4FF" : "transparent",
                      padding: "10px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        flex: "0 0 30px",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 7,
                        background: "#F2F4F7",
                        color: "#475467",
                      }}
                    >
                      {entityIcon(item.entityType)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Typography.Text
                          strong
                          ellipsis
                          style={{ maxWidth: "70%", fontSize: 13 }}
                        >
                          {item.title}
                        </Typography.Text>
                        {item.sourceService && item.sourceService !== "recent" ? (
                          <Tag
                            bordered={false}
                            style={{ margin: 0, fontSize: 10 }}
                          >
                            {item.sourceService}
                          </Tag>
                        ) : null}
                      </span>
                      <Typography.Text
                        type="secondary"
                        ellipsis
                        style={{ display: "block", fontSize: 11, marginTop: 2 }}
                      >
                        {item.snippet || item.subtitle || item.deepLink}
                      </Typography.Text>
                      {item.subtitle && item.snippet ? (
                        <Typography.Text
                          type="secondary"
                          ellipsis
                          style={{ display: "block", fontSize: 10, marginTop: 2 }}
                        >
                          {item.subtitle}
                        </Typography.Text>
                      ) : null}
                    </span>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, paddingTop: 6 }}
                    >
                      ↵
                    </Typography.Text>
                  </button>
                );
              })}
            </Fragment>
          ))
        )}

        {!loading && keyword.trim() && hasMore && nextCursor ? (
          <div style={{ padding: "10px 8px 2px", textAlign: "center" }}>
            <Button loading={loadingMore} onClick={() => void loadMore()}>
              加载更多
            </Button>
          </div>
        ) : null}
      </div>

      <div
        style={{
          borderTop: "1px solid #EAECF0",
          padding: "8px 18px",
          display: "flex",
          gap: 14,
          color: "#98A2B3",
          fontSize: 10,
        }}
      >
        <span>↑↓ 选择</span>
        <span>Enter 打开</span>
        <span>Esc 关闭</span>
      </div>
    </Modal>
  );
}
