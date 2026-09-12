import { createContext, useContext } from "react";
import { runtimeFiltersForWidget } from "./dashboardExperienceModel";

export type DashboardExperienceMode = "view" | "edit";

export type DashboardRuntimeFilter = {
  id: string;
  tableId: string;
  tableName: string;
  fieldId: string;
  fieldName: string;
  operator: string;
  value: unknown;
};

export type DashboardExperienceContextValue = {
  mode: DashboardExperienceMode;
  runtimeFilters: DashboardRuntimeFilter[];
  reportDataLoaded: () => void;
};

export const DashboardExperienceContext = createContext<DashboardExperienceContextValue>({
  mode: "view",
  runtimeFilters: [],
  reportDataLoaded: () => undefined,
});

export function useDashboardExperience() {
  return useContext(DashboardExperienceContext);
}

export function runtimeFiltersForTable(
  filters: DashboardRuntimeFilter[],
  tableId: string | null | undefined,
) {
  return runtimeFiltersForWidget(filters, tableId);
}
