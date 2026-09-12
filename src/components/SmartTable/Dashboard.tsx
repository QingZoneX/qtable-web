import { useMemo } from "react";
import { VChart } from "@visactor/react-vchart";
import { useSmartTableStore } from "../../store/useSmartTableStore";

export function Dashboard() {
  const { records, fields } = useSmartTableStore();

  // 1. Prepare data for Status Pie Chart
  const statusData = useMemo(() => {
    const statusField = fields.find((f) => f.name === "Status");
    if (!statusField) return [];

    const counts: Record<string, number> = {};
    records.forEach((r) => {
      const statusValue = r[statusField.id];
      const status =
        typeof statusValue === "string" || typeof statusValue === "number"
          ? String(statusValue)
          : "Unassigned";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts).map(([type, value]) => ({ type, value }));
  }, [records, fields]);

  // 2. Prepare data for Progress Bar Chart
  const progressData = useMemo(() => {
    const nameField = fields.find((f) => f.name === "Task Name");
    const progressField = fields.find((f) => f.name === "Progress");

    if (!nameField || !progressField) return [];

    return records.map((r) => ({
      task: r[nameField.id],
      progress: r[progressField.id] || 0,
    }));
  }, [records, fields]);

  // VChart Specifications
  const pieSpec = {
    type: "pie",
    data: [{ values: statusData }],
    outerRadius: 0.8,
    valueField: "value",
    categoryField: "type",
    title: {
      visible: true,
      text: "Task Status Distribution",
    },
    legends: { visible: true, orient: "left" as const },
  };

  const barSpec = {
    type: "bar",
    data: [{ values: progressData }],
    xField: "task",
    yField: "progress",
    title: {
      visible: true,
      text: "Task Progress",
    },
    label: { visible: true },
  };

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        gap: "20px",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: "45%",
          minWidth: "400px",
          height: "400px",
          border: "1px solid #eee",
          padding: "10px",
        }}
      >
        <VChart spec={pieSpec} />
      </div>
      <div
        style={{
          width: "45%",
          minWidth: "400px",
          height: "400px",
          border: "1px solid #eee",
          padding: "10px",
        }}
      >
        <VChart spec={barSpec} />
      </div>
    </div>
  );
}
