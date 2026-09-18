import { BETA, graphRequest, V1 } from '../src/graph/collect/http.ts'
import type { TokenSource } from '../src/graph/collect/http.ts'

export type DiagnosticStatus = 'ok' | 'error' | 'denied' | 'unsupported'
export type ProofResult = 'supported' | 'unsupported' | 'still unvalidated'
export type RequestResult = {
  source: string; endpoint: string; version: 'v1.0' | 'beta'; requested: string[]; returned: string[]
  startedAt: string; endedAt: string; pages: number; rows: number; continuationComplete: boolean
  requiredFieldsPresent: boolean; status: DiagnosticStatus
  error?: { kind: string; status: number | null; code: string | null }
}
export type SanitizedMethod = { id: string; displayName: null; aaguid: string | null; passkeyType: string | null; attestationLevel: string | null; model: null; createdAt: string | null; approved: boolean | null }
export type SanitizedSignIn = {
  id: string; at: string | null; userId: string | null; tenantId: string | null; appId: string | null; resourceId: string | null
  success: boolean | null; interactive: boolean | null; authenticationRequirement: string | null; reusedClaim: boolean | null
  steps: { at: string | null; method: string | null; detail: string | null; resultDetail: string | null; succeeded: boolean | null }[]
}
export type SanitizedObject = { id: string; kind: string; displayName: null; userPrincipalName: null }
export type SanitizedAudit = {
  id: string; at: string | null; category: string | null
  activityKind: 'passkey-policy' | 'conditional-access' | 'group-membership' | 'role' | 'unrelated' | 'unknown'
  relevant: boolean | null
  targets: { id: string | null; kind: string; modified: { property: string | null; oldValue: unknown; newValue: unknown; preserved: boolean }[] }[]
}
export type DiagnosticContext = {
  tenant: string; accounts: string[]; group: string | null; configurationBasis: string
  expectedTarget: { appId: string; resourceId: string }; approvedAaguids: string[]
}
export type EmergencyDiagnosticArtifact = {
  schema: 3; kind: 'synthetic' | 'real'; captureId: string; startedAt: string; endedAt: string; context: DiagnosticContext
  requests: RequestResult[]; coverage: { mandatory: string[]; complete: string[]; incomplete: string[] }
  accounts: { account: string; identity: { id: string; tenantId: string | null; accountEnabled: boolean | null; cloudOnly: boolean | null } | null; methods: SanitizedMethod[] | null; signIns: SanitizedSignIn[] | null; memberships: string[] | null }[]
  policy: { configurations: unknown[] | null; conditionalAccess: unknown[] | null; authenticationStrengths: unknown[] | null }; roles: unknown[] | null; roleSchedules: unknown[] | null; audits: SanitizedAudit[] | null
  group: { id: string; properties: Record<string, unknown> | null; directMembers: SanitizedObject[] | null; owners: SanitizedObject[] | null } | null
  advancedRoutes: { route: string; status: DiagnosticStatus; rows: number | null; records: unknown[] | null }[]
  disposition: { assertion: string; result: ProofResult; reason: string }[]; providerAssurance: 'unvalidated'
}
export type DiagnosticInput = {
  accountIds: string[]; groupId?: string | null; tenantId: string; expectedTarget: { appId: string; resourceId: string }
  approvedAaguids: string[]; configurationBasis: string; kind?: 'synthetic' | 'real'; secret: string; observationStart?: string | null
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const STORAGE = new Set(['devicebound', 'synced'])
const AUTHENTICATION_METHOD_MODES = ['password', 'voice', 'hardwareOath', 'softwareOath', 'sms', 'fido2', 'windowsHelloForBusiness', 'microsoftAuthenticatorPush', 'deviceBasedPush', 'temporaryAccessPassOneTime', 'temporaryAccessPassMultiUse', 'email', 'x509CertificateSingleFactor', 'x509CertificateMultiFactor', 'federatedSingleFactor', 'federatedMultiFactor', 'unknownFutureValue'] as const
const SAFE_ENUMS = new Set(['enabled', 'disabled', 'reportonly', 'success', 'failure', 'group', 'user', 'serviceprincipal', 'device', 'other', 'allow', 'block', 'registrationonly', 'devicebound', 'synced', 'singlefactorauthentication', 'multifactorauthentication', 'browser', 'primaryauthentication', 'previouslysatisfied', 'satisfiedbyclaiminthetoken', 'fido2', 'passkey', 'none', 'coreirectorymanagement', 'groupmanagement', 'rolemanagement'])
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null
const lower = (value: unknown): string | null => text(value)?.toLowerCase() ?? null

export function createDiagnosticPseudonymizer(secret: string) {
  if (!secret) throw new Error('A private per-pair diagnostic secret is required.')
  return async (entity: string, value: string | null): Promise<string | null> => {
    if (!value) return null
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}\u0000${entity}\u0000${value.toLowerCase()}`)))
    return `${entity}_${[...digest.slice(0, 9)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
  }
}

const errorOf = (error: unknown): RequestResult['error'] => { const row = object(error); return { kind: error instanceof Error ? error.name : 'UnknownError', status: typeof row?.status === 'number' ? row.status : null, code: typeof row?.code === 'string' ? row.code : null } }
const statusOf = (error: RequestResult['error']): DiagnosticStatus => error?.status === 403 ? 'denied' : error?.status === 404 ? 'unsupported' : 'error'
const fieldSet = (rows: unknown[]): string[] => [...new Set(rows.flatMap(value => Object.keys(object(value) ?? {})))].sort()
const hasRequired = (rows: unknown[], required: string[]) => rows.length === 0 || rows.every(value => { const row = object(value); return !!row && required.every(field => field in row) })

async function paged(tokens: TokenSource, source: string, endpoint: string, requested: string[], requests: RequestResult[], required: string[] = [], recorded = endpoint): Promise<unknown[] | null> {
  const startedAt = new Date().toISOString(); const rows: unknown[] = []; let pages = 0; let next: string | null = endpoint
  try {
    while (next) {
      const body = await graphRequest(tokens, next); pages += 1
      if (!Array.isArray(body.value)) throw new Error('Collection page omitted value.')
      rows.push(...body.value)
      const link = body['@odata.nextLink']; if (link != null && typeof link !== 'string') throw new Error('Collection page returned a malformed continuation.')
      next = link ?? null
    }
    const requiredFieldsPresent = hasRequired(rows, required)
    requests.push({ source, endpoint: recorded, version: endpoint.startsWith(BETA) ? 'beta' : 'v1.0', requested, returned: fieldSet(rows), startedAt, endedAt: new Date().toISOString(), pages, rows: rows.length, continuationComplete: true, requiredFieldsPresent, status: requiredFieldsPresent ? 'ok' : 'error', ...(requiredFieldsPresent ? {} : { error: { kind: 'RequiredFieldMissing', status: null, code: null } }) })
    return requiredFieldsPresent ? rows : null
  } catch (caught) {
    const error = errorOf(caught)
    requests.push({ source, endpoint: recorded, version: endpoint.startsWith(BETA) ? 'beta' : 'v1.0', requested, returned: fieldSet(rows), startedAt, endedAt: new Date().toISOString(), pages, rows: rows.length, continuationComplete: false, requiredFieldsPresent: false, status: statusOf(error), error })
    return rows.length ? rows : null
  }
}

async function single(tokens: TokenSource, source: string, endpoint: string, requested: string[], requests: RequestResult[], required: string[] = [], recorded = endpoint, nested: string[] = []): Promise<Record<string, unknown> | null> {
  const startedAt = new Date().toISOString(); let body: Record<string, unknown> | null = null; let pages = 0
  try {
    body = await graphRequest(tokens, endpoint) as Record<string, unknown>; pages = 1
    for (const field of nested) {
      let next = text(body[`${field}@odata.nextLink`])
      if (!Array.isArray(body[field]) && !next) continue
      const values = Array.isArray(body[field]) ? [...body[field] as unknown[]] : []
      while (next) {
        const page = await graphRequest(tokens, next) as Record<string, unknown>; pages += 1
        if (!Array.isArray(page.value)) throw new Error(`Nested ${field} page omitted value.`)
        values.push(...page.value)
        body[field] = values
        const link = page['@odata.nextLink']; if (link != null && typeof link !== 'string') throw new Error(`Nested ${field} page returned a malformed continuation.`)
        next = link ?? null
      }
      body[field] = values; delete body[`${field}@odata.nextLink`]
    }
    if (!body) throw new Error('Single-object response was empty.')
    const resultBody = body; const requiredFieldsPresent = required.every(field => field in resultBody)
    requests.push({ source, endpoint: recorded, version: endpoint.startsWith(BETA) ? 'beta' : 'v1.0', requested, returned: Object.keys(resultBody).sort(), startedAt, endedAt: new Date().toISOString(), pages, rows: 1, continuationComplete: true, requiredFieldsPresent, status: requiredFieldsPresent ? 'ok' : 'error', ...(requiredFieldsPresent ? {} : { error: { kind: 'RequiredFieldMissing', status: null, code: null } }) })
    return requiredFieldsPresent ? resultBody : null
  } catch (caught) {
    const error = errorOf(caught)
    requests.push({ source, endpoint: recorded, version: endpoint.startsWith(BETA) ? 'beta' : 'v1.0', requested, returned: body ? Object.keys(body).sort() : [], startedAt, endedAt: new Date().toISOString(), pages, rows: body ? 1 : 0, continuationComplete: false, requiredFieldsPresent: false, status: statusOf(error), error })
    return body
  }
}

type RedactionContext = { pseudo: ReturnType<typeof createDiagnosticPseudonymizer>; groupId: string | null }
async function canonicalDirectoryId(value: string, ctx: RedactionContext): Promise<string> { return ctx.groupId && value.toLowerCase() === ctx.groupId.toLowerCase() ? (await ctx.pseudo('group', value))! : (await ctx.pseudo('directory', value))! }
function safeEnum(value: string): string | null { const normalized = value.replace(/[\s_-]/g, '').toLowerCase(); return SAFE_ENUMS.has(normalized) ? normalized : null }

async function sanitizeValue(key: string, raw: unknown, ctx: RedactionContext): Promise<unknown> {
  if (raw === null || typeof raw === 'boolean' || typeof raw === 'number') return raw
  if (Array.isArray(raw)) return Promise.all(raw.map(value => sanitizeValue(key, value, ctx)))
  const row = object(raw); if (row) return sanitizeObjectRecord(row, ctx)
  if (typeof raw !== 'string') return null
  const value = raw.trim(); if (!value) return null
  if (/oldValue|newValue/i.test(key)) { try { return sanitizeValue('auditValue', JSON.parse(value), ctx) } catch { return { unsupported: true } } }
  if (/aaGuid/i.test(key) && GUID.test(value)) return value.toLowerCase()
  if (/date|time|created|updated/i.test(key) && ISO.test(value)) return value
  if (/tenantId/i.test(key) && GUID.test(value)) return ctx.pseudo('tenant', value)
  if (/appId/i.test(key) && GUID.test(value)) return ctx.pseudo('application', value)
  if (/resourceId/i.test(key) && GUID.test(value)) return ctx.pseudo('resource', value)
  if (/profile/i.test(key) && GUID.test(value)) return ctx.pseudo('profile', value)
  if (/^(id|userId|targetId|groupId|principalId|roleDefinitionId|directoryScopeId)$/i.test(key)) return value === 'all_users' ? value : canonicalDirectoryId(value, ctx)
  return safeEnum(value)
}

async function sanitizeObjectRecord(row: Record<string, unknown>, ctx: RedactionContext): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (/token|cookie|secret|password|phone|displayName|userPrincipalName|initiatedBy|url|message|reason|error/i.test(key)) continue
    const safe = await sanitizeValue(key, value, ctx); if (safe !== null && safe !== undefined) out[key] = safe
  }
  return out
}

