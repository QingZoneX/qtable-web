# Maintainer governance

QTableUI uses pull-request based development for public contributions. Repository intake, ownership and dependency-update automation are defined under `.github/`; GitHub branch/ruleset enforcement is enabled when repository visibility/plan permits it.

## CI ownership

CI definitions (`.github/workflows/`) and the browser release-gate harness (`e2e/`) are maintained **only in the public repository** (`QingZoneX/qtable-web`). The private repository keeps no copy of them — only `.github/workflows/README.md`, which points at the public repository and explains how to recover the history — and the private→public sync excludes both paths, so a sync can never overwrite a CI fix that was made in the open.

The backend revision validated by the release gate has a single source of truth: `QTABLE_SERVER_REVISION` at the top of `.github/workflows/full-stack-release-e2e.yml`.

## Repository-environment ownership

A few files intentionally exist on both sides with different content, because the same file carries a different environment or repository identity on each side. They are excluded from the private→public sync:

| Path | Public repository | Private deployment repository |
| --- | --- | --- |
| `Dockerfile` | official `node` / `nginx` / npm registry defaults | reachable regional mirrors as defaults, because Rainbond source builds run `docker build` without any `--build-arg` the console can forward |
| `README.md` | public project introduction | development-repository identity plus restricted-network build notes |
| `docs/docker-hub.md` | official-source build description | regional-mirror defaults, and how the release workflow re-asserts official sources |

Both sides still build through explicit build arguments in the release and distribution workflows, so neither default can leak into a published image. The OCI labels inside `Dockerfile` always point at the public repository — including in the private copy — so a published image can never leak the private URL.

Everything else is owned by the private repository and flows to the public repository on every sync: the contract scripts under `scripts/`, the dependency manifests and the remaining governance documents. A public-side edit to one of those paths is reported as sync drift by the pre-sync guard and must be back-ported to the private repository first.

## Trigger tiers

Heavy gates that need a real browser and a full docker-compose stack run **only when a release tag (`v*`) is pushed** (or on manual dispatch), never on a pull request:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `frontend-ci.yml` | every PR, and every push to any branch | contracts, license/SBOM, secret scan, build, Docker smoke |
| `attachment-browser-contract.yml` | every push to any branch, PR (path-filtered) | attachment lifecycle against a contract backend |
| `service-worker-private-cache.yml` | every push to any branch, PR (path-filtered) | static + model contracts and a real-Chrome private-cache gate |
| `container-distribution.yml` | every push to any branch, PR (path-filtered) | image metadata, license payload, runtime proxy smoke |
| `docker-publish.yml` | tag `v*`, manual dispatch; branch pushes build and scan without publishing | multi-arch publication and CVE gate |
| `full-stack-release-e2e.yml` | tag `v*`, manual dispatch | canonical full stack, two-user release gate, attachment purge |

Branch pushes run the gates without waiting for a pull request; the cost is that opening a PR from a same-repository branch runs the same jobs twice.

## Required public-main protection

The repository is already public. Configure `main` so that:

- direct pushes are disabled; changes land through pull requests;
- force-push and branch deletion are disabled;
- required status checks are limited to jobs that actually run on pull requests — bind the real `Frontend CI` job plus the path-filtered contract jobs. **Do not** add the release gate jobs (`Full-Stack Release E2E`, `Publish QTableUI Docker Hub Image`): they are tag/dispatch-only and never report on a PR, so requiring them would block every pull request indefinitely;
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

Dependabot opens reviewable npm, GitHub Actions and Docker dependency PRs. Automated updates never bypass dependency audit, license/SBOM, browser security, build or Docker runtime gates. Because the full-stack release gate is tag-triggered, a dependency bump receives its heavy end-to-end validation when the next release tag is cut rather than on the bump PR itself.
