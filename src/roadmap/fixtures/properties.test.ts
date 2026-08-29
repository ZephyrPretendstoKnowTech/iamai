// roadmap-v2.md §7 — the property assertions, run over every synthetic tenant.
// These are the specification for rings, sequencing, populations and step
// content; docs/qa/roadmap-v2-baseline.md records how they failed first.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './index.ts'
import { runFixture } from './run.ts'
import { canDenyAccess, wouldStrand } from '../strand.ts'
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
      assert.ok(s.impact.length > 0, `${s.id} has an impact sentence`)
      assert.ok(s.stateReason.length > 0, `${s.id} has a state reason`)
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

  test(`${f.name}: no two high-disruption steps overlap the same ring window for the same population`, () => {
    const risky = steps.filter((s) => (s.score?.disruption ?? 0) >= HIGH_DISRUPTION && s.status !== 'done' && s.status !== 'skipped')
    const failures: string[] = []
    for (let i = 0; i < risky.length; i++) {
      for (let j = i + 1; j < risky.length; j++) {
        const a = risky[i]
        const b = risky[j]
        if (overlapShare(a.population.ids, b.population.ids) <= 0.5) continue
        const ra = ringsOf(a)
        const rb = ringsOf(b)
        if (ra.length === 0 || rb.length === 0) {
          const wa = waveWindow(a.id)
          const wb = waveWindow(b.id)
          if (wa.start < wb.end && wb.start < wa.end) failures.push(`${a.id} and ${b.id} both enforce ${wa.start}..${wa.end} / ${wb.start}..${wb.end}`)
          continue
        }
        // Ring windows are compared for the people each ring touches: a pilot and an "everyone" ring are different people.
        for (const x of ra) for (const y of rb) {
          if (ringOverlap(x, y) <= 0.5) continue
          if (x.plannedStart < y.plannedEnd && y.plannedStart < x.plannedEnd) failures.push(`${a.id} ${x.plannedStart}..${x.plannedEnd} overlaps ${b.id} ${y.plannedStart}..${y.plannedEnd} for the same people`)
        }
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
        assert.ok(day === 2 || day === 3, `${s.id} ring ${r.plannedStart} starts on a Tuesday or a Wednesday`)
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
  })

  test(`${f.name}: rings match the band table`, () => {
    for (const s of steps) {
      const rings = ringsOf(s)
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
      const basis = (s as unknown as { populationBasis?: string }).populationBasis
      assert.ok(basis, `${s.id} carries a population basis sentence`)
      const m = /^([\d,]+) of ([\d,]+) enabled users \((\d+)%\)/.exec(basis ?? '')
      assert.ok(m, `${s.id}: basis "${basis}" states N of M enabled users (P%)`)
      assert.equal(m?.[1], fmt(p.total))
      assert.equal(m?.[2], fmt(enabled))
      assert.equal(Number(m?.[3]), Math.round((p.total / enabled) * 100))
    }
  })

  test(`${f.name}: name lists are bounded`, () => {
    for (const s of steps) {
      const listed = (s as unknown as { populationNames?: string[] }).populationNames ?? []
      if (s.population.total < 25) assert.equal(listed.length, s.population.total, `${s.id}: everyone named under 25`)
      else assert.ok(listed.length <= 10, `${s.id}: at most the 10 riskiest named at ${s.population.total}`)
    }
  })

  test(`${f.name}: the roadmap engine finishes under 200 ms`, () => {
    // Coverage is computed once per scan and cached; the roadmap is what a re-plan, a ring change or a Steps render pays for.
    // Best of three: the bound is on the engine, not on the machine's noise.
    const best = Math.min(run.roadmapMs, runFixture(f).roadmapMs, runFixture(f).roadmapMs)
    assert.ok(best < 200, `${best.toFixed(0)} ms (with coverage: ${run.ms.toFixed(0)} ms)`)
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
      if (ringsOf(s).length > 0) assert.deepEqual(b.rings, ringsOf(s), `${s.id}: rings preserved`)
    }
  })

  test(`${f.name}: policy count is stated and the cap warning matches`, () => {
    const count = (schedule as unknown as { policyCount?: { existing: number; added: number; cap: number; warning: string | null } }).policyCount
    assert.ok(count, 'schedule carries the policy count')
    assert.equal(count?.existing, snapshot.config.caPolicies.rows.length)
    assert.equal(Boolean(count?.warning), f.expect.policyCapWarning)
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
  assert.ok(/service account/i.test(`${block?.impact} ${block?.stateReason} ${block?.evidence.lines.join(' ')}`), 'the block names the service accounts')
  const idx = steps.findIndex((s) => s.id === block?.id)
  assert.ok(steps.slice(0, idx).some((s) => /service account/i.test(s.title)), 'a service-account step precedes the block')
})

test('messy: conflicts are detected and ordered first', () => {
  const { steps } = runFixture(byName('messy'))
  const first = steps.filter((s) => s.status !== 'done').slice(0, 3)
  assert.ok(first.some((s) => /security defaults/i.test(s.title)), 'security defaults conflict comes first')
  assert.ok(steps.some((s) => /per-user/i.test(s.title) || /per-user/i.test(s.impact)), 'per-user MFA is named')
  const sms = steps.find((s) => /break-glass/i.test(s.title) && /(phishing|method|SMS|text message)/i.test(s.title + s.impact + s.stateReason))
  assert.ok(sms, 'the SMS-only break-glass accounts are called out')
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
    const said = [...s.readiness.lines, ...s.evidence.lines].some((l) => /not (be )?read|unknown|could not|unavailable|no sign-in|not readable|not usable/i.test(l))
    assert.ok(said, `${s.id}: says what is unknown (${[...s.readiness.lines, ...s.evidence.lines].join(' | ')})`)
  }
})

