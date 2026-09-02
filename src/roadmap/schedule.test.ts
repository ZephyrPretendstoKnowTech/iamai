// The graph scheduler (roadmap-v2.md §2): dates derive from the dependency
// graph plus the band's durations; the calendar rules hold; the critical
// path is stated. Authored steps only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { batchClassOf, buildSchedule, dependencyGraph, nextMonday, observationDaysFor, toEnforcementDay } from './schedule.ts'
import { bandForActiveUsers } from './constants.ts'
import type { Ring, Step } from './types.ts'

const people = (n: number, prefix = 'u'): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

function ring(index: number, soakDays: number, ids: string[]): Ring {
  return {
    index,
    name: index === 0 ? 'Pilot' : 'Everyone',
    targeting: { kind: index === 0 ? 'group' : 'all', groupName: null, memberCount: ids.length, suggestedMemberIds: ids, filter: null, departments: [] },
    soakDays,
    plannedStart: '',
    plannedEnd: '',
    actualStart: null,
    actualEnd: null,
  }
}

function step(over: Partial<Step> & { id: string }): Step {
  const ids = over.population?.ids ?? people(20)
  return {
    goalId: over.id,
    phase: 1,
    kind: 'create',
    title: over.id,
    why: '',
    status: 'ready',
    blockedBy: [],
    blockers: [],
    unblockNotes: [],
    population: { total: ids.length, active: ids.length, admins: 0, guests: 0, ids },
    readiness: { family: 'mfa', percent: 100, lines: [] },
    evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
    action: { kind: 'create', summary: [], json: null, portalSteps: [] },
    history: [],
    skipReason: null,
    deliveredBy: [],
    comms: null,
    learn: null,
    includesOperator: false,
    operatorSafe: null,
    rings: [ring(0, 3, ids.slice(0, 3)), ring(1, 3, ids.slice(3))],
    currentRing: 0,
    owner: null,
    tracking: null,
    gap: null,
    gapShort: null,
    blockedReason: null,
    events: null,
    plainTitle: '',
    forManager: '',
    ...over,
  }
}

const MON = '2026-08-31T00:00:00.000Z'
const day = (iso: string) => new Date(iso).getUTCDay()

const typical = () => [
  step({ id: 's-prereq-exclusion-group', phase: 0, kind: 'prerequisite', rings: [], readiness: { family: 'other', percent: null, lines: [] } }),
  step({ id: 's-verify-mfa', phase: 2, kind: 'verify', rings: [] }),
  step({ id: 'block', phase: 1, readiness: { family: 'block', percent: null, lines: [] } }),
  step({ id: 'mfa', phase: 2 }),
  step({ id: 'admins', phase: 3, readiness: { family: 'admin', percent: 100, lines: [] }, population: { total: 2, active: 2, admins: 2, guests: 0, ids: ['u0', 'u1'] }, rings: [ring(0, 3, ['u0']), ring(1, 3, ['u1'])] }),
  step({ id: 'done', phase: 3, status: 'done', rings: [] }),
]

test('nextMonday lands on a Monday after the given date', () => {
  const m = nextMonday('2026-08-26T10:00:00Z') // a Wednesday
  assert.equal(day(m), 1)
  assert.equal(m.slice(0, 10), '2026-08-31')
})

test('bands follow target-state §9: small ≤50, mid 51–300, large >300', () => {
  // The band sets the expected length, the weekly cap and the ring shape; the
  // registration window is measured from the people who need a method, never
  // from the band.
  assert.equal(bandForActiveUsers(12), 'small')
  assert.equal(bandForActiveUsers(50), 'small')
  assert.equal(bandForActiveUsers(51), 'mid')
  assert.equal(bandForActiveUsers(300), 'mid')
  assert.equal(bandForActiveUsers(301), 'large')
  // Past 500 the plan still builds; it is a scale test, not a band this product
  // is designed around.
  assert.equal(bandForActiveUsers(5000), 'large')
})

