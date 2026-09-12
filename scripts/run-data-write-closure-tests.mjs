import { spawnSync } from "node:child_process";

for (const args of [
  ["scripts/check-data-write-closure-contract.mjs"],
  [
    "--experimental-strip-types",
    "--test",
    "scripts/test-write-result.mjs",
    "scripts/test-write-verification.mjs",
  ],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
