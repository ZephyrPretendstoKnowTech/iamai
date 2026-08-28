// Service-account detection (ux-review-03 §A5): candidates from data the
// scan already holds, each with the evidence that put it there. Pure.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import { SETUP_PAGE } from '../copy/setup.ts'

const NAME_PATTERN = /\b(?:svc|service|printer|scanner|copier|smtp|relay|fax|kiosk|noreply|no-reply|automation)\b/i

// Exchange Online service plans: an account licensed for mail only is a
// mailbox, not a person.
const EXCHANGE_PLANS = new Set([
  '9aaf7827-d63c-4b61-89c3-182f06f82e5c', // EXCHANGE_S_STANDARD
  'efb87545-963c-4e0d-99df-69c6916d9eb0', // EXCHANGE_S_ENTERPRISE
  '4a82b400-a79f-41a4-b4e2-e94f5787b113', // EXCHANGE_S_DESKLESS
  '1126bef5-da20-4f07-b45e-ad25d2581aa8', // EXCHANGE_S_ESSENTIALS
  '9f431833-0334-42de-a7dc-70aa40db46db', // EXCHANGE_S_ENTERPRISE (E5 plan variant)
  '176a09a6-7ec5-4039-ac02-b2791c6ba793', // EXCHANGE_S_ARCHIVE_ADDON
])

const MFA_KINDS = new Set(['microsoftAuthenticator', 'passkey', 'fido2', 'windowsHelloForBusiness', 'phone', 'softwareOath', 'temporaryAccessPass'])

export type ServiceAccountCandidate = {
  id: string
  name: string
  upn: string | null
  /** Evidence lines, in plain language. */
  evidence: string[]
  /** Name pattern hit, or strong enough signals. */
  strength: 'strong' | 'possible'
}

export function detectServiceAccounts(snapshot: TenantSnapshot, excludeIds: Iterable<string> = []): ServiceAccountCandidate[] {
  const E = SETUP_PAGE.serviceEvidence
  const skip = new Set(excludeIds)
  const legacy = new Set(snapshot.evidenceUsage?.legacyAuth.userIds ?? [])
  const hasEvidence = snapshot.sources.signInEvidence?.status === 'ok' || snapshot.sources.signInEvidence?.status === 'partial'
  const out: ServiceAccountCandidate[] = []
  for (const u of snapshot.users) {
    if (skip.has(u.id) || u.userType === 'guest' || u.accountEnabled === false) continue
    const evidence: string[] = []
    const nameHit = NAME_PATTERN.exec(u.displayName ?? '') ?? NAME_PATTERN.exec((u.userPrincipalName ?? '').split('@')[0] ?? '')
    if (nameHit) evidence.push(E.name(nameHit[0].toLowerCase()))

    const methods = snapshot.authMethods[u.id]
    if (Array.isArray(methods) && !methods.some((m) => MFA_KINDS.has(m.kind))) evidence.push(E.noMethod)

    const ev = snapshot.signInEvidence[u.id]
    if (hasEvidence && (!ev || ev.signInCount === 0) && u.lastSuccessfulSignIn === null) evidence.push(E.neverInteractive)
    else if (legacy.has(u.id)) evidence.push(E.legacyOnly)

    if (exchangeOnly(u)) evidence.push(E.exchangeOnly)
    if (u.department === null && u.jobTitle === null) evidence.push(E.noProfile)

    const strong = nameHit !== null && evidence.length >= 2
    const possible = nameHit === null && evidence.length >= 3
    if (strong || possible || (nameHit !== null && evidence.length === 1 && exchangeOnly(u))) {
      out.push({ id: u.id, name: u.displayName ?? u.userPrincipalName ?? u.id, upn: u.userPrincipalName, evidence, strength: strong ? 'strong' : 'possible' })
    }
  }
  return out.sort((a, b) => (a.strength === b.strength ? a.name.localeCompare(b.name) : a.strength === 'strong' ? -1 : 1))
}

function exchangeOnly(u: UserRow): boolean {
  const plans = u.assignedPlans.filter((p) => p.capabilityStatus === '' || p.capabilityStatus === 'Enabled')
  return plans.length > 0 && plans.every((p) => EXCHANGE_PLANS.has(p.servicePlanId.toLowerCase()))
}
