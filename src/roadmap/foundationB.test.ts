// Foundation B's boundary: lifecycle, condition, observation.
//
// Four things have to stay true, and each is asserted structurally rather than
// by example, so the whole class cannot come back one step at a time:
//
//  1. one authority. `Step.state` decides; `Step.status` is its projection and
//     `projectStatus` is the only thing that writes it. A pinned grep keeps it
//     that way, and the projection is checked against every step of every
//     fixture, so a generator that starts naming a status the state does not
//     justify fails without anybody having to notice the new line;
//  2. the two axes are separate. The lifecycle belongs to a Conditional Access
//     policy and has four stages; the condition is how the step is doing and
//     moves independently. Review required is a condition, never a stage, and
//     never a gate. A step that deploys no policy has no lifecycle at all;
//  3. no invented history. Every date the tracking claims is either the tenant's
//     own record of the object, a sign-in that proves the policy was evaluated,
//     or IAMAI's own first sighting — and it says which;
//  4. observation survives what does not matter and stops at what does. A
//     rename is not a change and keeps the window a policy has earned; a
//     rewrite invalidates the observation and starts the window again, however
//     clean the records look.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { allFixtures, curatedFixture } from './fixtures/index.ts'
import { isHeld } from './holds.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { cleanReportOnly } from './fixtures/records.ts'
import { applyProgress, mergePersisted, savedStepOf } from './progress.ts'
import type { SavedStep } from './progress.ts'
import { generateRoadmap } from './generate.ts'
import { stepIdForGoal } from './generate.ts'
import { conditionFor, initialState, nextMilestone, projectStatus, raiseCondition, setState, stateForStatus } from './lifecycle.ts'
import type { Condition, Lifecycle, StepState } from './lifecycle.ts'
import { artifactIdOf, intentOf, memberKeyOf, observationsFrom, observe, observedStateOf, priorFor, semanticFieldsOf, semanticsOf } from './observation.ts'
import type { StepObservation, StepObservationRecord } from './observation.ts'
import { SOLE_MEMBER, matchMembers, observationsOf, requiredMembers } from './tracking.ts'
import { statusOf } from '../ui/surfaces/statusWord.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { inBaselineConflict } from './baselineConflict.ts'
import { activePeopleIds } from '../derive/population.ts'
import { notPeopleIds } from '../derive/sets.ts'
import type { PolicyOperation } from './types.ts'
import type { Step, StepStatus } from './types.ts'
import { scheduleOf } from './stepSchedule.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'

const fixtures = allFixtures()
/** Every fixture's plan, derived once through the wiring the Plan page uses. */
const runs = fixtures.map((f) => ({ f, r: runFixture(f) }))
const everyStep = (): { name: string; s: Step }[] => runs.flatMap(({ f, r }) => r.steps.map((s) => ({ name: f.name, s })))

const LIFECYCLES: (Lifecycle | null)[] = [null, 'not-deployed', 'report-only', 'ready-to-enforce', 'enforced']
const CONDITIONS: Condition[] = ['healthy', 'review-required', 'blocked', 'needs-decision', 'baseline-conflict']
const STAGE_WORDS: StepStatus[] = ['in-report-only', 'ready-to-enforce', 'done']

const stateWith = (over: Partial<StepState>): StepState => ({ ...initialState(), ...over })

// ---- 1: one authority ----

test('the status word is the projection of the state on every step of every fixture', () => {
  const wrong: string[] = []
  for (const { name, s } of everyStep()) {
    if (projectStatus(s.state) !== s.status) wrong.push(`${name}/${s.id}: state projects ${projectStatus(s.state)}, step says ${s.status}`)
  }
  assert.deepEqual(wrong, [], 'a step whose word its own state does not justify means something assigned the word directly')
  assert.ok(everyStep().length > 200, `the fixtures generate steps: ${everyStep().length}`)
})

test('nothing but lifecycle.ts assigns a status', () => {
  // A grep, pinned. Assigning `.status` anywhere else is a second authority for
  // where a step is, and the projection above will not always be run against it
  // first. Move the assignment behind `setState`, or add the file here with its
  // reason — the three below are not steps at all.
  const allowed: Record<string, { n: number; why: string }> = {
    'src/roadmap/lifecycle.ts': { n: 1, why: 'projectStatus in setState: the one writer' },
    'src/graph/collect/http.ts': { n: 2, why: 'the HTTP error classes carry the response status' },
    'src/graph/spikes/authMethods.ts': { n: 1, why: 'a dev spike recording a response status' },
    'src/graph/spikes/reportsCheck.ts': { n: 1, why: 'a dev spike recording a response status' },
    'src/graph/spikes/spike1Extended.ts': { n: 3, why: 'a dev spike recording a response status' },
  }
  const counted: Record<string, number> = {}
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.')) continue
      for (const line of readFileSync(full, 'utf8').split('\n')) {
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
        const n = (code.match(/\.status\s*=[^=]/g) ?? []).length
        if (n > 0) counted[full] = (counted[full] ?? 0) + n
      }
    }
  }
  walk('src')
  const wrong: string[] = []
  for (const [file, n] of Object.entries(counted)) {
    const ok = allowed[file]
    if (!ok) wrong.push(`${file}: assigns a status (${n}) and is not on the list`)
    else if (ok.n !== n) wrong.push(`${file}: now ${n} assignments, was ${ok.n} (${ok.why})`)
  }
  for (const file of Object.keys(allowed)) if (!counted[file]) wrong.push(`${file}: no longer assigns one; remove it from the list`)
  assert.deepEqual(wrong, [])
})

// ---- 2: two axes, and only one of them is the lifecycle ----

