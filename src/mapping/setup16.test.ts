// Prompt 16: service-account detection, country suggestions, and the
// questions that appear only when there is something to ask.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import { detectServiceAccounts } from './serviceAccounts.ts'
import { countryName, isAllowlistGeoPolicy, isCountryLocationRef, suggestCountries, tenantCountryLocation } from './countries.ts'
import { askedAnswers } from './wizard.ts'
import { emptyMappingState } from './types.ts'

function user(id: string, over: Partial<UserRow> = {}): UserRow {
  return {
    id,
    displayName: id,
    userPrincipalName: `${id}@x.test`,
    userType: 'member',
    usageLocation: null,
    createdDateTime: '2024-01-01T00:00:00Z',
    lastSuccessfulSignIn: '2026-08-01T00:00:00Z',
    accountEnabled: true,
    mail: null,
    assignedPlans: [],
    onPremisesSyncEnabled: false,
    externalUserState: null,
    department: 'Sales',
    jobTitle: 'Rep',
    officeLocation: null,
    ...over,
  }
}

function snapshot(users: UserRow[], over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    schemaVersion: 1,
    tenantId: 't',
    asOf: '2026-08-26T00:00:00Z',
    sources: { signInEvidence: { status: 'ok', coveredWindow: null, reason: null, asOf: '' } } as TenantSnapshot['sources'],
    config: { namedLocations: { status: 'ok', reason: null, rows: [] } } as unknown as TenantSnapshot['config'],
    registrationDetails: [],
    users,
    devices: [],
    spActivity: [],
    authMethods: {},
    appSignInSummary: [],
    signInEvidence: {},
    evidencePolicyResults: [],
    blockedToday: [],
    evidenceUsage: null,
    evidenceAggregates: null,
    capabilities: {} as TenantSnapshot['capabilities'],
    microsoftManagedPolicyIds: [],
    roles: { active: {}, eligible: {} },
    ...over,
  }
}

test('service accounts: name pattern plus evidence is a candidate; a normal person is not', () => {
  const svc = user('svc-printer', { displayName: 'Printer Scanner', department: null, jobTitle: null, lastSuccessfulSignIn: null })
  const person = user('alice', { displayName: 'Alice Ng' })
  const snap = snapshot([svc, person], { authMethods: { 'svc-printer': [{ kind: 'password' }], alice: [{ kind: 'microsoftAuthenticator' }] } })
  const found = detectServiceAccounts(snap)
  assert.deepEqual(
    found.map((c) => c.id),
    ['svc-printer'],
  )
  assert.ok(found[0].evidence.some((e) => e.includes('printer')))
  assert.ok(found[0].evidence.some((e) => e.includes('never signed in')))
  assert.equal(found[0].strength, 'strong')
})

test('service accounts: excluded ids and guests never surface; the question hides when nothing is found', () => {
  const svc = user('svc-1', { displayName: 'svc automation', department: null, jobTitle: null, lastSuccessfulSignIn: null })
  const snap = snapshot([svc], { authMethods: { 'svc-1': [] } })
  assert.equal(detectServiceAccounts(snap, ['svc-1']).length, 0)
  const state = emptyMappingState('t')
  state.serviceAccountRejectedIds = ['svc-1']
  assert.ok(!askedAnswers(snap, state).includes('serviceAccounts'))
  assert.ok(askedAnswers(snap, emptyMappingState('t')).includes('serviceAccounts'))
})

test('countries: sign-in countries first by distinct users, then usage locations; flags when no sign-in location exists', () => {
  const snap = snapshot([user('a', { usageLocation: 'AU' }), user('b', { usageLocation: 'GB' }), user('g', { userType: 'guest', usageLocation: 'US' })], {
    evidenceAggregates: { total: 10, distinctUsers: 3, byClientApp: {}, byProtocol: {}, byCountry: { NZ: 3, AU: 2 } },
  })
  const s = suggestCountries(snap)
  assert.equal(s.hasSignInLocations, true)
  assert.deepEqual(
    s.countries.map((c) => c.code),
    ['NZ', 'AU', 'GB'],
  )
  assert.equal(s.countries[1].usageLocationUsers, 1)
  const none = suggestCountries(snapshot([user('a', { usageLocation: 'AU' })]))
  assert.equal(none.hasSignInLocations, false)
  assert.deepEqual(
    none.countries.map((c) => c.code),
    ['AU'],
  )
  assert.equal(countryName('AU'), 'Australia')
})

// Prompt 19 §A2: the Baseline promise and the Setup list share one function.
