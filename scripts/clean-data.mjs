import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const targets = [
  path.join(root, "qtable.db"),
  path.join(root, "app/data/workspace.json"),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
  }
}

const tablesDir = path.join(root, "app/data/tables");
if (fs.existsSync(tablesDir)) {
  for (const file of fs.readdirSync(tablesDir)) {
    if (file.endsWith(".json")) {
      fs.rmSync(path.join(tablesDir, file), { force: true });
    }
  }
}
