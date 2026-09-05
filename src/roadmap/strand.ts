// Strand simulation (roadmap-v2.md §7): would carrying out a step, as written,
// lock a given account out? Pure: runs in tests, the worker and the page.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { accountApplicability, isOpenPolicy, stepEffects, strengthLookupOf } from './operations.ts'
import type { Applicability, Narrowing, PolicyEffect, Requirement, ScopeEvidence } from './operations.ts'
import type { Step } from './types.ts'

export type StrandVerdict = { stranded: boolean; unknown: boolean; reason: string }

/**
 * What the tenant can prove, beside the policy itself: who is in a group, what
 * countries a named location holds, and what each authentication strength
 * allows. Nothing here is a substitute for the policy — a named location the
 * plan has not resolved is not answered by the countries the operator picked,
 * and a strength with no row is not answered by a tier it resembles.
 */
export type StrandContext = ScopeEvidence & {
  /** The countries each named location the plan resolved actually holds, by location id. */
  countryLocations?: Record<string, readonly string[]>
  /** What each strength allows, by id; built from the tenant's own metadata (operations.ts strengthLookupOf). */
  strengths?: Map<string, string[]>
  /** Kept for the callers that still describe the tenant's allowed countries; never used to judge a location the plan has not resolved. */
  allowedCountries?: string[]
}

/** The sign-in risk levels Identity Protection's records actually carry. */
const MEASURED_RISK_LEVELS = new Set(['high', 'medium'])

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

/**
 * The goal family's reading of a step, and the one place anything may ask for
 * it. It answers only for a step with no policy of its own — one already in
 * place, the enforce step — and is null for an open policy, whose consequences
 * are its operations' to decide and nothing else's (Foundation A). Every
 * consumer that once fell back to `step.readiness.family` goes through here, so
 * the fallback is unreachable for an open policy by construction rather than by
 * each caller remembering to guard it.
 */
/**
 * True when a step is an open policy whose own analysis cannot settle what it
 * does: the plan cannot write it at all, or something in it could not be read.
 * Everything that would otherwise fill the gap — a ring plan, a batch, a
 * dependency it can skip, a word about the strength it requires — takes the
 * conservative branch or says nothing at all.
 */
export function analysisUnknown(step: Step): boolean {
  const effects = effectsOf(step)
  if (effects === null) return false
  return effects.length === 0 || effects.some((e) => e.unknown.length > 0)
}

export function familyReading(step: Step): Step['readiness']['family'] | null {
  return isOpenPolicy(step) ? null : step.readiness.family
}

export function canDenyAccess(step: Step): boolean {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'check') return false
  const effects = effectsOf(step)
  if (effects !== null) return effects.some((e) => e.any)
  return familyReading(step) !== 'other'
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
  const family = familyReading(step)
  return canDenyAccess(step) && family !== 'block' && family !== 'location'
}

/**
 * What a strength allows, matched against what the account can actually do.
 * Each part of a combination is a method the registration report either holds
 * or does not; a part nothing in the report speaks to leaves the combination
 * unknown rather than assumed either way. A strength is satisfied when any one
 * of its combinations is, and refused only when every one of them is refused.
 */
const COMBINATION_PARTS: Record<string, (m: ReadonlySet<string>) => boolean> = {
  password: () => true,
  fido2: (m) => m.has('fido2securitykey') || [...m].some((x) => x.startsWith('passkeydevicebound')),
  windowshelloforbusiness: (m) => m.has('windowshelloforbusiness'),
  x509certificatemultifactor: (m) => m.has('x509certificate'),
  x509certificatesinglefactor: (m) => m.has('x509certificate'),
  devicebasedpush: (m) => m.has('microsoftauthenticatorpasswordless'),
  microsoftauthenticatorpasswordless: (m) => m.has('microsoftauthenticatorpasswordless'),
  microsoftauthenticatorpush: (m) => m.has('microsoftauthenticatorpush'),
  softwareoath: (m) => m.has('softwareonetimepasscode'),
  hardwareoath: (m) => m.has('hardwareonetimepasscode'),
  sms: (m) => m.has('mobilephone') || m.has('alternatemobilephone'),
  voice: (m) => m.has('mobilephone') || m.has('officephone') || m.has('alternatemobilephone'),
  temporaryaccesspassonetime: (m) => m.has('temporaryaccesspass'),
  temporaryaccesspassmultiuse: (m) => m.has('temporaryaccesspass'),
  email: (m) => m.has('email'),
}

