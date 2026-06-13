#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  detectFormat,
  parseLockfile,
  diffLockfiles,
  classifyVersionChange,
  computeStats,
} = require('../src/index');

function usage() {
  console.log(`
lockfile-diff — Diff two npm lockfiles to see what changed

Usage:
  lockfile-diff <before> <after> [options]

Options:
  --json              Output as JSON
  --ci               Exit non-zero if any changes found
  --summary          Show only summary stats
  --no-unchanged     Hide unchanged packages (default: hidden)
  --show-unchanged   Show unchanged packages
  --filter <type>    Filter: added, removed, changed, unchanged (repeatable)
  -h, --help         Show help
  -v, --version      Show version

Examples:
  lockfile-diff old-lock.json new-lock.json
  lockfile-diff yarn.lock main/yarn.lock --json
  lockfile-diff --json package-lock.json | jq '.stats'
`);
}

function parseArgs(argv) {
  const opts = {
    positional: [],
    json: false,
    ci: false,
    summary: false,
    showUnchanged: false,
    filters: new Set(),
    help: false,
    version: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '--json': opts.json = true; break;
      case '--ci': opts.ci = true; break;
      case '--summary': opts.summary = true; break;
      case '--show-unchanged': opts.showUnchanged = true; break;
      case '--no-unchanged': opts.showUnchanged = false; break;
      case '--filter': opts.filters.add(argv[++i]); break;
      case '-h': case '--help': opts.help = true; break;
      case '-v': case '--version': opts.version = true; break;
      default:
        if (arg.startsWith('--filter=')) {
          opts.filters.add(arg.slice(9));
        } else {
          opts.positional.push(arg);
        }
    }
    i++;
  }
  return opts;
}

function readLockfile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const format = detectFormat(filepath, content);
  if (!format) {
    throw new Error(`Could not detect lockfile format for: ${filepath}`);
  }
  return { content, format };
}

function formatHuman(diff, stats, opts) {
  const lines = [];

  if (opts.summary) {
    lines.push(`Lockfile Diff Summary`);
    lines.push(`─────────────────────────────────────`);
    lines.push(`  Added:     ${stats.added}`);
    lines.push(`  Removed:   ${stats.removed}`);
    lines.push(`  Changed:   ${stats.changed}`);
    if (stats.changed > 0) {
      const ct = stats.changeTypes;
      const parts = [];
      if (ct.major) parts.push(`${ct.major} major`);
      if (ct.minor) parts.push(`${ct.minor} minor`);
      if (ct.patch) parts.push(`${ct.patch} patch`);
      if (ct.prerelease) parts.push(`${ct.prerelease} prerelease`);
      lines.push(`             (${parts.join(', ')})`);
    }
    lines.push(`  Unchanged: ${stats.unchanged}`);
    lines.push(`  Total:     ${stats.total}`);
    return lines.join('\n');
  }

  lines.push('');
  lines.push('Lockfile Diff');
  lines.push('═══════════════════════════════════════');

  // Added
  if (diff.added.length > 0 && (!opts.filters.size || opts.filters.has('added'))) {
    lines.push('');
    lines.push(`── ADDED (${diff.added.length}) ──────────────────────`);
    for (const p of diff.added) {
      lines.push(`  + ${p.name}@${p.version}`);
    }
  }

  // Removed
  if (diff.removed.length > 0 && (!opts.filters.size || opts.filters.has('removed'))) {
    lines.push('');
    lines.push(`── REMOVED (${diff.removed.length}) ───────────────────`);
    for (const p of diff.removed) {
      lines.push(`  - ${p.name}@${p.version}`);
    }
  }

  // Changed
  if (diff.changed.length > 0 && (!opts.filters.size || opts.filters.has('changed'))) {
    lines.push('');
    lines.push(`── CHANGED (${diff.changed.length}) ──────────────────`);
    for (const p of diff.changed) {
      const type = classifyVersionChange(p.before, p.after);
      lines.push(`  ~ ${p.name}: ${p.before} → ${p.after}  [${type}]`);
    }
  }

  // Unchanged
  if (opts.showUnchanged && (!opts.filters.size || opts.filters.has('unchanged'))) {
    lines.push('');
    lines.push(`── UNCHANGED (${diff.unchanged.length}) ──────────────`);
    for (const p of diff.unchanged) {
      lines.push(`  = ${p.name}@${p.version}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════');
  lines.push(`Summary: +${stats.added}  -${stats.removed}  ~${stats.changed}  =${stats.unchanged}  (total: ${stats.total})`);
  lines.push('');

  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) { usage(); process.exit(0); }
  if (opts.version) { console.log(require('../package.json').version); process.exit(0); }
  if (opts.positional.length < 2) {
    console.error('Error: Need two lockfile paths\n');
    usage();
    process.exit(1);
  }

  try {
    const [beforeFile, afterFile] = opts.positional;
    const before = readLockfile(beforeFile);
    const after = readLockfile(afterFile);

    const beforeMap = parseLockfile(before.content, before.format);
    const afterMap = parseLockfile(after.content, after.format);

    const diff = diffLockfiles(beforeMap, afterMap);
    const stats = computeStats(diff);

    if (opts.json) {
      const output = {
        before: { file: beforeFile, format: before.format, packages: beforeMap.size },
        after: { file: afterFile, format: after.format, packages: afterMap.size },
        diff,
        stats,
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(formatHuman(diff, stats, opts));
    }

    if (opts.ci && (stats.added > 0 || stats.removed > 0 || stats.changed > 0)) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
}

main();