// ---- step content (roadmap-v2.md §4) ----

for (const f of fixtures) {
  const run = runFixture(f)
  test(`${f.name}: every step answers the twelve parts it applies to`, () => {
    for (const s of run.steps) {
      assert.ok(s.whatChanges.length > 0, `${s.id}: what changes`)
      assert.ok(s.verify && s.verify.where.length > 0 && s.verify.good.length > 0, `${s.id}: how to verify`)
      if (s.status === 'done' || s.status === 'skipped') continue
      if (canDenyAccess(s)) {
        assert.ok(s.failureModes.length > 0, `${s.id}: what could go wrong`)
        for (const m of s.failureModes) assert.ok(m.evidence.length > 0, `${s.id}: ${m.title} has evidence`)
        assert.ok(s.verify?.filter, `${s.id}: an exact sign-in log filter`)
        assert.ok(s.helpDesk && s.helpDesk.callsAbout.length > 0 && s.helpDesk.whatToSay.length > 0, `${s.id}: help-desk notes`)
        if (s.comms && s.comms !== NO_ANNOUNCEMENT && s.rings.length > 1) assert.equal(s.ringComms.length, s.rings.length, `${s.id}: one announcement per ring`)
        for (const r of s.rings) assert.ok(r.entryCriteria.length > 0 && r.exitCriteria.length > 0, `${s.id}: ring ${r.name} has criteria`)
      }
      if (s.kind === 'adjust' && s.action.json) {
        assert.ok(s.rollbackBody, `${s.id}: previous policy body stored`)
        assert.ok((s.action.changes?.length ?? 0) > 0, `${s.id}: field-by-field changes`)
      }
    }
  })
}

test('owner and scheduled date travel with the plan and move the schedule', () => {
  const f = byName('small')
  const first = runFixture(f)
  const target = first.steps.find((s) => s.rings.length > 0 && s.status !== 'done')!
  const later = '2026-11-02T12:00:00.000Z'
  const second = runFixture(f, { scheduled: { [target.id]: later } })
  const moved = second.steps.find((s) => s.id === target.id)!
  assert.ok(moved.rings[0].plannedStart >= later, `${moved.rings[0].plannedStart} is on or after the scheduled date`)
  assert.equal(second.schedule.derivation.constraint === 'scheduled' || second.schedule.derivation.chain.length > 0, true)
  moved.owner = 'Identity team'
  moved.scheduledDate = later
  const file = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { owner: 'fixture', repo: 'baseline', label: 'Fixture', commit: 'abc' } as never,
    mapping: f.mapping,
    steps: second.steps,
    checkpoints: [],
  })
  const back = JSON.parse(JSON.stringify(file)) as typeof file
  const saved = back.steps.find((s) => s.id === target.id)!
  assert.equal(saved.owner, 'Identity team')
  assert.equal(saved.scheduledDate, later)
  assert.deepEqual(saved.rings, moved.rings)
})