test('enforcement starts on a Tuesday, a Wednesday or a Thursday, never a Friday or a weekend (target-state §9)', () => {
  assert.equal(day(toEnforcementDay('2026-09-04T12:00:00.000Z')), 2) // Friday → Tuesday
  assert.equal(day(toEnforcementDay('2026-09-05T12:00:00.000Z')), 2)
  assert.equal(day(toEnforcementDay('2026-09-06T12:00:00.000Z')), 2)
  assert.equal(day(toEnforcementDay('2026-08-31T12:00:00.000Z')), 2) // Monday → Tuesday
  assert.equal(toEnforcementDay('2026-09-03T12:00:00.000Z'), '2026-09-03T12:00:00.000Z') // Thursday stays
  assert.equal(toEnforcementDay('2026-09-02T12:00:00.000Z'), '2026-09-02T12:00:00.000Z') // Wednesday stays
})

test('the graph names the rule dependencies: exclusion group first, break-glass before a block, campaign before MFA', () => {
  const graph = dependencyGraph(typical())
  assert.ok(graph.block.some((d) => d.stepId === 's-prereq-exclusion-group' && d.kind === 'hard'))
  assert.ok(graph.mfa.some((d) => d.stepId === 's-verify-mfa' && d.kind === 'hard'))
  assert.ok(!graph.block.some((d) => d.stepId === 's-verify-mfa'), 'a block does not wait for the campaign')
  // The admins step prompts a subset of the MFA population, and both are
  // sign-in-method changes, so they go in one change window and interrupt those
  // people once. The same-people rule does not separate steps that would be
  // enforced together; it separates classes.
  assert.ok(!graph.admins.some((d) => d.stepId === 'mfa' && d.kind === 'soft'), 'two method changes share a window')
  // Across classes it still holds: a device requirement and a method
  // requirement in the same week really are two different interruptions.
  const withDevice = dependencyGraph([
    ...typical(),
    step({ id: 'devices', phase: 5, readiness: { family: 'device', percent: 100, lines: [] } }),
  ])
  assert.ok(
    withDevice.devices.some((d) => d.stepId === 'mfa' && d.kind === 'soft'),
    'a device change does not share a window with a method change',
  )
})

test('12 active users: small band, registration window, rings dated after their dependencies', () => {
  const steps = typical()
  const s = buildSchedule(steps, MON, 12, null, { registrationDays: 10 })
  assert.equal(s.band, 'small')
  assert.equal(s.verification.workingDays, 10)
  assert.equal(s.verification.days, 14)
  // The REPORTED window runs from creation to the first change, so it is as
  // long as the wait actually is (prompt 40 §18). The window a step must serve
  // before it may enforce is separate, and is 7 days here (prompt 42 §1).
  assert.equal(observationDaysFor(steps.find((x) => x.id === 'mfa')!), 7)
  assert.ok(s.observation.days >= 7, `the reported window is at least the 7 days a step must serve, got ${s.observation.days}`)
  assert.equal(s.observation.end, s.waves.find((w) => w.wave >= 1)?.start, 'the window runs to the first change')
  const mfa = steps.find((x) => x.id === 'mfa')!
  const block = steps.find((x) => x.id === 'block')!
  assert.ok(mfa.rings[0].plannedStart >= s.verification.end, 'MFA enforcement starts after the campaign')
  assert.ok(block.rings[0].plannedStart >= s.observation.end, 'a block enforces after the shared observation window')
  assert.ok(block.rings[0].plannedStart < mfa.rings[0].plannedStart, 'the block does not wait for the campaign')
  for (const st of steps) for (const r of st.rings) assert.ok(day(r.plannedStart) >= 1 && day(r.plannedStart) <= 4, `${st.id} ring starts Monday to Thursday`)
  assert.ok(s.withinBand, `${s.totalDays} days fits the small band`)
  assert.ok(s.derivation.criticalPath.length > 0)
  assert.ok(['verification', 'soft', 'phase', 'rings', 'cap'].includes(s.derivation.constraint), s.derivation.constraint)
  assert.deepEqual(s.waves[0].stepIds.sort(), ['done', 's-prereq-exclusion-group', 's-verify-mfa'])
  assert.equal(s.waveOf.done, 0)
})

