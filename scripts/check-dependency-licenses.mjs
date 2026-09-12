import fs from "node:fs";
import path from "node:path";
import { checkedLicense } from "./dependency-license-policy.mjs";

const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const policy = JSON.parse(fs.readFileSync(new URL("./dependency-license-policy.json", import.meta.url), "utf8"));
const packages = [];
const errors = [];
for (const [location, locked] of Object.entries(lock.packages)) {
  if (!location) continue;
  const name = locked.name ?? location.split("node_modules/").at(-1);
  try {
    let installed;
    const manifest = path.join(location, "package.json");
    if (fs.existsSync(manifest)) installed = JSON.parse(fs.readFileSync(manifest, "utf8"));
    else if (!locked.optional) throw new Error(`${name}: dependency is not installed; run npm ci`);
    packages.push({
      name, version: locked.version, location,
      license: checkedLicense(name, locked, installed, location, policy),
      dev: Boolean(locked.dev), optional: Boolean(locked.optional),
      installed: Boolean(installed), resolved: locked.resolved, integrity: locked.integrity,
    });
  } catch (error) {
    errors.push(error.message);
  }
}
fs.mkdirSync(".oss-reports", { recursive: true });
fs.writeFileSync(".oss-reports/dependency-licenses.json", JSON.stringify({ packages, errors }, null, 2) + "\n");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`[dependency-licenses] OK: ${packages.length} locked packages; report in .oss-reports/`);