const oneOf = (value: unknown, allowed: readonly string[]): string | null => {
  const candidate = text(value); if (!candidate) return null
  return allowed.find(item => item.toLowerCase() === candidate.toLowerCase()) ?? null
}
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const canonicalMany = async (kind: string, values: unknown, ctx: RedactionContext, sentinels: readonly string[] = []): Promise<(string | null)[]> => Promise.all(stringArray(values).map(async value => sentinels.find(item => item.toLowerCase() === value.toLowerCase()) ?? ctx.pseudo(kind, value)))

async function sanitizeTarget(raw: unknown, ctx: RedactionContext): Promise<Record<string, unknown> | null> {
  const row = object(raw); const id = text(row?.id)
  if (!row || !id) return { malformed: true, targetType: 'unknown' }
  return {
    id: id.toLowerCase() === 'all_users' ? 'all_users' : (await ctx.pseudo('group', id))!,
    targetType: oneOf(row.targetType, ['group']) ?? 'unknown',
    ...(typeof row.isRegistrationRequired === 'boolean' ? { isRegistrationRequired: row.isRegistrationRequired } : {}),
    ...(Array.isArray(row.allowedPasskeyProfiles) ? { allowedPasskeyProfiles: (await canonicalMany('profile', row.allowedPasskeyProfiles, ctx)).filter(Boolean) } : {}),
  }
}

async function sanitizePasskeyConfiguration(row: Record<string, unknown>, ctx: RedactionContext): Promise<Record<string, unknown>> {
  const profiles = await Promise.all((Array.isArray(row.passkeyProfiles) ? row.passkeyProfiles : []).map(async raw => {
    const profile = object(raw); const id = text(profile?.id); if (!profile || !id) return null
    const restrictions = object(profile.keyRestrictions)
    const rawTypes = String(profile.passkeyTypes ?? '').split(',').map(value => value.trim()).filter(Boolean)
    const knownTypes = rawTypes.map(value => oneOf(value, ['deviceBound', 'synced']))
    const passkeyTypes = rawTypes.length > 0 && knownTypes.every(Boolean) ? knownTypes.map(value => value!.toLowerCase()).join(',') : 'unknown'
    return {
      id: (await ctx.pseudo('profile', id))!,
      passkeyTypes,
      attestationEnforcement: oneOf(profile.attestationEnforcement, ['registrationOnly', 'disabled']) ?? 'unknown',
      keyRestrictions: restrictions ? {
        isEnforced: typeof restrictions.isEnforced === 'boolean' ? restrictions.isEnforced : null,
        enforcementType: oneOf(restrictions.enforcementType, ['allow', 'block']) ?? 'unknown',
        aaGuids: stringArray(restrictions.aaGuids).map(value => GUID.test(value) ? value.toLowerCase() : null),
      } : null,
    }
  }))
  const targets = async (value: unknown) => (await Promise.all((Array.isArray(value) ? value : []).map(raw => sanitizeTarget(raw, ctx)))).filter(Boolean)
  const restrictions = object(row.keyRestrictions)
  return {
    id: lower(row.id) === 'fido2' ? 'fido2' : 'unknown',
    state: oneOf(row.state, ['enabled', 'disabled']) ?? 'unknown',
    isSelfServiceRegistrationAllowed: typeof row.isSelfServiceRegistrationAllowed === 'boolean' ? row.isSelfServiceRegistrationAllowed : null,
    isAttestationEnforced: typeof row.isAttestationEnforced === 'boolean' ? row.isAttestationEnforced : null,
    includeTargets: await targets(row.includeTargets), excludeTargets: await targets(row.excludeTargets),
    ...(text(row.defaultPasskeyProfile) ? { defaultPasskeyProfile: await ctx.pseudo('profile', text(row.defaultPasskeyProfile)) } : {}),
    passkeyProfiles: profiles.filter(Boolean),
    ...(restrictions ? { keyRestrictions: { isEnforced: typeof restrictions.isEnforced === 'boolean' ? restrictions.isEnforced : null, enforcementType: oneOf(restrictions.enforcementType, ['allow', 'block']) ?? 'unknown', aaGuids: stringArray(restrictions.aaGuids).map(value => GUID.test(value) ? value.toLowerCase() : null) } } : {}),
  }
}

