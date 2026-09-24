// User Action readiness (roadmap/evidenceStrategy.ts). Microsoft does not
// evaluate Conditional Access policies scoped to User Actions in report-only,
// so a User Action policy's readiness is its configuration, never report-only
// sign-in records that cannot arrive. Every other policy stays on its records.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evidenceStrategyOf, userActionsOf } from './evidenceStrategy.ts'
import { gates } from './tracking.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
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

test('a report-only User Action policy does not wait for records Microsoft never writes; an ordinary policy does', () => {
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
  // An ordinary policy stays observation-driven: no records is not a clean window.
  const ordinary = gates(pilot, { id: 'p', state: 'enabledForReportingButNotEnforced', ...ALL_APPS } as never, snapshot, undefined, SINCE, {}, null)
  assert.equal(ordinary.evidenceStrategy, undefined)
  assert.equal(ordinary.readyNow, false)
  assert.equal(ordinary.failures, null)
})
