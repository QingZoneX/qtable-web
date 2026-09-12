import { spawnSync } from "node:child_process";

for (const args of [
  ["scripts/check-grid-row-menu-closure-contract.mjs"],
  [
    "--experimental-strip-types",
    "--test",
    "scripts/test-grid-row-menu-closure.mjs",
  ],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
