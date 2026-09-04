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
/** The shape the impact rules read out of a policy: what it grants and what it does to a session. */
type Control = { grantControls?: { builtInControls?: string[]; authenticationStrength?: unknown } | null; sessionControls?: Record<string, unknown> | null; conditions?: { locations?: unknown } | null }

const lc = (s: string): string => s.toLowerCase()
const builtIn = (body: Control): Set<string> => new Set((body.grantControls?.builtInControls ?? []).map(lc))
const hasSession = (body: Control): boolean => Boolean(body.sessionControls && Object.values(body.sessionControls).some((v) => v !== null && v !== undefined))

/** A policy that grants or restricts something can stop or interrupt a sign-in. */
function denies(body: Control): boolean {
  const grant = body.grantControls
  if (grant && ((grant.builtInControls?.length ?? 0) > 0 || grant.authenticationStrength)) return true
  return hasSession(body)
}

/** A policy that asks a person for something, rather than simply stopping them. */
function prompts(body: Control): boolean {
  if (builtIn(body).has('block')) return false
  const grant = body.grantControls
  if (grant?.authenticationStrength) return true
  if (builtIn(body).size > 0) return true
  return hasSession(body)
}

/**
 * The policies a step describes, when it is an open policy the plan can write:
 * a create's body, an update's policy with its patch applied
 * (roadmap/operations.ts finalTargets). Null for anything else — a policy
 * already in place, the enforce step — which has no operation of its own and is
 * read by its goal's family, as it always was.
 */
function policiesOf(step: Step): Control[] | null {
  if (!isOpenPolicy(step)) return null
  return implementationOffered(step) ? (finalTargets(step) as Control[]) : []
}

export function canDenyAccess(step: Step): boolean {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'check') return false
  const policies = policiesOf(step)
  if (policies !== null) return policies.some(denies)
  return step.readiness.family !== 'other'
}

/**
 * Steps that prompt people (something they must satisfy) rather than silently
 * blocking a protocol. An open policy answers from what it will leave behind and
 * from nothing else: a Block asks nobody for anything, whatever family the goal
 * is filed under, and a policy that asks for a method prompts even when it is
 * not.
 */
export function promptsPeople(step: Step): boolean {
  const policies = policiesOf(step)
  if (policies !== null) return policies.some(prompts)
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
