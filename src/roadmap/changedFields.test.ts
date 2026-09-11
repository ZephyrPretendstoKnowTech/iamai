// The engine's semantic facts about a correction (roadmap/changedFields.ts):
// leaf paths, only where the value differs, only material fields.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedFieldsOf } from './changedFields.ts'

const current = {
  id: 'p',
  displayName: 'Device registration',
  state: 'enabled',
  conditions: {
    users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: ['b', 'a'] },
    applications: { includeApplications: [], includeUserActions: ['urn:user:registerdevice'] },
    clientAppTypes: ['all'],
    locations: null,
  },
  grantControls: { operator: 'OR', builtInControls: ['mfa'], authenticationStrength: null },
}

test('only the leaves whose values differ are changes, whatever section the patch carries whole', () => {
  const patch = {
    conditions: { users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: ['a', 'b', 'c'] } },
    grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000002' } },
  }
  assert.deepEqual(changedFieldsOf(patch, current), ['conditions.users.excludeGroups', 'grantControls.authenticationStrength.id', 'grantControls.builtInControls'])
})

test('a list of ids has no order, and empty is empty however it is written', () => {
  const patch = { conditions: { users: { excludeGroups: ['a', 'b'], excludeUsers: null }, locations: {} } }
  assert.deepEqual(changedFieldsOf(patch, current), [])
})

test('the lifecycle and the name are not semantic facts', () => {
  assert.deepEqual(changedFieldsOf({ state: 'enabledForReportingButNotEnforced', displayName: 'Renamed' }, current), [])
})

test('a policy this scan did not read makes every submitted leaf a change', () => {
  assert.deepEqual(changedFieldsOf({ grantControls: { operator: 'OR' } }, null), ['grantControls.operator'])
})

test('a condition the patch clears is a change at its own path', () => {
  const withLocation = { ...current, conditions: { ...current.conditions, locations: { includeLocations: ['All'] } } }
  assert.deepEqual(changedFieldsOf({ conditions: { locations: null } }, withLocation), ['conditions.locations'])
})
