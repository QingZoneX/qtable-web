import { useParams } from "react-router-dom";
import { DashboardExperienceShell } from "./Dashboard/DashboardExperienceShell";

export function DashboardWorkbench({ embedded }: { embedded?: boolean }) {
  const { dashboardId, tableId } = useParams();
  const routeKey = dashboardId || tableId || "dashboard";
  return <DashboardExperienceShell key={routeKey} embedded={embedded} />;
}
