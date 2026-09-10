// Step 7 — the final MFA Readiness reference, over the one readiness derivation.
//
// Two questions, answered separately because they have different authorities.
//
//   Does production have the SHAPE the owner approved? Every structural
//   assertion is two-sided: it reads
//   `docs/design/approved/reference/iamai-mfa-readiness-final.html` at test time
//   and fails if the reference stops drawing what production claims to draw, and
//   it reads production and fails if production stops drawing it.
//
//   Does the surface consume the truth rather than reach its own? Every cell is
//   scoring/phishingResistant.ts through derive/mfaReadiness.ts and
//   surfaces/readinessCells.ts; no view-local method reading, proof, rung or
//   count; and a filter only decides which rows are on screen.
//
// What this file does not re-prove, because one authority already owns it: the
// readiness cases (src/scoring/phishingResistant.test.ts); the anatomy packs'
// hashes (src/ui/design-authority.test.ts); tokens and AA (src/ui/tokens.test.ts);
// focus and forced colours (src/ui/accessibility.test.ts); the demo's isolation
// (src/ui/demo.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { DEFAULT_SHOW, SHOW_KEYS, SUMMARY_STATES, readinessView, shows } from '../../derive/mfaReadiness.ts'
import type { ShowKey } from '../../derive/mfaReadiness.ts'
import { readinessTable } from './inventoryTables.ts'
import { readinessWord, roleWord, showWord } from './readinessCells.ts'
import { pages } from '../../content/content.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const REFERENCE = 'docs/design/approved/reference/iamai-mfa-readiness-final.html'
const SURFACE = read('src/ui/surfaces/MfaReadiness.tsx')
const CELLS = read('src/ui/surfaces/readinessCells.ts')
const TABLE = read('src/ui/components/DataTable.tsx')
const CSS = read('src/ui/app.css')
const W = pages.readiness as unknown as {
  columns: string[]
  states: Record<string, { title: string; stat?: string }>
  show: Record<string, string>
  strip: Record<string, string>
  detail: Record<string, string>
}

// ------------------------------------------------------- the authority itself

test('the reference this file reads is the one the manifest records, byte for byte', () => {
  const manifest = JSON.parse(read('docs/design/approved/reference/REFERENCE-MANIFEST.json')) as { files: Record<string, string>; mfaReadiness: { file: string; sha256: string; supersedes: string[] } }
  const got = createHash('sha256').update(readFileSync(REFERENCE)).digest('hex')
  assert.equal(manifest.mfaReadiness.file, 'iamai-mfa-readiness-final.html')
  assert.equal(manifest.mfaReadiness.sha256, got, 'the final MFA Readiness reference changed')
  assert.equal(manifest.files[manifest.mfaReadiness.file], got)
  assert.ok(manifest.mfaReadiness.supersedes.some((s) => s.includes('mfa-readiness-v2.html')), 'the manifest does not record what the reference supersedes')
})

// ------------------------------------------------------------- the anatomy

