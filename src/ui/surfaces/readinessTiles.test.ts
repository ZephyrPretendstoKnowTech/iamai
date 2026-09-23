// S5 — Readiness is the only prerequisite surface (A1 §16.1).
//
// The unresolved prerequisites of the opened step's next action are shown once,
// as tiles: one per outstanding fix, one per engine blocker the fixes do not
// already state, each linking to its step or to Baseline mappings, the hardening
// last and never a block. Resolved tiles leave the unresolved list; with nothing
// unresolved the region collapses to its compact success line, and the satisfied
// evidence stays readable behind its own disclosure. Fix before continuing, the
// hardening section and the prerequisites count tile are gone from the step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { CONTRACT, readinessOf, stepContract } from './stepContract.ts'
import type { PrerequisiteBlocker } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import type { HoldBlockerKind } from '../../actionability/lanes.ts'
import { BOARD, laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { mergeReadiness } from './stepPackage.ts'
import { BLOCKED_REASON, BLOCKED_SUBJECT } from '../../copy/reasons.ts'
import { returnToStep } from '../shell/routes.ts'
import { CHECK_STATE, RULE_TEXT } from '../../copy/validation.ts'
import { rulesFor } from '../../validation/rules.ts'

const read = (p: string): string => readFileSync(p, 'utf8')
const CONTENT_STEP = read('src/ui/surfaces/ContentStep.tsx')
const SECTIONS = read('src/ui/surfaces/StepSections.tsx')
const CSS = read('src/ui/app.css')
const CONTENT = read('docs/design/content.json')
const EMERGENCY = 's-prereq-break-glass'

function opened(name: 'demo' | 'demo-week2' | Fixture, id: string) {
  const f: Fixture = typeof name === 'string' ? fixture(name) : name
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === id)
  assert.ok(step, `${f.name} carries no ${id}`)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
  const readings = laneReadings(r.steps)
  const titleOf = (x: string): string | null => r.steps.find((s) => s.id === x)?.title ?? null
  const blockers = readinessBlockersOf(readings.get(id), titleOf)
  // The board's one state reading of the step (A1b): the bar is keyed by it.
  const lane = laneViewOf(readings.get(id)!, titleOf)
  return { f, r, step, ctx, c: stepContract(step, ctx, undefined, lane), blockers, reading: readings.get(id)!, lane }
}

test('one tile per outstanding fix, each linking to its step or to Baseline mappings; no count tile stands in for them', () => {
  const { step, c, blockers } = opened('demo', 's-goal-mfa-all-users')
  assert.deepEqual(c.fix.map(f => f.key), [`step:${EMERGENCY}`], 'unexplained optional source exclusions do not create public mapping blockers')
  const r = readinessOf(step, c, blockers)
  assert.equal(r.tiles.some(t => t.key === 'mapping'), false)
  const prereq = r.tiles.find((t) => t.key === `step:${EMERGENCY}`)!
  // The card is headed by what is being waited on, with its state beneath
  // (owner, 2026-09-20): the step it waits on heads it, and the prerequisite
  // word is the check.
  assert.equal(prereq.label, 'Prepare Emergency Access Accounts')
  assert.equal(prereq.value, CONTRACT.readiness.tiles.prerequisite)
  assert.ok(prereq.link && 'href' in prereq.link && prereq.link.href === returnToStep(EMERGENCY), 'the step tile does not open its step')
  assert.equal(r.tiles.some((t) => t.key === 'blockers' || /remaining$/.test(t.value)), false, 'a prerequisites count tile is back')
  // The engine's pending mappings beside the fix's mapping are the one mapping tile: the same blocker is never shown twice.
  // The demo's enforced policy is no longer held on its mappings (U21, B1), so the engine's two are stated here.
  const pending = (id: string): PrerequisiteBlocker => ({ kind: 'sourceMapping', id, abnormal: true, label: BOARD.blockers.sourceMapping, title: null })
  const mapped = readinessOf(step, c, [...blockers, pending('mapping:a'), pending('mapping:b')])
  assert.equal(mapped.tiles.filter((t) => t.label === CONTRACT.readiness.tiles.mapping).length, 2)
  assert.equal(r.tiles.filter((t) => t.label === CONTRACT.readiness.tiles.mapping).length, 0)
  for (const t of r.tiles) assert.ok(t.tone === 'warn' || t.tone === 'wait', `${t.key}: a satisfied tile among the unresolved`)
})

