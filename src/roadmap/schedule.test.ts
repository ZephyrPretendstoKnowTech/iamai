// The graph scheduler (roadmap-v2.md §2): dates derive from the dependency
// graph plus the band's durations; the calendar rules hold; the critical
// path is stated. Authored steps only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule, dependencyGraph, nextMonday, toEnforcementDay } from './schedule.ts'
import { bandForActiveUsers } from './constants.ts'
import type { Ring, Step } from './types.ts'

const people = (n: number, prefix = 'u'): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

function ring(index: number, soakDays: number, ids: string[]): Ring {
  return {
    index,
    name: index === 0 ? 'Pilot' : 'Everyone',
    targeting: { kind: index === 0 ? 'group' : 'all', groupName: null, memberCount: ids.length, suggestedMemberIds: ids, filter: null, departments: [], advice: '' },
    entryCriteria: [],
    exitCriteria: [],
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
    whyAttribution: null,
    status: 'ready',
    blockedBy: [],
    blockers: [],
    unblockNotes: [],
    population: { total: ids.length, active: ids.length, admins: 0, guests: 0, ids },
    readiness: { family: 'mfa', percent: 100, lines: [] },
    evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
    action: { kind: 'create', summary: [], json: '{}', portalSteps: [], powershell: null },
    exitCriteria: [],
    rollback: '',
    history: [],
    skipReason: null,
    deliveredBy: [],
    stateReason: '',
    whyLink: null,
    impact: '',
    safeToday: false,
    highCare: { userIds: [], ready: true, notes: [] },
    comms: null,
    learn: null,
    includesOperator: false,
    operatorSafe: null,
    rings: [ring(0, 3, ids.slice(0, 3)), ring(1, 3, ids.slice(3))],
    currentRing: 0,
    denies: true,
    populationBasis: '',
    populationNames: [],
    populationView: null,
    whatChanges: '',
    failureModes: [],
    verify: null,
    helpDesk: null,
    ringComms: [],
    rollbackBody: null,
    owner: null,
    scheduledDate: null,
    ...over,
  }
}

const MON = '2026-08-31T00:00:00.000Z'
const day = (iso: string) => new Date(iso).getUTCDay()

const typical = () => [
  step({ id: 's-prereq-exclusion-group', phase: 0, kind: 'prerequisite', rings: [], denies: false, readiness: { family: 'other', percent: null, lines: [] } }),
  step({ id: 's-verify-mfa', phase: 2, kind: 'verify', rings: [], denies: false }),
  step({ id: 'block', phase: 1, readiness: { family: 'block', percent: null, lines: [] }, score: { domain: 'Identity', value: 3, effort: 1, disruption: 1, priority: 10 } }),
  step({ id: 'mfa', phase: 2, score: { domain: 'Identity', value: 5, effort: 2, disruption: 2, priority: 10 } }),
  step({ id: 'admins', phase: 3, readiness: { family: 'admin', percent: 100, lines: [] }, population: { total: 2, active: 2, admins: 2, guests: 0, ids: ['u0', 'u1'] }, rings: [ring(0, 3, ['u0']), ring(1, 3, ['u1'])] }),
  step({ id: 'done', phase: 3, status: 'done', rings: [] }),
]

test('nextMonday lands on a Monday after the given date', () => {
  const m = nextMonday('2026-08-26T10:00:00Z') // a Wednesday
  assert.equal(day(m), 1)
  assert.equal(m.slice(0, 10), '2026-08-31')
})

test('bands follow §A3: small ≤30, mid 31–300, large >300', () => {
  assert.equal(bandForActiveUsers(12), 'small')
  assert.equal(bandForActiveUsers(30), 'small')
  assert.equal(bandForActiveUsers(31), 'mid')
  assert.equal(bandForActiveUsers(300), 'mid')
  assert.equal(bandForActiveUsers(301), 'large')
})

