// Lane 0 + Lane A collectors (docs/design/collection.md §2). Worker-safe: no
// DOM, no MSAL. Every collector maps failures instead of throwing outward —
// a 403/licence error disables its section, never the scan.
import { GraphRequestError, graphPaged, graphRequest, retryAfterMs, SectionDisabledError, sleep, V1, BETA } from './http.ts'
import type { TokenSource } from './http.ts'
import { COLLECTOR_REGISTRY, licenceGateReason } from './registry.ts'
import { deriveAuthenticatorPlatform } from '../../scoring/platform.ts'
import type { AuthMethodSummary, MethodKind } from '../../scoring/mfaViability.ts'
import type {
  ConfigSection,
  ConfigSectionKey,
  DeviceRow,
  MethodsByUser,
  PerUserMfaByUser,
  RegistrationRow,
  UserRow,
} from './types.ts'

export type Ctx = {
  tokens: TokenSource
  signal: AbortSignal
  /** The retry policy's wait; injectable so tests run it without sleeping (http.ts sleep otherwise). */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>
}

// ---------- Lane 0: config reads ----------

// Lane 0 endpoints come from the declarative registry (registry.ts).
const CONFIG_ENDPOINTS = Object.fromEntries(
  COLLECTOR_REGISTRY.filter((s) => s.lane === '0' && s.configKey).map((s) => [
    s.configKey,
    {
      url: `${s.version === 'beta' ? BETA : V1}${s.endpoint}`,
      fallbackUrl: s.fallbackEndpoint ? `${s.version === 'beta' ? BETA : V1}${s.fallbackEndpoint}` : null,
      paged: s.paged,
    },
  ]),
) as Record<ConfigSectionKey, { url: string; fallbackUrl: string | null; paged?: boolean }>

// The cross-tenant default and partner reads, made beside the policy read and
// listed, in that order, in its registry row (alsoReads).
const [CROSS_TENANT_DEFAULT, CROSS_TENANT_PARTNERS] = COLLECTOR_REGISTRY.find((s) => s.configKey === 'crossTenantAccess')!.alsoReads!

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
  const { url, fallbackUrl, paged } = CONFIG_ENDPOINTS[key]
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
      const rows = await pagedWithFallback(ctx, url, fallbackUrl, onResponse)
      return { status: 'ok', reason: null, rows, ...how() }
    }
    const body = await graphRequest(ctx.tokens, url, { signal: ctx.signal, onResponse })
    if (key === 'crossTenantAccess') {
      const rows: unknown[] = [{ ...(body as Record<string, unknown>), relationship: 'policy' }]
      const failures: string[] = []
      try {
        const defaults = await graphRequest(ctx.tokens, `${V1}${CROSS_TENANT_DEFAULT}`, { signal: ctx.signal })
        rows.push({ ...(defaults as Record<string, unknown>), relationship: 'default' })
      } catch (error) {
        failures.push(`default relationship unavailable: ${error instanceof Error ? error.message : String(error)}`)
      }
      try {
        const partners = await graphPaged(ctx.tokens, `${V1}${CROSS_TENANT_PARTNERS}`, { signal: ctx.signal })
        rows.push(...partners.map(partner => ({ ...(partner as Record<string, unknown>), relationship: 'partner' })))
      } catch (error) {
        failures.push(`partner relationships unavailable: ${error instanceof Error ? error.message : String(error)}`)
      }
      return { status: failures.length ? 'partial' : 'ok', reason: failures.length ? failures.join('; ') : null, rows, ...how() }
    }
    const fallback = key === 'authMethodsPolicy' ? await migrationStateFallback(ctx, body as Record<string, unknown>) : null
    const fido2Read = key === 'authMethodsPolicy' ? await readFido2Configuration(ctx, body as Record<string, unknown>) : undefined
    return { status: 'ok', reason: null, rows: [body], ...how(), ...(fallback ? { fallback } : {}), ...(fido2Read ? { fido2Read } : {}) }
  } catch (e) {
    if (e instanceof SectionDisabledError) return { status: 'disabled', reason: e.message, rows: [], ...how(e.status) }
    return { status: 'error', reason: e instanceof Error ? e.message : String(e), rows: [], ...how(e instanceof GraphRequestError ? e.status : null) }
  }
}

/** The parent policy can omit profile relationships. Never merge a partial
 * dedicated response with old fields: doing so can hide configuration removal.
 * Keep the parent response on failure, with explicit provenance for the reader. */