test('the lifecycle belongs to a policy: a step that deploys none has no stage', () => {
  const wrong: string[] = []
  for (const { name, s } of everyStep()) {
    // A goal whose baseline defines its policy two ways deploys nothing: the
    // plan withdrew its implementation and refuses to name a rollout it will not
    // define (roadmap/baselineConflict.ts). So it has no stage, by this rule and
    // not despite it — the step kind still reads `create`, but there is no
    // policy being deployed for a stage to be a stage of.
    const deploys = (s.kind === 'create' || s.kind === 'adjust') && !inBaselineConflict(s)
    if (deploys && s.state.lifecycle === null) wrong.push(`${name}/${s.id}: a ${s.kind} step with no lifecycle`)
    if (!deploys && s.state.lifecycle !== null) wrong.push(`${name}/${s.id}: a ${s.kind} step forced into the Conditional Access lifecycle as ${s.state.lifecycle}`)
  }
  assert.deepEqual(wrong, [], 'supporting steps are not stages of a policy nobody is deploying')
  // All four stages are reachable from the fixtures, so the assertions above are
  // about a lifecycle that is actually being used.
  // Ready to enforce is reached on the curated baseline: on the pinned one every
  // report-only policy the fixtures deploy is held, and a held policy is never
  // Ready to enforce (roadmap/holds.ts).
  const seen = new Set([...everyStep().map(({ s }) => s.state.lifecycle), ...runFixture(curatedFixture('demo-week2')).steps.map((s) => s.state.lifecycle)])
  for (const stage of ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced']) assert.ok(seen.has(stage as Lifecycle), `no fixture reaches ${stage}`)
})

test('review required is a condition, never a stage and never a gate', () => {
  // Against the lifecycle: raising the condition to review-required moves
  // neither the stage nor the word, on any step of any fixture.
  const wrong: string[] = []
  for (const { name, s } of everyStep()) {
    if (s.state.setAside) continue
    const before = { lifecycle: s.state.lifecycle, status: s.status }
    const copy = { ...s, state: { ...s.state } } as Step
    raiseCondition(copy, 'review-required')
    if (copy.state.lifecycle !== before.lifecycle) wrong.push(`${name}/${s.id}: review-required moved the stage`)
    if (copy.status !== before.status) wrong.push(`${name}/${s.id}: review-required moved the word to ${copy.status}`)
  }
  assert.deepEqual(wrong, [], 'a step that needs looking at is still exactly where it is')
  // And in the projection itself: review-required reads the same as healthy at
  // every stage, while the conditions that do gate read blocked.
  for (const lifecycle of LIFECYCLES) {
    const healthy = projectStatus(stateWith({ lifecycle, condition: 'healthy' }))
    assert.equal(projectStatus(stateWith({ lifecycle, condition: 'review-required' })), healthy, `review-required changed the word at ${lifecycle}`)
    for (const gate of ['blocked', 'needs-decision'] as Condition[]) {
      const word = projectStatus(stateWith({ lifecycle, condition: gate }))
      assert.ok(word === 'blocked' || STAGE_WORDS.includes(word), `${gate} at ${lifecycle} read ${word}`)
    }
  }
})

test('a condition never invents a stage, and a stage never sets a step aside', () => {
  for (const condition of CONDITIONS) {
    // With no policy deployed and nothing delivered, no condition can produce a
    // word that only a lifecycle stage earns.
    const word = projectStatus(stateWith({ lifecycle: null, condition }))
    assert.ok(!STAGE_WORDS.includes(word), `${condition} alone produced ${word}`)
    // A baseline that contradicts itself binds over everything a tenant can do.
    assert.equal(projectStatus(stateWith({ lifecycle: 'enforced', satisfied: true, condition: 'baseline-conflict' })), 'blocked')
  }
  for (const lifecycle of LIFECYCLES) {
    assert.notEqual(projectStatus(stateWith({ lifecycle })), 'skipped', `${lifecycle} set a step aside on its own`)
    assert.equal(projectStatus(stateWith({ lifecycle, setAside: true })), 'skipped', 'set aside is the operator, whatever the policy is doing')
  }
})

test('a question nobody has answered is a decision, not work waiting to be done', () => {
  assert.equal(conditionFor([]), 'healthy')
  assert.equal(conditionFor([{ kind: 'step', stepId: 's-prereq-device-plan', label: 'device-decision' }]), 'needs-decision')
  assert.equal(conditionFor([{ kind: 'setup', questionNumber: 3, label: 'countries' }]), 'needs-decision')
  assert.equal(conditionFor([{ kind: 'step', stepId: 's-prereq-exclusion-group', label: 'create-object' }]), 'blocked')
  // A decision beside real work is work: the decision is not the whole reason.
  assert.equal(conditionFor([{ kind: 'step', stepId: 's-prereq-device-plan', label: 'device-decision' }, { kind: 'readiness', label: 'readiness' }]), 'blocked')
  // And the baseline binds over both, because no prerequisite can clear it.
  assert.equal(conditionFor([{ kind: 'readiness', label: 'readiness' }, { kind: 'evidence', label: 'baseline-conflict' }]), 'baseline-conflict')
  // Either way the operator sees the same word, so this changes nothing on screen.
  assert.equal(projectStatus(stateWith({ condition: 'needs-decision' })), 'blocked')
})

// ---- 3: In place is a preservation result, not a Conditional Access state ----

test('nothing reads Enforced unless the plan drove its own policy to enforcement', () => {
  const wrong: string[] = []
  for (const { name, s } of everyStep()) {
    const word = statusOf(s).word
    // Enforced is a claim about the rollout, so it takes both: the plan's own
    // policy (`inPlace` is false only where a policy this plan deployed earned
    // the goal — roadmap/generate.ts), and that policy actually on. A step with
    // no policy has neither, and a finished verification campaign read Enforced
    // off the missing provenance alone.
    if (word === 'Enforced' && s.state.lifecycle !== 'enforced') wrong.push(`${name}/${s.id}: Enforced at stage ${s.state.lifecycle}`)
    if (word === 'Enforced' && s.state.inPlace) wrong.push(`${name}/${s.id}: Enforced over a control the tenant already had`)
    // And In place is the other one: a preservation result, whatever stage the
    // tenant's own policy happens to be at. It used to be read off the stage,
    // which cannot tell the two apart — a policy the tenant wrote and switched
    // on is `enforced` too — so every goal a tenant already delivered said
    // Enforced and no row anywhere said In place. It is also the word for a
    // delivered step that deployed no policy at all, which claims the less of
    // the two; what it may never do is stand over a policy this plan drove
    // somewhere.
    if (word === 'In place' && !s.state.inPlace && s.state.lifecycle !== null) wrong.push(`${name}/${s.id}: In place on a policy this plan deployed`)
    // A preservation result never carries a stage the step has no policy for.
    if (s.state.inPlace && !(s.kind === 'create' || s.kind === 'adjust') && s.state.lifecycle !== null) wrong.push(`${name}/${s.id}: an existing control given a policy stage`)
  }
  assert.deepEqual(wrong, [])
  assert.ok(everyStep().some(({ s }) => statusOf(s).word === 'In place'), 'the fixtures have something already in place')
  assert.ok(everyStep().some(({ s }) => statusOf(s).word === 'Enforced'), 'the fixtures have something the plan drove to enforcement')
})

// ---- 4: no invented history ----

test('every date the tracking claims names where it came from', () => {
  const wrong: string[] = []
  for (const { f: { name }, r } of runs) {
    const rows = (r.input.snapshot.config.caPolicies?.rows ?? []) as { id?: string; createdDateTime?: string; modifiedDateTime?: string }[]
    for (const s of r.steps) {
      const t = s.tracking
      if (!t) continue
      // Every date belongs to one deployed object, so every date is checked
      // against the member that holds it — never against whichever policy the
      // step happened to be filed under.
      for (const m of t.members) {
        const where = `${name}/${s.id}/${m.key}`
        if (m.reportOnlyAt === null) assert.equal(m.reportOnlyAtSource, null, `${where}: a source for a date that is not there`)
        else {
          assert.ok(m.reportOnlyAtSource !== null, `${where}: in report-only since a date with no provenance`)
          const first = s.state.members.find((x) => x.key === m.key)?.change.latest.firstSeenAt ?? null
          const evidence = r.input.snapshot.evidencePolicyResults.find((p) => p.policyId === m.policyId)?.firstReportOnlyAt ?? null
          if (m.reportOnlyAtSource === 'first-seen-by-iamai') assert.equal(m.reportOnlyAt, first, `${where}: a first sighting IAMAI did not make`)
          else assert.equal(m.reportOnlyAt, evidence, `${where}: a sign-in date the records do not hold`)
        }
        if (m.enforcedAt === null) assert.equal(m.enforcedAtSource, null, `${where}: a source for a date that is not there`)
        else {
          const row = rows.find((p) => p.id === m.policyId)
          const known = [row?.modifiedDateTime ?? null, row?.createdDateTime ?? null]
          if (m.enforcedAtSource === 'policy-modified') assert.equal(m.enforcedAt, row?.modifiedDateTime ?? null, `${where}`)
          else if (m.enforcedAtSource === 'policy-created') assert.equal(m.enforcedAt, row?.createdDateTime ?? null, `${where}`)
          else if (m.enforcedAtSource !== 'carried-forward') wrong.push(`${where}: enforced on ${m.enforcedAt} from nowhere (${String(m.enforcedAtSource)}), known: ${known.join(', ')}`)
        }
      }
      // And the step's own aggregate says nothing a member does not hold.
      const where = `${name}/${s.id}`
      if (t.reportOnlyAt !== null) assert.ok(t.members.some((m) => m.reportOnlyAt === t.reportOnlyAt), `${where}: a step date no member holds`)
      if (t.enforcedAt !== null) assert.ok(t.members.some((m) => m.enforcedAt === t.enforcedAt), `${where}: a step date no member holds`)
    }
  }
  assert.deepEqual(wrong, [])
})

test('a first sighting is IAMAI’s, and only a record of the policy being evaluated is Microsoft’s', () => {
  const at = '2026-09-05T00:00:00.000Z'
  const first = observe(null, { artifact: 'A', state: 'report-only', semantics: 'aaaa', at, evidenceAt: null })
  assert.equal(first.changed, 'first-scan')
  assert.equal(first.latest.firstSeenAt, at)
  assert.equal(first.latest.since, 'first-scan', 'the first time IAMAI looked says nothing about when the state began')
  assert.equal(first.latest.evidenceAt, null)
  assert.equal(first.expected, false, 'a first sighting is nothing the plan can claim to have asked for')
  // The one transition a tenant proves: a sign-in evaluated under the policy.
  const proven = observe(null, { artifact: 'A', state: 'report-only', semantics: 'aaaa', at, evidenceAt: '2026-08-20T00:00:00.000Z' })
  assert.equal(proven.latest.evidenceAt, '2026-08-20T00:00:00.000Z')
})

// ---- 5: what a scan sees, against what the last one saw ----

test('a rename is not a change: the fingerprint is what the policy does', () => {
  const policy = {
    id: 'p1',
    displayName: 'Require MFA for everyone',
    description: 'the original',
    createdDateTime: '2026-01-01T00:00:00.000Z',
    modifiedDateTime: '2026-01-01T00:00:00.000Z',
    conditions: { users: { includeUsers: ['All', 'GuestsOrExternalUsers'] }, applications: { includeApplications: ['All'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const renamed = { ...policy, displayName: 'MFA — everyone', description: 'tidied up', modifiedDateTime: '2026-09-05T00:00:00.000Z' }
  assert.equal(semanticsOf(renamed), semanticsOf(policy), 'a rename, a new description and a fresh stamp are the same policy')
  // Nor is a list Graph handed back in another order.
  const reordered = { ...policy, conditions: { ...policy.conditions, users: { includeUsers: ['GuestsOrExternalUsers', 'All'] } } }
  assert.equal(semanticsOf(reordered), semanticsOf(policy))
  // A new control is.
  const stronger = { ...policy, grantControls: { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] } }
  assert.notEqual(semanticsOf(stronger), semanticsOf(policy))
  // And a policy that is not there fingerprints as nothing, which is never read
  // as a change (a record from before this contract carries none either).
  assert.equal(semanticsOf(null), '')
})

test('an unrecorded fingerprint proves nothing, and never restarts a window on its own', () => {
  const prior: StepObservation = { artifact: 'A', state: 'report-only', semantics: '', fields: {}, firstSeenAt: '2026-08-20T00:00:00.000Z', since: 'first-scan', lastSeenAt: '2026-08-20T00:00:00.000Z', evidenceAt: null }
  const now = observe(prior, { artifact: 'A', state: 'report-only', semantics: 'abcd', at: '2026-09-05T00:00:00.000Z' })
  assert.equal(now.changed, 'none')
  assert.equal(now.continuity, 'continues', 'a record written before the fingerprint existed is not a rewrite')
  assert.equal(now.reviewRequired, false)
  assert.equal(now.latest.firstSeenAt, prior.firstSeenAt, 'the window it earned survives, because the object did not change')
})

test('a material change restarts the observation; a state that moves the way the plan asked does not', () => {
  const prior: StepObservation = { artifact: 'A', state: 'report-only', semantics: 'aaaa', fields: { grantControls: 'g1' }, firstSeenAt: '2026-08-20T00:00:00.000Z', since: 'first-scan', lastSeenAt: '2026-08-28T00:00:00.000Z', evidenceAt: '2026-08-10T00:00:00.000Z' }
  const at = '2026-09-05T00:00:00.000Z'

  const same = observe(prior, { artifact: 'A', state: 'report-only', semantics: 'aaaa', at, evidenceAt: '2026-08-10T00:00:00.000Z' })
  assert.equal(same.changed, 'none')
  assert.equal(same.continuity, 'continues')
  assert.equal(same.reviewRequired, false)
  assert.equal(same.latest.firstSeenAt, prior.firstSeenAt)
  assert.equal(same.latest.evidenceAt, '2026-08-10T00:00:00.000Z', 'the evidence still holds while nothing material moved')

  const turnedOn = observe(prior, { artifact: 'A', state: 'enforced', semantics: 'aaaa', at })
  assert.equal(turnedOn.changed, 'state')
  assert.equal(turnedOn.expected, true, 'report-only to enforced with the same policy is the plan landing')
  assert.equal(turnedOn.continuity, 'continues', 'the same object, meaning the same thing')
  assert.equal(turnedOn.reviewRequired, false, 'and nothing for anybody to look at')
  assert.equal(turnedOn.latest.since, 'observed-change')

  const turnedOff = observe(prior, { artifact: 'A', state: 'disabled', semantics: 'aaaa', at })
  assert.equal(turnedOff.expected, false, 'a policy going backwards is not what the plan asked for')

  const rewritten = observe(prior, { artifact: 'A', state: 'report-only', semantics: 'bbbb', at, evidenceAt: '2026-08-10T00:00:00.000Z' })
  assert.equal(rewritten.changed, 'semantics')
  assert.equal(rewritten.continuity, 'reset')
  assert.equal(rewritten.reviewRequired, true, 'the same object now means something the plan did not ask for')
  assert.equal(rewritten.latest.firstSeenAt, at, 'a policy that was rewritten has been watched since it was rewritten')
  assert.equal(rewritten.latest.evidenceAt, null, 'records from before the rewrite are about the policy it used to be')
  // And the next scan does not let that old evidence back in.
  const after = observe(rewritten.latest, { artifact: 'A', state: 'report-only', semantics: 'bbbb', at: '2026-09-06T00:00:00.000Z', evidenceAt: '2026-08-10T00:00:00.000Z' })
  assert.equal(after.latest.evidenceAt, null)
  assert.equal(after.latest.firstSeenAt, at, 'the clock keeps running from the rewrite, not from this scan')

  // A change the step's own operation asked for is expected even when the
  // semantics moved, because the plan is what moved them — the window still
  // restarts, because the object was rewritten, and nobody has to look at it.
  // The intent is per dimension: the grant is what the operation submits, so the
  // grant moving to it is the plan landing.
  const landed = observe(prior, { artifact: 'A', state: 'report-only', semantics: 'bbbb', fields: { grantControls: 'g2' }, at, intent: { controls: { grantControls: 'g2' } } })
  assert.equal(landed.expected, true)
  assert.equal(landed.continuity, 'reset', 'the new semantics have been watched for no time at all')
  assert.equal(landed.reviewRequired, false, 'but this is the change the plan submitted, not a drift to review')

  // The same movement with no intent behind it is not expected, and neither is a
  // movement in a dimension the operation does not submit.
  const unasked = observe(prior, { artifact: 'A', state: 'report-only', semantics: 'bbbb', fields: { grantControls: 'g2' }, at })
  assert.equal(unasked.expected, false)
  assert.equal(unasked.reviewRequired, true)
  const elsewhere = observe(prior, { artifact: 'A', state: 'report-only', semantics: 'bbbb', fields: { grantControls: 'g1', sessionControls: 's2' }, at, intent: { controls: { grantControls: 'g2' } } })
  assert.equal(elsewhere.expected, false, 'the session moved and no operation asked it to')
  assert.equal(elsewhere.reviewRequired, true)
})

test('observedStateOf reads Graph’s word, and a policy that is not there is not deployed', () => {
  assert.equal(observedStateOf('enabled'), 'enforced')
  assert.equal(observedStateOf('enabledForReportingButNotEnforced'), 'report-only')
  assert.equal(observedStateOf('disabled'), 'disabled')
  assert.equal(observedStateOf(null), 'absent')
  assert.equal(observedStateOf(undefined), 'absent')
  assert.equal(observedStateOf('somethingNew'), 'unknown', 'a state IAMAI does not recognise is not read as anything')
})

// ---- the contract, through the whole engine ----

const DEMO = fixtures.find((f) => f.name === 'demo')!
const DEMO_WEEK2 = fixtures.find((f) => f.name === 'demo-week2')!
const ADMINS = stepIdForGoal('admins-phishing-resistant')
const TEN_DAYS = 10 * 86_400_000

function demoObservation(over: Partial<StepObservation> = {}): Record<string, StepObservationRecord> {
  const run = runFixture(DEMO)
  const step = run.steps.find((s) => s.id === ADMINS)!
  const row = ((DEMO.snapshot.config.caPolicies?.rows ?? []) as { id?: string }[]).find((p) => p.id === step.tracking?.policyId)
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  // The record names the object it watched: without that, continuity is unknown
  // and the window cannot carry, which is its own test below.
  return { [ADMINS]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf(row?.id), state: 'report-only', semantics: semanticsOf(row as Record<string, unknown>), fields: semanticFieldsOf(row as Record<string, unknown>), firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null, ...over } }, unattributed: null } }
}

/** The one member of a single-policy step's stored record. */
const soleOf = (rec: Record<string, StepObservationRecord>, id: string): StepObservation => rec[id].members[SOLE_MEMBER]

/** The demo tenant's own directory facts, as a scan reads them (tracking.ts TrackingEvidence). */
const demoScope = (): Parameters<typeof applyProgress>[7] => ({
  groupMembers: Object.fromEntries([...DEMO.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), [...g.memberIds]])),
  activePeople: activePeopleIds(DEMO.snapshot, DEMO.snapshot.asOf, notPeopleIds(DEMO.mapping)),
})