test('enforcement never starts on a Friday or a weekend', () => {
  assert.equal(day(toEnforcementDay('2026-09-04T12:00:00.000Z')), 1) // Friday → Monday
  assert.equal(day(toEnforcementDay('2026-09-05T12:00:00.000Z')), 1)
  assert.equal(day(toEnforcementDay('2026-09-06T12:00:00.000Z')), 1)
  assert.equal(toEnforcementDay('2026-09-03T12:00:00.000Z'), '2026-09-03T12:00:00.000Z') // Thursday stays
})

test('the graph names the rule dependencies: exclusion group first, break-glass before a block, campaign before MFA', () => {
  const graph = dependencyGraph(typical())
  assert.ok(graph.block.some((d) => d.stepId === 's-prereq-exclusion-group' && d.kind === 'hard'))
  assert.ok(graph.mfa.some((d) => d.stepId === 's-verify-mfa' && d.kind === 'hard'))
  assert.ok(!graph.block.some((d) => d.stepId === 's-verify-mfa'), 'a block does not wait for the campaign')
  // The admins step prompts a subset of the MFA population: a soft dependency, never a hard one.
  assert.ok(graph.admins.some((d) => d.stepId === 'mfa' && d.kind === 'soft'))
})

test('12 active users: small band, verification window, rings dated after their dependencies', () => {
  const steps = typical()
  const s = buildSchedule(steps, MON, 12)
  assert.equal(s.band, 'small')
  assert.equal(s.verification.days, 14)
  assert.equal(s.observation.days, 7)
  const mfa = steps.find((x) => x.id === 'mfa')!
  const block = steps.find((x) => x.id === 'block')!
  assert.ok(mfa.rings[0].plannedStart >= s.verification.end, 'MFA enforcement starts after the campaign')
  assert.ok(block.rings[0].plannedStart >= s.observation.end, 'a block enforces after the shared observation window')
  assert.ok(block.rings[0].plannedStart < mfa.rings[0].plannedStart, 'the block does not wait for the campaign')
  for (const st of steps) for (const r of st.rings) assert.ok(day(r.plannedStart) >= 1 && day(r.plannedStart) <= 4, `${st.id} ring starts Monday to Thursday`)
  assert.ok(s.withinBand, `${s.totalDays} days fits the small band`)
  assert.ok(s.derivation.criticalPath.length > 0)
  assert.equal(s.derivation.constraint, 'verification')
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

test('two steps that prompt the same people pipeline one ring apart, never the same ring at once', () => {
  const ids = people(20)
  const a = step({ id: 'a', phase: 1, score: { domain: 'Identity', value: 5, effort: 1, disruption: 4, priority: 5 } })
  const b = step({ id: 'b', phase: 1, score: { domain: 'Identity', value: 5, effort: 1, disruption: 4, priority: 5 }, population: { total: 20, active: 20, admins: 0, guests: 0, ids } })
  buildSchedule([a, b], MON, 12)
  for (const i of [0, 1]) {
    const x = a.rings[i]
    const y = b.rings[i]
    assert.ok(x.plannedEnd <= y.plannedStart || y.plannedEnd <= x.plannedStart, `ring ${i} windows do not overlap`)
  }
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

test('mid and large bands lengthen the campaign and stay within their band for a typical plan', () => {
  const mid = buildSchedule(typical(), MON, 100)
  const large = buildSchedule(typical(), MON, 1000)
  assert.equal(mid.band, 'mid')
  assert.equal(mid.verification.days, 28)
  assert.ok(mid.withinBand)
  assert.equal(large.band, 'large')
  assert.equal(large.verification.days, 42)
  assert.ok(large.withinBand)
})

test('the band can be overridden', () => {
  const s = buildSchedule(typical(), MON, 12, 'large')
  assert.equal(s.band, 'large')
  assert.equal(s.bandSource, 'override')
  assert.equal(s.verification.days, 42)
})

test('verification complete on a re-scan pulls enforcement forward and shortens the end date', () => {
  const before = buildSchedule(typical(), MON, 12)
  const after = buildSchedule(
    typical().map((s) => (s.id === 's-verify-mfa' ? { ...s, status: 'done' as const } : s)),
    MON,
    12,
  )
  assert.equal(after.verification.days, 0)
  assert.equal(after.verification.complete, true)
  assert.ok(Date.parse(after.targetEnd) < Date.parse(before.targetEnd))
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
