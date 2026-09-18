import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureEmergencyAccessDiagnostic, createDiagnosticPseudonymizer, evaluateDiagnosticPair } from './emergency-access-readonly-diagnostic.ts'
import type { EmergencyDiagnosticArtifact, RequestResult } from './emergency-access-diagnostic-core.ts'

const TENANT = '10000000-0000-4000-8000-000000000001'
const APP = '74658136-14ec-4630-ad9b-26e160ff0fc6'
const RESOURCE = '00000003-0000-0000-c000-000000000000'
const AAGUID = 'a25342c0-3cdc-4414-8e46-f4807fca511c'
const GLOBAL_ADMIN_ID = '62e90394-69f5-4237-9190-012177145e10'
const token = { get: () => 'secret-token', refresh: async () => 'secret-token' }
const input = { accountIds: ['user-a', 'user-b'], groupId: 'group-a', tenantId: TENANT, expectedTarget: { appId: APP, resourceId: RESOURCE }, approvedAaguids: [AAGUID], configurationBasis: 'intent-v1', kind: 'synthetic' as const, secret: 'private-pair-secret' }

function graphBody(url: string): unknown {
  if (/\/users\/[^/]+\?/.test(url)) { const id = decodeURIComponent(url.split('/users/')[1].split('?')[0]); return { id, userPrincipalName: `${id}@private.example`, userType: 'Member', accountEnabled: true, onPremisesSyncEnabled: false, createdDateTime: '2026-01-01T00:00:00Z' } }
  if (url.includes('/authentication/fido2Methods')) return { value: [{ id: `method-${url.includes('user-a') ? 'a' : 'b'}`, displayName: 'Alice private key', aaGuid: AAGUID, model: 'Private model', passkeyType: 'deviceBound', createdDateTime: '2026-01-01T00:00:00Z' }] }
  if (url.includes('/auditLogs/signIns')) return { value: [] }
  if (url.includes('/transitiveMemberOf')) return { value: [{ id: 'group-a', '@odata.type': '#microsoft.graph.group' }] }
  if (url.includes('/authenticationMethodConfigurations/Fido2')) return { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'group-a', targetType: 'group' }], excludeTargets: [], passkeyProfiles: [{ id: 'profile-a', passkeyTypes: 'deviceBound' }] }
  if (url.includes('/conditionalAccess/policies')) return { value: [{ id: 'policy-a', state: 'enabled', conditions: { users: { excludeGroups: ['group-a'] } }, grantControls: { operator: 'OR' } }] }
  if (url.includes('/authenticationStrength/policies')) return { value: [] }
  if (url.includes('/roleAssignmentScheduleInstances')) return { value: [{ id: 'schedule-a', principalId: 'user-a', roleDefinitionId: 'role-a', assignmentType: 'Assigned', startDateTime: '2026-01-01T00:00:00Z', endDateTime: null }] }
  if (url.includes('/roleAssignments')) return { value: [{ id: 'assignment-a', principalId: 'user-a', roleDefinitionId: 'role-a', directoryScopeId: '/' }] }
  if (url.includes('/directoryAudits')) return { value: [{ id: 'audit-a', activityDateTime: '2026-01-01T00:00:00Z', activityDisplayName: 'Update group member', category: 'GroupManagement', result: 'success', targetResources: [{ id: 'user-a', type: 'User', displayName: 'Alice Private', modifiedProperties: [{ displayName: 'Members', oldValue: JSON.stringify([{ id: 'user-a', displayName: 'Alice Private' }]), newValue: JSON.stringify([{ id: 'user-b', userPrincipalName: 'bob@private.example' }]) }] }] }] }
  if (/\/groups\/[^/]+\?/.test(url)) return { id: 'group-a', membershipRule: null, membershipRuleProcessingState: null, mailEnabled: false, securityEnabled: true, groupTypes: [], isAssignableToRole: false, assignedLicenses: [] }
  if (url.includes('/groups/') && url.includes('/members')) return { value: [{ id: 'user-a', displayName: 'Alice Private', userPrincipalName: 'alice@private.example', '@odata.type': '#microsoft.graph.user' }, { id: 'service-a', displayName: 'Private app', userPrincipalName: null, '@odata.type': '#microsoft.graph.servicePrincipal' }] }
  if (url.includes('/groups/') && url.includes('/owners')) return { value: [{ id: 'user-a', displayName: 'Alice Private', userPrincipalName: 'alice@private.example', '@odata.type': '#microsoft.graph.user' }] }
  if (url.includes('eligibilityScheduleInstances')) return { value: [{ id: 'eligible-a', principalId: 'user-a', groupId: 'group-a', accessId: 'member' }] }
  if (url.includes('assignmentScheduleInstances')) return { value: [{ id: 'active-a', principalId: 'user-a', groupId: 'group-a', accessId: 'member' }] }
  if (url.includes('accessPackageCatalogs')) return { value: [{ id: 'catalog-a', accessPackageResources: [{ id: 'resource-a', originId: 'group-a', accessPackageResourceScopes: [], accessPackageResourceRoles: [] }] }] }
  throw new Error(`Unhandled Graph URL: ${url}`)
}