/**
 * Microsoft's own records of one policy, watched clean: a report-only success for
 * every active person in the tenant, so the "everybody in scope seen" half of the
 * evidence gate closes whoever that policy actually reaches, and its failure
 * count is a zero records prove rather than the zero an empty set adds up to.
 *
 * Readiness is *both* gates and neither of them alone (roadmap/tracking.ts
 * `gates`). So every case below that is about continuity — a rename, a rewrite, a
 * saved word, a legacy record — hands the engine records and the directory facts
 * to read them against, as well as a window. Without them the case would be
 * asserting that a week passing enforces a policy nobody has any evidence about,
 * which is the reading this contract does not have.
 */
function cleanRecords(policyId: string, people: readonly string[], firstReportOnlyAt: string | null = null): unknown {
  return cleanReportOnly({ policyId, people, asOf: DEMO.snapshot.asOf, firstReportOnlyAt })
}

/** The active people a scan of each tenant resolves the policies' scopes against. */
const demoPeople = (): readonly string[] => (demoScope()!.activePeople ?? []) as readonly string[]
const pairPeople = (): readonly string[] => (pairScope()!.activePeople ?? []) as readonly string[]

/** The demo snapshot with the admins policy's own window watched clean and complete. */
function watchedClean(snapshot: typeof DEMO.snapshot = DEMO.snapshot, policyId?: string): typeof DEMO.snapshot {
  const id = policyId ?? runFixture(DEMO).steps.find((s) => s.id === ADMINS)!.tracking!.policyId!
  return { ...snapshot, evidencePolicyResults: [cleanRecords(id, demoPeople())] as typeof snapshot.evidencePolicyResults }
}

test('a policy watched for its whole window is ready to enforce; the same policy rewritten is not', () => {
  const kept = runFixture(DEMO)
  applyProgress(kept.steps, watchedClean(), kept.coverage, DEMO.planId, undefined, null, demoObservation(), demoScope())
  const watched = kept.steps.find((s) => s.id === ADMINS)!
  // Both gates close on the window it served. The demo's admins policy names an
  // object this baseline has not settled, so something holds it, and a held
  // policy is not Ready to enforce however clean its window (roadmap/holds.ts).
  // These continuity cases are about the window, so they read its gates.
  assert.equal(watched.tracking?.readyNow, true, 'the window it served closes both gates')
  assert.ok(isHeld(watched), 'the premise: the demo holds this policy')
  assert.equal(watched.state.lifecycle, 'report-only', 'and a held policy is not ready to enforce')
  assert.equal(watched.status, 'in-report-only', 'the word follows the stage')
  assert.equal(watched.state.observation?.changed, 'none')

  // The record says the policy used to mean something else. Whatever it meant,
  // nobody has watched what is deployed now for a single day, so the window
  // restarts. And nobody asked for the movement either: this step's operation
  // submits `{ state: enabled }` and controls no material dimension at all, so
  // the grant it now carries is not a change the plan can claim. This assertion
  // used to read the other way, on a comparison against the resolved *target* —
  // the tenant's own policy with the patch applied, which had already absorbed
  // the drift, so the drift matched itself and the review was suppressed.
  const rewritten = runFixture(DEMO)
  applyProgress(rewritten.steps, watchedClean(), rewritten.coverage, DEMO.planId, undefined, null, demoObservation({ semantics: 'deadbeef', fields: { grantControls: 'deadbeef' } }), demoScope())
  const s = rewritten.steps.find((x) => x.id === ADMINS)!
  assert.equal(s.state.observation?.continuity, 'reset', 'these semantics have been watched for no time at all')
  assert.equal(s.state.observation?.expected, false, 'and the step submits no material dimension, so it asked for none of it')
  assert.equal(s.state.observation?.reviewRequired, true, 'a movement nobody asked for is one somebody looks at')
  assert.equal(s.state.lifecycle, 'report-only', 'watched from here, not ready to enforce')
  assert.equal(s.tracking?.reportOnlyAt, DEMO.snapshot.asOf, 'the window starts again at the scan that noticed')
  assert.equal(s.tracking?.reportOnlyAtSource, 'first-seen-by-iamai')
  // The stage stays; the row carries the condition beside it, as the badge does (correction batch 1.1).
  assert.equal(statusOf(s).word.split(' · ')[0], 'Report-only', 'the stage is still the row’s first word')
  assert.notEqual(statusOf(s).word, 'Report-only', 'a policy held for review says so on its row')

  // And a policy that moved into something the plan did not ask for is the case
  // that does need a person: same object, a grant nobody submitted.
  const drifted = structuredClone(DEMO.snapshot)
  const rows = (drifted.config.caPolicies?.rows ?? []) as { id?: string; grantControls?: unknown }[]
  const row = rows.find((p) => p.id === s.tracking?.policyId)!
  row.grantControls = { operator: 'OR', builtInControls: ['block'] }
  const run3 = runFixture(DEMO)
  applyProgress(run3.steps, watchedClean(drifted), run3.coverage, DEMO.planId, undefined, null, demoObservation(), demoScope())
  const d = run3.steps.find((x) => x.id === ADMINS)!
  assert.equal(d.state.observation?.continuity, 'reset')
  assert.equal(d.state.observation?.expected, false, 'nobody asked for this')
  assert.equal(d.state.observation?.reviewRequired, true)
  assert.ok(d.state.condition === 'review-required' || d.state.condition === 'blocked', d.state.condition)
})

test('a rename between two scans changes nothing the plan is waiting on', () => {
  const run = runFixture(DEMO)
  const before = run.steps.find((s) => s.id === ADMINS)!
  const snapshot = structuredClone(DEMO.snapshot)
  const rows = (snapshot.config.caPolicies?.rows ?? []) as { id?: string; displayName?: string; modifiedDateTime?: string }[]
  const row = rows.find((p) => p.id === before.tracking?.policyId)!
  row.displayName = `${row.displayName ?? ''} (renamed)`
  row.modifiedDateTime = snapshot.asOf
  applyProgress(run.steps, watchedClean(snapshot), run.coverage, DEMO.planId, undefined, null, demoObservation(), demoScope())
  const after = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(after.state.observation?.changed, 'none')
  assert.equal(after.state.observation?.continuity, 'continues')
  assert.equal(after.state.observation?.reviewRequired, false)
  assert.equal(after.tracking?.readyNow, true, 'the window a rename cannot touch')
})

test('a record written before this contract loads, and cannot vouch for a policy it never named', () => {
  // This used to assert the opposite: that the migrated date kept its window. It
  // cannot. A record of that vintage holds one date per *step*, and a step is not
  // a policy — nothing in it says which object was watched, so it cannot show
  // that the ten days it counted were spent on the policy deployed now. The date
  // still loads, still reads back, and still shows in the history; what it no
  // longer does is close a rollout gate on its own.
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  const migrated = observationsFrom({ reportOnlySeen: { [ADMINS]: seenAt } })
  assert.deepEqual(migrated[ADMINS], { members: {}, unattributed: { artifact: null, state: 'report-only', semantics: '', fields: {}, firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null } }, 'a record of that vintage names no member, and is filed as one nobody has attributed')
  const run = runFixture(DEMO)
  applyProgress(run.steps, DEMO.snapshot, run.coverage, DEMO.planId, undefined, null, migrated)
  const s = run.steps.find((x) => x.id === ADMINS)!
  assert.equal(s.state.observation?.continuity, 'unknown', 'the record cannot say which policy it watched')
  assert.equal(s.state.observation?.prior?.firstSeenAt, seenAt, 'and the date it holds is still there to show')
  assert.notEqual(s.state.lifecycle, 'ready-to-enforce', 'so it does not carry the step over a gate on its own')
  assert.equal(s.tracking?.reportOnlyAt, DEMO.snapshot.asOf, 'the window runs from the scan that could name the policy')
  // Nothing is wrong with the tenant, so nothing asks the operator to look.
  assert.notEqual(s.state.condition, 'review-required')
  // A record of this vintage is read once and written back in the new shape,
  // naming the object from here on.
  const kept = observationsOf(run.steps)
  assert.equal(soleOf(kept, ADMINS).semantics.length, 8, 'the fingerprint is recorded from here on')
  assert.equal(soleOf(kept, ADMINS).artifact, artifactIdOf(s.tracking?.policyId), 'and so is the object')
  assert.deepEqual(observationsFrom({ observations: kept }), kept, 'what the record holds reads back as what it holds')
})

test('the observation the record keeps is the one history a regeneration cannot repeat', () => {
  for (const { f: { name }, r } of runs) {
    const kept = observationsOf(r.steps)
    for (const s of r.steps) {
      const deploys = s.kind === 'create' || s.kind === 'adjust'
      assert.equal(s.id in kept, deploys, `${name}/${s.id}: a ${s.kind} step ${deploys ? 'should' : 'should not'} be observed`)
      if (!deploys) continue
      assert.equal(soleOf(kept, s.id).firstSeenAt, r.input.snapshot.asOf, `${name}/${s.id}: a first scan sees everything for the first time`)
      assert.equal(soleOf(kept, s.id).state, observedStateOf(((r.input.snapshot.config.caPolicies?.rows ?? []) as { id?: string; state?: string }[]).find((p) => p.id === s.tracking?.policyId)?.state ?? null))
    }
    assert.deepEqual(observationsFrom({ observations: kept }), kept, `${name}: the record round-trips`)
  }
})

// ---- which policy the history belongs to ----
//
// A fingerprint says what a policy means. It does not say whether this is the
// same object that was watched before, and the record used to keep only the
// first: a policy deleted and replaced by a different one meaning the same thing
// inherited the window the first had earned, and could be enforced on the
// strength of days nobody spent watching what is deployed. These run the whole
// engine over two scans of one tenant, because the number that mattered was
// worked out and written down during a scan.

type Row = Record<string, unknown>
const B_ID = '0b0b0b0b-0000-4000-8000-00000000000b'
const rowsOf = (snap: { config: { caPolicies?: { rows?: unknown[] } | null } }): Row[] => (snap.config.caPolicies?.rows ?? []) as Row[]

/** The object the demo's admins step is delivered by on an untouched scan. */
const demoPolicyId = (): string => runFixture(DEMO).steps.find((s) => s.id === ADMINS)!.tracking!.policyId as string

/**
 * A second scan of the demo tenant: its admins policy edited however the case
 * needs, the plan derived afresh from that snapshot, and the record the previous
 * scan left behind carried in. The whole engine, not a helper.
 */
function rescan(edit: (row: Row, snapshot: ReturnType<typeof structuredClone<typeof DEMO.snapshot>>) => void, prior: Record<string, StepObservationRecord>, scopeEvidence?: Parameters<typeof applyProgress>[7]): Step {
  const snapshot = structuredClone(DEMO.snapshot)
  const row = rowsOf(snapshot).find((p) => p.id === demoPolicyId())!
  edit(row, snapshot)
  const run = runFixture({ ...DEMO, snapshot })
  applyProgress(run.steps, snapshot, run.coverage, DEMO.planId, undefined, null, prior, scopeEvidence)
  return run.steps.find((s) => s.id === ADMINS)!
}

test('1: a policy replaced by a different object meaning the same thing inherits none of its history', () => {
  const prior = demoObservation()
  const watched = soleOf(prior, ADMINS)
  const s = rescan((row) => {
    row.id = B_ID
  }, prior)

  assert.equal(s.tracking?.policyId, B_ID, 'the step is delivered by the new object')
  assert.equal(s.state.observation?.changed, 'artifact', 'the one move a fingerprint cannot see')
  assert.equal(s.state.observation?.continuity, 'reset')
  assert.equal(s.state.observation?.latest.semantics, watched.semantics, 'and it means exactly what the old one meant')
  // None of the first policy's history comes with it.
  assert.notEqual(s.state.observation?.latest.firstSeenAt, watched.firstSeenAt)
  assert.equal(s.state.observation?.latest.firstSeenAt, DEMO.snapshot.asOf, 'the new object has been watched since this scan')
  assert.equal(s.state.observation?.latest.evidenceAt, null, 'and carries none of the old one’s evidence')
  assert.equal(s.tracking?.reportOnlyAt, DEMO.snapshot.asOf)
  assert.equal(s.tracking?.reportOnlyAtSource, 'first-seen-by-iamai')
  assert.equal(s.tracking?.readyNow, false, 'ten days on another object enforce nothing')
  // The record now names the object it is about.
  assert.equal(soleOf(observationsOf([s]), ADMINS).artifact, artifactIdOf(B_ID))
  assert.notEqual(soleOf(observationsOf([s]), ADMINS).artifact, watched.artifact)
})

