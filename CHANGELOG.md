# Changelog

## v1.1.0 — 2026-06-19

### Fixed
- **pnpm peer dep annotations not parsed** — entries like `/@babel/core@7.20.0(react@18.2.0):` failed to parse correctly. Updated regex to strip peer dep suffixes.
- **CLI `--filter` crash on trailing flag** — `--filter` as the last argument read `undefined`. Now guards against missing value.
- **Yarn Berry detection weak** — content sniffing only looked for "yarn lockfile" v1 string. Added detection for `__metadata:` header and resolution patterns used by Berry.

### Added
- `exports` field in package.json for clean ESM/CJS interop.
- `prepublishOnly` script to run tests before publish.
- 15 new tests (46 → 61 total): pnpm peer deps, scoped peer deps, version edge cases, empty inputs, deeply nested v1 deps, build metadata stripping, format detection edge cases.

## v1.0.0 — 2026-06-13

### Initial Release
- Parse npm `package-lock.json` (v1, v2, v3), `yarn.lock` (v1/Berry), `pnpm-lock.yaml` (v9).
- Diff engine: added, removed, changed, unchanged classification.
- Semver change classification: major, minor, patch, prerelease, unknown.
- CLI with `--json`, `--ci`, `--summary`, `--filter`, `--show-unchanged` options.
- Mix formats — diff a yarn.lock against a package-lock.json.
- Zero dependencies. Node 14+.
