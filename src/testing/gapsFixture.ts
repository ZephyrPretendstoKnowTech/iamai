// The mock tenant's refusals (test support, dev-only like uiSnapshot.ts): a
// scan that could not read the Conditional Access policies or the sign-in
// records, and a token whose roles read nothing IAMAI needs. Invented ids; the
// role template ids are Microsoft's, the same in every tenant.
import type { ConfigSection, ConfigSectionKey, TenantSnapshot } from '../graph/collect/types.ts'
import { ROLE_TEMPLATE_IDS } from '../graph/collect/tokenRoles.ts'
import { fixtureSnapshot } from './uiSnapshot.ts'

/** Graph's own words for a delegated read the account's role does not reach. */
export const REFUSED = 'Insufficient privileges to complete the operation.'
/** The default User role every member holds; no directory read comes with it. */
export const USER_ROLE_ID = 'b79fbf4d-3ef9-4689-8143-76b194e85509'

/** The fixture's scan without its policies section (the read never landed) and with the sign-in records refused. */
export function gapsSnapshot(): TenantSnapshot {
  const s = fixtureSnapshot()
  delete (s.config as Partial<Record<ConfigSectionKey, ConfigSection>>).caPolicies
  s.sources.signInEvidence = { status: 'disabled', coveredWindow: null, reason: REFUSED, asOf: s.asOf }
  s.signInEvidence = {}
  s.evidencePolicyResults = []
  s.blockedToday = []
  s.evidenceUsage = null
  s.evidenceAggregates = null
  s.scenarioEvidence = null
  return s
}

const b64url = (s: string): string => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** A token shaped like Graph's (three segments, the claims in the middle one), never a real one. */
export function tokenWithRoleIds(ids: string[]): string {
  return `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({ aud: 'https://graph.microsoft.com', wids: ids }))}.signature`
}

export function tokenWithRoles(names: string[]): string {
  return tokenWithRoleIds(
    names.map((n) => {
      const id = ROLE_TEMPLATE_IDS[n]
      if (!id) throw new Error(`no template id for ${n}`)
      return id
    }),
  )
}

/** The signed-in account holds the User role and nothing else. */
export function noRolesToken(): string {
  return tokenWithRoleIds([USER_ROLE_ID])
}

/** A sign-in that did not succeed, as MSAL reports it: the code and Microsoft's message, for the three tile-1 states. */
export function mockAuthError(kind: string): { code: string; message: string } {
  switch (kind) {
    case 'consent':
      return { code: 'consent_required', message: "AADSTS65001: The user or administrator has not consented to use the application with ID '13f55900-8e9a-4aa3-82c1-e42a4448680f' named 'IAMAI Planner' for user 'alex@contoso.com'." }
    case 'personal':
      return { code: 'invalid_request', message: "AADSTS50020: User account 'someone@outlook.com' from identity provider 'live.com' does not exist in tenant 'organizations' and cannot access the application." }
    case 'cancelled':
      return { code: 'user_cancelled', message: 'User cancelled the flow.' }
    default:
      return { code: 'server_error', message: `AADSTS90002: Tenant not found (${kind}).` }
  }
}

/** A token that carries no roles claim at all: it says nothing about roles. */
export function tokenWithoutClaim(): string {
  return `${b64url('{"alg":"none"}')}.${b64url('{"aud":"https://graph.microsoft.com"}')}.signature`
}
