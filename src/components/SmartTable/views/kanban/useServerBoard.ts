import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../../../../lib/apollo";
import type {
  FilterCondition,
  SortCondition,
} from "../../../../store/useSmartTableStore";
import {
  BOARD_UPDATES,
  BOARD_VIEW,
  MOVE_BOARD_CARD,
  UPDATE_BOARD_VIEW_CONFIG,
} from "./boardGraphql";
import {
  BOARD_PAGE_SIZE,
  boardCellKey,
  type BoardCellState,
  type BoardConfig,
  type BoardMoveResult,
  type BoardMoveTarget,
  type BoardPayload,
} from "./types";

const emptyCell = (): BoardCellState => ({
  cards: [],
  pageInfo: null,
  loading: false,
  loaded: false,
  error: null,
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "看板请求失败，请稍后重试";

const parsePayload = (value: unknown): BoardPayload => value as BoardPayload;

type Cells = Record<string, BoardCellState>;

export function useServerBoard({
  tableId,
  viewId,
  filters,
  sorts,
}: {
  tableId: string | null | undefined;
  viewId: string | null | undefined;
  filters: FilterCondition[];
  sorts: SortCondition[];
}) {
  const [metadata, setMetadata] = useState<BoardPayload | null>(null);
  const [cells, setCells] = useState<Cells>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cellsRef = useRef<Cells>({});
  const refreshTimerRef = useRef<number | null>(null);
  const filtersKey = JSON.stringify(filters);
  const sortsKey = JSON.stringify(sorts);

  const commitCells = useCallback(
    (next: Cells | ((current: Cells) => Cells)) => {
      setCells((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        cellsRef.current = resolved;
        return resolved;
      });
    },
    [],
  );

  const queryCell = useCallback(
    async (
      columnKey: string,
      laneKey: string | null,
      cursor: string | null,
    ) => {
      if (!tableId || !viewId) throw new Error("看板缺少 tableId/viewId");
      const result = await client.query<{ boardView: unknown }>({
        query: BOARD_VIEW,
        variables: {
          tableId,
          viewId,
          columnKey,
          laneKey,
          cursor,
          limit: BOARD_PAGE_SIZE,
          filters,
          sorts,
        },
        fetchPolicy: "network-only",
      });
      return parsePayload(result.data?.boardView);
    },
    // Content keys intentionally make callback identity follow filter/sort values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableId, viewId, filtersKey, sortsKey],
  );

  const refreshMetadata = useCallback(async () => {
    if (!tableId || !viewId) return null;
    const result = await client.query<{ boardView: unknown }>({
      query: BOARD_VIEW,
      variables: {
        tableId,
        viewId,
        columnKey: null,
        laneKey: null,
        cursor: null,
        limit: BOARD_PAGE_SIZE,
        filters,
        sorts,
      },
      fetchPolicy: "network-only",
    });
    const payload = parsePayload(result.data?.boardView);
    setMetadata(payload);
    return payload;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId, filtersKey, sortsKey]);

  const reloadCell = useCallback(
    async (columnKey: string, laneKey: string | null) => {
      const key = boardCellKey(columnKey, laneKey);
      commitCells((current) => ({
        ...current,
        [key]: { ...(current[key] || emptyCell()), loading: true, error: null },
      }));
      try {
        const payload = await queryCell(columnKey, laneKey, null);
        commitCells((current) => ({
          ...current,
          [key]: {
            cards: payload.cards,
            pageInfo: payload.pageInfo,
            loading: false,
            loaded: true,
            error: null,
          },
        }));
        return payload;
      } catch (nextError) {
        commitCells((current) => ({
          ...current,
          [key]: {
            ...(current[key] || emptyCell()),
            loading: false,
            loaded: true,
            error: errorMessage(nextError),
          },
        }));
        throw nextError;
      }
    },
    [commitCells, queryCell],
  );

  const ensureCell = useCallback(
    async (columnKey: string, laneKey: string | null) => {
      const current = cellsRef.current[boardCellKey(columnKey, laneKey)];
      if (current?.loaded || current?.loading) return;
      await reloadCell(columnKey, laneKey);
    },
    [reloadCell],
  );

  const loadMore = useCallback(
    async (columnKey: string, laneKey: string | null) => {
      const key = boardCellKey(columnKey, laneKey);
      const current = cellsRef.current[key];
      if (
        !current?.pageInfo?.hasMore ||
        !current.pageInfo.nextCursor ||
        current.loading
      ) {
        return;
      }
      commitCells((state) => ({
        ...state,
        [key]: { ...state[key], loading: true, error: null },
      }));
      try {
        const payload = await queryCell(
          columnKey,
          laneKey,
          current.pageInfo.nextCursor,
        );
        commitCells((state) => {
          const existing = state[key]?.cards || [];
          const existingIds = new Set(existing.map((card) => card.record.id));
          return {
            ...state,
            [key]: {
              cards: [
                ...existing,
                ...payload.cards.filter(
                  (card) => !existingIds.has(card.record.id),
                ),
              ],
              pageInfo: payload.pageInfo,
              loading: false,
              loaded: true,
              error: null,
            },
          };
        });
      } catch (nextError) {
        commitCells((state) => ({
          ...state,
          [key]: {
            ...(state[key] || emptyCell()),
            loading: false,
            error: errorMessage(nextError),
          },
        }));
      }
    },
    [commitCells, queryCell],
  );

  const refreshLoadedCells = useCallback(async () => {
    const jobs: Promise<unknown>[] = [];
    for (const [key, state] of Object.entries(cellsRef.current)) {
      if (!state.loaded) continue;
      const separator = key.indexOf("::");
      const lanePart = key.slice(0, separator);
      jobs.push(
        reloadCell(
          key.slice(separator + 2),
          lanePart === "__default__" ? null : lanePart,
        ).catch(() => undefined),
      );
    }
    await Promise.all(jobs);
  }, [reloadCell]);

  const refreshAll = useCallback(async () => {
    await refreshMetadata();
    await refreshLoadedCells();
  }, [refreshLoadedCells, refreshMetadata]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Defer local lifecycle state to the async task instead of synchronously
      // cascading state updates from the effect body (React 19 compiler rule).
      await Promise.resolve();
      if (cancelled) return;
      commitCells({});
      setMetadata(null);
      setError(null);
      if (!tableId || !viewId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await refreshMetadata();
      } catch (nextError) {
        if (!cancelled) setError(errorMessage(nextError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tableId,
    viewId,
    filtersKey,
    sortsKey,
    commitCells,
    refreshMetadata,
  ]);

  useEffect(() => {
    if (!tableId || !viewId) return;
    const subscription = client
      .subscribe<{ boardUpdates: unknown }>({
        query: BOARD_UPDATES,
        variables: { tableId, viewId },
      })
      .subscribe({
        next: () => {
          if (refreshTimerRef.current !== null) {
            window.clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = window.setTimeout(() => {
            void refreshAll();
          }, 120);
        },
        error: () => {
          // A transient websocket failure must not make the board unusable.
        },
      });
    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [tableId, viewId, refreshAll]);

  const saveConfig = useCallback(
    async (config: BoardConfig) => {
      if (!tableId || !viewId) throw new Error("看板缺少 tableId/viewId");
      const result = await client.mutate<{ updateBoardViewConfig: unknown }>({
        mutation: UPDATE_BOARD_VIEW_CONFIG,
        variables: {
          tableId,
          viewId,
          groupFieldId: config.groupFieldId,
          laneFieldId: config.laneFieldId,
          cardFieldIds: config.cardFieldIds,
          hideCompleted: config.hideCompleted,
          collapsedColumns: config.collapsedColumns,
        },
      });
      await refreshAll();
      return result.data?.updateBoardViewConfig;
    },
    [tableId, viewId, refreshAll],
  );

  const moveCard = useCallback(
    async (recordId: string, target: BoardMoveTarget) => {
      if (!tableId || !viewId) throw new Error("看板缺少 tableId/viewId");
      const snapshot = cellsRef.current;
      let sourceKey: string | null = null;
      let movingCard: BoardCellState["cards"][number] | null = null;
      for (const [key, state] of Object.entries(snapshot)) {
        const card = state.cards.find((item) => item.record.id === recordId);
        if (card) {
          sourceKey = key;
          movingCard = card;
          break;
        }
      }
      if (!movingCard) throw new Error("卡片尚未加载，请刷新后重试");

      const targetKey = boardCellKey(target.columnKey, target.laneKey);
      const optimistic: Cells = Object.fromEntries(
        Object.entries(snapshot).map(([key, state]) => [
          key,
          { ...state, cards: [...state.cards] },
        ]),
      );
      if (sourceKey) {
        optimistic[sourceKey].cards = optimistic[sourceKey].cards.filter(
          (item) => item.record.id !== recordId,
        );
      }
      if (!optimistic[targetKey]) optimistic[targetKey] = emptyCell();
      const targetCards = optimistic[targetKey].cards.filter(
        (item) => item.record.id !== recordId,
      );
      const anchorId = target.afterRecordId || target.beforeRecordId;
      const anchorIndex = anchorId
        ? targetCards.findIndex((item) => item.record.id === anchorId)
        : -1;
      const insertIndex = anchorIndex >= 0
        ? anchorIndex + (target.beforeRecordId ? 1 : 0)
        : targetCards.length;
      targetCards.splice(insertIndex, 0, movingCard);
      optimistic[targetKey] = {
        ...optimistic[targetKey],
        cards: targetCards,
        loaded: true,
      };
      commitCells(optimistic);

      try {
        const result = await client.mutate<{ moveBoardCard: unknown }>({
          mutation: MOVE_BOARD_CARD,
          variables: {
            tableId,
            viewId,
            recordId,
            targetColumnKey: target.columnKey,
            targetLaneKey: target.laneKey,
            beforeRecordId: target.beforeRecordId || null,
            afterRecordId: target.afterRecordId || null,
            expectedRecordVersion: movingCard.recordVersion,
            expectedOrderRevision: movingCard.orderRevision,
          },
        });
        const moved = result.data?.moveBoardCard as BoardMoveResult;
        await refreshMetadata();
        const jobs = [reloadCell(target.columnKey, target.laneKey)];
        if (sourceKey && sourceKey !== targetKey) {
          const separator = sourceKey.indexOf("::");
          const lanePart = sourceKey.slice(0, separator);
          jobs.push(
            reloadCell(
              sourceKey.slice(separator + 2),
              lanePart === "__default__" ? null : lanePart,
            ),
          );
        }
        await Promise.all(jobs);
        return moved;
      } catch (nextError) {
        setCells(snapshot);
        cellsRef.current = snapshot;
        throw nextError;
      }
    },
    [tableId, viewId, commitCells, refreshMetadata, reloadCell],
  );

  return {
    metadata,
    cells,
    loading,
    error,
    ensureCell,
    loadMore,
    refreshAll,
    saveConfig,
    moveCard,
  };
}