async function sanitizeConditionalAccess(raw: unknown, ctx: RedactionContext): Promise<Record<string, unknown> | null> {
  const row = object(raw); const id = text(row?.id); if (!row || !id) return null
  const conditions = object(row.conditions); const users = object(conditions?.users); const grant = object(row.grantControls)
  return {
    id: (await ctx.pseudo('policy', id))!,
    state: oneOf(row.state, ['enabled', 'disabled', 'enabledForReportingButNotEnforced']) ?? 'unknown',
    conditions: { users: {
      includeUsers: await canonicalMany('directory', users?.includeUsers, ctx, ['All', 'GuestsOrExternalUsers', 'None']),
      excludeUsers: await canonicalMany('directory', users?.excludeUsers, ctx, ['All', 'GuestsOrExternalUsers', 'None']),
      includeGroups: (await canonicalMany('group', users?.includeGroups, ctx)).filter(Boolean),
      excludeGroups: (await canonicalMany('group', users?.excludeGroups, ctx)).filter(Boolean),
    } },
    grantControls: grant ? { operator: oneOf(grant.operator, ['OR', 'AND']) ?? 'unknown', builtInControls: stringArray(grant.builtInControls).map(value => oneOf(value, ['mfa', 'compliantDevice', 'domainJoinedDevice', 'approvedApplication', 'compliantApplication', 'passwordChange', 'block']) ?? 'unknown'), authenticationStrengthId: text(grant.authenticationStrengthId) || text(object(grant.authenticationStrength)?.id) ? await ctx.pseudo('configuration', text(grant.authenticationStrengthId) ?? text(object(grant.authenticationStrength)?.id)) : null } : null,
  }
}

async function sanitizeAuthenticationStrength(raw: unknown, ctx: RedactionContext): Promise<Record<string, unknown> | null> {
  const row = object(raw); const id = text(row?.id); if (!row || !id) return null
  return { id: (await ctx.pseudo('configuration', id))!, policyType: oneOf(row.policyType, ['builtIn', 'custom']) ?? 'unknown', requirementsSatisfied: oneOf(row.requirementsSatisfied, ['mfa', 'none']) ?? 'unknown', allowedCombinations: stringArray(row.allowedCombinations).map(value => value.split(',').map(part => oneOf(part.trim(), AUTHENTICATION_METHOD_MODES)).every(Boolean) ? value : 'unknown') }
}

async function sanitizeRoleRecord(raw: unknown, ctx: RedactionContext): Promise<Record<string, unknown> | null> {
  const row = object(raw); const id = text(row?.id); if (!row || !id) return null
  const roleDefinition = text(row.roleDefinitionId)
  return { id: (await ctx.pseudo('roleAssignment', id))!, principalId: await ctx.pseudo('directory', text(row.principalId)), roleDefinitionId: roleDefinition?.toLowerCase() === '62e90394-69f5-4237-9190-012177145e10' ? roleDefinition.toLowerCase() : await ctx.pseudo('roleDefinition', roleDefinition), directoryScopeId: text(row.directoryScopeId) === '/' ? '/' : await ctx.pseudo('directoryScope', text(row.directoryScopeId)), ...(row.assignmentType !== undefined ? { assignmentType: oneOf(row.assignmentType, ['Assigned', 'Activated', 'Eligible']) ?? 'unknown' } : {}), ...(row.status !== undefined ? { status: oneOf(row.status, ['Active', 'Granted', 'Provisioned', 'Revoked', 'Canceled', 'Cancelled', 'Expired']) ?? 'unknown' } : {}), startDateTimeKnown: 'startDateTime' in row, endDateTimeKnown: 'endDateTime' in row, startDateTime: text(row.startDateTime), endDateTime: text(row.endDateTime) }
}

async function sanitizeGroupProperties(row: Record<string, unknown>, ctx: RedactionContext): Promise<Record<string, unknown>> {
  return { id: (await ctx.pseudo('group', text(row.id)))!, membershipRulePresent: !!text(row.membershipRule), membershipRuleProcessingState: oneOf(row.membershipRuleProcessingState, ['On', 'Paused']) ?? (row.membershipRuleProcessingState === null ? null : 'unknown'), mailEnabled: typeof row.mailEnabled === 'boolean' ? row.mailEnabled : null, securityEnabled: typeof row.securityEnabled === 'boolean' ? row.securityEnabled : null, groupTypes: stringArray(row.groupTypes).map(value => oneOf(value, ['DynamicMembership', 'Unified']) ?? 'unknown'), isAssignableToRole: typeof row.isAssignableToRole === 'boolean' ? row.isAssignableToRole : null, assignedLicenseCount: Array.isArray(row.assignedLicenses) ? row.assignedLicenses.length : null }
}

async function sanitizeAdvanced(route: string, raw: unknown, ctx: RedactionContext): Promise<unknown> {
  const row = object(raw); if (!row) return { unsupported: true }
  if (route === 'pim-group-eligibility' || route === 'pim-group-assignments') return { id: await ctx.pseudo('schedule', text(row.id)), principalId: await ctx.pseudo('directory', text(row.principalId)), groupId: await ctx.pseudo('group', text(row.groupId)), accessId: oneOf(row.accessId, ['member', 'owner']) ?? 'unknown', startDateTime: text(row.startDateTime), endDateTime: text(row.endDateTime) }
  if (route === 'entitlement-resources') return { id: await ctx.pseudo('entitlementCatalog', text(row.id)), accessPackageResources: await Promise.all((Array.isArray(row.accessPackageResources) ? row.accessPackageResources : []).map(async rawResource => { const resource = object(rawResource); return resource ? { id: await ctx.pseudo('entitlementResource', text(resource.id)), originId: await ctx.pseudo('group', text(resource.originId)) } : { unsupported: true } })) }
  return { unsupported: true }
}

async function completeNested(tokens: TokenSource, parents: Record<string, unknown>[], fields: string[], request: RequestResult): Promise<boolean> {
  try {
    for (const parent of parents) for (const field of fields) {
      let next = text(parent[`${field}@odata.nextLink`])
      if (!Array.isArray(parent[field]) && !next) return false
      const values = Array.isArray(parent[field]) ? [...parent[field] as unknown[]] : []
      while (next) {
        const page = await graphRequest(tokens, next) as Record<string, unknown>; request.pages += 1
        if (!Array.isArray(page.value)) throw new Error(`Nested ${field} page omitted value.`)
        values.push(...page.value)
        parent[field] = values
        const link = page['@odata.nextLink']; if (link != null && typeof link !== 'string') throw new Error(`Nested ${field} page returned a malformed continuation.`)
        next = link ?? null
      }
      parent[field] = values; delete parent[`${field}@odata.nextLink`]
    }
    return true
  } catch (caught) {
    request.continuationComplete = false; request.requiredFieldsPresent = false; request.status = statusOf(errorOf(caught)); request.error = errorOf(caught)
    return false
  }
}

