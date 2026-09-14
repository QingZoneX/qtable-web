import fs from "node:fs";

const dockerfile = fs.readFileSync("Dockerfile", "utf8");
const workflow = fs.readFileSync(".github/workflows/docker-publish.yml", "utf8");
const docs = fs.readFileSync("docs/docker-hub.md", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const version = fs.readFileSync("VERSION", "utf8").trim();

const assertContains = (text, token, label) => {
  if (!text.includes(token)) {
    throw new Error(`${label} is missing required token: ${token}`);
  }
};

if (pkg.version !== version) {
  throw new Error(`package.json version ${pkg.version} does not match VERSION ${version}`);
}
if (lock.version !== version || lock.packages?.[""]?.version !== version) {
  throw new Error("package-lock root version does not match VERSION");
}

for (const token of [
  'org.opencontainers.image.source="https://github.com/QingZoneX/qtable-web"',
  'org.opencontainers.image.licenses="Apache-2.0"',
  'org.opencontainers.image.version="${QTABLE_UI_VERSION}"',
  'org.opencontainers.image.revision="${QTABLE_UI_REVISION}"',
  "/usr/share/licenses/qtable-ui/",
  "HEALTHCHECK",
  "/healthz",
  "QTABLE_UI_CREATED",
]) {
  assertContains(dockerfile, token, "Dockerfile");
}

for (const token of [
  "linux/amd64,linux/arm64",
  "docker/setup-qemu-action@v4",
  "docker/setup-buildx-action@v4",
  "docker/login-action@v4",
  "docker/metadata-action@v6",
  "docker/build-push-action@v7",
  "aquasecurity/trivy-action@v0.35.0",
  "severity: 'CRITICAL,HIGH'",
  "exit-code: '1'",
  "vuln-type: 'os,library'",
  "DOCKERHUB_USERNAME",
  "DOCKERHUB_TOKEN",
  "DOCKERHUB_PUBLISH_ENABLED",
  "latest=false",
  "provenance: mode=max",
  "sbom: true",
  'tag_version="${GITHUB_REF_NAME#v}"',
  "package-lock.json",
  "QTABLE_UI_CREATED=${{ steps.identity.outputs.created }}",
]) {
  assertContains(workflow, token, "Docker Hub workflow");
}

for (const token of [
  "qingzonex/qtable-ui",
  "docker-compose.registry.yml",
  "linux/amd64",
  "linux/arm64",
  "SBOM",
  "provenance",
  "QTABLE_HOST",
  "QTABLE_PORT",
  "DOCKERHUB_PUBLISH_ENABLED",
  ".github/workflows/docker-publish.yml",
]) {
  assertContains(docs, token, "Docker Hub documentation");
}

console.log("[container-distribution] QTableUI Docker Hub distribution contract verified");
