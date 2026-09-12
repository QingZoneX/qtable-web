import * as XLSX from "xlsx";

/** Serialize dashboard rows without interpreting user strings as formulas. */
export function createXlsxBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