test('the engine’s blockers the fixes do not name become tiles: a queued step is a wait with a link, a hold needs attention, the step’s own decision is not a prerequisite of itself', () => {
  const { step, c } = opened('demo', 's-goal-mfa-all-users')
  const queued: PrerequisiteBlocker = { kind: 'step', id: 's-prereq-trusted-location', abnormal: false, label: BOARD.blockers.step, title: 'Trusted network' }
  const held: PrerequisiteBlocker = { kind: 'license/platform', id: 'license:p2', abnormal: true, label: BOARD.blockers['license/platform'], title: null }
  const own: PrerequisiteBlocker = { kind: 'step', id: EMERGENCY, abnormal: true, label: BOARD.blockers.step, title: 'Emergency' }
  const r = readinessOf(step, c, [queued, held, own, queued])
  const q = r.tiles.find((t) => t.key === `engine:step:${queued.id}`)!
  assert.equal(q.tone, 'wait')
  assert.ok(q.link && 'href' in q.link && q.link.href === returnToStep(queued.id))
  assert.equal(r.tiles.filter((t) => t.key === q.key).length, 1, 'a blocker read twice is two tiles')
  const h = r.tiles.find((t) => t.key === `engine:license/platform:${held.id}`)!
  assert.equal(h.tone, 'warn')
  assert.equal(h.value, BOARD.blockers['license/platform'])
  assert.equal(r.tiles.filter((t) => t.key.endsWith(EMERGENCY)).length, 1, 'the fix’s step tile and the engine’s are two tiles for one step')
  // The device decision's step is retired (its questions are Decide How People and Devices Sign In's,
  // which draws Questions and no Readiness). The decision a person still owes on a step with a
  // Readiness region is the exclusions group's.
  const { step: d, c: dc } = opened(noExclusionsAnswer(fixture('demo-week2')), 's-prereq-exclusion-group')
  assert.equal(dc.state.condition, 'needs-decision', 'the premise: the exclusions decision is the step’s own')
  const own2 = readinessOf(d, dc, [{ kind: 'decision', id: 'decision:exclusions-decision', abnormal: false, label: BOARD.blockers.decision, title: null }])
  assert.equal(own2.tiles.some((t) => t.key.startsWith('engine:decision')), false, 'the step’s own decision is listed as a prerequisite of itself')
})