type Answer = 'yes' | 'no' | 'unknown'

/** Whether the account's registered methods satisfy one of the strength's allowed combinations. */
export function strengthSatisfaction(combinations: readonly string[], methodsRegistered: readonly string[]): Answer {
  if (combinations.length === 0) return 'unknown'
  const methods = new Set(methodsRegistered.map((m) => m.toLowerCase()))
  let unsure = false
  for (const combination of combinations) {
    const parts = combination.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0)
    if (parts.length === 0) continue
    let all = true
    let partUnsure = false
    for (const part of parts) {
      const test = COMBINATION_PARTS[part]
      if (test === undefined) partUnsure = true
      else if (!test(methods)) all = false
    }
    if (all && !partUnsure) return 'yes'
    if (all && partUnsure) unsure = true
  }
  return unsure ? 'unknown' : 'no'
}

/** An applicability answer with the words for it. */
type Reached = { answer: Applicability; reason: string }

/**
 * The countries the records show one account signing in from. A place condition
 * is about where somebody signs in, and `usageLocation` is a licensing attribute
 * somebody typed into the directory: it is not evidence of a sign-in and is
 * never read as one. Null where the records hold nothing for the account.
 */
export function signInCountries(accountId: string, snapshot: TenantSnapshot): string[] | null {
  if (snapshot.sources?.signInEvidence?.status !== 'ok' && snapshot.sources?.signInEvidence?.status !== 'partial') return null
  const row = (snapshot.signInEvidence ?? {})[accountId]
  const countries = row?.countries ?? null
  return countries === null || countries.length === 0 ? null : countries.map((c) => c.toUpperCase())
}

/** The place a policy names, matched to the countries the plan resolved it to. */
function locationReach(ids: { include: string[]; exclude: string[] }, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext): Reached {
  const unresolved = { answer: 'unknown' as const, reason: 'the place this policy names has not been matched to the countries it holds' }
  const resolved = ctx.countryLocations ?? {}
  const countriesOf = (id: string): readonly string[] | null => resolved[id] ?? resolved[id.toLowerCase()] ?? null
  const includesAll = ids.include.some((x) => x.toLowerCase() === 'all')
  const named = [...ids.include.filter((x) => x.toLowerCase() !== 'all'), ...ids.exclude]
  // Any keyword other than "every location" stands for a set of places the plan
  // has not resolved, and so cannot be judged.
  if (named.some((x) => x.toLowerCase() === 'all' || x.toLowerCase() === 'alltrusted')) return unresolved
  if (named.some((x) => countriesOf(x) === null)) return unresolved
  const here = signInCountries(accountId, snapshot)
  if (here === null) return { answer: 'unknown', reason: 'the records hold no sign-in country for this account' }
  // One sign-in at a time: a place condition is about where a sign-in came from,
  // so the policy reaches the account if any country it signed in from is one the
  // condition includes and none of the ones it excludes. An account that works
  // from two countries is reached on the sign-ins from the one that is in scope.
  const holds = (id: string, country: string): boolean => (countriesOf(id) ?? []).some((c) => c.toUpperCase() === country)
  const reached = here.filter((country) => {
    if (ids.exclude.some((id) => holds(id, country))) return false
    return includesAll || ids.include.length === 0 || ids.include.some((id) => holds(id, country))
  })
  return reached.length > 0
    ? { answer: 'in', reason: `the account signs in from a country (${reached.join(', ')}) the step blocks` }
    : { answer: 'out', reason: 'the account signs in only from countries this policy leaves alone' }
}

/**
 * Whether one condition that narrows *when* a policy applies lets it reach this
 * account. The scan answers four of them exactly — the old protocols, the
 * device-code and authentication-transfer flows, a risk level, and a place it
 * has resolved. It answers none of the others, and says so rather than reading
 * the policy as though the condition were not there.
 */
