import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { createXlsxBuffer } from "../src/lib/xlsxExport.ts";

function readRows(rows) {
  const buffer = createXlsxBuffer(rows);
  assert.ok(buffer instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(buffer).slice(0, 2)], [0x50, 0x4b]);
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  assert.deepEqual(workbook.SheetNames, ["Data"]);
  return workbook.Sheets.Data;
}

test("dashboard export preserves column order, Unicode, numeric/boolean/date types and input", () => {
  const rows = [{ 标题: "项目 Alpha 🎯", 数量: 12.5, 完成: false, 时间: new Date("2026-01-02T00:00:00Z") }];
  const before = structuredClone(rows);
  const sheet = readRows(rows);
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet, { header: 1 })[0], Object.keys(rows[0]));
  assert.equal(sheet.A2.v, rows[0].标题);
  assert.equal(sheet.B2.t, "n");
  assert.equal(sheet.B2.v, 12.5);
  assert.equal(sheet.C2.t, "b");
  assert.equal(sheet.C2.v, false);
  assert.equal(sheet.D2.t, "d");
  // Excel serial dates have no timezone. Preserve the local wall-clock time
  // shown to the user instead of treating the exported value as a UTC instant.
  const local = rows[0].时间;
  assert.equal(sheet.D2.v.getUTCFullYear(), local.getFullYear());
  assert.equal(sheet.D2.v.getUTCMonth(), local.getMonth());
  assert.equal(sheet.D2.v.getUTCDate(), local.getDate());
  assert.equal(sheet.D2.v.getUTCHours(), local.getHours());
  assert.deepEqual(rows, before);
});

test("formula-like user text remains literal spreadsheet strings", () => {
  const rows = ["=1+1", "+SUM(A1)", "-1+1", "@SUM(A1)", "https://example.invalid"].map(value => ({ value }));
  const sheet = readRows(rows);
  rows.forEach(({ value }, index) => {
    const cell = sheet[`A${index + 2}`];
    assert.equal(cell.t, "s");
    assert.equal(cell.v, value);
    assert.equal(cell.f, undefined);
    assert.equal(cell.l, undefined);
  });
});

test("empty datasets and missing values produce readable workbooks", () => {
  assert.deepEqual(XLSX.utils.sheet_to_json(readRows([])), []);
  const sheet = readRows([{ first: "one", second: null }, { first: "two", third: "three" }]);
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet, { header: 1 })[0], ["first", "second", "third"]);
  assert.equal(sheet.A3.v, "two");
  assert.equal(sheet.C3.v, "three");
});
