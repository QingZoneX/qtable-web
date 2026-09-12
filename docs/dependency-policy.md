# Dependency release policy

Use Node 22, npm and the committed `package-lock.json`. CI uses `npm ci`;
dependency versions, tarball sources and integrity hashes are reviewable in one
lockfile. Do not use `npm audit fix --force` to downgrade VTable or silently
replace product libraries.

## Vulnerabilities

`npm run check:dependencies` fails on any reported vulnerability, including low
severity and development dependencies. Registry/audit failures fail CI too.
There is no vulnerability suppression list. A successful scan is a dated
dependency advisory check, not proof that application code is vulnerability-free.

CI retains the JSON audit response, license inventory and CycloneDX SBOM as
artifacts associated with the tested commit. It must not publish a release based
on an older commit's successful scan.

## Reviewed dependency choices

- The optional `vite-plugin-imagemin` toolchain has been removed, including
  `pngquant-bin` and obsolete archive/execution dependencies. Source images are
  still served; build-time recompression is no longer performed. The previous
  `QTABLE_IMAGE_OPTIMIZATION` variable is no longer needed.
- Dashboard XLSX exports use the official SheetJS Community Edition 0.20.3
  tarball, with integrity pinned in the lockfile. The npm registry's 0.18.5
  release is obsolete. See the [upstream installation instructions](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
- Lodash `4.18.1` overrides VTable's fixed vulnerable `4.17.21` dependency;
  minimist `1.2.8` overrides geojson-flatten's fixed `1.2.0`. Keep these overrides
  until upstream constraints accept patched versions. Review removal against an
  audit and the complete frontend build/contract suite.
- XLSX regression tests read generated workbooks and check data types, local
  wall-clock dates, input immutability, Unicode, empty data and literal
  formula-like text. CI runs them in UTC, Shanghai and New York timezones.

## License metadata gate

`npm run check:licenses` checks every locked package, including optional packages
for other platforms. Required dependencies must be installed and match the
lockfile. Installed package metadata takes precedence over stale lock metadata;
legacy `licenses` metadata is supported. Unknown or unlisted license expressions
fail the build. The reviewed expression list is in
`scripts/dependency-license-policy.json`.

`khroma@2.1.0` omits a package license field, but includes the MIT text in its
`license` file. Its sole metadata exception pins the exact package version and
SHA-256 of that file. A version or license-text change requires fresh review.
Do not add wildcard exceptions or infer a license from a package name.

The inventory is a metadata gate, not a legal certification or substitute for
required attribution/source notices. MPL and attribution-bearing licenses remain
visible in the report. Before public distribution, review actual bundled code,
license texts and notices, including transitive dependencies. No missing-license
or GPL dependency is silently accepted by the current policy.
