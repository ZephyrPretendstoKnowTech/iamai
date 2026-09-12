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
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { CONTRACT, readinessOf, stepContract } from './stepContract.ts'
import type { PrerequisiteBlocker } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import type { HoldBlockerKind } from '../../actionability/lanes.ts'
import { BOARD, laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { mergeReadiness } from './stepPackage.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import { returnToStep } from '../shell/routes.ts'

const read = (p: string): string => readFileSync(p, 'utf8')
const CONTENT_STEP = read('src/ui/surfaces/ContentStep.tsx')
const SECTIONS = read('src/ui/surfaces/StepSections.tsx')
const CSS = read('src/ui/app.css')
const CONTENT = read('docs/design/content.json')
const EMERGENCY = 's-prereq-break-glass'

function opened(name: 'demo' | 'demo-week2', id: string) {
  const f: Fixture = fixture(name)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === id)
  assert.ok(step, `${name} carries no ${id}`)
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
  assert.deepEqual(c.fix.map((f) => f.key), ['mapping', `step:${EMERGENCY}`], 'the premise: a mapping and a step prerequisite are outstanding')
  const r = readinessOf(step, c, blockers)
  const mapping = r.tiles.find((t) => t.key === 'mapping')!
  assert.equal(mapping.label, CONTRACT.readiness.tiles.mapping)
  assert.equal(mapping.value, BLOCKED_REASON.sourceMapping)
  assert.equal(mapping.note, CONTRACT.fixMapping)
  assert.ok(mapping.link && 'mappings' in mapping.link, 'the mapping tile does not link to Baseline mappings')
  const prereq = r.tiles.find((t) => t.key === `step:${EMERGENCY}`)!
  assert.equal(prereq.label, CONTRACT.readiness.tiles.prerequisite)
  assert.ok(prereq.link && 'href' in prereq.link && prereq.link.href === returnToStep(EMERGENCY), 'the step tile does not open its step')
  assert.equal(r.tiles.some((t) => t.key === 'blockers' || /remaining$/.test(t.value)), false, 'a prerequisites count tile is back')
  // The engine's two pending mappings on this step are the one mapping tile: the same blocker is never shown twice.
  assert.ok(blockers.filter((b) => b.kind === 'sourceMapping').length >= 1, 'the premise: the engine holds this step on a mapping')
  assert.equal(r.tiles.filter((t) => t.label === CONTRACT.readiness.tiles.mapping).length, 1)
  for (const t of r.tiles) assert.ok(t.tone === 'warn' || t.tone === 'wait', `${t.key}: a satisfied tile among the unresolved`)
})

test('the engine’s blockers the fixes do not name become tiles: a queued step is a wait with a link, a hold needs attention, the step’s own decision is not a prerequisite of itself', () => {
  const { step, c } = opened('demo', 's-goal-mfa-all-users')
  const queued: PrerequisiteBlocker = { kind: 'step', id: 's-prereq-passkey-settings', abnormal: false, label: BOARD.blockers.step, title: 'Passkeys' }
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
  const { step: d, c: dc } = opened('demo', 's-prereq-device-plan')
  assert.equal(dc.state.condition, 'needs-decision', 'the premise: the device decision is the step’s own')
  const own2 = readinessOf(d, dc, [{ kind: 'decision', id: 'decision:device-plan', abnormal: false, label: BOARD.blockers.decision, title: null }])
  assert.equal(own2.tiles.some((t) => t.key.startsWith('engine:decision')), false, 'the step’s own decision is listed as a prerequisite of itself')
})

