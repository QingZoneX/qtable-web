import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { Select, Spin, Typography } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { fetchRelationOptions, resolveRelationOptions } from "./relationApi";
import {
  normalizeRelationIds,
  relationValueFromIds,
  type RelationOption,
} from "./relationTypes";

const { Text } = Typography;
const PAGE_SIZE = 50;

type RelationRecordSelectProps = {
  tableId: string;
  fieldId: string;
  value: unknown;
  multiple: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  defaultOpen?: boolean;
  placeholder?: string;
  onChange: (value: string | string[] | null) => void;
  onCommit?: () => void;
};

const mergeOptions = (
  current: Map<string, RelationOption>,
  incoming: RelationOption[],
) => {
  const next = new Map(current);
  incoming.forEach((item) => next.set(item.id, item));
  return next;
};

export function RelationRecordSelect({
  tableId,
  fieldId,
  value,
  multiple,
  disabled,
  autoFocus,
  defaultOpen,
  placeholder = "选择关联记录",
  onChange,
  onCommit,
}: RelationRecordSelectProps) {
  const selectedIds = useMemo(() => normalizeRelationIds(value), [value]);
  const selectedKey = selectedIds.join("\u0001");
  const [optionsMap, setOptionsMap] = useState<Map<string, RelationOption>>(
    () => new Map(),
  );
  const [search, setSearch] = useState("");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestVersionRef = useRef(0);

  const loadPage = useCallback(
    async (nextSearch: string, offset: number, append: boolean) => {
      if (!tableId || !fieldId || disabled) return;
      const version = ++requestVersionRef.current;
      setLoading(true);
      setLoadError(false);
      try {
        const payload = await fetchRelationOptions({
          tableId,
          fieldId,
          search: nextSearch,
          offset,
          limit: PAGE_SIZE,
        });
        if (version !== requestVersionRef.current) return;
        setOptionsMap((current) => mergeOptions(current, payload.items));
        setPageIds((current) => {
          const incoming = payload.items.map((item) => item.id);
          if (!append) return incoming;
          return Array.from(new Set([...current, ...incoming]));
        });
        setHasMore(payload.hasMore);
      } catch {
        if (version === requestVersionRef.current) {
          setLoadError(true);
          setHasMore(false);
        }
      } finally {
        if (version === requestVersionRef.current) setLoading(false);
      }
    },
    [disabled, fieldId, tableId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPage(search.trim(), 0, false);
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadPage, search]);

  useEffect(() => {
    if (!tableId || !fieldId || selectedIds.length === 0) return;
    let active = true;
    void resolveRelationOptions({ tableId, fieldId, recordIds: selectedIds })
      .then((resolved) => {
        if (!active) return;
        setOptionsMap((current) => mergeOptions(current, resolved));
      })
      .catch(() => {
        // Keep unresolved IDs visible as their raw ID. The backend normally
        // removes dangling links when target records are deleted.
      });
    return () => {
      active = false;
    };
    // selectedKey is a stable primitive dependency for selectedIds contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, selectedKey, tableId]);

  const options = useMemo(() => {
    const ids = Array.from(new Set([...selectedIds, ...pageIds]));
    return ids.map((id) => {
      const resolved = optionsMap.get(id);
      return {
        value: id,
        label: resolved?.title || id,
      };
    });
  }, [optionsMap, pageIds, selectedIds]);

  const selectValue: string | string[] | undefined = multiple
    ? selectedIds
    : selectedIds[0] || undefined;

  const handleChange = (next: string | string[] | undefined) => {
    const nextIds = normalizeRelationIds(next);
    onChange(relationValueFromIds(nextIds, multiple));
    if (!multiple) onCommit?.();
  };

  const handlePopupScroll = (event: UIEvent<HTMLDivElement>) => {
    if (loading || !hasMore) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining > 48) return;
    void loadPage(search.trim(), pageIds.length, true);
  };

  return (
    <Select
      mode={multiple ? "multiple" : undefined}
      value={selectValue}
      options={options}
      disabled={disabled}
      autoFocus={autoFocus}
      defaultOpen={defaultOpen}
      allowClear
      showSearch
      filterOption={false}
      searchValue={search}
      onSearch={setSearch}
      onChange={handleChange}
      onPopupScroll={handlePopupScroll}
      onBlur={() => onCommit?.()}
      maxTagCount={multiple ? 3 : undefined}
      placeholder={placeholder}
      popupMatchSelectWidth={320}
      notFoundContent={
        loading ? (
          <div style={{ padding: 12, textAlign: "center" }}>
            <Spin size="small" />
          </div>
        ) : loadError ? (
          <Text type="danger">关联记录加载失败</Text>
        ) : (
          <Text type="secondary">没有匹配的记录</Text>
        )
      }
      optionRender={(option) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <LinkOutlined style={{ color: "#64748B", flex: "0 0 auto" }} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {String(option.label ?? option.value)}
          </span>
        </div>
      )}
      style={{ width: "100%" }}
    />
  );
}
