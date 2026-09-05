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
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyProgress } from './progress.ts'
import { stepIdForGoal } from './generate.ts'
import { conditionFor, initialState, nextMilestone, projectStatus, raiseCondition, setState, stateForStatus } from './lifecycle.ts'
import type { Condition, Lifecycle, StepState } from './lifecycle.ts'
import { observationsFrom, observe, observedStateOf, semanticsOf } from './observation.ts'
import type { StepObservation } from './observation.ts'
import { observationsOf } from './tracking.ts'
import { statusOf } from '../ui/surfaces/statusWord.ts'
import type { Step, StepStatus } from './types.ts'

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
    const deploys = s.kind === 'create' || s.kind === 'adjust'
    if (deploys && s.state.lifecycle === null) wrong.push(`${name}/${s.id}: a ${s.kind} step with no lifecycle`)
    if (!deploys && s.state.lifecycle !== null) wrong.push(`${name}/${s.id}: a ${s.kind} step forced into the Conditional Access lifecycle as ${s.state.lifecycle}`)
  }
  assert.deepEqual(wrong, [], 'supporting steps are not stages of a policy nobody is deploying')
  // All four stages are reachable from the fixtures, so the assertions above are
  // about a lifecycle that is actually being used.
  const seen = new Set(everyStep().map(({ s }) => s.state.lifecycle))
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

test('nothing reads Enforced unless its own policy is enforced', () => {
  const wrong: string[] = []
  for (const { name, s } of everyStep()) {
    const word = statusOf(s).word
    if (word === 'Enforced' && s.state.lifecycle !== 'enforced') wrong.push(`${name}/${s.id}: Enforced at stage ${s.state.lifecycle}`)
    if (word === 'In place' && s.state.lifecycle === 'enforced') wrong.push(`${name}/${s.id}: In place on an enforced policy`)
    // A preservation result never carries a stage the step has no policy for.
    if (s.state.inPlace && !(s.kind === 'create' || s.kind === 'adjust') && s.state.lifecycle !== null) wrong.push(`${name}/${s.id}: an existing control given a policy stage`)
  }
  assert.deepEqual(wrong, [])
  assert.ok(everyStep().some(({ s }) => statusOf(s).word === 'In place'), 'the fixtures have something already in place')
  assert.ok(everyStep().some(({ s }) => statusOf(s).word === 'Enforced'), 'the fixtures have something enforced')
})

// ---- 4: no invented history ----

test('every date the tracking claims names where it came from', () => {
  const wrong: string[] = []
  for (const { f: { name }, r } of runs) {
    const rows = (r.input.snapshot.config.caPolicies?.rows ?? []) as { id?: string; createdDateTime?: string; modifiedDateTime?: string }[]
    for (const s of r.steps) {
      const t = s.tracking
      if (!t) continue
      const where = `${name}/${s.id}`
      if (t.reportOnlyAt === null) assert.equal(t.reportOnlyAtSource, null, `${where}: a source for a date that is not there`)
      else {
        assert.ok(t.reportOnlyAtSource !== null, `${where}: in report-only since a date with no provenance`)
        const first = s.state.observation?.latest.firstSeenAt ?? null
        const evidence = r.input.snapshot.evidencePolicyResults.find((p) => p.policyId === t.policyId)?.firstReportOnlyAt ?? null
        if (t.reportOnlyAtSource === 'first-seen-by-iamai') assert.equal(t.reportOnlyAt, first, `${where}: a first sighting IAMAI did not make`)
        else assert.equal(t.reportOnlyAt, evidence, `${where}: a sign-in date the records do not hold`)
      }
      if (t.enforcedAt === null) assert.equal(t.enforcedAtSource, null, `${where}: a source for a date that is not there`)
      else {
        const row = rows.find((p) => p.id === t.policyId)
        const known = [row?.modifiedDateTime ?? null, row?.createdDateTime ?? null]
        if (t.enforcedAtSource === 'policy-modified') assert.equal(t.enforcedAt, row?.modifiedDateTime ?? null, `${where}`)
        else if (t.enforcedAtSource === 'policy-created') assert.equal(t.enforcedAt, row?.createdDateTime ?? null, `${where}`)
        else if (t.enforcedAtSource !== 'carried-forward') wrong.push(`${where}: enforced on ${t.enforcedAt} from nowhere (${String(t.enforcedAtSource)}), known: ${known.join(', ')}`)
      }
    }
  }
  assert.deepEqual(wrong, [])
})

