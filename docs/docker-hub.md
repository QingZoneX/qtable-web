# Docker Hub distribution

QTableUI is distributed as the public container image `qingzonex/qtable-ui` (subject to final Docker Hub namespace availability).

## Runtime contract

The image serves the built SPA through Nginx and keeps the existing runtime configuration contract:

- `PORT` (default `9100`)
- `QTABLE_HOST` (default `qtable`)
- `QTABLE_PORT` (default `9000`)
- `/healthz` for container liveness

REST, GraphQL, WebSocket, Auth and OAuth paths are proxied to the configured QTable backend, so the recommended public deployment exposes only QTableUI and keeps QTable on the private application network.

## Release tags

For the alpha channel the canonical immutable tags are:

- `0.1.0-alpha` from Git tag `v0.1.0-alpha`
- `sha-<short commit>`
- moving `alpha` channel tag

The workflow deliberately does not publish `latest` during alpha. A tag publish refuses to run unless `VERSION`, `package.json`, the root `package-lock.json` version and the Git tag agree. Stable releases may publish `latest` only when the version has no prerelease suffix.

## GitHub configuration

The canonical workflow is `.github/workflows/docker-publish.yml`.

Configure before publication:

- repository variable `DOCKERHUB_NAMESPACE` (optional; defaults to `qingzonex`);
- repository variable `DOCKERHUB_USERNAME`;
- repository variable `DOCKERHUB_PUBLISH_ENABLED=true` only after the release has been authorized;
- secret `DOCKERHUB_TOKEN` using a dedicated least-privilege Docker Hub access token.

Keep publication disabled during private release preparation. Pull-request and manual `workflow_dispatch` runs are build-only verification paths and do not push. A `v*` tag is allowed to push only when `DOCKERHUB_PUBLISH_ENABLED=true`.

## Image verification and provenance

Release builds target `linux/amd64` and `linux/arm64`, attach OCI source/version/revision/license/build-time metadata, and request BuildKit SBOM + `mode=max` provenance attestations. Apache-2.0 `LICENSE` and `NOTICE` are copied into `/usr/share/licenses/qtable-ui/` in the runtime image.

Before the multi-architecture image is published, the workflow builds the exact revision locally and runs a HIGH/CRITICAL container CVE gate. The separate `QTableUI Container Distribution` workflow also builds the real runtime image, exercises the existing Nginx/proxy smoke suite, and verifies image metadata, the Docker healthcheck, and license payload.

## Pull and run

After an official release is published:

```bash
docker pull qingzonex/qtable-ui:0.1.0-alpha
docker run --rm -p 9100:9100 \
  -e QTABLE_HOST=host.docker.internal \
  -e QTABLE_PORT=9000 \
  qingzonex/qtable-ui:0.1.0-alpha
```

For the complete PostgreSQL + Redis + MinIO + QTable + QTableUI stack, use `docker-compose.registry.yml` from the QTable repository rather than rebuilding either application image locally.

## Restricted build networks

The image build uses the committed npm lockfile and `npm ci`. The npm registry can be overridden with the `NPM_REGISTRY` build argument. Note that SheetJS is intentionally pinned to the upstream tarball URL from `cdn.sheetjs.com`; networks that block that host must provide an approved artifact/cache path rather than silently changing the dependency version.

Official Docker Hub publication remains downstream of the exact-revision QTable/QTableUI release gates. Publishing an image must not be used as a substitute for QTable#170 or the final release verification.
