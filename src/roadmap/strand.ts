// Strand simulation (roadmap-v2.md §7): would carrying out a step, as written,
// lock a given account out? Pure: runs in tests, the worker and the page.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { finalTargets, implementationOffered, isOpenPolicy } from './operations.ts'
import type { Step } from './types.ts'

export type StrandVerdict = { stranded: boolean; unknown: boolean; reason: string }

const PHISHING_RESISTANT = new Set([
  'fido2SecurityKey',
  'passKeyDeviceBound',
  'passKeyDeviceBoundAuthenticator',
  'windowsHelloForBusiness',
  'x509Certificate',
  'microsoftAuthenticatorPasswordless',
])

/**
 * Steps that can deny or interrupt access when enforced (roadmap-v2.md §1):
 * grant requirements, device requirements, session controls, blocks. Read
 * from the policy body the step creates or changes; the goal family decides
 * when there is no body.
 */
export function canDenyAccess(step: Step): boolean {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'check') return false
  type Body = { grantControls?: { builtInControls?: string[]; authenticationStrength?: unknown } | null; sessionControls?: Record<string, unknown> | null }
  const denies = (body: Body): boolean => {
    const grant = body.grantControls
    if (grant && ((grant.builtInControls?.length ?? 0) > 0 || grant.authenticationStrength)) return true
    return Boolean(body.sessionControls && Object.values(body.sessionControls).some((v) => v !== null && v !== undefined))
  }
  // A policy the plan can write answers for itself: what it leaves behind is a
  // create's body or an update's policy with its patch applied
  // (roadmap/operations.ts finalTargets). The goal's family never overrules it,
  // and a policy the plan cannot write invents no impact at all.
  if (isOpenPolicy(step)) {
    if (!implementationOffered(step)) return false
    return (finalTargets(step) as Body[]).some(denies)
  }
  // A policy already in place has no operation but is live in the tenant, and a
  // step that is not a policy at all — the enforce step — has none either: the
  // goal family decides for both, as it always did.
  return step.readiness.family !== 'other'
}

/** Steps that prompt people (a grant they must satisfy) rather than silently block a protocol. */
export function promptsPeople(step: Step): boolean {
  return canDenyAccess(step) && step.readiness.family !== 'block' && step.readiness.family !== 'location'
}

export function wouldStrand(
  step: Step,
  accountId: string,
  snapshot: TenantSnapshot,
  opts: { breakGlass: boolean; allowedCountries: string[] },
): StrandVerdict {
  if (!canDenyAccess(step)) return { stranded: false, unknown: false, reason: 'the step cannot deny access' }
  if (!step.population.ids.includes(accountId)) return { stranded: false, unknown: false, reason: 'the account is out of scope' }
  if (opts.breakGlass) return { stranded: true, unknown: false, reason: 'a break-glass account is in scope of a step that can deny access' }
  return accountVerdict(step.readiness.family, accountId, snapshot, opts.allowedCountries)
}

/** The account's own ability to satisfy a control family, from what the scan holds. */
export function accountVerdict(family: Step['readiness']['family'], accountId: string, snapshot: TenantSnapshot, allowedCountries: string[]): StrandVerdict {
  const reg = snapshot.registrationDetails.find((r) => r.id === accountId) ?? null
  const methods = reg?.methodsRegistered ?? []
  const registrationKnown = snapshot.sources.registrationDetails.status === 'ok'
  switch (family) {
    case 'mfa':
    case 'guest':
      if (!registrationKnown) return { stranded: false, unknown: true, reason: 'registration data was not readable' }
      return reg?.isMfaCapable
        ? { stranded: false, unknown: false, reason: 'the account can complete MFA' }
        : { stranded: true, unknown: false, reason: 'the account has no MFA method' }
    case 'admin':
      if (!registrationKnown) return { stranded: false, unknown: true, reason: 'registration data was not readable' }
      return methods.some((m) => PHISHING_RESISTANT.has(m))
        ? { stranded: false, unknown: false, reason: 'the account holds a phishing-resistant method' }
        : { stranded: true, unknown: false, reason: 'the account has no phishing-resistant method' }
    case 'device': {
      if (snapshot.sources.devices.status !== 'ok') return { stranded: false, unknown: true, reason: 'device data was not readable' }
      const ok = snapshot.devices.some((d) => d.ownerIds.includes(accountId) && (d.isCompliant === true || d.trustType === 'ServerAd'))
      return ok
        ? { stranded: false, unknown: false, reason: 'the account owns a compliant or hybrid-joined device' }
        : { stranded: true, unknown: false, reason: 'the account owns no compliant device' }
    }
    case 'block': {
      const usage = snapshot.evidenceUsage
      if (!usage) return { stranded: false, unknown: true, reason: 'no sign-in evidence' }
      const seen =
        usage.legacyAuth.userIds.includes(accountId) || usage.deviceCode.userIds.includes(accountId) || usage.authTransfer.userIds.includes(accountId)
      return seen
        ? { stranded: true, unknown: false, reason: 'the account was seen using what the step blocks' }
        : { stranded: false, unknown: false, reason: 'no observed use of what the step blocks' }
    }
    case 'location': {
      const u = snapshot.users.find((x) => x.id === accountId)
      if (!u?.usageLocation) return { stranded: false, unknown: true, reason: 'no usage location on the account' }
      return allowedCountries.includes(u.usageLocation)
        ? { stranded: false, unknown: false, reason: 'the account is in an allowed country' }
        : { stranded: true, unknown: false, reason: `the account is in a country (${u.usageLocation}) the step blocks` }
    }
    default:
      return { stranded: false, unknown: false, reason: 'no deny condition' }
  }
}