test('the summary is one panel: the answer and three counts that are filters, on both sides', () => {
  const ref = read(REFERENCE)
  assert.match(ref, /\.summary\{[^}]*grid-template-columns:minmax\(0,1\.8fr\) repeat\(3,minmax\(135px,\.65fr\)\)/, 'the reference no longer draws one summary grid')
  assert.match(ref, /\.summary\{[^}]*overflow:hidden/)
  assert.deepEqual([...ref.matchAll(/data-summary-filter="([a-z]+)"/g)].map((m) => m[1]), ['prove', 'setup', 'unknown'], "the reference's three counts changed")
  assert.deepEqual([...ref.matchAll(/<div class="k">([^<]+)<\/div>/g)].map((m) => m[1]), SUMMARY_STATES.map((s) => W.states[s].stat), 'the three counts are not the reference\'s three')

  assert.match(SURFACE, /<section className="readiness-summary panel"/, 'the summary is not one panel')
  assert.match(SURFACE, /<div className="summary-main">/)
  assert.match(SURFACE, /SUMMARY_STATES\.map\(\(s\) => \([\s\S]{0,120}<button key=\{s\} type="button" className="summary-stat" aria-pressed=\{show === s\}/, 'a count is not a filter button')
  const rule = CSS.match(/\.readiness-summary \{[^}]*\}/)?.[0] ?? ''
  assert.match(rule, /grid-template-columns: minmax\(0, 1\.8fr\) repeat\(3, minmax\(135px, 0\.65fr\)\)/, "production's summary is not the reference's grid")
  assert.match(rule, /overflow: hidden/)
  assert.doesNotMatch(SURFACE, /group-tile|group-counts|RungBadge|rung-badge/, 'a count card or a rung badge came back')
})

test('one strip does two jobs — the Plan gate and the passkey rollout — on both sides', () => {
  const ref = read(REFERENCE)
  assert.equal((ref.match(/<div class="progress-item">/g) ?? []).length, 2)
  assert.match(ref, /<strong>Plan gate<\/strong>/)
  assert.match(ref, /<strong>Passkey rollout<\/strong>/)
  assert.match(ref, /\.progress-strip\{[^}]*grid-template-columns:1fr 1fr/)

  assert.match(SURFACE, /<section className="progress-strip"/)
  assert.equal((SURFACE.match(/<div className="progress-item">/g) ?? []).length, 2)
  assert.equal(W.strip.gate, 'Plan gate')
  assert.equal(W.strip.rollout, 'Passkey rollout')
  // The gate strip is the Plan's own measurement, never a count of its own.
  assert.match(SURFACE, /readinessFor\('mfa-all-users', \[\.\.\.view\.ladder\.viability\.keys\(\)\], \[\.\.\.view\.ladder\.viability\.values\(\)\], snapshot\)/, 'the gate strip does not read the Plan\'s gate')
  assert.match(SURFACE, /readyNeeded\(facts\.active, READINESS_THRESHOLD_MFA_PERCENT\)/)
  assert.match(CSS, /\.progress-strip \{[^}]*grid-template-columns: 1fr 1fr/)
})

test('the toolbar is a search and the reference\'s five filters, Needs action first and on by default', () => {
  const ref = read(REFERENCE)
  const filters = [...ref.matchAll(/<button class="filter[^"]*" data-filter="[a-z]+">([^<]+)<\/button>/g)].map((m) => m[1])
  assert.deepEqual(filters, ['Needs action', 'Admins', 'No passkey', 'Ready', 'All'])
  assert.match(ref, /let activeFilter="attention"/, 'the reference no longer opens on Needs action')
  assert.deepEqual(SHOW_KEYS.map((k) => showWord(k)), filters, 'the toolbar is not the reference\'s five filters')
  assert.equal(DEFAULT_SHOW, 'needsAction')
  assert.match(SURFACE, /<input type="search" placeholder=\{T\.search\} aria-label=\{T\.search\}/)
  assert.match(SURFACE, /\{pills\.map\(\(k\) => \([\s\S]{0,200}aria-pressed=\{show === k\} onClick=\{\(\) => select\(k\)\}/, 'the pills are not controls over the one filter')
  assert.doesNotMatch(SURFACE, /<select/)
  // Pressed is a check mark as well as the accent (task 017).
  assert.match(CSS, /\.surface \.toolbar \.btn\[aria-pressed='true'\]::before \{[^}]*content:/)
})

test('the worklist has the reference\'s six zones in its order, with separate Methods and Proof columns', () => {
  const ref = read(REFERENCE)
  const heads = ref.match(/<div class="table-head">([\s\S]*?)<\/div>\s*\n\s*<div class="row"/)?.[1] ?? ''
  const zones = [...heads.matchAll(/<div>([^<]+)<\/div>/g)].map((m) => m[1])
  assert.deepEqual(zones, ['Person', 'Role', 'Methods', 'Proof', 'Readiness', 'Action'])
  assert.deepEqual(W.columns, zones, 'the column words are not the reference\'s')
  assert.deepEqual([...SURFACE.matchAll(/key: '(person|role|methods|proof|readiness|action)'/g)].map((m) => m[1]), ['person', 'role', 'methods', 'proof', 'readiness', 'action'])
  // The name over the sign-in address, the address breaking inside its column.
  assert.match(ref, /<div class="person"><strong>[^<]+<\/strong><span>[^<]+<\/span><\/div>/)
  assert.match(SURFACE, /<strong className="person-name">[\s\S]{0,120}<span className="person-upn tenant-object">/)
  // The CSV is the same six cells in the same order.
  const t = readinessTable(fixture('demo').snapshot, fixture('demo').mapping)
  assert.deepEqual(t.header, W.columns)
  for (const row of t.rows) assert.equal(row.length, W.columns.length)
})

test('the Role column is understated: a word, and no colour of its own', () => {
  const ref = read(REFERENCE)
  assert.match(ref, /\.role\{font-size:11px;color:var\(--muted\)\}/, 'the reference no longer understates the role')
  assert.match(CSS, /\.surface\.readiness \.role \{[^}]*color: var\(--quiet-text\)/)
  assert.doesNotMatch(CSS, /\.surface\.readiness \.role-admin/, 'the admin role took a colour again')
  for (const r of readinessView(fixture('demo').snapshot, fixture('demo').snapshot.asOf, fixture('demo').mapping).rows) assert.match(roleWord(r), /\S/)
})

test('the status vocabulary is the reference\'s four words, each a word beside its dot', () => {
  const ref = read(REFERENCE)
  const words = new Set([...ref.matchAll(/<span class="status [a-z]+"><span class="dot"><\/span>([^<]+)<\/span>/g)].map((m) => m[1]))
  assert.deepEqual([...words].sort(), ['Needs proof', 'Needs setup', 'Ready', 'Unknown'])
  assert.deepEqual(['ready', 'needsProof', 'needsSetup', 'unknown'].map((s) => W.states[s].title).sort(), [...words].sort())
  // Production composes the shared `.status` role: the dot is its `::before`, the word is the element's text.
  assert.match(SURFACE, /<span className=\{`status status-\$\{STATUS_TONE\[r\.state\]\}`\}>\{stateTitle\(r\.state\)\}<\/span>/)
  const demo = readinessView(fixture('demo').snapshot, fixture('demo').snapshot.asOf, fixture('demo').mapping)
  for (const r of demo.rows) assert.match(readinessWord(r), /\S/)
})

test('the detail is one level deep and answers only Why and Next', () => {
  const ref = read(REFERENCE)
  assert.match(ref, /<dialog id="detail-dialog">/)
  assert.deepEqual([...ref.matchAll(/<div class="detail-block">\s*<h3>([^<]+)<\/h3>/g)].map((m) => m[1]), ['Why', 'Next'])
  assert.equal(W.detail.why, 'Why')
  assert.equal(W.detail.next, 'Next')
  assert.match(SURFACE, /<dialog\s+ref=\{dialog\}\s+className="readiness-detail panel"/)
  assert.equal((SURFACE.match(/<div className="detail-block">/g) ?? []).length, 2, 'the detail grew a block beyond Why and Next')
  // No second dashboard, no guide panel, no callout, no tip.
  for (const gone of [/RemediationPanel/, /guide-panel/, /<Callout/, /<PageTip/, /methodGuide\(/]) assert.doesNotMatch(SURFACE, gone, `${gone} is back on the page`)
})

test('the worklist stays an accessible table: the Action column drops at 940 and the rows stack at 720, labels in the DOM', () => {
  const ref = read(REFERENCE)
  assert.match(ref, /@media\(max-width:940px\)\{[\s\S]*?\.row>div:nth-child\(6\)\{display:none\}/, 'the reference no longer drops the Action column at 940')
  assert.match(ref, /@media\(max-width:720px\)\{[\s\S]*?\.row\{grid-template-columns:1fr;gap:8px\}/, 'the reference no longer stacks its rows at 720')

  const at940 = CSS.match(/@media \(max-width: 940px\) \{[\s\S]*?\n\}/g)?.join('\n') ?? ''
  assert.match(at940, /\.surface\.readiness table\.datatable td:nth-child\(6\) \{\s*display: none/, 'production does not drop the Action column at 940')
  const at720 = CSS.match(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/g)?.join('\n') ?? ''
  assert.match(at720, /table\.datatable tr,[\s\S]*?display: block/, 'production does not stack the rows at 720')
  assert.match(at720, /\.surface\.readiness \.cell-key \{\s*display: block/)
  assert.match(at720, /table\.datatable thead \{[^}]*clip-path: inset\(50%\)/, 'the head is removed rather than clipped')
  assert.match(at720, /\.progress-strip \{\s*grid-template-columns: 1fr/)
  assert.match(TABLE, /<table className=\{`datatable/)
  assert.match(TABLE, /scope="col"/)
  assert.match(TABLE, /<span className="cell-key key-label" aria-hidden="true">/)
  assert.match(SURFACE, /<DataTable[^/]*stacked/)
  assert.doesNotMatch(CSS, /\.cell-key::before/)
})

// ------------------------------------------------- one derivation, consumed

test('every cell consumes the derivation: no view-local method reading, proof, rung or score', () => {
  for (const forbidden of [/rungOf\(/, /personReadiness\(/, /readSignIn\(/, /registrationDetails/, /authMethods\[/, /signInEvidence\[/, /score[A-Z]/, /\.proofs\b/]) {
    assert.doesNotMatch(SURFACE, forbidden, `the surface computes ${forbidden} for itself`)
    assert.doesNotMatch(CELLS, forbidden, `the cells compute ${forbidden} for themselves`)
  }
  // The cells read the row's settled readiness, never the scoring's ordinary-MFA picture.
  assert.doesNotMatch(CELLS, /\br\.viability\b/, 'the cells read the scored row instead of its readiness')
  assert.match(CELLS, /const rd = r\.readiness/)
})

test('a filter decides which rows are on screen and nothing else', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const before = JSON.stringify(v.rows.map((r) => [r.user.id, r.state, r.active, r.kind]))
  const counts = { ...v.counts }
  for (const key of ['needsAction', 'admins', 'noPasskey', 'ready', 'all', 'needsProof', 'needsSetup', 'unknown', 'notActive', 'emergency'] as ShowKey[]) {
    v.rows.filter((r) => shows(r, key))
    assert.equal(JSON.stringify(v.rows.map((r) => [r.user.id, r.state, r.active, r.kind])), before, `${key}: a filter changed a row`)
    assert.deepEqual({ ...v.counts }, counts, `${key}: a filter changed a count`)
  }
  for (const s of ['ready', 'needsProof', 'needsSetup', 'unknown'] as const) assert.equal(v.rows.filter((r) => shows(r, s)).length, v.counts[s], `${s}: the filter and the count differ`)
  assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, v.counts.needsProof + v.counts.needsSetup + v.counts.unknown)
  assert.equal(v.rows.filter((r) => shows(r, 'all')).length, v.facts.active)
  assert.match(SURFACE, /shows\(r, show\)/, 'the filter is not a predicate over the rows')
  assert.match(SURFACE, /const \{ facts, counts, passkeys \} = view/, 'the counts are not read from the unfiltered view')
})

// The regression Step 7 exists to prevent: a tenant IAMAI could not read is
// Unknown, never a finding of Needs setup and never a measured 0%.
test('a tenant whose methods could not be read is Unknown, and nobody in it is told to set anything up', () => {
  const f = fixture('hostile')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.ok(v.facts.active > 0, 'the hostile fixture has active people')
  assert.equal(v.counts.unknown, v.facts.active)
  assert.equal(v.counts.needsSetup, 0)
  assert.equal(v.counts.ready, 0)
  assert.equal(v.passkeys.have + v.passkeys.without, 0, 'an unread inventory is in neither passkey count')
  assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, v.counts.unknown, 'the unread people stay on the working list')
  // The gate is stated as not measured, never as a shortfall.
  assert.match(SURFACE, /gate\?\.unmeasured === 'unreadable' \? S\.gateNotMeasured/)
})

test('Demo renders the production surface, and there is no second readiness page', () => {
  const app = read('src/ui/App.tsx')
  assert.equal((app.match(/<MfaReadiness/g) ?? []).length, 1, 'MFA Readiness is rendered more than once')
  assert.match(app, /route === 'readiness' \? \(\n\s*<MfaReadiness scan=\{lastScan\} baseline=\{baseline\} \/>/)
  assert.doesNotMatch(app, /demo[\s\S]{0,80}<MfaReadiness/i)
  assert.doesNotMatch(SURFACE, /demo/i, 'the readiness surface reads the demo')
  assert.doesNotMatch(CELLS, /demo/i, 'the readiness cells read the demo')
})
