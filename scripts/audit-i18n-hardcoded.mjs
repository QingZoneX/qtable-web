import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const EXTENSIONS = new Set([".ts", ".tsx"]);
const ALLOWLIST = new Set([
  "src/lib/i18n.ts",
  "src/lib/i18nRuntime.ts",
  "src/lib/productI18n.ts",
  "src/components/Home/homeI18n.ts",
  "src/components/SmartTable/tableWorkspaceI18n.ts",
]);
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const findings = [];
for (const file of walk(ROOT)) {
  const relative = file.split(path.sep).join("/");
  if (ALLOWLIST.has(relative)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!CJK.test(line)) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("*/")) return;
    findings.push({ file: relative, line: index + 1, text: trimmed });
  });
}

console.log(`[i18n-audit] ${findings.length} lines with CJK outside translation catalogs`);
for (const finding of findings) {
  console.log(`${finding.file}:${finding.line}: ${finding.text}`);
}

fs.mkdirSync(".i18n-audit", { recursive: true });
fs.writeFileSync(".i18n-audit/hardcoded-cjk.json", JSON.stringify(findings, null, 2));
