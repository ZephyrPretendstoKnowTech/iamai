// roadmap-v2.md §7 — the property assertions, run over every synthetic tenant.
// These are the specification for rings, sequencing, populations and step
// content; docs/qa/roadmap-v2-baseline.md records how they failed first.
import { isEmergencyAccess } from '../blockerSteps.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './index.ts'
import { runFixture } from './run.ts'
import { batchClassOf } from '../schedule.ts'
import { unavailableReason } from '../operations.ts'
import { canDenyAccess, wouldStrand } from '../strand.ts'
import { localHour } from '../timing.ts'
import { buildPlanFile } from '../plan.ts'
import { NO_ANNOUNCEMENT } from '../../copy/announcements.ts'
import type { Step } from '../types.ts'

const fixtures = allFixtures()
const HIGH_DISRUPTION = 4

const fmt = (n: number) => n.toLocaleString('en-AU')

function ringOverlap(x: RingLike, y: RingLike): number {
  if (x.targeting.suggestedMemberIds.length > 0 && y.targeting.suggestedMemberIds.length > 0) return overlapShare(x.targeting.suggestedMemberIds, y.targeting.suggestedMemberIds)
  if (x.targeting.kind === 'all' && y.targeting.kind === 'all') return 1
  if (x.targeting.kind !== y.targeting.kind) return 0
  if (x.targeting.departments.length === 0 && y.targeting.departments.length === 0) return 1
  return x.targeting.departments.some((d) => y.targeting.departments.includes(d)) ? 1 : 0
}

function overlapShare(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const set = new Set(a)
  const both = b.filter((x) => set.has(x)).length
  return both / Math.min(a.length, b.length)
}

type RingLike = { plannedStart: string; plannedEnd: string; targeting: { kind: string; memberCount: number; suggestedMemberIds: string[]; departments: string[] } }
function ringsOf(step: Step): RingLike[] {
  return (step as unknown as { rings?: RingLike[] }).rings ?? []
}

