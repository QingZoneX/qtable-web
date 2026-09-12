import { useCallback, useMemo, useState } from "react";
import { Alert, Button, Input, Segmented, Select, Space, Tag, Typography } from "antd";
import { FilterOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import { useParams } from "react-router-dom";
import { GET_DASHBOARD, GET_TABLE_DATA, GET_WORKSPACE } from "../../lib/graphql";
import { useAuthStore } from "../../store/authStore";
import {
  permissionAllows,
  useSmartTableStore,
} from "../../store/useSmartTableStore";
import { DashboardWorkbench as DashboardWorkbenchCore } from "../DashboardWorkbenchCore";
import { normalizeDashboardFilterValue } from "./dashboardExperienceModel";
import { walkTables } from "./utils";
import {
  DashboardExperienceContext,
  type DashboardExperienceMode,
  type DashboardRuntimeFilter,
} from "./DashboardExperienceContext";
import type { DashboardPayload, WorkspaceNode } from "./types";
import "./dashboardExperience.css";

const NUMERIC_FIELD_TYPES = new Set(["number", "progress", "rating", "autoNumber"]);

type DashboardField = {
  id: string;
  name: string;
  type: string;
  options?: Array<{ id?: string; value?: string; label?: string }> | null;
};

function operatorsForField(field?: DashboardField) {
  if (!field) return [{ value: "eq", label: "等于" }];
  if (NUMERIC_FIELD_TYPES.has(field.type)) {
    return [
      { value: "eq", label: "等于" },
      { value: "neq", label: "不等于" },
      { value: "gt", label: "大于" },
      { value: "gte", label: "大于等于" },
      { value: "lt", label: "小于" },
      { value: "lte", label: "小于等于" },
      { value: "in", label: "属于多个值" },
    ];
  }
  if (field.type === "date") {
    return [
      { value: "eq", label: "等于" },
      { value: "neq", label: "不等于" },
      { value: "before", label: "早于" },
      { value: "after", label: "晚于" },
    ];
  }
  if (["text", "url", "email"].includes(field.type)) {
    return [
      { value: "eq", label: "等于" },
      { value: "neq", label: "不等于" },
      { value: "contains", label: "包含" },
      { value: "in", label: "属于多个值" },
    ];
  }
  return [
    { value: "eq", label: "等于" },
    { value: "neq", label: "不等于" },
    { value: "in", label: "属于多个值" },
  ];
}

function formatFilterValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value == null || value === "") return "—";
  return String(value);
}