async function readFido2Configuration(ctx: Ctx, body: Record<string, unknown>): Promise<ConfigSection['fido2Read']> {
  const spec = COLLECTOR_REGISTRY.find(s => s.name === 'Passkey configuration')!
  let status: number | null = null
  try {
    const raw = await graphRequest(ctx.tokens, `${V1}${spec.endpoint}`, { signal: ctx.signal, onResponse: r => { status = r.status } })
    const method = raw as Record<string, unknown> | null
    if (!method || String(method.id).toLowerCase() !== 'fido2') return { status: 'error', reason: 'The passkey response did not contain the Fido2 configuration.', httpStatus: status }
    // Only replace this method. An incomplete parent list must not become a
    // claim that every other authentication method is absent.
    if (Array.isArray(body.authenticationMethodConfigurations)) {
      body.authenticationMethodConfigurations = [...body.authenticationMethodConfigurations.filter(c => String(c?.id).toLowerCase() !== 'fido2'), method]
    } else {
      body.fido2Configuration = method
    }
    return { status: 'ok', reason: null, httpStatus: status }
  } catch (error) {
    return { status: 'error', reason: error instanceof Error ? error.message : String(error), httpStatus: status ?? (error instanceof GraphRequestError || error instanceof SectionDisabledError ? error.status : null) }
  }
}

/**
 * The registry's read, and — where it names one — the narrower read to try when
 * a tenant's Graph rejects the first with a 400. That is the answer to an
 * `$expand` this tenant will not serve, and it is the one failure worth
 * retrying: a 401/403 is a permission answer (SectionDisabledError), an abort is
 * the scan stopping, and neither becomes a second request.
 */
async function pagedWithFallback(
  ctx: Ctx,
  url: string,
  fallbackUrl: string | null,
  onResponse: (info: { status: number; bytes: number }) => void,
): Promise<unknown[]> {
  try {
    return await graphPaged(ctx.tokens, url, { signal: ctx.signal, onResponse })
  } catch (e) {
    if (fallbackUrl === null || !(e instanceof GraphRequestError) || e.status !== 400) throw e
    return await graphPaged(ctx.tokens, fallbackUrl, { signal: ctx.signal, onResponse })
  }
}

/**
 * The v1.0 authentication methods policy returns no policyMigrationState on
 * some tenants (prompt 47 item 8). Read that one field from beta, in the same
 * collector, and tolerate its absence: the rule that wants it says so only
 * when neither read carried it. Mutates the v1.0 body in place.
 */
async function migrationStateFallback(ctx: Ctx, body: Record<string, unknown>): Promise<string | null> {
  if (typeof body.policyMigrationState === 'string' && body.policyMigrationState.length > 0) return null
  try {
    const beta = await graphRequest(ctx.tokens, `${BETA}/policies/authenticationMethodsPolicy?$select=policyMigrationState`, { signal: ctx.signal })
    const state = (beta as Record<string, unknown>).policyMigrationState
    if (typeof state === 'string' && state.length > 0) {
      body.policyMigrationState = state
      return 'policyMigrationState from beta'
    }
    return 'policyMigrationState absent from v1.0 and beta'
  } catch {
    return 'policyMigrationState absent from v1.0; beta read failed'
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
  return rows.map(mapRegistration)
}

/**
 * The people whose method read failed even after it was read again, and whom
 * the registration report has no row for: the report is where their methods
 * can still come from (scoring/phishingResistant.ts inventory).
 */
export function registrationGaps(methods: MethodsByUser, rows: readonly RegistrationRow[]): string[] {
  const held = new Set(rows.map((r) => r.id))
  return Object.keys(methods).filter((id) => methods[id] === 'unknown' && !held.has(id))
}

/**
 * Those people's rows of the registration report, read one person at a time in
 * batches of 20 (the tenant-wide read failed, or it had no row for them). A
 * person the report cannot answer for is left out: they stay unknown.
 */
export async function collectRegistrationForUsers(ctx: Ctx, userIds: readonly string[]): Promise<RegistrationRow[]> {
  const out: RegistrationRow[] = []
  for (let i = 0; i < userIds.length; i += 20) {
    const chunk = userIds.slice(i, i + 20)
    try {
      const body = await graphRequest(ctx.tokens, `${V1}/$batch`, {
        signal: ctx.signal,
        wait: ctx.wait,
        method: 'POST',
        jsonBody: { requests: chunk.map((id, n) => ({ id: String(n), method: 'GET', url: `/reports/authenticationMethods/userRegistrationDetails/${encodeURIComponent(id)}` })) },
      })
      for (const r of Array.isArray(body.responses) ? body.responses : []) {
        const id = chunk[Number(r?.id)]
        const row = r?.status === 200 && r.body && typeof r.body === 'object' ? mapRegistration(r.body) : null
        // Only the person asked about, and only a row that says which methods they hold.
        if (id && row && row.id === id && Array.isArray((r.body as Record<string, unknown>).methodsRegistered)) out.push(row)
      }
    } catch (error) {
      // A refused or failed batch leaves these people unknown; the report is a fallback, never a failure of the scan.
      if (ctx.signal.aborted) throw error
    }
  }
  return out
}

function mapRegistration(raw: unknown): RegistrationRow {
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
    complete: typeof r.isMfaCapable === 'boolean' && typeof r.isMfaRegistered === 'boolean' && typeof r.isPasswordlessCapable === 'boolean' && Array.isArray(r.methodsRegistered),
  }
}

