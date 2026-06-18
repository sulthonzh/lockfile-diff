# lockfile-diff

Diff two npm lockfiles and see exactly what packages were added, removed, or version-bumped. Supports npm, yarn, and pnpm — and you can mix formats.

Ever rebased a branch and wondered "what deps changed?" or reviewed a PR and wanted to see the lockfile impact without scrolling through thousands of lines? That's what this is for.

## Install

```bash
npm install -g lockfile-diff
# or just use it directly
npx lockfile-diff old-lock.json new-lock.json
```

## Quick Start

```bash
# Diff two package-lock.json files
lockfile-diff old-package-lock.json new-package-lock.json

# JSON output for scripting
lockfile-diff --json old.lock new.lock | jq '.stats'

# CI mode — exits non-zero if anything changed
lockfile-diff --ci old.lock new.lock
```

## Real-World Examples

### 1. PR Review Gate — Block Risky Dep Bumps

Add to your CI pipeline to catch major version bumps in pull requests:

```bash
# In your CI, after checkout
git fetch origin main
git diff origin/main..HEAD -- package-lock.json > /tmp/old-lock.json 2>/dev/null || true
# If lockfile changed, check for major bumps
lockfile-diff --json /tmp/old-lock.json package-lock.json | \
  jq -e '.stats.changeTypes.major > 0' && \
  echo "⚠️  Major version bump detected — please review" && exit 1
```

This catches when a transitive dep silently jumps a major version (e.g., `express@4` → `express@5`), which could break production.

### 2. Migration Audit — yarn → npm

When migrating from yarn to npm (or vice versa), verify no deps were lost:

```bash
# Mix formats — diff yarn.lock against the new package-lock.json
lockfile-diff yarn.lock package-lock.json --filter removed
```

This shows any packages that existed in yarn but disappeared after switching to npm, ensuring no transitive dependencies were accidentally dropped.

### 3. Release Changelog — What Changed Since Last Release

Generate a dependency changelog between two git tags:

```bash
#!/bin/bash
# deps-changelog.sh — run before publishing
OLD=$(git show v1.2.0:package-lock.json 2>/dev/null)
NEW=$(cat package-lock.json)
echo "$OLD" > /tmp/old.json
echo "$NEW" > /tmp/new.json
lockfile-diff --summary /tmp/old.json /tmp/new.json
echo ""
echo "Full diff:"
lockfile-diff /tmp/old.json /tmp/new.json --filter added --filter changed
```

Output:
```
Lockfile Diff Summary
─────────────────────────────────────
  Added:     3
  Removed:   1
  Changed:   7  (2 major, 3 minor, 2 patch)
  Unchanged: 142
  Total:     153
```

## Supported Formats

| Format | File | Support |
|--------|------|---------|
| npm | `package-lock.json` | v1, v2, v3 |
| yarn | `yarn.lock` | v1, Berry |
| pnpm | `pnpm-lock.yaml` | v9 (packages section, including peer dep annotations) |

You can mix formats too — diff a `yarn.lock` against a `package-lock.json` if you're migrating.

## CLI Options

```
Usage:
  lockfile-diff <before> <after> [options]

Options:
  --json              Output as JSON
  --ci                Exit non-zero if any changes found
  --summary           Show only summary stats
  --no-unchanged      Hide unchanged packages (default: hidden)
  --show-unchanged    Show unchanged packages
  --filter <type>     Filter: added, removed, changed, unchanged (repeatable)
  -h, --help          Show help
  -v, --version       Show version
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

## Comparison

| Feature | `lockfile-diff` | `git diff` | `npm ls` | `lockfile-lint` |
|---------|:---:|:---:|:---:|:---:|
| Multi-format (npm/yarn/pnpm) | ✅ | ❌ | npm only | npm only |
| Cross-format diff (yarn→npm) | ✅ | ❌ | ❌ | ❌ |
| Semver change classification | ✅ | ❌ | ❌ | ❌ |
| JSON output | ✅ | ✅ | ❌ | ✅ |
| CI exit codes | ✅ | ✅ | ❌ | ✅ |
| Zero dependencies | ✅ | — | ❌ | ❌ |
| Human-readable summary | ✅ | ❌ | ❌ | ❌ |

## Why?

Because `git diff package-lock.json` is unreadable. Lockfiles are machine-generated, massive, and reordered constantly. This tool parses the actual dependency tree and shows you what matters: what got added, what got removed, what version changed.

## Zero Dependencies

No `node_modules` black hole. Pure Node.js, runs anywhere.

## License

MIT