async function sanitizeDirectoryObject(raw: unknown, ctx: RedactionContext): Promise<SanitizedObject | null> {
  const row = object(raw); const rawId = text(row?.id); if (!row || !rawId) return null
  const type = lower(row['@odata.type']) ?? ''
  return { id: await canonicalDirectoryId(rawId, ctx), kind: type.endsWith('.user') ? 'user' : type.endsWith('.group') ? 'group' : type.endsWith('.serviceprincipal') ? 'servicePrincipal' : type.endsWith('.device') ? 'device' : 'other', displayName: null, userPrincipalName: null }
}
function auditKind(row: Record<string, unknown>): SanitizedAudit['activityKind'] {
  const source = `${text(row.activityDisplayName) ?? ''} ${text(row.category) ?? ''}`.toLowerCase()
  if (/fido|passkey|authentication method/.test(source)) return 'passkey-policy'
  if (/conditional access/.test(source)) return 'conditional-access'
  if (/group|member/.test(source)) return 'group-membership'
  if (/role|administrator/.test(source)) return 'role'
  if (/license|device registration|user profile/.test(source)) return 'unrelated'
  return 'unknown'
}
async function sanitizeAuditValue(propertyName: string, raw: unknown, ctx: RedactionContext): Promise<{ value: unknown; preserved: boolean }> {
  let parsed = raw
  if (typeof raw === 'string') { try { parsed = JSON.parse(raw) } catch { parsed = raw } }
  const property = propertyName.replace(/[\s_-]/g, '').toLowerCase()
  const kind = /policy/.test(property) ? 'policy' : /group/.test(property) ? 'group' : /profile/.test(property) ? 'profile' : /member|principal|user|role/.test(property) ? 'directory' : null
  if (!kind) return { value: { unsupported: true }, preserved: false }
  const map = async (value: unknown): Promise<unknown> => {
    if (typeof value === 'string') return ctx.pseudo(kind, value)
    if (Array.isArray(value)) return Promise.all(value.map(map))
    const row = object(value); if (!row) return { unsupported: true }
    const out: Record<string, unknown> = {}
    if (text(row.id)) out.id = await ctx.pseudo(kind, text(row.id))
    if (text(row.value)) out.value = await ctx.pseudo(kind, text(row.value))
    return Object.keys(out).length ? out : { unsupported: true }
  }
  const value = await map(parsed)
  const preserved = !JSON.stringify(value).includes('"unsupported":true')
  return { value, preserved }
}
async function sanitizeAudit(raw: unknown, ctx: RedactionContext): Promise<SanitizedAudit | null> {
  const row = object(raw); const rawId = text(row?.id); if (!row || !rawId) return null
  const activityKind = auditKind(row); const targets: SanitizedAudit['targets'] = []
  for (const rawTarget of Array.isArray(row.targetResources) ? row.targetResources : []) {
    const target = object(rawTarget); if (!target) continue
    const modified: SanitizedAudit['targets'][number]['modified'] = []
    for (const rawProperty of Array.isArray(target.modifiedProperties) ? target.modifiedProperties : []) {
      const property = object(rawProperty); if (!property) continue
      const propertyName = text(property.displayName) ?? ''; const oldResult = await sanitizeAuditValue(propertyName, property.oldValue, ctx); const newResult = await sanitizeAuditValue(propertyName, property.newValue, ctx)
      modified.push({ property: propertyName ? propertyName.replace(/[^a-z0-9]/gi, '').toLowerCase() : null, oldValue: oldResult.value, newValue: newResult.value, preserved: oldResult.preserved && newResult.preserved })
    }
    const targetId = text(target.id); const targetType = lower(target.type)
    const targetEntity = targetType === 'user' || targetType === 'serviceprincipal' ? 'directory' : activityKind === 'conditional-access' ? 'policy' : activityKind === 'passkey-policy' ? (targetId?.toLowerCase() === 'fido2' ? 'configuration' : 'profile') : activityKind === 'group-membership' ? 'group' : 'directory'
    const canonicalTarget = activityKind === 'passkey-policy' && targetId?.toLowerCase() === 'fido2' ? 'fido2' : targetId ? await ctx.pseudo(targetEntity, targetId) : null
    targets.push({ id: canonicalTarget, kind: safeEnum(text(target.type) ?? '') ?? 'other', modified })
  }
  return { id: (await ctx.pseudo('event', rawId))!, at: text(row.activityDateTime), category: safeEnum(text(row.category) ?? ''), activityKind, relevant: activityKind === 'unknown' ? null : activityKind !== 'unrelated', targets }
}
const requestComplete = (request: RequestResult | undefined) => !!request && request.status === 'ok' && request.continuationComplete && request.requiredFieldsPresent
function semanticRequest(requests: RequestResult[], source: string, complete: boolean): void {
  if (complete) return
  const request = requests.find(row => row.source === source); if (!request) return
  if (request.status !== 'ok') return
  request.requiredFieldsPresent = false; request.status = 'error'; request.error = { kind: 'SemanticEvidenceIncomplete', status: null, code: null }
}