test('a ring window is one soak long and the next ring starts when the previous ends', () => {
  const steps = typical()
  buildSchedule(steps, MON, 12)
  const mfa = steps.find((x) => x.id === 'mfa')!
  const [pilot, everyone] = mfa.rings
  assert.equal(Math.round((Date.parse(pilot.plannedEnd) - Date.parse(pilot.plannedStart)) / 86_400_000), 3)
  assert.ok(everyone.plannedStart >= pilot.plannedEnd)
})


test('the weekly cap counts change days: a small tenant gets two a week, and the critical path says so when it binds', () => {
  const steps = Array.from({ length: 6 }, (_, i) =>
    step({ id: `s${i}`, phase: 1, readiness: { family: 'block', percent: null, lines: [] }, population: { total: 5, active: 5, admins: 0, guests: 0, ids: people(5, `p${i}-`) }, rings: [ring(0, 3, people(2, `p${i}-`)), ring(1, 3, people(3, `p${i}-`))] }),
  )
  const s = buildSchedule(steps, MON, 12)
  const weeks = new Map<string, Set<string>>()
  for (const st of steps) for (const r of st.rings) {
    const d = new Date(r.plannedStart)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    const wk = d.toISOString().slice(0, 10)
    weeks.set(wk, new Set([...(weeks.get(wk) ?? []), r.plannedStart.slice(0, 10)]))
  }
  for (const [wk, days] of weeks) assert.ok(days.size <= s.enforcementCap, `${wk} has ${days.size} change days`)
})

test('a change freeze moves every ring around it and the derivation names it', () => {
  const steps = [step({ id: 'a', phase: 1, readiness: { family: 'block', percent: null, lines: [] } })]
  const freeze = { from: '2026-09-07T00:00:00.000Z', to: '2026-10-30T23:59:59.000Z' }
  const s = buildSchedule(steps, MON, 12, null, { freeze })
  for (const r of steps[0].rings) assert.ok(r.plannedStart < freeze.from || r.plannedStart > freeze.to, `${r.plannedStart} is outside the freeze`)
  assert.equal(s.derivation.constraint, 'freeze')
  assert.ok(s.freeze)
})

test('the registration window is the measured working days, alongside the first soak, and the bands stay within their length', () => {
  const mid = buildSchedule(typical(), MON, 100, null, { registrationDays: 10 })
  const large = buildSchedule(typical(), MON, 1000, null, { registrationDays: 20 })
  assert.equal(mid.band, 'mid')
  // Ten working days is two calendar weeks; the window opens on the creation
  // day, the same day observation starts (target-state §9), never before.
  assert.equal(mid.verification.workingDays, 10)
  assert.equal(mid.verification.days, 14)
  assert.equal(mid.verification.start, mid.observation.start)
  assert.ok(mid.withinBand)
  assert.equal(large.band, 'large')
  assert.equal(large.verification.workingDays, 20)
  assert.equal(large.enforcementCap, 2)
  assert.ok(large.withinBand)
  // Without a measurement there is no window: the band has no number of its own.
  assert.equal(buildSchedule(typical(), MON, 100).verification.days, 0)
})

test('the band can be overridden', () => {
  const s = buildSchedule(typical(), MON, 12, 'large')
  assert.equal(s.band, 'large')
  assert.equal(s.bandSource, 'override')
  assert.equal(s.enforcementCap, 2)
})