for (const f of fixtures) {
  const run = runFixture(f)
  const { steps, schedule } = run
  const { snapshot } = f
  const waveWindow = (stepId: string): { start: string; end: string } => {
    const w = schedule.waves.find((x) => x.wave === (schedule.waveOf[stepId] ?? 0))
    return w ? { start: w.start, end: w.end } : { start: schedule.start, end: schedule.start }
  }

  test(`${f.name}: builds a plan without crashing and every step has content`, () => {
    assert.ok(steps.length > 0)
    for (const s of steps) {
      assert.ok(s.title.length > 0, `${s.id} has a title`)
    }
  })

  test(`${f.name}: every step renders exactly one row or one footer line (prompt 50.1 item 4)`, () => {
    // The Plan renders a step as a wave row when it is in a wave and not done
    // (Plan.tsx inWave); a done step renders once, in the footer's "Already in
    // place" (PlanFooter). A step that is neither in a wave nor done renders
    // nowhere — the failure a readiness-held step used to be, before the plan was
    // regenerated from the snapshot.
    const inWaves = new Set(schedule.waves.flatMap((w) => w.stepIds))
    for (const s of steps) {
      // A policy the plan cannot write yet is in no wave — it has no date to sit
      // under — and renders in the Plan's own undated group (Plan.tsx heldRows).
      const held = unavailableReason(s) !== null
      const asRow = s.status !== 'done' && (inWaves.has(s.id) || held)
      const inFooter = s.status === 'done'
      assert.ok(asRow !== inFooter, `${f.name} ${s.id} (${s.status}) renders ${asRow && inFooter ? 'twice' : 'nowhere'}: inWave=${inWaves.has(s.id)}, held=${held}`)
      if (held) assert.ok(!inWaves.has(s.id), `${f.name} ${s.id}: a policy the plan cannot write is in no dated wave`)
    }
  })

  test(`${f.name}: no step strands the operator or a break-glass account`, () => {
    const failures: string[] = []
    for (const s of steps) {
      if (s.status === 'done' || s.status === 'skipped') continue
      for (const bg of f.mapping.breakGlassUserIds) {
        const v = wouldStrand(s, bg, snapshot, { breakGlass: true, allowedCountries: f.mapping.allowedCountries })
        if (v.stranded) failures.push(`${s.id} strands break-glass: ${v.reason}`)
      }
      const v = wouldStrand(s, f.operatorId, snapshot, { breakGlass: false, allowedCountries: f.mapping.allowedCountries })
      // A step that would lock the operator out must say so and must not be offered as ready.
      if (v.stranded && (s.operatorSafe !== false || s.status === 'ready' || s.status === 'ready-to-enforce'))
        failures.push(`${s.id} strands the operator (${v.reason}) yet is ${s.status}, operatorSafe=${String(s.operatorSafe)}`)
    }
    assert.deepEqual(failures, [])
  })

  test(`${f.name}: every prerequisite appears earlier in the schedule`, () => {
    const order = new Map(steps.map((s, i) => [s.id, i]))
    const failures: string[] = []
    for (const s of steps) {
      for (const b of s.blockedBy) {
        if (!order.has(b)) continue
        const wb = schedule.waveOf[b] ?? 0
        const ws = schedule.waveOf[s.id] ?? 0
        if (wb > ws || (wb === ws && (order.get(b) ?? 0) > (order.get(s.id) ?? 0))) failures.push(`${s.id} (wave ${ws}) depends on ${b} (wave ${wb})`)
      }
    }
    assert.deepEqual(failures, [])
  })

  test(`${f.name}: every date is derivable from the graph and the band`, () => {
    // The derivation travels with the schedule (§2: no hard-coded wave dates).
    const derivation = (schedule as unknown as { derivation?: { criticalPath: string; constraint: string } }).derivation
    assert.ok(derivation && derivation.criticalPath.length > 0, 'schedule carries a critical-path derivation')
    let prevStart = schedule.start
    for (const w of schedule.waves) {
      assert.ok(!Number.isNaN(Date.parse(w.start)) && !Number.isNaN(Date.parse(w.end)), `wave ${w.wave} has real dates`)
      assert.ok(w.start >= prevStart, `wave ${w.wave} starts (${w.start}) no earlier than the previous wave (${prevStart})`)
      prevStart = w.start
    }
    const graph = (schedule as unknown as { graph: Record<string, { stepId: string; kind: string }[]> }).graph
    for (const s of steps) {
      for (const r of ringsOf(s)) {
        const day = new Date(r.plannedStart).getUTCDay()
        assert.ok(day === 2 || day === 3 || day === 4, `${s.id} ring ${r.plannedStart} starts on a Tuesday, a Wednesday or a Thursday`)
        assert.ok(r.plannedEnd > r.plannedStart, `${s.id} ring has a real window`)
      }
      for (const d of graph[s.id] ?? []) {
        if (d.kind !== 'hard') continue
        const other = steps.find((x) => x.id === d.stepId)
        const oe = other && ringsOf(other).length > 0 ? ringsOf(other).at(-1)!.plannedEnd : null
        const ss = ringsOf(s)[0]?.plannedStart ?? null
        if (oe && ss) assert.ok(ss >= oe, `${s.id} starts (${ss}) after ${d.stepId} ends (${oe})`)
      }
    }
    assert.ok(schedule.totalDays <= f.expect.weeksAtMost * 7 + 7, `${schedule.weeks} weeks (${schedule.totalDays} days) fits the band (${f.expect.weeksAtMost} weeks plus the week of slack)`)

    // A batch never mixes a change nobody will notice with one that has a
    // predicted blast radius (prompt 41 §6). The two need different
    // supervision, and grouping them hides the second behind the first.
    {
      // Grouped by the batch, not by the day. Two batches may share a day — a
      // small tenant is allowed two change windows in one day — but no single
      // batch may hold two disruption classes.
      const byId = new Map(steps.map((st) => [st.id, st]))
      for (const [id, others] of Object.entries(schedule.batchWith)) {
        const self = byId.get(id)
        if (!self) continue
        const group = [self, ...others.map((o) => byId.get(o)).filter((x): x is Step => x !== undefined)]
        const classes = new Set(group.map(batchClassOf))
        assert.equal(classes.size, 1, `${id} shares a change window with another class: ${[...classes].join(', ')}`)
      }
      // Every step sharing a window shares its day, and the relationship is
      // symmetric: a one-sided batch would print two different sentences about
      // the same change window.
      for (const [id, others] of Object.entries(schedule.batchWith)) {
        for (const o of others) {
          assert.ok(schedule.batchWith[o]?.includes(id), `${id} and ${o} disagree about sharing a window`)
        }
      }
    }

    // Enforcement slots vary, and announcements are readable (prompt 42 §12).
    // Every enforcement in every week landed at 12:00 for eleven weeks, and
    // announcements went out at 18:00, the last minute of the working day
    // (review-09 findings 10 and 11).
    {
      const zone = run.input.mapping.displayTimeZone ?? 'UTC'
      const enforceHours = new Set<number>()
      for (const st of steps) {
        const e = st.events
        if (!e) continue
        enforceHours.add(localHour(e.enforce.at, zone))
        for (const m of [e.announce, e.remind]) {
          if (!m) continue
          const hour = localHour(m.at, zone)
          assert.ok(hour >= 8 && hour <= 12, `a message at ${hour}:00 is early enough in the day to be read`)
        }
      }
      if (steps.filter((st) => st.events).length >= 6) {
        assert.ok(enforceHours.size > 1, `enforcement does not always land at the same time: ${[...enforceHours].join(", ")}`)
      }
    }

    // Announcement, then reminder, then enforcement (prompt 41 §2). Order is
    // asserted on the instant, not the day, because the defect review 09 found
    // was an enforcement at 12:00 and a message at 18:00 on the SAME date: a
    // day-granularity check would have called that correct. A message that
    // arrives after the change it announces is worse than no message, because
    // the person has already been interrupted and now learns it was planned.
    for (const st of steps) {
      const e = st.events
      if (!e) continue
      for (const m of [e.announce, e.remind, e.remindMorning]) {
        if (!m) continue
        assert.ok(
          m.at < e.enforce.at,
          `${st.id}: the ${m.kind} at ${m.at} must precede its own enforcement at ${e.enforce.at}`,
        )
      }
      if (e.announce && e.remind) {
        assert.ok(e.announce.at <= e.remind.at, `${st.id}: the announcement must not follow its own reminder`)
      }
      // A step with a reminder and no announcement is a reminder about nothing.
      if (e.remind) assert.ok(e.announce !== null, `${st.id}: a reminder needs an announcement before it`)
    }

    // The day a phase closes belongs to that phase (prompt 40 §21). Two steps
    // were planned for Sep 3, the day Day 0 closed (review-08 C2). The date at
    // fault is the report-only creation date, not a ring start: enforcement is
    // Tuesday-or-Wednesday only, so it rarely lands on a closing day by
    // accident, while creation was pinned to the closing day by construction.
    const day0Close = schedule.waves[0].end.slice(0, 10)
    for (const [id, at] of Object.entries(schedule.reportOnlyAt)) {
      assert.notEqual(at.slice(0, 10), day0Close, `${id} is not created on the day Day 0 closes (${day0Close})`)
    }
    for (const st of steps) {
      for (const g of st.rings) {
        assert.notEqual(g.plannedStart.slice(0, 10), day0Close, `${st.id} does not start on the day Day 0 closes (${day0Close})`)
      }
    }
    // The observation window stays open until the wave it informs (prompt 40
    // §18). It used to close twelve days early, so the page said the evidence
    // stopped being gathered long before anyone acted on it (review-08 B4).
    const firstWave = schedule.waves.find((w) => w.wave >= 1)
    assert.ok(
      schedule.observation.start >= schedule.start,
      `observation opens once the report-only policies exist (${schedule.observation.start})`,
    )
    if (firstWave && schedule.observation.days > 0) {
      assert.equal(
        schedule.observation.end,
        firstWave.start,
        'the observation window stays open until the wave it informs, with no gap',
      )
    }
  })

  test(`${f.name}: rings match the band table`, () => {
    for (const s of steps) {
      const rings = ringsOf(s)
      // A policy the plan cannot write yet is not rolled out in rings: an object
      // it names is missing, a pair it cannot match, or a baseline that
      // contradicts itself (roadmap/operations.ts).
      if (unavailableReason(s) !== null) {
        assert.deepEqual(rings, [], `${s.id} (${unavailableReason(s)}) has no rings`)
        continue
      }
      if (!canDenyAccess(s) || s.status === 'done' || s.status === 'skipped') {
        assert.ok(rings.length <= 1, `${s.id} (${s.kind}) has at most one ring`)
        continue
      }
      assert.equal(rings.length, f.expect.rings, `${s.id} has ${f.expect.rings} rings`)
      const members = rings.reduce((n, r) => n + r.targeting.memberCount, 0)
      assert.equal(members, s.population.total, `${s.id}: ring members sum to the population`)
    }
  })

  test(`${f.name}: every population statement sums against the fixture`, () => {
    const enabled = snapshot.users.filter((u: { accountEnabled: boolean | null }) => u.accountEnabled !== false).length
    for (const s of steps) {
      const p = s.population
      assert.equal(p.total, p.ids.length, `${s.id}: total equals ids`)
      assert.equal(new Set(p.ids).size, p.ids.length, `${s.id}: no duplicate ids`)
      assert.ok(p.active <= p.total && p.admins <= p.total && p.guests <= p.total, `${s.id}: parts fit the total`)
      assert.ok(p.total <= enabled, `${s.id}: population within enabled users`)
    }
  })

  test(`${f.name}: the roadmap engine finishes inside its bound`, () => {
    // Coverage is computed once per scan and cached; the roadmap is what a re-plan, a ring change or a Steps render pays for.
    // Best of three: the bound is on the engine, not on the machine's noise.
    // The 25,000-user fixture gets 400 ms rather than 200: measured at 183 ms
    // best of four in isolation before prompt 46, and 218–237 ms after it,
    // because every goal step is now executable (16 more steps per plan carry
    // a body, rings and content) and Wave 0 names the dormant accounts. The
    // test files run in parallel, so a bound within 1.3× of the isolated time
    // crossed over under contention rather than on a regression; this keeps
    // the same headroom ratio the 300 ms bound had. Prompt 48 adds the
    // lockout-scenario lines to every step (named from evidence), a further
    // per-plan cost like prompt 46's executable steps; isolated best is ~300 ms,
    // so the bound moves to 500 to keep the same contention headroom. Every
    // other fixture keeps 200 ms.
    const bound = f.name === 'huge' ? 500 : 200
    const best = Math.min(run.roadmapMs, runFixture(f).roadmapMs, runFixture(f).roadmapMs)
    assert.ok(best < bound, `${best.toFixed(0)} ms against a ${bound} ms bound (with coverage: ${run.ms.toFixed(0)} ms)`)
  })

  test(`${f.name}: the plan file round-trips with every number preserved`, () => {
    const file = buildPlanFile({
      planId: f.planId,
      snapshot,
      operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
      baselineSource: { owner: 'fixture', repo: 'baseline', label: 'Fixture', commit: 'abc' } as never,
      mapping: f.mapping,
      steps,
      checkpoints: [],
      schedule: { startDate: schedule.start, band: schedule.band },
    })
    const back = JSON.parse(JSON.stringify(file)) as typeof file
    assert.equal(back.steps.length, steps.length)
    for (const [i, s] of steps.entries()) {
      const b = back.steps[i] as unknown as Record<string, unknown>
      assert.equal(b.id, s.id)
      assert.deepEqual(b.population, s.population, `${s.id}: population preserved`)
      // The rings' numbers and dates travel; their criteria prose does not (prompt 53 queue item 7: the file carries no v2 prose).
      const datesOf = (rings: RingLike[]) => rings.map((r) => ({ plannedStart: r.plannedStart, plannedEnd: r.plannedEnd, members: r.targeting.memberCount }))
      if (ringsOf(s).length > 0) assert.deepEqual(datesOf(b.rings as RingLike[]), datesOf(ringsOf(s)), `${s.id}: rings preserved`)
    }
  })

}

