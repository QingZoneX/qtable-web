import fs from "node:fs";

/**
 * CI definitions (`.github/workflows/*.yml`) and the browser release-gate
 * harness (`e2e/`) are maintained **only in the public repository**
 * (`QingZoneX/qtable-web`) and are deliberately excluded from the
 * private→public sync.
 *
 * The private development checkout therefore carries no workflows at all — it
 * keeps `.github/workflows/README.md` as a pointer, and only frozen reference
 * copies of the harness. Contract checks that assert on those surfaces must
 * skip those assertions there instead of dying on a missing file.
 *
 * In the public repository the workflow files are present, so every assertion
 * stays enforced; the skip can never mask a missing workflow in CI.
 */
export const ciDefinitionsHere = () =>
  fs.existsSync(".github/workflows") &&
  fs.readdirSync(".github/workflows").some((name) => /\.ya?ml$/i.test(name));
