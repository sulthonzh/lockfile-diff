'use strict';

/**
 * lockfile-diff — parse and diff npm lockfiles.
 * Supports package-lock.json (v2/v3), yarn.lock, and pnpm-lock.yaml (basic).
 * Zero dependencies.
 */

// ── Parsers ─────────────────────────────────────────────

/**
 * Parse package-lock.json (v1, v2, v3) into a flat map of packages.
 * Returns: Map<string, { version: string, resolved?: string }>
 */
function parsePackageLock(content) {
  const lock = JSON.parse(content);
  const pkgs = new Map();

  // v2/v3 — use the `packages` field
  if (lock.packages && typeof lock.packages === 'object') {
    for (const [pkgPath, info] of Object.entries(lock.packages)) {
      // skip the root project
      if (pkgPath === '' || !info || !info.version) continue;
      // extract package name from path (handles scoped, nested)
      const name = extractPkgName(pkgPath);
      if (!name) continue;
      // only keep first occurrence per name
      if (!pkgs.has(name)) {
        pkgs.set(name, { version: info.version });
      }
    }
    return pkgs;
  }

  // v1 — use the `dependencies` field
  if (lock.dependencies && typeof lock.dependencies === 'object') {
    const walk = (deps, prefix = '') => {
      for (const [name, info] of Object.entries(deps)) {
        if (info && info.version) {
          if (!pkgs.has(name)) {
            pkgs.set(name, { version: info.version });
          }
        }
        if (info && info.dependencies) {
          walk(info.dependencies);
        }
      }
    };
    walk(lock.dependencies);
    return pkgs;
  }

  throw new Error('Unrecognized package-lock.json format');
}

/**
 * Parse yarn.lock (v1 berry format) into a flat map.
 */
function parseYarnLock(content) {
  const pkgs = new Map();
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // A key line starts at column 0 and ends with ":"
    if (line && !line.startsWith(' ') && !line.startsWith('#') && line.trimEnd().endsWith(':')) {
      // Extract the key — may contain multiple ranges separated by ", "
      let key = line.trimEnd().slice(0, -1);
      // Strip surrounding quotes (yarn quotes entries with special chars)
      key = key.replace(/^"(.+)"$/, '$1');
      // Extract package name from the key
      // Format: "pkg-name@range" or "@scope/pkg@range" or multiple joined by ", "
      const firstEntry = key.split(', ')[0];
      const name = extractYarnPkgName(firstEntry);

      // Look ahead for version
      let version = null;
      let j = i + 1;
      while (j < lines.length && (lines[j].startsWith(' ') || lines[j].startsWith('\t') || lines[j] === '')) {
        const trimmed = lines[j].trim();
        const match = trimmed.match(/^version\s+"(.+)"$/);
        if (match) {
          version = match[1];
          break;
        }
        if (trimmed === '') break;
        j++;
      }

      if (name && version && !pkgs.has(name)) {
        pkgs.set(name, { version });
      }
    }
    i++;
  }

  return pkgs;
}

/**
 * Parse pnpm-lock.yaml (v9 field-based format, basic support).
 */
function parsePnpmLock(content) {
  const pkgs = new Map();
  const inPackagesSection = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Detect start of `packages:` section
    if (/^packages:\s*$/.test(line)) {
      inPackagesSection.push(true);
      continue;
    }
    // New top-level key ends packages section
    if (inPackagesSection.length > 0 && /^[a-zA-Z]/.test(line)) {
      inPackagesSection.pop();
      continue;
    }
    if (inPackagesSection.length === 0) continue;

    // Match: /pkg-name@version, /@scope/pkg-name@version, or /@scope/pkg-name@version(peer@dep):
    // Peer dep annotations look like: /@babel/core@7.20.0(react@18.2.0):
    const match = line.match(/^\s+\/(.+?)@([^(@]+)(?:\([^)]*\))?:$/);
    if (match) {
      const name = match[1];
      const version = match[2];
      if (!pkgs.has(name)) {
        pkgs.set(name, { version });
      }
    }
  }

  return pkgs;
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Extract package name from a package-lock.json path.
 * e.g. "node_modules/lodash" → "lodash"
 *      "node_modules/@scope/foo" → "@scope/foo"
 *      "node_modules/a/node_modules/b" → "b"
 */
function extractPkgName(pkgPath) {
  const parts = pkgPath.split('node_modules/');
  const last = parts[parts.length - 1];
  return last || null;
}

/**
 * Extract package name from a yarn.lock key entry.
 * e.g. "lodash@^4.17.0" → "lodash"
 *      "@scope/foo@^1.0.0" → "@scope/foo"
 *      "@scope/foo@npm:^1.0.0" → "@scope/foo"
 */
