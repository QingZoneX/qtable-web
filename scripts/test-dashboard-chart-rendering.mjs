import assert from "node:assert/strict";
import test from "node:test";
import { dashboardChartRenderRevision } from "../src/components/Dashboard/chartRenderModel.ts";

test("chart render revision is stable for identical render inputs", () => {
  const rows = [
    { dimension: "—", value: 14 },
    { dimension: "opt2", value: 2 },
    { dimension: "opt1", value: 1 },
  ];
  const palette = ["#16A34A", "#4ADE80"];
  const display = { showLabels: true, showLegend: false, decimals: 0 };

  assert.equal(
    dashboardChartRenderRevision("bar", rows, palette, display),
    dashboardChartRenderRevision("bar", rows, palette, display),
  );
});

test("bar data changes force a fresh VChart instance revision", () => {
  const before = dashboardChartRenderRevision(
    "bar",
    [{ dimension: "opt1", value: 1 }],
    ["#16A34A"],
  );
  const after = dashboardChartRenderRevision(
    "bar",
    [{ dimension: "opt1", value: 2 }],
    ["#16A34A"],
  );

  assert.notEqual(before, after);
});

test("vertical and horizontal bar charts never share an instance revision", () => {
  const rows = [
    { dimension: "opt1", value: 1 },
    { dimension: "opt2", value: 4 },
  ];

  assert.notEqual(
    dashboardChartRenderRevision("bar", rows, null),
    dashboardChartRenderRevision("horizontalBar", rows, null),
  );
});

test("palette and display changes force a fresh chart instance revision", () => {
  const rows = [{ dimension: "opt1", value: 1 }];
  const base = dashboardChartRenderRevision("bar", rows, ["#2563EB"], {
    showLabels: true,
  });

  assert.notEqual(
    base,
    dashboardChartRenderRevision("bar", rows, ["#16A34A"], {
      showLabels: true,
    }),
  );
  assert.notEqual(
    base,
    dashboardChartRenderRevision("bar", rows, ["#2563EB"], {
      showLabels: false,
    }),
  );
});
