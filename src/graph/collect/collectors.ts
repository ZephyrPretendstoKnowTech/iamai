// Lane 0 + Lane A collectors (docs/design/collection.md §2). Worker-safe: no
// DOM, no MSAL. Every collector maps failures instead of throwing outward —
// a 403/licence error disables its section, never the scan.
import { GraphRequestError, graphPaged, graphRequest, SectionDisabledError, V1, BETA } from './http.ts'
import type { TokenSource } from './http.ts'
import { COLLECTOR_REGISTRY } from './registry.ts'
import { deriveAuthenticatorPlatform } from '../../scoring/platform.ts'
import type { AuthMethodSummary, MethodKind } from '../../scoring/mfaViability.ts'
import type {
  ConfigSection,
  ConfigSectionKey,
  DeviceRow,
  MethodsByUser,
  RegistrationRow,
  UserRow,
} from './types.ts'

export type Ctx = {
  tokens: TokenSource
  signal: AbortSignal
}

// ---------- Lane 0: config reads ----------

// Lane 0 endpoints come from the declarative registry (registry.ts).
const CONFIG_ENDPOINTS = Object.fromEntries(
  COLLECTOR_REGISTRY.filter((s) => s.lane === '0' && s.configKey).map((s) => [
    s.configKey,
    { url: `${s.version === 'beta' ? BETA : V1}${s.endpoint}`, paged: s.paged },
  ]),
) as Record<ConfigSectionKey, { url: string; paged?: boolean }>

// Item 2 of the data-model lock: Microsoft-managed CA policies are flagged by
// display-name prefix or a present templateId.
export function isMicrosoftManagedPolicy(policy: unknown): boolean {
  const p = policy as Record<string, unknown>
  const name = typeof p.displayName === 'string' ? p.displayName : ''
  return name.startsWith('Microsoft-managed') || (typeof p.templateId === 'string' && p.templateId.length > 0)
}

// Item 10: split per-user role template ids into active vs PIM-eligible.
export function deriveRoles(
  roleAssignments: unknown[],
  eligibilitySchedules: unknown[],
): { active: Record<string, string[]>; eligible: Record<string, string[]> } {
  const collect = (rows: unknown[]): Record<string, string[]> => {
    const out: Record<string, string[]> = {}
    for (const raw of rows) {
      const r = raw as Record<string, unknown>
      const principalId = typeof r.principalId === 'string' ? r.principalId : null
      const roleId = typeof r.roleDefinitionId === 'string' ? r.roleDefinitionId : null
      if (!principalId || !roleId) continue
      const list = (out[principalId] ??= [])
      if (!list.includes(roleId)) list.push(roleId)
    }
    return out
  }
  return { active: collect(roleAssignments), eligible: collect(eligibilitySchedules) }
}

export async function collectConfigSection(ctx: Ctx, key: ConfigSectionKey): Promise<ConfigSection> {
  const { url, paged } = CONFIG_ENDPOINTS[key]
  // How the read went travels with the section (prompt 46 item 24), so a
  // diagnostics bundle can say whether a read failed or succeeded and returned
  // a body without the field a rule wanted.
  let last: { status: number; bytes: number } | null = null
  const onResponse = (info: { status: number; bytes: number }): void => {
    last = info
  }
  const how = (fallbackStatus: number | null = null): Pick<ConfigSection, 'httpStatus' | 'bodyBytes'> => ({
    httpStatus: last?.status ?? fallbackStatus,
    bodyBytes: last?.bytes ?? null,
  })
  try {
    if (paged) {
      const rows = await graphPaged(ctx.tokens, url, { signal: ctx.signal, onResponse })
      return { status: 'ok', reason: null, rows, ...how() }
    }
    const body = await graphRequest(ctx.tokens, url, { signal: ctx.signal, onResponse })
    return { status: 'ok', reason: null, rows: [body], ...how() }
  } catch (e) {
    if (e instanceof SectionDisabledError) return { status: 'disabled', reason: e.message, rows: [], ...how(e.status) }
    return { status: 'error', reason: e instanceof Error ? e.message : String(e), rows: [], ...how(e instanceof GraphRequestError ? e.status : null) }
  }
}

export const CONFIG_KEYS = Object.keys(CONFIG_ENDPOINTS) as ConfigSectionKey[]

// ---------- Lane A ----------

