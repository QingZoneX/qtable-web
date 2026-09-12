import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export function checkedLicense(name, locked, installed, directory, policy) {
  if (installed && installed.version !== locked.version) {
    throw new Error(`${name}: installed version differs from lockfile; run npm ci`);
  }
  const legacy = installed?.licenses?.map(item => item.type).join(" OR ");
  let license = installed?.license ?? legacy ?? locked.license;
  if (!license) {
    const evidence = policy.missingMetadata[`${name}@${locked.version}`];
    if (!evidence || !installed) throw new Error(`${name}: missing license metadata`);
    const digest = createHash("sha256").update(fs.readFileSync(path.join(directory, evidence.file))).digest("hex");
    if (digest !== evidence.sha256) throw new Error(`${name}: license evidence changed`);
    license = evidence.license;
  }
  if (typeof license !== "string" || !policy.allowed.includes(license)) {
    throw new Error(`${name}: license requires review: ${JSON.stringify(license)}`);
  }
  return license;
}