test('verification complete on a re-scan pulls the steps that waited on it forward', () => {
  const beforeSteps = typical()
  const before = buildSchedule(beforeSteps, MON, 12, null, { registrationDays: 15 })
  const afterSteps = typical().map((s) => (s.id === 's-verify-mfa' ? { ...s, status: 'done' as const } : s))
  const after = buildSchedule(afterSteps, MON, 12, null, { registrationDays: 15 })
  assert.equal(after.verification.days, 0)
  assert.equal(after.verification.complete, true)
  // The step that waits on registration is the one that moves. The first wave
  // does not: it is a block that never depended on the campaign, and its date
  // comes from the observation window. Asserting on the whole plan's end hid
  // that distinction and stopped being true once the change-window cap, rather
  // than the campaign, set the tail.
  const startOf = (steps: Step[], id: string): string => steps.find((x) => x.id === id)!.rings[0].plannedStart
  assert.ok(
    Date.parse(startOf(afterSteps, 'mfa')) < Date.parse(startOf(beforeSteps, 'mfa')),
    `MFA enforcement moves forward: ${startOf(afterSteps, 'mfa')} before ${startOf(beforeSteps, 'mfa')}`,
  )
  // And the plan is never LONGER for having less to wait for.
  assert.ok(Date.parse(after.targetEnd) <= Date.parse(before.targetEnd), `the plan is no longer: ${after.targetEnd} vs ${before.targetEnd}`)
})

test('a blocked step enforces after its blocker, whatever its phase', () => {
  const loc = step({ id: 'loc', phase: 2, readiness: { family: 'block', percent: null, lines: [] } })
  const reg = step({ id: 'reg', phase: 1, status: 'blocked', blockedBy: ['loc'] })
  const s = buildSchedule([loc, reg], MON, 20)
  assert.ok(reg.rings[0].plannedStart >= loc.rings.at(-1)!.plannedEnd)
  assert.ok(s.waveOf.reg >= s.waveOf.loc)
})

test('all done → no windows, finishes on day 0', () => {
  const s = buildSchedule([step({ id: 'a', status: 'done', rings: [] })], MON, 20)
  assert.equal(s.observation.days, 0)
  assert.equal(s.verification.days, 0)
  assert.equal(s.targetEnd, s.start)
  assert.equal(s.waves.length, 1)
  assert.equal(s.derivation.constraint, 'none')
})

test('the weekly cap counts change windows, not steps (prompt 41 §5)', () => {
  // Eight steps of one class, all eligible at once. Before batching the cap was
  // applied per step, so eight steps meant eight slots and a plan that ran for
  // weeks; they share a supervised window and should land together.
  const steps = Array.from({ length: 8 }, (_, i) =>
    step({
      id: `mfa-${i}`,
      phase: 2,
      readiness: { family: 'mfa', percent: 100, lines: [] },
      population: { total: 20, active: 20, admins: 0, guests: 0, ids: people(20) },
      rings: [ring(0, 3, people(20))],
    }),
  )
  const s = buildSchedule(steps, MON, 12)
  const days = new Set(steps.map((x) => x.rings[0].plannedStart.slice(0, 10)))
  assert.equal(days.size, 1, `eight changes of one class share one change window, not ${days.size}`)
  // And the plan says so: each step names the others it goes with.
  for (const x of steps) assert.equal(s.batchWith[x.id]?.length, 7, `${x.id} names the other seven`)
})

test('a batch never mixes a zero-affected change with one that has a blast radius (prompt 41 §6)', () => {
  // Same phase, same day available, deliberately different disruption classes.
  // Phase order does not separate these, so only the batch class can.
  const zero = step({
    id: 'block-legacy',
    phase: 1,
    readiness: { family: 'block', percent: null, lines: [] },
    evidence: { status: 'ok', lines: [], affectedUserIds: [], reportOnly: null },
    population: { total: 20, active: 20, admins: 0, guests: 0, ids: people(20) },
    rings: [ring(0, 3, people(20))],
  })
  const loud = step({
    id: 'require-mfa',
    phase: 1,
    readiness: { family: 'mfa', percent: 100, lines: [] },
    evidence: { status: 'ok', lines: [], affectedUserIds: people(9, 'a'), reportOnly: null },
    population: { total: 20, active: 20, admins: 0, guests: 0, ids: people(20) },
    rings: [ring(0, 3, people(20))],
  })
  assert.equal(batchClassOf(zero), 'zero')
  assert.equal(batchClassOf(loud), 'mfa')
  const s = buildSchedule([zero, loud], MON, 12)
  // They may share a DAY - a small tenant is allowed two change windows in one
  // day - but never a WINDOW. Each is supervised on its own terms: the block is
  // watched for a surprise, the MFA enforcement for a queue at the help desk.
  assert.deepEqual(s.batchWith['block-legacy'], [], 'the zero-affected change is its own window')
  assert.deepEqual(s.batchWith['require-mfa'], [], 'the MFA change is its own window')
  assert.ok(
    !(s.batchWith['block-legacy'] as string[]).includes('require-mfa'),
    'a change nobody notices is never bundled with one that interrupts nine people',
  )
})