export async function captureEmergencyAccessDiagnostic(tokens: TokenSource, input: DiagnosticInput): Promise<EmergencyDiagnosticArtifact> {
  if (!input.accountIds.length) throw new Error('At least one selected account is required.')
  if (!text(input.tenantId) || !text(input.configurationBasis) || !text(input.expectedTarget.appId) || !text(input.expectedTarget.resourceId)) throw new Error('Tenant, target, and configuration basis are required.')
  const startedAt = new Date().toISOString(); const pseudo = createDiagnosticPseudonymizer(input.secret); const ctx: RedactionContext = { pseudo, groupId: input.groupId ?? null }; const requests: RequestResult[] = []
  const signInSince = input.observationStart && Number.isFinite(Date.parse(input.observationStart)) ? input.observationStart : new Date(Date.now() - 30 * 86_400_000).toISOString()
  const mandatory: string[] = ['passkey-policy', 'conditional-access', 'authentication-strengths', 'roles', 'role-schedules', 'directory-audits']; const approved = new Set(input.approvedAaguids.map(value => value.toLowerCase())); const accounts: EmergencyDiagnosticArtifact['accounts'] = []
  for (const rawId of input.accountIds) {
    const account = (await pseudo('directory', rawId))!; const identitySource = `identity:${account}`; const methodSource = `methods:${account}`; const signInSource = `signins:${account}`; const membershipSource = `memberships:${account}`
    mandatory.push(identitySource, methodSource, signInSource, membershipSource)
    const identityRaw = await single(tokens, identitySource, `${V1}/users/${encodeURIComponent(rawId)}?$select=id,userPrincipalName,userType,accountEnabled,onPremisesSyncEnabled,createdDateTime`, ['id', 'userPrincipalName', 'userType', 'accountEnabled', 'onPremisesSyncEnabled', 'createdDateTime'], requests, ['id', 'accountEnabled', 'onPremisesSyncEnabled'], `${V1}/users/{account}`)
    const identityId = text(identityRaw?.id); const identity = identityRaw && identityId ? { id: await canonicalDirectoryId(identityId, ctx), tenantId: (await pseudo('tenant', input.tenantId))!, accountEnabled: typeof identityRaw.accountEnabled === 'boolean' ? identityRaw.accountEnabled : null, cloudOnly: identityRaw.onPremisesSyncEnabled === null || identityRaw.onPremisesSyncEnabled === false ? true : identityRaw.onPremisesSyncEnabled === true ? false : null } : null
    const methodRows = await paged(tokens, methodSource, `${V1}/users/${encodeURIComponent(rawId)}/authentication/fido2Methods?$select=id,displayName,aaGuid,model,passkeyType,attestationLevel,createdDateTime`, ['id', 'displayName', 'aaGuid', 'model', 'passkeyType', 'attestationLevel', 'createdDateTime'], requests, ['id', 'aaGuid', 'passkeyType'], `${V1}/users/{account}/authentication/fido2Methods`)
    const methods: SanitizedMethod[] | null = methodRows === null ? null : []
    for (const raw of methodRows ?? []) { const row = object(raw); const rawMethodId = text(row?.id); if (!row || !rawMethodId) continue; const aaguid = lower(row.aaGuid); const passkeyType = safeEnum(text(row.passkeyType) ?? ''); const attestationLevel = oneOf(row.attestationLevel, ['attested', 'notAttested']); methods!.push({ id: (await pseudo('method', rawMethodId))!, displayName: null, aaguid: aaguid && GUID.test(aaguid) ? aaguid : null, passkeyType: passkeyType && STORAGE.has(passkeyType) ? passkeyType : null, attestationLevel: attestationLevel?.toLowerCase() ?? null, model: null, createdAt: text(row.createdDateTime), approved: aaguid && GUID.test(aaguid) ? approved.has(aaguid) : null }) }
    const signRows = await paged(tokens, signInSource, `${BETA}/auditLogs/signIns?$filter=userId%20eq%20'${encodeURIComponent(rawId)}'%20and%20createdDateTime%20ge%20${encodeURIComponent(signInSince)}&$top=100`, ['id', 'createdDateTime', 'userId', 'homeTenantId', 'appId', 'resourceId', 'status', 'isInteractive', 'authenticationRequirement', 'authenticationDetails', 'authenticationProcessingDetails'], requests, ['id', 'createdDateTime', 'userId', 'homeTenantId', 'appId', 'resourceId', 'status', 'isInteractive', 'authenticationDetails'], `${BETA}/auditLogs/signIns?$filter=userId%20eq%20'{account}'%20and%20createdDateTime%20ge%20{start}`)
    const signIns: SanitizedSignIn[] | null = signRows === null ? null : []
    for (const raw of signRows ?? []) {
      const row = object(raw); const status = object(row?.status); const rawEventId = text(row?.id); if (!row || !rawEventId) continue
      const processing = Array.isArray(row.authenticationProcessingDetails) ? row.authenticationProcessingDetails.map(object).filter(Boolean) as Record<string, unknown>[] : []
      const rawSteps = Array.isArray(row.authenticationDetails) ? row.authenticationDetails : []
      const reuse = processing.some(item => /previous|claim|token/i.test(`${text(item.key) ?? ''} ${text(item.value) ?? ''}`)) || rawSteps.some(rawStep => /previous|claim|token/i.test(text(object(rawStep)?.authenticationStepResultDetail) ?? ''))
      signIns!.push({ id: (await pseudo('event', rawEventId))!, at: text(row.createdDateTime), userId: await pseudo('directory', text(row.userId)), tenantId: await pseudo('tenant', text(row.homeTenantId)), appId: await pseudo('application', text(row.appId)), resourceId: await pseudo('resource', text(row.resourceId)), success: typeof status?.errorCode === 'number' ? status.errorCode === 0 : null, interactive: typeof row.isInteractive === 'boolean' ? row.isInteractive : null, authenticationRequirement: safeEnum(text(row.authenticationRequirement) ?? ''), reusedClaim: rawSteps.length || processing.length ? reuse : null, steps: await Promise.all(rawSteps.map(async rawStep => { const step = object(rawStep); const method = oneOf(step?.authenticationMethod, ['FIDO2', 'Passkey'])?.toLowerCase() ?? null; const detailRaw = text(step?.authenticationMethodDetail) ?? ''; const resultRaw = text(step?.authenticationStepResultDetail) ?? ''; return { at: text(step?.authenticationStepDateTime), method, detail: /fido|passkey/i.test(detailRaw) ? 'fido2' : safeEnum(detailRaw), resultDetail: resultRaw ? safeEnum(resultRaw) ?? (/previous|claim|token/i.test(resultRaw) ? 'previouslysatisfied' : 'unknown') : null, succeeded: typeof step?.succeeded === 'boolean' ? step.succeeded : null } })) })
    }
    const membershipRows = await paged(tokens, membershipSource, `${V1}/users/${encodeURIComponent(rawId)}/transitiveMemberOf?$select=id,@odata.type`, ['id', '@odata.type'], requests, ['id', '@odata.type'], `${V1}/users/{account}/transitiveMemberOf`)
    const memberships = membershipRows === null ? null : await Promise.all(membershipRows.map(row => text(object(row)?.id)).filter((value): value is string => !!value).map(value => ctx.pseudo('group', value) as Promise<string>))
    accounts.push({ account, identity, methods, signIns, memberships })
  }
  const configurationRaw = await single(tokens, 'passkey-policy', `${V1}/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/Fido2`, ['id', 'state', 'isSelfServiceRegistrationAllowed', 'isAttestationEnforced', 'includeTargets', 'excludeTargets', 'passkeyProfiles', 'keyRestrictions'], requests, ['id', 'state', 'isSelfServiceRegistrationAllowed', 'includeTargets', 'excludeTargets', 'passkeyProfiles'], `${V1}/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/Fido2`, ['passkeyProfiles'])
  const conditionalRaw = await paged(tokens, 'conditional-access', `${V1}/identity/conditionalAccess/policies`, ['id', 'state', 'conditions', 'grantControls'], requests, ['id', 'state', 'conditions', 'grantControls'])
  const strengthsRaw = await paged(tokens, 'authentication-strengths', `${V1}/identity/conditionalAccess/authenticationStrength/policies`, ['id', 'policyType', 'requirementsSatisfied', 'allowedCombinations'], requests, ['id', 'policyType', 'requirementsSatisfied', 'allowedCombinations'])
  const rolesRaw = await paged(tokens, 'roles', `${V1}/roleManagement/directory/roleAssignments`, ['id', 'principalId', 'roleDefinitionId', 'directoryScopeId'], requests, ['id', 'principalId', 'roleDefinitionId', 'directoryScopeId'])
  const roleSchedulesRaw = await paged(tokens, 'role-schedules', `${V1}/roleManagement/directory/roleAssignmentScheduleInstances?$select=id,principalId,roleDefinitionId,directoryScopeId,assignmentType,startDateTime,endDateTime,status`, ['id', 'principalId', 'roleDefinitionId', 'directoryScopeId', 'assignmentType', 'startDateTime', 'endDateTime', 'status'], requests, ['id', 'principalId', 'roleDefinitionId', 'directoryScopeId', 'assignmentType'])
  const auditSince = input.observationStart && Number.isFinite(Date.parse(input.observationStart)) ? input.observationStart : new Date(Date.now() - 30 * 86_400_000).toISOString()
  const auditRows = await paged(tokens, 'directory-audits', `${BETA}/auditLogs/directoryAudits?$filter=activityDateTime%20ge%20${encodeURIComponent(auditSince)}&$select=id,activityDateTime,activityDisplayName,category,result,targetResources&$top=100`, ['id', 'activityDateTime', 'activityDisplayName', 'category', 'result', 'targetResources'], requests, ['id', 'activityDateTime', 'activityDisplayName', 'category', 'targetResources'])
  const audits = auditRows === null ? null : (await Promise.all(auditRows.map(row => sanitizeAudit(row, ctx)))).filter((row): row is SanitizedAudit => row !== null)
  let group: EmergencyDiagnosticArtifact['group'] = null
  if (input.groupId) {
    mandatory.push('group', 'group-members')
    const properties = await single(tokens, 'group', `${V1}/groups/${encodeURIComponent(input.groupId)}?$select=id,membershipRule,membershipRuleProcessingState,mailEnabled,securityEnabled,groupTypes,isAssignableToRole,assignedLicenses`, ['id', 'membershipRule', 'membershipRuleProcessingState', 'mailEnabled', 'securityEnabled', 'groupTypes', 'isAssignableToRole', 'assignedLicenses'], requests, ['id', 'mailEnabled', 'securityEnabled', 'groupTypes', 'isAssignableToRole', 'assignedLicenses'], `${V1}/groups/{group}`)
    const members = await paged(tokens, 'group-members', `${BETA}/groups/${encodeURIComponent(input.groupId)}/members?$select=id,displayName,userPrincipalName`, ['id', 'displayName', 'userPrincipalName', '@odata.type'], requests, ['id', '@odata.type'], `${BETA}/groups/{group}/members`)
    const owners = await paged(tokens, 'group-owners', `${V1}/groups/${encodeURIComponent(input.groupId)}/owners?$select=id,displayName,userPrincipalName`, ['id', 'displayName', 'userPrincipalName', '@odata.type'], requests, ['id', '@odata.type'], `${V1}/groups/{group}/owners`)
    group = { id: (await pseudo('group', input.groupId))!, properties: properties ? await sanitizeGroupProperties(properties, ctx) : null, directMembers: members === null ? null : (await Promise.all(members.map(row => sanitizeDirectoryObject(row, ctx)))).filter((row): row is SanitizedObject => row !== null), owners: owners === null ? null : (await Promise.all(owners.map(row => sanitizeDirectoryObject(row, ctx)))).filter((row): row is SanitizedObject => row !== null) }
  }
  const routes: [string, string][] = input.groupId ? [['pim-group-eligibility', `${V1}/identityGovernance/privilegedAccess/group/eligibilityScheduleInstances?$filter=groupId%20eq%20'${encodeURIComponent(input.groupId)}'`], ['pim-group-assignments', `${V1}/identityGovernance/privilegedAccess/group/assignmentScheduleInstances?$filter=groupId%20eq%20'${encodeURIComponent(input.groupId)}'`], ['entitlement-resources', `${BETA}/identityGovernance/entitlementManagement/accessPackageCatalogs?$expand=accessPackageResources($expand=accessPackageResourceScopes,accessPackageResourceRoles)`]] : []
  const advancedRoutes: EmergencyDiagnosticArtifact['advancedRoutes'] = []
  for (const [route, endpoint] of routes) {
    const routeRows = await paged(tokens, route, endpoint, ['route-specific records'], requests, [], endpoint.replace(encodeURIComponent(input.groupId!), '{group}')); const request = requests.at(-1)!
    if (route === 'entitlement-resources' && routeRows !== null) {
      const catalogs = routeRows.map(object).filter((row): row is Record<string, unknown> => !!row)
      const resourcesComplete = await completeNested(tokens, catalogs, ['accessPackageResources'], request)
      const resources = catalogs.flatMap(catalog => (Array.isArray(catalog.accessPackageResources) ? catalog.accessPackageResources : []).map(object).filter((row): row is Record<string, unknown> => !!row))
      const relationshipsComplete = resourcesComplete && await completeNested(tokens, resources, ['accessPackageResourceScopes', 'accessPackageResourceRoles'], request)
      if (!relationshipsComplete) semanticRequest(requests, route, false)
    }
    const sanitized = routeRows === null ? null : await Promise.all(routeRows.map(row => sanitizeAdvanced(route, row, ctx)))
    const boundGroup = group?.id ?? null
    const relevant = route === 'entitlement-resources' && sanitized ? sanitized.flatMap(raw => {
      const catalog = object(raw); if (!catalog) return []
      const resources = (Array.isArray(catalog.accessPackageResources) ? catalog.accessPackageResources : []).filter(resource => object(resource)?.originId === boundGroup)
      return resources.length ? [{ ...catalog, accessPackageResources: resources }] : []
    }) : sanitized
    advancedRoutes.push({ route, status: request.status, rows: relevant?.length ?? (routeRows === null ? null : 0), records: relevant })
  }
  const sanitizedConfig = configurationRaw ? await sanitizePasskeyConfiguration(configurationRaw, ctx) : null
  const sanitizedPolicies = conditionalRaw === null ? null : (await Promise.all(conditionalRaw.map(row => sanitizeConditionalAccess(row, ctx)))).filter((row): row is Record<string, unknown> => row !== null)
  const sanitizedStrengths = strengthsRaw === null ? null : (await Promise.all(strengthsRaw.map(row => sanitizeAuthenticationStrength(row, ctx)))).filter((row): row is Record<string, unknown> => row !== null)
  if (sanitizedConfig) {
    const profiles = rows(sanitizedConfig.passkeyProfiles as unknown[]); const profileIds = new Set(profiles.map(profile => profile.id)); const references = rows(sanitizedConfig.includeTargets as unknown[]).flatMap(target => Array.isArray(target.allowedPasskeyProfiles) ? target.allowedPasskeyProfiles : [])
    const profilesComplete = profiles.every(profile => profile.passkeyTypes !== 'unknown' && profile.attestationEnforcement !== 'unknown' && object(profile.keyRestrictions)?.isEnforced !== null && object(profile.keyRestrictions)?.enforcementType !== 'unknown' && stringArray(object(profile.keyRestrictions)?.aaGuids).every(value => GUID.test(value)))
    semanticRequest(requests, 'passkey-policy', sanitizedConfig.state !== 'unknown' && [...rows(sanitizedConfig.includeTargets as unknown[]), ...rows(sanitizedConfig.excludeTargets as unknown[])].every(target => target.targetType !== 'unknown' && target.malformed !== true) && references.every(reference => profileIds.has(reference)) && profilesComplete)
  }
  semanticRequest(requests, 'conditional-access', sanitizedPolicies !== null && sanitizedPolicies.every(policy => { const grant = object(policy.grantControls); return policy.state !== 'unknown' && (!grant || grant.operator !== 'unknown') }))
  semanticRequest(requests, 'authentication-strengths', sanitizedStrengths !== null && sanitizedStrengths.every(strength => strength.policyType !== 'unknown' && Array.isArray(strength.allowedCombinations) && strength.allowedCombinations.every(value => value !== 'unknown')))
  const complete = mandatory.filter(source => requestComplete(requests.find(row => row.source === source))); const incomplete = mandatory.filter(source => !complete.includes(source)); const accountContext = await Promise.all(input.accountIds.map(id => pseudo('directory', id))) as string[]
  const context: DiagnosticContext = { tenant: (await pseudo('tenant', input.tenantId))!, accounts: accountContext.sort(), group: await pseudo('group', input.groupId ?? null), configurationBasis: (await pseudo('configuration', input.configurationBasis))!, expectedTarget: { appId: (await pseudo('application', input.expectedTarget.appId))!, resourceId: (await pseudo('resource', input.expectedTarget.resourceId))! }, approvedAaguids: [...approved].sort() }
  const methodsComplete = accounts.every(account => account.methods !== null && account.methods.length > 0 && account.methods.every(method => method.aaguid && method.passkeyType && method.approved === true))
  const ownerRequest = requests.find(row => row.source === 'group-owners')
  const advancedKnown = !input.groupId || advancedRoutes.every(route => route.status === 'ok' && route.records !== null)
  const advancedEmpty = advancedKnown && advancedRoutes.every(route => (route.records ?? []).length === 0)
  const advancedResult: ProofResult = !input.groupId ? 'supported' : advancedEmpty ? 'supported' : advancedKnown ? 'unsupported' : 'still unvalidated'
  const advancedReason = !input.groupId ? 'No exclusions group is bound.' : advancedEmpty ? 'Every acquired advanced route completed and returned no applicable records.' : advancedKnown ? 'At least one advanced route contains a membership, ownership, or entitlement record.' : 'At least one advanced route is denied, unsupported, partial, or unread.'
  return { schema: 3, kind: input.kind ?? 'real', captureId: crypto.randomUUID(), startedAt, endedAt: new Date().toISOString(), context, requests, coverage: { mandatory, complete, incomplete }, accounts, policy: { configurations: sanitizedConfig ? [sanitizedConfig] : null, conditionalAccess: sanitizedPolicies, authenticationStrengths: sanitizedStrengths }, roles: rolesRaw === null ? null : (await Promise.all(rolesRaw.map(row => sanitizeRoleRecord(row, ctx)))).filter(Boolean), roleSchedules: roleSchedulesRaw === null ? null : (await Promise.all(roleSchedulesRaw.map(row => sanitizeRoleRecord(row, ctx)))).filter(Boolean), audits, group, advancedRoutes, disposition: [{ assertion: 'Mandatory source coverage is complete', result: incomplete.length ? 'unsupported' : 'supported', reason: incomplete.length ? `Incomplete sources: ${incomplete.join(', ')}.` : 'Every mandatory source returned required fields through its final page.' }, { assertion: 'Every selected account has a complete approved passkey candidate set', result: methodsComplete ? 'supported' : 'unsupported', reason: methodsComplete ? 'Every returned candidate is structurally complete and approved.' : 'At least one account has an empty, incomplete, malformed, or unapproved candidate set.' }, { assertion: 'Group owner coverage is complete', result: !input.groupId ? 'supported' : ownerRequest && requestComplete(ownerRequest) ? 'still unvalidated' : 'still unvalidated', reason: !input.groupId ? 'No exclusions group is bound.' : 'The available v1.0 owner route does not establish every provider ownership path.' }, { assertion: 'No advanced membership, ownership, or entitlement route is present', result: advancedResult, reason: advancedReason }, { assertion: 'A sign-in identifies the exact physical registered credential used', result: 'still unvalidated', reason: 'The sign-in schema does not expose a stable physical-credential identifier; proof must use the complete compliant-candidate route.' }, { assertion: 'Provider-wide audit ingestion and retention are complete', result: 'still unvalidated', reason: 'Read completion cannot establish provider-wide ingestion or retention.' }], providerAssurance: 'unvalidated' }
}

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  : object(value) ? Object.fromEntries(Object.entries(object(value)!).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const after = (value: string | null, instant: number) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) > instant
const beforeOrAt = (value: string | null, instant: number) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= instant
const requiredSources = (artifact: EmergencyDiagnosticArtifact): string[] => ['passkey-policy', 'conditional-access', 'authentication-strengths', 'roles', 'role-schedules', 'directory-audits', ...(artifact.context.group ? ['group', 'group-members'] : []), ...artifact.context.accounts.flatMap(account => [`identity:${account}`, `methods:${account}`, `signins:${account}`, `memberships:${account}`])]
const validRequests = (artifact: EmergencyDiagnosticArtifact) => requiredSources(artifact).every(source => requestComplete(artifact.requests.find(row => row.source === source)))
const rows = (value: unknown[] | null): Record<string, any>[] => (value ?? []).map(object).filter((row): row is Record<string, any> => !!row)
const GLOBAL_ADMIN = '62e90394-69f5-4237-9190-012177145e10'

