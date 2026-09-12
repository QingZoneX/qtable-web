# Maintainer governance

QTableUI uses pull-request based development for public contributions. Repository intake, ownership and dependency-update automation are defined under `.github/`; GitHub branch/ruleset enforcement is enabled when repository visibility/plan permits it.

## Required public-main protection

Immediately after the repository becomes public (or an upgraded private plan permits equivalent rules), configure `main` so that:

- direct pushes are disabled; changes land through pull requests;
- force-push and branch deletion are disabled;
- required status checks include the real Frontend CI job from `.github/workflows/frontend-ci.yml` and the release E2E checks only after their exact GitHub check names are confirmed by successful runs;
- at least one approving maintainer review is required for external contributions;
- stale approvals are dismissed when new commits materially change the reviewed diff;
- CODEOWNERS review is required for authentication/state, SmartTable, AppShell, Nginx, workflow and deployment surfaces when supported;
- administrators should follow the same PR/required-check path except for documented emergency recovery.

Do not guess required-check names. First obtain a successful real run on the final visibility/runner setup, then bind the ruleset to the exact names GitHub reports.

## Merge discipline

A PR should be `behind=0`, mergeable and free of unresolved review threads before merge. Infrastructure-only Actions failures with no assigned runner (`runner_id=0`, `steps=[]`) are not green evidence and must not be confused with an executed test failure. Executed test/security failures remain blocking.

## Security reports

Public issues must never contain vulnerability details. `SECURITY.md` is authoritative; the issue chooser redirects reporters to GitHub's private security reporting surface when available.

## Dependency updates

Dependabot opens reviewable npm, GitHub Actions and Docker dependency PRs. Automated updates never bypass dependency audit, license/SBOM, browser security, build, Docker runtime or full-stack release gates.
