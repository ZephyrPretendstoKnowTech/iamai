// Prompt 62 — MFA Readiness v3, over the one readiness derivation.
//
// Two questions, answered separately because they have different authorities.
//
//   Does production have the SHAPE the owner approved? Every structural
//   assertion is two-sided: it reads the approved pack
//   `docs/design/approved/anatomy/mfa-readiness-v3.html` at test time and fails
//   if the pack stops drawing what production claims to draw, and it reads
//   production (MfaReadiness.tsx, app.css) and fails if production stops
//   drawing it. The pack owns anatomy, never copy: where the pack's sample words
//   and content.json differ, the words are content.json's.
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
import { DEFAULT_SHOW, GROUP_ORDER, SHOW_KEYS, SUB_GROUP_AT, readinessView, shows, subGroupsOf } from '../../derive/mfaReadiness.ts'
import type { ShowKey } from '../../derive/mfaReadiness.ts'
import { READINESS_STATES, isReady } from '../../scoring/phishingResistant.ts'
import { readinessTable } from './inventoryTables.ts'
import { nextCell, roleWord, rowCells, showWord, stateTitle } from './readinessCells.ts'
import { pages } from '../../content/content.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** The old final reference: its hash stays recorded in the reference manifest. */
const REFERENCE = 'docs/design/approved/reference/iamai-mfa-readiness-final.html'
/** The approved anatomy this surface is built against (prompt 62). */
const PACK_PATH = 'docs/design/approved/anatomy/mfa-readiness-v3.html'
const PACK = read(PACK_PATH)
const SURFACE = read('src/ui/surfaces/MfaReadiness.tsx')
const CELLS = read('src/ui/surfaces/readinessCells.ts')
const CSS = read('src/ui/app.css')
const W = pages.readiness as unknown as {
  summary: string
  columns: string[]
  csvColumns: string[]
  states: Record<string, { title: string }>
  groups: Record<string, { title: string; why: string; body?: string }>
  show: Record<string, string>
  panel: { next: string; devices: string; methods: string }
  rail: { setup: string; models: string; counted: string; evidence: string }
}