test('a first sighting is IAMAI’s, and only a record of the policy being evaluated is Microsoft’s', () => {
  const at = '2026-09-05T00:00:00.000Z'
  const first = observe(null, { state: 'report-only', semantics: 'aaaa', at, evidenceAt: null })
  assert.equal(first.changed, 'first-scan')
  assert.equal(first.latest.firstSeenAt, at)
  assert.equal(first.latest.since, 'first-scan', 'the first time IAMAI looked says nothing about when the state began')
  assert.equal(first.latest.evidenceAt, null)
  assert.equal(first.expected, false, 'a first sighting is nothing the plan can claim to have asked for')
  // The one transition a tenant proves: a sign-in evaluated under the policy.
  const proven = observe(null, { state: 'report-only', semantics: 'aaaa', at, evidenceAt: '2026-08-20T00:00:00.000Z' })
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
  const prior: StepObservation = { state: 'report-only', semantics: '', firstSeenAt: '2026-08-20T00:00:00.000Z', since: 'first-scan', lastSeenAt: '2026-08-20T00:00:00.000Z', evidenceAt: null }
  const now = observe(prior, { state: 'report-only', semantics: 'abcd', at: '2026-09-05T00:00:00.000Z' })
  assert.equal(now.changed, 'none')
  assert.equal(now.invalidated, false, 'a record written before the fingerprint existed is not a rewrite')
  assert.equal(now.latest.firstSeenAt, prior.firstSeenAt, 'the window it earned survives the upgrade')
})