// `activityRead` is whether this read selected signInActivity and succeeded.
// On such a read Graph leaves the property out for an account that never
// signed in (https://learn.microsoft.com/graph/api/resources/user), so its
// absence is "never signed in", read like every other account. Judged per row
// instead, those accounts read as "not read" and left the dormant step on
// every real tenant (docs/plans/roadmap-flow/v2-research/dormant.md §5).
function mapUser(raw: unknown, activityRead: boolean): UserRow {
  const u = raw as Record<string, unknown>
  const activity = (u.signInActivity ?? null) as Record<string, unknown> | null
  const successfulSignInActivityRead = activityRead
  const onPremisesSyncEnabledRead = Object.prototype.hasOwnProperty.call(u, 'onPremisesSyncEnabled')
  const lastSuccessful = typeof activity?.lastSuccessfulSignInDateTime === 'string' ? activity.lastSuccessfulSignInDateTime : null
  const lastAttempt = typeof activity?.lastSignInDateTime === 'string' ? activity.lastSignInDateTime : null
  const plans = Array.isArray(u.assignedPlans) ? u.assignedPlans : []
  const licences = Array.isArray(u.assignedLicenses) ? u.assignedLicenses : []
  return {
    skuIds: licences.map((l) => (l as Record<string, unknown>).skuId).filter((id): id is string => typeof id === 'string'),
    id: String(u.id ?? ''),
    displayName: typeof u.displayName === 'string' ? u.displayName : null,
    userPrincipalName: typeof u.userPrincipalName === 'string' ? u.userPrincipalName : null,
    userType: u.userType === 'Guest' || u.userType === 'guest' ? 'guest' : 'member',
    usageLocation: typeof u.usageLocation === 'string' ? u.usageLocation : null,
    createdDateTime: typeof u.createdDateTime === 'string' ? u.createdDateTime : null,
    lastSignInAttempt: lastAttempt,
    lastSuccessfulSignIn: lastSuccessful,
    successfulSignInActivityRead,
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
    onPremisesSyncEnabledRead,
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
    'id,displayName,userPrincipalName,userType,usageLocation,createdDateTime,accountEnabled,mail,assignedPlans,assignedLicenses,onPremisesSyncEnabled,externalUserState,department,jobTitle,officeLocation'
  const select = `${baseSelect},signInActivity`
  const read = (raw: unknown) => mapUser(raw, true)
  const unread = (raw: unknown) => mapUser(raw, false)
  if (!opts.includeSignInActivity) {
    const rows = await graphPaged(ctx.tokens, `${V1}/users?$select=${baseSelect}&$top=999`, {
      signal: ctx.signal,
      onPage: async (page) => onUserPage(page.map(unread)),
    })
    return {
      users: rows.map(unread),
      partialReason: `signInActivity ${licenceGateReason('entraP1')}`,
    }
  }
  try {
    const rows = await graphPaged(ctx.tokens, `${V1}/users?$select=${select}&$top=999`, {
      signal: ctx.signal,
      onPage: async (page) => onUserPage(page.map(read)),
    })
    return { users: rows.map(read), partialReason: null }
  } catch (e) {
    if (!(e instanceof SectionDisabledError)) throw e
    const rows = await graphPaged(
      ctx.tokens,
      `${V1}/users?$select=id,displayName,userPrincipalName,userType,usageLocation,createdDateTime,accountEnabled,mail,assignedPlans,assignedLicenses,onPremisesSyncEnabled,externalUserState,department,jobTitle,officeLocation&$top=999`,
      { signal: ctx.signal, onPage: async (page) => onUserPage(page.map(unread)) },
    )
    return { users: rows.map(unread), partialReason: `signInActivity unavailable: ${e.message}` }
  }
}

export async function collectDevices(ctx: Ctx): Promise<DeviceRow[]> {
  const url = `${V1}/devices?$select=id,deviceId,displayName,isCompliant,isManaged,trustType,operatingSystem,operatingSystemVersion,approximateLastSignInDateTime&$expand=${encodeURIComponent('registeredOwners($select=id)')}&$top=999`
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
      deviceId: typeof d.deviceId === 'string' ? d.deviceId : null,
      operatingSystemVersion: typeof d.operatingSystemVersion === 'string' ? d.operatingSystemVersion : null,
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
  // A Mac's Platform SSO credential (Platform Credential for macOS): phishing-resistant, counted as that Mac's built-in method.
  platformCredentialAuthenticationMethod: 'platformCredential',
  phoneAuthenticationMethod: 'phone',
  softwareOathAuthenticationMethod: 'softwareOath',
  temporaryAccessPassAuthenticationMethod: 'temporaryAccessPass',
  emailAuthenticationMethod: 'email',
  passwordAuthenticationMethod: 'password',
}

// Strips method values (phone numbers, email addresses) at the fetch layer —
// they never enter the snapshot (§10.2, §11).
function mapMethod(raw: unknown, sourceVersion: 'v1.0' | 'beta' = 'v1.0'): AuthMethodSummary {
  const m = raw as Record<string, unknown>
  const type = String(m['@odata.type'] ?? '').replace('#microsoft.graph.', '')
  const kind = KIND_BY_TYPE[type] ?? 'other'
  const out: AuthMethodSummary = { kind }
  // The qualifying methods keep their id, so a later scan can tell one that disappeared from one that did not (scoring/mfaHistory.ts).
  if ((kind === 'passkey' || kind === 'fido2' || kind === 'windowsHelloForBusiness' || kind === 'platformCredential') && typeof m.id === 'string') out.id = m.id
  if (kind === 'platformCredential' && typeof m.displayName === 'string') out.displayName = m.displayName
  // Graph's method resources name the date createdDateTime; the list-methods example shows creationDateTime. Either is the same fact.
  const created = typeof m.createdDateTime === 'string' ? m.createdDateTime : m.creationDateTime
  if (typeof created === 'string') out.createdDateTime = created
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
    if (typeof m.aaGuid === 'string') out.aaGuid = m.aaGuid
    if (typeof m.attestationLevel === 'string') out.attestationLevel = m.attestationLevel
    if (typeof m.passkeyType === 'string') out.passkeyType = m.passkeyType
    if (typeof m.lastUsedDateTime === 'string') out.lastUsedDateTime = m.lastUsedDateTime
    out.sourceVersion = sourceVersion
  }
  if (kind === 'phone' && typeof m.phoneType === 'string') {
    out.phoneType = m.phoneType as AuthMethodSummary['phoneType']
  }
  if (kind === 'temporaryAccessPass') out.isUsable = m.isUsable === true
  return out
}

