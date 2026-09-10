// Step 4: one reading of held and scheduling truth (roadmap/holds.ts), and every
// surface that dates a step reads it — the Plan row's When, the group the row sits
// in, the opened step's Dates line and Next, the plan's finish and length, the
// sample tile on Connect, the printed plan (the same rows, planRows.ts) and the
// calendar. The owner's acceptance cases, on the fixtures the product runs.
//
// A wait on another step of this plan is sequencing, not a hold (owner decision):
// the step stays in its numbered phase, dated after the step it waits on. What
// withdraws a step is what the plan cannot schedule.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allCuratedFixtures, allFixtures, curatedFixture, fixture, noExclusionsAnswer } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { observationsOf } from './tracking.ts'
import { holdOf, isHeld } from './holds.ts'
import { heldForReview, nextMilestone } from './lifecycle.ts'
import { settleForecast } from './forecast.ts'
import { buildIcs } from './ics.ts'
import { groundingBundle } from './prompts.ts'
import type { Step } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { planFinish, planWeeks } from '../derive/finish.ts'
import { headerLine1 } from '../derive/planHeader.ts'
import { FINISH } from '../copy/statements.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { absoluteDate } from '../copy/dates.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { rowWhen } from '../ui/surfaces/rowWhen.ts'
import { datesLineFor, stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { floorRows, phaseRows, undatedRows } from '../ui/surfaces/planRows.ts'
import { statusGroupOf } from '../ui/surfaces/planBoard.ts'
import { cleanupExportViews } from '../ui/surfaces/cleanupExport.ts'
import { demoFacts } from '../ui/demoFacts.ts'
import { demoTenant } from '../ui/demo.ts'

type Plan = { f: Fixture; r: ReturnType<typeof runFixture>; ctx: (s: Step) => StepVarContext; ics: string }

function planOf(f: Fixture, over: Parameters<typeof runFixture>[1] = {}, record?: Parameters<typeof runFixture>[2]): Plan {
  const r = runFixture(f, over, record)
  const ctx = (s: Step): StepVarContext => ({
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[s.id] ?? null,
    naming: r.coverage.organisation.naming,
  })
  const ics = buildIcs(r.steps, 'Tenant', 'plan-s4', (s) => stepExportView(s, ctx(s)), cleanupExportViews(r.schedule.cleanup))
  return { f, r, ctx, ics }
}

const stepOf = (p: Plan, id: string): Step => {
  const s = p.r.steps.find((x) => x.id === id)
  assert.ok(s, `${p.f.name} no longer carries ${id}`)
  return s!
}
const booked = (p: Plan, id: string): boolean => p.ics.includes(`-${id}@iamai`)
const phased = (p: Plan): Set<string> => new Set(p.r.schedule.waves.flatMap((w) => phaseRows(p.r.steps, w).map((s) => s.id)))
const open = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped' && !s.doesntApply
const YEAR = /\b\d{4}\b/

/** Everything a held step must not carry, on every surface that could date it. */
function nothingIsDated(p: Plan, s: Step): void {
  const where = `${p.f.name}/${s.id}`
  assert.ok(isHeld(s), `${where}: the premise, something holds it`)
  assert.equal(phased(p).has(s.id), false, `${where}: a held step sits in no numbered phase`)
  assert.ok(undatedRows(p.r.steps, p.r.schedule.waves).some((x) => x.id === s.id) || floorRows(p.r.steps).some((x) => x.id === s.id), `${where}: it renders under Waiting on something else`)
  assert.doesNotMatch(rowWhen(s), YEAR, `${where}: the row dates it (${rowWhen(s)})`)
  assert.notEqual(rowWhen(s), 'now', `${where}: the row says now`)
  if (!heldForReview(s)) {
    assert.equal(datesLineFor(s, (contentStepFor(s) ?? {}) as Record<string, unknown>), null, `${where}: a Dates line`)
    assert.equal(stepExportView(s, p.ctx(s)).dates, null, `${where}: the exports carry dates`)
  }
  assert.equal(nextMilestone(s).at, null, `${where}: Next has a date`)
  assert.equal(s.events, null, `${where}: an enforcement or an announcement`)
  assert.deepEqual(s.rings, [], `${where}: rollout rings`)
  assert.equal(s.reportOnlyAt ?? null, null, `${where}: a report-only day`)
  assert.equal(booked(p, s.id), false, `${where}: a calendar entry`)
  assert.ok(!['ready', 'upnext'].includes(statusGroupOf(s, false, true)), `${where}: grouped as work that is ready`)
}

// ---- A. not deployed, with something holding it ----

test('Step 4 A: a policy not deployed that something holds is Blocked, undated and waiting; one waiting only on a step the plan schedules is dated after it', () => {
  const p = planOf(curatedFixture('demo'))
  // It names the service-accounts group this tenant does not have.
  const held = stepOf(p, 's-goal-service-accounts-trusted-network')
  assert.equal(held.state.lifecycle, 'not-deployed')
  assert.equal(held.status, 'blocked')
  assert.equal(holdOf(held)?.kind, 'unavailable')
  nothingIsDated(p, held)
  // Sequencing: waiting on emergency access, which Preparation schedules, and nothing else.
  const g = planOf(curatedFixture('getiamai'))
  const sequenced = stepOf(g, 's-goal-block-legacy-auth')
  assert.ok(sequenced.blockers.length > 0 && sequenced.blockers.every((b) => b.kind === 'step'), 'the premise: it waits on another step only')
  assert.equal(isHeld(sequenced), false)
  assert.ok(phased(g).has(sequenced.id), 'it sits in a numbered phase')
  assert.ok(sequenced.reportOnlyAt, 'the day its report-only policy is created')
  assert.match(rowWhen(sequenced), YEAR)
  assert.ok(booked(g, sequenced.id), 'and the calendar books it')
})

// ---- B. report-only, with the exclusions prerequisite unresolved ----

test('Step 4 B: a report-only policy held on an unresolved exclusions group goes on being watched, is never Ready to enforce, and is dated nowhere', () => {
  const f = noExclusionsAnswer(curatedFixture('demo-week2'))
  const p = planOf(f, { mapping: f.mapping })
  const token = stepOf(p, 's-goal-token-protection')
  assert.equal(token.state.lifecycle, 'report-only', 'still being watched')
  assert.notEqual(token.status, 'ready-to-enforce')
  nothingIsDated(p, token)
  assert.equal(nextMilestone(token).kind, 'resolve', 'Next is what holds it')
})

// ---- C. report-only, clean but incomplete: the review day ----

test('Step 4 C: a report-only policy whose clean records are not complete yet reads its review day, from its own history, on every surface', () => {
  const p = planOf(curatedFixture('demo-week2'))
  const s = stepOf(p, 's-goal-block-auth-transfer')
  const ready = readyWhen(s)!
  assert.equal(isHeld(s), false)
  assert.equal(ready.kind, 'on', 'the window has not closed')
  assert.equal(ready.failures, 0, 'nothing has failed')
  assert.ok(ready.seen! < ready.people!, 'and not everybody has been seen')
  const day = absoluteDate(s.tracking!.readyOn!)
  assert.equal(rowWhen(s), `ready ${day}`, 'the row')
  assert.equal(datesLineFor(s, (contentStepFor(s) ?? {}) as Record<string, unknown>), '{datesObserve}')
  assert.ok(stepExportView(s, p.ctx(s)).dates?.includes(day), 'the Dates line')
  assert.deepEqual([nextMilestone(s).kind, nextMilestone(s).at], ['observe', s.tracking!.readyOn], 'Next')
  assert.equal(s.events, null, 'no enforcement day')
  const entry = p.ics.split('BEGIN:VEVENT').find((x) => x.includes(`-${s.id}@iamai`))
  assert.ok(entry?.includes(`DTSTART;VALUE=DATE:${s.tracking!.readyOn!.slice(0, 10).replace(/-/g, '')}`), 'the calendar books the review on that day')
})

// ---- D. report-only, a new failure ----

test('Step 4 D: a report-only policy whose records show people stopped is held on its evidence: never Ready to enforce, and no date anywhere', () => {
  const f = curatedFixture('demo-week2')
  const target = runFixture(f).steps.find((s) => s.id === 's-goal-token-protection')!.tracking!.policyId!
  const results = ((f.snapshot.evidencePolicyResults ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    if (r.policyId !== target) return r
    const copy = structuredClone(r)
    const counts = copy.counts as Record<string, number>
    const ids = copy.affectedUserIds as Record<string, string[]>
    counts.reportOnlyFailure = 3
    ids.reportOnlyFailure = [ids.reportOnlySuccess[0]]
    copy.byDay = null
    return copy
  })
  const snapshot = { ...f.snapshot, evidencePolicyResults: results } as TenantSnapshot
  const p = planOf({ ...f, snapshot }, { snapshot })
  const token = stepOf(p, 's-goal-token-protection')
  assert.equal(token.tracking?.failures, 3)
  assert.equal(token.state.lifecycle, 'report-only')
  assert.notEqual(token.status, 'ready-to-enforce')
  assert.equal(holdOf(token)?.kind, 'evidence')
  assert.equal(rowWhen(token), 'held until the records clear', 'the row says what it is held for')
  nothingIsDated(p, token)
})

// ---- E. the prerequisite resolves ----

test('Step 4 E: once the exclusions group is answered the same policy is Ready to enforce, placed in a phase and dated on every surface', () => {
  const held = noExclusionsAnswer(curatedFixture('demo-week2'))
  const before = stepOf(planOf(held, { mapping: held.mapping }), 's-goal-token-protection')
  assert.ok(isHeld(before), 'the premise: held without the answer')
  const p = planOf(curatedFixture('demo-week2'))
  const token = stepOf(p, 's-goal-token-protection')
  assert.equal(isHeld(token), false)
  assert.equal(token.status, 'ready-to-enforce')
  assert.ok(phased(p).has(token.id), 'placed in a numbered phase')
  assert.ok(token.events, 'with its enforcement day')
  assert.equal(rowWhen(token), absoluteDate(token.events!.enforce.at))
  assert.equal(nextMilestone(token).at, token.events!.enforce.at)
  assert.ok(booked(p, token.id), 'and a calendar entry')
})

// ---- the one projection, over every plan ----

const corpus = (): Plan[] => [...allFixtures(), ...allCuratedFixtures()].filter((f) => f.name !== 'huge').flatMap((f) => [planOf(f), planOf(noExclusionsAnswer(f), { mapping: noExclusionsAnswer(f).mapping })])
let CORPUS: Plan[] | null = null
const plans = (): Plan[] => (CORPUS ??= corpus())

test('Step 4: the row, the group, the step, the print and the calendar read one projection', () => {
  for (const p of plans()) {
    const inPhase = phased(p)
    const undated = new Set(undatedRows(p.r.steps, p.r.schedule.waves).map((s) => s.id))
    for (const s of p.r.steps.filter(open)) {
      const where = `${p.f.name}/${s.id}`
      if (isHeld(s)) nothingIsDated(p, s)
      else if (!s.floor) assert.ok(inPhase.has(s.id) !== undated.has(s.id), `${where}: drawn in a phase and undated at once, or in neither`)
      // A calendar entry exactly where the step has a day of its own.
      assert.equal(booked(p, s.id), !isHeld(s) && (s.rings.length > 0 || s.events !== null), `${where}: the calendar and the step disagree about its day`)
    }
  }
  // The printed plan draws the Plan's own rows and states the Plan's own length.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  for (const read of ['undatedRows(', 'phaseRows(', 'floorRows(', 'planFinish(', 'planWeeks(finish, schedule)', 'finish.held']) assert.ok(print.includes(read), `the print no longer reads ${read}`)
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  for (const read of ['undatedRows(', 'phaseRows(', 'planWeeks(finish, c.schedule)', 'finish.held', 'isHeld(step)']) assert.ok(screen.includes(read), `the Plan no longer reads ${read}`)
})

// ---- the finish ----

test('Step 4: no plan finishes on a date while work it requires is held, and its length is the one estimate everywhere', () => {
  for (const p of plans()) {
    const finish = planFinish(p.r.steps, p.r.schedule.cleanup?.end ?? null)
    const heldWork = p.r.steps.some((s) => open(s) && !s.floor && isHeld(s))
    assert.equal(finish.held, heldWork, `${p.f.name}: the finish and the steps disagree about held work`)
    if (!heldWork) continue
    assert.equal(finish.finish, null, `${p.f.name}: a finish that assumes the hold clears`)
    assert.equal(planWeeks(finish, p.r.schedule), p.r.schedule.estimate?.weeks, `${p.f.name}: the length is not the rollout's estimate`)
    assert.ok(!p.ics.includes('-cleanup-'), `${p.f.name}: Cleanup booked after work that cannot finish`)
  }
  // The header says what holds the plan in a sentence of its own: one step in
  // place does not conjugate the verb of the clause after it.
  assert.equal(
    headerLine1({ steps: 30, inPlace: 1, finish: null, weeks: '3 weeks', constraint: FINISH.unwritable(16, ['Create or Correct Emergency Access Accounts']), startedFrom: null }),
    '30 steps · 1 in place · cannot finish until 16 steps wait on Create or Correct Emergency Access Accounts',
  )
  // The exported plan says the same thing.
  const p = planOf(curatedFixture('demo'))
  const bundle = groundingBundle({ view: (s) => stepExportView(s, p.ctx(s)), tenant: 'Tenant', snapshot: p.f.snapshot, coverage: p.r.coverage, steps: p.r.steps, schedule: p.r.schedule, redacted: false, generated: 'Sep 10, 2026', cleanup: [] }) as unknown as { plan: { targetEnd: string | null; weeks: number | null; finish: string | null } }
  assert.ok(planFinish(p.r.steps).held, 'the premise: day one holds work')
  assert.deepEqual([bundle.plan.targetEnd, bundle.plan.weeks, bundle.plan.finish], [null, null, null], 'the bundle exports a finish')
  // Connect's sample tile is the Plan's length, and says it is an estimate when the Plan cannot finish.
  const d = demoTenant(false)
  const demo = runFixture({ ...fixture('demo'), snapshot: d.snapshot, mapping: d.mapping })
  const demoFinish = planFinish(demo.steps, demo.schedule.cleanup?.end ?? null)
  assert.equal(demoFacts().weeks, planWeeks(demoFinish, demo.schedule))
  assert.equal(demoFacts().estimated, demoFinish.held)
})

// ---- a follow-up scan ----

test('Step 4: the projection is stable: the same scan twice, a follow-up scan read against the first, and a second settle all land on the same plan', () => {
  const dates = (r: ReturnType<typeof runFixture>): string => JSON.stringify({ schedule: r.schedule, steps: r.steps.map((s) => [s.id, isHeld(s), s.events, s.rings, s.reportOnlyAt ?? null]) })
  const first = runFixture(curatedFixture('demo'))
  assert.equal(dates(runFixture(curatedFixture('demo'))), dates(first), 'the same scan twice')
  const record = observationsOf(first.steps)
  const followUp = (): ReturnType<typeof runFixture> => runFixture(curatedFixture('demo-week2'), {}, record)
  const one = followUp()
  assert.equal(dates(followUp()), dates(one), 'the follow-up scan read against the first')
  const before = dates(one)
  settleForecast(one.steps, one.schedule)
  assert.equal(dates(one), before, 'a second settle moves nothing')
})

// ---- F. in place ----

test('Step 4 F: a step already in place has no future date and no calendar entry', () => {
  let checked = 0
  for (const p of plans()) {
    for (const s of p.r.steps.filter((x) => x.status === 'done')) {
      const where = `${p.f.name}/${s.id}`
      assert.equal(booked(p, s.id), false, `${where}: a calendar entry`)
      assert.equal(rowWhen(s), '', `${where}: a row date`)
      assert.equal(nextMilestone(s).at, null, `${where}: a next date`)
      checked += 1
    }
  }
  assert.ok(checked > 10, `the fixtures have steps in place: ${checked}`)
})

// ---- no fake Now ----

test('Step 4: no row says now unless the step is work a person can do today', () => {
  for (const p of plans()) {
    for (const s of p.r.steps) {
      if (rowWhen(s) !== 'now') continue
      const where = `${p.f.name}/${s.id}`
      assert.equal(isHeld(s), false, `${where}: a held step reads now`)
      assert.ok(s.kind === 'prerequisite' || s.kind === 'check' || s.status === 'ready', `${where}: a ${s.kind} step at ${s.status} reads now`)
    }
  }
})