test('2: a rename of the same object keeps the window it earned', () => {
  const prior = demoObservation()
  const s = rescan((row, snapshot) => {
    row.displayName = `${String(row.displayName ?? '')} (renamed)`
    row.description = 'tidied up'
    row.modifiedDateTime = snapshot.asOf
    // The records the window is read with: readiness is both gates, so a case
    // about the window hands the engine the evidence too (`cleanRecords`).
    snapshot.evidencePolicyResults = [cleanRecords(String(row.id), demoPeople())] as typeof snapshot.evidencePolicyResults
  }, prior, demoScope())
  assert.equal(s.state.observation?.changed, 'none', 'a name and a fresh stamp are not a change')
  assert.equal(s.state.observation?.continuity, 'continues')
  assert.equal(s.state.observation?.reviewRequired, false)
  assert.equal(s.state.observation?.latest.artifact, soleOf(prior, ADMINS).artifact, 'the same object')
  assert.equal(s.state.observation?.latest.firstSeenAt, soleOf(prior, ADMINS).firstSeenAt, 'the window survives')
  assert.equal(s.tracking?.readyNow, true, 'and the rename moved nothing backwards')
})

test('3: the same object materially rewritten is watched from the rewrite, not from before it', () => {
  const prior = demoObservation({ evidenceAt: new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString() })
  const s = rescan((row) => {
    row.grantControls = { operator: 'OR', builtInControls: ['block'] }
  }, prior)
  assert.equal(s.state.observation?.latest.artifact, soleOf(prior, ADMINS).artifact, 'the same object')
  assert.equal(s.state.observation?.changed, 'semantics')
  assert.equal(s.state.observation?.continuity, 'reset')
  assert.notEqual(s.state.observation?.latest.semantics, soleOf(prior, ADMINS).semantics)
  assert.equal(s.state.observation?.latest.firstSeenAt, DEMO.snapshot.asOf, 'the clock restarts at the rewrite')
  assert.equal(s.state.observation?.latest.evidenceAt, null, 'records from before it are about what the policy used to be')
  assert.equal(s.tracking?.reportOnlyAt, DEMO.snapshot.asOf)
  assert.equal(s.tracking?.readyNow, false, 'the new semantics have not been watched')
  // And the other axis: the grant moved and this step's operation submits no
  // grant, so nothing about the plan accounts for it. Re-deriving the plan from
  // the drifted tenant does not change that — the update's target now contains
  // the drift, and the intent contract reads the patch, not the target.
  assert.equal(s.state.observation?.expected, false, 'a drift is not authorised by being copied into the target')
  assert.equal(s.state.observation?.reviewRequired, true)
})

test('4: a replacement that is exactly what the plan meant to deploy resets the window and asks nobody to look', () => {
  // The demo's admins policy already carries the body this step submits, so a
  // new object with the same body is the plan landing rather than a drift. The
  // window still restarts — nobody has watched the new object — and that reset is
  // not, by itself, a reason to put the step into Review required.
  const prior = demoObservation()
  const s = rescan((row) => {
    row.id = B_ID
  }, prior)
  assert.equal(s.state.observation?.continuity, 'reset', 'the new object has its own history to earn')
  assert.deepEqual(s.state.observation?.latest.fields, s.state.observation?.prior?.fields, 'and it means exactly what the old one meant')
  // Nothing material moved, so there is nothing to call expected or unexpected —
  // and nothing for anybody to look at. Replacing the object is not, by itself,
  // a reason to put the step into Review required.
  assert.equal(s.state.observation?.reviewRequired, false)
  assert.notEqual(s.state.condition, 'review-required', 'a restarted clock is not a rollout in trouble')
  // The two axes stay orthogonal: where it is, and whether anything is wrong.
  assert.equal(s.state.lifecycle, 'report-only')
  assert.equal(statusOf(s).word, isHeld(s) ? 'Report-only · Blocked' : 'Report-only')
})

test('5: a legacy record loads, explains itself, and closes no gate — unless this policy’s own evidence does', () => {
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  const legacy = observationsFrom({ reportOnlySeen: { [ADMINS]: seenAt } })
  assert.equal(legacy[ADMINS].unattributed?.artifact, null, 'a record of that vintage names no object')

  const s = rescan(() => {}, legacy)
  assert.equal(s.state.observation?.continuity, 'unknown', 'so it cannot be shown to be about this policy')
  assert.equal(s.state.observation?.prior?.firstSeenAt, seenAt, 'the date it holds is still there to show')
  assert.equal(s.tracking?.readyNow, false)
  assert.notEqual(s.state.condition, 'review-required', 'and an unproven window is not a fault')

  // Microsoft's own record of *this* policy in report-only is a different thing
  // from an inherited date, and it may still close the gate.
  // A record with no sign-ins in it dates the window and closes no gate: an
  // empty set is not a clean one, and readiness needs the records as well as the
  // days. So the evidence that carries it is a real one — every active person
  // seen, nothing failing — over the window it dates.
  const proven = rescan((row, snapshot) => {
    snapshot.evidencePolicyResults = [cleanRecords(String(row.id), demoPeople(), seenAt)] as typeof snapshot.evidencePolicyResults
  }, legacy, demoScope())
  assert.equal(proven.tracking?.reportOnlyAt, seenAt)
  assert.equal(proven.tracking?.reportOnlyAtSource, 'sign-in-evidence', 'and it says whose evidence it is')
  assert.equal(proven.tracking?.readyNow, true)
})

test('6: the history follows the policy the step matched, never the step id', () => {
  const prior = demoObservation()
  const before = runFixture(DEMO).steps.find((s) => s.id === ADMINS)!
  const after = rescan((row) => {
    row.id = B_ID
  }, prior)
  assert.equal(after.id, before.id, 'the same row of the plan')
  assert.notEqual(after.tracking?.policyId, before.tracking?.policyId, 'a different policy delivering it')
  assert.notEqual(soleOf(observationsOf([after]), ADMINS).artifact, soleOf(prior, ADMINS).artifact, 'and the record says so')
  assert.equal(after.state.observation?.latest.firstSeenAt, DEMO.snapshot.asOf, 'so none of the timing came across')
})

test('7: a new object may use its own current evidence, and never the old object’s history', () => {
  const prior = demoObservation()
  const provenAt = new Date(Date.parse(DEMO.snapshot.asOf) - 12 * 86_400_000).toISOString()
  const s = rescan((row, snapshot) => {
    row.id = B_ID
    snapshot.evidencePolicyResults = [
      {
        policyId: B_ID,
        displayName: String(row.displayName ?? ''),
        counts: { reportOnlyFailure: 0, reportOnlyInterrupted: 0, reportOnlySuccess: 0, enforcedFailure: 0, enforcedSuccess: 0 },
        affectedUserIds: { reportOnlyFailure: [], reportOnlyInterrupted: [], reportOnlySuccess: [], enforcedFailure: [], enforcedSuccess: [] },
        firstReportOnlyAt: provenAt,
      },
    ] as typeof snapshot.evidencePolicyResults
  }, prior)
  assert.equal(s.state.observation?.continuity, 'reset', 'still a different object')
  assert.equal(s.state.observation?.latest.firstSeenAt, DEMO.snapshot.asOf, 'IAMAI first saw it this scan')
  assert.equal(s.state.observation?.latest.evidenceAt, provenAt, 'and the tenant proves this policy is older than that')
  assert.notEqual(provenAt, soleOf(prior, ADMINS).firstSeenAt, 'the date is the new policy’s own, not the old record’s')
  assert.equal(s.tracking?.reportOnlyAt, provenAt)
  assert.equal(s.tracking?.reportOnlyAtSource, 'sign-in-evidence', 'told truthfully as Microsoft’s, not as IAMAI’s sighting')
})

test('8: the record round-trips the object, the fingerprint and the state, and carries no tenant id', () => {
  for (const { f: { name }, r } of runs) {
    const kept = observationsOf(r.steps)
    assert.deepEqual(observationsFrom({ observations: kept }), kept, `${name}: the record reads back as what it holds`)
    const serialised = JSON.stringify(kept)
    for (const s of r.steps) {
      const held = kept[s.id]
      if (!held) continue
      assert.equal(held.unattributed, null, `${name}/${s.id}: written in the member shape`)
      const members = s.tracking?.members ?? []
      for (const [key, o] of Object.entries(held.members)) {
        // Each member's record is about that member's own object, and no other's.
        const member = members.find((x) => x.key === key)
        if (member) assert.equal(o.artifact, artifactIdOf(member.policyId), `${name}/${s.id}/${key}: the object it was about`)
        assert.equal(typeof o.semantics, 'string')
        assert.ok(['absent', 'disabled', 'report-only', 'enforced', 'unknown'].includes(o.state))
      }
      // The identity is opaque: equality is the only question asked of it, so the
      // tenant's own object id never has to be written into a saved plan.
      for (const m of members) if (m.policyId) assert.equal(serialised.includes(m.policyId), false, `${name}/${s.id}: the raw policy id is not persisted`)
    }
  }
})

test('9: what is tracked follows the deployed policy, and the goal’s population moves none of it', () => {
  // Foundation A owns which accounts are being observed. This is here so that
  // changing tracking code for Foundation B cannot quietly put the goal's people
  // back into the answer.
  const strangers = ['00000000-0000-4000-8000-00000000dead', '00000000-0000-4000-8000-00000000beef']
  const prior = demoObservation()
  const reading = (s: Step): string => JSON.stringify([s.tracking?.activeInScope ?? null, s.tracking?.seenInScope ?? null, s.tracking?.readyNow ?? null, s.state.lifecycle, s.state.observation?.continuity ?? null, s.state.observation?.latest.firstSeenAt ?? null])
  const asGenerated = rescan(() => {}, prior)
  const moved = (() => {
    const snapshot = structuredClone(DEMO.snapshot)
    const run = runFixture({ ...DEMO, snapshot })
    for (const s of run.steps) s.population = { ...s.population, ids: strangers, activeIds: strangers, active: strangers.length, total: strangers.length }
    applyProgress(run.steps, snapshot, run.coverage, DEMO.planId, undefined, null, prior)
    return run.steps.find((s) => s.id === ADMINS)!
  })()
  assert.equal(reading(moved), reading(asGenerated), 'the goal’s people decide nothing the tracking says')
})

test('10: with the matched policy’s scope unresolved nothing is seen, and nothing advances on it', () => {
  // Withhold what the deployed policy's scope is resolved against. The gate has
  // no denominator, so it cannot be read as met — and it does not fall back to
  // the people the goal handed the step.
  const prior = demoObservation()
  const blind = rescan(() => {}, prior, {})
  assert.equal(blind.tracking?.activeInScope, null, 'no count is claimed')
  assert.equal(blind.tracking?.seenInScope, null)
  assert.equal(blind.tracking?.readyNow, false, 'and the "everybody seen" half cannot be vacuously true')
  assert.ok((blind.population.activeIds ?? blind.population.ids).length > 0, 'the goal’s people were right there')
  // And nothing advances on the window alone. The time gate is about how long,
  // not about who, so on its own it says nothing about whether enforcing this
  // policy would lock anybody out — which is the whole question the report-only
  // window was opened to answer. A scope IAMAI cannot settle is an unknown, and
  // an unknown waits (roadmap/tracking.ts `gates`).
  assert.notEqual(blind.state.lifecycle, 'ready-to-enforce', 'a served window is not evidence about anybody')
  assert.equal(blind.state.lifecycle, 'report-only', 'so the policy is still being watched')
  // The same policy, with the scope readable and its records clean, is ready:
  // the correction withholds the stage for a missing gate and not for its own
  // sake.
  const seeing = rescan((row, snapshot) => {
    snapshot.evidencePolicyResults = [cleanRecords(String(row.id), demoPeople())] as typeof snapshot.evidencePolicyResults
  }, prior, demoScope())
  assert.equal(seeing.tracking?.readyNow, true)
})

// ---- a saved word is not a lifecycle ----
//
// `Step.status` is a projection of the state (lifecycle.ts projectStatus). A plan
// record that carries the word could hand it back, and `mergePersisted` raised
// the step's state to whatever the word had stood for — so a saved "ready to
// enforce" walked straight past the observation contract it was supposed to have
// come from: past artifact continuity, past a window that had reset, past a
// legacy record that can prove nothing. For a step that deploys a policy the
// lifecycle now comes from the current scan and from history whose continuity
// that scan can prove, or not at all.

/** A saved plan for the demo's admins step, carrying whatever word the last scan projected. */
const savedWord = (status: StepStatus): Record<string, SavedStep> => ({ [ADMINS]: { status, history: [], skipReason: null } })

