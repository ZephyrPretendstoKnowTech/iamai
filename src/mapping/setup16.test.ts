// Prompt 16: service-account detection, country suggestions, and the
// questions that appear only when there is something to ask.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import { detectServiceAccounts } from './serviceAccounts.ts'
import { countryName, isAllowlistGeoPolicy, isCountryLocationRef, suggestCountries, tenantCountryLocation } from './countries.ts'
import { activeWizardQuestions, applyWizardAnswers, wizardQuestionCounts } from './wizard.ts'
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
  assert.ok(!activeWizardQuestions(null, { snapshot: snap, state }).some((q) => q.id === 'serviceAccounts'))
  assert.ok(activeWizardQuestions(null, { snapshot: snap, state: emptyMappingState('t') }).some((q) => q.id === 'serviceAccounts'))
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

test('countries: the allowlist geo ref resolves to a matching tenant location, else is created in phase 0', () => {
  const pkg = {
    policies: [
      {
        displayName: 'Geo allow',
        conditions: { locations: { includeLocations: ['All'], excludeLocations: ['loc-ref'] } },
        grantControls: { builtInControls: ['block'] },
      },
    ],
    origins: {},
    report: { considered: 0, parsed: 0, skipped: [], errors: [], duplicates: [], warnings: [] },
    references: [{ id: 'loc-ref', kind: 'namedLocation', portability: 'tenantSpecific', uses: [{ policyName: 'Geo allow', side: 'exclude' }] }],
    groupSignatures: [],
    variantSets: [],
    docs: [],
  } as never
  assert.equal(isCountryLocationRef('loc-ref', (pkg as { policies: never[] }).policies), true)
  assert.equal(isAllowlistGeoPolicy((pkg as { policies: never[] }).policies[0]), true)
  const withLoc = snapshot([], {
    config: {
      namedLocations: { status: 'ok', reason: null, rows: [{ '@odata.type': '#microsoft.graph.countryNamedLocation', id: 'loc-t', displayName: 'Allowed', countriesAndRegions: ['nz', 'AU'] }] },
    } as unknown as TenantSnapshot['config'],
  })
  assert.equal(tenantCountryLocation(withLoc, ['AU', 'NZ'])?.id, 'loc-t')
  assert.equal(tenantCountryLocation(withLoc, ['AU']), null)

  const state = emptyMappingState('t')
  state.allowedCountries = ['AU', 'NZ']
  state.wizardAnswered.countries = true
  const resolved = applyWizardAnswers(state, pkg, withLoc)
  assert.equal(resolved.records['loc-ref'].resolvedId, 'loc-t')
  const created = applyWizardAnswers(state, pkg, snapshot([]))
  assert.equal(created.records['loc-ref'].resolvedId, null)
  assert.equal(created.records['loc-ref'].doesNotExist, true)
})

// Prompt 19 §A2: the Baseline promise and the Setup list share one function.
test('question counts follow the rendered list and split required from optional', () => {
  const noScan = wizardQuestionCounts(null)
  // Seven answers since prompt 46 item 19: handle-with-care and frameworks are no longer asked.
  assert.equal(noScan.total, 7)
  assert.equal(noScan.required, 7, 'every shown question is required (prompt 26)')

  const plain = snapshot([user('alice')])
  const withScan = wizardQuestionCounts(null, { snapshot: plain, state: emptyMappingState('t') })
  assert.equal(withScan.total, activeWizardQuestions(null, { snapshot: plain, state: emptyMappingState('t') }).length)
  assert.equal(withScan.total, 5, 'service accounts and trusted locations are hidden when the tenant has neither')
  assert.equal(withScan.required, withScan.total)

  const confirmed = { ...emptyMappingState('t'), serviceAccountUserIds: ['svc'] }
  assert.equal(wizardQuestionCounts(null, { snapshot: plain, state: confirmed }).total, 6, "service accounts return; trusted locations stay hidden without named locations")
})