// ---- fixture-specific shapes (§7 table) ----

const byName = (name: string) => fixtures.find((x) => x.name === name)!

test('micro: free-tier ladder, no Conditional Access steps offered as ready', () => {
  const { steps } = runFixture(byName('micro'))
  assert.ok(steps.every((s) => s.action.json === null || s.status === 'blocked'), 'no ready CA policy creation without P1')
})

test('mid: service accounts surface before the legacy-auth block', () => {
  const { steps } = runFixture(byName('mid'))
  const block = steps.find((s) => s.goalId === 'block-legacy-auth')
  assert.ok(block, 'legacy block step exists')
  const idx = steps.findIndex((s) => s.id === block?.id)
  assert.ok(steps.slice(0, idx).some((s) => /service account/i.test(s.title)), 'a service-account step precedes the block')
})

test('messy: conflicts are detected and ordered first', () => {
  const { steps } = runFixture(byName('messy'))
  // The foundations and the validation blockers lead the whole plan
  // (validation-rules.md §2); the tenant's own conflicts lead everything after them.
  const leads = (s: Step): boolean => s.id.startsWith('s-blocker-') || isEmergencyAccess(s)
  const open = steps.filter((s) => s.status !== 'done')
  assert.ok(open.every((s, i) => !leads(s) || open.slice(0, i).every(leads)), 'the foundations and blockers come first, together')
  const first = open.filter((s) => !leads(s)).slice(0, 3)
  assert.ok(first.some((s) => /security defaults/i.test(s.title)), 'security defaults conflict comes first after the blockers')
  assert.ok(steps.some((s) => /per-user/i.test(s.title)), 'per-user MFA is named')
})

