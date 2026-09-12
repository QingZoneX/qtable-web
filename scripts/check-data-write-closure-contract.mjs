import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const store = read("src/store/useSmartTableStore.ts");
const app = read("src/App.tsx");
const headerMenu = read("src/components/SmartTable/HeaderMenu.tsx");
const grid = read("src/components/SmartTable/views/GridView.tsx");
const toolbar = read("src/components/SmartTable/controls/Toolbar.tsx");

for (const signature of [
  "addField: (field: Field, index?: number) => Promise<WriteResult<Field>>",
  "Promise<WriteResult<Field>>",
  "deleteField: (fieldId: string) => Promise<WriteResult<boolean>>",
  "Promise<WriteResult<TableRecord>>",
  "deleteRecord: (recordId: string) => Promise<WriteResult<boolean>>",
  "reorderFields: (fields: Field[]) => Promise<WriteResult<boolean>>",
]) {
  assert.ok(store.includes(signature), `missing async write contract: ${signature}`);
}

for (const mutationName of [
  "ADD_FIELD",
  "UPDATE_FIELD",
  "DELETE_FIELD",
  "UPDATE_RECORD",
  "DELETE_RECORD",
  "REORDER_FIELDS",
]) {
  const index = store.indexOf(`mutation: ${mutationName}`);
  assert.ok(index >= 0, `missing mutation ${mutationName}`);
  const window = store.slice(index, index + 1200);
  assert.ok(!window.includes(".catch(() => {})"), `${mutationName} still silently swallows errors`);
}

assert.ok(store.includes("fetchServerMetadata"), "schema writes must verify server state on ambiguous failure");
assert.ok(store.includes("fetchServerRecord"), "record writes must verify server state on ambiguous failure");
assert.ok(store.includes("emitWriteFeedback"), "write failures must be user-visible");
assert.ok(app.includes("<WriteFeedbackHost />"), "authenticated app must mount write feedback host");
assert.ok(headerMenu.includes("await deleteField(fieldId)"), "field delete UI must await server result");
assert.ok(!headerMenu.includes('message.success("列已隐藏")'), "view persistence must not claim success before ack");
assert.ok(toolbar.includes("const result = await addField({"), "toolbar field creation must await server result");
assert.ok(toolbar.includes("if (!result.ok) return;"), "toolbar must stop success feedback on failed field creation");
assert.ok(grid.includes("const result = await addField(newField"), "grid field creation must await server result");
assert.ok(grid.includes("const result = await updateField(fieldEditor.fieldId"), "grid field update must await server result");
assert.ok(grid.includes("const result = await deleteRecordRef.current(recordId)"), "grid record deletion must await server result");

console.log("data write closure contract: OK");