function preparedAccount(artifact: EmergencyDiagnosticArtifact, accountId: string): string[] {
  const reasons: string[] = []; const account = artifact.accounts.find(row => row.account === accountId)
  if (!account?.identity || account.identity.accountEnabled !== true || account.identity.cloudOnly !== true) reasons.push('The account is disabled, synchronized, or its identity evidence is incomplete.')
  if (!account?.methods?.length) reasons.push('The credential candidate set is empty or unread.')
  else if (account.methods.some(method => !method.aaguid || method.passkeyType !== 'devicebound' || method.approved !== true || !artifact.context.approvedAaguids.includes(method.aaguid))) reasons.push('A credential candidate is malformed, synced, unknown, or not approved by the bound intent.')
  const captureAt = Date.parse(artifact.endedAt)
  const activeRoot = rows(artifact.roles).some(role => role.principalId === accountId && role.roleDefinitionId === GLOBAL_ADMIN && role.directoryScopeId === '/')
  const permanentSchedule = rows(artifact.roleSchedules).some(role => role.principalId === accountId && role.roleDefinitionId === GLOBAL_ADMIN && role.directoryScopeId === '/' && role.assignmentType === 'Assigned' && role.startDateTimeKnown === true && beforeOrAt(role.startDateTime, captureAt) && role.endDateTimeKnown === true && role.endDateTime === null && ['Active', 'Granted', 'Provisioned'].includes(role.status))
  if (!activeRoot || !permanentSchedule) reasons.push('Permanent active tenant-root Global Administrator evidence is missing.')
  if (artifact.context.group) {
    if (!artifact.group?.directMembers?.some(member => member.id === accountId)) reasons.push('The account is not a direct member of the bound exclusions group.')
    if (!account?.memberships?.includes(artifact.context.group)) reasons.push('The account membership inventory does not include the bound exclusions group.')
  }
  return reasons
}