test('with nothing unresolved the region is its compact success line and the satisfied evidence stays expandable', () => {
  const { step, c, blockers } = opened('demo-week2', EMERGENCY)
  const r = readinessOf(step, c, blockers)
  assert.deepEqual(r.tiles, [])
  assert.equal(r.satisfied.length, 2)
  assert.ok(r.satisfied.every(t => t.key.startsWith('configuration:') && t.tone === 'good'))
  assert.equal(r.bar.main, CONTRACT.lifecycle['in-place'], 'a completed step’s bar is not the tenant fact (A1b)')
  const section = SECTIONS.slice(SECTIONS.indexOf('export function ReadinessSection('), SECTIONS.indexOf('/** The truthful no-action box'))
  assert.match(section, /readiness\.tiles\.length > 0 \? \(\s*strip\(readiness\.tiles, 'unresolved'\)\s*\) : \(\s*<p className="readiness-clear">/, 'nothing unresolved does not collapse to the success line')
  assert.match(section, /<details className="readiness-satisfied" open=\{printing \|\| undefined\}>/, 'the satisfied evidence is not behind its own disclosure')
  assert.match(section, /<div id=\{detailId\} className="tile-detail" hidden=\{!shown\}>/, 'a tile’s explanation is not behind its disclosure')
  assert.match(section, /'href' in t\.link \? <a href=\{t\.link\.href\}>/, 'a step tile does not link')
  assert.match(CSS, /\.step \.readiness-strip \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/, 'the strip is not four across')
  assert.match(CSS, /\.step \.readiness-clear \{/, 'the success line has no treatment')
})

test('Fix before continuing, the hardening section and the Needs attention pointer are gone from the step', () => {
  for (const gone of ['<FixBeforeContinuing', '<HardeningRecommendations', 'fixHeading', 'W.preview.checks']) assert.equal(CONTENT_STEP.includes(gone), false, `ContentStep still draws ${gone}`)
  for (const gone of ['export function FixBeforeContinuing', 'export function HardeningRecommendations', 'CONTRACT.fixHeading']) assert.equal(SECTIONS.includes(gone), false, `StepSections still exports ${gone}`)
  // The content file no longer points at a container that does not exist (the export's section heading keeps the key).
  assert.equal((CONTENT.match(/Fix before continuing/g) ?? []).length, 1)
  const { step, c, blockers } = opened('demo', EMERGENCY)
  const r = readinessOf(step, c, blockers)
  // Step 1 states its facts as findings (c1cacf21); no check tile stands beside them.
  assert.ok([...r.tiles, ...r.satisfied].every((t) => t.key.startsWith('configuration:')), r.tiles.map((t) => t.key).join(' | '))
  assert.equal(c.doneWhen.some((l) => /Fix before continuing/.test(l)), false)
})

test('the Emergency Access step is Why → Readiness → account selection → Implementation → Done when, and a selected set is never "not held"', () => {
  // The account selection is the action column's (U2), between Readiness and Implementation in the DOM (U5).
  const main = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<div className="step-main step-main-lead">'), CONTENT_STEP.indexOf('<StepFooter'))
  const at = (needle: string): number => {
    const i = main.indexOf(needle)
    assert.ok(i >= 0, `the opened step no longer renders ${needle}`)
    return i
  }
  const order = [at('<h4>{taskHead?.why ?? decisionHead?.why ?? HEAD.why}</h4>'), at('<ReadinessSection'), at('decides && <Decision'), at('<Implementation\n'), at('<DoneWhen heading={taskHead?.doneWhen ?? decisionHead?.doneWhen ?? HEAD.doneWhen}')]
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the regions are out of order')
  const { step, ctx, c } = opened('demo', EMERGENCY)
  assert.ok((ctx.mapping.breakGlassUserIds?.length ?? 0) > 1, 'the premise: two accounts are selected')
  assert.equal(c.whatToDo.kind, 'deploy')
  // Two selected accounts each owing work: the one-account channel takes one and is
  // simply not offered (S6) — never a line saying IAMAI does not hold the account.
  assert.equal(CONTENT_STEP.includes('W.withheld'), false, 'the step still draws a withheld-channel line')
  assert.equal('withheld' in CONTRACT.implementation, false)
})

test('the package’s gates merge without a cap: unresolved after the runtime’s own tiles, satisfied as evidence', () => {
  const { step, c } = opened('demo', EMERGENCY)
  const runtime = readinessOf(step, c)
  const merged = mergeReadiness(runtime, {
    tiles: [
      { id: 'pkg.open', gate: 'Safe to prove', result: 'Unknown', line: 'x', gateKey: null, confirm: null },
      { id: 'pkg.done', gate: 'Safe to continue', result: 'Ready', line: 'y', gateKey: null, confirm: null },
      { id: 'pkg.same', gate: 'Emergency access', result: 'Blocked', line: 'z', gateKey: 'configuration:recovery-methods', confirm: null },
    ],
    conclusion: null,
    whyItMatters: null,
    unknowns: [],
    references: [],
  })
  assert.deepEqual(merged.tiles.map((t) => t.key), [...runtime.tiles.map((t) => t.key), 'pkg.open'])
  assert.deepEqual(merged.satisfied.map((t) => t.key), [...runtime.satisfied.map((t) => t.key), 'pkg.done'])
})

test('the printed step and the screen read the same blockers, the row hands them to the step, and a tile’s link opens its step under its own tab', () => {
  assert.match(read('src/ui/surfaces/PrintPlan.tsx'), /blockers=\{blockersOf\(s\)\}/)
  const plan = read('src/ui/surfaces/Plan.tsx')
  // `enforceWaits` sits between them now: the Cleanup work the enforce
  // checklist's own conditions depend on, which is not a prerequisite of this
  // step's next action and so is not among `blockers` (stepBody.ts).
  assert.match(plan, /blockers=\{readinessBlockersOf\(reading, titleOf\)\} enforceWaits=\{enforceWaits\} prerequisiteLabel=\{prerequisiteLabel\} onOpenMappings=\{openSettings\}/)
  // A prerequisite in another lane: the tab follows the step the link opened, or the link
  // would open nothing on screen. The fourth tab (All work) shows every lane, so a step
  // opened there is already on screen and the tab stays where the operator put it.
  assert.match(plan, /const openTab = open && tab !== ALL_WORK_TAB \? \(TAB_OF\[readings\.get\(open\)\?\.lane \?\? 'Completed'\] \?\? null\) : null/)
  assert.match(plan, /<TabFollowsOpenStep open=\{open\} openTab=\{openTab\} tab=\{tab\} onTab=\{setTab\}[^>]*\/>/)
  assert.match(plan, /if \(open && openTab && openTab !== tab\) onTab\(openTab\)/)
  // Narrow widths: two across at the pack's first breakpoint, one at the second; nothing hidden.
  const narrow = (w: number): string => CSS.slice(CSS.indexOf(`@media (max-width: ${w}px)`))
  assert.match(narrow(940), /\.step \.readiness-strip,\s*\.step \.readiness-strip\.tiles-3 \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(narrow(650), /\.step \.readiness-strip,\s*\.step \.readiness-strip\.tiles-3,\s*\.step \.readiness-strip\.tiles-2 \{\s*grid-template-columns: minmax\(0, 1fr\);/)
  const { reading, blockers } = opened('demo', 's-goal-mfa-all-users')
  assert.equal(blockers.length, reading.blockers.length)
  for (const b of blockers) assert.equal(b.label, BOARD.blockers[b.kind as HoldBlockerKind])
})

test('a card is headed by what is being waited on, with its state beneath', () => {
  // The card shape (owner, 2026-09-20; quality audit 2.4): a step that waits on
  // four others drew four cards all headed "Prerequisite · To do", each naming a
  // different step underneath — the inverse of an Emergency Access card, where
  // the subject heads it and the check is beneath.
  const { step, c, blockers } = opened('demo', 's-goal-geo-restriction')
  const r = readinessOf(step, c, blockers)
  const waits = r.tiles.filter((t) => /^(?:step|missing|direction|engine:step|engine:suspendedPrerequisite|engine:decision):/.test(t.key))
  assert.ok(waits.length > 1, 'the premise: this step waits on more than one thing')
  assert.equal(new Set(waits.map((t) => t.label)).size, waits.length, 'two cards are headed the same')
  for (const t of waits) {
    assert.match(t.value, /^(?:Prerequisite\b|Baseline mapping$|Waiting on your direction$)/, `${t.key}: the check is not a state`)
    assert.notEqual(t.label, t.value, `${t.key}: the heading and the check say the same thing`)
    assert.ok(t.link, `${t.key}: the card does not open what it names`)
  }
})

test('a blocker heads its card with its subject and states the binding beneath', () => {
  // The `blocked.*` bindings were written to follow "Blocked · ", so as card
  // headings they read lowercase and mid-clause: "when 1 Temporary Access Pass
  // policy exists (now 0)", "after: Identify the Inforcer application" (quality
  // audit 2.3). The subject is the heading; the binding is the note.
  const { step, c, blockers } = opened('demo', 's-goal-inforcer-mfa')
  const r = readinessOf(step, c, blockers)
  const blocker = r.tiles.find((t) => t.key === 'evidence:inforcer-application')
  assert.ok(blocker, 'the premise: this step waits on the Inforcer application')
  assert.equal(blocker.value, BLOCKED_SUBJECT['inforcer-application'])
  assert.equal(blocker.note, BLOCKED_REASON.after('Identify the Inforcer application'))
  // Every subject is a heading, not a clause: no leading lowercase, no "after:".
  for (const [key, subject] of Object.entries(BLOCKED_SUBJECT)) {
    assert.match(subject, /^[A-Z]/, `${key}: a card heading starts mid-sentence`)
    assert.ok(subject.length <= 40, `${key}: a card heading is a paragraph`)
  }
})

test('a count of one bends the verb a binding uses', () => {
  // "when 1 Temporary Access Pass policy exist (now 0)" — the pluraliser bends
  // the verb after a count, and `exist` was missing from its table.
  assert.equal(BLOCKED_REASON.exist(1, 'Temporary Access Pass policy', 0), 'when 1 Temporary Access Pass policy exists (now 0)')
  assert.equal(BLOCKED_REASON.exist(2, 'trusted location', 0), 'when 2 trusted locations exist (now 0)')
})

test('two configuration checks that produce the same card draw one card', () => {
  // One step drew "Allowed countries · Not Fully Read · Missing scan evidence:
  // sign-in records" twice, from two different check keys. A reader counts two
  // problems where there is one, and then reasonably wonders what else on the
  // page is doubled. `directOnly` deduped tiles naming the same STEP; two
  // checks can still come out byte for byte identical.
  for (const name of ['demo', 'hostile', 'midflight', 'large', 'mid', 'getiamai'] as const) {
    const f = fixture(name)
    const run = runFixture(f)
    const ctx: StepVarContext = {
      snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id),
      signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups,
    }
    for (const step of run.steps) {
      const r = readinessOf(step, stepContract(step, ctx))
      for (const list of [r.tiles, r.satisfied]) {
        const cards = list.filter((t) => t.key.startsWith('configuration:')).map((t) => JSON.stringify([t.label, t.value, t.note]))
        assert.equal(cards.length, new Set(cards).size, `${name}/${step.id} draws the same card twice`)
      }
    }
  }
})

// R4-58: the allowed-countries step headed every finding with the object it
// checked, so its three checks all read "Allowed countries". On hostile, whose
// sign-in records could not be used at all, the two checks that need them came
// out byte for byte alike and the test above's fold drew one card naming
// neither — one of them the lockout check for the countries people actually
// sign in from. And "Not Fully Read" called a total refusal a partial read. A
// finding is now headed by its check, and a check that never ran reads Not Read.
test('each configuration check on the allowed-countries step is its own card, and one that never ran reads Not Read', () => {
  const f = fixture('hostile')
  assert.equal(f.snapshot.sources.signInEvidence?.status, 'insufficient', 'the premise: hostile\'s sign-in records could not be used')
  const { step, c } = opened(f, 's-prereq-allowed-countries')
  const cards = readinessOf(step, c).tiles.filter((t) => t.key.startsWith('configuration:'))
  const labels = cards.map((t) => t.label)
  assert.equal(labels.length, new Set(labels).size, `two checks share a heading: ${labels.join(' | ')}`)
  const card = (id: string) => cards.find((t) => t.key.startsWith(`configuration:${id}:`))
  for (const id of ['cty.seenCountriesIncluded', 'cty.includesOperator', 'cty.unknownCountries']) {
    assert.ok(card(id), `${id} draws no card: it was folded into another`)
    assert.equal(card(id)!.label, RULE_TEXT[id].label, `${id} is not headed by its check`)
  }
  assert.equal(card('cty.seenCountriesIncluded')!.label, 'Countries People Sign In From')
  assert.equal(card('cty.includesOperator')!.label, 'Administrator Sign-in Countries')
  for (const id of ['cty.seenCountriesIncluded', 'cty.includesOperator']) {
    assert.equal(card(id)!.value, CHECK_STATE.notRead, `${id} never ran and reads "${card(id)!.value}"`)
    assert.match(card(id)!.note ?? '', /sign-in records/, `${id} does not name the source it lacked`)
  }
  for (const t of cards) assert.notEqual(t.value, CHECK_STATE.notFullyRead, `${t.label} calls sign-in records nobody could use partly read`)
  assert.equal(card('cty.unknownCountries')!.value, CHECK_STATE.fail)
  // Every check drawn this way has a heading of its own: a card heading, not a
  // clause, and no two alike on one step.
  for (const subject of ['trustedLocation', 'allowedCountries', 'authStrength'] as const) {
    const rules = rulesFor(subject)
    const own = rules.map((r) => RULE_TEXT[r.id]?.label)
    for (const [i, label] of own.entries()) {
      assert.ok(label, `${rules[i].id} has no heading of its own`)
      assert.match(label, /^[A-Z]/, `${label}: a card heading starts mid-sentence`)
      assert.ok(label.length <= 40, `${label}: a card heading is a paragraph`)
    }
    assert.equal(own.length, new Set(own).size, `${subject}: two checks share a heading`)
  }
})

// R4-58, the third case: a check that ran on sign-in records the scan read and
// found nothing to decide on is Not Fully Read — and its note said "Missing scan
// evidence: sign-in records", the words for a source never collected. The state
// said the records were read and the note said they were missing, on one card.
// On small, whose sign-in records were read, with no administrator's sign-in
// carrying a country and no counts by country, both checks ran and could not
// decide; each says so in its own words.
test('a country check that ran on sign-in records holding nothing to decide on reads Not Fully Read, and never calls the records missing', () => {
  const f = structuredClone(fixture('small'))
  assert.equal(f.snapshot.sources.signInEvidence?.status, 'ok', 'the premise: small\'s sign-in records were read')
  for (const id of Object.keys(f.snapshot.roles?.active ?? {})) {
    const e = f.snapshot.signInEvidence[id]
    if (e) e.countries = []
  }
  if (f.snapshot.evidenceAggregates) (f.snapshot.evidenceAggregates as { byCountry: unknown }).byCountry = null
  const { step, c } = opened(f, 's-prereq-allowed-countries')
  const cards = readinessOf(step, c).tiles.filter((t) => t.key.startsWith('configuration:'))
  for (const id of ['cty.includesOperator', 'cty.seenCountriesIncluded']) {
    const card = cards.find((t) => t.key.startsWith(`configuration:${id}:`))
    assert.ok(card, `${id} draws no card`)
    assert.equal(card.value, CHECK_STATE.notFullyRead, `${id} ran and reads "${card.value}"`)
    assert.doesNotMatch(card.note ?? '', /Missing scan evidence/, `${id} ran on the sign-in records and calls them missing: "${card.note}"`)
    assert.match(card.note ?? '', /sign-in records this scan read/, `${id} does not say what the records it read hold`)
  }
})

// R4-58, the other half: headed by its check, a finding still names the object
// it is about. The trusted-location step runs the same checks over every saved
// location; without the location's name in the note, two locations failing one
// check would be the same card, and the fold would drop one of them.
test('two trusted locations failing the same check stay two cards, each naming its location', () => {
  const f = structuredClone(fixture('demo'))
  const rows = f.snapshot.config.namedLocations.rows as { id: string; displayName: string; ipRanges?: { cidrAddress: string }[] }[]
  const office = rows.find((r) => Array.isArray(r.ipRanges))!
  office.ipRanges = [{ cidrAddress: '0.0.0.0/0' }]
  rows.push({ ...structuredClone(office), id: 'loc-branch', displayName: 'Branch Office' })
  f.mapping.trustedLocationIds = [office.id, 'loc-branch']
  f.mapping.wizardAnswered.trustedLocations = true
  if (f.mapping.assumed) delete (f.mapping.assumed as Record<string, unknown>).trustedLocations
  const r = runFixture(f, { snapshot: f.snapshot, mapping: f.mapping })
  const step = r.steps.find((s) => s.id === 's-prereq-trusted-location')!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const wide = readinessOf(step, stepContract(step, ctx)).tiles.filter((t) => t.key.startsWith('configuration:loc.notWholeInternet:'))
  assert.equal(wide.length, 2, `the two locations' whole-internet findings drew ${wide.length} cards`)
  for (const t of wide) assert.equal(t.label, RULE_TEXT['loc.notWholeInternet'].label, 'the finding is not headed by its check')
  assert.deepEqual(wide.map((t) => (t.note ?? '').split(':')[0]).sort(), ['Branch Office', office.displayName].sort(), 'a card does not name the location it is about')
})

// R4-16 (Marcus D6), second half. Four risk policies read "On Hold · After
// Prepare Your Team for MFA" on the board, and each opened on one tile, "Verify
// Emergency Access · To do": the campaign itself waits on the drill, so the
// direct-only rule dropped it as "waiting on another". One row and its page
// named different prerequisites, and the one the row named was on the page
// nowhere. The row's own prerequisite (the lane's reason) is always drawn; the
// one that can be done today stays beside it.
test('the prerequisite the row names is on the opened step, beside the one that can be done today', () => {
  // A policy with no step of its own to finish first, so the two below are its only prerequisites.
  const { step, c } = opened('demo-week2', 's-goal-register-info-protected')
  assert.equal(readinessOf(step, c, []).tiles.some((t) => /^(step|missing):/.test(t.key)), false, 'the premise: no other prerequisite tile')
  const drill: PrerequisiteBlocker = { kind: 'step', id: 'cleanup-drill', abnormal: false, label: BOARD.blockers.step, title: 'Verify Emergency Access' }
  const campaign: PrerequisiteBlocker = { kind: 'step', id: 's-verify-mfa', abnormal: false, label: BOARD.blockers.step, title: 'Prepare Your Team for MFA' }
  const drawn = (bs: PrerequisiteBlocker[]): string[] => readinessOf(step, c, bs).tiles.map((t) => t.key).filter((k) => k.startsWith('engine:step:'))
  assert.deepEqual(drawn([drill, campaign]), ['engine:step:cleanup-drill'], 'the premise: the campaign waits on the drill, so a prerequisite no row names is still left to the drill')
  assert.deepEqual(drawn([drill, { ...campaign, primary: true }]), ['engine:step:cleanup-drill', 'engine:step:s-verify-mfa'])
  // And the board marks which one its row names: the lane's own reason.
  const reading = { lane: 'On Hold' as const, substatus: null, reason: { kind: 'step' as const, id: 's-verify-mfa', milestone: null, condition: null, abnormal: false, ordinal: 5 }, blockers: [{ kind: 'step' as const, id: 'cleanup-drill', milestone: null, condition: null, abnormal: false, ordinal: 1 }, { kind: 'step' as const, id: 's-verify-mfa', milestone: null, condition: null, abnormal: false, ordinal: 5 }], gates: [], order: 0, fromEngine: true }
  const marked = readinessBlockersOf(reading as never, () => null)
  assert.deepEqual(marked.filter((b) => b.primary === true).map((b) => b.id), ['s-verify-mfa'])
})

// R4-33 (Marcus D15). The Threshold card said "The step that moves this number
// is “Prepare Your Team for MFA”", and that step was On Hold behind Register Your
// Own Passkey, which was Up Next behind Verify Emergency Access: the reader was
// sent to a held step and had three hops across three tabs to find the first
// thing anybody could do. The board's own readings know the chain. Rendered with
// them, as the Plan renders it, the card names where the chain starts and opens
// it; where the campaign itself can be done today it names the campaign alone.
test('a Threshold card whose campaign is held names where its chain starts, and opens it', async () => {
  const { cleanupComplete } = await import('../../roadmap/cleanupDone.ts')
  const { cleanupEntry } = await import('./cleanupExport.ts')
  const { chainStartOf, prerequisiteLabelFor } = await import('./planBoard.ts')
  const { cleanupTitleOf } = await import('./stepContract.ts')
  const seen = { held: 0, clear: 0 }
  for (const name of ['demo', 'mid', 'midflight'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const rows = (r.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, f.mapping.breakGlassAnswers ?? null), afterRollout: ['alerting', 'consolidation', 'naming'].includes(row.kind) }))
    const readings = laneReadings(r.steps, rows)
    const titleOf = (x: string): string | null => r.steps.find((s) => s.id === x)?.title ?? cleanupTitleOf(x)
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate?.routeId || gate.blind !== undefined || step.status === 'done' || step.status === 'skipped' || step.state.lifecycle === 'enforced') continue
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null }
      const reading = readings.get(step.id)!
      // The board's chain goes into the contract, which works out where the
      // route starts once for the card and every finding (StepContract.routeStart);
      // handed to the card alone, the finding and the AI Info briefing kept
      // naming the held campaign (review of R4-33).
      const label = prerequisiteLabelFor(readings)
      const c = stepContract(step, ctx, undefined, laneViewOf(reading, titleOf), label.startOf)
      const tile = readinessOf(step, c, readinessBlockersOf(reading, titleOf), label).tiles.find((t) => t.key === 'gate')!
      assert.ok(tile.link && 'href' in tile.link, `${name}/${step.id}: the card opens nothing`)
      const start = chainStartOf(readings, gate.routeId)
      if (readings.get(gate.routeId)!.lane === 'Ready') {
        seen.clear++
        assert.equal(start, null)
        assert.ok(tile.note!.endsWith(`“${gate.route}”.`), `${name}/${step.id}: a campaign that can be done today is named alone — ${tile.note}`)
        assert.equal(tile.link.href, returnToStep(gate.routeId))
        continue
      }
      seen.held++
      assert.ok(start !== null, `${name}/${step.id}: the campaign is held and the board found no start — ${JSON.stringify(readings.get(gate.routeId)!.reason)}`)
      assert.equal(readings.get(start)!.lane, 'Ready', `${name}/${step.id}: "where to start" is not a step anybody can do today`)
      const first = titleOf(start)!
      assert.ok(tile.note!.includes(`“${gate.route}”; it waits on “${first}”, which is where to start.`), `${name}/${step.id}: ${tile.note}`)
      assert.equal(tile.link.href, returnToStep(start), `${name}/${step.id}: the card opens the held campaign, not where to start`)
    }
  }
  assert.ok(seen.held > 0 && seen.clear > 0, `the premise: both a held and a clear campaign — ${JSON.stringify(seen)}`)
})

