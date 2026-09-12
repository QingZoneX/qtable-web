## Summary

Describe what changes and why.

## Validation

- [ ] I ran the relevant contracts/tests/build locally, or documented why an environment-dependent gate could not execute.
- [ ] I did not weaken or skip an existing release/security assertion to make the change pass.
- [ ] New behavior has regression coverage where practical.

## Security / permissions

- [ ] Authentication, workspace/table/row permissions, public sharing, attachments, Service Worker/cache, CSP, AI context/confirm/apply, and audit semantics are unchanged, or the impact is explained below.
- [ ] No credential, token, private business data, personal path, or production secret is included.

## Data / API / dependencies

- [ ] Backend/API/GraphQL compatibility implications are documented, or not applicable.
- [ ] Dependency changes are intentional, reproducible, and include security/license impact, or this PR has no dependency change.

## UI evidence

- [ ] Screenshots/traces are attached for visible UI changes when useful, or not applicable.
- [ ] Responsive/browser impact is documented for UI shell/navigation changes, or not applicable.

## Release impact

Describe any effect on self-hosting, Nginx/runtime behavior, release notes, or `v0.1.0-alpha` readiness.