export async function collectRegistrationDetails(ctx: Ctx): Promise<RegistrationRow[]> {
  const rows = await graphPaged(
    ctx.tokens,
    `${V1}/reports/authenticationMethods/userRegistrationDetails?$top=999`,
    { signal: ctx.signal },
  )
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>
    return {
      id: String(r.id ?? ''),
      userPrincipalName: typeof r.userPrincipalName === 'string' ? r.userPrincipalName : null,
      isMfaCapable: r.isMfaCapable === true,
      isMfaRegistered: r.isMfaRegistered === true,
      isPasswordlessCapable: r.isPasswordlessCapable === true,
      methodsRegistered: Array.isArray(r.methodsRegistered) ? r.methodsRegistered.map(String) : [],
      defaultMfaMethod: typeof r.defaultMfaMethod === 'string' ? r.defaultMfaMethod : null,
      userPreferredMethodForSecondaryAuthentication:
        typeof r.userPreferredMethodForSecondaryAuthentication === 'string'
          ? r.userPreferredMethodForSecondaryAuthentication
          : null,
      isAdmin: r.isAdmin === true,
      userType: r.userType === 'guest' ? 'guest' : 'member',
    }
  })
}

function mapUser(raw: unknown): UserRow {
  const u = raw as Record<string, unknown>
  const activity = (u.signInActivity ?? null) as Record<string, unknown> | null
  const last =
    (typeof activity?.lastSuccessfulSignInDateTime === 'string' && activity.lastSuccessfulSignInDateTime) ||
    (typeof activity?.lastSignInDateTime === 'string' && activity.lastSignInDateTime) ||
    null
  const plans = Array.isArray(u.assignedPlans) ? u.assignedPlans : []
  return {
    id: String(u.id ?? ''),
    displayName: typeof u.displayName === 'string' ? u.displayName : null,
    userPrincipalName: typeof u.userPrincipalName === 'string' ? u.userPrincipalName : null,
    userType: u.userType === 'Guest' || u.userType === 'guest' ? 'guest' : 'member',
    usageLocation: typeof u.usageLocation === 'string' ? u.usageLocation : null,
    createdDateTime: typeof u.createdDateTime === 'string' ? u.createdDateTime : null,
    lastSuccessfulSignIn: last,
    accountEnabled: typeof u.accountEnabled === 'boolean' ? u.accountEnabled : null,
    mail: typeof u.mail === 'string' && u.mail.length > 0 ? u.mail : null,
    assignedPlans: plans
      .map((p) => p as Record<string, unknown>)
      .filter((p) => typeof p.servicePlanId === 'string')
      .map((p) => ({
        servicePlanId: String(p.servicePlanId),
        capabilityStatus: typeof p.capabilityStatus === 'string' ? p.capabilityStatus : '',
      })),
    onPremisesSyncEnabled: typeof u.onPremisesSyncEnabled === 'boolean' ? u.onPremisesSyncEnabled : null,
    externalUserState: typeof u.externalUserState === 'string' ? u.externalUserState : null,
    department: typeof u.department === 'string' ? u.department : null,
    jobTitle: typeof u.jobTitle === 'string' ? u.jobTitle : null,
    officeLocation: typeof u.officeLocation === 'string' ? u.officeLocation : null,
  }
}

// A2 with an A5 hook: onUserPage fires per page so auth-method batches stream
// (§2, A5). Falls back to a plain user read when signInActivity is licence-gated;
// callers that already know the licence lacks P1 skip the first attempt.
export async function collectUsers(
  ctx: Ctx,
  onUserPage: (users: UserRow[]) => Promise<void>,
  opts: { includeSignInActivity: boolean } = { includeSignInActivity: true },
): Promise<{ users: UserRow[]; partialReason: string | null }> {
  const baseSelect =
    'id,displayName,userPrincipalName,userType,usageLocation,createdDateTime,accountEnabled,mail,assignedPlans,onPremisesSyncEnabled,externalUserState,department,jobTitle,officeLocation'
  const select = `${baseSelect},signInActivity`
  if (!opts.includeSignInActivity) {
    const rows = await graphPaged(ctx.tokens, `${V1}/users?$select=${baseSelect}&$top=999`, {
      signal: ctx.signal,
      onPage: async (page) => onUserPage(page.map(mapUser)),
    })
    return {
      users: rows.map(mapUser),
      partialReason: 'signInActivity not available on this licence (needs Entra ID P1)',
    }
  }
  try {
    const rows = await graphPaged(ctx.tokens, `${V1}/users?$select=${select}&$top=999`, {
      signal: ctx.signal,
      onPage: async (page) => onUserPage(page.map(mapUser)),
    })
    return { users: rows.map(mapUser), partialReason: null }
  } catch (e) {
    if (!(e instanceof SectionDisabledError)) throw e
    const rows = await graphPaged(
      ctx.tokens,
      `${V1}/users?$select=id,displayName,userPrincipalName,userType,usageLocation,createdDateTime,accountEnabled,mail,assignedPlans,onPremisesSyncEnabled,externalUserState,department,jobTitle,officeLocation&$top=999`,
      { signal: ctx.signal, onPage: async (page) => onUserPage(page.map(mapUser)) },
    )
    return { users: rows.map(mapUser), partialReason: `signInActivity unavailable: ${e.message}` }
  }
}

