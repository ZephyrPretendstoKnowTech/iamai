// Foundation A's boundary, asserted structurally rather than example by
// example. Three things have to stay true for an OPEN policy — one the plan is
// still trying to write:
//
//  1. the operation is the only authority. The goal it is filed under, the
//     readiness family, the floor and the people the step happens to list decide
//     none of its consequences;
//  2. the reading is exact or it is explicitly unknown. A field the decoder
//     recognises and then ignores would be read as though the policy did not
//     have it, so `effectOf` turns every leaf it does not consume into a named
//     unknown, and the pinned baseline is swept to prove it needs none of them;
//  3. unknown is conservative. It is not safe, not zero, earns no numeric
//     lockout and no shortened timing.
//
// The invariance tests are the ones that make the boundary hard to reintroduce:
// they rewrite the forbidden sources on every open-policy step of every fixture
// and assert that nothing downstream moves. A new consumer that reads the goal
// family, the floor or the step's population for an open policy fails them
// without anybody having to notice the new line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { accountApplicability, effectOf, implementationOffered, isOpenPolicy, isSubmittablePatch, isValidOperation, operationsOf, stepEffects, strengthLookupOf, unavailableReason } from './operations.ts'
import { canDenyAccess, effectsOf, familyReading, measuredReach, operationReach, promptsPeople, scopeCohort, stepAccountVerdict, stepApplicability, wouldStrand } from './strand.ts'
import { batchClassOf, buildSchedule, dependencyGraph, observationDaysFor } from './schedule.ts'
import { eventsFor, nobodyAffected, noticeDaysFor } from './timing.ts'
import { proposeRings, ringContextIndexes, rolloutCohort } from './rings.ts'
import { reached, stepPopulation } from '../derive/population.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { hasBaselineConflict } from './baselineConflict.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { stepLines } from '../ui/surfaces/stepExport.ts'
import type { Fixture } from './fixtures/index.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { lockoutCount } from './lockout.ts'
import { OBSERVATION_DAYS } from './constants.ts'
import type { Step } from './types.ts'
import PINNED from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }

const FAMILIES: Step['readiness']['family'][] = ['mfa', 'admin', 'device', 'guest', 'block', 'location', 'risk', 'other']
const RECOGNISED_BUT_IGNORED = /^a field IAMAI recognised but did not read: /

const fixtures = allFixtures()
/** Every fixture's plan, derived once: the runs are memoised, the open policies are not. */
const runs = fixtures.map((f) => ({ f, r: runFixture(f) }))
const openPolicies = (steps: Step[]): Step[] => steps.filter((s) => isOpenPolicy(s))

// ---- 1a: the rollout cohort, at the generator ----
//
// The sweeps below perturb a finished plan, which cannot see a number that was
// already worked out and written down while the plan was being built — a ring
// membership, an announcement's audience. These four build the plan instead.

/** The people a step's own policies name, taken from the step as generated. */
const cohortOf = (step: Step): string[] | null => rolloutCohort(step)?.slice().sort() ?? null

/** Who the scan can prove is in a group, as the engine reads it: a sampled list proves nobody out. */
const membersOf = (f: Fixture): { groupMembers: Record<string, string[]> } => ({
  groupMembers: Object.fromEntries([...f.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), [...g.memberIds]])),
})

test('a rollout is the people the policy names, even where the goal is filed under a narrower few', () => {
  // GetIAMAI's guests goal: the baseline's policy for it targets All users and
  // excludes only the exclusions group, while the goal's own expectedWho is
  // `guests` and the tenant has one guest, who is not even active. The rollout is
  // eleven people because the policy names eleven people. A goal population used
  // as an upper bound would have proposed a rollout of one — or, since that one
  // guest is dormant, a who-line reading "nobody affected".
  const { f, r } = runs.find((x) => x.f.name === 'getiamai') as { f: Fixture; r: FixtureRun }
  const step = r.steps.find((x) => x.id === 's-goal-guests-mfa') as Step
  assert.ok(step && isOpenPolicy(step), 'the guests step is an open policy')
  const effects = stepEffects(step)
  assert.ok(effects.length > 0 && effects.every((e) => e.scope.allUsers), 'and its policy names all users')

  const cohort = cohortOf(step)
  assert.ok(cohort !== null, 'whose scope the scan can settle')
  const named = f.snapshot.users.filter((u) => effects.some((e) => accountApplicability(e.scope, u.id, f.snapshot as never, membersOf(f)) === 'in')).map((u) => u.id)
  assert.deepEqual(cohort, named.slice().sort(), 'the cohort is exactly the accounts the policy names')

  // The goal's own population is narrower, and decides none of it.
  assert.ok(step.population.ids.length < cohort.length, `the goal lists fewer (${step.population.ids.length}) than the policy names (${cohort.length})`)
  const members = step.rings.flatMap((x) => x.targeting.suggestedMemberIds)
  assert.deepEqual(members.slice().sort(), cohort, 'every ring member comes from the policy, and everyone the policy names is in a ring')
  assert.equal(step.rings.reduce((n, x) => n + x.targeting.memberCount, 0), cohort.length, 'and the counts say so')
  // The who-line and the audience read the same authority. The goal's one guest
  // is dormant, so a goal-derived line would have read "nobody affected".
  assert.equal(step.population.active, 0, 'the goal population holds nobody active')
  const view = stepPopulation(step)
  assert.ok(view !== null && view.active > 0, 'the surfaces count the people the policy names')
  assert.notEqual(rowWho(step, (id) => r.input.names!.label(id)), 'nobody affected', 'and the row does not report a rollout of nobody')
})

