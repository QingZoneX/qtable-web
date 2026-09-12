import fs from "node:fs";
import { execFileSync } from "node:child_process";

const history = process.argv.includes("--history");
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["OpenAI/compatible API key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Slack token", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/],
];
const sensitiveNames = new Set([".env", "id_rsa", "id_ed25519"]);
const sensitiveSuffixes = [".pem", ".key", ".p12", ".pfx"];
const findings = [];

const tracked = execFileSync("git", ["ls-files", "-z"]).toString("utf8").split("\0").filter(Boolean);
for (const path of tracked) {
  const name = path.split("/").at(-1);
  if (sensitiveNames.has(name) || sensitiveSuffixes.some((suffix) => path.toLowerCase().endsWith(suffix))) {
    findings.push(path + ": sensitive filename must not be tracked");
    continue;
  }
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const [label, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) findings.push(path + ": " + label + " (" + match[0].slice(0, 8) + "…)");
  }
}

if (history) {
  const log = execFileSync(
    "git",
    ["log", "--all", "-p", "--no-ext-diff", "--text", "--format=commit:%H"],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
  let commit = "unknown";
  for (const line of log.split("\n")) {
    if (line.startsWith("commit:")) {
      commit = line.slice(7);
      continue;
    }
    for (const [label, pattern] of patterns) {
      const match = line.match(pattern);
      if (match) findings.push("history " + commit.slice(0, 12) + ": " + label + " (" + match[0].slice(0, 8) + "…)");
    }
    if (findings.length >= 50) break;
  }
}

if (findings.length) {
  console.error("[secret-scan] BLOCKED");
  for (const finding of findings) console.error(" - " + finding);
  process.exit(1);
}

console.log("[secret-scan] OK: no high-confidence credentials found in " + (history ? "tracked files + Git history" : "tracked files"));
