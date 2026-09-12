import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Card, Space, Tag, Typography } from "antd";
import { useMemo } from "react";
import { productT } from "../../lib/productI18n";
import { useLanguage } from "../../lib/useLanguage";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";

const { Text } = Typography;

const permissionLabel = (permission?: string | null) => {
  if (permission === "manage") return productT("ai.permission.manage");
  if (permission === "edit") return productT("ai.permission.edit");
  if (permission === "update") return productT("ai.permission.update");
  if (permission === "read") return productT("ai.permission.read");
  return productT("ai.context.notLoaded");
};

export function AiContextSummary() {
  useLanguage();
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const currentTableId = useSmartTableStore((state) => state.currentTableId);
  const currentTableName = useSmartTableStore((state) => state.currentTableName);
  const currentViewId = useSmartTableStore((state) => state.currentViewId);
  const views = useSmartTableStore((state) => state.views);
  const filters = useSmartTableStore((state) => state.filters);
  const sorts = useSmartTableStore((state) => state.sorts);
  const selectedRecordIds = useSmartTableStore((state) => state.selectedRecordIds);
  const currentPermission = useSmartTableStore((state) => state.currentPermission);

  const currentView = useMemo(
    () => views.find((view) => view.id === currentViewId),
    [currentViewId, views],
  );

  const scopeLabel = selectedRecordIds.length
    ? productT("ai.context.selectedRecords", { count: selectedRecordIds.length })
    : currentTableId
      ? productT("ai.context.currentTable")
      : productT("ai.context.noTable");

  return (
    <Card className="qtable-ai-context-card" bordered={false}>
      <div className="qtable-ai-context-heading">
        <div>
          <Text strong>{productT("ai.context.title")}</Text>
          <Text type="secondary" className="qtable-ai-context-subtitle">
            {productT("ai.context.description")}
          </Text>
        </div>
        <Tag icon={<SafetyCertificateOutlined />} color="blue" bordered={false}>
          {productT("ai.context.visibleData")}
        </Tag>
      </div>

      <div className="qtable-ai-context-grid">
        <div className="qtable-ai-context-item">
          <Text type="secondary">{productT("ai.context.workspace")}</Text>
          <Text strong ellipsis title={workspaceId || undefined}>
            {workspaceId ? productT("ai.context.currentWorkspace") : productT("ai.context.notSelected")}
          </Text>
        </div>
        <div className="qtable-ai-context-item">
          <Text type="secondary">{productT("ai.context.table")}</Text>
          <Text strong ellipsis title={currentTableName || currentTableId || undefined}>
            {currentTableName || (currentTableId ? productT("ai.context.currentTable") : productT("ai.context.notSelected"))}
          </Text>
        </div>
        <div className="qtable-ai-context-item">
          <Text type="secondary">{productT("ai.context.view")}</Text>
          <Text strong ellipsis title={currentView?.name || undefined}>
            {currentView?.name || productT("ai.context.notLoaded")}
          </Text>
        </div>
        <div className="qtable-ai-context-item">
          <Text type="secondary">{productT("ai.context.permission")}</Text>
          <Text strong>{permissionLabel(currentPermission)}</Text>
        </div>
      </div>

      <Space size={[8, 8]} wrap className="qtable-ai-context-tags">
        <Tag bordered={false} color={selectedRecordIds.length ? "geekblue" : "default"}>
          {scopeLabel}
        </Tag>
        <Tag bordered={false}>{productT("ai.context.filters", { count: filters.length })}</Tag>
        <Tag bordered={false}>{productT("ai.context.sorts", { count: sorts.length })}</Tag>
        {currentView?.type ? <Tag bordered={false}>{productT("ai.context.viewType", { type: currentView.type })}</Tag> : null}
      </Space>
    </Card>
  );
}