async function capture(overrides: Partial<typeof input> = {}, responder: (url: string) => unknown = graphBody) {
  const urls: string[] = []; const before = globalThis.fetch
  globalThis.fetch = async request => { const url = String(request); urls.push(url); const body = responder(url); return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }) }
  try { return { urls, artifact: await captureEmergencyAccessDiagnostic(token, { ...input, ...overrides }) } } finally { globalThis.fetch = before }
}

test('collector preserves canonical joins and removes nested personal strings', async () => {
  const { artifact, urls } = await capture()
  const roleUrl = urls.find(url => url.includes('/roleAssignmentScheduleInstances'))!
  assert.ok(roleUrl)
  assert.equal(new URL(roleUrl).searchParams.get('$select')?.split(',').includes('status'), false,
    'schedule instances have no status property; selecting it can reject the request')
  const selected = artifact.accounts[0].account
  assert.equal(selected, artifact.accounts[0].identity?.id)
  assert.equal(selected, (artifact.roles?.[0] as { principalId: string }).principalId)
  assert.equal(selected, artifact.group?.directMembers?.[0].id)
  assert.equal(selected, artifact.audits?.[0].targets[0].id)
  assert.equal(artifact.group?.id, (artifact.group?.properties as { id: string }).id)
  assert.ok(urls.some(url => url.includes('/beta/groups/') && url.includes('/members')))
  const signInUrls = urls.filter(url => url.includes('/auditLogs/signIns'))
  assert.ok(signInUrls.length > 0)
  assert.ok(signInUrls.every(url => url.includes('createdDateTime') && !url.includes('$select')))
  assert.equal(artifact.advancedRoutes[0].records?.length, 1)
  const output = JSON.stringify(artifact)
  for (const privateValue of ['secret-token', 'user-a', 'user-b', 'Alice Private', 'alice@private.example', 'bob@private.example', 'Private model']) assert.doesNotMatch(output, new RegExp(privateValue, 'i'))
  assert.doesNotMatch(output, /"group-a"/i)
  assert.match(output, /devicebound/)
  assert.match(output, /2026-01-01T00:00:00Z/)
})

test('collector preserves source-specific enums, sentinels, and cross-source joins', async () => {
  const { artifact } = await capture({}, url => {
    if (url.includes('/authenticationMethodConfigurations/Fido2')) return { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['profile-a'] }], excludeTargets: [], passkeyProfiles: [{ id: 'profile-a', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [AAGUID] } }] }
    if (url.includes('/conditionalAccess/policies')) return { value: [{ id: 'policy-a', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: ['All'], excludeGroups: ['group-a'] } }, grantControls: { operator: 'OR' } }] }
    if (/\/groups\/[^/]+\?/.test(url)) return { id: 'group-a', membershipRule: '(user.accountEnabled -eq true)', membershipRuleProcessingState: 'On', mailEnabled: false, securityEnabled: true, groupTypes: ['DynamicMembership'], isAssignableToRole: false, assignedLicenses: [{ skuId: 'private-sku' }] }
    return graphBody(url)
  })
  const config = artifact.policy.configurations?.[0] as any
  assert.equal(config.passkeyProfiles[0].id, config.includeTargets[0].allowedPasskeyProfiles[0])
  assert.equal(config.passkeyProfiles[0].passkeyTypes, 'devicebound,synced')
  const policy = artifact.policy.conditionalAccess?.[0] as any
  assert.equal(policy.state, 'enabledForReportingButNotEnforced')
  assert.equal(policy.conditions.users.includeUsers[0], 'All')
  assert.equal(policy.conditions.users.excludeGroups[0], artifact.group?.id)
  assert.equal(policy.grantControls.operator, 'OR')
  assert.deepEqual((artifact.group?.properties as any).groupTypes, ['DynamicMembership'])
  const entitlement = artifact.advancedRoutes.find(row => row.route === 'entitlement-resources')?.records?.[0] as any
  assert.equal(entitlement.accessPackageResources[0].originId, artifact.group?.id)
})

