import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshotEntries,
  collectWorkspaceTables,
  formatSnapshotValue,
  isRecyclePermissionError,
  recycleEntryMatchesSearch,
} from "../src/components/RecycleBin/recycleBinModel.ts";

const entry = {
  recycleId: "rcy-1",
  tableId: "table-1",
  recordId: "record-42",
  data: {
    title: "Launch plan",
    owner: { name: "Ada" },
    removedField: ["alpha", "beta"],
    empty: null,
  },
  recordVersion: 3,
};

test("collectWorkspaceTables only returns real table nodes recursively", () => {
  const tables = collectWorkspaceTables({
    id: "root",
    name: "Root",
    type: "folder",
    children: [
      { id: "t1", name: "Alpha", type: "table" },
      {
        id: "folder",
        name: "Nested",
        type: "folder",
        children: [
          { id: "dashboard", name: "Dash", type: "dashboard" },
          { id: "t2", name: "Beta", type: "table" },
        ],
      },
    ],
  });
  assert.deepEqual(tables.map((table) => table.id), ["t1", "t2"]);
});

test("snapshot keeps deleted field data even when current schema no longer contains it", () => {
  const snapshot = buildSnapshotEntries(entry, [
    { id: "title", name: "Title" },
    { id: "owner", name: "Owner" },
  ]);
  assert.deepEqual(snapshot, [
    { fieldId: "title", label: "Title", value: "Launch plan" },
    { fieldId: "owner", label: "Owner", value: "Ada" },
    {
      fieldId: "removedField",
      label: "已删除字段 removedField",
      value: "alpha, beta",
    },
  ]);
});

test("snapshot value formatter handles primitive, arrays and labeled objects", () => {
  assert.equal(formatSnapshotValue(true), "true");
  assert.equal(formatSnapshotValue([1, 2]), "1, 2");
  assert.equal(formatSnapshotValue({ label: "Visible" }), "Visible");
  assert.equal(formatSnapshotValue(null), "");
});

test("search covers record identifiers, field labels and immutable snapshot values", () => {
  const fields = [
    { id: "title", name: "Title" },
    { id: "owner", name: "Owner" },
  ];
  assert.equal(recycleEntryMatchesSearch(entry, fields, "record-42"), true);
  assert.equal(recycleEntryMatchesSearch(entry, fields, "owner"), true);
  assert.equal(recycleEntryMatchesSearch(entry, fields, "ada"), true);
  assert.equal(recycleEntryMatchesSearch(entry, fields, "removedfield"), true);
  assert.equal(recycleEntryMatchesSearch(entry, fields, "missing"), false);
});

test("permission classification catches manage/read denial errors", () => {
  assert.equal(isRecyclePermissionError("Forbidden"), true);
  assert.equal(isRecyclePermissionError("Permission denied: manage required"), true);
  assert.equal(isRecyclePermissionError("network timeout"), false);
});