test('with nothing unresolved the region is its compact success line and the satisfied evidence stays expandable', () => {
  const { step, c, blockers } = opened('demo-week2', EMERGENCY)
  const r = readinessOf(step, c, blockers)
  assert.deepEqual(r.tiles, [])
  assert.deepEqual(r.satisfied.map((t) => `${t.key}:${t.tone}`), ['emergency:good', 'resilience:good', 'coverage:good'])
  assert.equal(r.bar.main, CONTRACT.lifecycle['in-place'], 'a completed step’s bar is not the tenant fact (A1b)')
  const section = SECTIONS.slice(SECTIONS.indexOf('export function ReadinessSection('), SECTIONS.indexOf('/** The truthful no-action box'))
  assert.match(section, /readiness\.tiles\.length > 0 \? \(\s*strip\(readiness\.tiles, 'unresolved'\)\s*\) : \(\s*<p className="readiness-clear">/, 'nothing unresolved does not collapse to the success line')
  assert.match(section, /<details className="readiness-satisfied" open=\{printing \|\| undefined\}>/, 'the satisfied evidence is not behind its own disclosure')
  assert.match(section, /<details className="readiness-more" open=\{open \|\| undefined\}>/, 'a tile’s explanation is not behind its disclosure')
  assert.match(section, /'href' in t\.link \? <a href=\{t\.link\.href\}>/, 'a step tile does not link')
  assert.match(CSS, /\.step \.readiness-strip \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/, 'the strip is not four across')
  assert.match(CSS, /\.step \.readiness-clear \{/, 'the success line has no treatment')
})

test('Fix before continuing, the hardening section and the Needs attention pointer are gone from the step; the hardening is the Resilience tile’s evidence, last and nonblocking', () => {
  for (const gone of ['<FixBeforeContinuing', '<HardeningRecommendations', 'fixHeading', 'W.preview.checks']) assert.equal(CONTENT_STEP.includes(gone), false, `ContentStep still draws ${gone}`)
  for (const gone of ['export function FixBeforeContinuing', 'export function HardeningRecommendations', 'CONTRACT.fixHeading']) assert.equal(SECTIONS.includes(gone), false, `StepSections still exports ${gone}`)
  assert.match(CONTENT_STEP, /extra=\{\(t\) =>\s*t\.key === 'resilience' && contract\.hardening \? \(\s*<HardeningBody/, 'the hardening is not the Resilience tile’s evidence')
  // The content file no longer points at a container that does not exist (the export's section heading keeps the key).
  assert.equal((CONTENT.match(/Fix before continuing/g) ?? []).length, 1)
  const { step, c, blockers } = opened('demo', EMERGENCY)
  const r = readinessOf(step, c, blockers)
  assert.equal(r.tiles.at(-1)?.key, 'resilience', 'the hardening tile is not last')
  assert.equal(r.tiles.at(-1)?.note, CONTRACT.hardening.leadBlocked, 'the hardening tile does not carry its lead')
  assert.ok(r.tiles.some((t) => t.key.startsWith('check:')), 'the failing minimum check is not its own tile')
  assert.equal(r.tiles[0].key, 'emergency', 'the way back in is not the first tile')
  assert.equal(c.doneWhen.some((l) => /Fix before continuing/.test(l)), false)
})

test('the Emergency Access step is Why → Readiness → account selection → Implementation → Done when, and a selected set is never "not held"', () => {
  const main = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<div className="step-main">'), CONTENT_STEP.indexOf('<StepRail'))
  const at = (needle: string): number => {
    const i = main.indexOf(needle)
    assert.ok(i >= 0, `the opened step no longer renders ${needle}`)
    return i
  }
  const order = [at('<h4>{HEAD.why}</h4>'), at('<ReadinessSection'), at('{decides && <Decision'), at('<Implementation\n'), at('<DoneWhen heading={HEAD.doneWhen}')]
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the regions are out of order')
  const { step, ctx, c } = opened('demo', EMERGENCY)
  assert.ok((ctx.mapping.breakGlassUserIds?.length ?? 0) > 1, 'the premise: two accounts are selected')
  assert.equal(c.whatToDo.kind, 'deploy')
  // Two selected accounts each owing work: the one-account channel takes one and is
  // simply not offered (S6) — never a line saying IAMAI does not hold the account.
  assert.equal(CONTENT_STEP.includes('W.withheld'), false, 'the step still draws a withheld-channel line')
  assert.equal('withheld' in CONTRACT.implementation, false)
})

test('the package’s gates merge without a cap: unresolved before the hardening, satisfied as evidence', () => {
  const { step, c } = opened('demo', EMERGENCY)
  const runtime = readinessOf(step, c)
  const merged = mergeReadiness(runtime, {
    tiles: [
      { id: 'pkg.open', gate: 'Safe to prove', result: 'Unknown', line: 'x', gateKey: null, confirm: null },
      { id: 'pkg.done', gate: 'Safe to continue', result: 'Ready', line: 'y', gateKey: null, confirm: null },
      { id: 'pkg.same', gate: 'Emergency access', result: 'Blocked', line: 'z', gateKey: 'emergency', confirm: null },
    ],
    conclusion: null,
    whyItMatters: null,
    unknowns: [],
    references: [],
  })
  assert.deepEqual(merged.tiles.map((t) => t.key), [...runtime.tiles.filter((t) => t.key !== 'resilience').map((t) => t.key), 'pkg.open', 'resilience'])
  assert.deepEqual(merged.satisfied.map((t) => t.key), [...runtime.satisfied.map((t) => t.key), 'pkg.done'])
})

test('the printed step and the screen read the same blockers, the row hands them to the step, and a tile’s link opens its step under its own tab', () => {
  assert.match(read('src/ui/surfaces/PrintPlan.tsx'), /blockers=\{blockersOf\(s\)\}/)
  const plan = read('src/ui/surfaces/Plan.tsx')
  assert.match(plan, /blockers=\{readinessBlockersOf\(reading, titleOf\)\} prerequisiteLabel=\{prerequisiteLabel\} onOpenMappings=\{openSettings\}/)
  // A prerequisite in another lane: the tab follows the step the link opened, or the link would open nothing on screen.
  assert.match(plan, /const openTab = open \? \(TAB_OF\[readings\.get\(open\)\?\.lane \?\? 'Completed'\] \?\? null\) : null/)
  assert.match(plan, /<TabFollowsOpenStep open=\{open\} openTab=\{openTab\} tab=\{tab\} onTab=\{setTab\} \/>/)
  assert.match(plan, /if \(open && openTab && openTab !== tab\) onTab\(openTab\)/)
  // Narrow widths: two across at the pack's first breakpoint, one at the second; nothing hidden.
  const narrow = (w: number): string => CSS.slice(CSS.indexOf(`@media (max-width: ${w}px)`))
  assert.match(narrow(940), /\.step \.readiness-strip,\s*\.step \.readiness-strip\.tiles-3 \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(narrow(650), /\.step \.readiness-strip,\s*\.step \.readiness-strip\.tiles-3,\s*\.step \.readiness-strip\.tiles-2 \{\s*grid-template-columns: minmax\(0, 1fr\);/)
  const { reading, blockers } = opened('demo', 's-goal-mfa-all-users')
  assert.equal(blockers.length, reading.blockers.length)
  for (const b of blockers) assert.equal(b.label, BOARD.blockers[b.kind as HoldBlockerKind])
})
