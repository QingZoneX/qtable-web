export type DashboardTreeNode = {
  type: "folder" | "table" | "dashboard";
  id: string;
  name: string;
  children?: DashboardTreeNode[];
};

export type DashboardCenterItem = {
  id: string;
  name: string;
  parentId: string;
  folderPath: string[];
};

export type DashboardRecentTarget = {
  entityType: "table" | "dashboard" | "record";
  entityId: string;
  visitedAt?: string | null;
};

export const flattenDashboards = (
  root?: DashboardTreeNode | null,
): DashboardCenterItem[] => {
  if (!root) return [];
  const result: DashboardCenterItem[] = [];

  const visit = (
    node: DashboardTreeNode,
    parentId: string,
    folderPath: string[],
    includeFolderName: boolean,
  ) => {
    if (node.type === "dashboard") {
      result.push({ id: node.id, name: node.name, parentId, folderPath });
      return;
    }
    if (node.type === "table") return;

    const nextPath = includeFolderName ? [...folderPath, node.name] : folderPath;
    for (const child of node.children || []) {
      visit(child, node.id, nextPath, true);
    }
  };

  visit(root, root.id, [], false);
  return result;
};

export const dashboardRecentMap = (
  targets: DashboardRecentTarget[] = [],
): Map<string, string> => {
  const result = new Map<string, string>();
  for (const target of targets) {
    if (target.entityType !== "dashboard" || !target.visitedAt) continue;
    const current = result.get(target.entityId);
    if (!current || target.visitedAt > current) {
      result.set(target.entityId, target.visitedAt);
    }
  }
  return result;
};

export const dashboardSearchMatches = (
  item: DashboardCenterItem,
  query: string,
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [item.name, ...item.folderPath]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
};