function configurationSupports(artifact: EmergencyDiagnosticArtifact, accountId: string): boolean {
  const config = rows(artifact.policy.configurations)[0]; const account = artifact.accounts.find(row => row.account === accountId)
  if (!config || config.state !== 'enabled' || !account?.methods?.length) return false
  const memberships = new Set(account.memberships ?? [])
  const targeted = (targets: unknown): Record<string, any>[] => rows(Array.isArray(targets) ? targets : null).filter(target => target.id === 'all_users' || memberships.has(target.id))
  if (!targeted(config.includeTargets).length || targeted(config.excludeTargets).length) return false
  const profiles = rows(config.passkeyProfiles); const applicableProfileIds = new Set(targeted(config.includeTargets).flatMap(target => Array.isArray(target.allowedPasskeyProfiles) ? target.allowedPasskeyProfiles : []))
  if (profiles.length || applicableProfileIds.size) {
    if (!applicableProfileIds.size) return false
    const applicable = profiles.filter(profile => applicableProfileIds.has(profile.id)); if (applicable.length !== applicableProfileIds.size) return false
    return account.methods.every(method => applicable.some(profile => {
      const types = String(profile.passkeyTypes ?? '').split(',').map(value => value.trim())
      const restriction = object(profile.keyRestrictions); const ids = stringArray(restriction?.aaGuids).map(value => value.toLowerCase()); const listed = !!method.aaguid && ids.includes(method.aaguid)
      return types.length === 1 && types[0] === 'devicebound' && profile.attestationEnforcement === 'registrationOnly' && restriction?.isEnforced === true && (restriction.enforcementType === 'allow' ? listed : restriction.enforcementType === 'block' ? !listed : false)
    }))
  }
  const restriction = object(config.keyRestrictions); const ids = stringArray(restriction?.aaGuids).map(value => value.toLowerCase())
  return restriction?.isEnforced === true && account.methods.every(method => !!method.aaguid && (restriction.enforcementType === 'allow' ? ids.includes(method.aaguid) : restriction.enforcementType === 'block' ? !ids.includes(method.aaguid) : false))
}

function relevantEndpointState(artifact: EmergencyDiagnosticArtifact): unknown {
  const accounts = artifact.accounts.filter(row => artifact.context.accounts.includes(row.account)).map(row => ({ account: row.account, identity: row.identity, methods: row.methods, memberships: row.memberships }))
  const roles = rows(artifact.roles).filter(role => artifact.context.accounts.includes(role.principalId) && role.roleDefinitionId === GLOBAL_ADMIN)
  const roleSchedules = rows(artifact.roleSchedules).filter(role => artifact.context.accounts.includes(role.principalId) && role.roleDefinitionId === GLOBAL_ADMIN)
  return { accounts, policy: artifact.policy, roles, roleSchedules, group: artifact.group, advancedRoutes: artifact.advancedRoutes }
}

function groupAndPoliciesSupport(artifact: EmergencyDiagnosticArtifact): boolean {
  if (!artifact.context.group) return true
  const props = object(artifact.group?.properties); const direct = artifact.group?.directMembers
  if (!props || !direct || props.securityEnabled !== true || props.mailEnabled !== false || props.membershipRulePresent !== false || !Array.isArray(props.groupTypes) || props.groupTypes.some(type => type === 'DynamicMembership' || type === 'unknown') || props.assignedLicenseCount !== 0) return false
  if (direct.some(member => !artifact.context.accounts.includes(member.id)) || artifact.context.accounts.some(account => !direct.some(member => member.id === account))) return false
  return rows(artifact.policy.conditionalAccess).every(policy => { const excluded = object(object(policy.conditions)?.users)?.excludeGroups; return policy.state === 'disabled' || (Array.isArray(excluded) && excluded.includes(artifact.context.group)) })
}