function narrowingReach(n: Narrowing, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext): Reached {
  const usage = snapshot.evidenceUsage
  const seenIn = (signals: { userIds: string[] }[]): Reached =>
    signals.some((sig) => sig.userIds.includes(accountId))
      ? { answer: 'in', reason: 'the account was seen using what the step blocks' }
      : { answer: 'out', reason: 'no observed use of what the step blocks' }
  switch (n.kind) {
    case 'legacyClients':
      return usage ? seenIn([usage.legacyAuth]) : { answer: 'unknown', reason: 'no sign-in evidence' }
    case 'signInFlow': {
      if (!usage) return { answer: 'unknown', reason: 'no sign-in evidence' }
      const wanted = n.methods.map((m) => m.toLowerCase())
      const signals = [
        ...(wanted.includes('devicecodeflow') ? [usage.deviceCode] : []),
        ...(wanted.includes('authenticationtransfer') ? [usage.authTransfer] : []),
      ]
      return signals.length > 0 ? seenIn(signals) : { answer: 'unknown', reason: 'a sign-in flow the scan does not measure' }
    }
    case 'signInRisk': {
      if (!usage) return { answer: 'unknown', reason: 'no sign-in evidence' }
      const levels = n.levels.map((l) => l.toLowerCase())
      const signals = [...(levels.includes('high') ? [usage.riskHigh] : []), ...(levels.includes('medium') ? [usage.riskMedium] : [])]
      // Being seen at a level the records do measure settles it. Not being seen
      // does not, while the policy also acts on a level they do not measure: a
      // policy on high *and* low is not answered by the high sign-ins alone.
      if (signals.some((sig) => sig.userIds.includes(accountId))) return { answer: 'in', reason: 'the account was seen signing in at the risk level this policy acts on' }
      if (levels.some((l) => !MEASURED_RISK_LEVELS.has(l))) return { answer: 'unknown', reason: 'the policy acts on a risk level the records do not measure' }
      if (signals.length === 0) return { answer: 'unknown', reason: 'a risk level the scan does not measure' }
      return { answer: 'out', reason: 'no sign-in at the risk level this policy acts on' }
    }
    case 'userRisk':
      // The records hold the risk of a sign-in. The risk carried by an account
      // is Identity Protection's own running judgement, and answering it with
      // sign-in risk would judge a person by a different measure than the policy.
      return { answer: 'unknown', reason: 'the scan measures the risk of a sign-in, not the risk this policy acts on: the risk carried by the account' }
    case 'locations':
      return locationReach({ include: n.include, exclude: n.exclude }, accountId, snapshot, ctx)
    case 'clientAppTypes':
      return { answer: 'unknown', reason: 'the scan does not say which kind of client this account signs in with' }
    case 'platforms':
      return { answer: 'unknown', reason: 'the scan does not say which platforms this account signs in from' }
    case 'applications':
      // A policy that names no resource applies to no sign-in, so it reaches
      // nobody — an answer, not a gap. Anything else depends on where a person
      // goes, and the scan does not follow them.
      if (n.none) return { answer: 'out', reason: 'the policy names no application, so it applies to no sign-in' }
      return { answer: 'unknown', reason: 'the scan does not say which applications this account signs in to' }
    case 'userActions':
      return { answer: 'unknown', reason: 'the scan does not say when this account will register security information or a device' }
    case 'authContext':
      return { answer: 'unknown', reason: 'the scan does not say when this account signs in to something that asks for this authentication context' }
    case 'workloadRisk':
      return { answer: 'unknown', reason: 'the policy applies at a workload identity risk level, which is not about this account' }
    case 'deviceFilter':
      return { answer: 'unknown', reason: 'the policy narrows by a device rule the scan cannot evaluate' }
  }
}

/**
 * Whether a policy reaches one account at all: who it names, and then every
 * condition that decides when it applies. One `out` settles it; one condition
 * nothing answers leaves the whole question unknown.
 */