/** A $batch answer worth asking again: throttled, a server error, an expired token, or none at all. A 403 or 404 is an answer. */
const transientSubrequest = (status: number | undefined): boolean => status === undefined || status === 401 || status === 429 || status >= 500
/** How many people in one batch may still fail their own read before the rest of that batch waits for the next scan. */
export const METHOD_REREAD_FAILURES = 2

// One $batch per 20 users. A person whose read failed for a passing reason
// (throttling, a server error, a failed page, the batch itself failing) is read
// again on their own through the retry policy, after the batch's Retry-After.
// A person still unread after that, or refused (403), is 'unknown': the
// registration report stands in (scoring/phishingResistant.ts inventory), and
// it never fails the section.
export async function collectMethodsForUsers(ctx: Ctx, userIds: string[]): Promise<MethodsByUser> {
  const out: MethodsByUser = {}
  for (let i = 0; i < userIds.length; i += 20) {
    const chunk = userIds.slice(i, i + 20)
    const again = new Set<string>()
    let pauseMs = 0
    try {
      const body = await graphRequest(ctx.tokens, `${V1}/$batch`, {
        signal: ctx.signal,
        wait: ctx.wait,
        method: 'POST',
        jsonBody: {
          requests: chunk.map((id, n) => ({
            id: String(n),
            method: 'GET',
            url: `/users/${id}/authentication/methods`,
          })),
        },
      })
      for (const r of Array.isArray(body.responses) ? body.responses : []) {
        const userId = chunk[Number(r?.id)]
        if (!userId) continue
        const responseBody = r.body as { value?: unknown[]; '@odata.nextLink'?: unknown } | undefined
        let value = responseBody?.value
        if (r.status === 200 && Array.isArray(value) && typeof responseBody?.['@odata.nextLink'] === 'string') {
          try {
            value = [...value, ...await graphPaged(ctx.tokens, responseBody['@odata.nextLink'], { signal: ctx.signal, wait: ctx.wait })]
          } catch (error) {
            if (ctx.signal.aborted) throw error
            value = undefined
          }
        }
        if (r.status === 200 && Array.isArray(value)) {
          out[userId] = value.map(item => mapMethod(item))
          continue
        }
        out[userId] = 'unknown'
        if (r.status === 200 || transientSubrequest(r.status)) again.add(userId)
        if (r.status === 429) {
          const retryAfter = Object.entries(r.headers ?? {}).find(([k]) => k.toLowerCase() === 'retry-after')?.[1]
          pauseMs = Math.max(pauseMs, retryAfterMs(retryAfter))
        }
      }
    } catch (error) {
      // A refused batch is a permission answer and a cancelled scan stops; anything else is read again per person.
      if (ctx.signal.aborted || error instanceof SectionDisabledError) throw error
    }
    // A user the batch answered nothing for is unread, never a person with no methods.
    for (const id of chunk) {
      if (out[id] !== undefined) continue
      out[id] = 'unknown'
      again.add(id)
    }
    if (again.size === 0) continue
    // The batch's Retry-After is honoured before a throttled person is asked again.
    if (pauseMs > 0) await (ctx.wait ?? sleep)(pauseMs, ctx.signal)
    let failed = 0
    for (const id of again) {
      try {
        const value = await graphPaged(ctx.tokens, `${V1}/users/${encodeURIComponent(id)}/authentication/methods`, { signal: ctx.signal, wait: ctx.wait })
        out[id] = value.map(item => mapMethod(item))
      } catch (error) {
        if (ctx.signal.aborted) throw error
        // Still unread after the retry policy: unknown, never a person with no methods.
        // Two such in one batch is Graph having a bad minute; the rest wait for the next scan.
        if (++failed >= METHOD_REREAD_FAILURES) break
      }
    }
  }
  // Read the concrete FIDO2 collection from v1.0 for every user. The generic
  // authentication-method list remains the complete inventory; this dedicated
  // read supplies the credential fields used for exact compatibility without
  // turning one failed subrequest into an empty credential list.
  for (let i = 0; i < userIds.length; i += 20) {
    const chunk = userIds.slice(i, i + 20)
    try {
      const body = await graphRequest(ctx.tokens, `${V1}/$batch`, {
        signal: ctx.signal,
        method: 'POST',
        jsonBody: { requests: chunk.map((id, n) => ({ id: String(n), method: 'GET', url: `/users/${encodeURIComponent(id)}/authentication/fido2Methods` })) },
      })
      for (const response of Array.isArray(body.responses) ? body.responses : []) {
        const userId = chunk[Number(response?.id)]
        const responseBody = response?.body as { value?: unknown[]; '@odata.nextLink'?: unknown } | undefined
        let values = responseBody?.value
        if (response?.status === 200 && Array.isArray(values) && typeof responseBody?.['@odata.nextLink'] === 'string') {
          try {
            values = [...values, ...await graphPaged(ctx.tokens, responseBody['@odata.nextLink'], { signal: ctx.signal })]
          } catch {
            values = undefined
          }
        }
        if (!userId || response?.status !== 200 || !Array.isArray(values) || !Array.isArray(out[userId])) continue
        const detailed = values.map(value => mapMethod(value, 'v1.0'))
        const byId = new Map(detailed.filter(method => method.id).map(method => [method.id!, method]))
        const merged = out[userId].map(method => method.id && byId.has(method.id) ? { ...method, ...byId.get(method.id)! } : method)
        const seen = new Set(merged.flatMap(method => method.id ? [method.id] : []))
        out[userId] = [...merged, ...detailed.filter(method => !method.id || !seen.has(method.id))]
      }
    } catch {
      // Keep the generic inventory. A failed detail read is unresolved detail,
      // never proof that the user has no registered passkey.
    }
  }
  // Enrich only observed FIDO2 methods with beta's optional last-use timestamp.
  // Failure leaves the complete v1.0 inventory intact and the timestamp unknown.
  const candidates = userIds.filter(id => Array.isArray(out[id]) && out[id].some(method => method.kind === 'fido2' || method.kind === 'passkey'))
  for (let i = 0; i < candidates.length; i += 20) {
    const chunk = candidates.slice(i, i + 20)
    try {
      const body = await graphRequest(ctx.tokens, `${BETA}/$batch`, {
        signal: ctx.signal,
        method: 'POST',
        jsonBody: { requests: chunk.map((id, n) => ({ id: String(n), method: 'GET', url: `/users/${encodeURIComponent(id)}/authentication/fido2Methods` })) },
      })
      for (const response of Array.isArray(body.responses) ? body.responses : []) {
        const userId = chunk[Number(response?.id)]
        const values = (response?.body as { value?: unknown[] } | undefined)?.value
        if (!userId || response?.status !== 200 || !Array.isArray(values) || !Array.isArray(out[userId])) continue
        // Only a row that reports the field says anything: a date is its last use, and an explicit null
        // is "never used" (the marker without a date); a row without the field leaves it unknown.
        const reported = values.filter(value => value !== null && typeof value === 'object' && 'lastUsedDateTime' in (value as Record<string, unknown>))
        const detailed = new Map(reported.map(value => mapMethod(value, 'beta')).filter(method => method.id).map(method => [method.id!, method]))
        out[userId] = out[userId].map(method => {
          const beta = method.id ? detailed.get(method.id) : undefined
          if (!beta) return method
          return beta.lastUsedDateTime ? { ...method, lastUsedDateTime: beta.lastUsedDateTime, lastUsedSourceVersion: 'beta' as const } : { ...method, lastUsedSourceVersion: 'beta' as const }
        })
      }
    } catch {
      // Optional beta enrichment; absence is not evidence that a credential was never used.
    }
  }
  return out
}

