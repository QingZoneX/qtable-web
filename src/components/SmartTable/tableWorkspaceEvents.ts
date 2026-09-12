export type TableWorkspaceAction =
  | "import_csv"
  | "ai_generate";

const TABLE_WORKSPACE_ACTION_EVENT = "qtable:table-workspace-action";

export function dispatchTableWorkspaceAction(action: TableWorkspaceAction) {
  window.dispatchEvent(
    new CustomEvent<TableWorkspaceAction>(TABLE_WORKSPACE_ACTION_EVENT, {
      detail: action,
    }),
  );
}

export function subscribeTableWorkspaceAction(
  listener: (action: TableWorkspaceAction) => void,
) {
  const handler = (event: Event) => {
    listener((event as CustomEvent<TableWorkspaceAction>).detail);
  };
  window.addEventListener(TABLE_WORKSPACE_ACTION_EVENT, handler);
  return () => window.removeEventListener(TABLE_WORKSPACE_ACTION_EVENT, handler);
}