// R4-33, second half. Where the chain starts was worked out in the Threshold
// card alone, from the label the board hands the card; the contract's own
// finding was built without it. So the Evidence dialog and the AI Info briefing
// (both read the contract's findings) still sent the reader to the held
// campaign, and the printed plan, which prints a finding only where no card says
// it word for word, printed the threshold twice: the card's version, then the
// finding's. Rendered as the Plan and the print render it, the card, the finding
// and the briefing name the same place to start, and the print says it once.
test('the Threshold card, its finding and the AI Info briefing name the same place to start', async () => {
  const { cleanupComplete } = await import('../../roadmap/cleanupDone.ts')
  const { cleanupEntry } = await import('./cleanupExport.ts')
  const { prerequisiteLabelFor } = await import('./planBoard.ts')
  const { cleanupTitleOf } = await import('./stepContract.ts')
  const { stepBodyOf } = await import('./stepBody.ts')
  let held = 0
  for (const name of ['small', 'midflight', 'messy'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const rows = (r.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, f.mapping.breakGlassAnswers ?? null), afterRollout: ['alerting', 'consolidation', 'naming'].includes(row.kind) }))
    const readings = laneReadings(r.steps, rows)
    const titleOf = (x: string): string | null => r.steps.find((s) => s.id === x)?.title ?? cleanupTitleOf(x)
    const label = prerequisiteLabelFor(readings)
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate?.routeId || gate.blind !== undefined || step.status === 'done' || step.status === 'skipped' || step.state.lifecycle === 'enforced') continue
      const start = label.startOf!(gate.routeId)
      if (start === null) continue
      held++
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null }
      const reading = readings.get(step.id)!
      const b = stepBodyOf(step, ctx, { lane: laneViewOf(reading, titleOf), blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: label })
      const where = `it waits on “${titleOf(start)}”, which is where to start.`
      const tile = b.readiness.tiles.find((t) => t.key === 'gate')!
      const finding = b.contract.found.find((x) => x.key === 'readiness')
      assert.ok(tile.note!.includes(where), `${name}/${step.id}: the premise — the card names where to start: ${tile.note}`)
      assert.equal(finding?.text, tile.note, `${name}/${step.id}: the Evidence dialog says a different threshold sentence from the card`)
      // ContentStep's printing branch: a finding a card already states, word for word, is not printed again.
      const printed = b.contract.found.filter((x) => !b.allTiles.some((t) => t.note === x.text || t.value === x.text))
      assert.equal(printed.some((x) => x.key === 'readiness'), false, `${name}/${step.id}: the printed plan says the threshold twice`)
      const ai = String(b.artifacts.find((a) => a.id === 'ai')!.text())
      assert.ok(ai.includes(where), `${name}/${step.id}: the AI Info briefing does not say where to start`)
      assert.equal(ai.includes(`moves this number is “${gate.route}”.`), false, `${name}/${step.id}: the AI Info briefing sends the reader to the held campaign`)
    }
  }
  assert.ok(held >= 4, `the premise: gates whose campaign is held — ${held}`)
})