test('the same policy under a different goal population rolls out to the same people and says the same thing', () => {
  // The inverse: the goal population is rewritten on every goal before the plan
  // is built — `all` becomes the core admins and everything else becomes `all` —
  // while the operations, the directory and the mapping are untouched. Readiness
  // moves, and it is allowed to: it is a fact about a goal. The cohort, the ring
  // plan, the counts and the announcement are facts about a policy and may not.
  for (const name of ['getiamai', 'small', 'mid'] as const) {
    const { f, r } = runs.find((x) => x.f.name === name) as { f: Fixture; r: FixtureRun }
    const coverage = structuredClone(r.coverage)
    for (const result of coverage.results) {
      for (const impl of result.goal.implementations) impl.expectedWho = impl.expectedWho.kind === 'all' ? { kind: 'coreAdmins' } : { kind: 'all' }
    }
    const moved = runFixture(f, { coverage })
    let compared = 0
    for (const s of openPolicies(r.steps)) {
      const other = moved.steps.find((x) => x.id === s.id)
      if (!other) continue
      assert.deepEqual(stepEffects(other), stepEffects(s), `${name} ${s.id}: the operations are what this test holds fixed`)
      // A step whose population the engine sets from the tenant itself rather
      // than from the goal (the device steps name the people on a phone) does
      // not move, and proves nothing here.
      if (JSON.stringify(other.population.ids) !== JSON.stringify(s.population.ids)) compared += 1
      assert.deepEqual(cohortOf(other), cohortOf(s), `${name} ${s.id}: the cohort follows the policy`)
      const ringPlan = (x: Step): string[] => x.rings.map((ring) => `${ring.name}:${ring.targeting.memberCount}:${[...ring.targeting.suggestedMemberIds].sort().join(',')}`)
      assert.deepEqual(ringPlan(other), ringPlan(s), `${name} ${s.id}: and so does the ring plan`)
      assert.equal(other.comms, s.comms, `${name} ${s.id}: and who the announcement greets`)
      assert.deepEqual(stepPopulation(other), stepPopulation(s), `${name} ${s.id}: and every count a surface shows`)
    }
    assert.ok(compared > 2, `${name}: the goal population really moved under several open policies (${compared})`)
  }
})

test('an emergency account leaves a rollout because the policy excludes it, and never because a ring plan did', () => {
  // Every fixture, as generated. Two halves: the emergency accounts are in no
  // ring, and the reason is in the policy — each one is out of scope of every
  // operation the step will run. Nothing in rings.ts takes them out, so a policy
  // that stopped excluding them fails this rather than being quietly rewritten.
  for (const { f, r } of runs) {
    const evidence = membersOf(f)
    for (const bg of f.mapping.breakGlassUserIds) {
      for (const s of openPolicies(r.steps)) {
        const effects = stepEffects(s)
        if (effects.length === 0) continue
        const out = effects.every((e) => accountApplicability(e.scope, bg, f.snapshot as never, evidence) === 'out')
        assert.equal(out, true, `${f.name} ${s.id}: every policy the plan proposes excludes the emergency account`)
        assert.equal((cohortOf(s) ?? []).includes(bg), false, `${f.name} ${s.id}: so it is in no cohort`)
        assert.equal(s.rings.some((x) => x.targeting.suggestedMemberIds.includes(bg)), false, `${f.name} ${s.id}: and in no ring`)
      }
    }
  }
})

test('a ring plan does not remove an account the policy keeps: the safety boundary holds that', () => {
  // A policy that names all users and excludes nobody, with an emergency account
  // in the tenant. The rollout includes it, because the policy does. What must
  // not happen is a ring plan silently taking it out and leaving the plan
  // claiming a rollout the policy does not describe.
  const body = {
    displayName: 'p',
    state: 'enabledForReportingButNotEnforced',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const snapshot = { users: [{ id: 'u1', userType: 'member' }, { id: 'bg', userType: 'member' }], roles: { active: {} }, devices: [], registrationDetails: [], sources: {}, config: {} }
  const step = {
    id: 's-open',
    goalId: 'mfa-all-users',
    kind: 'create',
    status: 'ready',
    readiness: { family: 'mfa', percent: 100, lines: [] },
    population: { total: 2, active: 2, admins: 0, guests: 0, ids: ['u1', 'bg'], activeIds: ['u1', 'bg'], inScope: 2 },
    cohort: { total: 2, active: 2, admins: 0, guests: 0, ids: ['u1', 'bg'], activeIds: ['u1', 'bg'], inScope: 2 },
    rings: [],
    action: { kind: 'create', summary: [], json: null, portalSteps: [], resolution: { policies: [{ mode: 'create', sourceName: 'p', body }], tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null } } },
  } as unknown as Step
  const ringCtx = { snapshot, viability: new Map(), highCareIds: new Set<string>(), operatorId: null, naming: { style: 'none' }, activeUsers: 2, departmentOf: new Map(), deviceReady: new Set<string>() }
  const rings = proposeRings(step, ringCtx as never)
  assert.deepEqual(rings.flatMap((x) => x.targeting.suggestedMemberIds).sort(), ['bg', 'u1'], 'the account the policy keeps is in the rollout')
  // And the safety boundary is what has something to say about it: the policy
  // reaches the account, and would strand it where it cannot meet the demand.
  assert.equal(stepApplicability(step, 'bg', snapshot as never), 'in')
  assert.equal(wouldStrand(step, 'bg', snapshot as never, { breakGlass: true }).stranded, true, 'and it is stranded by a policy that asks it for a method it has not got')
  // The same policy with the account excluded: out of the rollout, by the policy.
  const excluded = structuredClone(step)
  const b = excluded.action.resolution!.policies[0].body as { conditions: { users: Record<string, unknown> } }
  b.conditions.users.excludeUsers = ['bg']
  const cohort = scopeCohort(stepEffects(excluded), ['u1', 'bg'], snapshot as never)
  assert.deepEqual(cohort, ['u1'], 'the policy answers, not the ring code')
  excluded.cohort = { total: 1, active: 1, admins: 0, guests: 0, ids: ['u1'], activeIds: ['u1'], inScope: 1 }
  assert.deepEqual(proposeRings(excluded, ringCtx as never).flatMap((x) => x.targeting.suggestedMemberIds), ['u1'])
})