/** A rule's body in the pack's minified sheet, by its exact selector. */
const packRule = (selector: string): string => {
  const at = PACK.indexOf(`${selector}{`)
  return at === -1 ? '' : PACK.slice(at + selector.length + 1, PACK.indexOf('}', at))
}
/** A rule's body in production's sheet, by its exact selector. */
const cssRule = (selector: string): string => {
  const at = CSS.indexOf(`\n${selector} {`)
  return at === -1 ? '' : CSS.slice(at + selector.length + 3, CSS.indexOf('}', at))
}
/** The pack's `@media (max-width:N)` block body (its nested braces are one level). */
const packMedia = (w: number): string => PACK.match(new RegExp(`@media \\(max-width:${w}px\\)\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
/** Production's `@media (max-width: N)` blocks, joined. */
const cssMedia = (w: number): string => CSS.match(new RegExp(`@media \\(max-width: ${w}px\\) \\{[\\s\\S]*?\\n\\}`, 'g'))?.join('\n') ?? ''

// ------------------------------------------------------- the authority itself

test('the reference this file reads is the one the manifest records, byte for byte', () => {
  const manifest = JSON.parse(read('docs/design/approved/reference/REFERENCE-MANIFEST.json')) as { files: Record<string, string>; mfaReadiness: { file: string; sha256: string; supersedes: string[] } }
  const got = createHash('sha256').update(readFileSync(REFERENCE)).digest('hex')
  assert.equal(manifest.mfaReadiness.file, 'iamai-mfa-readiness-final.html')
  assert.equal(manifest.mfaReadiness.sha256, got, 'the final MFA Readiness reference changed')
  assert.equal(manifest.files[manifest.mfaReadiness.file], got)
  assert.ok(manifest.mfaReadiness.supersedes.some((s) => s.includes('mfa-readiness-v2.html')), 'the manifest does not record what the reference supersedes')
})

test('the surface names the v3 pack as its authority', () => {
  assert.ok(SURFACE.includes(PACK_PATH), 'MfaReadiness.tsx does not name the pack it is built against')
  assert.ok(CSS.includes(PACK_PATH), "the sheet's MFA Readiness block does not name the pack it is built against")
})

// ------------------------------------------------------------- the anatomy

test('the answer is one panel: the sentence, the Seamless goal, the change since the last scan, one bar, its legend and the definition', () => {
  // The pack.
  assert.match(PACK, /<section class="answer" aria-labelledby="answer">\s*<div class="answer-top">\s*<div>\s*<h2 id="answer"><\/h2>\s*<p class="goal" id="goal"><\/p>\s*<\/div>\s*<div class="change" id="change"><\/div>/, 'the pack no longer draws the answer over its goal, beside the change')
  assert.match(PACK, /<div class="ribbon" id="ribbon" aria-hidden="true"><\/div>\s*<ul class="legend" id="legend" aria-label="People by state"><\/ul>\s*<p class="define">/, 'the pack no longer draws one hidden bar, a legend and the definition')
  assert.match(PACK, /`\$\{fmt\(ready\)\} of \$\{fmt\(S\.active\)\} people are ready for phishing-resistant sign-in\.`/)
  assert.match(PACK, /const ready = S\.counts\.seamless \+ S\.counts\.ready/, 'the pack counts Seamless as Ready')
  // The bar and the legend run in the pack's order: the done states first, then the work.
  const packOrder = [...(PACK.match(/counts:\{([^}]*)\}/)?.[1] ?? '').matchAll(/([a-z]+):\d+/g)].map((m) => m[1])
  assert.equal(packOrder.length, READINESS_STATES.length, "the pack's counts do not name every state")
  const legendOrder = [...(SURFACE.match(/const LEGEND_ORDER: readonly ReadinessState\[\] = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(legendOrder, packOrder, "the bar and the legend are not in the pack's order")
  assert.equal((SURFACE.match(/\{LEGEND_ORDER\.filter\(\(s\) => counts\[s\] > 0\)\.map\(/g) ?? []).length, 2, 'the bar and the legend do not share one order')
  // Production, in the same order.
  const panel = SURFACE.slice(SURFACE.indexOf('<section className="readiness-answer panel"'), SURFACE.indexOf('<div className="readiness-layout">'))
  assert.ok(panel.length > 0, 'the answer is not one panel')
  const order = ['<h2 className="headline">{summary}</h2>', '<p className="goal">{goal}</p>', '<div className="readiness-change">', '<div className="readiness-bar" aria-hidden="true">', '<ul className="readiness-legend" aria-label={T.legendLabel}>', '<p className="define">{T.define}</p>']
  let at = -1
  for (const part of order) {
    const next = panel.indexOf(part)
    assert.ok(next > at, `the answer does not draw ${part} in the pack's order`)
    at = next
  }
  assert.equal(W.summary, '{ready} of {active} people are ready for phishing-resistant sign-in.')
  assert.match(SURFACE, /const ready = counts\.ready \+ counts\.seamless/, 'Seamless is not counted as Ready in the sentence')
  assert.match(cssRule('.readiness-answer .answer-top'), /display: flex/)
  assert.match(packRule('.answer-top'), /display:flex/)
  assert.doesNotMatch(SURFACE, /summary-stat|progress-strip|group-tile|RungBadge|rung-badge/, 'a count card, a strip or a rung badge came back')
})

