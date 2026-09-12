import fs from "node:fs";

const required = [
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  "docs/maintainer-governance.md",
];

for (const path of required) {
  if (!fs.existsSync(path)) throw new Error(`[oss-governance] missing required file: ${path}`);
}

const config = fs.readFileSync(".github/ISSUE_TEMPLATE/config.yml", "utf8");
if (!config.includes("blank_issues_enabled: false") || !config.includes("/security"))
  throw new Error("[oss-governance] issue chooser must disable blank issues and route security privately");

const pr = fs.readFileSync(".github/PULL_REQUEST_TEMPLATE.md", "utf8");
for (const token of ["## Validation", "## Security / permissions", "## Data / API / dependencies", "## Release impact"])
  if (!pr.includes(token)) throw new Error(`[oss-governance] PR template missing section: ${token}`);

const owners = fs.readFileSync(".github/CODEOWNERS", "utf8");
for (const token of ["* @boychina", "/src/store/", "/src/components/SmartTable/", "/nginx.conf.template"])
  if (!owners.includes(token)) throw new Error(`[oss-governance] CODEOWNERS missing coverage: ${token}`);

const dependabot = fs.readFileSync(".github/dependabot.yml", "utf8");
for (const ecosystem of ["npm", "github-actions", "docker"])
  if (!dependabot.includes(`package-ecosystem: ${ecosystem}`))
    throw new Error(`[oss-governance] dependabot missing ecosystem: ${ecosystem}`);

const governance = fs.readFileSync("docs/maintainer-governance.md", "utf8");
for (const token of ["direct pushes are disabled", "force-push", "required status checks", "CODEOWNERS", "runner_id=0"])
  if (!governance.includes(token)) throw new Error(`[oss-governance] governance doc missing policy token: ${token}`);

console.log("[oss-governance] OK");
