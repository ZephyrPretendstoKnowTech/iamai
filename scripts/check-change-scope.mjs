// The change-scope lock on the per-step snapshots (A3), run in CI over the
// commits a push or a pull request brings:
//
//   * a commit that edits an implementation-content package
//     (docs/implementation-content/<pkg>/…) may change only that package's
//     snapshot files (docs/qa/step-snapshots/<fixture>/<pkg>.json);
//   * a commit that edits src/ may change snapshot files only when its message
//     says [snapshots];
//   * any other commit may change snapshots freely (a regeneration, a content
//     change).
//
// Exit 1 with the offending files printed, else 0.
//
//   node scripts/check-change-scope.mjs [--range <a>..<b>]     default HEAD^..HEAD
//
// The generated registry (src/content/implementation/registry.generated.json)
// is the packages compiled, not source: a package edit recompiles it, and that
// alone never asks for [snapshots]. Merge commits are skipped; the commits they
// merge are checked one by one. The rules are pure (`violationsOf`) so
// src/testing/changeScope.test.ts can run them over constructed commits.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const SNAPSHOT_PREFIX = 'docs/qa/step-snapshots/'
export const PACKAGE_PREFIX = 'docs/implementation-content/'
export const SOURCE_PREFIX = 'src/'
export const REGISTRY = 'src/content/implementation/registry.generated.json'
export const TAG = '[snapshots]'

/**
 * The snapshot files this commit may not change, each with why.
 * @param {{ sha: string, message: string, files: string[] }} commit
 * @returns {string[]}
 */
export function violationsOf(commit) {
  const snapshots = commit.files.filter((f) => f.startsWith(SNAPSHOT_PREFIX))
  if (snapshots.length === 0) return []
  const source = commit.files.filter((f) => f.startsWith(SOURCE_PREFIX) && f !== REGISTRY)
  const packages = new Set(commit.files.filter((f) => f.startsWith(PACKAGE_PREFIX)).map((f) => f.slice(PACKAGE_PREFIX.length).split('/')).filter((parts) => parts.length > 1).map((parts) => parts[0]))
  const short = commit.sha.slice(0, 7)
  if (source.length > 0) {
    if (commit.message.includes(TAG)) return []
    return snapshots.map((f) => `${short} · ${f} · src/ changed (${source[0]}${source.length > 1 ? ` and ${source.length - 1} more` : ''}) and the message does not say ${TAG}`)
  }
  if (packages.size > 0) {
    const named = [...packages].sort().join(', ')
    return snapshots.filter((f) => !packages.has(stepIdOf(f))).map((f) => `${short} · ${f} · outside the package(s) this commit edits (${named})`)
  }
  return []
}

/** The step id a snapshot file records: docs/qa/step-snapshots/<fixture>/<stepId>.json. */
function stepIdOf(file) {
  const name = file.split('/').at(-1) ?? ''
  return name.endsWith('.json') ? name.slice(0, -'.json'.length) : name
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/**
 * The non-merge commits in a git range, oldest first, each with its message and
 * the files it changed against its first parent.
 * @param {string} range
 * @param {string} [cwd]
 * @returns {{ sha: string, message: string, files: string[] }[]}
 */
export function commitsInRange(range, cwd = process.cwd()) {
  const shas = git(['rev-list', '--reverse', '--no-merges', range], cwd)
  if (shas === '') return []
  return shas.split('\n').map((sha) => ({
    sha,
    message: git(['show', '-s', '--format=%B', sha], cwd),
    files: git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '-m', '--first-parent', sha], cwd).split('\n').filter((f) => f !== ''),
  }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

function main() {
  const args = process.argv.slice(2)
  const at = args.indexOf('--range')
  const range = at >= 0 ? args[at + 1] : 'HEAD^..HEAD'
  if (!range) {
    console.error('usage: node scripts/check-change-scope.mjs [--range <a>..<b>]')
    process.exit(2)
  }
  let commits
  try {
    commits = commitsInRange(range)
  } catch (e) {
    console.error(`change scope: cannot read the range ${range}: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(2)
  }
  const problems = commits.flatMap(violationsOf)
  if (problems.length > 0) {
    console.error(`change scope: ${problems.length} snapshot file(s) changed out of scope over ${range}`)
    for (const p of problems) console.error(`  ${p}`)
    console.error(`a commit that changes src/ and the snapshots says ${TAG}; a package commit changes only its own step's snapshots`)
    process.exit(1)
  }
  console.log(`change scope: ${commits.length} commit(s) over ${range}, OK`)
  process.exit(0)
}
