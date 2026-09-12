import React, { useMemo } from "react";
import { Select } from "antd";
import { useQuery } from "@apollo/client/react";
import { useAiAssistantStore } from "../../store/aiAssistantStore";
import { GET_WORKSPACE } from "../../lib/graphql";

type WorkspaceNode = {
  id: string;
  type?: string;
  name: string;
  children?: WorkspaceNode[];
};

type WorkspaceQueryData = {
  workspace?: {
    root?: WorkspaceNode | null;
    workspaceId?: string;
    workspace_id?: string;
  } | null;
};

const TableSelector: React.FC = () => {
  const workspaceId = localStorage.getItem("qtable.workspaceId") || undefined;
  const { data, loading } = useQuery<WorkspaceQueryData>(GET_WORKSPACE, {
    variables: { workspaceId: workspaceId },
    fetchPolicy: "network-only",
  });
  const selectedTableIds = useAiAssistantStore((s) => s.selectedTableIds);
  const setSelectedTableIds = useAiAssistantStore((s) => s.setSelectedTableIds);

  const tables = useMemo(() => {
    const result: Array<{ id: string; name: string; pathLabel: string }> = [];

    const visit = (node?: WorkspaceNode | null, parents: string[] = []) => {
      if (!node) return;
      const nextParents = node.type === "folder" ? [...parents, node.name] : parents;

      if (node.type === "table") {
        const prefix = parents.length > 0 ? `${parents.join(" / ")} / ` : "";
        result.push({
          id: node.id,
          name: node.name,
          pathLabel: `${prefix}${node.name}`,
        });
      }

      node.children?.forEach((child) => visit(child, nextParents));
    };

    visit(data?.workspace?.root);
    return result;
  }, [data?.workspace?.root]);

  return (
    <Select
      mode="multiple"
      size="small"
      placeholder="请选择数据表（可多选）"
      style={{ width: "100%" }}
      value={selectedTableIds}
      onChange={(values) => setSelectedTableIds(values)}
      loading={loading}
      options={tables.map((table) => ({
        value: table.id,
        label: table.pathLabel,
      }))}
    />
  );
};

export default TableSelector;