// The chain is the engine's own reasons, and it ends where a step does: a chain
// that runs into a mapping or a decision has no step to send anybody to (that
// step's own page names what holds it), and a reciprocal pair never loops.
test('where a chain starts is a Ready step on it, or nothing', async () => {
  const { chainStartOf } = await import('./planBoard.ts')
  const on = (lane: string, reason: { kind: string; id: string } | null) => ({ lane, substatus: lane === 'Ready' ? 'Review' : null, reason: reason && { ...reason, milestone: null, condition: null, abnormal: reason.kind !== 'step', ordinal: 5 }, blockers: [], gates: [], order: 0, fromEngine: true })
  const readings = new Map<string, unknown>([
    ['campaign', on('On Hold', { kind: 'step', id: 'ladder' })],
    ['ladder', on('Up Next', { kind: 'step', id: 'drill' })],
    ['drill', on('Ready', null)],
    ['mapped', on('On Hold', { kind: 'sourceMapping', id: 'sourceMapping:x' })],
    ['a', on('Up Next', { kind: 'step', id: 'b' })],
    ['b', on('Up Next', { kind: 'step', id: 'a' })],
  ]) as never
  assert.equal(chainStartOf(readings, 'campaign'), 'drill')
  assert.equal(chainStartOf(readings, 'ladder'), 'drill')
  assert.equal(chainStartOf(readings, 'drill'), null, 'a Ready step is where to start: nothing further to name')
  assert.equal(chainStartOf(readings, 'mapped'), null)
  assert.equal(chainStartOf(readings, 'a'), null, 'a reciprocal pair does not loop')
  assert.equal(chainStartOf(readings, 'unknown'), null)
})