function filterValueInput(
  field: DashboardField | undefined,
  operator: string,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  if (!field) {
    return <Input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  }
  const options = (field.options || [])
    .map((option) => ({
      value: String(option.id ?? option.value ?? option.label ?? ""),
      label: String(option.label ?? option.value ?? option.id ?? ""),
    }))
    .filter((option) => option.value);
  if (options.length) {
    return (
      <Select
        value={value as string | string[] | undefined}
        mode={operator === "in" ? "multiple" : undefined}
        allowClear
        options={options}
        onChange={onChange}
      />
    );
  }
  if (field.type === "date") {
    return (
      <Input
        type="date"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (NUMERIC_FIELD_TYPES.has(field.type) && operator !== "in") {
    return (
      <Input
        type="number"
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Input
      value={String(value ?? "")}
      placeholder={operator === "in" ? "多个值用逗号分隔" : "输入筛选值"}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function DashboardExperienceShell({ embedded }: { embedded?: boolean }) {
  const { dashboardId: routeDashboardId, tableId } = useParams();
  const dashboardId = routeDashboardId || tableId || "";
  const token = useAuthStore((state) => state.token);
  const currentPermission = useSmartTableStore((state) => state.currentPermission);
  const workspaceId = localStorage.getItem("qtable.workspaceId") || "";
  const [mode, setMode] = useState<DashboardExperienceMode>("view");
  const [runtimeFilters, setRuntimeFilters] = useState<DashboardRuntimeFilter[]>([]);
  const [filterTableId, setFilterTableId] = useState<string>();
  const [filterFieldId, setFilterFieldId] = useState<string>();
  const [filterOperator, setFilterOperator] = useState("eq");
  const [filterValue, setFilterValue] = useState<unknown>("");
  const [lastDataLoadedAt, setLastDataLoadedAt] = useState<Date | null>(null);

  const { data: dashboardData } = useQuery<{ dashboard: unknown }>(GET_DASHBOARD, {
    variables: { dashboardId, workspaceId: workspaceId || undefined },
    skip: !token || !dashboardId,
    fetchPolicy: "cache-first",
  });
  const dashboard = dashboardData?.dashboard as DashboardPayload | undefined;

  const { data: workspaceData } = useQuery<{ workspace: { root: WorkspaceNode } }>(
    GET_WORKSPACE,
    {
      variables: { workspaceId: workspaceId || undefined },
      skip: !token,
      fetchPolicy: "cache-first",
    },
  );
  const allTables = useMemo(
    () => walkTables(workspaceData?.workspace?.root),
    [workspaceData?.workspace?.root],
  );
  const referencedTableIds = useMemo(
    () =>
      new Set(
        (dashboard?.widgets || [])
          .map((widget) => widget.config?.tableId)
          .filter((value): value is string => Boolean(value)),
      ),
    [dashboard?.widgets],
  );
  const filterTables = useMemo(() => {
    const referenced = allTables.filter((table) => referencedTableIds.has(table.id));
    return referenced.length ? referenced : allTables;
  }, [allTables, referencedTableIds]);

  const { data: tableData, loading: fieldsLoading } = useQuery<{ fields: DashboardField[] }>(
    GET_TABLE_DATA,
    {
      variables: { tableId: filterTableId || undefined },
      skip: !token || !filterTableId,
      fetchPolicy: "network-only",
    },
  );
  const fields = tableData?.fields || [];
  const selectedField = fields.find((field) => field.id === filterFieldId);
  const canEdit = dashboard?.isPublic
    ? permissionAllows(currentPermission, "manage")
    : permissionAllows(currentPermission, "edit");
  const effectiveMode: DashboardExperienceMode = canEdit ? mode : "view";

  const addFilter = () => {
    if (!filterTableId || !filterFieldId || !selectedField) return;
    const table = filterTables.find((item) => item.id === filterTableId);
    if (!table) return;
    const normalizedValue = normalizeDashboardFilterValue(
      selectedField.type,
      filterOperator,
      filterValue,
    );
    if (
      normalizedValue == null ||
      normalizedValue === "" ||
      (Array.isArray(normalizedValue) && normalizedValue.length === 0)
    ) {
      return;
    }
    const filterIdPrefix = `${filterTableId}:${filterFieldId}`;
    setRuntimeFilters((current) => {
      let sequence = current.length;
      while (current.some((item) => item.id === `${filterIdPrefix}:${sequence}`)) {
        sequence += 1;
      }
      const next: DashboardRuntimeFilter = {
        id: `${filterIdPrefix}:${sequence}`,
        tableId: filterTableId,
        tableName: table.name,
        fieldId: filterFieldId,
        fieldName: selectedField.name,
        operator: filterOperator,
        value: normalizedValue,
      };
      return [...current, next];
    });
    setFilterValue("");
  };

  const lastDataLabel = lastDataLoadedAt
    ? lastDataLoadedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "等待组件数据";
  const reportDataLoaded = useCallback(() => setLastDataLoadedAt(new Date()), []);

  const contextValue = useMemo(
    () => ({
      mode: effectiveMode,
      runtimeFilters,
      reportDataLoaded,
    }),
    [effectiveMode, reportDataLoaded, runtimeFilters],
  );

  return (
    <DashboardExperienceContext.Provider value={contextValue}>
      <div className="qtable-dashboard-experience" data-dashboard-mode={effectiveMode}>
        <section className="qtable-dashboard-experience-bar" aria-label="Dashboard analysis controls">
          <div className="qtable-dashboard-experience-mode">
            <Typography.Text strong>仪表盘模式</Typography.Text>
            <Segmented
              size="small"
              value={effectiveMode}
              options={[
                { value: "view", label: "查看" },
                { value: "edit", label: "编辑", disabled: !canEdit },
              ]}
              onChange={(value) => setMode(String(value) as DashboardExperienceMode)}
            />
            <Tag color={effectiveMode === "edit" ? "blue" : "default"}>
              {effectiveMode === "edit" ? "布局与配置可编辑" : "稳定查看，不拖动布局"}
            </Tag>
          </div>
          <div className="qtable-dashboard-experience-status">
            <Tag bordered={false}>实时订阅 + 手动刷新</Tag>
            <Typography.Text type="secondary">最近成功数据：{lastDataLabel}</Typography.Text>
          </div>
        </section>

        <section className="qtable-dashboard-filter-bar" aria-label="Dashboard global filters">
          <div className="qtable-dashboard-filter-heading">
            <Space size={6}>
              <FilterOutlined />
              <Typography.Text strong>全局筛选</Typography.Text>
              <Tag color={runtimeFilters.length ? "blue" : "default"}>
                {runtimeFilters.length ? `已应用 ${runtimeFilters.length}` : "未修改"}
              </Tag>
            </Space>
            <Typography.Text type="secondary">
              服务端运行时筛选 · 仅作用于同一来源表的组件，不改写组件配置
            </Typography.Text>
          </div>
          <div className="qtable-dashboard-filter-editor">
            <Select
              aria-label="筛选数据表"
              value={filterTableId}
              placeholder="来源表"
              showSearch
              optionFilterProp="label"
              options={filterTables.map((table) => ({ value: table.id, label: table.name }))}
              onChange={(value) => {
                setFilterTableId(value);
                setFilterFieldId(undefined);
                setFilterOperator("eq");
                setFilterValue("");
              }}
            />
            <Select
              aria-label="筛选字段"
              value={filterFieldId}
              placeholder="字段"
              loading={fieldsLoading}
              disabled={!filterTableId}
              showSearch
              optionFilterProp="label"
              options={fields.map((field) => ({
                value: field.id,
                label: `${field.name} · ${field.type}`,
              }))}
              onChange={(value) => {
                const field = fields.find((item) => item.id === value);
                setFilterFieldId(value);
                setFilterOperator(operatorsForField(field)[0]?.value || "eq");
                setFilterValue("");
              }}
            />
            <Select
              aria-label="筛选操作符"
              value={filterOperator}
              disabled={!filterFieldId}
              options={operatorsForField(selectedField)}
              onChange={(value) => {
                setFilterOperator(value);
                setFilterValue("");
              }}
            />
            <div className="qtable-dashboard-filter-value">
              {filterValueInput(selectedField, filterOperator, filterValue, setFilterValue)}
            </div>
            <Button type="primary" onClick={addFilter} disabled={!filterFieldId}>
              应用
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!runtimeFilters.length}
              onClick={() => setRuntimeFilters([])}
            >
              重置
            </Button>
          </div>
          {runtimeFilters.length ? (
            <div className="qtable-dashboard-filter-chips">
              {runtimeFilters.map((filter) => (
                <Tag
                  key={filter.id}
                  closable
                  onClose={() =>
                    setRuntimeFilters((current) =>
                      current.filter((item) => item.id !== filter.id),
                    )
                  }
                >
                  {filter.tableName} · {filter.fieldName} · {filter.operator} · {formatFilterValue(filter.value)}
                </Tag>
              ))}
            </div>
          ) : null}
          {dashboard?.isPublic ? (
            <Alert
              type="warning"
              showIcon
              className="qtable-dashboard-share-risk"
              message="公开分享不会暴露内部查询配置；公开组件数据仍按发布者当前可见权限计算。"
            />
          ) : null}
        </section>

        <div className="qtable-dashboard-core-wrap">
          <DashboardWorkbenchCore embedded={embedded} />
        </div>
      </div>
    </DashboardExperienceContext.Provider>
  );
}
