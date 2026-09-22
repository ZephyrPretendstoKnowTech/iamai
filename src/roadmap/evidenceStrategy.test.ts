// User Action readiness (roadmap/evidenceStrategy.ts). Microsoft does not
// evaluate Conditional Access policies scoped to User Actions in report-only,
// so a User Action policy's readiness is its configuration, never report-only
// sign-in records that cannot arrive. Every other policy stays on its records.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evidenceStrategyOf, stepEvidenceStrategy, userActionsOf } from './evidenceStrategy.ts'
import { evidenceFor } from './evidence.ts'
import { gates } from './tracking.ts'
import { readyBasis } from '../derive/readyWhen.ts'
import type { ReadyWhen } from '../derive/readyWhen.ts'
import { doneWhenTemplates } from '../ui/surfaces/doneWhen.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { engine, content } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Step } from './types.ts'

const REGISTER_DEVICE = { conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: [], includeUserActions: ['urn:user:registerdevice'] } } }
const ALL_APPS = { conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'], includeUserActions: [] } } }

test('a policy scoped to a User Action is read on its configuration; one on applications on its records', () => {
  assert.deepEqual(userActionsOf(REGISTER_DEVICE), ['urn:user:registerdevice'])
  assert.equal(evidenceStrategyOf(REGISTER_DEVICE), 'configuration')
  assert.equal(evidenceStrategyOf({ conditions: { applications: { includeUserActions: ['urn:user:registersecurityinfo'] } } }), 'configuration')
  assert.equal(evidenceStrategyOf(ALL_APPS), 'sign-in-records')
  for (const notAPolicy of [null, undefined, 'x', [], {}, { conditions: null }]) assert.equal(evidenceStrategyOf(notAPolicy), 'sign-in-records')
})

const small = runFixture(fixture('small'))
const pilot = small.steps.find((s) => s.id === 's-goal-device-registration-mfa') as Step
const snapshot = { asOf: '2026-09-10T00:00:00.000Z', users: [], sources: { signInEvidence: { status: 'ok', coveredWindow: { from: '2026-08-11T00:00:00.000Z', to: '2026-09-10T00:00:00.000Z' }, reason: null } } } as unknown as TenantSnapshot
const SINCE = '2026-09-09T00:00:00.000Z'

test('a report-only User Action policy does not wait for records Microsoft never writes', () => {
  const g = gates(pilot, { id: 'p', state: 'enabledForReportingButNotEnforced', ...REGISTER_DEVICE } as never, snapshot, undefined, SINCE, {}, null)
  assert.equal(g.evidenceStrategy, 'configuration')
  assert.equal(g.readyNow, true, 'the configuration strategy still waits on sign-in evidence')
  assert.equal(g.readyOn, SINCE, 'an observation window was invented for a policy nobody observes')
  // Nothing about records is claimed either way: none counted, none failing is unknown, not zero.
  assert.equal(g.signIns, 0)
  assert.equal(g.failures, null)
  assert.equal(g.windowRead, false)
  // Not in report-only is not ready, whatever the policy is.
  assert.equal(gates(pilot, { id: 'p', state: 'enabled', ...REGISTER_DEVICE } as never, snapshot, undefined, null, {}, null).readyNow, false)
})

test('an ordinary policy stays observation-driven: no records is not a clean window', () => {
  const g = gates(pilot, { id: 'p', state: 'enabledForReportingButNotEnforced', ...ALL_APPS } as never, snapshot, undefined, SINCE, {}, null)
  assert.equal(g.evidenceStrategy, undefined)
  assert.equal(g.readyNow, false)
  assert.equal(g.failures, null)
})

test('the readiness basis and the Done-when say configuration, and never a record count, for a User Action step', () => {
  const ready: ReadyWhen = { kind: 'now', date: SINCE, days: 1, failures: null, seen: null, people: null, read: false, configuration: true }
  assert.equal(readyBasis(ready), engine.tracking.readyConfigured)
  assert.doesNotMatch(readyBasis(ready) ?? '', /failures/)
  assert.equal(readyBasis({ ...ready, configuration: false }), fillText(engine.tracking.readyNow, { n: 1 }))

  assert.equal(stepEvidenceStrategy(pilot), 'configuration', 'the device-registration policy is not read as a User Action step')
  const lines = doneWhenTemplates(pilot, ['{policyDoneWhen}']).map(String)
  const shared = content.shared as Record<string, string[]>
  assert.ok(lines.includes(shared.policyDoneWhenConfiguration[0]), 'the configuration completion is missing')
  for (const recordLine of shared.policyDoneWhen.slice(0, 2)) assert.equal(lines.includes(recordLine), false, `a User Action step still waits on: ${recordLine}`)
  // The after-enforcement line is not a report-only claim, and stays.
  assert.ok(lines.includes(shared.policyDoneWhen[2]))

  const ordinary = small.steps.find((s) => (s.action.resolution?.policies ?? []).length > 0 && stepEvidenceStrategy(s) === 'sign-in-records')
  assert.ok(ordinary, 'no ordinary policy step in the small fixture to compare against')
  assert.deepEqual(doneWhenTemplates(ordinary, ['{policyDoneWhen}']).map(String).slice(0, 2), shared.policyDoneWhen.slice(0, 2))
})

test('an open observation says why it has not completed: the people it stopped, or the records it could not read', () => {
  // `Evidence.lines` is this type's own field for the reason and was never
  // written, on any goal, on any tenant — while `affectedUserIds` beside it
  // held the four hundred people a report-only policy had stopped. The tile
  // read neither, so it said "Review the available records and the remaining
  // evidence requirements" over both of the cases below: over a tenant whose
  // sign-in source refused every read, where the window can NEVER complete,
  // and over a tenant where the records were read and were the refusal.
  const snapshotWith = (over: Partial<TenantSnapshot>): TenantSnapshot => ({ ...fixture('large').snapshot, ...over } as TenantSnapshot)

  // 1. The source refused. Nothing about waiting longer changes this, and the
  //    sentence says so rather than asking for a review of records that do not exist.
  const blind = evidenceFor('block-auth-transfer', snapshotWith({
    sources: { ...fixture('large').snapshot.sources, signInEvidence: { status: 'insufficient', reason: 'no sign-in records could be read', coveredWindow: null, asOf: '2026-08-28T09:00:00.000Z' } },
  }), [])
  assert.equal(blind.status, 'insufficient')
  assert.equal(blind.lines.length, 1, 'an unreadable source says nothing about itself')
  assert.ok(blind.lines[0].includes('no sign-in records could be read'), `the recorded reason is not in the line: ${blind.lines[0]}`)
  // That waiting does not complete it, in words that hold on a policy already
  // enforced too: the sentence reaches the AI briefing of every lifecycle, and it
  // said "Time in report-only cannot complete it" on policies past report-only.
  assert.ok(blind.lines[0].includes('however long the policy runs'), `the line does not say waiting cannot complete it: ${blind.lines[0]}`)
  assert.doesNotMatch(blind.lines[0], /report-only/i, blind.lines[0])
  // And the reason on its own, for a surface that says it in its own context
  // (stepContract.ts, the device code decision tile).
  assert.equal(blind.unreadable, 'no sign-in records could be read')

  // 2. The records were read, and they are what holds the gate shut. The count
  //    is the one number the reader needs; it was on the step and said nowhere.
  const base = fixture('large').snapshot
  const stopped = ['u-1', 'u-2', 'u-3']
  const withFailures = evidenceFor('block-auth-transfer', snapshotWith({
    evidencePolicyResults: [{ policyId: 'p-1', displayName: 'CA - Block - Auth transfer', counts: { total: 3, success: 0, failure: 3, interrupted: 0 }, affectedUserIds: { reportOnlyFailure: stopped, reportOnlyInterrupted: [] } }] as unknown as TenantSnapshot['evidencePolicyResults'],
  }), ['p-1'])
  assert.deepEqual(withFailures.affectedUserIds, stopped, 'the premise: the results name who was stopped')
  assert.equal(withFailures.lines.length, 1)
  assert.ok(withFailures.lines[0].includes('3 people'), `the count is not in the line: ${withFailures.lines[0]}`)

  // 3. A window simply still running says neither: it is not stuck, and a
  //    reason invented for it would be noise on every ordinary rollout.
  const clean = evidenceFor('block-auth-transfer', base, [])
  assert.equal(clean.status, 'ok')
  assert.deepEqual(clean.lines, [], 'an ordinary open window states a reason it does not have')
  assert.equal(clean.unreadable, undefined, 'records that were read are not unreadable')
})

test('the unread sign-in records sentence holds for a read that stopped short, and names a reason where the source gave none', () => {
  // The sentence said "IAMAI could not read" the records, and the fixtures only
  // ever gave it a source that had read nothing. A production read that stops
  // short of 24 hours is 'insufficient' with the rows it did read kept — usage,
  // per-user and policy results (graph/collect/laneBCore.ts) — so "could not
  // read" was false exactly where it mattered. And a source with no reason of its
  // own filled the sentence with its bare status: "— pending —".
  const large = fixture('large').snapshot
  const withSource = (signInEvidence: TenantSnapshot['sources']['signInEvidence']): TenantSnapshot =>
    ({ ...large, sources: { ...large.sources, signInEvidence } } as TenantSnapshot)

  const reason = 'stopped at time budget with only 6 h covered (minimum 24 h)'
  assert.ok(large.evidenceUsage, 'the premise: the usage a short read keeps is on the snapshot')
  const short = evidenceFor('block-device-code', withSource({ status: 'insufficient', reason, coveredWindow: null, asOf: large.asOf }), [])
  assert.equal(short.unreadable, reason)
  assert.equal(short.lines.length, 1)
  assert.ok(short.lines[0].includes(`— ${reason} —`), short.lines[0])
  assert.doesNotMatch(short.lines[0], /could not read|has seen none|report-only/i, short.lines[0])

  // No source at all, and a source that failed without saying why: words, never the status.
  const none = evidenceFor('block-device-code', withSource(undefined as unknown as TenantSnapshot['sources']['signInEvidence']), [])
  assert.equal(none.unreadable, engine.evidence.status.pending)
  assert.doesNotMatch(none.lines[0], /— pending —/, none.lines[0])
  const failed = evidenceFor('block-device-code', withSource({ status: 'error', reason: null, coveredWindow: null, asOf: large.asOf }), [])
  assert.equal(failed.unreadable, engine.evidence.status.error)
  assert.doesNotMatch(failed.lines[0], /— error —/, failed.lines[0])
})