/** Fresh steps for the demo, with a saved record merged in and the scan applied over it. */
function withSaved(saved: Record<string, SavedStep>, observations: Record<string, StepObservationRecord> | null = null): Step {
  const run = runFixture(DEMO)
  const steps = generateRoadmap(run.input).steps
  mergePersisted(steps, saved)
  applyProgress(steps, watchedClean(), run.coverage, DEMO.planId, undefined, null, observations, demoScope())
  return steps.find((x) => x.id === ADMINS) as Step
}

test('a saved "ready to enforce" cannot make a policy ready whose window this scan does not support', () => {
  // The record says the last scan projected Ready to enforce. This scan sees the
  // same policy in report-only with no observation behind it at all, so the
  // window starts today and nothing is ready.
  const s = withSaved(savedWord('ready-to-enforce'))
  assert.equal(s.state.lifecycle, 'report-only', 'the current scan decides where the policy is')
  assert.equal(s.tracking?.readyNow, false)
  assert.equal(s.tracking?.reportOnlyAt, DEMO.snapshot.asOf, 'watched from this scan, not from a word')
})

test('a saved "enforced" does not survive a policy this scan finds in report-only', () => {
  const s = withSaved(savedWord('done'))
  assert.equal(s.state.satisfied, false, 'the saved word does not finish a step the tenant has not finished')
  assert.notEqual(s.status, 'done')
  assert.equal(s.state.lifecycle, 'report-only', 'the deployed policy is what says where it is')
})

test('a saved "ready to enforce" cannot outlive the policy it was about', () => {
  // The word came from watching object A. Object B is deployed now, meaning
  // exactly the same thing. Continuity resets, and the word cannot put back what
  // the reset took away.
  const prior = demoObservation()
  const run = runFixture(DEMO)
  const snapshot = structuredClone(DEMO.snapshot)
  rowsOf(snapshot).find((p) => p.id === demoPolicyId())!.id = B_ID
  const fresh = runFixture({ ...DEMO, snapshot })
  const steps = generateRoadmap(fresh.input).steps
  mergePersisted(steps, savedWord('ready-to-enforce'))
  applyProgress(steps, snapshot, fresh.coverage, DEMO.planId, undefined, null, prior)
  const s = steps.find((x) => x.id === ADMINS) as Step
  assert.equal(s.state.observation?.continuity, 'reset')
  assert.equal(s.tracking?.readyNow, false, 'the reset wins over the saved projection')
  void run
})

test('a saved "ready to enforce" beside a legacy observation still proves nothing', () => {
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  const s = withSaved(savedWord('ready-to-enforce'), observationsFrom({ reportOnlySeen: { [ADMINS]: seenAt } }))
  assert.equal(s.state.observation?.continuity, 'unknown', 'the record names no object')
  assert.equal(s.tracking?.readyNow, false, 'and neither of the two can advance it alone')
})

test('a policy whose window this scan can prove is still ready, with or without a saved word', () => {
  // The correction must not simply force everything backwards: where the current
  // artifact, its semantics and a continuous observation establish readiness, the
  // step is ready — and it gets there without the record ever naming a status.
  const earned = withSaved({}, demoObservation())
  assert.equal(earned.tracking?.readyNow, true, 'the engine reaches it on its own')
  const alsoSaved = withSaved(savedWord('blocked'), demoObservation())
  assert.equal(alsoSaved.tracking?.readyNow, true, 'and a stale word does not hold it back either')
  // Whether it may be turned on is the hold's question, and the saved word is not asked it (roadmap/holds.ts).
  assert.equal(alsoSaved.state.lifecycle, earned.state.lifecycle)
})

test('the operator’s own decision survives, through its own authority', () => {
  const s = withSaved({ [ADMINS]: { status: 'skipped', history: [], skipReason: 'not for us' } })
  assert.equal(s.state.setAside, true, 'setting a step aside is a choice nothing about the tenant re-derives')
  assert.equal(s.status, 'skipped')
  assert.equal(s.skipReason, 'not for us')
})

// ---- a reading has to be taken again ----
//
// This used to assert the opposite: that a prerequisite kept whatever the record
// said it had completed. It cannot. Every step this engine generates works its
// own state out from the scan in front of it — a prerequisite from whether the
// object exists or the validation subject passes *now*, a check from whether
// anybody is still dormant or still unanswered, the verification from how many
// people still have no method. None of it is a one-time act nobody can observe
// again, so a higher saved word was a way for a fact to outlive the evidence that
// produced it.

const LOCATION = 's-prereq-trusted-location'
const BREAK_GLASS = 's-prereq-break-glass'

/** Fresh steps for a fixture whose snapshot or mapping this case has edited. */
function scanOf(f: Fixture, edit: (snapshot: typeof f.snapshot, mapping: typeof f.mapping) => void = () => {}): Step[] {
  const snapshot = structuredClone(f.snapshot)
  const mapping = structuredClone(f.mapping)
  edit(snapshot, mapping)
  return generateRoadmap(runFixture({ ...f, snapshot, mapping }).input).steps
}

const noLocation = (snapshot: { config: { namedLocations?: { rows?: unknown[] } | null } }): void => {
  if (snapshot.config.namedLocations) snapshot.config.namedLocations.rows = []
}

test('a recurring check that passed and now fails is not restored by the record', () => {
  // The trusted-location prerequisite is In place because the tenant has an IP
  // named location. Take it away and the step is work again — whatever a record
  // written while it existed says.
  const passing = scanOf(DEMO).find((x) => x.id === LOCATION) as Step
  assert.equal(passing.status, 'done', 'it passes on the tenant as it stands')
  const saved = { [LOCATION]: savedStepOf(passing) }

  const now = scanOf(DEMO, noLocation)
  mergePersisted(now, saved)
  const step = now.find((x) => x.id === LOCATION) as Step
  assert.notEqual(step.status, 'done', 'the current reading wins')
  assert.equal(step.state.satisfied, false)
  assert.equal(step.state.inPlace, false, 'and nothing claims the tenant still has it')
})

test('a recurring check whose evidence has gone unreadable stays conservative', () => {
  // The source itself cannot be read this time. Absent evidence is not passing
  // evidence, so the step is not In place and the record does not make it so.
  const passing = scanOf(DEMO).find((x) => x.id === LOCATION) as Step
  const saved = { [LOCATION]: savedStepOf(passing) }
  const now = scanOf(DEMO, (snapshot) => {
    const nl = snapshot.config.namedLocations
    if (nl) {
      nl.status = 'error'
      nl.rows = []
    }
  })
  mergePersisted(now, saved)
  const step = now.find((x) => x.id === LOCATION) as Step
  assert.notEqual(step.status, 'done', 'unknown is not done')
  assert.equal(step.state.satisfied, false)
})

test('a recurring check that failed and now passes is not held back by the record', () => {
  // The saved projection is not authority in either direction.
  const failing = scanOf(DEMO, noLocation).find((x) => x.id === LOCATION) as Step
  assert.notEqual(failing.status, 'done')
  const saved = { [LOCATION]: savedStepOf(failing) }
  const now = scanOf(DEMO)
  mergePersisted(now, saved)
  const step = now.find((x) => x.id === LOCATION) as Step
  assert.equal(step.status, 'done', 'the current reading advances it')
})

test('a stale saved pass on the emergency-access gate cannot let a rollout step through', () => {
  // The product question, not the row: emergency access is the gate every change
  // that can deny access waits behind. A record saying it passed, carried onto a
  // scan where it does not, would open that gate on evidence that no longer
  // holds — and the steps behind it are the ones that lock people out.
  const healthy = scanOf(DEMO_WEEK2).find((x) => x.id === BREAK_GLASS) as Step
  assert.equal(healthy.status, 'done', 'week two has a healthy emergency account')
  const saved = { [BREAK_GLASS]: savedStepOf(healthy) }

  const now = scanOf(DEMO_WEEK2, (_snapshot, mapping) => {
    mapping.breakGlassUserIds = []
  })
  const gatedBefore = now.filter((x) => x.blockedBy.includes(BREAK_GLASS)).map((x) => x.id)
  assert.ok(gatedBefore.length > 0, 'losing the emergency account gates the deny-capable steps')

  mergePersisted(now, saved)
  const gate = now.find((x) => x.id === BREAK_GLASS) as Step
  assert.notEqual(gate.status, 'done', 'the gate is not reopened by the record')
  const gatedAfter = now.filter((x) => x.blockedBy.includes(BREAK_GLASS)).map((x) => x.id)
  assert.deepEqual(gatedAfter, gatedBefore, 'and every step behind it is still held')
  for (const id of gatedAfter) {
    const held = now.find((x) => x.id === id) as Step
    assert.notEqual(held.state.lifecycle, 'ready-to-enforce', `${id} did not advance on a stale pass`)
    assert.equal(held.state.satisfied, false, `${id} is not finished by one either`)
  }
})

test('the operator’s own decision is persisted as a fact, and survives', () => {
  // The one thing no scan can re-derive. It is written down as itself now, not
  // inferred from the word — and a file written before that still loads.
  const first = scanOf(DEMO)
  const aside = first.find((x) => x.kind === 'prerequisite') as Step
  setState(aside, { setAside: true })
  aside.skipReason = 'not for us'
  const saved = savedStepOf(aside)
  assert.equal(saved.setAside, true, 'the fact is what is written down')

  const now = scanOf(DEMO)
  mergePersisted(now, { [aside.id]: saved })
  const back = now.find((x) => x.id === aside.id) as Step
  assert.equal(back.state.setAside, true)
  assert.equal(back.status, 'skipped')
  assert.equal(back.skipReason, 'not for us')

  // A record from before `setAside` was stored beside the word still loads.
  const legacy = scanOf(DEMO)
  mergePersisted(legacy, { [aside.id]: { status: 'skipped', history: [], skipReason: 'not for us' } })
  assert.equal((legacy.find((x) => x.id === aside.id) as Step).state.setAside, true)
})

test('no saved word raises any step, of any kind, on any fixture', () => {
  // The rule as a sweep rather than a case: hand every step of every fixture the
  // highest word there is, and nothing moves. `done` is the top of the ranking,
  // so this is the strongest thing a record could once have said.
  for (const { f } of runs) {
    const steps = scanOf(f)
    const before = steps.map((x) => `${x.id}:${x.status}:${x.state.lifecycle}:${x.state.satisfied}`)
    mergePersisted(steps, Object.fromEntries(steps.map((x) => [x.id, { status: 'done' as const, history: [], skipReason: null }])))
    const after = steps.map((x) => `${x.id}:${x.status}:${x.state.lifecycle}:${x.state.satisfied}`)
    assert.deepEqual(after, before, `${f.name}: a saved word moved a step`)
  }
})

// ---- what the plan actually asked to change ----
//
// An update's resolved target is the tenant's own policy with the patch applied,
// so every field the patch does not touch is a copy of whatever is deployed at
// the moment the target is built. Comparing the deployed policy against that
// target asked the tenant whether it agreed with itself. It always did, and a
// drift became its own authorisation. The intent contract reads the patch.

test('an update authorises only the dimensions its patch actually submits', () => {
  const prior = { grantControls: 'g1', sessionControls: 's1', 'conditions.users': 'u1' }
  const at = '2026-09-05T00:00:00.000Z'
  const base = { artifact: 'A', state: 'report-only' as const, semantics: 'aaaa', fields: prior, firstSeenAt: '2026-08-20T00:00:00.000Z', since: 'first-scan' as const, lastSeenAt: at, evidenceAt: null }
  // The plan changes the grant, and only the grant.
  const intent = { controls: { grantControls: 'g2' } }

  // 1: the grant moves to what the plan submits.
  const landed = observe(base, { artifact: 'A', state: 'report-only', semantics: 'bbbb', fields: { ...prior, grantControls: 'g2' }, at, intent })
  assert.equal(landed.expected, true, 'the dimension the plan controls reached the value it submits')
  assert.equal(landed.reviewRequired, false, 'so the intended change is not manufactured into a review')
  assert.equal(landed.continuity, 'reset', 'the new semantics have still been watched for no time')

  // 2: an untouched dimension moves instead. Nothing asked for it.
  const drifted = observe(base, { artifact: 'A', state: 'report-only', semantics: 'cccc', fields: { ...prior, sessionControls: 's2' }, at, intent })
  assert.equal(drifted.expected, false, 'the session is not a dimension this operation submits')
  assert.equal(drifted.reviewRequired, true)

  // 3: the target may legitimately carry the drift; the intent must not. An
  // intent built from a *target* would name every dimension, including the
  // drifted one — that is the shape this contract refuses.
  const fromTarget = { controls: { ...prior, grantControls: 'g2', sessionControls: 's2' } }
  const circular = observe(base, { artifact: 'A', state: 'report-only', semantics: 'cccc', fields: { ...prior, sessionControls: 's2' }, at, intent: fromTarget })
  assert.equal(circular.expected, true, 'this is what reading the target used to do')
  assert.notDeepEqual(intent.controls, fromTarget.controls, 'and it is why intent comes from the patch, never the target')

  // 4: one dimension lands as planned, another drifts. Not wholly expected.
  const both = observe(base, { artifact: 'A', state: 'report-only', semantics: 'dddd', fields: { ...prior, grantControls: 'g2', 'conditions.users': 'u2' }, at, intent })
  assert.equal(both.expected, false, 'the scope moved and no operation asked it to')
  assert.equal(both.reviewRequired, true)

  // 5: no intent at all, and no dimensions to compare: never expected by guess.
  assert.equal(observe(base, { artifact: 'A', state: 'report-only', semantics: 'bbbb', fields: { ...prior, grantControls: 'g2' }, at }).reviewRequired, true)
  const blind = observe({ ...base, fields: {} }, { artifact: 'A', state: 'report-only', semantics: 'bbbb', fields: {}, at, intent })
  assert.equal(blind.expected, false, 'a record with no dimensions cannot show a movement was asked for')
})

