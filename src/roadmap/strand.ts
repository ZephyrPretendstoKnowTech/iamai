// Strand simulation (roadmap-v2.md §7): would carrying out a step, as written,
// lock a given account out? Pure: runs in tests, the worker and the page.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { isOpenPolicy, stepEffects } from './operations.ts'
import type { PolicyEffect, Requirement } from './operations.ts'
import { strengthTier } from '../coverage/strength.ts'
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
/**
 * What the step's own policies ask of people, when it is an open policy the plan
 * can write (roadmap/operations.ts stepEffects). Null for anything else — a
 * policy already in place, the enforce step — which has no operation of its own
 * and is read by its goal's family, as it always was.
 */
export function effectsOf(step: Step): PolicyEffect[] | null {
  if (!isOpenPolicy(step)) return null
  return stepEffects(step)
}

export function canDenyAccess(step: Step): boolean {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'check') return false
  const effects = effectsOf(step)
  if (effects !== null) return effects.some((e) => e.any)
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
  const effects = effectsOf(step)
  if (effects !== null) return effects.some((e) => !e.blocks && e.any)
  return canDenyAccess(step) && step.readiness.family !== 'block' && step.readiness.family !== 'location'
}

/**
 * Whether one account can satisfy one requirement, from what the scan holds.
 * Each kind of requirement is kept distinct: a device is not an app, and an app
 * is not a method. Where the scan cannot answer — a strength nothing describes,
 * an app requirement no sign-in evidence covers — the answer is `unknown`, never
 * a guess and never the goal's own family.
 */
function requirementVerdict(req: Requirement, accountId: string, snapshot: TenantSnapshot, allowedCountries: string[]): StrandVerdict {
  switch (req.kind) {
    case 'mfa':
      return accountVerdict('mfa', accountId, snapshot, allowedCountries)
    case 'strength':
      if (req.combinations.length === 0) return { stranded: false, unknown: true, reason: 'the strength this policy requires could not be read' }
      return accountVerdict(strengthTier(req.combinations) === 'phishingResistant' ? 'admin' : 'mfa', accountId, snapshot, allowedCountries)
    case 'device':
      return accountVerdict('device', accountId, snapshot, allowedCountries)
    case 'app':
      return { stranded: false, unknown: true, reason: 'the scan does not say which apps this account signs in with' }
    case 'passwordChange':
      return { stranded: false, unknown: false, reason: 'the account can change its own password' }
    case 'other':
      return { stranded: false, unknown: true, reason: `the scan cannot say whether this account satisfies ${req.control}` }
  }
}

/**
 * Whether one account is stranded by one policy, read from the policy itself.
 * A block is judged by what people were seen doing; a policy that names places
 * by where the account signs in from; a policy that asks for things by whether
 * the account can satisfy them — every requirement kept apart, combined the way
 * the policy combines them: all of them for AND, any one of them for OR. Where
 * the policy says something IAMAI cannot read, the answer is `unknown`, and
 * under OR an unreadable alternative withdraws a stranded verdict too, because
 * it may be the way through.
 */
export function policyVerdict(effect: PolicyEffect, accountId: string, snapshot: TenantSnapshot, allowedCountries: string[]): StrandVerdict {
  const decided = ((): StrandVerdict => {
    // A block is judged by what people were seen doing, or by where they sign in
    // from when it names places.
    if (effect.blocks) return accountVerdict(effect.usesLocations ? 'location' : 'block', accountId, snapshot, allowedCountries)
    const verdicts = effect.requirements.map((r) => requirementVerdict(r, accountId, snapshot, allowedCountries))
    if (verdicts.length === 0) {
      // A policy that only scopes a place, or only shortens a session, asks for
      // nothing a person could fail to have.
      if (effect.usesLocations) return accountVerdict('location', accountId, snapshot, allowedCountries)
      return { stranded: false, unknown: false, reason: 'no deny condition' }
    }
    if (effect.operator === 'AND') return verdicts.find((v) => v.stranded) ?? verdicts.find((v) => v.unknown) ?? verdicts[0]
    return verdicts.find((v) => !v.stranded && !v.unknown) ?? verdicts.find((v) => v.unknown) ?? verdicts[0]
  })()
  if (effect.unknown.length === 0) return decided
  // Something in the policy could not be read. It stands only where reading it
  // could not help: a block is a block, and under AND a requirement already
  // failed. Under OR the unreadable part may be the way through, so a stranded
  // verdict is withdrawn rather than asserted.
  const unreadable = { stranded: false, unknown: true, reason: effect.unknown[0] }
  if (decided.stranded && (effect.blocks || effect.operator === 'AND')) return decided
  return unreadable
}

/**
 * Whether one account is stranded by what the step will actually leave behind.
 * A step with several policies is stranded by any of them; where one cannot be
 * read from the scan the answer is unknown, never a guess from the goal's family.
 */
export function stepAccountVerdict(step: Step, accountId: string, snapshot: TenantSnapshot, allowedCountries: string[]): StrandVerdict {
  const effects = effectsOf(step)
  if (effects === null) return accountVerdict(step.readiness.family, accountId, snapshot, allowedCountries)
  let unknown: StrandVerdict | null = null
  for (const effect of effects) {
    const verdict = policyVerdict(effect, accountId, snapshot, allowedCountries)
    if (verdict.stranded) return verdict
    if (verdict.unknown) unknown = unknown ?? verdict
  }
  return unknown ?? { stranded: false, unknown: false, reason: 'no deny condition' }
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
  // The policy the step will actually leave behind decides, not the goal it is
  // filed under (roadmap/operations.ts stepEffects).
  return stepAccountVerdict(step, accountId, snapshot, opts.allowedCountries)
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