function relevantIds(artifact: EmergencyDiagnosticArtifact): Set<string> {
  const ids = new Set<string>([...artifact.context.accounts, ...(artifact.context.group ? [artifact.context.group] : [])])
  for (const policy of rows(artifact.policy.conditionalAccess)) if (text(policy.id)) ids.add(text(policy.id)!)
  for (const config of rows(artifact.policy.configurations)) { if (text(config.id)) ids.add(text(config.id)!); for (const profile of rows(config.passkeyProfiles)) if (text(profile.id)) ids.add(text(profile.id)!) }
  return ids
}
function windowMutations(baseline: EmergencyDiagnosticArtifact, confirming: EmergencyDiagnosticArtifact, start: number, end: number): { observed: boolean; unknown: boolean } {
  const relevant = relevantIds(baseline); let observed = false; let unknown = false
  for (const audit of [...(baseline.audits ?? []), ...(confirming.audits ?? [])]) {
    if (!after(audit.at, start - 1) || !beforeOrAt(audit.at, end) || audit.relevant === false) continue
    const targets = audit.targets.filter(target => target.id !== null && relevant.has(target.id))
    if (!targets.length) { if (audit.relevant === null || (audit.relevant === true && audit.targets.length === 0)) unknown = true; continue }
    if (targets.some(target => target.modified.some(property => !property.preserved))) unknown = true
    else observed = true
  }
  return { observed, unknown }
}
export type DiagnosticAccountOutcome = { account: string; result: ProofResult; qualifyingEvents: number; reasons: string[] }
export type DiagnosticPairEvaluation = { supported: boolean; logicalSupported: boolean; providerAssurance: 'unvalidated'; assertions: { assertion: string; result: ProofResult; reason: string }[]; accounts: DiagnosticAccountOutcome[]; sameContext: boolean; complete: boolean; mutationObserved: boolean; reason: string }

export function evaluateDiagnosticPair(baseline: EmergencyDiagnosticArtifact, confirming: EmergencyDiagnosticArtifact): DiagnosticPairEvaluation {
  const nonempty = baseline.context.accounts.length > 0 && confirming.context.accounts.length > 0
  const sameContext = nonempty && baseline.context.tenant === confirming.context.tenant && same(baseline.context.accounts, confirming.context.accounts) && baseline.context.group === confirming.context.group && baseline.context.configurationBasis === confirming.context.configurationBasis && same(baseline.context.expectedTarget, confirming.context.expectedTarget) && same(baseline.context.approvedAaguids, confirming.context.approvedAaguids)
  const complete = validRequests(baseline) && validRequests(confirming); const baselineStart = Date.parse(baseline.startedAt); const baselineEnd = Date.parse(baseline.endedAt); const confirmingEnd = Date.parse(confirming.endedAt)
  const mutation = windowMutations(baseline, confirming, baselineStart, confirmingEnd); const mutationUnknown = mutation.unknown; const mutationObserved = mutation.observed
  const endpointStable = same(relevantEndpointState(baseline), relevantEndpointState(confirming))
  const configurationValid = groupAndPoliciesSupport(baseline) && groupAndPoliciesSupport(confirming) && confirming.context.accounts.every(account => configurationSupports(baseline, account) && configurationSupports(confirming, account))
  const accounts: DiagnosticAccountOutcome[] = confirming.context.accounts.map(accountId => {
    const reasons: string[] = [...preparedAccount(baseline, accountId), ...preparedAccount(confirming, accountId)]; const row = confirming.accounts.find(account => account.account === accountId)
    const events = (row?.signIns ?? []).filter(event => { const exactContext = event.userId === accountId && event.tenantId === confirming.context.tenant && event.appId === confirming.context.expectedTarget.appId && event.resourceId === confirming.context.expectedTarget.resourceId; const freshEvent = after(event.at, baselineEnd) && beforeOrAt(event.at, confirmingEnd); const freshStep = event.steps.some(step => step.succeeded === true && (step.method === 'fido2' || step.method === 'passkey') && step.resultDetail === 'success' && after(step.at, baselineEnd) && beforeOrAt(step.at, confirmingEnd)); return exactContext && event.success === true && event.interactive === true && event.reusedClaim === false && freshEvent && freshStep })
    if (!events.length) reasons.push('No fresh exact-context passkey event was observed after the completed baseline.')
    if (!sameContext) reasons.push('The tenant, account set, group, target, or configuration basis changed.')
    if (!complete) reasons.push('Mandatory acquisition coverage is incomplete.')
    if (!configurationValid) reasons.push('The bound passkey, role, group, or policy configuration is not valid in both captures.')
    if (!endpointStable) reasons.push('A relevant endpoint state changed between captures.')
    if (mutationObserved) reasons.push('A relevant configuration change occurred in the observation window.')
    if (mutationUnknown) reasons.push('A new audit event could not be classified completely.')
    return { account: accountId, result: reasons.length ? 'unsupported' : 'supported', qualifyingEvents: events.length, reasons }
  })
  const baselineAdvanced = baseline.disposition.find(row => row.assertion === 'No advanced membership, ownership, or entitlement route is present')
  const confirmingAdvanced = confirming.disposition.find(row => row.assertion === 'No advanced membership, ownership, or entitlement route is present')
  const advancedEstablished = !confirming.context.group || (baselineAdvanced?.result === 'supported' && confirmingAdvanced?.result === 'supported')
  const enoughAccounts = confirming.context.accounts.length >= 2
  const logicalSupported = sameContext && complete && configurationValid && endpointStable && !mutationObserved && !mutationUnknown && advancedEstablished && enoughAccounts && accounts.every(account => account.result === 'supported')
  const pairedAdvanced: ProofResult = !confirming.context.group ? 'supported' : baselineAdvanced?.result === 'unsupported' || confirmingAdvanced?.result === 'unsupported' ? 'unsupported' : baselineAdvanced?.result === 'supported' && confirmingAdvanced?.result === 'supported' ? 'supported' : 'still unvalidated'
  const assertions = [{ assertion: 'Paired context is identical and nonempty', result: (sameContext ? 'supported' : 'unsupported') as ProofResult, reason: sameContext ? 'Tenant, accounts, group, target, and intent match.' : 'The pair context is empty or changed.' }, { assertion: 'Two emergency accounts are selected', result: (enoughAccounts ? 'supported' : 'unsupported') as ProofResult, reason: enoughAccounts ? 'Two or more selected emergency accounts are present.' : 'Fewer than two selected emergency accounts are present.' }, { assertion: 'Mandatory source coverage is complete', result: (complete ? 'supported' : 'unsupported') as ProofResult, reason: complete ? 'Every mandatory request completed with required fields.' : 'At least one mandatory request is absent, partial, denied, malformed, or missing required fields.' }, { assertion: 'No advanced membership, ownership, or entitlement route is present', result: pairedAdvanced, reason: advancedEstablished ? 'Both captures returned no relevant advanced route for the bound group.' : baselineAdvanced?.reason ?? confirmingAdvanced?.reason ?? (confirming.context.group ? 'Advanced route evidence is unavailable.' : 'No exclusions group is bound.') }, { assertion: 'No relevant mutation occurred during the window', result: (mutationObserved || mutationUnknown ? 'unsupported' : 'supported') as ProofResult, reason: mutationObserved ? 'A relevant mutation was observed.' : mutationUnknown ? 'A new audit event was not fully classifiable.' : 'No new relevant observed mutation was found.' }, { assertion: 'Provider-wide ingestion and retention are complete', result: 'still unvalidated' as ProofResult, reason: 'Neither a successful fixture nor exhausted pagination proves provider-wide ingestion or retention.' }]
  return { supported: false, logicalSupported, providerAssurance: 'unvalidated', assertions, accounts, sameContext, complete, mutationObserved: mutationObserved || mutationUnknown, reason: logicalSupported ? 'The logical contract passed; production assurance remains unvalidated.' : accounts.flatMap(account => account.reasons)[0] ?? assertions.find(assertion => assertion.result === 'unsupported')?.reason ?? 'The logical contract did not pass.' }
}