test("the toolbar is a heading, a search, the pack's three filters with Needs action first and on by default, and Export CSV", () => {
  const filters = [...PACK.matchAll(/<button class="pill" type="button" aria-pressed="(true|false)" data-filter="([a-z]+)"[^>]*>([^<]+)<\/button>/g)]
  assert.deepEqual(filters.map((m) => m[3]), ['Needs action', 'Admins', 'Everyone'], "the pack's three filters changed")
  assert.deepEqual(filters.map((m) => m[1]), ['true', 'false', 'false'], 'the pack no longer opens on Needs action')
  assert.deepEqual(SHOW_KEYS.map((k) => showWord(k)), filters.map((m) => m[3]), "the toolbar is not the pack's three filters")
  assert.equal(DEFAULT_SHOW, 'needsAction')
  assert.match(PACK, /<input class="search" type="search" placeholder="[^"]+" aria-label="[^"]+">/)
  assert.match(SURFACE, /<input type="search" placeholder=\{T\.search\} aria-label=\{T\.search\}/)
  assert.match(SURFACE, /\{SHOW_KEYS\.map\(\(k\) => \([\s\S]{0,120}className="pill" aria-pressed=\{show === k\} onClick=\{\(\) => select\(k\)\}/, 'the pills are not controls over the one filter')
  // Needs action carries its count, as the pack's pill does.
  assert.match(PACK, /`Needs action · \$\{fmt\(action\)\}`/)
  assert.match(SURFACE, /\$\{T\.show\.needsAction\} · \$\{action\}/)
  assert.match(SURFACE, /\{T\.exportCsv\}/)
  // The only select on the page is the pack's sub-group "Group by".
  assert.equal((PACK.match(/<select/g) ?? []).length, 1)
  assert.equal((SURFACE.match(/<select/g) ?? []).length, 1)
  assert.match(SURFACE, /<select value=\{groupBy\}/)
  // Pressed is a check mark as well as the accent (task 017).
  assert.match(CSS, /\.surface \.toolbar \.btn\[aria-pressed='true'\]::before \{[^}]*content:/)
})

test("the worklist is the pack's groups in its order, the next check first and open, the done groups quiet", () => {
  const groups = PACK.slice(PACK.indexOf('const GROUPS = ['), PACK.indexOf('\n]', PACK.indexOf('const GROUPS = [')))
  const states = [...groups.matchAll(/\{state:'([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(states, [...GROUP_ORDER], "the worklist's order is not the pack's")
  assert.deepEqual([...groups.matchAll(/\{state:'([a-z]+)'[^\n]*quiet:true/g)].map((m) => m[1]), GROUP_ORDER.filter((s) => isReady(s)), 'the done groups are not the quiet ones')
  for (const s of GROUP_ORDER) assert.ok(W.groups[s].title && W.groups[s].why, `${s}: the group has no heading or reason`)
  // The pack's group: a disclosure whose summary is dot, heading and reason, count, chevron.
  assert.match(PACK, /<details class="group\$\{gr\.quiet\?' quiet':''\}\$\{isNext\?' next':''\}"/)
  assert.match(PACK, /<summary><span class="dot"[^>]*><\/span>\s*<span>\$\{isNext\?'<span class="next-label">Next check<\/span>':''\}<span class="title">\$\{gr\.title\}<\/span><span class="why">\$\{gr\.why\}<\/span><\/span>\s*<span class="count">/)
  assert.match(PACK, /const ordered = lead \? \[lead, \.\.\.GROUPS\.filter\(g=>g!==lead\)\] : GROUPS/, 'the pack no longer leads with the next check')
  // Production draws the same.
  assert.match(SURFACE, /<details key=\{state\} className=\{`readiness-group panel\$\{isNext \? ' next' : ''\}\$\{quiet \? ' quiet' : ''\}`\} open=\{isNext \|\| openAll \|\| undefined\}/)
  const summary = SURFACE.slice(SURFACE.indexOf('<details key={state}'), SURFACE.indexOf('</summary>', SURFACE.indexOf('<details key={state}')))
  const parts = ['<span className={`state-dot s-${state}`} aria-hidden="true" />', '{isNext && <span className="next-label">{T.nextLabel}</span>}', '<span className="group-title">{G.title}</span>', '<span className="group-why">{G.why}</span>', '<span className="group-count">{rows.length}</span>', '<Icon k="chev" />']
  let at = -1
  for (const p of parts) {
    const next = summary.indexOf(p)
    assert.ok(next > at, `the group summary does not draw ${p} in the pack's order`)
    at = next
  }
  assert.match(SURFACE, /const order: ReadinessState\[\] = lead \? \[lead, \.\.\.GROUP_ORDER\.filter\(\(s\) => s !== lead\)\] : \[\.\.\.GROUP_ORDER\]/, 'the next check does not lead the worklist')
  assert.match(SURFACE, /const quiet = isReady\(state\)/)
  // A tenant setup check outranks a group: the pack's admin-next, production's setup-next.
  assert.match(PACK, /<section class="admin-next" aria-labelledby="admin-next"><span class="next-label">Next check<span class="who">/)
  assert.match(SURFACE, /<section className="readiness-setup-next" aria-labelledby="readiness-setup-next">\s*<span className="next-label">[\s\S]{0,80}<span className="who">/)
})

test("a person row is the pack's five zones: the person, the devices seen, the methods, the next step and Details", () => {
  const head = PACK.match(/const HEAD = '<div class="row head">([\s\S]*?)<\/div>'/)?.[1] ?? ''
  const zones = [...head.matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1])
  assert.deepEqual(zones, ['Person', 'Devices seen', 'Methods', 'Next step', 'Details'])
  assert.deepEqual(W.columns, zones.slice(0, 4), "the column words are not the pack's")
  assert.match(head, /<span class="sr">Details<\/span>/, 'the pack no longer leaves the Details column unlabelled on screen')
  // The pack's row, in order.
  const packRow = PACK.slice(PACK.indexOf('function row(p){'), PACK.indexOf('const HEAD'))
  const packOrder = ['<div class="person">', '${deviceChips(p)}', '<div class="methods">', '<div class="next-step">', '<button class="open"']
  let at = -1
  for (const p of packOrder) {
    const next = packRow.indexOf(p)
    assert.ok(next > at, `the pack's row does not draw ${p} in order`)
    at = next
  }
  // Production's row, in the same order.
  const row = SURFACE.slice(SURFACE.indexOf('<div className="readiness-row" key={r.user.id}>'), SURFACE.indexOf('const head = ('))
  const order = ['<div className="person">', '<span className="person-name">', '<span className="person-upn tenant-object">', '<div className="devices">', '<div className="methods">', '<div className="next-step">', 'className="open"']
  at = -1
  for (const p of order) {
    const next = row.indexOf(p)
    assert.ok(next > at, `the row does not draw ${p} in the pack's order`)
    at = next
  }
  // The head row is a visual label only; it repeats the content words and hides from assistive technology.
  assert.match(SURFACE, /<div className="readiness-row head" aria-hidden="true">\s*\{T\.columns\.map/)
  assert.match(cssRule('.readiness-row'), /grid-template-columns: minmax\(150px, 1\.2fr\) minmax\(200px, 1\.3fr\) minmax\(130px, 1fr\) minmax\(160px, 1\.2fr\) auto/)
  assert.match(packRule('.row'), /grid-template-columns:minmax\(150px,1\.2fr\) minmax\(210px,1\.3fr\) minmax\(130px,1fr\) minmax\(170px,1\.2fr\) auto/)
  // The CSV is the row's cells, with the sign-in name, role and state spelled out.
  const f = fixture('demo')
  const t = readinessTable(f.snapshot, f.mapping)
  assert.deepEqual(t.header, W.csvColumns)
  assert.deepEqual(W.csvColumns, [W.columns[0], 'Sign-in name', 'Role', W.columns[1], W.columns[2], 'Readiness', W.columns[3]])
  for (const r of t.rows) assert.equal(r.length, W.csvColumns.length)
})

test('an admin is a tag beside the name, in the admin ink, and the CSV names the role', () => {
  assert.match(PACK, /<strong>\$\{p\.n\}\$\{p\.admin\?'<span class="tag">Admin<\/span>':''\}<\/strong>/)
  assert.match(packRule('.tag'), /color:var\(--admin\)/)
  assert.match(SURFACE, /\{r\.admin && <span className="tag">\{T\.admin\}<\/span>\}/)
  assert.match(CSS, /\.surface\.readiness \.tag \{[^}]*color: var\(--admin-text\)/)
  const f = fixture('demo')
  for (const r of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
    if (r.kind !== 'person') assert.equal(roleWord(r), W.show[r.kind], `${r.user.id}: an account that is not a person names its kind`)
    else assert.equal(roleWord(r), r.admin ? 'Admin' : '', `${r.user.id}: a person's role is Admin or nothing`)
  }
})

test("the status vocabulary is the pack's seven words, each a word beside its dot", () => {
  const block = PACK.slice(PACK.indexOf('const STATES = {'), PACK.indexOf('\n}', PACK.indexOf('const STATES = {')))
  const words = Object.fromEntries([...block.matchAll(/([a-z]+):\{word:'([^']+)'/g)].map((m) => [m[1], m[2]]))
  assert.deepEqual(Object.keys(words).sort(), [...READINESS_STATES].sort(), "the pack's states are not the scoring's")
  for (const s of READINESS_STATES) assert.equal(stateTitle(s), words[s], `${s}: the word is not the pack's`)
  // The pack writes the word beside the dot in the legend and the panel.
  assert.match(PACK, /<li><span class="dot" style="--c:\$\{STATES\[k\]\.c\}"><\/span>\$\{STATES\[k\]\.word\} <b>/)
  assert.match(PACK, /<span class="dot" style="--c:\$\{STATES\[p\.s\]\.c\}"><\/span>\$\{STATES\[p\.s\]\.word\}/)
  // Production does too: legend and panel carry the state's word, the group its heading.
  assert.match(SURFACE, /<span className=\{`state-dot s-\$\{s\}`\} aria-hidden="true" \/>\s*\{stateTitle\(s\)\} <b>\{counts\[s\]\}<\/b>/)
  assert.match(SURFACE, /<span className=\{`state-dot s-\$\{openRow\.state\}`\} aria-hidden="true" \/>\s*\{stateTitle\(openRow\.state\)\}/)
  const demo = readinessView(fixture('demo').snapshot, fixture('demo').snapshot.asOf, fixture('demo').mapping)
  for (const r of demo.rows) if (r.state !== null) assert.equal(rowCells(r)[3], stateTitle(r.state), `${r.user.id}: the CSV state is not the word`)
})

test('the person detail is one non-modal panel: the next step, the devices seen and the phishing-resistant methods', () => {
  assert.match(PACK, /<aside class="panel" id="panel" aria-labelledby="p-name" aria-hidden="true">/)
  assert.deepEqual([...PACK.matchAll(/<section><h3>([^<]+)<\/h3>/g)].map((m) => m[1]), [W.panel.next, W.panel.devices, W.panel.methods], "the panel's sections are not the pack's")
  assert.match(SURFACE, /<aside className="readiness-panel panel" id=\{PANEL_ID\} role="dialog" aria-modal="false" aria-labelledby="readiness-panel-name">/)
  const panel = SURFACE.slice(SURFACE.indexOf('<aside className="readiness-panel panel"'))
  assert.deepEqual([...panel.matchAll(/<h3>\{T\.panel\.([a-z]+)\}<\/h3>/g)].map((m) => m[1]), ['next', 'devices', 'methods'])
  assert.match(panel, /<div className="todo">\s*<strong>\{nextCell\(openRow\)\}<\/strong>/, "the panel's next step is not the row's")
  assert.match(panel, /panelList\(panelDevices\(openRow\)/)
  assert.match(panel, /panelList\(panelMethods\(openRow\)/)
  // The panel never covers the list, and closes on Escape back to what opened it.
  assert.match(PACK, /document\.getElementById\('p-close'\)\.focus\(\)/)
  assert.match(SURFACE, /if \(openRow\) closeRef\.current\?\.focus\(\)/)
  assert.match(SURFACE, /if \(e\.key === 'Escape'\) close\(\)/)
  assert.match(SURFACE, /trigger\.current\?\.focus\(\)/)
  assert.doesNotMatch(SURFACE, /<dialog|detail-block|readiness-detail/, 'the modal Why/Next dialog came back')
  // No second dashboard, no guide panel, no callout, no tip.
  for (const gone of [/RemediationPanel/, /guide-panel/, /<Callout/, /<PageTip/, /methodGuide\(/]) assert.doesNotMatch(SURFACE, gone, `${gone} is back on the page`)
})

test("the rail is the pack's four tiles: tenant setup, approved models, not counted and evidence read", () => {
  assert.match(PACK, /<aside class="rail" aria-label="[^"]+">/)
  assert.match(PACK, /<h3>Tenant setup<\/h3>/)
  assert.match(PACK, /<h3 id="models">Approved passkey models<\/h3>/)
  assert.match(PACK, /<h3>Not counted<\/h3>/)
  assert.match(PACK, /<h3>Evidence read<\/h3>/)
  assert.deepEqual([W.rail.setup, W.rail.models, W.rail.counted, W.rail.evidence], ['Tenant setup', 'Approved passkey models', 'Not counted', 'Evidence read'])
  const rail = SURFACE.slice(SURFACE.indexOf('<aside className="readiness-rail"'), SURFACE.indexOf('</aside>', SURFACE.indexOf('<aside className="readiness-rail"')))
  assert.deepEqual([...rail.matchAll(/<section className="readiness-tile panel" aria-labelledby="readiness-([a-z]+)">/g)].map((m) => m[1]), ['setup', 'models', 'counted', 'evidence'])
  assert.deepEqual([...rail.matchAll(/<h3 id="readiness-[a-z]+">\{T\.rail\.([a-z]+)\}<\/h3>/g)].map((m) => m[1]), ['setup', 'models', 'counted', 'evidence'])
  assert.match(cssRule('.readiness-layout'), /grid-template-columns: minmax\(0, 1fr\) 320px/)
  assert.match(packRule('.layout'), /grid-template-columns:minmax\(0,1fr\) 320px/)
})

test('a large group splits into sub-groups, admins first and open, each shown a page at a time', () => {
  assert.match(PACK, /<details class="sub" open><summary><span><span class="title">Admins<\/span>/, 'the pack no longer opens the admins first')
  assert.match(PACK, /<div class="subbar">/)
  assert.equal(SUB_GROUP_AT, 50)
  assert.match(SURFACE, /if \(rows\.length <= SUB_GROUP_AT\) return <div className="readiness-rows">/)
  assert.match(SURFACE, /<div className="readiness-subbar">/)
  assert.match(SURFACE, /<details className="readiness-sub" key=\{key\} open=\{g\.admins \|\| undefined\}>/)
  // Admins first, every row in exactly one sub-group.
  const f = fixture('demo')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state !== null)
  for (const by of ['devices', 'department'] as const) {
    const subs = subGroupsOf(rows, by)
    if (rows.some((r) => r.admin)) assert.equal(subs[0].admins, true, `${by}: the admins are not first`)
    assert.equal(subs.reduce((n, g) => n + g.rows.length, 0), rows.length, `${by}: a row is in no sub-group, or in two`)
  }
})

test('the worklist stacks at the pack\'s 760 and the rail drops under it at 1040, every field kept', () => {
  const p1040 = packMedia(1040)
  const p760 = packMedia(760)
  assert.match(p1040, /\.layout\{grid-template-columns:1fr\}/)
  assert.match(p1040, /\.rail\{position:static;grid-template-columns:repeat\(auto-fit,minmax\(260px,1fr\)\)\}/)
  assert.match(p760, /\.row\.head\{display:none\}/)
  assert.match(p760, /\.row\{grid-template-columns:1fr auto;gap:6px 12px\}/)
  assert.match(p760, /\.row>\.devices,\.row>\.methods,\.row>\.next-step\{grid-column:1\/-1\}/)
  assert.match(p760, /\.row>\.open\{grid-row:1;grid-column:2\}/)

  const at1040 = cssMedia(1040)
  assert.match(at1040, /\.readiness-layout \{\s*grid-template-columns: 1fr;/, 'production does not stack the rail at 1040')
  assert.match(at1040, /\.readiness-rail \{\s*position: static;\s*grid-template-columns: repeat\(auto-fit, minmax\(260px, 1fr\)\);/)
  const at760 = cssMedia(760)
  assert.match(at760, /\.readiness-row\.head \{\s*display: none;/)
  assert.match(at760, /\.readiness-row \{\s*grid-template-columns: 1fr auto;/, 'production does not stack the rows at 760')
  assert.match(at760, /\.readiness-row > \.devices,\s*\.readiness-row > \.methods,\s*\.readiness-row > \.next-step \{\s*grid-column: 1 \/ -1;/)
  assert.match(at760, /\.readiness-row > \.open \{\s*grid-row: 1;\s*grid-column: 2;/)
  for (const field of ['.person', '.devices', '.methods', '.next-step', '.open', '.dev-word']) {
    assert.doesNotMatch(at760, new RegExp(`${field.replace('.', '\\.')}\\s*\\{[^}]*display:\\s*none`), `${field} is hidden on a phone`)
  }
  assert.doesNotMatch(CSS, /\.readiness-row[^{]*::(before|after)\s*\{[^}]*content:/, 'a row label is generated content')
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
  assert.equal(v.rows.filter((r) => shows(r, 'all')).length, v.facts.active)
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
  assert.ok(v.facts.active > 0, 'the hostile fixture has active people')
  assert.equal(v.counts.unknown, v.facts.active)
  assert.equal(v.counts.method, 0)
  assert.equal(v.counts.ready + v.counts.seamless, 0)
  for (const r of v.rows.filter((x) => x.state === 'unknown')) {
    assert.equal(r.readiness?.next.kind, 'rescan', `${r.user.id}: an unread person is given something to do`)
    assert.doesNotMatch(nextCell(r), /^Set up/, `${r.user.id}: an unread person is told to set up a method`)
  }
  assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, v.counts.unknown, 'the unread people stay on the working list')
})

test('Demo renders the production surface, and there is no second readiness page', () => {
  const app = read('src/ui/App.tsx')
  assert.equal((app.match(/<MfaReadiness/g) ?? []).length, 1, 'MFA Readiness is rendered more than once')
  assert.match(app, /route === 'readiness' \? \(\n\s*<MfaReadiness scan=\{lastScan\} baseline=\{baseline\} \/>/)
  assert.doesNotMatch(app, /demo[\s\S]{0,80}<MfaReadiness/i)
  assert.doesNotMatch(SURFACE, /demo/i, 'the readiness surface reads the demo')
  assert.doesNotMatch(CELLS, /demo/i, 'the readiness cells read the demo')
})
