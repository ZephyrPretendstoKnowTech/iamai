// User Action readiness (roadmap/evidenceStrategy.ts). Microsoft does not
// evaluate Conditional Access policies scoped to User Actions in report-only,
// so a User Action policy's readiness is its configuration, never report-only
// sign-in records that cannot arrive. Every other policy stays on its records.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evidenceStrategyOf, stepEvidenceStrategy, userActionsOf } from './evidenceStrategy.ts'
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