test('intentOf reads what a body submits, and a patch that sets only a state submits nothing material', () => {
  // The demo's admins step is exactly this: `{ state: "enabled" }`. It controls no
  // material dimension, so it authorises no semantic movement whatever — which is
  // the case the target-based comparison got backwards.
  assert.deepEqual(intentOf({ state: 'enabled' }), { controls: {} })
  assert.equal(intentOf(null), null)
  const patch = { conditions: { applications: { includeApplications: ['Office365'] } } }
  const controls = intentOf(patch)!.controls
  assert.deepEqual(Object.keys(controls), ['conditions.applications'], 'only the dimension the patch carries')
  // And it is the same fingerprint the deployed policy will produce for it.
  assert.equal(controls['conditions.applications'], semanticFieldsOf(patch)['conditions.applications'])
  // A whole body (a create) controls every dimension it names.
  const whole = { conditions: { users: { includeUsers: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
  assert.deepEqual(Object.keys(intentOf(whole)!.controls).sort(), ['conditions.users', 'grantControls'])
})

test('a tenant already drifted before the plan is built does not make its drift the plan’s intent', () => {
  // The whole engine: drift the tenant's session control, then derive the plan
  // from that drifted tenant so the update's target contains it, and check that
  // the movement is still not called expected.
  const prior = demoObservation()
  const s = rescan((row) => {
    row.sessionControls = { signInFrequency: { isEnabled: true, type: 'hours', value: 1 } }
  }, prior)
  const op = s.action.resolution?.policies[0]
  assert.ok(op, 'the step still has an operation')
  assert.equal(intentOf(op!.body)!.controls.sessionControls, undefined, 'the patch does not submit a session control')
  if (op!.mode === 'update' && op!.target) {
    assert.ok(semanticFieldsOf(op!.target as Record<string, unknown>).sessionControls, 'though the target carries one, as a valid request must')
  }
  assert.equal(s.state.observation?.expected, false, 'and the movement is not adopted as intent')
  assert.equal(s.state.observation?.reviewRequired, true)
})

// ---- the next milestone ----

test('every step ends in one next thing, and none of them invents a date', () => {
  const wrong: string[] = []
  for (const { name, s } of everyStep()) {
    const m = nextMilestone(s)
    const where = `${name}/${s.id}`
    if (!m.label || m.label.trim().length === 0) wrong.push(`${where}: no next milestone`)
    if (m.at !== null && Number.isNaN(Date.parse(m.at))) wrong.push(`${where}: ${m.at} is not a date`)
    // A baseline that defines the policy two ways has nothing to submit, so it
    // has no rollout date either (Foundation D holds the same line for the row).
    if (s.state.condition === 'baseline-conflict' && (m.at !== null || m.kind !== 'resolve')) wrong.push(`${where}: a baseline conflict with a date or an action`)
    // A step in report-only names the day its window closes, from the tracking
    // and never from anywhere else.
    if (s.state.lifecycle === 'report-only' && !s.state.satisfied && !isHeld(s) && m.at !== (s.tracking?.readyOn ?? null)) wrong.push(`${where}: watched until a date the tracking does not hold`)
    // A held step's next thing is what holds it, and it has no date (roadmap/holds.ts).
    // Except the one day a held create keeps: the day it is made in report-only
    // while a readiness threshold gates its enforcement (owner decision, 2026-09-11).
    const gated = s.scheduled !== undefined && scheduleOf(s).class === 'scheduled' && scheduleOf(s).enforcement === 'gated'
    if (isHeld(s) && m.at !== null && !(gated && m.at === scheduleOf(s).at)) wrong.push(`${where}: a held step with a next date`)
    if (s.status === 'blocked' && s.state.condition !== 'baseline-conflict' && !gated && m.gatedBy !== s.blockedReason) wrong.push(`${where}: a milestone gated by something other than the reason the row shows`)
  }
  assert.deepEqual(wrong, [])
  // An open observation window is reached on the curated baseline: on the pinned
  // one every report-only policy the fixtures deploy is held (roadmap/holds.ts).
  const kinds = new Set([...everyStep().map(({ s }) => nextMilestone(s).kind), ...runFixture(curatedFixture('demo-week2')).steps.map((s) => nextMilestone(s).kind)])
  for (const kind of ['resolve', 'deploy', 'observe', 'preserve']) assert.ok(kinds.has(kind as ReturnType<typeof nextMilestone>['kind']), `no fixture step is waiting to ${kind}`)
})

// ---- reading a stored word back ----

test('a stored word reads back as the state it stood for, and only there', () => {
  const words: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const word of words) {
    const step = { status: 'ready', state: initialState() } as Step
    setState(step, stateForStatus(word))
    assert.equal(step.status, word, `${word} did not read back as itself`)
  }
})

// ---- a goal the baseline implements with two policies ----
//
// One step is not one policy. The pinned baseline implements `guests-mfa` with
// two — Policy A and Policy B — and the product shows them as one step with two
// blocks. Foundation B read one deployed policy per step, so everything
// temporal was transferable between the halves: A's earned window enforced B,
// A's records satisfied B's gate, B's absence vanished behind A, a replacement
// of one reset the other, and B's rewrite was compared against A's patch.
//
// These run the real pinned pair through the generator and then through a scan,
// because the numbers that matter are worked out during a scan.

const GUESTS = stepIdForGoal('guests-mfa')
const W2 = fixtures.find((f) => f.name === 'demo-week2') as Fixture
const A_ID = '0a11a11a-0000-4000-8000-00000000000a'
const B_PAIR_ID = '0b22b22b-0000-4000-8000-00000000000b'
const B_OTHER_ID = '0c33c33c-0000-4000-8000-00000000000c'
type PairRow = Record<string, unknown>

/**
 * demo-week2 with none of its own Conditional Access policies: the tenant has
 * the pinned pair to write, so the step carries both of the baseline's policies
 * as its two required members.
 */
function pairPlan(): { bare: typeof W2.snapshot; run: ReturnType<typeof runFixture> } {
  const ca = W2.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const bare = { ...W2.snapshot, config: { ...W2.snapshot.config, caPolicies: { ...ca, rows: [] } } }
  // The pair cases are about how members aggregate, not about the guest readiness
  // prerequisite (roadmap/operations.ts readinessGate), so the tenant's guests are
  // Ready first (Step 7: a passkey proven on the platform they use). Without it the
  // guests gate holds the step and every case would be testing the hold.
  const viability = guestsReady(runFixture({ ...W2, snapshot: bare }, { snapshot: bare } as never).viability, bare)
  return { bare, run: runFixture({ ...W2, snapshot: bare }, { snapshot: bare, viability } as never) }
}

const READY_GUEST = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null })
function guestsReady(viability: MfaViability[], snapshot: typeof W2.snapshot): MfaViability[] {
  const guests = new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id))
  return viability.map((v) => (guests.has(v.userId) ? { ...v, readiness: READY_GUEST } : v))
}

const pairScope = (): Parameters<typeof applyProgress>[7] => ({
  groupMembers: Object.fromEntries([...W2.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), [...g.memberIds]])),
  activePeople: activePeopleIds(W2.snapshot, W2.snapshot.asOf, notPeopleIds(W2.mapping)),
})

const at = (daysAgo: number): string => new Date(Date.parse(W2.snapshot.asOf) - daysAgo * 86_400_000).toISOString()

/**
 * The pinned pair, addressed to people a scan can count.
 *
 * Both of the baseline's guests policies are addressed to *kinds of external
 * user*, and no directory holds a list of those. The evidence gate's coverage
 * question — every active person this policy reaches, seen at least once — then
 * has no denominator, so it never closes and such a policy is never ready to
 * enforce however long it is watched (roadmap/tracking.ts `trackedScope`, and
 * ui/surfaces/readyToEnforce.test.ts, which is where that gate is asserted).
 *
 * The contract here is the other one — one step is not one policy — and every
 * case below needs members that *can* be ready in order to say anything about
 * how the pair aggregates them. So the pair is deployed over a scope this tenant
 * can settle, and the plan's own operation is addressed the same way: a member
 * deployed as planned is one whose object holds what its operation asks for.
 */
function countableScope(body: PairRow): PairRow {
  const out = structuredClone(body)
  const conditions = out.conditions as PairRow
  conditions.users = { ...(conditions.users as PairRow), includeGuestsOrExternalUsers: null, includeUsers: [...pairPeople()] }
  return out
}

/** One member's policy as the tenant would hold it: the body the plan submits, deployed. */
const deployed = (op: PolicyOperation, id: string, state: string, over: PairRow = {}): PairRow => ({
  ...countableScope(op.body as PairRow),
  id,
  state,
  createdDateTime: at(30),
  modifiedDateTime: at(30),
  ...over,
})

/** What a scan `daysAgo` would have recorded of that policy. */
const watching = (row: PairRow, daysAgo: number, over: Partial<StepObservation> = {}): StepObservation => ({
  artifact: artifactIdOf(String(row.id)),
  state: observedStateOf(String(row.state)),
  semantics: semanticsOf(row),
  fields: semanticFieldsOf(row),
  firstSeenAt: at(daysAgo),
  since: 'first-scan',
  lastSeenAt: at(daysAgo),
  evidenceAt: null,
  ...over,
})

const held = (members: Record<string, StepObservation>, unattributed: StepObservation | null = null): Record<string, StepObservationRecord> => ({ [GUESTS]: { members, unattributed } })

/**
 * One pair member's own window, watched clean: Microsoft's records of that policy
 * and no other's. Readiness is both gates (roadmap/tracking.ts `gates`), so a
 * member a case means to be *ready* is handed records as well as days — a
 * thirty-day-old policy nobody has any evidence about is not ready, and a case
 * that leant on the calendar alone would be asserting that it is.
 */
const cleanPair = (policyId: string, firstReportOnlyAt: string | null = null): unknown => cleanRecords(policyId, pairPeople(), firstReportOnlyAt)

/** The same coverage with the guests goal delivered: the goal-delivery contract agreeing. */
function inPlaceCoverage(c: ReturnType<typeof runFixture>['coverage']): ReturnType<typeof runFixture>['coverage'] {
  return { ...c, results: c.results.map((r) => (r.goal.id === 'guests-mfa' ? { ...r, status: 'enforced', verdict: 'inPlace' } : r)) as typeof c.results }
}

/**
 * A scan of demo-week2 whose Conditional Access policies are whatever the case
 * plants, over the pair the generator produced from the same tenant with none.
 * The whole engine, not a helper.
 */
function pairScan(
  rowsFor: (a: PolicyOperation, b: PolicyOperation) => PairRow[],
  prior: Record<string, StepObservationRecord> = {},
  opts: { evidence?: unknown[]; inPlace?: boolean } = {},
): Step {
  const { bare, run } = pairPlan()
  const ops = (run.steps.find((s) => s.id === GUESTS) as Step).action.resolution!.policies
  // The plan asks for what `deployed` plants: the same rewrite, on this run's own
  // operations, so a case about members is not also a case about a member that
  // holds something its operation did not ask for.
  for (const op of ops) op.body = countableScope(op.body as PairRow) as typeof op.body
  const snapshot = structuredClone(bare)
  snapshot.config.caPolicies = { status: 'ok', reason: null, rows: rowsFor(ops[0], ops[1]) } as typeof snapshot.config.caPolicies
  if (opts.evidence) snapshot.evidencePolicyResults = opts.evidence as typeof snapshot.evidencePolicyResults
  applyProgress(run.steps, snapshot, opts.inPlace ? inPlaceCoverage(run.coverage) : run.coverage, W2.planId, undefined, null, prior, pairScope())
  return run.steps.find((s) => s.id === GUESTS) as Step
}

