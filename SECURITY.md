# Security Policy

QTableUI is part of QTable's authentication, permission and AI interaction surface.

## Supported versions

During Alpha, security fixes target the latest `main` and the latest tagged Alpha release.

## Reporting

**Do not create a public Issue containing vulnerability details.**

Use GitHub Private Vulnerability Reporting / **Report a vulnerability** when enabled. If unavailable, contact the QingZoneX repository owners through the GitHub organization profile and request a private channel.

Useful reports include the affected route/component, required permissions, reproduction steps and impact. Remove credentials and personal data from screenshots and logs.

## Frontend-sensitive areas

- OAuth callback/state/PKCE handling;
- token storage and accidental logging;
- public dashboard token flows;
- cross-workspace navigation/state reuse;
- hidden-row data passed into AI;
- direct record writes bypassing audited backend mutations;
- Source Inbox links and external navigation;
- unsafe HTML/Markdown rendering.

## Secrets

Frontend bundles are public to browsers. Provider keys, JWT signing keys, database credentials and encryption keys must never be embedded in Vite variables or source code.

CI scans tracked files and Git history for high-confidence credential patterns.