export function operationReach(effect: PolicyEffect, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext = {}): Reached {
  const subject = accountApplicability(effect.scope, accountId, snapshot as never, ctx)
  if (subject === 'out') return { answer: 'out', reason: 'the policy does not reach this account: it is out of scope' }
  let unsure: Reached | null = subject === 'unknown' ? { answer: 'unknown', reason: 'nothing in the scan settles whether this policy reaches the account' } : null
  let why: Reached | null = null
  for (const n of effect.narrowings) {
    const reached = narrowingReach(n, accountId, snapshot, ctx)
    if (reached.answer === 'out') return reached
    if (reached.answer === 'unknown') unsure = unsure ?? reached
    else why = why ?? reached
  }
  return unsure ?? why ?? { answer: 'in', reason: 'the policy reaches this account' }
}

/**
 * Whether two steps' own policies can reach the same people, from the policies'
 * own scopes. `true` wherever either side cannot be settled: the rule this
 * answers protects people from being prompted twice in a week, so an unknown
 * overlap is treated as an overlap rather than waved through.
 *
 * The step's list of people is not the policy's scope and is never read here.
 */
export function policiesOverlap(a: Step, b: Step): boolean {
  const ea = effectsOf(a)
  const eb = effectsOf(b)
  // A step with no policy of its own is bounded by the people it lists, and two
  // of them share the list they were built from.
  if (ea === null || eb === null) return true
  if (analysisUnknown(a) || analysisUnknown(b)) return true
  const reach = (effects: PolicyEffect[]): { all: boolean; ids: Set<string> } => {
    const ids = new Set<string>()
    let all = false
    for (const e of effects) {
      if (e.scope.allUsers || e.scope.guests.include !== null) all = true
      for (const x of [...e.scope.users.include, ...e.scope.groups.include, ...e.scope.roles.include]) ids.add(x.toLowerCase())
    }
    return { all, ids }
  }
  const ra = reach(ea)
  const rb = reach(eb)
  if (ra.all || rb.all) return true
  return [...ra.ids].some((x) => rb.ids.has(x))
}

/**
 * Who the records show a step's own policies touching, person by person, from
 * each policy's own conditions and the evidence those conditions are about.
 * Null — not empty — wherever the answer is not known: a policy IAMAI cannot
 * read in full, a scope nothing settles, a circumstance the records do not
 * measure. A zero has to be proved, and it is proved here or nowhere.
 *
 * This is the one answer behind zero impact, the courtesy notice, the zero batch
 * class and the short soak. None of them reads evidence filed under the goal:
 * evidence collected for one question is not an answer to another, and a policy
 * on the risk carried by an account is not answered by the risky sign-ins.
 */
export function measuredReach(
  effects: readonly PolicyEffect[],
  people: readonly string[],
  snapshot: TenantSnapshot,
  ctx: StrandContext = {},
): string[] | null {
  if (effects.length === 0) return null
  if (effects.some((e) => e.unknown.length > 0)) return null
  const touched: string[] = []
  for (const id of people) {
    let reached = false
    for (const effect of effects) {
      const answer = operationReach(effect, id, snapshot, ctx).answer
      if (answer === 'unknown') return null
      if (answer === 'in') reached = true
    }
    if (reached) touched.push(id)
  }
  return touched
}

/**
 * Whether one account can satisfy one requirement, from what the scan holds.
 * Each kind of requirement is kept distinct: a compliant device is not a
 * domain-joined one, an approved app is not a protected one, and neither is a
 * method. Where the scan cannot answer — a strength this tenant does not
 * describe, an app requirement no evidence covers, a token-protection
 * requirement nothing says the client supports — the answer is `unknown`.
 */
