import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) failures.push(`missing ${label}: ${needle}`);
};
const forbid = (source, needle, label) => {
  if (source.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
};

const shell = read("src/components/AppShell/AppShell.tsx");
const topbar = read("src/components/AppShell/TopAppBar.tsx");
const shellPages = read("src/components/AppShell/ShellPages.tsx");
const graphql = read("src/components/Notifications/notificationGraphql.ts");
const provider = read("src/components/Notifications/NotificationRealtimeProvider.tsx");
const realtime = read("src/components/Notifications/notificationRealtime.ts");
const bell = read("src/components/Notifications/NotificationBell.tsx");
const center = read("src/components/Notifications/NotificationCenterPage.tsx");
const item = read("src/components/Notifications/NotificationListItem.tsx");
const comments = read("src/components/Notifications/RecordComments.tsx");
const activity = read("src/components/Notifications/RecordActivity.tsx");
const markdown = read("src/components/Notifications/SafeMarkdown.tsx");
const css = read("src/components/Notifications/notificationCenter.css");
const recordCss = read("src/components/SmartTable/recordWorkspace.css");

requireText(shell, "NotificationRealtimeProvider", "authenticated realtime provider");
requireText(topbar, "<NotificationBell />", "App Shell notification bell");
requireText(shellPages, "NotificationsShellPage = NotificationCenterPage", "real notifications route");

for (const operation of [
  "NOTIFICATIONS",
  "NOTIFICATION_UNREAD_COUNT",
  "MARK_NOTIFICATION_READ",
  "MARK_ALL_NOTIFICATIONS_READ",
  "NOTIFICATION_UPDATES",
  "RECORD_COMMENTS",
  "MENTION_CANDIDATES",
  "CREATE_RECORD_COMMENT",
  "RECORD_ACTIVITY",
]) {
  requireText(graphql, `export const ${operation}`, `GraphQL operation ${operation}`);
}

requireText(provider, "client.subscribe", "websocket notification subscription");
requireText(provider, "BroadcastChannel", "multi-tab eventual consistency");
requireText(provider, "visibilitychange", "focus/reconnect repair trigger");
requireText(realtime, "NOTIFICATION_CHANGE_EVENT", "notification invalidation event");
requireText(realtime, "useNotificationRealtime", "realtime context hook");
requireText(bell, "overflowCount={99}", "99+ unread badge");
requireText(bell, "查看全部通知", "quick panel full-center entry");
requireText(center, 'scope === "unread"', "unread filter");
requireText(center, "notificationTypeOptions", "type filter");
requireText(center, "fetchMore", "cursor pagination");
requireText(center, "MARK_ALL_NOTIFICATIONS_READ", "mark-all action");
requireText(center, "NOTIFICATION_CHANGE_EVENT", "realtime center invalidation");
requireText(item, "item.accessible", "permission tombstone UI");
requireText(item, "exactTime", "exact timestamp tooltip");
requireText(comments, "mentionUserIds", "structured mention IDs");
requireText(comments, "clientMutationId", "comment mutation idempotency");
requireText(comments, "parentCommentId", "comment replies");
requireText(comments, "highlightCommentId", "comment deep-link focus");
requireText(activity, "RECORD_ACTIVITY", "semantic activity API");
forbid(activity, "beforeData", "raw ChangeSet before data");
forbid(activity, "afterData", "raw ChangeSet after data");
forbid(markdown, "dangerouslySetInnerHTML", "unsafe HTML rendering");
requireText(markdown, "noopener", "safe external links");

for (const selector of [
  ".qtable-notification-popover",
  ".qtable-notification-center",
  ".qtable-notification-item.is-unread",
  ".qtable-notification-main:focus-visible",
  "@media (max-width: 1099px)",
  "@media (max-width: 760px)",
]) {
  requireText(css, selector, `responsive notification style ${selector}`);
}

for (const selector of [
  ".qtable-comment-composer",
  ".qtable-comment.is-highlighted",
  ".qtable-record-activity-item",
  "@media (max-width: 560px)",
]) {
  requireText(recordCss, selector, `record collaboration style ${selector}`);
}

if (failures.length) {
  console.error("[collaboration-ui] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("[collaboration-ui] contract checks passed");