test('known MFA combinations and FIDO2 audit targets remain complete and join', async () => {
  const { artifact } = await capture({}, url => {
    if (url.includes('/authenticationStrength/policies')) return { value: [{ id: 'built-in-mfa', policyType: 'builtIn', requirementsSatisfied: 'mfa', allowedCombinations: ['fido2', 'password,microsoftAuthenticatorPush'] }] }
    if (url.includes('/directoryAudits')) return { value: [{ id: 'audit-passkey', activityDateTime: '2026-01-01T00:00:00Z', activityDisplayName: 'Update authentication methods policy', category: 'Policy', targetResources: [{ id: 'Fido2', type: 'Policy', modifiedProperties: [] }] }] }
    return graphBody(url)
  })
  assert.equal(artifact.requests.find(row => row.source === 'authentication-strengths')?.status, 'ok')
  assert.deepEqual((artifact.policy.authenticationStrengths?.[0] as any).allowedCombinations, ['fido2', 'password,microsoftAuthenticatorPush'])
  assert.equal(artifact.audits?.[0].targets[0].id, (artifact.policy.configurations?.[0] as any).id)
})

test('non-selected passkey target membership uses the same group identity', async () => {
  const { artifact } = await capture({}, url => {
    if (url.includes('/authenticationMethodConfigurations/Fido2')) return { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'group-b', targetType: 'group', allowedPasskeyProfiles: ['profile-a'] }], excludeTargets: [], passkeyProfiles: [{ id: 'profile-a', passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [AAGUID] } }] }
    if (url.includes('/transitiveMemberOf')) return { value: [{ id: 'group-b', '@odata.type': '#microsoft.graph.group' }] }
    return graphBody(url)
  })
  assert.equal(artifact.accounts[0].memberships?.[0], (artifact.policy.configurations?.[0] as any).includeTargets[0].id)
})

