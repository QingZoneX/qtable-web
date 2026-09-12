import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDashboardFilterValue,
  runtimeFiltersForWidget,
} from "../src/components/Dashboard/dashboardExperienceModel.ts";

test("projects dashboard filters only onto widgets with the same source table", () => {
  const filters = [
    { tableId: "table-a", fieldId: "status", operator: "eq", value: "open" },
    { tableId: "table-b", fieldId: "owner", operator: "eq", value: "u1" },
    { tableId: "table-a", fieldId: "amount", operator: "gte", value: 10 },
  ];

  assert.deepEqual(runtimeFiltersForWidget(filters, "table-a"), [
    { fieldId: "status", operator: "eq", value: "open" },
    { fieldId: "amount", operator: "gte", value: 10 },
  ]);
});

test("does not leak a dashboard filter into widgets without a source table", () => {
  assert.deepEqual(
    runtimeFiltersForWidget(
      [{ tableId: "table-a", fieldId: "status", operator: "eq", value: "open" }],
      null,
    ),
    [],
  );
});

test("normalizes numeric filter values without guessing invalid numbers", () => {
  assert.equal(normalizeDashboardFilterValue("number", "gte", "12.5"), 12.5);
  assert.equal(normalizeDashboardFilterValue("number", "gte", "not-a-number"), "not-a-number");
});

test("normalizes in filters to explicit value arrays", () => {
  assert.deepEqual(
    normalizeDashboardFilterValue("text", "in", "alpha, beta, ,gamma"),
    ["alpha", "beta", "gamma"],
  );
});
