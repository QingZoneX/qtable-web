# QTable Web

> React frontend for [QTable](https://github.com/QingZoneX/qtable-server), an AI-native open-source project and work management system.

**Status:** public open-source Alpha (`0.1.2-alpha`). The repository is public and ready for evaluation and contribution; the first verified release tag and release artifacts remain gated by CI and release verification.

QTable Web provides the interactive multidimensional-table experience for QTable: Grid, Kanban, Gantt, Calendar, Gallery, dashboards, collaboration and AI planning workflows.

- Backend: [QingZoneX/qtable-server](https://github.com/QingZoneX/qtable-server)
- Web frontend: [QingZoneX/qtable-web](https://github.com/QingZoneX/qtable-web)
- Project portal and documentation: [QingZoneX.github.io](https://qingzonex.github.io/)

![QTable Grid](design/grid.png)

![QTable Kanban](design/kanban.png)

## Stack

- React 19
- TypeScript 7
- Vite / Rolldown
- Ant Design 6
- VTable / VTable Gantt
- Apollo Client
- Zustand
- VChart
- react-grid-layout

## Local development

Requirements:

- Node.js 22
- a running QTable API on port 9000

```bash
git clone https://github.com/QingZoneX/qtable-web.git
cd qtable-web
npm ci
npm run dev
```

The development server listens on <http://localhost:9100> and proxies API / GraphQL / WebSocket / OAuth traffic to <http://localhost:9000>.

No real credential belongs in frontend environment variables. npm and `package-lock.json` are the supported reproducible install path.

## Full self-hosted stack

The canonical one-command stack is maintained in the backend repository. Clone both repositories as siblings:

```text
qingzone/
├── qtable-server/
└── qtable-web/
```

Then:

```bash
cd qtable-server
cp .env.example .env
docker compose up --build -d
```

Open <http://localhost:9100>.

The canonical Compose stack keeps PostgreSQL, Redis, MinIO and the QTable API loopback-only on the host by default; the web frontend is the intended user-facing entry point.

## Docker image

Release workflows are prepared for:

```text
qingzonex/qtable-ui:0.1.2-alpha
```

Treat an image as an official release artifact only after its verified release tag has passed the release gates. Prerelease tags deliberately do not receive `latest`.

Run a published image against an existing QTable API with:

```bash
docker run --rm -p 9100:9100 \
  -e QTABLE_HOST=host.docker.internal \
  -e QTABLE_PORT=9000 \
  qingzonex/qtable-ui:0.1.2-alpha
```

The image is designed for `linux/amd64` and `linux/arm64`, carries OCI source/version/revision/license metadata, includes the Apache-2.0 `LICENSE` and `NOTICE`, exposes `/healthz`, and is published with BuildKit SBOM and provenance attestations when a verified release is produced.

## Docker development

Build the UI image from source:

```bash
docker build -t qtable-ui .
docker run --rm -p 9100:9100 \
  -e QTABLE_HOST=host.docker.internal \
  -e QTABLE_PORT=9000 \
  qtable-ui
```

Builds use official Node/Nginx images and npm registry defaults. Package versions and integrity hashes stay pinned in `package-lock.json`. Regional mirrors are explicit overrides rather than repository defaults.

Runtime variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `9100` | Nginx listen port |
| `QTABLE_HOST` | `qtable` | backend host |
| `QTABLE_PORT` | `9000` | backend port |

`/healthz` is available as a container health endpoint.

On a Linux Docker host, run the same container smoke test used by CI:

```bash
python3 scripts/check-docker-runtime.py qtable-ui
```

It checks default/custom listen ports, SPA deep links, missing static assets, REST/GraphQL/Auth/OAuth proxying, header/body forwarding, production security headers and frontend liveness when the backend stops.

## Production browser security headers

The canonical Nginx container sets browser security headers so a plain self-host does not depend on a particular gateway implementation:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- clickjacking protection through CSP `frame-ancestors 'none'` plus `X-Frame-Options: DENY`;
- a restrictive `Permissions-Policy`;
- a Content Security Policy scoped to the origins required by the current runtime.

`script-src` deliberately does **not** allow `unsafe-inline` or `unsafe-eval`. An outer reverse proxy or ingress still owns transport-layer concerns such as TLS certificate management, HTTP-to-HTTPS redirects and HSTS.

## Product safety invariants

Frontend changes must preserve the backend security model:

- do not load hidden rows to implement client-side AI or analytics;
- do not bypass **Preview → Confirm → Apply** flows;
- do not write records directly when an atomic audited mutation exists;
- Workspace Member candidates must come from the current workspace;
- public dashboard pages must use public-token-safe APIs;
- large-table paths should preserve server paging / aggregation rather than downloading the entire table.

## Quality gates

```bash
node scripts/check-secrets.mjs --history
node scripts/check-open-source-readiness.mjs
npm run check:dependencies
npm run check:licenses
npm run test:license-policy
npm run test:xlsx-export
npm run build
```

Frontend CI also runs contract checks for authentication, search, AI workflows, member fields, source intake and other product invariants. CI publishes dependency-audit, license-inventory and CycloneDX SBOM artifacts for the tested commit.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the [dependency policy](docs/dependency-policy.md).

## Rainbond

The existing Dockerfile and `rainbondfile` remain supported. Configure the backend component port alias as `QTABLE`, establish the web → backend dependency, and expose UI port 9100 through the gateway.

## Release status

QTable Web is now developed in public under the QingZoneX organization. `0.1.2-alpha` remains a prerelease line: public repository visibility does not by itself make a commit, Docker image or tag an official release artifact.

A release becomes official only when the exact server and web revisions pass their CI and full-stack release gates and the corresponding verified tag/release is published. Draft release notes remain under [`docs/releases/`](docs/releases/).

## License

Apache License 2.0. See [LICENSE](LICENSE).