function requirementVerdict(req: Requirement, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext): StrandVerdict {
  switch (req.kind) {
    case 'mfa':
      return accountVerdict('mfa', accountId, snapshot, ctx.allowedCountries ?? [])
    case 'strength': {
      const lookup = ctx.strengths ?? strengthLookupOf(snapshot as never)
      const combinations = lookup.get(req.id.toLowerCase()) ?? []
      if (combinations.length === 0) return { stranded: false, unknown: true, reason: 'this tenant does not describe the strength the policy requires' }
      if (snapshot.sources?.registrationDetails?.status !== 'ok') return { stranded: false, unknown: true, reason: 'registration data was not readable' }
      const methods = (snapshot.registrationDetails ?? []).find((r) => r.id === accountId)?.methodsRegistered ?? []
      const answer = strengthSatisfaction(combinations, methods)
      if (answer === 'yes') return { stranded: false, unknown: false, reason: 'the account holds a method the strength allows' }
      if (answer === 'no') return { stranded: true, unknown: false, reason: 'the account holds no method this strength allows' }
      return { stranded: false, unknown: true, reason: 'the strength allows a method the scan cannot speak to' }
    }
    case 'device': {
      if (snapshot.sources?.devices?.status !== 'ok') return { stranded: false, unknown: true, reason: 'device data was not readable' }
      const owned = (snapshot.devices ?? []).filter((d) => d.ownerIds.includes(accountId))
      const ok = req.control === 'compliantdevice' ? owned.some((d) => d.isCompliant === true) : owned.some((d) => d.trustType === 'ServerAd')
      const what = req.control === 'compliantdevice' ? 'compliant device' : 'domain-joined device'
      return ok
        ? { stranded: false, unknown: false, reason: `the account owns a ${what}` }
        : { stranded: true, unknown: false, reason: `the account owns no ${what}` }
    }
    case 'app':
      return { stranded: false, unknown: true, reason: 'the scan does not say which apps this account signs in with' }
    case 'tokenProtection':
      return { stranded: false, unknown: true, reason: 'nothing in the scan says this account signs in from a client that can bind its token' }
    case 'passwordChange':
      // Changing a password in Entra is not something every account can do: a
      // synchronised account without writeback, or one with no way to
      // reauthenticate, cannot. The scan holds nothing that settles it.
      return { stranded: false, unknown: true, reason: 'nothing in the scan says this account can change its own password' }
    case 'other':
      return { stranded: false, unknown: true, reason: `the scan cannot say whether this account satisfies ${req.control}` }
  }
}

/**
 * Whether one account is stranded by one policy, read from the policy itself.
 * The policy's own scope decides whether it reaches the account at all; a block
 * is judged by what people were seen doing, or by the place it names; a policy
 * that asks for things is judged requirement by requirement, combined the way
 * the policy combines them: all of them for AND, any one of them for OR. Where
 * the policy says something IAMAI cannot decode, the answer is `unknown`, and
 * under OR an unreadable alternative withdraws a stranded verdict too, because
 * it may be the way through.
 */
export function policyVerdict(effect: PolicyEffect, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext = {}): StrandVerdict {
  const reached = operationReach(effect, accountId, snapshot, ctx)
  if (reached.answer === 'out') return { stranded: false, unknown: false, reason: reached.reason }
  if (reached.answer === 'unknown') return { stranded: false, unknown: true, reason: reached.reason }
  const decided = ((): StrandVerdict => {
    // It reaches the account, and it stops the sign-in. The reason is whichever
    // condition put the account inside it.
    if (effect.blocks) return { stranded: true, unknown: false, reason: reached.reason }
    const verdicts = effect.requirements.map((r) => requirementVerdict(r, accountId, snapshot, ctx))
    // A policy that only narrows where or when people sign in, or only shortens
    // a session, asks for nothing a person could fail to have.
    if (verdicts.length === 0) return { stranded: false, unknown: false, reason: 'no deny condition' }
    if (effect.operator === 'AND') return verdicts.find((v) => v.stranded) ?? verdicts.find((v) => v.unknown) ?? verdicts[0]
    return verdicts.find((v) => !v.stranded && !v.unknown) ?? verdicts.find((v) => v.unknown) ?? verdicts[0]
  })()
  if (effect.unknown.length === 0) return decided
  // Something in the policy could not be decoded. The decided answer stands only
  // where decoding it could not help: a block is a block, and under AND a
  // requirement already failed. Under OR the unreadable part may be the way
  // through, so a stranded verdict is withdrawn rather than asserted.
  const unreadable = { stranded: false, unknown: true, reason: effect.unknown[0] }
  if (decided.stranded && (effect.blocks || effect.operator === 'AND')) return decided
  return unreadable
}

