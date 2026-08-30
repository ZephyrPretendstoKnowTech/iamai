// "Do this next" and the automatic log (prompt 30): selection order, the
// waiting sentence, the completed lead, and a log that is derived from two
// scans, marks unplanned changes, and survives a plan file round trip.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { doThisNext, effortMinutes } from './next.ts'
import { appendLog, emptyLog, entriesForScan, logView, LOG_CAP } from './activityLog.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from './plan.ts'
import { stepIdForGoal } from './generate.ts'
import { summarizeTenant } from '../scoring/mfaViability.ts'

const NOW = '2026-08-28T10:00:00.000Z'

test('do this next: one to three items, never a blocked step, prerequisites first, then safe-today, then readiness', () => {
  const f = fixture('small')
  const run = runFixture(f)
  const nameOf = (id: string) => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const card = doThisNext(run.steps, run.schedule, run.viability, nameOf, null, NOW)
  assert.ok(card.items.length >= 1 && card.items.length <= 3)
  for (const i of card.items) {
    const s = run.steps.find((x) => x.id === i.stepId)!
    assert.notEqual(s.status, 'blocked', `${i.stepId} is not blocked`)
    assert.ok(i.why.length > 0 && i.touches.length > 0 && i.minutes > 0)
  }
  const kinds = card.items.map((i) => i.kind)
  const order = ['prerequisite', 'safeToday', 'readiness', 'ready']
  assert.deepEqual([...kinds], [...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b)), 'selection order holds')
  assert.equal(card.waiting, null)
  assert.ok(effortMinutes(run.steps.find((s) => s.id === stepIdForGoal('block-auth-transfer'))!) >= 15)
})

test('do this next: when everything waits, it says the date and why; after a re-scan it leads with what completed', () => {
  const f = fixture('small')
  const run = runFixture(f)
  const nameOf = (id: string) => id
  // Everything blocked or done: nothing to do until the observation window ends.
  const waitingSteps = run.steps.map((s) => (s.status === 'ready' ? { ...s, status: 'blocked' as const, safeToday: false } : s))
  const card = doThisNext(waitingSteps, run.schedule, run.viability, nameOf, null, NOW)
  assert.equal(card.items.length, 0)
  assert.match(card.waiting ?? '', /^Nothing to do until .*, when the (observation window ends|registration campaign ends|notice period ends)\.$/)
  // A step that was ready at the previous scan and is done now leads the card.
  const previous: Record<string, string> = Object.fromEntries(run.steps.map((s) => [s.id, s.status]))
  // Every done create/adjust step in this fixture is one the tenant already
  // had, which is exactly the shape review 09 hit, so the executed step is made
  // explicitly rather than found.
  const target = run.steps.find((s) => s.kind === 'create' || s.kind === 'adjust')!
  const executed = run.steps.map((s) => (s.id === target.id ? { ...s, status: 'done' as const, alreadyInPlace: false } : s))
  previous[target.id] = 'ready'
  const after = doThisNext(executed, run.schedule, run.viability, nameOf, previous, NOW)
  assert.equal(after.completed.length, 1, 'a step this plan executed is reported as completed')
  // A step the tenant already had in place is not something that just completed
  // (prompt 41 §10, review-09 finding 5). Counting those is what made the card
  // read '4 steps are now enforced' beside a band reading 'Enforced 1'.
  const inPlaceId = run.steps.find((s) => s.status === 'done' && s.alreadyInPlace)?.id
  if (inPlaceId) {
    const withInPlace: Record<string, string> = { ...previous, [inPlaceId]: 'ready' }
    const after2 = doThisNext(executed, run.schedule, run.viability, nameOf, withInPlace, NOW)
    assert.equal(after2.completed.length, 1, 'an already-in-place step is not reported as newly enforced')
  }
})

test('activity log: two scans over the midflight fixture produce the expected entries in order; an unplanned change is marked; the log round-trips', () => {
  const f = fixture('midflight')
  const first = runFixture(f)
  const summary = summarizeTenant(first.viability)
  const checkpoint = makeCheckpoint({ snapshot: f.snapshot, coverage: first.coverage, summary, exclusionGroups: [], breakGlassIds: f.mapping.breakGlassUserIds })
  checkpoint.at = '2026-08-01T00:00:00.000Z'
  // Scan 1: nothing before it; the scan itself and the step states are recorded.
  let log = appendLog(emptyLog(), entriesForScan({ snapshot: f.snapshot, steps: first.steps, previous: null, planId: f.planId, baselinePin: 'abc', previousBaselinePin: null, scanAt: f.snapshot.asOf }))
  assert.equal(log.entries[0].kind, 'scan')
  assert.ok(log.entries.some((e) => e.kind === 'step' && /enforced$/.test(e.what)))
  // Scan 2: a policy modified outside the plan since the checkpoint, and the baseline pin moved.
  // A policy the plan never created, modified after the checkpoint: the drift signal.
  const rows = f.snapshot.config.caPolicies.rows as { id?: string; description?: string; modifiedDateTime?: string; displayName?: string; state?: string }[]
  const outside = { ...(rows[0] as object), id: 'outside-policy', displayName: 'Legacy - Someone else changed this', description: '', createdDateTime: '2026-07-01T00:00:00.000Z', modifiedDateTime: '2026-08-27T09:00:00.000Z' } as (typeof rows)[number]
  rows.push(outside)
  checkpoint.tenantPolicies.push({ id: 'outside-policy', state: String(outside.state ?? 'enabled'), microsoftManaged: false, laneB: null })
  try {
    const second = runFixture(f)
    // The second scan is stamped just after the step history the tracking wrote at the clock's now.
    const scanAt = new Date(Date.now() + 1000).toISOString()
    const entries = entriesForScan({ snapshot: f.snapshot, steps: second.steps, previous: checkpoint, planId: f.planId, baselinePin: 'def', previousBaselinePin: 'abc', scanAt })
    log = appendLog(log, entries)
    const modified = log.entries.find((e) => e.what === `Policy modified: ${outside.displayName}`)
    assert.ok(modified, 'the outside change is logged')
    assert.equal(modified!.planned, false, 'and marked unplanned')
    assert.ok(log.entries.some((e) => e.kind === 'baseline'))
    const ats = log.entries.map((e) => e.at)
    assert.deepEqual(ats, [...ats].sort(), 'entries are in time order')
    assert.ok(logView(log, 'mine').every((e) => e.planned && e.kind !== 'scan'))
  } finally {
    rows.splice(rows.indexOf(outside), 1)
  }
  // Round trip through the plan file.
  const file = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { kind: 'github', owner: 'fixture', repo: 'baseline', commit: 'def' },
    mapping: f.mapping,
    steps: first.steps,
    checkpoints: [checkpoint],
    log,
  })
  const { plan } = parsePlanFile(JSON.stringify(file))
  assert.deepEqual(plan?.log, log)
  // The cap: 600 entries keep the newest 500 and roll up the rest.
  const many = Array.from({ length: 600 }, (_, i) => ({ at: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(), what: `e${i}`, kind: 'scan' as const, stepId: null, detectedBy: 'scan' as const, planned: true, scanAt: NOW }))
  const capped = appendLog(emptyLog(), many)
  assert.equal(capped.entries.length, LOG_CAP)
  assert.equal(capped.rolledUp?.count, 100)
})
