# Changelog

## Unreleased

### Planned `0.1.0-alpha` Open Source Preview

The `v0.1.0-alpha` metadata and draft release notes are being prepared, but the frontend release has **not** been published yet. A dated release entry must only be cut after the exact QTable/QTableUI revisions pass their real CI and full-stack release gates and final open-source verification is complete.

### Current release-candidate changes

- Remove the optional native image compression dependency tree; assets are
  preserved without build-time recompression.
- Update vulnerable dependency resolutions, pin patched Lodash/minimist overrides,
  and use the official SheetJS 0.20.3 distribution for dashboard XLSX exports.
- Gate CI on vulnerability and license scans, export regression tests, and publish
  dependency inventories/SBOM evidence. Use one canonical npm lockfile.
- Use official build registries by default, with explicit mirror overrides.
- Verify the production container serves the SPA, proxies API requests and
  remains live when the backend is unavailable.
- Include Grid, Kanban, Gantt, Calendar and Gallery experiences.
- Include Dashboard workbench and public dashboard page.
- Include Workspace-member field editor with single/multiple selection.
- Include AI goal workspace, task planning, workload planning, Project Steward and AI visual design UX.
- Include QNote / Clipper Source Inbox and OAuth2 / PKCE frontend flow.
- Include production Nginx image and Rainbond deployment support.
- Include public-governance files, secret scanning and open-source readiness CI gates.