// R4-31 (Marcus D12). While the next action is the report-only create, every
// readiness wait was dropped from the step: the registration policy read "Ready
// · Create" with the MFA threshold on its card and nothing about the Temporary
// Access Pass it cannot be turned on without. The engine held that wait the
// whole time; the page showed it only once the policy had been built. Readiness
// gates the enforcement and not the create (owner, 2026-09-11), so the wait is
// shown as a wait on the turn-on and never listed as a fix before the create.
// Headed "Prerequisites", the other turn-on waits ("when 1 trusted location
// exists (now 0)") would read as the create's own prerequisites, the claim that
// rule took out of Fix: every one is headed by what it holds.
test('a written enforcement prerequisite is on the step before the create, as a wait on the turn-on', async () => {
  const { withFoundationSettled } = await import('../../roadmap/fixtures/run.ts')
  const { scheduleOf } = await import('../../roadmap/stepSchedule.ts')
  const f = withFoundationSettled(fixture('mid'))
  const { step, c, blockers, lane } = opened(f, 's-goal-register-info-protected')
  assert.equal(scheduleOf(step).transition, 'createReportOnly', 'the premise: the next action is the report-only create')
  assert.equal(lane.lane, 'Ready', 'the premise: the create can be done today')
  assert.ok(step.blockers.some((b) => b.kind === 'readiness' && b.label === 'registration-no-tap'), 'the premise: no Temporary Access Pass, and the engine knows it')
  const tiles = readinessOf(step, c, blockers).tiles
  const tap = tiles.filter((t) => /Temporary Access Pass/.test(`${t.value} ${t.note ?? ''}`))
  assert.equal(tap.length, 1, `the pass is named once on the create: ${JSON.stringify(tiles.map((t) => t.value))}`)
  assert.equal(tap[0].tone, 'wait', 'a wait on the turn-on, not a warning that the create is blocked')
  assert.match(tap[0].note ?? '', /before this policy is turned on/, 'and it says what it holds')
  assert.equal(c.fix.some((x) => /Temporary Access Pass/.test(x.text)), false, 'never a fix before the create (owner, 2026-09-11)')
  const waits = tiles.filter((t) => t.key.startsWith('readiness:'))
  assert.ok(waits.length > 1, `the premise: more than the pass holds the turn-on — ${JSON.stringify(waits.map((t) => t.value))}`)
  for (const t of waits) {
    assert.equal(t.label, CONTRACT.readiness.tiles.beforeTurnOn, `${t.value}: a turn-on wait headed as a prerequisite of the create`)
    assert.equal(t.tone, 'wait', t.value)
  }
  // The threshold is its own card, and is not said twice.
  assert.equal(tiles.filter((t) => t.key === 'gate').length, 1)
  assert.equal(tiles.some((t) => t.key === 'readiness:readiness'), false)
  // Built in report-only, the same pass is what the turn-on waits on: still on the step, in the same words.
  const built = structuredClone(step)
  built.state = { ...built.state, lifecycle: 'report-only' }
  built.status = 'in-report-only'
  built.scheduled = undefined
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => x, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as StepVarContext
  const after = readinessOf(built, stepContract(built, ctx), blockers).tiles.filter((t) => /Temporary Access Pass/.test(`${t.value} ${t.note ?? ''}`))
  assert.equal(after.length, 1)
  assert.equal(after[0].note, tap[0].note, 'one sentence for the pass at both stages')
  assert.equal(after[0].label, CONTRACT.readiness.tiles.blockers, 'once the turn-on is the next action, the pass is its prerequisite')
})

