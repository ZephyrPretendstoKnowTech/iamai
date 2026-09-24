// A tenant's own policy, read in the shape Microsoft Graph returns it. Graph
// answers every field: a condition the policy does not set comes back null
// (`insiderRiskLevels`, `clientApplications`, `authenticationFlows`), a field
// inside one comes back null or [] (`applicationFilter`, `excludeUsers`), and a
// strength reference comes back expanded into the whole strength object. IAMAI's
// own bodies carry none of that, and `effectOf` once read every one of them as a
// condition it could not read — so the tenant's own MFA policies reached nobody
// knowably, and every readiness number that read them said "not measured".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectOf, isCompletePolicy, isSubmittablePatch } from './operations.ts'

const PHISHING_RESISTANT = '00000000-0000-0000-0000-000000000004'
const EXCLUSIONS = 'eedad040-3722-4bcb-bde5-bc7c857f4983'

/**
 * Microsoft's documented response to GET /v1.0/identity/conditionalAccess/policies/{id}
 * (conditionalaccesspolicy-get, graph-rest-1.0), with `authenticationFlows`, which
 * the v1.0 conditionalAccessConditionSet also returns, written null as Graph
 * writes an unset condition.
 */
const documented = (): Record<string, unknown> => ({
  '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#identity/conditionalAccess/policies/$entity',
  id: '10ef4fe6-5e51-4f5e-b5a2-8fed19d0be67',
  templateId: null,
  displayName: 'CA008: Require password change for high-risk users',
  createdDateTime: '2021-11-02T14:26:29.1005248Z',
  modifiedDateTime: '2024-01-30T23:11:08.549481Z',
  state: 'enabled',
  conditions: {
    userRiskLevels: ['high'],
    signInRiskLevels: [],
    clientAppTypes: ['all'],
    servicePrincipalRiskLevels: [],
    insiderRiskLevels: null,
    platforms: null,
    locations: null,
    devices: null,
    clientApplications: null,
    authenticationFlows: null,
    applications: { includeApplications: ['All'], excludeApplications: [], includeUserActions: [], includeAuthenticationContextClassReferences: [], applicationFilter: null },
    users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [EXCLUSIONS], includeRoles: [], excludeRoles: [], includeGuestsOrExternalUsers: null, excludeGuestsOrExternalUsers: null },
  },
  grantControls: {
    operator: 'AND',
    builtInControls: ['passwordChange'],
    customAuthenticationFactors: [],
    termsOfUse: [],
    'authenticationStrength@odata.context': "https://graph.microsoft.com/v1.0/$metadata#identity/conditionalAccess/policies('10ef4fe6-5e51-4f5e-b5a2-8fed19d0be67')/grantControls/authenticationStrength/$entity",
    authenticationStrength: {
      id: '00000000-0000-0000-0000-000000000002',
      createdDateTime: '2021-12-01T08:00:00Z',
      modifiedDateTime: '2021-12-01T08:00:00Z',
      displayName: 'Multifactor authentication',
      description: 'Combinations of methods that satisfy strong authentication, such as a password + SMS',
      policyType: 'builtIn',
      requirementsSatisfied: 'mfa',
      allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor', 'deviceBasedPush', 'temporaryAccessPassOneTime', 'temporaryAccessPassMultiUse', 'password,microsoftAuthenticatorPush', 'password,softwareOath', 'password,hardwareOath', 'password,sms', 'password,voice', 'federatedMultiFactor', 'microsoftAuthenticatorPush,federatedSingleFactor', 'softwareOath,federatedSingleFactor', 'hardwareOath,federatedSingleFactor', 'sms,federatedSingleFactor', 'voice,federatedSingleFactor'],
      'combinationConfigurations@odata.context': "https://graph.microsoft.com/v1.0/$metadata#identity/conditionalAccess/policies('10ef4fe6-5e51-4f5e-b5a2-8fed19d0be67')/grantControls/authenticationStrength/combinationConfigurations",
      combinationConfigurations: [],
    },
  },
  sessionControls: {
    disableResilienceDefaults: null,
    applicationEnforcedRestrictions: null,
    cloudAppSecurity: null,
    persistentBrowser: null,
    signInFrequency: { value: null, type: null, authenticationType: 'primaryAndSecondaryAuthentication', frequencyInterval: 'everyTime', isEnabled: true },
  },
})