test('nested profile continuation is followed and a later-page failure retains earlier records as incomplete', async () => {
  const before = globalThis.fetch
  globalThis.fetch = async request => {
    const url = String(request)
    if (url === 'https://next.invalid/profiles') return new Response(JSON.stringify({ value: [{ id: 'profile-b', passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [AAGUID] } }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url === 'https://next.invalid/methods-fail') return new Response(JSON.stringify({ error: { code: 'Denied' } }), { status: 403, headers: { 'content-type': 'application/json' } })
    const body = graphBody(url) as Record<string, any>
    if (url.includes('/authenticationMethodConfigurations/Fido2')) return new Response(JSON.stringify({ ...body, 'passkeyProfiles@odata.nextLink': 'https://next.invalid/profiles' }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.includes('user-a/authentication/fido2Methods')) return new Response(JSON.stringify({ value: body.value, '@odata.nextLink': 'https://next.invalid/methods-fail' }), { status: 200, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const artifact = await captureEmergencyAccessDiagnostic(token, input)
    assert.equal((artifact.policy.configurations?.[0] as any).passkeyProfiles.length, 2)
    assert.equal(artifact.accounts[0].methods?.length, 1)
    assert.ok(artifact.coverage.incomplete.some(source => source.startsWith('methods:')))
  } finally { globalThis.fetch = before }
})

test('nested entitlement continuations complete or retain the parent row as incomplete on later failure', async () => {
  for (const fail of [false, true]) {
    const before = globalThis.fetch
    globalThis.fetch = async request => {
      const url = String(request)
      if (url === 'https://next.invalid/entitlement-scopes') {
        if (fail) return new Response(JSON.stringify({ error: { code: 'Forbidden' } }), { status: 403, headers: { 'content-type': 'application/json' } })
        return new Response(JSON.stringify({ value: [{ id: 'scope-a' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      const response = graphBody(url) as Record<string, any>
      if (url.includes('accessPackageCatalogs')) return new Response(JSON.stringify({ value: [{ id: 'catalog-a', accessPackageResources: [{ id: 'resource-a', originId: 'group-a', accessPackageResourceScopes: [], accessPackageResourceRoles: [], 'accessPackageResourceScopes@odata.nextLink': 'https://next.invalid/entitlement-scopes' }] }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    try {
      const artifact = await captureEmergencyAccessDiagnostic(token, input)
      const route = artifact.advancedRoutes.find(row => row.route === 'entitlement-resources')!
      assert.equal(route.records?.length, 1)
      assert.equal(route.status, fail ? 'denied' : 'ok')
      const request = artifact.requests.find(row => row.source === 'entitlement-resources')!
      assert.equal(request.continuationComplete, !fail)
      assert.equal(request.requiredFieldsPresent, !fail)
    } finally { globalThis.fetch = before }
  }
})

test('malformed source enums and broken profile references remain named incomplete evidence', async () => {
  const { artifact } = await capture({}, url => {
    if (url.includes('/authenticationMethodConfigurations/Fido2')) return { id: 'Fido2', state: 'mystery', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'group-a', targetType: 'group', allowedPasskeyProfiles: ['missing-profile'] }], excludeTargets: [], passkeyProfiles: [] }
    if (url.includes('/conditionalAccess/policies')) return { value: [{ id: 'policy-a', state: 'enabled', conditions: { users: { excludeGroups: ['group-a'] } }, grantControls: { operator: 'XOR' } }] }
    return graphBody(url)
  })
  assert.ok(artifact.coverage.incomplete.includes('passkey-policy'))
  assert.ok(artifact.coverage.incomplete.includes('conditional-access'))
  assert.equal(artifact.requests.find(row => row.source === 'passkey-policy')?.error?.kind, 'SemanticEvidenceIncomplete')
})

test('audit scalar, list, and object values preserve joins or explicitly report unsupported semantics', async () => {
  const { artifact } = await capture({}, url => {
    if (url.includes('/directoryAudits')) return { value: [{ id: 'audit-values', activityDateTime: '2026-01-01T00:00:00Z', activityDisplayName: 'Update group member', category: 'GroupManagement', targetResources: [{ id: 'group-a', type: 'Group', modifiedProperties: [
      { displayName: 'Members', oldValue: JSON.stringify('user-a'), newValue: JSON.stringify([{ id: 'user-b', displayName: 'Private' }]) },
      { displayName: 'GroupId', oldValue: JSON.stringify(['group-a']), newValue: JSON.stringify(['group-a']) },
      { displayName: 'Unrecognized property', oldValue: JSON.stringify('private-value'), newValue: JSON.stringify('private-value') },
    ] }] }] }
    return graphBody(url)
  })
  const modified = artifact.audits![0].targets[0].modified
  assert.equal(modified[0].preserved, true)
  assert.equal(modified[1].preserved, true)
  assert.equal(modified[2].preserved, false)
  assert.doesNotMatch(JSON.stringify(artifact), /private-value|"user-a"|"user-b"/i)
})

test('advanced routes distinguish denied, complete empty, and matching records', async () => {
  const before = globalThis.fetch
  globalThis.fetch = async request => {
    const url = String(request)
    if (url.includes('eligibilityScheduleInstances')) return new Response(JSON.stringify({ error: { code: 'Forbidden' } }), { status: 403, headers: { 'content-type': 'application/json' } })
    if (url.includes('assignmentScheduleInstances')) return new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify(graphBody(url)), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const artifact = await captureEmergencyAccessDiagnostic(token, input)
    assert.equal(artifact.advancedRoutes.find(row => row.route === 'pim-group-eligibility')?.status, 'denied')
    assert.equal(artifact.advancedRoutes.find(row => row.route === 'pim-group-assignments')?.rows, 0)
    assert.equal(artifact.advancedRoutes.find(row => row.route === 'entitlement-resources')?.records?.length, 1)
  } finally { globalThis.fetch = before }
})

test('pair pseudonyms are stable inside a private pair and rotate with its secret', async () => {
  const first = createDiagnosticPseudonymizer('one'); const second = createDiagnosticPseudonymizer('one'); const other = createDiagnosticPseudonymizer('two')
  assert.equal(await first('directory', 'USER-A'), await second('directory', 'user-a'))
  assert.notEqual(await first('directory', 'user-a'), await other('directory', 'user-a'))
  const one = await capture({ secret: 'one' }); const two = await capture({ secret: 'one' }); const rotated = await capture({ secret: 'two' })
  assert.equal(one.artifact.accounts[0].account, two.artifact.accounts[0].account)
  assert.notEqual(one.artifact.accounts[0].account, rotated.artifact.accounts[0].account)
})

test('partial pagination and omitted required fields remain incomplete', async () => {
  let second = false
  const before = globalThis.fetch
  globalThis.fetch = async request => {
    const url = String(request)
    if (url === 'https://next.invalid/methods') { second = true; return new Response(JSON.stringify({ error: { code: 'Denied', message: 'alice@private.example' } }), { status: 403 }) }
    const body = graphBody(url) as Record<string, unknown>
    if (url.includes('user-a/authentication/fido2Methods')) return new Response(JSON.stringify({ value: body.value, '@odata.nextLink': 'https://next.invalid/methods' }), { status: 200 })
    if (url.includes('user-b/authentication/fido2Methods')) return new Response(JSON.stringify({ value: [{ id: 'method-b', aaGuid: AAGUID }] }), { status: 200 })
    return new Response(JSON.stringify(body), { status: 200 })
  }
  try {
    const artifact = await captureEmergencyAccessDiagnostic(token, input)
    const partial = artifact.requests.find(row => row.source.startsWith('methods:'))!
    assert.equal(second, true); assert.equal(partial.pages, 1); assert.equal(partial.rows, 1); assert.equal(partial.continuationComplete, false)
    assert.ok(artifact.coverage.incomplete.some(source => source.startsWith('methods:')))
    assert.doesNotMatch(JSON.stringify(artifact), /alice@private.example/)
  } finally { globalThis.fetch = before }
})

const okRequest = (source: string): RequestResult => ({ source, endpoint: source, version: 'v1.0', requested: ['id'], returned: ['id'], startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z', pages: 1, rows: 1, continuationComplete: true, requiredFieldsPresent: true, status: 'ok' })
function validArtifact(phase: 'baseline' | 'confirming'): EmergencyDiagnosticArtifact {
  const accounts = ['account-a', 'account-b']; const mandatory = ['passkey-policy', 'conditional-access', 'authentication-strengths', 'roles', 'role-schedules', 'directory-audits', 'group', 'group-members', 'group-owners', ...accounts.flatMap(id => [`identity:${id}`, `methods:${id}`, `signins:${id}`, `memberships:${id}`])]
  const confirming = phase === 'confirming'
  return { schema: 3, kind: 'synthetic', captureId: phase, startedAt: confirming ? '2026-01-01T00:04:00Z' : '2026-01-01T00:00:00Z', endedAt: confirming ? '2026-01-01T00:10:00Z' : '2026-01-01T00:01:00Z', context: { tenant: 'tenant-a', accounts, group: 'group-a', configurationBasis: 'config-a', expectedTarget: { appId: 'app-a', resourceId: 'resource-a' }, approvedAaguids: [AAGUID] }, requests: mandatory.map(okRequest), coverage: { mandatory, complete: [...mandatory], incomplete: [] }, accounts: accounts.map(id => ({ account: id, identity: { id, tenantId: 'tenant-a', accountEnabled: true, cloudOnly: true }, methods: [{ id: `method-${id}`, displayName: null, aaguid: AAGUID, passkeyType: 'devicebound', model: null, createdAt: null, approved: true }], signIns: confirming ? [{ id: `event-${id}`, at: '2026-01-01T00:05:00Z', userId: id, tenantId: 'tenant-a', appId: 'app-a', resourceId: 'resource-a', success: true, interactive: true, authenticationRequirement: 'multifactorauthentication', reusedClaim: false, steps: [{ at: '2026-01-01T00:05:00Z', method: 'fido2', detail: 'fido2', resultDetail: 'success', succeeded: true }] }] : [], memberships: ['group-a'] })), policy: { configurations: [{ id: 'fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'group-a', targetType: 'group', allowedPasskeyProfiles: ['profile-a'] }], excludeTargets: [], passkeyProfiles: [{ id: 'profile-a', passkeyTypes: 'devicebound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [AAGUID] } }] }], conditionalAccess: [{ id: 'policy-a', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: ['group-a'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'], authenticationStrengthId: null } }], authenticationStrengths: [] }, roles: accounts.map(id => ({ id: `role-${id}`, principalId: id, roleDefinitionId: '62e90394-69f5-4237-9190-012177145e10', directoryScopeId: '/' })), roleSchedules: accounts.map(id => ({ id: `schedule-${id}`, principalId: id, roleDefinitionId: GLOBAL_ADMIN_ID, directoryScopeId: '/', assignmentType: 'Assigned', startDateTimeKnown: true, endDateTimeKnown: true, startDateTime: null, endDateTime: null })), audits: [], group: { id: 'group-a', properties: { id: 'group-a', membershipRulePresent: false, mailEnabled: false, securityEnabled: true, groupTypes: [], isAssignableToRole: false, assignedLicenseCount: 0 }, directMembers: accounts.map(id => ({ id, kind: 'user', displayName: null, userPrincipalName: null })), owners: [] }, advancedRoutes: [{ route: 'pim-group-eligibility', status: 'ok', rows: 0, records: [] }, { route: 'pim-group-assignments', status: 'ok', rows: 0, records: [] }, { route: 'entitlement-resources', status: 'ok', rows: 0, records: [] }], disposition: [{ assertion: 'No advanced membership, ownership, or entitlement route is present', result: 'supported', reason: 'Complete empty routes.' }], providerAssurance: 'unvalidated' }
}
const mutate = (artifact: EmergencyDiagnosticArtifact, change: (copy: EmergencyDiagnosticArtifact) => void) => { const copy = structuredClone(artifact); change(copy); return copy }

test('complete two-account fixtures pass the logical contract but not provider assurance', () => {
  const result = evaluateDiagnosticPair(validArtifact('baseline'), validArtifact('confirming'))
  assert.equal(result.logicalSupported, true); assert.equal(result.supported, false); assert.equal(result.providerAssurance, 'unvalidated'); assert.equal(result.accounts.every(account => account.result === 'supported'), true)
})

test('logical proof rejects candidate replacement, expired or scoped GA, and profile-denied candidates', () => {
  const replaced = validArtifact('confirming'); replaced.accounts[0].methods![0].id = 'replacement-credential'
  assert.equal(evaluateDiagnosticPair(validArtifact('baseline'), replaced).logicalSupported, false)

  const expiredBaseline = validArtifact('baseline'); const expiredConfirming = validArtifact('confirming')
  for (const value of [expiredBaseline, expiredConfirming]) { value.roles = []; value.roleSchedules = value.accounts.map(row => ({ id: `schedule-${row.account}`, principalId: row.account, roleDefinitionId: GLOBAL_ADMIN_ID, directoryScopeId: '/', assignmentType: 'Assigned', startDateTime: '2025-01-01T00:00:00Z', endDateTime: '2025-12-31T00:00:00Z' })) }
  assert.equal(evaluateDiagnosticPair(expiredBaseline, expiredConfirming).logicalSupported, false)

  const scopedBaseline = validArtifact('baseline'); const scopedConfirming = validArtifact('confirming')
  for (const value of [scopedBaseline, scopedConfirming]) for (const role of value.roles as any[]) role.directoryScopeId = 'administrative-unit-1'
  assert.equal(evaluateDiagnosticPair(scopedBaseline, scopedConfirming).logicalSupported, false)

  const other = '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b'; const deniedBaseline = validArtifact('baseline'); const deniedConfirming = validArtifact('confirming')
  for (const value of [deniedBaseline, deniedConfirming]) { value.context.approvedAaguids.push(other); value.accounts[0].methods!.push({ ...value.accounts[0].methods![0], id: 'other-key', aaguid: other }) }
  assert.equal(evaluateDiagnosticPair(deniedBaseline, deniedConfirming).logicalSupported, false)
})

test('logical proof compares semantically identical unordered role data', () => {
  const baseline = validArtifact('baseline'); const confirming = validArtifact('confirming'); confirming.roles = [...(confirming.roles as any[])].reverse()
  assert.equal(evaluateDiagnosticPair(baseline, confirming).logicalSupported, true)
})

const negatives: [string, (artifact: EmergencyDiagnosticArtifact) => void][] = [
  ['missing mandatory request', value => { value.requests = value.requests.filter(row => row.source !== 'roles'); value.coverage.mandatory = ['global']; value.coverage.complete = ['global']; value.coverage.incomplete = [] }],
  ['disabled identity', value => { value.accounts[0].identity!.accountEnabled = false }],
  ['synced candidate', value => { value.accounts[0].methods![0].passkeyType = 'synced' }],
  ['complete empty methods', value => { value.accounts[0].methods = [] }],
  ['malformed credential', value => { value.accounts[0].methods![0].aaguid = null }],
  ['unapproved candidate', value => { value.accounts[0].methods!.push({ ...value.accounts[0].methods![0], id: 'other', approved: false }) }],
  ['wrong account', value => { value.accounts[0].signIns![0].userId = 'other' }],
  ['wrong tenant', value => { value.accounts[0].signIns![0].tenantId = 'other' }],
  ['wrong application', value => { value.accounts[0].signIns![0].appId = 'other' }],
  ['wrong resource', value => { value.accounts[0].signIns![0].resourceId = 'other' }],
  ['one account only', value => { value.accounts[1].signIns = [] }],
  ['old authentication step', value => { value.accounts[0].signIns![0].steps[0].at = '2025-12-31T23:59:00Z' }],
  ['reused claim', value => { value.accounts[0].signIns![0].reusedClaim = true }],
  ['missing processing evidence', value => { value.accounts[0].signIns![0].reusedClaim = null }],
  ['reused step result', value => { value.accounts[0].signIns![0].steps[0].resultDetail = 'previouslysatisfied' }],
  ['event before baseline', value => { value.accounts[0].signIns![0].at = '2025-12-31T23:59:00Z' }],
  ['event after window', value => { value.accounts[0].signIns![0].at = '2026-01-01T00:11:00Z' }],
  ['incomplete membership source', value => { const request = value.requests.find(row => row.source === 'memberships:account-a')!; request.continuationComplete = false; request.status = 'error' }],
  ['relevant configuration change', value => { value.audits = [{ id: 'new-audit', at: '2026-01-01T00:06:00Z', category: null, activityKind: 'passkey-policy', relevant: true, targets: [] }] }],
  ['change and revert evidence', value => { value.audits = [{ id: 'new-audit', at: '2026-01-01T00:06:00Z', category: null, activityKind: 'passkey-policy', relevant: true, targets: [{ id: 'group-a', kind: 'group', modified: [{ property: null, oldValue: { unsupported: true }, newValue: { unsupported: true }, preserved: false }] }] }] }],
]
for (const [name, change] of negatives) test(`logical proof rejects ${name}`, () => { const result = evaluateDiagnosticPair(validArtifact('baseline'), mutate(validArtifact('confirming'), change)); assert.equal(result.logicalSupported, false, name); assert.ok(result.accounts.some(account => account.result !== 'supported') || result.assertions.some(assertion => assertion.result === 'unsupported')) })

test('unrelated audit activity does not reset the logical window', () => {
  const confirming = mutate(validArtifact('confirming'), value => { value.audits = [{ id: 'new-audit', at: '2026-01-01T00:06:00Z', category: null, activityKind: 'group-membership', relevant: true, targets: [{ id: 'other-group', kind: 'group', modified: [] }] }] })
  assert.equal(evaluateDiagnosticPair(validArtifact('baseline'), confirming).logicalSupported, true)
})

test('baseline candidates and endpoint configuration are mandatory proof inputs', () => {
  const missing = mutate(validArtifact('baseline'), value => { value.accounts[0].methods = [] })
  assert.equal(evaluateDiagnosticPair(missing, validArtifact('confirming')).logicalSupported, false)
  const changed = mutate(validArtifact('confirming'), value => { (value.policy.configurations![0] as any).state = 'disabled' })
  assert.equal(evaluateDiagnosticPair(validArtifact('baseline'), changed).logicalSupported, false)
})

test('a relevant mutation observed during baseline acquisition invalidates the window', () => {
  const baseline = mutate(validArtifact('baseline'), value => { value.audits = [{ id: 'baseline-change', at: '2026-01-01T00:00:30Z', category: null, activityKind: 'conditional-access', relevant: true, targets: [{ id: 'policy-a', kind: 'policy', modified: [] }] }] })
  assert.equal(evaluateDiagnosticPair(baseline, validArtifact('confirming')).logicalSupported, false)
})

test('a changed tenant, account set, or configuration intent invalidates the pair', () => {
  for (const change of [(value: EmergencyDiagnosticArtifact) => { value.context.tenant = 'other' }, (value: EmergencyDiagnosticArtifact) => { value.context.accounts = ['account-a'] }, (value: EmergencyDiagnosticArtifact) => { value.context.configurationBasis = 'other' }]) assert.equal(evaluateDiagnosticPair(validArtifact('baseline'), mutate(validArtifact('confirming'), change)).sameContext, false)
})
