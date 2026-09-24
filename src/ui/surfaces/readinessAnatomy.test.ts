// Prompt 62 — MFA Readiness v3, over the one readiness derivation.
//
// Two questions, answered separately because they have different authorities.
//
//   Does production keep what the owner approved? The v3 pack
//   `docs/design/approved/anatomy/mfa-readiness-v3.html` is the recorded
//   authority, its state words are the scoring's, and the owner's rules for the
//   page (hidden group headings, 25-word sentences, computer words) hold. The
//   pack owns anatomy, never copy: the words are content.json's.
//
//   Does the surface consume the truth rather than reach its own? Every cell is
//   scoring/phishingResistant.ts through derive/mfaReadiness.ts and
//   surfaces/readinessCells.ts; no view-local method reading, proof or count;
//   and a filter only decides which rows are on screen.
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
import { readinessView, shows } from '../../derive/mfaReadiness.ts'
import type { ShowKey } from '../../derive/mfaReadiness.ts'
import { READINESS_STATES, isReady } from '../../scoring/phishingResistant.ts'
import { readinessTable } from './inventoryTables.ts'
import { computersSeen, groupBodyLine, leadLine, nextCell, roleWord, rowCells, stateTitle } from './readinessCells.ts'
import type { ComputersSeen } from './readinessCells.ts'
import type { ReadinessRow } from '../../derive/mfaReadiness.ts'
import { pages } from '../../content/content.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** The approved anatomy this surface is built against (prompt 62). */
const PACK_PATH = 'docs/design/approved/anatomy/mfa-readiness-v3.html'
const PACK = read(PACK_PATH)
const SURFACE = read('src/ui/surfaces/MfaReadiness.tsx')
const CELLS = read('src/ui/surfaces/readinessCells.ts')
const CSS = read('src/ui/app.css')
const W = pages.readiness as unknown as {
  columns: string[]
  csvColumns: string[]
  groups: Record<string, { title: string; why: string; body?: string }>
  show: Record<string, string>
}

/** A rule's body in production's sheet, by its exact selector. */
const cssRule = (selector: string): string => {
  const at = CSS.indexOf(`\n${selector} {`)
  return at === -1 ? '' : CSS.slice(at + selector.length + 3, CSS.indexOf('}', at))
}

// ------------------------------------------------------- the authority itself

test('the reference manifest records its old MFA Readiness authority as superseded by the v3 pack', () => {
  // Item 22 (2026-09-19): the Step 7 reference was still recorded as the
  // authority after prompt 62 made v3 the page's pack. The owner archived the
  // old files, so the reference manifest now says, as values, that its block is
  // superseded and by what — the same file and bytes the design manifest holds.
  const reference = JSON.parse(read('docs/design/approved/reference/REFERENCE-MANIFEST.json')) as {
    files: Record<string, string>
    canonicalSources: Record<string, string>
    mfaReadiness: { status: string; supersededOn: string; supersededBy: string; supersededBySha256: string; file: string }
  }
  const design = JSON.parse(read('docs/design/approved/manifest.json')) as { surfaces: { surface: string; path: string; sha256: string; approvalState: string }[] }
  const current = design.surfaces.find((s) => s.surface === 'mfa-readiness' && s.approvalState === 'current')!
  const got = createHash('sha256').update(readFileSync(PACK_PATH)).digest('hex')
  const old = reference.mfaReadiness
  assert.equal(old.status, 'superseded')
  assert.equal(old.supersededOn, '2026-09-19')
  assert.equal(old.supersededBy, current.path, 'the reference manifest does not hand over to the authority manifest.json records')
  assert.equal(old.supersededBy, PACK_PATH)
  assert.equal(old.supersededBySha256, current.sha256)
  assert.equal(old.supersededBySha256, got, 'the recorded v3 hash is not the bytes on disk')
  assert.equal(reference.canonicalSources['mfa-readiness'], current.sha256, 'the reference manifest names a retired canonical MFA Readiness pack')
  // The old reference is a record now, not a file the reference pack holds.
  assert.ok(old.file.startsWith('archive/design/'), 'the superseded reference is not in the archive')
  assert.ok(!Object.keys(reference.files).some((f) => f.includes('mfa-readiness')), 'the reference pack still lists an MFA Readiness file of its own')
})

