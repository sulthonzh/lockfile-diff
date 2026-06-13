# lockfile-diff

Diff two npm lockfiles to see exactly what packages were added, removed, or version-bumped between two points in time.

Ever rebased a branch and wondered "what deps changed?" or reviewed a PR and wanted to see the lockfile impact without scrolling through thousands of lines? That's what this is for.

## Install

```bash
npm install -g lockfile-diff
# or just use it directly
npx lockfile-diff old-lock.json new-lock.json
```

## Usage

```bash
# Basic diff
lockfile-diff old-package-lock.json new-package-lock.json

# JSON output (pipe to jq for queries)
lockfile-diff --json old.lock new.lock | jq '.stats'

# Only show specific change types
lockfile-diff old.lock new.lock --filter added --filter changed

# Summary only
lockfile-diff --summary old.lock new.lock

# CI mode — exits non-zero if anything changed
lockfile-diff --ci old.lock new.lock
```

## Supported Formats

| Format | File | Support |
|--------|------|---------|
| npm | `package-lock.json` | v1, v2, v3 |
| yarn | `yarn.lock` | v1 (berry format) |
| pnpm | `pnpm-lock.yaml` | v9 (packages section) |

You can mix formats too — diff a yarn.lock against a package-lock.json if you're migrating.

## Example Output

```
Lockfile Diff
═══════════════════════════════════════

── ADDED (1) ──────────────────────
  + mocha@10.0.0

── REMOVED (1) ───────────────────
  - express@4.17.0

── CHANGED (1) ────────────────────
  ~ lodash: 4.17.20 → 4.17.21  [patch]

═══════════════════════════════════════
Summary: +1  -1  ~1  =0  (total: 2)
```

## JSON Output

```bash
lockfile-diff --json old.lock new.lock
```

```json
{
  "before": { "file": "old.lock", "format": "npm", "packages": 120 },
  "after": { "file": "new.lock", "format": "npm", "packages": 122 },
  "diff": {
    "added": [{ "name": "mocha", "version": "10.0.0" }],
    "removed": [{ "name": "express", "version": "4.17.0" }],
    "changed": [{ "name": "lodash", "before": "4.17.20", "after": "4.17.21" }],
    "unchanged": [...]
  },
  "stats": {
    "added": 1, "removed": 1, "changed": 1, "unchanged": 118,
    "total": 121,
    "changeTypes": { "major": 0, "minor": 0, "patch": 1, "prerelease": 0, "unknown": 0 }
  }
}
```

## Why?

Because `git diff package-lock.json` is unreadable. Lockfiles are machine-generated, massive, and reordered constantly. This tool parses the actual dependency tree and shows you what matters: what got added, what got removed, what version changed.

## Zero Dependencies

No `node_modules` black hole. Pure Node.js, runs anywhere.

## License

MIT