test('midflight: no duplicate steps', () => {
  const { steps } = runFixture(byName('midflight'))
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length)
  assert.equal(new Set(steps.map((s) => s.title)).size, steps.length, 'no two steps share a title')
})

test('hostile: every step still produced with readiness marked unknown', () => {
  const { steps } = runFixture(byName('hostile'))
  const normal = runFixture(byName('small')).steps
  assert.ok(steps.length >= normal.length - 2, `hostile produced ${steps.length} steps vs ${normal.length}`)
  for (const s of steps) {
    if (!canDenyAccess(s) || s.status === 'done') continue
    // A source the scan could not read never masquerades as a number.
    if (['mfa', 'guest', 'admin', 'device'].includes(s.readiness.family)) assert.equal(s.readiness.percent, null, `${s.id}: readiness is unknown, never a number`)
  }
})

test('getiamai: 2 active people (the emergency accounts are not people) and 9 who never signed in plan in four weeks with no registration window on the critical path', () => {
  const r = runFixture(byName('getiamai'))
  assert.equal(r.schedule.activeUsers, 2)
  assert.equal(r.schedule.band, 'small')
  assert.ok(r.schedule.weeks <= 4, `${r.schedule.weeks} weeks`)
  assert.notEqual(r.schedule.derivation.constraint, 'verification', r.schedule.derivation.criticalPath)
  const verify = r.steps.find((s) => s.kind === 'verify')
  if (verify) assert.equal(r.schedule.derivation.chain.includes(verify.id), false, 'the registration window is not on the critical path')
  // The nine who never signed in are Wave 0 housekeeping, not a denominator anywhere.
  const dormant = r.steps.find((s) => s.id === 's-check-dormant-accounts')
  assert.ok(dormant && dormant.population.total === 9, 'nine dormant accounts to decide on')
  for (const s of r.steps) if (s.rings.length > 0) assert.equal(s.rings.length, 1, `${s.id}: no rings below 50 active people`)
})