/** A policy requiring the built-in Phishing-resistant MFA strength of every internal user, as Graph returns it. */
const phishingResistantForEveryone = (): Record<string, unknown> => {
  const p = documented()
  p.displayName = 'Core - Allow - MFA for Internal Users'
  const conditions = p.conditions as Record<string, unknown>
  conditions.userRiskLevels = []
  conditions.users = {
    includeUsers: ['All'],
    excludeUsers: [],
    includeGroups: [],
    excludeGroups: [EXCLUSIONS],
    includeRoles: [],
    excludeRoles: ['d29b2b05-8046-44ba-8758-1e26182fcf32'],
    includeGuestsOrExternalUsers: null,
    excludeGuestsOrExternalUsers: {
      guestOrExternalUserTypes: 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider',
      externalTenants: { '@odata.type': '#microsoft.graph.conditionalAccessAllExternalTenants', membershipKind: 'all' },
    },
  }
  p.grantControls = {
    operator: 'OR',
    builtInControls: [],
    customAuthenticationFactors: [],
    termsOfUse: [],
    authenticationStrength: {
      id: PHISHING_RESISTANT,
      createdDateTime: '2021-12-01T08:00:00Z',
      modifiedDateTime: '2021-12-01T08:00:00Z',
      displayName: 'Phishing-resistant MFA',
      description: 'Phishing-resistant, Passwordless methods for the strongest authentication, such as a FIDO2 security key',
      policyType: 'builtIn',
      requirementsSatisfied: 'mfa',
      allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor'],
      combinationConfigurations: [],
    },
  }
  p.sessionControls = null
  return p
}

test("Graph's documented v1.0 policy reads in full: nothing Graph fills in is unreadable", () => {
  const effect = effectOf(documented())
  assert.deepEqual(effect.unknown, [])
  assert.equal(effect.scope.unreadable, false)
  assert.equal(effect.scope.allUsers, true)
  assert.deepEqual(effect.scope.groups.exclude, [EXCLUSIONS])
  // The strength is its reference; the built-in Multifactor authentication
  // strength reads as the Require MFA grant it is.
  assert.deepEqual(effect.strength, { id: '00000000-0000-0000-0000-000000000002' })
  assert.deepEqual(effect.requirements, [{ kind: 'mfa' }, { kind: 'passwordChange' }])
  assert.equal(effect.operator, 'AND')
  // Only what the policy states narrows it: the user risk it names.
  assert.deepEqual(effect.narrowings, [{ kind: 'userRisk', levels: ['high'] }])
  assert.equal(effect.sessionControls?.signInFrequencyEveryTime, true)
})

test("a tenant's phishing-resistant MFA policy, as Graph returns it, reads as the strength it requires", () => {
  const effect = effectOf(phishingResistantForEveryone())
  assert.deepEqual(effect.unknown, [])
  assert.equal(effect.scope.unreadable, false)
  assert.deepEqual(effect.strength, { id: PHISHING_RESISTANT })
  assert.deepEqual(effect.requirements, [{ kind: 'strength', id: PHISHING_RESISTANT }])
  assert.equal(effect.asksForMethod, true)
  assert.deepEqual(effect.scope.roles.exclude, ['d29b2b05-8046-44ba-8758-1e26182fcf32'])
  assert.equal(effect.scope.guests.exclude?.membershipKind, 'all')
  assert.deepEqual(effect.narrowings, [])
})

test('a condition the policy actually states is still held when IAMAI cannot read it', () => {
  const filtered = phishingResistantForEveryone()
  const conditions = filtered.conditions as Record<string, Record<string, unknown>>
  conditions.applications.applicationFilter = { mode: 'include', rule: 'CustomSecurityAttribute.Engineering_Project -eq "Baker"' }
  assert.deepEqual(effectOf(filtered).unknown, ['a condition IAMAI cannot read as written: applications'])

  const insider = phishingResistantForEveryone()
  ;(insider.conditions as Record<string, unknown>).insiderRiskLevels = 'elevated'
  assert.deepEqual(effectOf(insider).unknown, ['a condition IAMAI has no reading for: insiderRiskLevels'])
})

test('what IAMAI sends is still the reference alone, with no field Graph fills in', () => {
  const read = phishingResistantForEveryone()
  // The tenant's whole policy is not a body IAMAI would submit.
  assert.equal(isCompletePolicy(read), false)
  const grant = read.grantControls as Record<string, unknown>
  assert.equal(isSubmittablePatch({ grantControls: grant }), false, 'the expanded strength object is not a reference')
  assert.equal(isSubmittablePatch({ grantControls: { ...grant, authenticationStrength: { id: PHISHING_RESISTANT } } }), true)
  assert.equal(isSubmittablePatch({ conditions: { applications: { includeApplications: ['All'], applicationFilter: null } } }), false, 'an empty field is not written')
  assert.equal(isSubmittablePatch({ conditions: { users: { includeUsers: ['All'] }, insiderRiskLevels: null } }), false, 'nor is an empty condition')
})
