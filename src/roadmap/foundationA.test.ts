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
import { effectOf, isOpenPolicy, isValidOperation, operationsOf, stepEffects, strengthLookupOf, unavailableReason } from './operations.ts'
import { canDenyAccess, effectsOf, familyReading, promptsPeople, stepAccountVerdict, stepApplicability } from './strand.ts'
import { batchClassOf, buildSchedule, observationDaysFor } from './schedule.ts'
import { nobodyAffected, noticeDaysFor } from './timing.ts'
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
  // The pass exists for the field nobody has thought about yet: this is one.
  const body = {
    displayName: 'p',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'], somethingNew: ['x'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const e = effectOf(body)
  assert.ok(e.unknown.some((u) => u === 'a field IAMAI recognised but did not read: conditions.users.somethingNew'), e.unknown.join(' | '))
})

// ---- 1: the operation is the only authority ----

test('the goal family decides nothing about an open policy', () => {
  // Every conclusion Foundation A names, computed on the step as generated and
  // again with its family rewritten to each of the others. A consumer that reads
  // the family for an open policy moves one of these.
  const failures: string[] = []
  for (const { f, r } of runs) {
    for (const s of openPolicies(r.steps)) {
      assert.equal(familyReading(s), null, `${f.name} ${s.id}: the family answers for no open policy`)
      const anyone = r.viability[0]?.userId ?? 'nobody'
      const readingOf = (step: Step): string =>
        JSON.stringify([
          canDenyAccess(step),
          promptsPeople(step),
          nobodyAffected(step),
          noticeDaysFor(step),
          batchClassOf(step),
          observationDaysFor(step),
          unavailableReason(step),
          stepApplicability(step, anyone, f.snapshot),
          stepAccountVerdict(step, anyone, f.snapshot),
          lockoutCount(stepEffects(step), r.viability, f.snapshot, strengthLookupOf(f.snapshot)),
        ])
      const asGenerated = readingOf(s)
      for (const family of FAMILIES) {
        const moved = readingOf({ ...s, readiness: { ...s.readiness, family } } as Step)
        if (moved !== asGenerated) failures.push(`${f.name} ${s.id}: family ${family} moved the reading\n  was ${asGenerated}\n  now ${moved}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('the people a step lists decide nothing about who an open policy reaches or strands', () => {
  // The step's population is a rollout list, not the policy's scope. It may
  // still bound a proof — a zero is only claimed where the policy reaches
  // nobody the list does not hold (operations.ts scopeBoundedBy) — so this
  // sweeps the questions about *reach and strand*, which are the policy's alone.
  const failures: string[] = []
  const strangers = ['00000000-0000-4000-8000-00000000dead', '00000000-0000-4000-8000-00000000beef']
  for (const { f, r } of runs) {
    for (const s of openPolicies(r.steps)) {
      const anyone = r.viability[0]?.userId ?? 'nobody'
      const readingOf = (step: Step): string =>
        JSON.stringify([
          stepApplicability(step, anyone, f.snapshot),
          stepAccountVerdict(step, anyone, f.snapshot),
          canDenyAccess(step),
          promptsPeople(step),
          lockoutCount(stepEffects(step), r.viability, f.snapshot, strengthLookupOf(f.snapshot)),
        ])
      const asGenerated = readingOf(s)
      const moved = readingOf({ ...s, population: { ...s.population, ids: strangers, activeIds: strangers } } as Step)
      if (moved !== asGenerated) failures.push(`${f.name} ${s.id}: the step's list moved the policy's reading\n  was ${asGenerated}\n  now ${moved}`)
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
    const schedule = buildSchedule(r.steps, r.schedule.start, { rhythm: r.schedule.rhythm, timeZone: 'UTC' } as never)
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
