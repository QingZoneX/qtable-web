import type { TableRecord } from "../../../../store/useSmartTableStore";

export const BOARD_PAGE_SIZE = 30;
export const DEFAULT_LANE_KEY = "__default__";
export const UNASSIGNED_KEY = "__unassigned__";

export type BoardDescriptor = {
  key: string;
  label: string;
  value: unknown;
  count: number;
};

export type BoardCellCount = {
  columnKey: string;
  laneKey: string | null;
  count: number;
};

export type BoardCard = {
  record: TableRecord;
  rank: string | null;
  orderRevision: number;
  recordVersion: number;
};

export type BoardPageInfo = {
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  databasePaged: boolean;
  manualOrderActive: boolean;
};

export type BoardConfig = {
  groupFieldId: string;
  laneFieldId: string | null;
  cardFieldIds: string[];
  cardOrder: "manual";
  hideCompleted: boolean;
  collapsedColumns: string[];
};

export type BoardPayload = {
  viewId: string;
  boardConfig: BoardConfig;
  columns: BoardDescriptor[];
  lanes: BoardDescriptor[];
  cells: BoardCellCount[];
  cards: BoardCard[];
  pageInfo: BoardPageInfo;
};

export type BoardCellState = {
  cards: BoardCard[];
  pageInfo: BoardPageInfo | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type BoardMoveTarget = {
  columnKey: string;
  laneKey: string | null;
  beforeRecordId?: string | null;
  afterRecordId?: string | null;
};

export type BoardMoveResult = {
  record: TableRecord;
  recordVersion: number;
  rank: string;
  orderRevision: number;
  previousRank: string;
  previousColumnKey: string;
  previousLaneKey: string | null;
  columnKey: string;
  laneKey: string | null;
};

export const boardCellKey = (columnKey: string, laneKey?: string | null) =>
  `${laneKey || DEFAULT_LANE_KEY}::${columnKey}`;
