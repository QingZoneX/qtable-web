import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error(`[global-search-contract] ${message}`);
  process.exit(1);
};

const graphql = read("src/lib/graphql.ts");
const palette = read("src/components/GlobalCommandPalette.tsx");
const paletteI18n = read("src/components/commandPaletteI18n.ts");
const smartTable = read("src/components/SmartTable/index.tsx");

if (!graphql.includes("globalSearch(") || !graphql.includes("GLOBAL_SEARCH")) {
  fail("GLOBAL_SEARCH GraphQL operation is missing");
}
if (!graphql.includes("recordById(") || !graphql.includes("RECORD_BY_ID")) {
  fail("RECORD_BY_ID GraphQL operation is missing");
}
if (!palette.includes("event.metaKey || event.ctrlKey")) {
  fail("Cmd/Ctrl+K global keyboard shortcut is missing");
}
if (!palette.includes("ArrowDown") || !palette.includes("ArrowUp")) {
  fail("keyboard result navigation is missing");
}
for (const token of [
  "nextCursor",
  "const loadMore = useCallback",
  "cursor: nextCursor",
  'commandPaletteT("loadMore")',
]) {
  if (!palette.includes(token)) {
    fail(`server cursor pagination is not wired into the palette: ${token}`);
  }
}
if (!paletteI18n.includes('loadMore: "加载更多"') || !paletteI18n.includes('loadMore: "Load more"')) {
  fail("global-search pagination translations are missing");
}
if (palette.includes("useSmartTableStore") || palette.includes(".records.filter(")) {
  fail("global palette must not search the browser's loaded record window");
}
if (!smartTable.includes("RECORD_BY_ID") || !smartTable.includes('get("recordId")')) {
  fail("record deep links are not wired to exact record lookup");
}

console.log("[global-search-contract] OK");
