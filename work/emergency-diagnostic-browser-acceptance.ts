import { emptyMappingState } from '../src/mapping/types.ts'
import { EXCLUSIONS_RECORD_KEY, exclusionsGroupRecord } from '../src/mapping/safetyChoice.ts'
import { requiredModels } from '../src/roadmap/passkeySettings.ts'
import { downloadEmergencyDiagnosticPair, emergencyDiagnosticPairPayload, ENTRA_ADMIN_TARGET, runEmergencyDiagnosticEntry } from '../src/ui/emergencyDiagnosticDev.ts'

const TENANT = '10000000-0000-4000-8000-000000000001'
const GROUP = '20000000-0000-4000-8000-000000000002'
const ACCOUNTS = ['30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004']
const GLOBAL_ADMIN = '62e90394-69f5-4237-9190-012177145e10'
const SEEDED_PRIVATE = ['browser-private-token', 'owner.private@example.invalid', 'Private recovery key']
const mapping = emptyMappingState(TENANT)
mapping.breakGlassUserIds = [...ACCOUNTS]
mapping.records[EXCLUSIONS_RECORD_KEY] = { ...exclusionsGroupRecord(undefined, GROUP), resolvedName: 'Emergency Exclusions' }
const approved = requiredModels(mapping).map(model => model.aaguid)
let confirming = false

function body(url: string): unknown {
  const account = ACCOUNTS.find(id => url.includes(id))
  if (account && /\/users\/[^/]+\?/.test(url)) return { id: account, userPrincipalName: SEEDED_PRIVATE[1], userType: 'Member', accountEnabled: true, onPremisesSyncEnabled: false, createdDateTime: '2026-01-01T00:00:00Z' }
  if (account && url.includes('/authentication/fido2Methods')) return { value: [{ id: `method-${account}`, displayName: SEEDED_PRIVATE[2], aaGuid: approved[0], model: 'Private model', passkeyType: 'deviceBound', createdDateTime: '2026-01-01T00:00:00Z' }] }
  if (account && url.includes('/auditLogs/signIns')) {
    if (!confirming) return { value: [] }
    const now = new Date().toISOString()
    return { value: [{ id: `event-${account}`, createdDateTime: now, userId: account, homeTenantId: TENANT, appId: ENTRA_ADMIN_TARGET.appId, resourceId: ENTRA_ADMIN_TARGET.resourceId, status: { errorCode: 0 }, isInteractive: true, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ authenticationStepDateTime: now, authenticationMethod: 'FIDO2', authenticationMethodDetail: 'Passkey', authenticationStepResultDetail: 'success', succeeded: true }], authenticationProcessingDetails: [{ key: 'Authentication protocol', value: 'FIDO2' }] }] }
  }
  if (account && url.includes('/transitiveMemberOf')) return { value: [{ id: GROUP, '@odata.type': '#microsoft.graph.group' }] }
  if (url.includes('/authenticationMethodConfigurations/Fido2')) return { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: GROUP, targetType: 'group', allowedPasskeyProfiles: ['profile-a'] }], excludeTargets: [], passkeyProfiles: [{ id: 'profile-a', passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: approved } }] }
  if (url.includes('/conditionalAccess/policies')) return { value: [{ id: 'policy-a', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [GROUP] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }] }
  if (url.includes('/authenticationStrength/policies')) return { value: [{ id: 'strength-a', policyType: 'builtIn', requirementsSatisfied: 'mfa', allowedCombinations: ['fido2', 'password,microsoftAuthenticatorPush'] }] }
  if (url.includes('/roleAssignmentScheduleInstances')) return { value: ACCOUNTS.map((id, index) => ({ id: `schedule-${index}`, principalId: id, roleDefinitionId: GLOBAL_ADMIN, directoryScopeId: '/', assignmentType: 'Assigned', startDateTime: '2026-01-01T00:00:00Z', endDateTime: null, status: 'Provisioned' })) }
  if (url.includes('/roleAssignments')) return { value: ACCOUNTS.map((id, index) => ({ id: `role-${index}`, principalId: id, roleDefinitionId: GLOBAL_ADMIN, directoryScopeId: '/' })) }
  if (url.includes('/directoryAudits')) return { value: [] }
  if (url.includes(`/groups/${GROUP}?`)) return { id: GROUP, membershipRule: null, membershipRuleProcessingState: null, mailEnabled: false, securityEnabled: true, groupTypes: [], isAssignableToRole: false, assignedLicenses: [] }
  if (url.includes(`/groups/${GROUP}/members`)) return { value: ACCOUNTS.map(id => ({ id, displayName: 'Private account', userPrincipalName: SEEDED_PRIVATE[1], '@odata.type': '#microsoft.graph.user' })) }
  if (url.includes(`/groups/${GROUP}/owners`)) return { value: [] }
  if (url.includes('eligibilityScheduleInstances') || url.includes('assignmentScheduleInstances') || url.includes('accessPackageCatalogs')) return { value: [] }
  throw new Error(`Unhandled Graph URL: ${url}`)
}

const load = async () => mapping
const loadSnapshot = async () => null
const tokens = async () => ({ get: () => SEEDED_PRIVATE[0], refresh: async () => SEEDED_PRIVATE[0] })
const result = document.querySelector<HTMLPreElement>('#result')!
const download = document.querySelector<HTMLButtonElement>('#download')!
document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click', async () => {
  const before = globalThis.fetch
  globalThis.fetch = async request => new Response(JSON.stringify(body(String(request))), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
    await runEmergencyDiagnosticEntry(TENANT, 'baseline', { load, loadSnapshot, tokens, kind: 'synthetic' })
    await new Promise(resolve => setTimeout(resolve, 20))
    confirming = true
    const confirmation = await runEmergencyDiagnosticEntry(TENANT, 'confirming', { load, loadSnapshot, tokens, kind: 'synthetic' })
    const payload = emergencyDiagnosticPairPayload()
    const serialized = JSON.stringify(payload)
    const summary = {
      baselineSchema: payload.baseline.schema,
      confirmingSchema: payload.confirming?.schema ?? null,
      logicalSupported: confirmation.evaluation?.logicalSupported ?? false,
      supported: confirmation.evaluation?.supported ?? null,
      providerAssurance: confirmation.evaluation?.providerAssurance ?? null,
      sameContext: confirmation.evaluation?.sameContext ?? false,
      complete: confirmation.evaluation?.complete ?? false,
      seededPrivateValuesAbsent: SEEDED_PRIVATE.every(value => !serialized.includes(value)),
      accountResults: confirmation.evaluation?.accounts.map(account => account.result) ?? [],
      accountReasons: confirmation.evaluation?.accounts.map(account => account.reasons) ?? [],
    }
    ;(window as unknown as { __diagnosticAcceptance: unknown }).__diagnosticAcceptance = { summary, payload }
    result.textContent = JSON.stringify(summary, null, 2)
    download.disabled = false
  } catch (error) {
    result.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
    throw error
  } finally {
    globalThis.fetch = before
  }
})
download.addEventListener('click', () => { void downloadEmergencyDiagnosticPair(TENANT, load, loadSnapshot) })
