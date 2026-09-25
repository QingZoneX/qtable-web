import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { ciDefinitionsHere } from "./ciOwnership.mjs";

const ciOwned = ciDefinitionsHere();

const fail = (message) => {
  console.error("[open-source-readiness] " + message);
  process.exit(1);
};
const required = [
  "LICENSE", "NOTICE", "README.md", "CONTRIBUTING.md", "SECURITY.md",
  "CHANGELOG.md", "VERSION", ".env.example", "Dockerfile",
  "docs/releases/v0.1.2-alpha.md",
  "scripts/check-secrets.mjs", "scripts/check-open-source-readiness.mjs",
];
// The CI definitions belong to the public repository; the private development
// checkout only keeps a pointer there, so the workflow cannot be required.
if (ciOwned) required.push(".github/workflows/docker-publish.yml");
const tracked = new Set(execFileSync("git", ["ls-files", "-z"]).toString("utf8").split("\0").filter(Boolean));
for (const path of required) if (!tracked.has(path)) fail("missing public file: " + path);

const version = fs.readFileSync("VERSION", "utf8").trim();
if (version !== "0.1.2-alpha") fail("VERSION must be 0.1.2-alpha");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
if (pkg.version !== version) fail("package.json version does not match VERSION");
if (lock.version !== version || lock.packages?.[""]?.version !== version) fail("package-lock root version does not match VERSION");

const license = fs.readFileSync("LICENSE", "utf8");
if (!license.includes("Apache License") || !license.includes("Version 2.0")) fail("LICENSE is not Apache-2.0");

const localMarkers = [
  "/" + "Users" + "/",
  "\\" + "Users" + "\\",
  "gitee" + "/QSpace",
];
for (const path of tracked) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const forbidden of localMarkers) {
    if (text.includes(forbidden)) fail(path + " contains internal/local marker " + forbidden);
  }
}

const dockerfile = fs.readFileSync("Dockerfile", "utf8");
for (const token of [
  'org.opencontainers.image.source="https://github.com/QingZoneX/qtable-web"',
  'org.opencontainers.image.licenses="Apache-2.0"',
  'org.opencontainers.image.version="${QTABLE_UI_VERSION}"',
  'org.opencontainers.image.revision="${QTABLE_UI_REVISION}"',
  "COPY LICENSE NOTICE /usr/share/licenses/qtable-ui/",
  "HEALTHCHECK --interval=30s",
  '${PORT}/healthz',
]) {
  if (!dockerfile.includes(token)) fail("Dockerfile missing release-image contract token: " + token);
}

if (ciOwned) {
  const publish = fs.readFileSync(".github/workflows/docker-publish.yml", "utf8");
  for (const token of [
    "docker/login-action@v4",
    "docker/setup-qemu-action@v4",
    "docker/setup-buildx-action@v4",
    "docker/metadata-action@v6",
    "docker/build-push-action@v7",
    "severity: 'CRITICAL,HIGH'",
    "exit-code: '1'",
    "vuln-type: 'os,library'",
    "platforms: linux/amd64,linux/arm64",
    "provenance: mode=max",
    "sbom: true",
    "DOCKERHUB_TOKEN",
    "DOCKERHUB_NAMESPACE || 'qingzonex'",
    "latest=false",
    "!contains(steps.identity.outputs.version, '-')",
    'tag_version="${GITHUB_REF_NAME#v}"',
    "QTABLE_UI_REVISION=${{ github.sha }}",
  ]) {
    if (!publish.includes(token)) fail("Docker publish workflow missing release contract token: " + token);
  }
  if (!/aquasecurity\/trivy-action@v\d+\.\d+\.\d+/.test(publish)) {
    fail("Docker publish workflow missing a pinned aquasecurity/trivy-action release");
  }
}

const readme = fs.readFileSync("README.md", "utf8");
for (const token of [
  version,
  "docker compose up --build -d",
  `qingzonex/qtable-ui:${version}`,
  "SECURITY.md",
  "CONTRIBUTING.md",
]) {
  if (!readme.includes(token)) fail("README missing token: " + token);
}

for (const path of tracked) {
  if (path === ".env" || /\.(pem|key|p12|pfx)$/i.test(path)) fail("sensitive file is tracked: " + path);
}

console.log(
  ciOwned
    ? "[open-source-readiness] OK"
    : "[open-source-readiness] OK; Docker publish workflow assertions skipped (CI definitions live in the public repository)",
);
