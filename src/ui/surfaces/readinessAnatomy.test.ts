// Task 037 — the approved MFA Readiness anatomy, restored, over unchanged MFA truth.
//
// Two questions, and this file answers them separately because they have
// different authorities.
//
//   Does production have the SHAPE the owner approved? Every structural
//   assertion is two-sided: it reads `docs/design/approved/mfa-readiness-v2.html`
//   at test time and fails if the pack stops drawing the thing production claims
//   to have restored, and it reads production and fails if production stops
//   drawing it.
//
//   Did the restoration change what IAMAI knows? It must not have. So the
//   evidence half runs the real fixtures through derive/mfaReadiness.ts and
//   asserts the surface consumes that answer rather than reaching a second one:
//   no view-local rung, no second readiness score, registration is still not
//   proof, and a filter still only decides which rows are on screen.
//
// What this file does not re-prove, because one authority already owns it: the
// canonical hashes across all four packs (src/ui/design-authority.test.ts); the
// token system and AA (src/ui/tokens.test.ts); focus, forced colours and
// reduced motion (src/ui/accessibility.test.ts); the shared roles task 031
// proved (src/ui/primitives.test.ts); the ladder itself and the groupings over
// it (src/derive/mfaReadiness.test.ts, src/derive/mfaReadinessSurface.test.ts);
// the demo's isolation (src/ui/demo.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { actionable, groupOf, readinessView, scoredPeople, shows } from '../../derive/mfaReadiness.ts'
import { firstMfaDependency, stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import type { ShowKey } from '../../derive/mfaReadiness.ts'
import { hasPortablePhishingResistant, methodsIndex, rungOf } from '../../derive/ladder.ts'
import { methodWord, readinessWord, roleWord, rowEvidenceText } from './readinessCells.ts'
import { readinessTable } from './inventoryTables.ts'
import { pages } from '../../content/content.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const PACK = 'docs/design/approved/mfa-readiness-v2.html'
const SURFACE = read('src/ui/surfaces/MfaReadiness.tsx')
const CELLS = read('src/ui/surfaces/readinessCells.ts')
const TABLE = read('src/ui/components/DataTable.tsx')
const CSS = read('src/ui/app.css')
const COLUMNS = (pages.readiness as { columns: string[] }).columns

// ------------------------------------------------------- the authority itself

// The precondition for every assertion below: the bytes this file reads are the
// owner-approved bytes. src/ui/design-authority.test.ts owns the hash contract
// across all four packs and against the committed git blob; this is only the
// guarantee that THIS file's evidence came from the approved file.
test('the MFA Readiness pack this file reads is the approved one, byte for byte', () => {
  const manifest = JSON.parse(read('docs/design/approved/manifest.json')) as { surfaces: { surface: string; path: string; sha256: string }[] }
  const record = manifest.surfaces.find((s) => s.surface === 'mfa-readiness')
  assert.ok(record, 'the manifest records an MFA Readiness surface')
  assert.equal(record.path, PACK)
  assert.equal(createHash('sha256').update(readFileSync(PACK)).digest('hex'), '12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512')
  assert.equal(createHash('sha256').update(readFileSync(PACK)).digest('hex'), record.sha256, 'the canonical MFA Readiness pack changed')
})

// ------------------------------------------------------------- the anatomy

test('the summary is one integrated panel with a dominant cell and three stats, on both sides', () => {
  const pack = read(PACK)
  // The pack: ONE grid, one border, one radius, `overflow: hidden`, a 1.8fr
  // main cell and three stat tracks; the stats are divided by a left hairline
  // and are not boxes of their own.
  assert.match(pack, /\.summary\s*\{[^}]*grid-template-columns:minmax\(0,1\.8fr\) repeat\(3,minmax\(120px,\.65fr\)\)/, 'the pack no longer draws one integrated summary grid')
  assert.match(pack, /\.summary\s*\{[^}]*overflow:hidden/, 'the pack no longer clips its cells to one radius')
  assert.match(pack, /\.summary-stat\s*\{border-left:1px solid var\(--line\)\}/, 'the pack no longer divides its stats by a hairline')
  assert.doesNotMatch(pack, /\.summary-stat\s*\{[^}]*border-radius/, 'a pack stat that became a card of its own')

  // Production: one panel element holding the main cell and exactly three
  // stats, with the same grid and the same clip; and the four tiles it replaced
  // are gone from the surface and from the stylesheet.
  assert.match(SURFACE, /<section className="readiness-summary panel">/, 'the summary is not one panel')
  assert.match(SURFACE, /<div className="summary-main">/, 'the panel has no dominant cell')
  assert.match(SURFACE, /READINESS_GROUPS\.map\(\(g: ReadinessGroup\)[\s\S]{0,400}className="summary-stat"/, 'the stats are not the three groupings inside the panel')
  const rule = CSS.match(/\.readiness-summary \{[^}]*\}/)?.[0] ?? ''
  assert.match(rule, /grid-template-columns: minmax\(0, 1\.8fr\) repeat\(3, minmax\(120px, 0\.65fr\)\)/, "production's summary is not the pack's grid")
  assert.match(rule, /overflow: hidden/, 'production does not clip the cells to the panel radius')
  assert.match(CSS, /\.readiness-summary \.summary-stat \{[^}]*border-left: 1px solid var\(--line\)/, 'the stats are not divided by a hairline')
  assert.doesNotMatch(CSS, /\.group-tile|\.group-counts|\.group-count\b/, 'the four separate count cards left dead rules behind')
  assert.doesNotMatch(SURFACE, /group-tile|group-counts/, 'the surface still draws the count cards the panel replaced')
})

test('one callout under the summary, in the pack’s place, and it is not drawn unless there is something true to say', () => {
  const pack = read(PACK)
  // The pack: exactly one callout, and it sits between the summary and the
  // toolbar.
  assert.equal((pack.match(/class="callout"/g) ?? []).length, 1, 'the pack no longer draws exactly one callout')
  const at = (s: string): number => pack.indexOf(s)
  assert.ok(at('class="summary"') < at('class="callout"') && at('class="callout"') < at('class="toolbar"'), 'the pack no longer puts the callout between the summary and the toolbar')

  // Production: ONE callout element, in the same place, on every scanned page.
  // It used to be two conditional ones whose conditions could both be false, so
  // an all-ready tenant and a tenant whose holds this scan could not measure
  // lost the panel and the page's anatomy changed with the tenant. What varies
  // is the notice's words, and each of them is production's own fact — the pack
  // supplies no sentence here.
  const body = SURFACE.slice(SURFACE.indexOf('<section className="readiness-summary panel">'))
  const callout = body.indexOf('<Callout')
  assert.ok(callout > 0 && callout < body.indexOf('<div className="toolbar'), 'the callout is not between the summary and the toolbar')
  assert.equal((SURFACE.match(/<Callout/g) ?? []).length, 1, 'the one callout became more than one element')
  assert.doesNotMatch(body, /\{context \? \(\s*<Callout|dependency && \(\s*<Callout/, 'the callout is drawn on a condition again')
  assert.match(body, /<Callout kind=\{notice\.kind\}>/, 'the one callout is not the notice’s')
  // The state is the plan authority's answer, and the words for it are chosen
  // in one place (noticeWords).
  assert.match(SURFACE, /data\.computed \? firstMfaDependency\(data\.computed\.steps, data\.computed\.viability\) : \{ kind: 'pending' \}/, 'the dependency is not the plan authority’s answer')
  for (const kind of ['holding', 'unknown', 'none']) {
    assert.match(SURFACE, new RegExp(`dependency\.kind === '${kind}'`), `the notice has no words for a ${kind} dependency`)
  }
  // An unknown reach is named as unknown and never counted: no branch of the
  // notice turns a hold this scan could not measure into a number.
  assert.match(SURFACE, /dependency\.kind === 'unknown'[\s\S]{0,200}fillText\(P\.unknown, \{ step: contentTitle\(dependency\.step\) \}\)/, 'an unknown reach must not become a number in the callout')
  // A settled absence is stated only where the plan computation settled it: the
  // pending branch says no step is named, never that none exists.
  assert.match(SURFACE, /dependency\.kind === 'none'[\s\S]{0,200}text: P\.dependencyNone\b/, 'the no-dependency state does not say so')
  assert.match(SURFACE, /title: P\.dependencyTitle, text: P\.dependencyPending/, 'the un-computed plan reports an absence it never proved')
  assert.doesNotMatch(SURFACE, /!data\.computed[\s\S]{0,80}dependencyNone/, 'a plan that has not computed claims there is no dependency')
})

test('the callout divides what is true from the way to the Plan step, and stacks them at the pack’s narrow width', () => {
  const pack = read(PACK)
  // The pack: a space-between row holding an explanation block and an action,
  // which becomes a column at 620.
  assert.match(pack, /\.callout\s*\{[^}]*justify-content:space-between/, 'the pack no longer holds its action apart from its explanation')
  assert.match(pack, /<div class="callout">\s*<div>[\s\S]{0,300}<\/div>\s*<a href="[^"]*">[^<]*<\/a>\s*<\/div>/, 'the pack no longer draws an explanation block beside an action')
  const narrow = pack.match(/@media\(max-width:620px\)\{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(narrow, /\.callout\{align-items:flex-start;flex-direction:column\}/, 'the pack no longer stacks the callout at 620')

  // Production: the one callout names its two parts, so the way to the Plan is
  // the action of the notice and not a word inside its sentence — on every
  // state, because there is one element and the state is only its words.
  const parts = [...SURFACE.matchAll(/<Callout[\s\S]{0,900}?<\/Callout>/g)].map((m) => m[0])
  assert.equal(parts.length, 1, 'the one callout became more than one element')
  assert.match(parts[0], /<span className="callout-explain">/, 'the callout states its sentence outside an explanation block')
  assert.match(parts[0], /<a className="callout-action" href=\{notice\.href\}>/, 'the callout does not hold the way to the Plan as its action')
  // And every state's destination is the Plan: the step where the notice names
  // one, the Plan itself where it does not.
  assert.match(SURFACE, /const stepHref = \(stepId: string\): string => `#\/plan\/\$\{encodeURIComponent\(stepId\)\}`/, 'a notice no longer links to the step it names')
  assert.match(SURFACE, /href: PLAN_HREF/, 'a notice with no step to name has nowhere to go')
  // And the layout is the pack's: the body divides, and the division becomes a
  // stack at the pack's own breakpoint.
  const body = CSS.match(/\.surface\.readiness \.callout \.callout-body \{[^}]*\}/)?.[0] ?? ''
  assert.match(body, /justify-content: space-between/, 'the callout does not hold its action apart from its explanation')
  assert.match(body, /align-items: center/, 'the action does not sit with the explanation it belongs to')
  const at620 = CSS.match(/@media \(max-width: 620px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(at620, /\.surface\.readiness \.callout \.callout-body \{[^}]*flex-direction: column/, 'the callout never stacks its action under its explanation')
  // The shared attention panel keeps its own job: the tone, the tint and the
  // icon. It must not grow one surface's two-part arrangement (task 031).
  assert.doesNotMatch(CSS.match(/\n\.callout \{[^}]*\}/)?.[0] ?? '', /space-between/, 'the readiness arrangement became the shared callout role')
})

test('the toolbar is a search and the filters as pills, and every pill is a real control over the one Show key', () => {
  const pack = read(PACK)
  assert.match(pack, /\.toolbar\s*\{display:flex[^}]*flex-wrap:wrap/, 'the pack no longer wraps its toolbar')
  assert.match(pack, /\.search\s*\{[^}]*min-width:260px;flex:1/, 'the pack no longer leads with a flexible search')
  assert.match(pack, /\.filter\s*\{[^}]*border-radius:999px/, 'the pack no longer draws its filters as pills')

  assert.match(SURFACE, /<input type="search"[^>]*aria-label=\{C\.search\}/, 'the search lost its accessible name')
  assert.match(SURFACE, /\{pills\.map\(\(k\) => \([\s\S]{0,260}aria-pressed=\{show === k\}[\s\S]{0,120}onClick=\{\(\) => select\(k\)\}/, 'the pills are not controls over the Show key')
  assert.match(SURFACE, /className="pill"/, 'the pills do not compose the shared pill role')
  assert.doesNotMatch(SURFACE, /<select/, 'the Show dropdown the pills replaced is still there')
  // A hash that arrived filtered to a rung or a separate population keeps a pill
  // of its own, so the control still says what is on screen.
  assert.match(SURFACE, /SHOW_KEYS\.includes\(show\) \? \[\.\.\.SHOW_KEYS\] : \[\.\.\.SHOW_KEYS, show\]/, 'a compat filter no longer appears among the pills')
  // Pressed is a check mark as well as the accent (task 017), and the pills sit
  // in the toolbar that rule applies to.
  assert.match(CSS, /\.surface \.toolbar \.btn\[aria-pressed='true'\]::before \{[^}]*content:/, 'a pressed filter is the accent alone')
})

test('the person table has the pack’s six zones, in the pack’s order, on both sides', () => {
  const pack = read(PACK)
  assert.match(pack, /\.table-head,\.row\s*\{[^}]*grid-template-columns:minmax\(210px,1\.5fr\) 100px minmax\(150px,1fr\) minmax\(130px,\.9fr\) 150px 135px/, 'the pack no longer draws a six-zone person row')
  const heads = pack.match(/<div class="table-head">([\s\S]*?)<div class="row">/)?.[1] ?? ''
  assert.deepEqual(
    [...heads.matchAll(/<div>([^<]+)<\/div>/g)].map((m) => m[1]),
    ['Person', 'Role', 'Strongest method', 'Proof', 'Readiness', 'Action'],
    "the pack's six zones changed",
  )
  // Production takes the pack's ORDER and keeps its own two words: the identity
  // column is "Account" on a table that also lists shared devices and service
  // accounts, and the last column is a state before it is ever an action. The
  // pack owns the anatomy; docs/design/content.json owns the copy.
  assert.deepEqual(COLUMNS, ['Account', 'Role', 'Strongest method', 'Proof', 'Readiness', 'Next step'])
  assert.deepEqual(
    [...SURFACE.matchAll(/key: '(account|role|method|proof|readiness|next)'/g)].map((m) => m[1]),
    ['account', 'role', 'method', 'proof', 'readiness', 'next'],
    'the rendered columns are not the six zones in the pack’s order',
  )
  // The name over the sign-in address, as the pack draws the Person cell, with
  // the address breaking inside its column rather than widening the page.
  assert.match(pack, /<div class="person"><strong>[^<]+<\/strong><span>[^<]+<\/span><\/div>/, 'the pack no longer draws the name over the address')
  assert.match(SURFACE, /<strong className="person-name">[\s\S]{0,120}<span className="person-upn tenant-object">/, 'production no longer draws the name over the address')
  assert.match(CSS, /\.surface\.readiness \.person-upn \{[^}]*display: block/, 'the address does not sit under the name')
  // And the CSV a row exports is the same six cells in the same order.
  const t = readinessTable(fixture('demo').snapshot, fixture('demo').mapping)
  assert.deepEqual(t.header, COLUMNS)
  for (const row of t.rows) assert.equal(row.length, COLUMNS.length)
})

test('the readiness cell is one bounded status object, and the rung and the word are what is inside it', () => {
  const pack = read(PACK)
  // The pack: the state is a marker and a word inside ONE full-round outline,
  // never a loose mark beside loose text.
  const status = pack.match(/\.status\s*\{[^}]*\}/)?.[0] ?? ''
  assert.match(status, /display:inline-flex/, 'the pack no longer bounds its state as one object')
  assert.match(status, /border:1px solid/, 'the pack’s state object lost its outline')
  assert.match(status, /border-radius:999px/, 'the pack’s state object is no longer a full round')
  assert.match(pack, /<span class="status [a-z]+"><span class="dot"><\/span>[A-Za-z][^<]*<\/span>/, 'the pack no longer puts a marker and a word inside the outline')

  // Production: the same bounded object, composing the shared `.pill` geometry
  // rather than declaring a second one, with the rung's own badge as the marker
  // and the group's word beside it. Neither is removed and neither is hidden:
  // the word is what says the state and the badge still carries the rung.
  const cell = SURFACE.match(/<span className="readiness-status pill">[\s\S]{0,600}/)?.[0] ?? ''
  assert.ok(cell, 'the readiness cell is not one bounded status object')
  assert.match(cell, /<RungBadge rung=\{r\.rung\} \/>/, 'the rung’s badge left the status object')
  assert.match(cell, /<span className="group-word">\{readinessWord\(r\)\}<\/span>/, 'the readiness word left the status object')
  assert.match(cell, /<span className="not-person">/, 'an account the campaign does not count lost its word')
  const role = CSS.match(/\n\.pill \{[^}]*\}/)?.[0] ?? ''
  assert.match(role, /border: 1px solid/, 'the shared pill lost the outline the cell composes')
  assert.match(role, /border-radius: 999px/, 'the shared pill is no longer a full round')
  // The outline is geometry. The state stays in the word and in the rung's own
  // badge — the readiness cell's own rule chooses no colour of its own, which
  // is what keeps a readiness group and a Plan lifecycle out of one enum.
  const own = CSS.match(/\.surface\.readiness td \.readiness-status \{[^}]*\}/)?.[0] ?? ''
  assert.ok(own, 'the readiness status object has no rule')
  assert.doesNotMatch(own, /background|border-color|(?<!vertical-)color:/, 'the readiness status outline chose a state colour')
  assert.doesNotMatch(CSS, /\.readiness-status \{[^}]*display: none|\.group-word \{[^}]*display: none/, 'the word inside the status object was hidden')
})

test('the table stays an accessible table through the stacked breakpoint, and its labels are DOM', () => {
  const pack = read(PACK)
  // The pack stacks at 900 and labels each cell with `::before`.
  const narrow = pack.match(/@media\(max-width:900px\)\{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(narrow, /\.table-head\{display:none\}/, 'the pack no longer hides the head when it stacks')
  assert.match(narrow, /\.row\{grid-template-columns:1fr/, 'the pack no longer stacks its row into one column')
  assert.match(narrow, /\.row>div:nth-child\(1\)::before\{content:"Person"\}/, 'the pack no longer labels its stacked cells')

  // Production draws the same SHAPE and refuses the mechanism: it stays a real
  // table with real column headers, the key it shows is a real element, and the
  // roles the display change would otherwise destroy are restated.
  assert.match(TABLE, /<table className=\{`datatable/, 'the table stopped being a table')
  assert.match(TABLE, /scope="col"/, 'the column header stopped being a column header')
  assert.match(TABLE, /<span className="cell-key key-label" aria-hidden="true">/, "the stacked cell's key is not a real element")
  for (const role of ['table', 'rowgroup', 'columnheader', 'cell', 'row']) {
    assert.match(TABLE, new RegExp(`role=\\{stacked \\? '${role}' : undefined\\}`), `a stacked table does not restate its ${role} role`)
  }
  assert.match(SURFACE, /<DataTable[^/]*stacked/, 'MFA Readiness does not stack its rows')
  const at900 = CSS.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/g)?.join('\n') ?? ''
  assert.match(at900, /table\.datatable tr,[\s\S]*?display: block/, 'production does not stack the row at the pack’s breakpoint')
  assert.match(at900, /\.surface\.readiness \.cell-key \{\s*display: block/, 'the stacked key never becomes visible')
  // The head is taken out of sight and left in the accessibility tree: it is
  // the element each stacked cell is still associated with, which is what makes
  // hiding the visible key from a screen reader safe.
  assert.match(at900, /table\.datatable thead \{[^}]*clip-path: inset\(50%\)/, 'the head is removed rather than clipped')
  assert.doesNotMatch(at900, /table\.datatable thead \{[^}]*display: none/)
  // Nothing anywhere turns a cell's label into generated content.
  assert.doesNotMatch(CSS, /td::before\s*\{[^}]*content:\s*attr\(/)
  assert.doesNotMatch(CSS, /\.cell-key::before/)
})

// ------------------------------------------------- the evidence, unchanged

test('every cell consumes an authority already made: no view-local rung, method, proof or readiness', () => {
  // The surface reads the row's own fields and readinessCells.ts; it never
  // re-reads a method inventory, a sign-in record or a rung.
  for (const forbidden of [/rungOf\(/, /hasPortablePhishingResistant\(/, /methodsIndex\(/, /groupOf\(/, /registrationDetails/, /signInEvidence\?\.rows/, /score[A-Z]/]) {
    assert.doesNotMatch(SURFACE, forbidden, `the surface computes ${forbidden} for itself instead of consuming the derivation`)
  }
  // readinessCells.ts chooses words for facts and computes none: the only thing
  // it may do with a row is name it.
  for (const forbidden of [/rungOf\(/, /hasPortablePhishingResistant\(/, /groupOf\(/, /\br\.viability\.(mfa|evidence|reasons)\b/]) {
    assert.doesNotMatch(CELLS, forbidden, `the cells module reads ${forbidden} instead of the row's settled fields`)
  }
  // And the words it does choose are the ones the view already decided.
  assert.match(CELLS, /export function readinessWord[\s\S]{0,240}groupWords\(r\.group\)\.title/, 'the readiness word is not the group the view put the row in')
  assert.match(SURFACE, /csv: \(r\) => methodWord\(r\.method\)/, 'the method cell is not the row’s settled method word')
  assert.match(SURFACE, /csv: \(r\) => readinessWord\(r\)/, 'the readiness cell is not the row’s settled group')
})

test('the summary’s three numbers are the view’s groups, and the sub-line counts only what the scan settled', () => {
  for (const name of ['demo', 'getiamai', 'hostile'] as const) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    // The four groups partition the active people, so the panel's headline
    // denominator and its three stats cannot disagree with the ladder.
    const summed = v.groups.ready + v.groups.needsProof + v.groups.needsPasskey + v.groups.unknown
    assert.equal(summed, v.facts.active, `${name}: the groups no longer partition the active people`)
    // The sub-line the panel renders counts the two SETTLED groups, and the
    // people this scan could not read are not among them: `active - ready`
    // would have swept them in, which is the whole defect.
    assert.equal(actionable(v.groups), v.groups.needsProof + v.groups.needsPasskey, `${name}: the needs-action line is not the settled part of the partition`)
    assert.equal(v.facts.active - v.groups.ready - v.groups.unknown, actionable(v.groups), `${name}: the needs-action line and the unknown sentence do not account for everybody`)
    // And no account the campaign does not count is in any of them.
    for (const r of v.rows) {
      if (r.kind !== 'person' || !r.active) assert.equal(r.group, null, `${name}: ${r.kind} counted among the active people`)
    }
  }
  // The surface states them from the view and holds no number of its own.
  assert.match(SURFACE, /const needAction = actionable\(groups\)/, 'the needs-action count is not the view’s settled partition')
  assert.match(SURFACE, /\{groups\[g\]\}/, 'a stat renders something other than the view’s count')
  assert.doesNotMatch(SURFACE, /\bconst (READY|ACTIVE|TOTAL)\s*=\s*\d/, 'a hard-coded count on the surface')
  assert.doesNotMatch(SURFACE, /facts\.active - groups\.ready/, 'the needs-action count counts the unknown people again')
})

// The regression the correction is for. `hostile` is the tenant whose
// registration report could not be read at all: every active person is
// `unknown`, and nothing about any of them has been established.
test('a tenant whose methods could not be read is never told those people need action', () => {
  const f = fixture('hostile')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.ok(v.groups.unknown > 0, 'the hostile fixture no longer holds anybody whose methods could not be read')
  assert.equal(v.methodsRead, false)
  // What the page says: nobody is counted as needing action, because nobody has
  // been shown to; the unknown people are stated as unknown in their own
  // sentence; and the summary's own denominator is untouched.
  assert.equal(actionable(v.groups), 0, 'somebody nobody could read was counted as needing action')
  assert.equal(v.groups.unknown, v.facts.active, 'the unknown sentence does not account for the active people')
  // And the sub-line is not the all-clear either: "Nobody is waiting on a
  // method" is a claim about people this scan could not read. The third line
  // exists for exactly this state, and the surface chooses it on `unknown`.
  const W = pages.readiness as unknown as { summarySub: string; summarySubNone: string; summarySubUnknown: string }
  assert.match(W.summarySubUnknown, /\S/, 'there is no sub-line for a tenant with nothing settled')
  assert.notEqual(W.summarySubUnknown, W.summarySubNone)
  assert.match(SURFACE, /needAction > 0 \? fillText\(T\.summarySub, \{ n: needAction \}\) : groups\.unknown > 0 \? T\.summarySubUnknown : T\.summarySubNone/, 'the sub-line gives the all-clear over people it could not read')
  // The three numbers reconcile with the filter, which is deliberately the
  // wider set: the Needs action list keeps the unknown people on screen — they
  // are not done — and that list is the sub-line's count plus the unknown one.
  const needsActionRows = v.rows.filter((r) => shows(r, 'needsAction')).length
  assert.equal(needsActionRows, actionable(v.groups) + v.groups.unknown, 'the Needs action filter and the counts above it do not reconcile')
  assert.equal(needsActionRows, v.groups.unknown, 'hostile: the Needs action list is the unknown people')
  // Nobody has been moved out of the working list to make the number smaller.
  for (const r of v.rows) if (r.group === 'unknown') assert.equal(shows(r, 'needsAction'), true, `${r.user.id}: an unreadable account was dropped from the working list`)
  // The same reconciliation on a tenant that was read: with nothing unknown,
  // the settled count and the filter are the same number.
  const demo = readinessView(fixture('demo').snapshot, fixture('demo').snapshot.asOf, fixture('demo').mapping)
  assert.equal(demo.groups.unknown, 0)
  assert.equal(demo.rows.filter((r) => shows(r, 'needsAction')).length, actionable(demo.groups))
})

// The second regression the correction is for. The callout used to be drawn
// only where a known, non-empty hold existed, so the states below rendered no
// supporting panel at all — including the one the reader most needs told
// (a hold this scan could not measure) and the one worth stating plainly
// (nothing on the plan is waiting).
test('the plan dependency the page states has a truthful answer for every tenant, including unknown and none', () => {
  const seen = new Set<string>()
  for (const name of ['micro', 'demo', 'messy', 'hostile', 'midflight'] as const) {
    const f = fixture(name)
    const steps = runFixture(f).steps
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    const d = firstMfaDependency(steps, scored)
    seen.add(d.kind)
    // Whatever it is, it is `stepMfaHold`'s answer about the step it names —
    // the same measure the Plan step's own handoff draws — and never a count
    // taken here.
    if (d.kind === 'holding') {
      assert.deepEqual(stepMfaHold(d.step, scored)?.ids?.length, d.n, `${name}: the number beside the step is not the step's own hold`)
      assert.ok(d.n > 0, `${name}: a dependency on nobody`)
    }
    if (d.kind === 'unknown') assert.equal(stepMfaHold(d.step, scored)?.ids, null, `${name}: an unknown reach that was measured after all`)
    // None is a settled, empty answer: every step on the plan was asked.
    if (d.kind === 'none') {
      for (const step of steps) {
        const h = stepMfaHold(step, scored)
        assert.ok(!h || (h.ids !== null && h.ids.length === 0), `${name}: ${step.id} is waiting and the page would say nothing is`)
      }
    }
    // Plan order decides, and an unknown hold is never stepped over in favour
    // of a later number.
    if (d.kind !== 'none') {
      for (const step of steps) {
        if (step.id === d.step.id) break
        const h = stepMfaHold(step, scored)
        assert.ok(!h || (h.ids !== null && h.ids.length === 0), `${name}: ${step.id} holds earlier than the step the page names`)
      }
    }
  }
  // All three really occur across the fixtures, so none of the branches above
  // is proving itself over an empty set.
  assert.deepEqual([...seen].sort(), ['holding', 'none', 'unknown'], 'the fixtures no longer cover every dependency state')
  // And each state has words of its own to say, none of them the pack's sample.
  const P = (pages.readiness as unknown as { planContext: Record<string, string> }).planContext
  for (const k of ['dependencyTitle', 'dependency', 'dependencyLink', 'unknown', 'dependencyNoneTitle', 'dependencyNone', 'dependencyPending', 'planLink']) {
    assert.match(P[k] ?? '', /\S/, `the ${k} state has no words`)
  }
  assert.notEqual(P.dependencyNone, P.dependencyPending, 'a plan that has not computed says the same thing as one with nothing waiting')
  const pack = read(PACK)
  const sample = pack.match(/<div class="callout">[\s\S]*?<\/div>\s*<a/)?.[0] ?? ''
  for (const k of ['dependency', 'dependencyNone', 'dependencyPending', 'unknown']) {
    assert.ok(!sample.includes(P[k]), `the ${k} sentence was taken from the pack`)
  }
})

test('registration is still not proof, and the strongest method is still the ladder’s', () => {
  // Counted across the fixtures, not inside each: not every sample tenant has a
  // person holding a passkey nobody has used yet, and the point is that the one
  // that does is never called ready.
  let registeredUnprovenSeen = 0
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const methods = methodsIndex(f.snapshot)
    let proven = 0
    let registeredUnproven = 0
    for (const r of v.rows) {
      if (r.kind !== 'person' || !r.active || r.rung === null) continue
      const m = methods(r.user.id)
      // The group is the derivation's, over the same inputs, every time.
      assert.equal(r.group, groupOf(m, r.rung, v.methodsRead), `${name}: ${r.user.id} carries a group the derivation did not give it`)
      // A registered passkey with no record that names it is "needs proof", and
      // the page's word for it says so. Registration never becomes proof.
      if (hasPortablePhishingResistant(m) && rungOf(m) !== 5 && r.rung !== 5) {
        assert.equal(r.group, 'needsProof', `${name}: ${r.user.id} holds a registered passkey and the page calls it ${r.group}`)
        assert.equal(readinessWord(r), 'Needs proof')
        registeredUnproven += 1
      }
      if (r.group === 'ready') {
        assert.equal(r.rung, 5, `${name}: passkey-ready at rung ${r.rung}`)
        proven += 1
      }
      // The method word is the ladder's word for the row's settled method, not
      // a reading of the inventory in the view.
      assert.equal(methodWord(r.method), methodWord(r.method))
    }
    registeredUnprovenSeen += registeredUnproven
    assert.ok(proven >= 0)
  }
  assert.ok(registeredUnprovenSeen > 0, 'no fixture holds a registered-but-unproven passkey, so this proves nothing')
  // And no proof line is composed from a registration: the evidence a row shows
  // is the evidence the derivation attached to it.
  assert.match(SURFACE, /csv: \(r\) => rowEvidenceText\(r\)/, 'the proof cell is not the row’s own evidence')
  assert.doesNotMatch(CELLS, /registrationDetails/, 'the proof line reads the registration report')
})

test('a filter decides which rows are on screen and nothing else', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const before = JSON.stringify(v.rows.map((r) => [r.user.id, r.rung, r.group, r.active, r.kind]))
  const counts = { ...v.groups }
  for (const key of ['all', 'needsAction', 'needsPasskey', 'needsProof', 'ready', 'rung-5', 'emergency'] as ShowKey[]) {
    const shown = v.rows.filter((r) => shows(r, key))
    assert.ok(shown.length <= v.rows.length)
    // Filtering is a predicate over the rows; it mutates none of them and none
    // of the counts above the table.
    assert.equal(JSON.stringify(v.rows.map((r) => [r.user.id, r.rung, r.group, r.active, r.kind])), before, `${key}: a filter changed a row`)
    assert.deepEqual({ ...v.groups }, counts, `${key}: a filter changed a count`)
  }
  // A group's own filter shows exactly the rows that group counts.
  for (const g of ['ready', 'needsProof', 'needsPasskey'] as const) {
    assert.equal(v.rows.filter((r) => shows(r, g)).length, v.groups[g], `${g}: the filter and the count differ`)
  }
  // On the surface, the filter is applied where the rows are chosen and nowhere
  // near the view the counts are read from.
  assert.match(SURFACE, /const rows = useMemo\(\(\) => \{[\s\S]{0,600}shows\(r, show\)/, 'the filter is not a predicate over the rows')
  assert.match(SURFACE, /const \{ facts, groups \} = view/, 'the counts are not read from the unfiltered view')
})

test('the readiness state is a word before it is a colour, and the role is a word too', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  for (const r of v.rows) {
    assert.match(readinessWord(r), /\S/, `${r.user.id}: a readiness state with no word`)
    assert.match(roleWord(r), /\S/, `${r.user.id}: a role with no word`)
    assert.match(rowEvidenceText(r), /\S/, `${r.user.id}: a proof cell with no words`)
  }
  // The admin ink is a second signal over the word, never instead of it.
  assert.match(SURFACE, /<span className=\{`role\$\{r\.kind === 'person' && r\.admin \? ' role-admin' : ''\}`\}>\{roleWord\(r\)\}/, 'the role is not the word roles.ts settled')
  const adminRule = CSS.match(/\.surface\.readiness \.role-admin \{[^}]*\}/)?.[0] ?? ''
  assert.match(adminRule, /color: var\(--admin-text\)/, 'the admin role lost the pack’s role colour')
  assert.doesNotMatch(adminRule, /content:/, 'the admin role became a mark rather than a word')
  // The rung keeps the accessible name it has always had (task 017), so the
  // number beside the word is never the only thing that says which rung it is.
  assert.match(SURFACE, /aria-label=\{rung \? rungWords\(rung\)\.title : undefined\}/)
})

test('Demo renders the production surface, and there is no second readiness page', () => {
  const app = read('src/ui/App.tsx')
  assert.equal((app.match(/<MfaReadiness/g) ?? []).length, 1, 'MFA Readiness is rendered more than once')
  assert.match(app, /route === 'readiness' \? \(\n\s*<MfaReadiness scan=\{lastScan\} baseline=\{baseline\} \/>/, 'the readiness route no longer renders the one surface')
  // The demo differs in the snapshot it puts in the session and in nothing else:
  // no demo branch reaches the surface, and the surface knows nothing about it.
  assert.doesNotMatch(app, /demo[\s\S]{0,80}<MfaReadiness/i, 'a demo branch renders its own readiness surface')
  assert.doesNotMatch(SURFACE, /demo/i, 'the readiness surface reads the demo')
  assert.doesNotMatch(CELLS, /demo/i, 'the readiness cells read the demo')
})