// R4-31, the other channels. The turn-on waits were worked out inside the
// Readiness card builder, not on the contract, and every export reads the
// contract's `fix`. So on the registration policy before its create, the screen
// drew three "Before turning on" cards (the Temporary Access Pass, the trusted
// location, the people without a method), while the AI Info briefing, the
// calendar entry and the prompt pack named none of them. The engine's answer
// was dropped on the way to every channel but one. The waits are the contract's
// own list now: the cards read it, and the export view carries it under the
// cards' own label. It is never under Fix, which would claim the create is
// blocked (owner, 2026-09-11).
test('the turn-on waits the cards state before the create are in the exports and the AI Info briefing', async () => {
  const { withFoundationSettled } = await import('../../roadmap/fixtures/run.ts')
  const { scheduleOf } = await import('../../roadmap/stepSchedule.ts')
  const { stepExportView } = await import('./stepExport.ts')
  const { stepArtifactLines } = await import('../../roadmap/artifactLines.ts')
  const { stepBodyOf } = await import('./stepBody.ts')
  const T = CONTRACT.readiness.tiles
  for (const f of [fixture('small'), withFoundationSettled(fixture('mid'))]) {
    const { step, ctx, c, blockers, lane } = opened(f, 's-goal-register-info-protected')
    assert.equal(scheduleOf(step).transition, 'createReportOnly', `${f.name}: the premise — the next action is the report-only create`)
    const cards = readinessOf(step, c, blockers).tiles.filter((t) => t.label === T.beforeTurnOn)
    assert.ok(cards.some((t) => /Temporary Access Pass/.test(t.note ?? '')), `${f.name}: the premise — the screen names the pass before the create`)
    // One list: the cards are the contract's waits, card for card.
    assert.deepEqual(cards.map((t) => t.note), c.enforcementWaits.map((w) => w.text), `${f.name}: the cards and the contract disagree`)
    const view = stepExportView(step, ctx, lane)
    assert.deepEqual(view.beforeTurnOn, c.enforcementWaits.map((w) => w.text), `${f.name}: the export view drops the turn-on waits`)
    assert.equal(view.fix.some((l) => /Temporary Access Pass/.test(l)), false, `${f.name}: the pass is a fix before the create in the export`)
    const lines = stepArtifactLines(view)
    const turnOn = lines.find((l) => l.startsWith(`${T.beforeTurnOn}: `))
    assert.ok(turnOn && /Temporary Access Pass/.test(turnOn), `${f.name}: the calendar entry and the prompt pack name no Temporary Access Pass — ${lines.join(' / ')}`)
    const b = stepBodyOf(step, ctx, { lane, blockers })
    const ai = String(b.artifacts.find((a) => a.id === 'ai')!.text())
    assert.ok(ai.includes(`${T.beforeTurnOn}: `) && /Temporary Access Pass/.test(ai), `${f.name}: the AI Info briefing names no Temporary Access Pass`)
  }
})