/** The step's two members, in the baseline's order. */
const pairOps = (): PolicyOperation[] => (pairPlan().run.steps.find((s) => s.id === GUESTS) as Step).action.resolution!.policies
const memberOf = (step: Step, key: string) => step.tracking?.members.find((m) => m.key === key)
const observationOf = (step: Step, key: string) => step.state.members.find((m) => m.key === key)?.change

test('pair 1: the real default baseline implements the guests goal with two required members', () => {
  // The guard on every case below: if this step ever becomes one policy again,
  // the pair tests would pass by testing nothing.
  assert.equal(PINNED_GOAL_MAP['guests-mfa'].length, 2, 'the pinned baseline maps guests-mfa to two policies')
  const step = pairPlan().run.steps.find((s) => s.id === GUESTS) as Step
  const members = requiredMembers(step)
  assert.equal(members.length, 2, 'so the step has two required policy members')
  assert.notEqual(members[0].key, members[1].key, 'and they are two identities, not one')
  // The identity is the baseline's own key for the policy, not the tenant's
  // object, not the position, and not the display name.
  assert.deepEqual(members.map((m) => m.key), PINNED_GOAL_MAP['guests-mfa'].map((k, i) => memberKeyOf(k, i)))
  // Each member's created policy carries its own tag, so the two are told apart
  // by what the plan wrote on them.
  const [a, b] = step.action.resolution!.policies
  assert.match(String((a.body as PairRow).description), new RegExp(`\\[IAMAI:${W2.planId}:${GUESTS}:${a.memberKey}\\]`))
  assert.match(String((b.body as PairRow).description), new RegExp(`\\[IAMAI:${W2.planId}:${GUESTS}:${b.memberKey}\\]`))
  assert.notEqual((a.body as PairRow).displayName, (b.body as PairRow).displayName)
})

test('pair 2: two report-only members are two observations, each about its own object', () => {
  const [a, b] = pairOps()
  const step = pairScan((x, y) => [deployed(x, A_ID, 'enabledForReportingButNotEnforced'), deployed(y, B_PAIR_ID, 'enabledForReportingButNotEnforced')])
  assert.equal(step.state.members.length, 2, 'two members, two histories')
  assert.equal(observationOf(step, a.memberKey)?.latest.artifact, artifactIdOf(A_ID))
  assert.equal(observationOf(step, b.memberKey)?.latest.artifact, artifactIdOf(B_PAIR_ID))
  assert.notEqual(observationOf(step, a.memberKey)?.latest.artifact, observationOf(step, b.memberKey)?.latest.artifact, 'neither overwrote the other')
  assert.equal(memberOf(step, a.memberKey)?.policyId, A_ID)
  assert.equal(memberOf(step, b.memberKey)?.policyId, B_PAIR_ID)
  assert.equal(memberOf(step, a.memberKey)?.matchedBy, 'member-tag', 'each found by its own tag')
  assert.equal(memberOf(step, b.memberKey)?.matchedBy, 'member-tag')
  assert.equal(step.state.lifecycle, 'report-only', 'the whole pair is deployed and being watched')
  assert.equal(step.tracking?.policyId, null, 'and no one object is what the step is')
})

test('pair 3: A ready and B not is not a ready pair', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  // A has been watched for thirty days; B was first seen at this scan.
  const step = pairScan(() => [rowA, rowB], held({ [a.memberKey]: watching(rowA, 30) }), { evidence: [cleanPair(A_ID)] })
  assert.equal(memberOf(step, a.memberKey)?.ready, true, 'A has served its own window')
  assert.equal(memberOf(step, b.memberKey)?.ready, false, 'B has served none of one')
  assert.equal(step.state.lifecycle, 'report-only', 'so the pair is still being watched')
  assert.notEqual(step.status, 'ready-to-enforce', 'one ready member cannot make the pair ready')
  assert.equal(memberOf(step, b.memberKey)?.daysInReportOnly, 0, 'and B borrowed none of A’s thirty days')
})

test('pair 4: A ready and B absent is not a deployed pair, and B inherits nothing', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const step = pairScan(() => [rowA], held({ [a.memberKey]: watching(rowA, 30) }), { evidence: [cleanPair(A_ID)] })
  assert.equal(memberOf(step, a.memberKey)?.ready, true, 'A earned its window')
  assert.equal(memberOf(step, b.memberKey)?.policyId, null, 'B’s absence is represented rather than hidden')
  assert.equal(memberOf(step, b.memberKey)?.lifecycle, 'not-deployed')
  assert.equal(observationOf(step, b.memberKey)?.latest.state, 'absent', 'and recorded as an observation of nothing')
  assert.equal(step.state.lifecycle, 'not-deployed', 'a pair with one half deployed has not been deployed')
  assert.notEqual(step.status, 'ready-to-enforce')
  // A's own history is still there, and none of it reached B.
  assert.equal(observationOf(step, a.memberKey)?.latest.firstSeenAt, at(30))
  assert.equal(observationOf(step, b.memberKey)?.latest.firstSeenAt, W2.snapshot.asOf)
  assert.equal(observationOf(step, b.memberKey)?.prior, null, 'B has no prior of its own to speak from')
})

test('pair 5: the pair is ready when every member is ready on its own window', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  const both = held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(rowB, 20) })
  const evidence = [cleanPair(A_ID), cleanPair(B_PAIR_ID)]
  const step = pairScan(() => [rowA, rowB], both, { evidence })
  assert.equal(memberOf(step, a.memberKey)?.ready, true)
  assert.equal(memberOf(step, b.memberKey)?.ready, true)
  assert.equal(step.state.lifecycle, 'ready-to-enforce')
  assert.equal(step.status, 'ready-to-enforce')
  // Both gates participated: the pair's date is the later member's, never the earlier.
  assert.equal(step.tracking?.readyOn, memberOf(step, b.memberKey)?.readyOn, 'ready on the day the last member became ready')
  assert.ok(Date.parse(memberOf(step, a.memberKey)!.readyOn as string) < Date.parse(step.tracking!.readyOn as string))
  // Take either member's window away and the pair is not ready.
  for (const key of [a.memberKey, b.memberKey]) {
    const one = held(Object.fromEntries(Object.entries(both[GUESTS].members).filter(([k]) => k !== key)))
    assert.notEqual(pairScan(() => [rowA, rowB], one, { evidence }).status, 'ready-to-enforce', `${key} alone did not carry the pair`)
  }
})

test('pair 6: A enforced and B ready is a pair to enforce, and not a finished one', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabled')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  const step = pairScan(() => [rowA, rowB], held({ [b.memberKey]: watching(rowB, 30) }), { inPlace: true, evidence: [cleanPair(B_PAIR_ID)] })
  assert.equal(memberOf(step, a.memberKey)?.lifecycle, 'enforced')
  assert.equal(memberOf(step, b.memberKey)?.ready, true)
  assert.equal(step.state.lifecycle, 'ready-to-enforce', 'the remaining member may be enforced')
  assert.equal(step.state.satisfied, false, 'one enforced member does not finish a two-policy goal')
  assert.notEqual(step.status, 'done')
})

test('pair 7: the pair is done when both members are enforced and coverage agrees the goal is in place', () => {
  const [a, b] = pairOps()
  const rows = (x: PolicyOperation, y: PolicyOperation): PairRow[] => [deployed(x, A_ID, 'enabled'), deployed(y, B_PAIR_ID, 'enabled')]
  const done = pairScan(rows, {}, { inPlace: true })
  assert.equal(memberOf(done, a.memberKey)?.lifecycle, 'enforced')
  assert.equal(memberOf(done, b.memberKey)?.lifecycle, 'enforced')
  assert.equal(done.state.lifecycle, 'enforced')
  assert.equal(done.state.satisfied, true)
  assert.equal(done.status, 'done')
  // The same coverage with only one member enforced does not finish it.
  const half = pairScan((x, y) => [deployed(x, A_ID, 'enabled'), deployed(y, B_PAIR_ID, 'disabled')], {}, { inPlace: true })
  assert.notEqual(half.state.lifecycle, 'enforced', 'a disabled half is not an enforced pair')
  assert.notEqual(half.status, 'done')
  // And with the goal not delivered, both members enforced is still not done.
  const uncovered = pairScan(rows)
  assert.equal(uncovered.state.satisfied, false, 'the goal-delivery contract still has to agree')
})

test('pair 8: replacing one member resets that member’s history and no other’s', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  const prior = held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(rowB, 30) })
  // B is deleted and replaced by a different object meaning exactly the same thing.
  const step = pairScan(() => [rowA, { ...rowB, id: B_OTHER_ID }], prior, { evidence: [cleanPair(A_ID)] })
  assert.equal(observationOf(step, a.memberKey)?.continuity, 'continues', 'A is the object it was')
  assert.equal(observationOf(step, a.memberKey)?.latest.firstSeenAt, at(30), 'and keeps the window it earned')
  assert.equal(observationOf(step, b.memberKey)?.changed, 'artifact')
  assert.equal(observationOf(step, b.memberKey)?.continuity, 'reset')
  assert.equal(observationOf(step, b.memberKey)?.latest.firstSeenAt, W2.snapshot.asOf, 'B is watched from this scan')
  assert.equal(memberOf(step, a.memberKey)?.ready, true)
  assert.equal(memberOf(step, b.memberKey)?.ready, false)
  assert.notEqual(step.status, 'ready-to-enforce', 'and A’s completed window does not cover B')
})

test('pair 9: an unexpected rewrite of one member is the whole step’s condition', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  const prior = held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(rowB, 30) })
  // B's grant is replaced with something no operation submits.
  const drifted = { ...rowB, grantControls: { operator: 'OR', builtInControls: ['block'], customAuthenticationFactors: [], termsOfUse: [] } }
  const step = pairScan(() => [rowA, drifted], prior)
  assert.equal(memberOf(step, b.memberKey)?.reviewRequired, true, 'B moved somewhere nobody asked for')
  assert.equal(memberOf(step, a.memberKey)?.reviewRequired, false, 'A is untouched')
  assert.equal(observationOf(step, a.memberKey)?.continuity, 'continues', 'and still healthy')
  assert.equal(step.state.condition, 'review-required', 'a healthy other half does not settle it')
})

test('pair 10: each member is compared against its own operation, never the first', () => {
  // A grants multifactor; B grants an authentication strength. They are different
  // submitted changes, which is what makes this decidable.
  const [a, b] = pairOps()
  assert.notDeepEqual((a.body as PairRow).grantControls, (b.body as PairRow).grantControls, 'the pinned pair asks for two different grants')
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  // B carrying A's grant: not what B's own operation submits.
  const bAsA = { ...rowB, grantControls: structuredClone((a.body as PairRow).grantControls) }

  // 1: B moves into exactly what B's operation submits.
  const landed = pairScan(() => [rowA, rowB], held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(bAsA, 30) }))
  assert.equal(observationOf(landed, b.memberKey)?.changed, 'semantics')
  assert.equal(observationOf(landed, b.memberKey)?.expected, true, 'B reached the value B’s own operation submits')
  assert.equal(observationOf(landed, b.memberKey)?.reviewRequired, false)

  // 2: B moves into what *A's* operation submits. Under a policies[0] intent this
  // was expected; against B's own operation it is a rewrite nobody asked for.
  const wrong = pairScan(() => [rowA, bAsA], held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(rowB, 30) }))
  assert.equal(observationOf(wrong, b.memberKey)?.expected, false, 'A’s intent does not authorise a change to B')
  assert.equal(observationOf(wrong, b.memberKey)?.reviewRequired, true)
  assert.equal(wrong.state.condition, 'review-required')
})

