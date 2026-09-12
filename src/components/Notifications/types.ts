export type CollaborationActor = {
  id?: number | null;
  name: string;
  email?: string | null;
};

export type NotificationType =
  | "comment_mention"
  | "comment_reply"
  | "task_assigned"
  | "due_3d"
  | "due_24h"
  | "ai_action_required"
  | "automation_failed";

export type NotificationItem = {
  id: string;
  type: NotificationType | string;
  actor: CollaborationActor;
  workspaceId?: string | null;
  tableId?: string | null;
  recordId?: string | null;
  commentId?: string | null;
  createdAt?: string | null;
  readAt?: string | null;
  accessible: boolean;
  title: string;
  summary: string;
  deepLink?: string | null;
  payload?: Record<string, unknown>;
};

export type CursorPageInfo = {
  offset?: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

export type NotificationPage = {
  items: NotificationItem[];
  totalCount: number;
  unreadCount: number;
  pageInfo: CursorPageInfo;
};

export type NotificationUpdate = {
  kind: "snapshot" | "created" | "read" | "read_all" | string;
  notification?: NotificationItem | null;
  unreadCount: number;
  updatedAt?: string | null;
};

export type RecordComment = {
  id: string;
  workspaceId: string;
  tableId: string;
  recordId: string;
  parentCommentId?: string | null;
  author: CollaborationActor;
  body?: string | null;
  bodyFormat: string;
  mentions: CollaborationActor[];
  revision: number;
  deleted: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export type RecordCommentPage = {
  items: RecordComment[];
  totalCount: number;
  pageInfo: CursorPageInfo;
};

export type RecordActivityItem = {
  id: string;
  changeSetId: string;
  commentId?: string | null;
  actor: CollaborationActor;
  kinds: string[];
  operation?: string | null;
  source?: string | null;
  summary: string;
  deepLink?: string | null;
  createdAt?: string | null;
};

export type RecordActivityPage = {
  items: RecordActivityItem[];
  pageInfo: CursorPageInfo & { scannedCount?: number };
};