export async function collectDevices(ctx: Ctx): Promise<DeviceRow[]> {
  const url = `${V1}/devices?$select=id,displayName,isCompliant,isManaged,trustType,operatingSystem,approximateLastSignInDateTime&$expand=${encodeURIComponent('registeredOwners($select=id)')}&$top=999`
  const rows = await graphPaged(ctx.tokens, url, { signal: ctx.signal })
  return rows.map((raw) => {
    const d = raw as Record<string, unknown>
    const owners = Array.isArray(d.registeredOwners) ? d.registeredOwners : []
    return {
      id: String(d.id ?? ''),
      displayName: typeof d.displayName === 'string' ? d.displayName : null,
      isCompliant: typeof d.isCompliant === 'boolean' ? d.isCompliant : null,
      isManaged: typeof d.isManaged === 'boolean' ? d.isManaged : null,
      trustType: typeof d.trustType === 'string' ? d.trustType : null,
      ownerIds: owners.map((o) => String((o as Record<string, unknown>).id ?? '')).filter(Boolean),
      operatingSystem: typeof d.operatingSystem === 'string' ? d.operatingSystem : null,
      approximateLastSignIn: typeof d.approximateLastSignInDateTime === 'string' ? d.approximateLastSignInDateTime : null,
    }
  })
}

export function collectSpActivity(ctx: Ctx): Promise<unknown[]> {
  return graphPaged(ctx.tokens, `${BETA}/reports/servicePrincipalSignInActivities`, { signal: ctx.signal })
}

export function collectAppSignInSummary(ctx: Ctx): Promise<unknown[]> {
  return graphPaged(ctx.tokens, `${BETA}/reports/applicationSignInDetailedSummary`, { signal: ctx.signal })
}

// ---------- A5: auth methods via $batch, values stripped ----------

const KIND_BY_TYPE: Record<string, MethodKind> = {
  microsoftAuthenticatorAuthenticationMethod: 'microsoftAuthenticator',
  passkeyAuthenticationMethod: 'passkey',
  fido2AuthenticationMethod: 'fido2',
  windowsHelloForBusinessAuthenticationMethod: 'windowsHelloForBusiness',
  phoneAuthenticationMethod: 'phone',
  softwareOathAuthenticationMethod: 'softwareOath',
  temporaryAccessPassAuthenticationMethod: 'temporaryAccessPass',
  emailAuthenticationMethod: 'email',
  passwordAuthenticationMethod: 'password',
}

// Strips method values (phone numbers, email addresses) at the fetch layer —
// they never enter the snapshot (§10.2, §11).
function mapMethod(raw: unknown): AuthMethodSummary {
  const m = raw as Record<string, unknown>
  const type = String(m['@odata.type'] ?? '').replace('#microsoft.graph.', '')
  const kind = KIND_BY_TYPE[type] ?? 'other'
  const out: AuthMethodSummary = { kind }
  if (typeof m.createdDateTime === 'string') out.createdDateTime = m.createdDateTime
  if (kind === 'microsoftAuthenticator') {
    if (typeof m.displayName === 'string') out.displayName = m.displayName
    if (typeof m.phoneAppVersion === 'string') out.phoneAppVersion = m.phoneAppVersion
    if (typeof m.deviceTag === 'string') out.deviceTag = m.deviceTag
    out.platform = deriveAuthenticatorPlatform({
      deviceTag: out.deviceTag,
      phoneAppVersion: out.phoneAppVersion,
      displayName: out.displayName,
    }).platform
  }
  if (kind === 'fido2' || kind === 'passkey') {
    if (typeof m.displayName === 'string') out.displayName = m.displayName
    if (typeof m.model === 'string') out.model = m.model
  }
  if (kind === 'phone' && typeof m.phoneType === 'string') {
    out.phoneType = m.phoneType as AuthMethodSummary['phoneType']
  }
  if (kind === 'temporaryAccessPass') out.isUsable = m.isUsable === true
  return out
}

// One $batch per 20 users; an inner 403/error marks that user's methods
// 'unknown' — it never fails the section.
export async function collectMethodsForUsers(ctx: Ctx, userIds: string[]): Promise<MethodsByUser> {
  const out: MethodsByUser = {}
  for (let i = 0; i < userIds.length; i += 20) {
    const chunk = userIds.slice(i, i + 20)
    const body = await graphRequest(ctx.tokens, `${V1}/$batch`, {
      signal: ctx.signal,
      method: 'POST',
      jsonBody: {
        requests: chunk.map((id, n) => ({
          id: String(n),
          method: 'GET',
          url: `/users/${id}/authentication/methods`,
        })),
      },
    })
    for (const r of body.responses ?? []) {
      const userId = chunk[Number(r.id)]
      if (!userId) continue
      const value = (r.body as { value?: unknown[] } | undefined)?.value
      out[userId] = r.status === 200 && Array.isArray(value) ? value.map(mapMethod) : 'unknown'
    }
  }
  return out
}