/**
 * Whether one account is stranded by what the step will actually leave behind.
 * A step with several policies is stranded by any of them; where one cannot be
 * decoded the answer is unknown, and a step the plan cannot write at all is
 * unknown too — never a guess from the goal's family or the people it lists.
 */
export function stepAccountVerdict(step: Step, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext = {}): StrandVerdict {
  const effects = effectsOf(step)
  // A step with no policy of its own — one already in place, the enforce step —
  // is read by its goal's family, as it always was.
  if (effects === null) return accountVerdict(familyReading(step) ?? 'other', accountId, snapshot, ctx.allowedCountries ?? [])
  if (effects.length === 0) return { stranded: false, unknown: true, reason: 'the plan cannot write this policy, so what it would do to the account is unknown' }
  const reach = stepApplicability(step, accountId, snapshot, ctx)
  if (reach === 'out') return { stranded: false, unknown: false, reason: 'no policy this step writes reaches the account: it is out of scope' }
  let unknown: StrandVerdict | null = null
  for (const effect of effects) {
    const verdict = policyVerdict(effect, accountId, snapshot, ctx)
    if (verdict.stranded) return verdict
    if (verdict.unknown) unknown = unknown ?? verdict
  }
  return unknown ?? { stranded: false, unknown: false, reason: 'no deny condition' }
}

/**
 * Whether any policy the step writes reaches one account. A step with no policy
 * of its own is bounded by the people it lists; a step the plan cannot write
 * reaches nobody knowably.
 */
export function stepApplicability(step: Step, accountId: string, snapshot: TenantSnapshot, ctx: StrandContext = {}): Applicability {
  const effects = effectsOf(step)
  if (effects === null) return step.population.ids.includes(accountId) ? 'in' : 'out'
  if (effects.length === 0) return 'unknown'
  const answers = effects.map((e) => operationReach(e, accountId, snapshot, ctx).answer)
  if (answers.includes('in')) return 'in'
  return answers.includes('unknown') ? 'unknown' : 'out'
}

export function wouldStrand(step: Step, accountId: string, snapshot: TenantSnapshot, opts: { breakGlass: boolean } & StrandContext): StrandVerdict {
  if (!canDenyAccess(step)) return { stranded: false, unknown: false, reason: 'the step cannot deny access' }
  // Who the policy reaches is the policy's own business (policyVerdict); the
  // step's list of people only bounds a step with no policy of its own.
  const reach = stepApplicability(step, accountId, snapshot, opts)
  if (reach === 'out') return { stranded: false, unknown: false, reason: 'the account is out of scope' }
  if (opts.breakGlass) {
    // The emergency accounts must never be inside a step that can shut them out.
    // Whether a policy reaches one is the policy's own answer and nobody else's:
    // the step's list of people is not the policy's scope, and a scope the scan
    // cannot settle is unknown rather than a strand asserted on the list's
    // behalf. Unknown is not safe either, so nothing downstream reads it as one.
    if (reach === 'in') return { stranded: true, unknown: false, reason: 'a break-glass account is in scope of a step that can deny access' }
    return { stranded: false, unknown: true, reason: 'nothing in the scan settles whether this policy reaches the emergency account' }
  }
  return stepAccountVerdict(step, accountId, snapshot, opts)
}

/**
 * The account's own ability to satisfy a control family, from what the scan
 * holds. This serves steps with no policy of their own — one already in place,
 * the enforce step. A policy the plan can write is never read this way: its own
 * requirements are (requirementVerdict).
 */
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
      // Where somebody signs in from is the records' answer, never the licensing
      // country typed into the directory (signInCountries).
      const here = signInCountries(accountId, snapshot)
      if (here === null) return { stranded: false, unknown: true, reason: 'the records hold no sign-in country for this account' }
      const allowed = allowedCountries.map((c) => c.toUpperCase())
      const outside = here.filter((c) => !allowed.includes(c))
      return outside.length === 0
        ? { stranded: false, unknown: false, reason: 'the account signs in from allowed countries' }
        : { stranded: true, unknown: false, reason: `the account signs in from a country (${outside.join(', ')}) the step blocks` }
    }
    default:
      return { stranded: false, unknown: false, reason: 'no deny condition' }
  }
}