test('owner travels with the plan file; a per-step date no longer moves the schedule (target-state §9)', () => {
  const f = byName('small')
  const first = runFixture(f)
  const moved = first.steps.find((s) => s.rings.length > 0 && s.status !== 'done')!
  moved.owner = 'Identity team'
  const file = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { owner: 'fixture', repo: 'baseline', label: 'Fixture', commit: 'abc' } as never,
    mapping: f.mapping,
    steps: first.steps,
    checkpoints: [],
  })
  const back = JSON.parse(JSON.stringify(file)) as typeof file
  const saved = back.steps.find((s) => s.id === moved.id)!
  assert.equal(saved.owner, 'Identity team')
  // The rings' dates travel; their criteria prose does not (prompt 53 queue item 7).
  assert.deepEqual(saved.rings.map((r) => [r.plannedStart, r.plannedEnd]), moved.rings.map((r) => [r.plannedStart, r.plannedEnd]))
})

// Prompt 47 item 6: a wave holds at least one step that reaches somebody. A
// step that affects nobody (a block nobody uses, a risk policy with no flagged
// sign-in) batches into a wave with a real change, never a wave of its own.
test('no wave whose only occupants are zero-class steps (small, getiamai, and every other tenant)', () => {
  for (const { name } of fixtures) {
    const r = runFixture(byName(name))
    const byId = new Map(r.steps.map((s) => [s.id, s]))
    for (const w of r.schedule.waves) {
      if (w.wave === 0 || w.stepIds.length === 0) continue
      const classes = w.stepIds.map((id) => batchClassOf(byId.get(id)!))
      assert.ok(classes.some((c) => c !== 'zero'), `${name}: wave ${w.wave} holds only zero-class steps: ${w.stepIds.join(', ')}`)
    }
  }
})

test('risk goals affect nobody when the collected sign-ins carry no risk verdict', () => {
  // Risk policies need a P2 licence, so the P1 tenants (small, getiamai) plan none; the P2 tenants prove the rule.
  let seen = 0
  for (const f of fixtures) {
    const r = runFixture(f)
    for (const s of r.steps.filter((x) => x.readiness.family === 'risk')) {
      if (s.evidence.status !== 'ok') continue
      seen += 1
      assert.equal(s.evidence.affectedUserIds.length, 0, `${f.name} ${s.id}: nobody had a flagged sign-in`)
      assert.equal(batchClassOf(s), 'zero', `${f.name} ${s.id} is zero-class`)
    }
  }
  assert.ok(seen >= 4, `risk steps with usable evidence across the fixtures: ${seen}`)
})