// ------------------------------------------------------------- the rows

test("a row's cells: the state is the pack's word, a person's role is Admin or nothing, and the CSV is the row's cells", () => {
  // The pack's status vocabulary is the scoring's states, word for word.
  const block = PACK.slice(PACK.indexOf('const STATES = {'), PACK.indexOf('\n}', PACK.indexOf('const STATES = {')))
  const words = Object.fromEntries([...block.matchAll(/([a-z]+):\{word:'([^']+)'/g)].map((m) => [m[1], m[2]]))
  assert.deepEqual(Object.keys(words).sort(), [...READINESS_STATES].sort(), "the pack's states are not the scoring's")
  for (const s of READINESS_STATES) assert.equal(stateTitle(s), words[s], `${s}: the word is not the pack's`)
  const f = fixture('demo')
  for (const r of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
    if (r.kind !== 'person') assert.equal(roleWord(r), W.show[r.kind], `${r.user.id}: an account that is not a person names its kind`)
    else assert.equal(roleWord(r), r.admin ? 'Admin' : '', `${r.user.id}: a person's role is Admin or nothing`)
    if (r.state !== null) assert.equal(rowCells(r)[3], stateTitle(r.state), `${r.user.id}: the CSV state is not the word`)
  }
  // The CSV is the row's cells, with the sign-in name, role and state spelled out.
  const t = readinessTable(f.snapshot, f.mapping)
  assert.deepEqual(t.header, W.csvColumns)
  assert.deepEqual(W.csvColumns, [W.columns[0], 'Sign-in name', 'Role', W.columns[1], W.columns[2], 'Readiness', W.columns[3]])
  for (const r of t.rows) assert.equal(r.length, W.csvColumns.length)
})

// ------------------------------------------------------------- the owner's rules

test('each group has a visually hidden heading, so heading navigation reaches the worklist (owner, 2026-09-19)', () => {
  // The title a sighted reader sees is inside <summary>, which is not a heading; a hidden h3 before each group names it.
  const group = SURFACE.slice(SURFACE.indexOf('const groupView = '), SURFACE.indexOf('const setupNext = '))
  assert.match(group, /<Fragment key=\{state\}>\s*<h3 className="sr-only">\{G\.title\}<\/h3>\s*<details className=\{`readiness-group panel/, 'a group has no heading of its own')
  assert.equal((group.match(/<h3 /g) ?? []).length, 1, 'one heading per group, and no visible one beside the summary')
  // The heading sits under "What to do" (h2), a level beside the next setup check (h3): the outline never skips a level.
  assert.match(SURFACE, /<h2>\{T\.worklist\}<\/h2>/)
  assert.match(SURFACE, /<h3 id="readiness-setup-next">/)
  // The project's one visually hidden role: clipped to a pixel, kept in the accessibility tree.
  const srOnly = cssRule('.sr-only')
  assert.match(srOnly, /position: absolute;/)
  assert.match(srOnly, /clip: rect\(0 0 0 0\);/)
  assert.doesNotMatch(srOnly, /display: none|visibility: hidden/, 'the hidden heading is hidden from a screen reader too')
})

test('every sentence the page carries is 25 words or fewer: the goal line, the definition of Ready and the group bodies included (owner, 2026-09-19)', () => {
  // The rule and the sentence split are the page contract's and the walk's (docs/qa/page-contracts.json, scripts/walk.mjs).
  const max = (JSON.parse(read('docs/qa/page-contracts.json')) as { rules: { sentenceMaxWords: number } }).rules.sentenceMaxWords
  assert.equal(max, 25)
  const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).map((x) => x.trim()).filter((x) => x.length > 1)
  const over: string[] = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      for (const s of sentences(node)) if (s.split(/\s+/).length > max) over.push(`${path} (${s.split(/\s+/).length}): ${s}`)
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (k !== '$comment') walk(v, `${path}.${k}`)
    }
  }
  walk(pages.readiness, 'pages.readiness')
  assert.deepEqual(over, [], 'a sentence on MFA Readiness is over the 25-word rule')
  // The three the owner approved in the pack and then asked to trim keep their meaning.
  const R = pages.readiness as unknown as { lead: unknown; define: string }
  assert.match(R.define, /^Ready means a phishing-resistant sign-in \(passkey, security key, Windows Hello, Platform SSO or certificate\) on every kind of device they use, within 30 days\. /)
  assert.match(JSON.stringify(R.lead), /Phishing-resistant sign-in for everyone, and seamless where the device allows it: a passkey on the phone/)
  assert.match(JSON.stringify(W.groups.method.body), /A passkey in Microsoft Authenticator signs them in on their phone and from any computer\./)
})

test('the words that name a computer’s built-in option follow the computers seen: Windows, Mac, both or neither (owner, 2026-09-19)', () => {
  const row = (...devices: [string, 'computer' | 'phone'][]): ReadinessRow => ({ readiness: { devices: devices.map(([os, type]) => ({ os, type })) } }) as unknown as ReadinessRow
  const uncounted = { readiness: null } as unknown as ReadinessRow
  assert.equal(computersSeen([row(['Windows', 'computer'], ['iOS', 'phone']), uncounted]), 'windows')
  assert.equal(computersSeen([row(['macOS', 'computer']), row(['Android', 'phone'])]), 'mac')
  assert.equal(computersSeen([row(['Windows', 'computer']), row(['macOS', 'computer'], ['iOS', 'phone'])]), 'both')
  assert.equal(computersSeen([row(['iOS', 'phone']), row(['Linux', 'computer']), uncounted]), 'none')
  assert.equal(computersSeen([]), 'none')

  const seen: ComputersSeen[] = ['windows', 'mac', 'both', 'none']
  for (const c of seen) {
    const lead = leadLine(c)
    const method = groupBodyLine('method', c) ?? ''
    const device = groupBodyLine('device', c) ?? ''
    // The smoke's opening words, and the phone passkey, hold whatever the computers.
    assert.match(lead, /^Phishing-resistant sign-in for everyone, and seamless where the device allows it: a passkey on the phone/)
    assert.match(method, /A passkey in Microsoft Authenticator signs them in on their phone and from any computer\./)
    assert.match(device, /Where the step is a setup, on a phone it is a passkey in Microsoft Authenticator/)
    // Windows Hello only where a Windows computer signs in; the Mac's option only where a Mac does.
    for (const [words, where] of [[lead, 'lead'], [method, 'Needs a method'], [device, 'Needs a device']] as const) {
      if (c === 'windows' || c === 'both') assert.match(words, /Windows Hello/, `${c}: the ${where} words don't name Windows Hello`)
      else assert.doesNotMatch(words, /Windows/, `${c}: the ${where} words assume Windows`)
      if (c === 'mac' || c === 'both') assert.match(words, /synced passkey/, `${c}: the ${where} words don't name the Mac's option`)
      else assert.doesNotMatch(words, /Mac|synced/, `${c}: the ${where} words assume a Mac`)
    }
  }
  // A group with one body for every tenant keeps it; a group with none has none.
  assert.equal(groupBodyLine('seamless', 'mac'), null)
  // The page reads the tenant's computers once, and uses them for the lead and the next group's body.
  assert.match(SURFACE, /const seen = computersSeen\(view\.rows\)/)
  // With whether a synced passkey would be offered at all (readinessPhase2.test.ts).
  assert.match(SURFACE, /<p className="line intro">\{leadLine\(seen, offersSynced\)\}<\/p>/)
  assert.match(SURFACE, /const body = groupBodyLine\(state, seen, offersSynced\)/)
  assert.match(SURFACE, /\{isNext && body && \(\s*<div className="next-body">\s*<p>\{body\}<\/p>/)
  assert.doesNotMatch(SURFACE, /T\.lead|G\.body/, 'the page reads a Windows-only sentence directly')
})

// ------------------------------------------------- one derivation, consumed

test('every cell consumes the derivation: no view-local method reading, proof or score', () => {
  for (const forbidden of [/rungOf\(/, /personReadiness\(/, /readSignIn\(/, /registrationDetails/, /authMethods\[/, /signInEvidence\[/, /score[A-Z]/, /\.proofs\b/]) {
    assert.doesNotMatch(SURFACE, forbidden, `the surface computes ${forbidden} for itself`)
    assert.doesNotMatch(CELLS, forbidden, `the cells compute ${forbidden} for themselves`)
  }
  // No threshold of its own: the Plan's gates are the steps' own, and this page only counts.
  assert.doesNotMatch(SURFACE, /readyNeeded|READINESS_THRESHOLD_MFA_PERCENT|readinessFor\(/, 'the page measures a gate of its own')
  // The page reads the one view, and the cells read the row's settled readiness,
  // never the scoring's ordinary-MFA picture.
  assert.match(SURFACE, /readinessView\(snapshot, snapshot\.asOf, mapping\)/)
  assert.doesNotMatch(CELLS, /\br\.viability\b/, 'the cells read the scored row instead of its readiness')
  assert.match(CELLS, /const rd = r\.readiness/)
})

test('a filter decides which rows are on screen and nothing else', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const before = JSON.stringify(v.rows.map((r) => [r.user.id, r.state, r.active, r.kind]))
  const counts = { ...v.counts }
  for (const key of ['needsAction', 'admins', 'all', 'lapsing', ...READINESS_STATES, 'notActive', 'emergency', 'guests'] as ShowKey[]) {
    v.rows.filter((r) => shows(r, key, v.lapsing))
    assert.equal(JSON.stringify(v.rows.map((r) => [r.user.id, r.state, r.active, r.kind])), before, `${key}: a filter changed a row`)
    assert.deepEqual({ ...v.counts }, counts, `${key}: a filter changed a count`)
  }
  for (const s of READINESS_STATES) assert.equal(v.rows.filter((r) => shows(r, s)).length, v.counts[s], `${s}: the filter and the count differ`)
  assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, READINESS_STATES.filter((s) => !isReady(s)).reduce((n, s) => n + v.counts[s], 0))
  assert.equal(v.rows.filter((r) => shows(r, 'all')).length, v.people)
  assert.match(SURFACE, /shows\(r, show, view\.lapsing\)/, 'the filter is not a predicate over the rows')
  // The answer and the bar count the whole selected cohort, independently of the filter and the search.
  assert.match(SURFACE, /const counted = view\.rows\.filter\(\(r\) => r\.state !== null && inScope\(r\)\)/, 'the counts must use the full selected cohort, independently of table filters')
  assert.doesNotMatch(SURFACE.slice(SURFACE.indexOf('const counted ='), SURFACE.indexOf('const matches =')), /matches\(|shows\(|\bq\b/, 'a count reads the filter or the search')
})

// The regression Step 7 exists to prevent: a tenant IAMAI could not read is
// Unknown, never a finding of Needs a method and never a measured 0%.
test('a tenant whose methods could not be read is Unknown, and nobody in it is told to set anything up', () => {
  const f = fixture('hostile')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.ok(v.people > 0, 'the hostile fixture has active people')
  assert.equal(v.counts.unknown, v.people)
  assert.equal(v.counts.method, 0)
  assert.equal(v.counts.ready + v.counts.seamless, 0)
  for (const r of v.rows.filter((x) => x.state === 'unknown')) {
    assert.equal(r.readiness?.next.kind, 'rescan', `${r.user.id}: an unread person is given something to do`)
    assert.doesNotMatch(nextCell(r), /^Set up/, `${r.user.id}: an unread person is told to set up a method`)
  }
  assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, v.counts.unknown, 'the unread people stay on the working list')
})