test('a policy the plan cannot resolve a scope for proposes no rollout at all', () => {
  // A readable policy naming a group nothing says who is in. Everything about it
  // decodes — it asks for MFA, it names one group — so `analysisUnknown` is false
  // and only the cohort stands between the goal's people and a ring plan.
  const body = {
    displayName: 'p',
    state: 'enabledForReportingButNotEnforced',
    conditions: { users: { includeGroups: ['00000000-0000-4000-8000-0000000000aa'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const effect = effectOf(body)
  assert.deepEqual(effect.unknown, [], 'the policy itself is read in full')
  const snapshot = { users: [{ id: 'u1', userType: 'member' }], roles: { active: {} }, devices: [] }
  assert.equal(scopeCohort([effect], ['u1'], snapshot as never), null, 'but who it reaches is nobody’s answer')
  // With the membership read it is an exact cohort again: unknown is a gap in the
  // evidence, not a verdict about the policy.
  assert.deepEqual(scopeCohort([effect], ['u1'], snapshot as never, { groupMembers: { '00000000-0000-4000-8000-0000000000aa': ['u1'] } }), ['u1'])

  const step = {
    id: 's-unresolved',
    goalId: 'mfa-all-users',
    kind: 'create',
    status: 'ready',
    readiness: { family: 'mfa', percent: 100, lines: [] },
    population: { total: 2, active: 2, admins: 0, guests: 0, ids: ['u1', 'u2'], activeIds: ['u1', 'u2'], inScope: 2 },
    rings: [],
    action: { kind: 'create', summary: [], json: null, portalSteps: [], resolution: { policies: [{ mode: 'create', sourceName: 'p', body }], tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null } } },
  } as unknown as Step
  assert.equal(rolloutCohort(step), null, 'the step has no cohort')
  assert.equal(reached(step), null, 'and no population a surface may show')
  assert.equal(stepPopulation(step), null, 'so no count is claimed')
  const ringCtx = { snapshot, viability: new Map(), highCareIds: new Set<string>(), operatorId: null, naming: { style: 'none' }, activeUsers: 2, departmentOf: new Map(), deviceReady: new Set<string>() }
  assert.deepEqual(proposeRings(step, ringCtx as never), [], 'and no ring names people nobody has established are in scope')
  // The goal's population is right there, and none of it came from there.
  assert.equal(step.population.ids.length, 2)
})

// ---- 2: exact, or explicitly unknown ----

test('the pinned baseline puts nothing on the wire that IAMAI recognises and then ignores', () => {
  // Every policy the baseline holds, read as it stands. A leaf the decoder does
  // not consume becomes an unknown naming itself, so this fails the moment the
  // baseline is repinned onto a field nobody decided about — and names the field.
  const ignored: string[] = []
  for (const p of PINNED.policies as Record<string, unknown>[]) {
    for (const why of effectOf(p).unknown) if (RECOGNISED_BUT_IGNORED.test(why)) ignored.push(`${String(p.displayName)}: ${why}`)
  }
  assert.deepEqual(ignored, [], 'every field the pinned baseline carries has a reading or is held by name')
})

test('every operation a plan generates is valid, and its final target is read exactly or held by name', () => {
  const bad: string[] = []
  for (const { f, r } of runs) {
    for (const s of openPolicies(r.steps)) {
      // A step the plan cannot write offers no operation at all, and says why.
      if (unavailableReason(s) !== null) {
        assert.deepEqual(operationsOf(s), [], `${f.name} ${s.id}: unavailable work offers no operation`)
        continue
      }
      for (const op of operationsOf(s)) assert.ok(isValidOperation(op), `${f.name} ${s.id}: ${op.sourceName} is a request IAMAI would submit`)
      for (const e of stepEffects(s)) for (const why of e.unknown) if (RECOGNISED_BUT_IGNORED.test(why)) bad.push(`${f.name} ${s.id}: ${why}`)
    }
  }
  assert.deepEqual(bad, [], 'no generated final target carries a field the decoder recognises and ignores')
})

test('a field nothing consumes is held by name rather than read as absent', () => {
  // A part of a condition nobody has thought about yet: the clause it sits in is
  // not a clause IAMAI can read, so who this policy reaches is nobody's answer
  // rather than "everyone, as written".
  const body = {
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'], somethingNew: ['x'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const e = effectOf(body)
  assert.ok(e.unknown.some((u) => u === 'a condition IAMAI cannot read as written: users'), e.unknown.join(' | '))
  assert.equal(e.scope.unreadable, true, 'and the scope says so')
  assert.equal(accountApplicability(e.scope, 'u1', { users: [{ id: 'u1', userType: 'member' }] }), 'unknown', 'so it reaches nobody knowably')
  // A section whose whole shape is unknown to the decoder is held by name too.
  const foreign = effectOf({ ...body, conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, insiderRiskLevels: ['elevated'] } })
  assert.ok(foreign.unknown.some((u) => u === 'a condition IAMAI has no reading for: insiderRiskLevels'), foreign.unknown.join(' | '))
  // A tenant's own policy comes back with the conditions it does not set written
  // null. A field carrying nothing has nothing to read, and holding it would
  // make an update to an ordinary tenant policy unreadable.
  const asGraphReturnsIt = effectOf({
    ...body,
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, platforms: null, locations: null, devices: null, clientAppTypes: ['all'] },
    sessionControls: null,
  })
  assert.deepEqual(asGraphReturnsIt.unknown, [], 'a policy that sets nothing extra is read in full')
})

// ---- 1: the operation is the only authority ----

/**
 * Everything that must not decide what an OPEN policy does, changed on a step
 * whose operations are left exactly as they were. The goal it is filed under,
 * the readiness family and its percentage, the people the step lists, the
 * evidence collected under the goal, the serialised body beside the operations,
 * and the author's own metadata are all here. If any real output moves, a
 * consumer is reading one of them.
 */
function perturbations(step: Step): { why: string; step: Step; words?: true }[] {
  const strangers = ['00000000-0000-4000-8000-00000000dead', '00000000-0000-4000-8000-00000000beef']
  const out: { why: string; step: Step; words?: true }[] = []
  for (const family of FAMILIES) if (family !== step.readiness.family) out.push({ why: `family ${family}`, step: { ...step, readiness: { ...step.readiness, family } } })
  // The readiness percentage is shown on the step as the readiness measure — "26%,
  // the plan waits for 80%" — which is a fact about people, not a reading of the
  // policy. It is compared against every consequence below and left out of the
  // words.
  out.push({ why: 'readiness 0%', words: true, step: { ...step, readiness: { ...step.readiness, percent: 0 } } })
  out.push({ why: 'readiness 100%', words: true, step: { ...step, readiness: { ...step.readiness, percent: 100 } } })
  // The people the step lists. There is no exemption for the rollout: which
  // accounts a policy's rollout is for is the policy's own user scope
  // (roadmap/strand.ts scopeCohort, carried on the step as `cohort`), so the ring
  // plan, the ring members, the who-line and the audience are all compared under
  // these two like everything else. A goal population that is an upper bound on
  // the rollout is the whole defect this pair exists to catch.
  out.push({ why: 'a foreign population', step: { ...step, population: { ...step.population, ids: strangers, activeIds: strangers, active: strangers.length, total: strangers.length } } })
  out.push({ why: 'an empty population', step: { ...step, population: { ...step.population, ids: [], activeIds: [], active: 0, total: 0 } } })
  out.push({ why: 'evidence naming strangers', step: { ...step, evidence: { status: 'ok', lines: [], affectedUserIds: strangers } } })
  out.push({ why: 'evidence naming nobody', step: { ...step, evidence: { status: 'ok', lines: [], affectedUserIds: [] } } })
  out.push({ why: 'no evidence at all', step: { ...step, evidence: { status: 'none', lines: [], affectedUserIds: [] } } })
  // The serialised body the plan file carries, and the author's own metadata
  // beside the operation: neither is what the request submits.
  out.push({ why: 'a stale action.json', step: { ...step, action: { ...step.action, json: JSON.stringify({ displayName: 'something else', state: 'disabled' }) } } })
  out.push({
    why: 'stale author strength metadata on the operation',
    // The baseline's version is shown beside the person's choice on purpose, so
    // this one is a reading of the *words* by design; what it must never do is
    // move a consequence.
    words: true,
    step: {
      ...step,
      action: {
        ...step.action,
        resolution: step.action.resolution
          ? {
              ...step.action.resolution,
              policies: step.action.resolution.policies.map((op) => ({ ...op, baseline: { grantControls: { authenticationStrength: { displayName: 'The author’s own name', allowedCombinations: ['password'] } } } })),
            }
          : step.action.resolution,
      },
    },
  })
  return out
}

/** Every conclusion an open policy owns, as one comparable string. */
function readingOf(step: Step, f: Fixture, r: FixtureRun, others: Step[]): string {
  const anyone = r.viability[0]?.userId ?? 'nobody'
  const plan = others.map((x) => (x.id === step.id ? step : x))
  const graph = dependencyGraph(plan)
  const schedule = buildSchedule(plan, r.schedule.start, r.viability.length)
  const ringCtx = { snapshot: f.snapshot, viability: new Map(r.viability.map((v) => [v.userId, v])), highCareIds: new Set<string>(), operatorId: f.operatorId, naming: r.coverage.organisation.naming, activeUsers: r.viability.length, ...ringContextIndexes(f.snapshot) }
  return JSON.stringify([
    // Applicability, operator safety and strand.
    stepApplicability(step, anyone, f.snapshot),
    stepAccountVerdict(step, anyone, f.snapshot),
    wouldStrand(step, anyone, f.snapshot, { breakGlass: true }),
    canDenyAccess(step),
    promptsPeople(step),
    // Impact, lockout, zero impact.
    nobodyAffected(step),
    lockoutCount(stepEffects(step), r.viability, f.snapshot, strengthLookupOf(f.snapshot)),
    // Dependencies, batching, notice, observation, soak, placement.
    (graph[step.id] ?? []).map((d) => `${d.kind}:${d.reason}:${d.stepId}`).sort(),
    batchClassOf(step),
    noticeDaysFor(step),
    observationDaysFor(step),
    schedule.waveOf[step.id] ?? null,
    schedule.waves.find((w) => w.stepIds.includes(step.id))?.start ?? null,
    eventsFor(step, { rhythm: r.schedule.rhythm, timeZone: 'UTC' } as never, schedule.start),
    // Rings: the plan, the counts and the members by name.
    proposeRings(step, ringCtx as never).map((x) => `${x.name}:${x.targeting.memberCount}:${x.soakDays}:${[...x.targeting.suggestedMemberIds].sort().join(',')}`),
    // The rollout cohort itself, and the people the surfaces name for the step.
    rolloutCohort(step)?.slice().sort() ?? null,
    stepPopulation(step),
    // Implementation and export gating.
    unavailableReason(step),
    implementationOffered(step),
    operationsOf(step).length,
  ])
}

test('nothing but the operation decides what an open policy does', () => {
  // The whole set of forbidden sources, against the whole set of real outputs:
  // the dependency graph, the schedule the plan is actually placed by, the ring
  // plan, the timing, the lockout and the export gating.
  const failures: string[] = []
  for (const { f, r } of runs) {
    for (const s of openPolicies(r.steps)) {
      assert.equal(familyReading(s), null, `${f.name} ${s.id}: the family answers for no open policy`)
      for (const { why, step } of perturbations(s)) {
        const asGenerated = readingOf(s, f, r, r.steps)
        const moved = readingOf(step, f, r, r.steps)
        if (moved !== asGenerated) failures.push(`${f.name} ${s.id}: ${why} moved the reading\n  was ${asGenerated}\n  now ${moved}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('nothing but the operation decides what an open policy tells people or offers them', () => {
  // The words and the channels, over the same forbidden sources. The goal id is
  // not among them here: it selects which content a step renders, which is a
  // label rather than a reading of the policy.
  const failures: string[] = []
  for (const { f, r } of runs) {
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names?.label(id) ?? id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming } as never
    // The step's Who line counts the people this rollout is for, and for an open
    // policy those are the people its own policy names: it is compared under
    // every perturbation, this one included.
    const wordsOf = (step: Step): string => {
      const ex = stepVars(step, ctx) as Record<string, unknown>
      return JSON.stringify([stepPortalLines(step, portalNamesFor(ctx, ex, step.title)), stepLines(step, ctx), rowWho(step, (id) => (ctx as { nameOf: (x: string) => string }).nameOf(id)), ex.active ?? null, ex.n ?? null, ex.admins ?? null, ex.guests ?? null, ex.strengthName ?? null, ex.wanted ?? null, ex.wantedLong ?? null, step.comms])
    }
    // One family value is enough to catch a family read here; the sweep above
    // walks all eight against every consequence. The words are the expensive
    // half — a whole content render per step — so they are not walked twice.
    for (const s of openPolicies(r.steps)) {
      let seenFamily = false
      for (const { why, step, words } of perturbations(s)) {
        if (words === true) continue
        if (why.startsWith('family ')) {
          if (seenFamily) continue
          seenFamily = true
        }
        const asGenerated = wordsOf(s)
        const moved = wordsOf(step)
        if (moved !== asGenerated) failures.push(`${f.name} ${s.id}: ${why} moved the words\n  was ${asGenerated.slice(0, 400)}\n  now ${moved.slice(0, 400)}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('the goal a step is filed under decides none of its consequences either', () => {
  // Separated from the sweep above because a goal id also selects a step's
  // content, its title and its named prerequisites — labels, not readings. Only
  // the consequences are compared.
  const failures: string[] = []
  for (const { f, r } of runs) {
    for (const s of openPolicies(r.steps)) {
      // A goal whose own baseline contradicts itself is unavailable *because* of
      // the goal, which is a decision about the baseline rather than the policy.
      if (hasBaselineConflict(s.goalId)) continue
      const anyone = r.viability[0]?.userId ?? 'nobody'
      const consequences = (step: Step): string =>
        JSON.stringify([
          stepApplicability(step, anyone, f.snapshot),
          stepAccountVerdict(step, anyone, f.snapshot),
          canDenyAccess(step),
          promptsPeople(step),
          nobodyAffected(step),
          batchClassOf(step),
          noticeDaysFor(step),
          observationDaysFor(step),
          lockoutCount(stepEffects(step), r.viability, f.snapshot, strengthLookupOf(f.snapshot)),
          unavailableReason(step),
        ])
      const asGenerated = consequences(s)
      for (const goalId of ['mfa-all-users', 'block-legacy-auth', 'geo-restriction', 'admins-phishing-resistant', 'a-goal-nobody-has-heard-of']) {
        if (hasBaselineConflict(goalId)) continue
        const moved = consequences({ ...s, goalId })
        if (moved !== asGenerated) failures.push(`${f.name} ${s.id}: filing it under ${goalId} moved the reading\n  was ${asGenerated}\n  now ${moved}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

// ---- 3: unknown stays conservative ----

test('an open policy IAMAI cannot read in full is not safe, not zero, and earns no shortened timing', () => {
  // One unreadable field on an otherwise ordinary policy, through every
  // consequence at once.
  const { f, r } = runs.find(({ r: run }) => openPolicies(run.steps).length > 0)!
  const s = openPolicies(r.steps).find((x) => unavailableReason(x) === null && stepEffects(x).length > 0)!
  const held = {
    ...s,
    action: {
      ...s.action,
      resolution: {
        ...s.action.resolution!,
        policies: operationsOf(s).map((op) => ({
          ...op,
          mode: 'create' as const,
          policyId: null,
          target: undefined,
          body: { ...op.body, sessionControls: { ...((op.body.sessionControls ?? {}) as Record<string, unknown>), cloudAppSecurity: { isEnabled: true, cloudAppSecurityType: 'blockDownloads' } } },
        })),
      },
    },
  } as unknown as Step
  const effects = effectsOf(held)!
  assert.ok(effects.every((e) => e.unknown.length > 0), 'the policy is held unknown')
  assert.equal(nobodyAffected(held), false, 'a policy that might touch anyone is not a zero')
  assert.equal(noticeDaysFor(held), 5, 'no courtesy notice on an unread policy')
  assert.notEqual(batchClassOf(held), 'zero', 'no zero batch class')
  assert.equal(observationDaysFor(held), OBSERVATION_DAYS, 'and the full watch, never the short one')
  assert.equal(lockoutCount(effects, r.viability, f.snapshot, strengthLookupOf(f.snapshot)), null, 'no numeric lockout claim')
  const verdict = stepAccountVerdict(held, r.viability[0]?.userId ?? 'nobody', f.snapshot)
  assert.ok(!verdict.stranded || verdict.unknown, 'and no confident verdict about a person')
})

test('work the plan cannot write is scheduled nowhere and proves nothing', () => {
  for (const { f, r } of runs) {
    const schedule = buildSchedule(r.steps, r.schedule.start, r.viability.length)
    const dated = new Set(schedule.waves.flatMap((w) => w.stepIds))
    for (const s of openPolicies(r.steps)) {
      if (unavailableReason(s) === null) continue
      assert.ok(!dated.has(s.id), `${f.name} ${s.id}: unavailable work takes no dated wave`)
      assert.equal(nobodyAffected(s), false, `${f.name} ${s.id}: unavailable work is not a zero`)
      assert.equal(s.rings.length, 0, `${f.name} ${s.id}: and no rings`)
      assert.equal(s.lockout, undefined, `${f.name} ${s.id}: and no lockout number`)
    }
  }
})

// ---- the values, one at a time ----

/** A scan holding exactly the evidence each case is about. */
const scan = (over: Record<string, unknown> = {}): never =>
  ({
    registrationDetails: [],
    sources: { registrationDetails: { status: 'ok' }, devices: { status: 'ok' }, signInEvidence: { status: 'ok' } },
    devices: [],
    users: [],
    signInEvidence: {},
    roles: { active: {}, eligible: {} },
    config: { authStrengths: { status: 'ok', reason: null, rows: [] } },
    evidenceUsage: { legacyAuth: { userIds: [] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] }, riskHigh: { userIds: [] }, riskMedium: { userIds: [] } },
    ...over,
  }) as never

const scopeOnly = (users: Record<string, unknown>): Record<string, unknown> => ({
  displayName: 'p',
  state: 'enabled',
  conditions: { users, applications: { includeApplications: ['All'] } },
  grantControls: { operator: 'OR', builtInControls: ['mfa'] },
})

test('a guest clause is answered by the kinds it names and the tenants it means, or not at all', () => {
  const directory = scan({
    users: [
      { id: 'member', userType: 'member', userPrincipalName: 'a@contoso.com' },
      { id: 'b2bMember', userType: 'member', userPrincipalName: 'b_partner.com#EXT#@contoso.com' },
      { id: 'guest', userType: 'guest', userPrincipalName: 'c_partner.com#EXT#@contoso.com', externalUserState: 'Accepted' },
      { id: 'internalGuest', userType: 'guest', userPrincipalName: 'd@contoso.com' },
    ],
  })
  const reach = (users: Record<string, unknown>, id: string): string => accountApplicability(effectOf(scopeOnly(users)).scope, id, directory)
  const EVERY_KIND = 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider'
  const clause = (types: string, membershipKind = 'all', members?: string[]): Record<string, unknown> => ({
    guestOrExternalUserTypes: types,
    externalTenants: { membershipKind, ...(members ? { members } : {}) },
  })

  // Every kind, from every tenant: the directory settles it for everybody.
  const all = { includeUsers: ['All'], excludeGuestsOrExternalUsers: clause(EVERY_KIND) }
  assert.equal(reach(all, 'member'), 'in', 'an ordinary member is not an external user of any kind')
  assert.equal(reach(all, 'guest'), 'out')
  assert.equal(reach(all, 'internalGuest'), 'out')
  assert.equal(reach(all, 'b2bMember'), 'out')

  // Some kinds only: which kind of external user a guest is, the directory does
  // not say, so the exclusion cannot be applied to one.
  const some = { includeUsers: ['All'], excludeGuestsOrExternalUsers: clause('b2bCollaborationGuest,otherExternalUser') }
  assert.equal(reach(some, 'guest'), 'unknown', 'a guest may or may not be one of the two kinds named')
  assert.equal(reach(some, 'internalGuest'), 'in', 'an internal guest is neither of them')
  assert.equal(reach(some, 'member'), 'in')

  // A clause naming its tenants one by one: no row says which tenant somebody
  // came from, so nobody it could reach is settled.
  const named = { includeUsers: ['All'], excludeGuestsOrExternalUsers: clause(EVERY_KIND, 'enumerated', ['t-1']) }
  assert.equal(reach(named, 'guest'), 'unknown')
  assert.equal(reach(named, 'b2bMember'), 'unknown')
  assert.equal(reach(named, 'member'), 'in', 'but an ordinary member is not reached by any of the kinds, whichever tenants it means')

  // The same on the include side: a clause that reaches some kinds of guest does
  // not settle that it reaches this one.
  const includeSome = { includeGuestsOrExternalUsers: clause('serviceProvider') }
  assert.equal(reach(includeSome, 'guest'), 'unknown')
  assert.equal(reach(includeSome, 'member'), 'out', 'and it reaches no member at all')
})

test('a risk condition is answered only where the records measure every level it acts on', () => {
  const seen = scan({ evidenceUsage: { legacyAuth: { userIds: [] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] }, riskHigh: { userIds: ['u1'] }, riskMedium: { userIds: [] } } })
  const quiet = scan()
  const risky = (levels: string[], key = 'signInRiskLevels'): Record<string, unknown> => ({
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, [key]: levels },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  })
  const reach = (levels: string[], snapshot: never, key?: string): string => operationReach(effectOf(risky(levels, key)), 'u1', snapshot).answer
  assert.equal(reach(['high'], seen), 'in', 'the records show a high-risk sign-in')
  assert.equal(reach(['high'], quiet), 'out', 'and show none')
  assert.equal(reach(['high', 'medium'], quiet), 'out', 'both levels are measured')
  // A level Identity Protection's records do not carry is not answered by the
  // ones they do: not being seen at high says nothing about low.
  assert.equal(reach(['high', 'low'], quiet), 'unknown')
  assert.equal(reach(['high', 'low'], seen), 'in', 'though being seen at a measured level still settles it')
  assert.equal(reach(['none'], quiet), 'unknown')
  assert.equal(reach(['unknownFutureValue'], quiet), 'unknown')
  // The risk carried by an account is a different question the records do not answer.
  assert.equal(reach(['high'], seen, 'userRiskLevels'), 'unknown')
  assert.equal(reach(['high'], quiet, 'userRiskLevels'), 'unknown')
})

test('what the records measured for one question is no answer to another', () => {
  // A step filed under a risk goal, carrying evidence collected for it, whose
  // policy actually blocks the old protocols. The zero has to come from the
  // legacy-authentication signal, and the risk evidence beside it proves nothing.
  const snapshot = scan({
    users: [{ id: 'u1', userType: 'member', userPrincipalName: 'a@contoso.com' }],
    evidenceUsage: { legacyAuth: { userIds: ['u1'] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] }, riskHigh: { userIds: [] }, riskMedium: { userIds: [] } },
  })
  const legacyBlock = {
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  }
  const effects = [effectOf(legacyBlock)]
  assert.deepEqual(measuredReach(effects, ['u1'], snapshot), ['u1'], 'the records show this account using what the policy blocks')
  const step = {
    id: 's-x',
    goalId: 'sign-in-risk',
    kind: 'create',
    status: 'ready',
    readiness: { family: 'risk', percent: 100, lines: [] },
    // Collected under the goal, and about a different question entirely.
    evidence: { status: 'ok', lines: [], affectedUserIds: [] },
    population: { total: 1, active: 1, admins: 0, guests: 0, ids: ['u1'], activeIds: ['u1'], inScope: 1 },
    rings: [],
    blockedBy: [],
    action: { kind: 'create', summary: [], json: '{}', portalSteps: [], missing: [], resolution: { policies: [{ sourceName: 'a', mode: 'create', policyId: null, body: legacyBlock }] } },
  } as unknown as Step
  assert.equal(nobodyAffected(step), false, 'an empty count filed under the goal is not this policy’s zero')
  assert.equal(nobodyAffected({ ...step, measured: { ids: ['u1'] } } as Step), false)
  assert.equal(nobodyAffected({ ...step, measured: { ids: [] } } as Step), true, 'only the measured answer says nobody')
})

test('an AND policy with one thing IAMAI cannot read offers no lockout number and no zero', () => {
  const snapshot = scan({
    users: [{ id: 'u1', userType: 'member', userPrincipalName: 'a@contoso.com' }],
    registrationDetails: [{ id: 'u1', isMfaCapable: false, methodsRegistered: [] }],
    config: { authStrengths: { status: 'ok', reason: null, rows: [{ id: 's', displayName: 'Keys only', allowedCombinations: ['fido2'] }] } },
  })
  const body = {
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } },
    // Both required: a strength this account cannot satisfy, and a control with
    // no reading at all.
    grantControls: { operator: 'AND', builtInControls: ['mfa'], authenticationStrength: { id: 's' }, customAuthenticationFactors: ['something-of-our-own'] },
    sessionControls: { cloudAppSecurity: { isEnabled: true, cloudAppSecurityType: 'blockDownloads' } },
  }
  const effect = effectOf(body)
  assert.equal(effect.operator, 'AND')
  assert.ok(effect.unknown.length >= 2, effect.unknown.join(' | '))
  const viability = [{ userId: 'u1', activity: 'active', methodTiers: [] }] as never
  assert.equal(lockoutCount([effect], viability, snapshot, strengthLookupOf(snapshot)), null, 'no number is offered while part of the policy is unread')
  assert.equal(measuredReach([effect], ['u1'], snapshot), null, 'and no zero either')
})

test('a policy IAMAI cannot read in full waits on everything, is watched in full, and has no ring plan', () => {
  // A step the plan *can* write, with one thing in it nobody could read. It is
  // still scheduled, so every conservative branch has to hold: a prerequisite
  // skipped because the reading came back thin is a prerequisite dropped on a
  // guess.
  const { f, r } = runs.find(({ r: run }) => run.steps.some((s) => isOpenPolicy(s) && unavailableReason(s) === null && stepEffects(s).length > 0))!
  const plain = r.steps.find((s) => isOpenPolicy(s) && unavailableReason(s) === null && stepEffects(s).length > 0)!
  const held = {
    ...plain,
    action: {
      ...plain.action,
      resolution: {
        ...plain.action.resolution!,
        policies: operationsOf(plain).map((op) => ({
          ...op,
          mode: 'create' as const,
          policyId: null,
          target: undefined,
          body: { ...op.body, sessionControls: { ...((op.body.sessionControls ?? {}) as Record<string, unknown>), cloudAppSecurity: { isEnabled: true, cloudAppSecurityType: 'blockDownloads' } } },
        })),
      },
    },
  } as unknown as Step
  assert.ok(stepEffects(held).some((e) => e.unknown.length > 0), 'the policy is held unknown')
  assert.equal(unavailableReason(held), null, 'but the plan can still write it')
  const plan = r.steps.map((s) => (s.id === held.id ? held : s))
  const reasons = new Set((dependencyGraph(plan)[held.id] ?? []).map((d) => d.reason))
  const ids = new Set(plan.map((s) => s.id))
  for (const [reason, id] of [
    ['break-glass', 's-prereq-break-glass'],
    ['registration', 's-verify-mfa'],
    ['named-location', 's-prereq-trusted-location'],
  ] as const) {
    if (!ids.has(id)) continue
    assert.ok(reasons.has(reason), `${f.name} ${held.id}: waits on ${reason} (${[...reasons].join(', ') || 'nothing'})`)
  }
  assert.equal(nobodyAffected(held), false, 'it is no zero')
  assert.notEqual(batchClassOf(held), 'zero')
  assert.equal(noticeDaysFor(held), 5, 'the full notice')
  assert.equal(observationDaysFor(held), OBSERVATION_DAYS, 'and the full watch')
  assert.deepEqual(
    proposeRings(held, { snapshot: f.snapshot, viability: new Map(), breakGlassIds: new Set(), highCareIds: new Set(), operatorId: null, naming: r.coverage.organisation.naming, activeUsers: 10, ...ringContextIndexes(f.snapshot) } as never),
    [],
    'and no ring plan for a policy nobody can read',
  )
  // Work the plan cannot write at all is not scheduled in the first place.
  const unavailable = openPolicies(r.steps).filter((s) => unavailableReason(s) !== null)
  const schedule = buildSchedule(r.steps, r.schedule.start, r.viability.length)
  for (const s of unavailable) assert.ok(!schedule.waves.some((w) => w.stepIds.includes(s.id)), `${f.name} ${s.id}: in no dated wave`)
})

test('an update that changes nothing is not an update, at any depth', () => {
  const target = {
    id: 'p-1',
    displayName: 'Core - Grant - MFA',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const op = (body: Record<string, unknown>): never => ({ sourceName: 'a', mode: 'update', policyId: 'p-1', body, target: { ...target, ...body } }) as never
  assert.equal(isSubmittablePatch({}), false)
  assert.equal(isSubmittablePatch({ conditions: {} }), false, 'an empty section submits nothing')
  assert.equal(isSubmittablePatch({ conditions: { users: {} } }), false, 'nor an empty clause inside one')
  assert.equal(isSubmittablePatch({ conditions: { users: {} }, sessionControls: {} }), false)
  assert.equal(isValidOperation(op({ conditions: {} })), false, 'so it is not an operation')
  assert.equal(isSubmittablePatch({ state: 'enabled' }), true)
  assert.equal(isSubmittablePatch({ sessionControls: null }), true, 'clearing a section is a change')
  assert.equal(isValidOperation(op({ state: 'enabled' })), true)
})

test('a malformed value on the tenant’s own policy is held, not read as written', () => {
  // An update's target is the tenant's policy, which IAMAI does not get to
  // refuse — but it does not get to misread it either.
  const bad = (conditions: Record<string, unknown>, over: Record<string, unknown> = {}): ReturnType<typeof effectOf> =>
    effectOf({ displayName: 'p', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, ...conditions }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, ...over })
  assert.ok(bad({ clientAppTypes: ['nonsense'] }).unknown.some((u) => /cannot read as written: clientAppTypes/.test(u)))
  assert.ok(bad({ signInRiskLevels: ['catastrophic'] }).unknown.some((u) => /cannot read as written: signInRiskLevels/.test(u)))
  assert.ok(bad({ devices: { deviceFilter: { mode: 'include' } } }).unknown.some((u) => /cannot read as written: devices/.test(u)))
  assert.ok(bad({ platforms: { includePlatforms: ['toaster'] } }).unknown.some((u) => /cannot read as written: platforms/.test(u)))
  // A grant with no operator is not read as either, and a session control whose
  // value Graph would refuse is not read as switched on.
  const noOperator = effectOf({ displayName: 'p', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { builtInControls: ['mfa', 'compliantDevice'] } })
  assert.ok(noOperator.unknown.some((u) => /does not say how its controls combine/.test(u)))
  const badSession = bad({}, { sessionControls: { signInFrequency: { isEnabled: true } } })
  assert.ok(badSession.unknown.some((u) => /cannot read as written: signInFrequency/.test(u)))
  assert.equal(badSession.sessionControls?.signInFrequency, false, 'and it is not read as a setting')
  // A clause IAMAI cannot read means who the policy reaches is nobody's answer.
  const unreadableScope = bad({ users: { includeUsers: ['All'], somethingNew: [] } as never })
  assert.equal(unreadableScope.scope.unreadable, true)
})

test('the pinned baseline, after this tenant’s mapping, is read exactly or held by name', () => {
  // The raw policies are swept above; this is what the generator actually
  // submits once the tenant's own objects have been resolved into them. Every
  // unknown it produces is one of a named few, so a repin that makes the plan
  // stop understanding its own request shows up here.
  const known = [
    /^a condition IAMAI has no reading for: /,
    /^a condition IAMAI carries but cannot read: /,
    /^a condition IAMAI cannot read as written: /,
    /^a session control IAMAI has no reading for: /,
    /^a session control IAMAI carries but cannot read: /,
    /^a session control IAMAI cannot read as written: /,
    /^a grant control IAMAI has no reading for: /,
    /^a grant setting IAMAI has no reading for: /,
    /^a grant control list IAMAI cannot read as written$/,
    /^a grant that does not say how its controls combine$/,
    /^an authentication strength /,
    /^a custom authentication factor$/,
    /^terms of use$/,
  ]
  const surprises: string[] = []
  let swept = 0
  for (const { f, r } of runs) {
    for (const s of openPolicies(r.steps)) {
      for (const op of operationsOf(s)) {
        swept += 1
        assert.ok(isValidOperation(op), `${f.name} ${s.id}: ${op.sourceName} is a request IAMAI would submit`)
      }
      for (const e of stepEffects(s)) {
        for (const why of e.unknown) if (!known.some((k) => k.test(why))) surprises.push(`${f.name} ${s.id}: ${why}`)
      }
    }
  }
  assert.ok(swept > 40, `the fixtures generate operations from the pinned baseline: ${swept}`)
  assert.deepEqual(surprises, [], 'every unknown the pinned baseline produces is one this build knows about')
})

// ---- the boundary, in the source ----

test('nothing new reads the goal family or the floor for a policy consequence', () => {
  // A grep, pinned. `readiness.family` and `impl.floor` are legitimate in a few
  // named places — the readiness threshold and its words, announcement and
  // manager wording, and `strand.ts familyReading`, the one door an open policy
  // cannot come through. Anywhere else, or any new line in these files, is a
  // second authority for what a policy does, and the invariance sweeps above
  // will not always be run against it first. Move the reading behind
  // `familyReading`/`effectsOf`, or add the file here with its reason.
  const allowed: Record<string, { family: number; floor: number; why: string }> = {
    'src/roadmap/strand.ts': { family: 1, floor: 0, why: 'familyReading: the one door the family may answer through, and it refuses for an open policy' },
    'src/roadmap/generate.ts': { family: 23, floor: 4, why: 'the readiness threshold and its blocker, the announcement audience and the manager note — and two fallbacks that sit inside an isOpenPolicy branch' },
    'src/roadmap/stateReason.ts': { family: 2, floor: 0, why: 'the words for a readiness blocker' },
    'src/roadmap/scenarioLines.ts': { family: 1, floor: 0, why: 'which lockout-scenario lines a step shows' },
    'src/derive/finish.ts': { family: 2, floor: 0, why: 'which readiness measure a waiting step is counted under' },
    'src/coverage/classify.ts': { family: 0, floor: 1, why: 'the baseline floor a tenant policy is compared against' },
    'src/coverage/coverage.ts': { family: 0, floor: 1, why: 'the same comparison' },
    'src/coverage/goalIdentity.ts': { family: 0, floor: 2, why: 'which goal a baseline policy implements' },
    'src/coverage/naming.ts': { family: 0, floor: 2, why: 'the proposed policy name' },
    'src/scoring/priority.ts': { family: 0, floor: 1, why: 'the order goals are worked in' },
  }
  const counted: Record<string, { family: number; floor: number }> = {}
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.') || full.includes('/fixtures/')) continue
      for (const line of readFileSync(full, 'utf8').split('\n')) {
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
        const family = (code.match(/readiness\??\.family/g) ?? []).length
        const floor = (code.match(/impl\??\.floor/g) ?? []).length
        if (family + floor === 0) continue
        const seen = (counted[full] ??= { family: 0, floor: 0 })
        seen.family += family
        seen.floor += floor
      }
    }
  }
  walk('src')
  const wrong: string[] = []
  for (const [file, seen] of Object.entries(counted)) {
    const ok = allowed[file]
    if (!ok) wrong.push(`${file}: reads the goal family (${seen.family}) or the floor (${seen.floor}) and is not on the list`)
    else if (ok.family !== seen.family || ok.floor !== seen.floor) wrong.push(`${file}: now family ${seen.family} / floor ${seen.floor}, was family ${ok.family} / floor ${ok.floor} (${ok.why})`)
  }
  for (const file of Object.keys(allowed)) if (!counted[file]) wrong.push(`${file}: no longer reads either; remove it from the list`)
  assert.deepEqual(wrong, [])
})
