// Every user-visible wording change between two commits, key by key: the check
// that the roadmap restructure (docs/plans/roadmap-flow/) moved and re-ordered
// steps without losing or rewording what the owner had already reviewed.
//
//   node scripts/content-diff.mjs --base <ref> [--head <ref>] [--json]
//
// Reads docs/design/content.json at both refs and compares every string leaf by
// its key path. "$comment…" keys are notes to the maintainer and are skipped.
// A string that disappeared from one key and appears word for word under
// another is reported once, as moved, so a merge that carries a step's content
// into the step absorbing it reads as a move, not a loss. The implementation
// packages (docs/implementation-content) are listed by file, added, removed or
// changed. With no --head the working tree is read.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const base = opt('--base')
const head = opt('--head')
if (!base) { console.error('usage: node scripts/content-diff.mjs --base <ref> [--head <ref>] [--json]'); process.exit(2) }

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const contentAt = (ref) => JSON.parse(ref ? git('show', `${ref}:docs/design/content.json`) : readFileSync('docs/design/content.json', 'utf8'))

function leaves(node, path = '', out = new Map()) {
  if (typeof node === 'string') { out.set(path, node); return out }
  if (Array.isArray(node)) { node.forEach((v, i) => leaves(v, `${path}[${i}]`, out)); return out }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$comment')) continue
      leaves(v, path ? `${path}.${k}` : k, out)
    }
  }
  return out
}

const before = leaves(contentAt(base))
const after = leaves(contentAt(head))
const removed = [...before].filter(([k]) => !after.has(k))
const added = [...after].filter(([k]) => !before.has(k))
const changed = [...before].filter(([k, v]) => after.has(k) && after.get(k) !== v).map(([k, v]) => [k, v, after.get(k)])

// A removed string that reappears word for word under an added key is a move.
const addedByText = new Map()
for (const [k, v] of added) { if (!addedByText.has(v)) addedByText.set(v, []); addedByText.get(v).push(k) }
const moved = []
const lost = []
for (const [k, v] of removed) {
  const to = addedByText.get(v)
  if (to && to.length > 0) moved.push([k, to.shift(), v])
  else lost.push([k, v])
}
const movedTargets = new Set(moved.map(([, to]) => to))
const newStrings = added.filter(([k]) => !movedTargets.has(k))

const range = head ? `${base}..${head}` : `${base}..working tree`
const files = git('diff', '--name-status', ...(head ? [base, head] : [base]), '--', 'docs/implementation-content')
  .split('\n').filter(Boolean)

if (args.includes('--json')) {
  console.log(JSON.stringify({ range, changed, lost, moved, added: newStrings, implementationFiles: files }, null, 2))
  process.exit(0)
}
const short = (s) => (s.length > 160 ? `${s.slice(0, 157)}…` : s)
console.log(`Content changes, ${range}`)
console.log(`  reworded ${changed.length} · removed ${lost.length} · moved ${moved.length} · new ${newStrings.length} · implementation files ${files.length}\n`)
if (lost.length) { console.log('REMOVED (no word-for-word copy elsewhere):'); for (const [k, v] of lost) console.log(`  - ${k}\n      "${short(v)}"`); console.log() }
if (changed.length) { console.log('REWORDED:'); for (const [k, a, b] of changed) console.log(`  ~ ${k}\n      was: "${short(a)}"\n      now: "${short(b)}"`); console.log() }
if (moved.length) { console.log('MOVED, word for word:'); for (const [from, to] of moved) console.log(`  > ${from}  ->  ${to}`); console.log() }
if (newStrings.length) { console.log('NEW:'); for (const [k, v] of newStrings) console.log(`  + ${k}: "${short(v)}"`); console.log() }
if (files.length) { console.log('IMPLEMENTATION CONTENT FILES:'); for (const f of files) console.log(`  ${f}`) }