/** Read legacy per-user MFA independently from migration status and registered
 * methods. User pages already cover the directory; batches contain at most 20
 * requests. Every absent, failed, or future enum response remains unknown. */
export async function collectPerUserMfaForUsers(ctx: Ctx, userIds: string[]): Promise<PerUserMfaByUser> {
  const out: PerUserMfaByUser = {}
  const record = (id: string, body: unknown): void => {
    const state = body && typeof body === 'object' ? (body as Record<string, unknown>).perUserMfaState : undefined
    out[id] = state === 'disabled' || state === 'enabled' || state === 'enforced'
      ? { state, reason: null }
      : { state: 'unknown', reason: 'The authentication requirements response did not contain a supported per-user MFA state.' }
  }
  for (let offset = 0; offset < userIds.length; offset += 20) {
    const chunk = userIds.slice(offset, offset + 20)
    for (const id of chunk) out[id] = { state: 'unknown', reason: 'The authentication requirements batch did not return this account.' }
    try {
      const body = await graphRequest(ctx.tokens, `${BETA}/$batch`, {
        signal: ctx.signal, method: 'POST', jsonBody: { requests: chunk.map((id, index) => ({ id: String(index), method: 'GET', url: `/users/${encodeURIComponent(id)}/authentication/requirements` })) },
      })
      for (const response of Array.isArray(body.responses) ? body.responses : []) {
        const index = String(response?.id ?? '')
        if (!/^(0|[1-9][0-9]*)$/.test(index)) continue
        const id = chunk[Number(index)]
        if (!id) continue
        if (response.status === 200) { record(id, response.body); continue }
        if (response.status === 401 || response.status >= 500) {
          // Retry a transient subrequest through the normal request helper.
          // Throttled subrequests remain unknown for the next scan rather
          // than immediately violating the batch's Retry-After response.
          try {
            record(id, await graphRequest(ctx.tokens, `${BETA}/users/${encodeURIComponent(id)}/authentication/requirements`, { signal: ctx.signal }))
            continue
          } catch (error) {
            if (ctx.signal.aborted) throw error
          }
        }
        out[id] = { state: 'unknown', reason: `Authentication requirements could not be read (HTTP ${Number(response.status) || 'unknown'}).` }
      }
    } catch (error) {
      if (ctx.signal.aborted) throw error
      const status = error instanceof GraphRequestError || error instanceof SectionDisabledError ? error.status : null
      for (const id of chunk) out[id] = { state: 'unknown', reason: status ? `Authentication requirements could not be read (HTTP ${status}).` : 'Authentication requirements could not be read because the request failed.' }
    }
  }
  return out
}
