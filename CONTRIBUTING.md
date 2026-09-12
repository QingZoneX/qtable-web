# Contributing to QTableUI

QTableUI is the frontend companion to QTable.

## Setup

```bash
npm ci
npm run dev
```

Use the QTable backend repository for the API and database services.

## Before a PR

Run:

```bash
node scripts/check-secrets.mjs --history
node scripts/check-open-source-readiness.mjs
npm run check:dependencies
npm run check:licenses
npm run test:license-policy
npm run test:xlsx-export
npm run build
```

CI runs the complete frontend contract suite in addition to the production build.

## Product invariants

- Never bypass backend authorization with UI-only checks.
- Never fetch all records merely to implement filtering, AI, dashboards or member selection.
- AI write UX must keep explicit preview/confirmation boundaries.
- Member field options must represent current Workspace members; do not persist a static member-option snapshot.
- Source Inbox conversion must use its atomic backend mutation.
- Keep existing table, view and dashboard models editable after AI generation.
- Preserve error, loading and empty states for user-facing flows.

## Pull requests

Prefer one coherent commit for an independently reviewable feature. Fix CI failures in that commit before merge when practical.

A PR should have:

- focused product behavior;
- TypeScript-safe types;
- regression/contract coverage for important boundaries;
- successful production build;
- no unresolved review threads;
- branch behind `main` = 0.

## Security

Do not report vulnerabilities in a public Issue. Follow [SECURITY.md](SECURITY.md).

## License of contributions

Contributions are accepted under Apache License 2.0.

Dependency changes must follow [the dependency policy](docs/dependency-policy.md).
