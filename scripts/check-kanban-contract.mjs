import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const view = read("src/components/SmartTable/views/KanbanView.tsx");
const hook = read("src/components/SmartTable/views/kanban/useServerBoard.ts");
const graphql = read("src/components/SmartTable/views/kanban/boardGraphql.ts");
const card = read("src/components/SmartTable/views/kanban/KanbanCard.tsx");
const css = read("src/components/SmartTable/views/kanban/kanban.css");
const settings = read("src/components/SmartTable/views/kanban/BoardSettingsDrawer.tsx");

const failures = [];
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message);
};
const forbid = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message);
};

requireMatch(view, /useServerBoard/, "KanbanView must consume the server-board hook");
forbid(view, /useTableRecords\s*\(/, "KanbanView must not derive the board from the full frontend record set");
forbid(view, /updateRecord\s*\(/, "Kanban moves must not degrade to a status-only updateRecord mutation");
requireMatch(view, /recordId/, "Card click must preserve the record-detail URL contract");
requireMatch(view, /completedStatusValues/, "Completed columns must use explicit Task Profile semantics");
requireMatch(view, /collapsedLanes/, "Swimlanes must support collapse state");

for (const operation of ["BOARD_VIEW", "MOVE_BOARD_CARD", "UPDATE_BOARD_VIEW_CONFIG", "BOARD_UPDATES"]) {
  requireMatch(graphql, new RegExp(`export const ${operation}`), `Missing ${operation} GraphQL operation`);
}
requireMatch(hook, /expectedRecordVersion/, "Moves must send record-version concurrency control");
requireMatch(hook, /expectedOrderRevision/, "Moves must send order-revision concurrency control");
requireMatch(hook, /nextCursor/, "Board cells must support cursor paging");
requireMatch(hook, /client\s*\.subscribe\s*</s, "Board must consume targeted realtime updates");
requireMatch(hook, /setCells\(snapshot\)/, "Optimistic moves must roll back on failure");

requireMatch(card, /useDraggable/, "Kanban card must remain draggable when permission allows");
requireMatch(card, /disabled:\s*!canUpdate/, "Read-only cards must disable drag semantics");
requireMatch(card, /MoreOutlined/, "Cards must expose an accessible hover action menu");
requireMatch(card, /dueState\s*=\s*"overdue"/, "Cards must calculate overdue risk state");
requireMatch(css, /\.q-kanban-due\.is-overdue/, "Cards must expose overdue risk styling");
requireMatch(settings, /maxCount=\{MAX_CARD_FIELDS\}/, "Card settings must enforce a display-field density cap");
requireMatch(settings, /t\(["']kanban\.laneByAssignee["']\)/, "Board settings must expose the localized Task Profile assignee shortcut");

requireMatch(css, /clamp\(/, "Kanban columns must use adaptive sizing");
requireMatch(css, /@media \(max-width: 640px\)/, "Kanban must define a narrow-screen layout");
requireMatch(css, /position:\s*sticky/, "Board headers/lane labels must retain context while scrolling");
requireMatch(css, /:focus-visible/, "Kanban cards must expose keyboard focus state");

if (failures.length) {
  console.error("[kanban-contract] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[kanban-contract] OK");