test('a material change invalidates the observation; a state that moves the way the plan asked does not', () => {
  const prior: StepObservation = { state: 'report-only', semantics: 'aaaa', firstSeenAt: '2026-08-20T00:00:00.000Z', since: 'first-scan', lastSeenAt: '2026-08-28T00:00:00.000Z', evidenceAt: '2026-08-10T00:00:00.000Z' }
  const at = '2026-09-05T00:00:00.000Z'

  const same = observe(prior, { state: 'report-only', semantics: 'aaaa', at, evidenceAt: '2026-08-10T00:00:00.000Z' })
  assert.equal(same.changed, 'none')
  assert.equal(same.invalidated, false)
  assert.equal(same.latest.firstSeenAt, prior.firstSeenAt)
  assert.equal(same.latest.evidenceAt, '2026-08-10T00:00:00.000Z', 'the evidence still holds while nothing material moved')

  const turnedOn = observe(prior, { state: 'enforced', semantics: 'aaaa', at })
  assert.equal(turnedOn.changed, 'state')
  assert.equal(turnedOn.expected, true, 'report-only to enforced with the same policy is the plan landing')
  assert.equal(turnedOn.invalidated, false, 'new evidence does not reset observation')
  assert.equal(turnedOn.latest.since, 'observed-change')

  const turnedOff = observe(prior, { state: 'disabled', semantics: 'aaaa', at })
  assert.equal(turnedOff.expected, false, 'a policy going backwards is not what the plan asked for')

  const rewritten = observe(prior, { state: 'report-only', semantics: 'bbbb', at, evidenceAt: '2026-08-10T00:00:00.000Z' })
  assert.equal(rewritten.changed, 'semantics')
  assert.equal(rewritten.invalidated, true)
  assert.equal(rewritten.latest.firstSeenAt, at, 'a policy that was rewritten has been watched since it was rewritten')
  assert.equal(rewritten.latest.evidenceAt, null, 'records from before the rewrite are about the policy it used to be')
  // And the next scan does not let that old evidence back in.
  const after = observe(rewritten.latest, { state: 'report-only', semantics: 'bbbb', at: '2026-09-06T00:00:00.000Z', evidenceAt: '2026-08-10T00:00:00.000Z' })
  assert.equal(after.latest.evidenceAt, null)
  assert.equal(after.latest.firstSeenAt, at, 'the clock keeps running from the rewrite, not from this scan')

  // A change the step's own operation asked for is expected even when the
  // semantics moved, because the plan is what moved them.
  const landed = observe(prior, { state: 'report-only', semantics: 'bbbb', at, intended: 'bbbb' })
  assert.equal(landed.expected, true)
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
const ADMINS = stepIdForGoal('admins-phishing-resistant')
const TEN_DAYS = 10 * 86_400_000

function demoObservation(over: Partial<StepObservation> = {}): Record<string, StepObservation> {
  const run = runFixture(DEMO)
  const step = run.steps.find((s) => s.id === ADMINS)!
  const row = ((DEMO.snapshot.config.caPolicies?.rows ?? []) as { id?: string }[]).find((p) => p.id === step.tracking?.policyId)
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  return { [ADMINS]: { state: 'report-only', semantics: semanticsOf(row as Record<string, unknown>), firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null, ...over } }
}

test('a policy watched for its whole window is ready to enforce; the same policy rewritten is not', () => {
  const kept = runFixture(DEMO)
  applyProgress(kept.steps, DEMO.snapshot, kept.coverage, DEMO.planId, undefined, null, demoObservation())
  const watched = kept.steps.find((s) => s.id === ADMINS)!
  assert.equal(watched.state.lifecycle, 'ready-to-enforce')
  assert.equal(watched.status, 'ready-to-enforce', 'the word follows the stage')
  assert.equal(watched.state.observation?.changed, 'none')

  const rewritten = runFixture(DEMO)
  applyProgress(rewritten.steps, DEMO.snapshot, rewritten.coverage, DEMO.planId, undefined, null, demoObservation({ semantics: 'deadbeef' }))
  const s = rewritten.steps.find((x) => x.id === ADMINS)!
  assert.equal(s.state.observation?.invalidated, true)
  assert.equal(s.state.lifecycle, 'report-only', 'watched from here, not ready to enforce')
  // Review required, unless something harder already binds the step: the two
  // axes do not overwrite each other, the more binding condition wins.
  assert.ok(s.state.condition === 'review-required' || s.state.condition === 'blocked', s.state.condition)
  assert.equal(s.tracking?.reportOnlyAt, DEMO.snapshot.asOf, 'the window starts again at the scan that noticed')
  assert.equal(s.tracking?.reportOnlyAtSource, 'first-seen-by-iamai')
  assert.equal(statusOf(s).word, 'Report-only', 'nothing new on screen: the condition is its own axis')
})

test('a rename between two scans changes nothing the plan is waiting on', () => {
  const run = runFixture(DEMO)
  const before = run.steps.find((s) => s.id === ADMINS)!
  const snapshot = structuredClone(DEMO.snapshot)
  const rows = (snapshot.config.caPolicies?.rows ?? []) as { id?: string; displayName?: string; modifiedDateTime?: string }[]
  const row = rows.find((p) => p.id === before.tracking?.policyId)!
  row.displayName = `${row.displayName ?? ''} (renamed)`
  row.modifiedDateTime = snapshot.asOf
  applyProgress(run.steps, snapshot, run.coverage, DEMO.planId, undefined, null, demoObservation())
  const after = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(after.state.observation?.changed, 'none')
  assert.equal(after.state.observation?.invalidated, false)
  assert.equal(after.state.lifecycle, 'ready-to-enforce', 'the window a rename cannot touch')
})

test('a record written before this contract keeps the window it earned', () => {
  const seenAt = new Date(Date.parse(DEMO.snapshot.asOf) - TEN_DAYS).toISOString()
  const migrated = observationsFrom({ reportOnlySeen: { [ADMINS]: seenAt } })
  assert.deepEqual(migrated[ADMINS], { state: 'report-only', semantics: '', firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null })
  const run = runFixture(DEMO)
  applyProgress(run.steps, DEMO.snapshot, run.coverage, DEMO.planId, undefined, null, migrated)
  const s = run.steps.find((x) => x.id === ADMINS)!
  assert.equal(s.tracking?.reportOnlyAt, seenAt)
  assert.equal(s.state.lifecycle, 'ready-to-enforce', 'the upgrade did not restart the clock')
  // A record of this vintage is read once and written back in the new shape.
  const kept = observationsOf(run.steps)
  assert.equal(kept[ADMINS].semantics.length, 8, 'and the fingerprint is recorded from here on')
  assert.deepEqual(observationsFrom({ observations: kept }), kept, 'what the record holds reads back as what it holds')
})

test('the observation the record keeps is the one history a regeneration cannot repeat', () => {
  for (const { f: { name }, r } of runs) {
    const kept = observationsOf(r.steps)
    for (const s of r.steps) {
      const deploys = s.kind === 'create' || s.kind === 'adjust'
      assert.equal(s.id in kept, deploys, `${name}/${s.id}: a ${s.kind} step ${deploys ? 'should' : 'should not'} be observed`)
      if (!deploys) continue
      assert.equal(kept[s.id].firstSeenAt, r.input.snapshot.asOf, `${name}/${s.id}: a first scan sees everything for the first time`)
      assert.equal(kept[s.id].state, observedStateOf(((r.input.snapshot.config.caPolicies?.rows ?? []) as { id?: string; state?: string }[]).find((p) => p.id === s.tracking?.policyId)?.state ?? null))
    }
    assert.deepEqual(observationsFrom({ observations: kept }), kept, `${name}: the record round-trips`)
  }
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
    if (s.state.lifecycle === 'report-only' && !s.state.satisfied && m.at !== (s.tracking?.readyOn ?? null)) wrong.push(`${where}: watched until a date the tracking does not hold`)
    if (s.status === 'blocked' && s.state.condition !== 'baseline-conflict' && m.gatedBy !== s.blockedReason) wrong.push(`${where}: a milestone gated by something other than the reason the row shows`)
  }
  assert.deepEqual(wrong, [])
  const kinds = new Set(everyStep().map(({ s }) => nextMilestone(s).kind))
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
