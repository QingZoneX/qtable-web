export type SourceInboxStatus =
  | "pending"
  | "converted"
  | "archived"
  | "ignored"
  | "duplicate";

export type SourceInboxItem = {
  id: string;
  workspaceId: string;
  sourceId: string;
  sourceType: string;
  url?: string | null;
  canonicalUrl?: string | null;
  pageTitle?: string | null;
  quote?: string | null;
  annotation?: string | null;
  anchor?: Record<string, unknown> | null;
  capturedAt?: string | null;
  tags: string[];
  sourceAuthor?: string | null;
  screenshotUrl?: string | null;
  preview?: Record<string, unknown> | null;
  status: SourceInboxStatus;
  duplicateOfId?: string | null;
  suggestion?: SourceInboxPreview | null;
  targetTableId?: string | null;
  targetRecordId?: string | null;
  convertedChangeSetId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  convertedAt?: string | null;
};

export type SourceInboxPage = {
  items: SourceInboxItem[];
  totalCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset?: number | null;
};

export type SourceInboxTable = {
  tableId: string;
  name: string;
  defaultViewId?: string | null;
  permission: string;
  titleFieldId?: string | null;
  fieldCount: number;
};

export type SourceInboxMember = {
  userId: number;
  name: string;
  email?: string | null;
  role?: string | null;
};

export type SourceInboxSuggestion = {
  shouldConvert: boolean;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  suggestedAssigneeUserId?: number | null;
  workloadHours?: number | null;
  reason?: string;
  confidence: number;
};

export type SimilarTask = {
  recordId: string;
  title: string;
  similarity: number;
  reason: string;
  status?: string;
  owner?: string;
  deepLink: string;
};

export type SourceInboxPreview = {
  itemId: string;
  targetTable: SourceInboxTable;
  availableTables: SourceInboxTable[];
  suggestion: SourceInboxSuggestion;
  similarTasks: SimilarTask[];
  similarityScanTruncated: boolean;
  fieldPlan: {
    mapping: Record<string, string>;
    schemaAdditions: Array<{
      semantic: string;
      id: string;
      name: string;
      type: string;
    }>;
  };
  members: SourceInboxMember[];
  provider: string;
  model?: string | null;
  warnings?: string[];
};

export type SourceInboxConvertResult = {
  item: SourceInboxItem;
  task: {
    tableId: string;
    recordId: string;
    deepLink: string;
    changeSetId?: string;
    schemaAdditions?: Array<Record<string, unknown>>;
  };
  idempotent: boolean;
};