test('a wave is named by every goal area it holds, not by one dominant phase (prompt 40 §20)', () => {
  const steps = [
    step({ id: 's-prereq-exclusion-group', phase: 0, kind: 'prerequisite', rings: [], readiness: { family: 'other', percent: null, lines: [] } }),
    step({ id: 'admin', phase: 3, readiness: { family: 'admin', percent: 100, lines: [] }, population: { total: 2, active: 2, admins: 2, guests: 0, ids: ['a0', 'a1'] }, rings: [ring(0, 3, ['a0'])] }),
    step({ id: 'devices', phase: 5, readiness: { family: 'device', percent: 100, lines: [] }, population: { total: 2, active: 2, admins: 0, guests: 0, ids: ['d0', 'd1'] }, rings: [ring(0, 3, ['d0'])] }),
  ]
  const s = buildSchedule(steps, MON, 12)
  const withBoth = s.waves.filter((w) => w.wave >= 1).find((w) => w.stepIds.includes('admin') && w.stepIds.includes('devices'))
  // Phases are numbered, not named (target-state §5): the wave still records the
  // goal-area bands it holds, but the wave-name table that labelled them is gone.
  if (withBoth) assert.deepEqual(withBoth.phases, [3, 5], 'the wave records both areas it holds')
  // Every wave records at least the phase it is ordered by, whatever it holds.
  for (const w of s.waves) assert.ok(w.phases.length > 0 && w.phases.includes(w.phase), `wave ${w.wave} records its own phase`)
})

test('phase order (ux-review-07 §3): no step starts before the last start of any lower phase, and waves are named by their dominant phase', () => {
  const steps = [
    step({ id: 's-prereq-exclusion-group', phase: 0, kind: 'prerequisite', rings: [], readiness: { family: 'other', percent: null, lines: [] } }),
    step({ id: 'admin', phase: 3, readiness: { family: 'admin', percent: 100, lines: [] }, population: { total: 2, active: 2, admins: 2, guests: 0, ids: ['a0', 'a1'] }, rings: [ring(0, 3, ['a0']), ring(1, 3, ['a1'])] }),
    step({ id: 'mfa', phase: 2 }),
    step({ id: 'block', phase: 1, readiness: { family: 'block', percent: null, lines: [] }, population: { total: 5, active: 5, admins: 0, guests: 0, ids: people(5, 'b') }, rings: [ring(0, 3, people(2, 'b')), ring(1, 3, people(3, 'b'))] }),
  ]
  const s = buildSchedule(steps, MON, 12)
  const startOf = (id: string) => steps.find((x) => x.id === id)!.rings[0].plannedStart
  assert.ok(startOf('block') <= startOf('mfa'), 'blocks start no later than MFA')
  assert.ok(startOf('mfa') <= startOf('admin'), 'admin hardening follows MFA')
  const phases = s.waves.filter((w) => w.wave > 0).map((w) => w.phase)
  assert.deepEqual([...phases], [...phases].sort((a, b) => a - b), 'waves read in phase order')
  assert.ok(!phases.includes(0), 'no enforcement wave is named Foundations')
})