test('pair 11: one shared step tag does not collapse the pair into one policy', () => {
  const [a, b] = pairOps()
  // Two policies created before the tag named the member: they carry the same
  // step tag, and the names the plan gives each member are what tells them apart.
  const legacyTag = `[IAMAI:${W2.planId}:${GUESTS}]`
  const step = pairScan((x, y) => [
    { ...deployed(x, A_ID, 'enabledForReportingButNotEnforced'), description: legacyTag },
    { ...deployed(y, B_PAIR_ID, 'enabledForReportingButNotEnforced'), description: legacyTag },
  ])
  assert.equal(memberOf(step, a.memberKey)?.policyId, A_ID)
  assert.equal(memberOf(step, b.memberKey)?.policyId, B_PAIR_ID)
  assert.equal(memberOf(step, a.memberKey)?.matchedBy, 'member-name')
  assert.equal(new Set(step.tracking!.members.map((m) => m.policyId)).size, 2, 'two distinct artifacts')
  assert.equal(step.state.lifecycle, 'report-only', 'and the pair is deployed')
})

test('pair 12: a pair the tag cannot tell apart is left unresolved, never guessed', () => {
  const [a, b] = pairOps()
  const legacyTag = `[IAMAI:${W2.planId}:${GUESTS}]`
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  const prior = held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(rowB, 30) })
  const renamed = [
    { ...rowA, description: legacyTag, displayName: 'Something somebody renamed' },
    { ...rowB, description: legacyTag, displayName: 'Something else entirely' },
  ]
  // The association itself: two tagged policies, and nothing says which member
  // either of them is.
  const { bare, run } = pairPlan()
  const snapshot = structuredClone(bare)
  snapshot.config.caPolicies = { status: 'ok', reason: null, rows: renamed } as typeof snapshot.config.caPolicies
  const matched = matchMembers(run.steps.find((x) => x.id === GUESTS) as Step, snapshot, run.coverage, W2.planId)
  assert.deepEqual(matched.map((m) => m.policy?.id ?? null), [null, null], 'no arbitrary first policy wins')
  assert.ok(matched.every((m) => m.ambiguous), 'both members say so rather than guessing')

  // With the record of the last scan carried in, nothing is guessed either: the
  // record names the very object each member was delivered by, and a rename
  // between two scans does not move a member off the object it owns (S1
  // ownership invariant, tracking.ts matchMembers stage 0).
  const step = pairScan(() => renamed, prior)
  assert.deepEqual(
    step.state.members.map((m) => m.change.latest.artifact),
    [artifactIdOf(A_ID), artifactIdOf(B_PAIR_ID)],
    'each member keeps the object its own record names',
  )
  assert.ok(step.tracking?.members.every((m) => m.matchedBy === 'owned'), 'and says the record is what ties it')
  assert.ok(step.state.members.every((m) => m.change.continuity === 'continues'), 'a rename is not a change, so the history is its own')
  assert.equal(step.state.lifecycle, 'report-only')
  // Without a record, the same two objects are nobody's (asserted above).
  const bare2 = pairScan(() => renamed, {})
  assert.ok(bare2.state.members.every((m) => m.change.latest.artifact === null), 'and with no record no member claims an object')
  assert.equal(bare2.state.lifecycle, 'not-deployed')

  // Two policies carrying one member's own tag are that member's ambiguity.
  const twice = structuredClone(bare)
  twice.config.caPolicies = {
    status: 'ok',
    reason: null,
    rows: [deployed(a, A_ID, 'enabledForReportingButNotEnforced'), { ...deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced'), description: String((a.body as PairRow).description) }],
  } as typeof twice.config.caPolicies
  const doubled = matchMembers(pairPlan().run.steps.find((x) => x.id === GUESTS) as Step, twice, run.coverage, W2.planId)
  assert.equal(doubled[0].ambiguous, true, 'two candidates for one member is not a match')
  assert.equal(doubled[0].policy, null)
})

test('pair 13: one member’s Microsoft evidence closes no other member’s gate', () => {
  const [a, b] = pairOps()
  const provenAt = at(30)
  const step = pairScan(
    (x, y) => [deployed(x, A_ID, 'enabledForReportingButNotEnforced'), deployed(y, B_PAIR_ID, 'enabledForReportingButNotEnforced')],
    {},
    { evidence: [cleanPair(A_ID, provenAt)] },
  )
  assert.equal(memberOf(step, a.memberKey)?.reportOnlyAt, provenAt, 'A’s own record dates A')
  assert.equal(memberOf(step, a.memberKey)?.reportOnlyAtSource, 'sign-in-evidence')
  assert.equal(memberOf(step, a.memberKey)?.ready, true, 'and carries A through its window')
  assert.equal(memberOf(step, b.memberKey)?.reportOnlyAt, W2.snapshot.asOf, 'B has records of its own: none')
  assert.equal(memberOf(step, b.memberKey)?.reportOnlyAtSource, 'first-seen-by-iamai')
  assert.equal(memberOf(step, b.memberKey)?.ready, false)
  assert.notEqual(step.status, 'ready-to-enforce', 'so the pair is not ready because A is')
  assert.equal(step.tracking?.reportOnlyAt, W2.snapshot.asOf, 'the pair has been watched since its later member')
})

test('pair 16: a record from before members is attributed on identity, and never copied to both', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')

  // The stored record names an object, and exactly one member is delivered by it.
  const attributable = pairScan(() => [rowA, rowB], held({}, watching(rowA, 30)))
  assert.equal(observationOf(attributable, a.memberKey)?.latest.firstSeenAt, at(30), 'it belongs to A, and A keeps it')
  assert.equal(observationOf(attributable, a.memberKey)?.continuity, 'continues')
  assert.equal(observationOf(attributable, b.memberKey)?.prior, null, 'B inherits nothing')
  assert.equal(observationOf(attributable, b.memberKey)?.latest.firstSeenAt, W2.snapshot.asOf)
  assert.equal(memberOf(attributable, b.memberKey)?.ready, false)
  assert.notEqual(attributable.status, 'ready-to-enforce', 'so one attributed window does not make the pair ready')

  // A record that names no object proves no member identity at all.
  const legacy = observationsFrom({ reportOnlySeen: { [GUESTS]: at(30) } })
  const blind = pairScan(() => [rowA, rowB], legacy)
  assert.ok(blind.state.members.every((m) => m.change.prior === null), 'no member takes a record that names nobody')
  assert.ok(blind.state.members.every((m) => m.change.latest.firstSeenAt === W2.snapshot.asOf), 'and both are watched from this scan')
  assert.notEqual(blind.status, 'ready-to-enforce')
  // Nor does an object no member is delivered by.
  const foreign = pairScan(() => [rowA, rowB], held({}, watching({ ...rowA, id: B_OTHER_ID }, 30)))
  assert.ok(foreign.state.members.every((m) => m.change.prior === null), 'an object nothing here is does not attribute either')
})

test('pair 17: the record keeps both members apart, and carries no tenant id', () => {
  const [a, b] = pairOps()
  const rowA = deployed(a, A_ID, 'enabledForReportingButNotEnforced')
  const rowB = deployed(b, B_PAIR_ID, 'enabledForReportingButNotEnforced')
  const step = pairScan(() => [rowA, rowB], held({ [a.memberKey]: watching(rowA, 30), [b.memberKey]: watching(rowB, 20) }))
  const kept = observationsOf([step])
  assert.deepEqual(Object.keys(kept[GUESTS].members).sort(), [a.memberKey, b.memberKey].sort(), 'one record per member')
  assert.equal(kept[GUESTS].unattributed, null)
  assert.equal(kept[GUESTS].members[a.memberKey].artifact, artifactIdOf(A_ID))
  assert.equal(kept[GUESTS].members[b.memberKey].artifact, artifactIdOf(B_PAIR_ID))
  assert.notEqual(kept[GUESTS].members[a.memberKey].firstSeenAt, kept[GUESTS].members[b.memberKey].firstSeenAt, 'two clocks')
  assert.deepEqual(observationsFrom({ observations: kept }), kept, 'and it reads back as what it holds')
  const serialised = JSON.stringify(kept)
  for (const id of [A_ID, B_PAIR_ID]) assert.equal(serialised.includes(id), false, 'the raw policy id is not persisted')
  // Reloaded, the two members are still the two members.
  const again = pairScan(() => [rowA, rowB], observationsFrom({ observations: kept }))
  assert.equal(observationOf(again, a.memberKey)?.latest.firstSeenAt, at(30))
  assert.equal(observationOf(again, b.memberKey)?.latest.firstSeenAt, at(20))
})

// ---- 14 + 15: a step with one policy is what it always was ----

test('single 14: every one-policy step has one member, and the step’s tracking is that member', () => {
  let checked = 0
  for (const { f: { name }, r } of runs) {
    for (const s of r.steps) {
      if (s.kind !== 'create' && s.kind !== 'adjust') continue
      const ops = s.action.resolution?.policies ?? []
      if (ops.length > 1) continue
      assert.deepEqual(s.state.members.map((m) => m.key), [SOLE_MEMBER], `${name}/${s.id}: one policy, one member, under a key a re-pin cannot move`)
      assert.equal(s.state.observation, s.state.members[0].change, `${name}/${s.id}: and the step's observation is that member's`)
      const t = s.tracking
      if (!t) continue
      const m = t.members[0]
      assert.equal(t.members.length, 1)
      // Field for field, the aggregate is the member: nothing about a one-policy
      // step reads differently than it did before members existed.
      assert.deepEqual(
        [t.policyId, t.policyName, t.state, t.reportOnlyAt, t.reportOnlyAtSource, t.enforcedAt, t.enforcedAtSource, t.readyOn, t.readyNow, t.daysInReportOnly, t.seenInScope, t.activeInScope, t.signIns, t.failures, t.evidenceQuality],
        [m.policyId, m.policyName, m.state, m.reportOnlyAt, m.reportOnlyAtSource, m.enforcedAt, m.enforcedAtSource, m.readyOn, m.readyNow, m.daysInReportOnly, m.seenInScope, m.activeInScope, m.signIns, m.failures, m.evidenceQuality],
        `${name}/${s.id}`,
      )
      checked += 1
    }
  }
  assert.ok(checked > 10, `the fixtures track one-policy steps: ${checked}`)
})

test('single 15: a stored observation from before members belongs to a one-policy step’s only member', () => {
  // The migration is exact where the step has one member, because a step with one
  // member has one history and it can only be that member's.
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  const flat = { artifact: artifactIdOf(demoPolicyId()), state: 'report-only' as const, semantics: '', fields: {}, firstSeenAt: seenAt, since: 'first-scan' as const, lastSeenAt: seenAt, evidenceAt: null }
  const loaded = observationsFrom({ observations: { [ADMINS]: flat } })
  assert.deepEqual(loaded[ADMINS], { members: {}, unattributed: flat }, 'a flat record loads as one nobody has attributed yet')
  assert.deepEqual(priorFor(loaded[ADMINS], SOLE_MEMBER, flat.artifact, true), flat, 'and a step with one member takes it')
  assert.equal(priorFor(loaded[ADMINS], SOLE_MEMBER, artifactIdOf('some-other-policy'), false), null, 'and a step with two members takes it only where the object proves whose it is')
  assert.equal(priorFor(loaded[ADMINS], SOLE_MEMBER, null, false), null, 'never for a member with no object at all')
  const s = rescan((row, snapshot) => {
    snapshot.evidencePolicyResults = [cleanRecords(String(row.id), demoPeople())] as typeof snapshot.evidencePolicyResults
  }, loaded, demoScope())
  assert.equal(s.state.observation?.prior?.firstSeenAt, seenAt, 'the window it earned carries over')
  assert.equal(s.state.observation?.continuity, 'continues', 'because it names the object this step is delivered by')
  assert.equal(s.tracking?.readyNow, true)
  // And it is written back in the member shape, so the next scan reads it there.
  assert.equal(observationsOf([s])[ADMINS].unattributed, null)
  assert.equal(soleOf(observationsOf([s]), ADMINS).firstSeenAt, seenAt)
})

test('the pair’s members are matched one object each, and never one object twice', () => {
  const [a, b] = pairOps()
  const { bare, run } = pairPlan()
  const step = run.steps.find((s) => s.id === GUESTS) as Step
  const snapshot = structuredClone(bare)
  // One policy carrying A's tag and B's name: it can be one member, not both.
  snapshot.config.caPolicies = { status: 'ok', reason: null, rows: [{ ...deployed(a, A_ID, 'enabledForReportingButNotEnforced'), displayName: (b.body as PairRow).displayName }] } as typeof snapshot.config.caPolicies
  const matched = matchMembers(step, snapshot, run.coverage, W2.planId)
  assert.equal(matched.length, 2)
  assert.equal(matched.filter((m) => m.policy !== null).length, 1, 'one object satisfies one member')
  assert.equal(new Set(matched.map((m) => m.policy?.id).filter(Boolean)).size, 1)
})