function extractYarnPkgName(entry) {
  // Handle scoped packages
  if (entry.startsWith('@')) {
    // @scope/pkg@range → @scope/pkg
    const lastAt = entry.lastIndexOf('@');
    if (lastAt > 0) return entry.slice(0, lastAt);
    return entry;
  }
  // pkg@range → pkg
  const atIdx = entry.indexOf('@');
  if (atIdx > 0) return entry.slice(0, atIdx);
  return entry;
}

// ── Diff Engine ─────────────────────────────────────────

/**
 * Compare two lockfile maps.
 * Returns { added, removed, changed, unchanged }
 */
function diffLockfiles(before, after) {
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const [name, info] of after) {
    if (!before.has(name)) {
      added.push({ name, version: info.version });
    } else {
      const beforeInfo = before.get(name);
      if (beforeInfo.version !== info.version) {
        changed.push({
          name,
          before: beforeInfo.version,
          after: info.version,
        });
      } else {
        unchanged.push({ name, version: info.version });
      }
    }
  }

  for (const [name, info] of before) {
    if (!after.has(name)) {
      removed.push({ name, version: info.version });
    }
  }

  // Sort for deterministic output
  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  changed.sort((a, b) => a.name.localeCompare(b.name));
  unchanged.sort((a, b) => a.name.localeCompare(b.name));

  return { added, removed, changed, unchanged };
}

// ── Lockfile Detection ──────────────────────────────────

/**
 * Detect lockfile format from filename or content.
 */
function detectFormat(filename, content = '') {
  if (filename.endsWith('package-lock.json')) return 'npm';
  if (filename.endsWith('yarn.lock')) return 'yarn';
  if (filename.endsWith('yarn berry.lock')) return 'yarn';
  if (filename.endsWith('pnpm-lock.yaml')) return 'pnpm';

  // Try content sniffing
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      if (json.lockfileVersion !== undefined || json.packages !== undefined || json.dependencies !== undefined) {
        return 'npm';
      }
    } catch { /* not JSON */ }
  }
  if (trimmed.includes('yarn lockfile')) return 'yarn';
  // Yarn berry format: starts with __metadata or has yarn-specific key patterns
  if (trimmed.startsWith('__metadata:') || /^__metadata:\s*\n\s*version:\s*/m.test(trimmed)) return 'yarn';
  // Check for yarn lockfile resolution patterns
  if (/^[^\s#].*:$/m.test(trimmed) && /\bresolution:\s*"/m.test(trimmed)) return 'yarn';
  if (trimmed.includes('lockfileVersion:') && trimmed.includes('pnpm')) return 'pnpm';

  return null;
}

/**
 * Parse a lockfile string given its format.
 */
function parseLockfile(content, format) {
  switch (format) {
    case 'npm': return parsePackageLock(content);
    case 'yarn': return parseYarnLock(content);
    case 'pnpm': return parsePnpmLock(content);
    default: throw new Error(`Unknown lockfile format: ${format}`);
  }
}

// ── Semver Comparison ───────────────────────────────────

/**
 * Simple semver diff classification.
 * Returns: 'major' | 'minor' | 'patch' | 'prerelease' | 'unknown'
 */
function classifyVersionChange(before, after) {
  const a = before.split('+')[0].split('-')[0].split('.');
  const b = after.split('+')[0].split('-')[0].split('.');
  if (a.length < 3 || b.length < 3) return 'unknown';

  const majorA = parseInt(a[0], 10);
  const majorB = parseInt(b[0], 10);
  if (majorA !== majorB) return 'major';

  const minorA = parseInt(a[1], 10);
  const minorB = parseInt(b[1], 10);
  if (minorA !== minorB) return 'minor';

  const patchA = parseInt(a[2], 10);
  const patchB = parseInt(b[2], 10);
  if (patchA !== patchB) return 'patch';

  // Same major.minor.patch but might have prerelease differences
  if (before.includes('-') || after.includes('-')) return 'prerelease';
  return 'unknown';
}

// ── Stats ───────────────────────────────────────────────

/**
 * Compute summary stats from a diff result.
 */
function computeStats(diff) {
  const changeTypes = { major: 0, minor: 0, patch: 0, prerelease: 0, unknown: 0 };
  for (const c of diff.changed) {
    const type = classifyVersionChange(c.before, c.after);
    changeTypes[type]++;
  }

  return {
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
    unchanged: diff.unchanged.length,
    total: diff.added.length + diff.removed.length + diff.changed.length + diff.unchanged.length,
    changeTypes,
  };
}

module.exports = {
  parsePackageLock,
  parseYarnLock,
  parsePnpmLock,
  diffLockfiles,
  detectFormat,
  parseLockfile,
  classifyVersionChange,
  computeStats,
  extractPkgName,
  extractYarnPkgName,
};
