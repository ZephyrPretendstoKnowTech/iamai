import { methodAvailability } from './methodAvailability.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'

/** The readiness words (shared.engine.readiness). */
const W = engine.readiness
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Readiness } from './types.ts'
import { accountApplicability, tenantStrengthsOf, BUILT_IN_STRENGTHS, BUILT_IN_MFA_STRENGTH } from './operations.ts'
import type { PolicyEffect, Requirement, ScopeEvidence } from './operations.ts'
import { strengthSatisfaction } from './strand.ts'
import { readinessPercent } from './readiness.ts'

type Answer = 'yes' | 'no' | 'unknown'
/**
 * One person against one policy's method requirements; `stale` as
 * MethodPreparation.staleIds, `off` (on a 'no') as MethodPreparation.offIds:
 * the policy would accept the methods they registered if the tenant's
 * Authentication methods policy let them use them.
 */
type Judged = { answer: Answer; stale: boolean; off: boolean }
/** The single-method strength combination a sign-in's method class satisfies on its own. */
const PROOF_COMBINATION: Record<string, string> = { passkey: 'fido2', windowsHello: 'windowshelloforbusiness', certificate: 'x509certificatemultifactor' }
export type MethodPreparation = {
  ids: string[]
  readyIds: string[]
  unknownIds: string[]
  /**
   * People counted unready ONLY because the sign-in that confirmed their method
   * has aged out of the 30-day proof window.
   *
   * A reader watched admin readiness fall 5 -> 4 -> 0 of 60 over thirty days on
   * a tenant where fourteen admins held a phishing-resistant method the whole
   * time, with the screen saying "0 of 60 people have a registered method the
   * policies allow" and nothing saying why it had moved. A number that goes
   * down on its own, on a gate that has to reach 100%, reads as the tenant
   * getting worse. What the scan can say is the age of the sign-in; it cannot
   * say nothing else about them changed — there is no registration history, and
   * a person whose recent sign-ins used another method is still counted here.
   *
   * ONLY: the same sign-in, made today, would count them. The line tells the
   * admin to ask these people to sign in once, and it said so of people whose
   * old sign-in could never settle the policy — a text-message sign-in against
   * a strength only a passkey sign-in settles — so the admin was promised a
   * number that would not move (R4-15).
   */
  staleIds?: string[]
  /**
   * People counted not ready who registered methods, every one of which this
   * tenant's Authentication methods policy does not let them use
   * (methodAvailability.ts `refused`).
   *
   * The engine told them from people who registered nothing, and dropped the
   * difference before the line. On a 4,900-person tenant 669 people held a
   * phone and nothing else, with text and voice switched off, and the gate read
   * "4231 of 4900 people have a registered method the policies allow": the
   * reader knew Require MFA accepts a phone and took the number for a
   * measurement error (R4-41). On another, 38 people whose only method was text
   * were called unknowable (R4-15). What refuses them is not the policy the step
   * creates, and they need a method the tenant allows, not a first one.
   *
   * ONLY: every policy of the step that refused them would accept the methods
   * they registered, if the methods policy let them use them, and no policy of
   * the step left them unjudged — they would be counted. Refused by the methods
   * policy is not the same as stopped by it. On a phishing-resistant admin step
   * with text and voice off, five administrators who held only a phone were
   * named as held back by the methods policy, and the one thing that reading
   * invites — switching text back on for administrators — weakens the tenant
   * and moves nobody: the strength refuses a phone either way. The line says
   * the counterfactual (methodLineOff), so its count is exactly these people.
   */
  offIds?: string[]
  completeScope: boolean
}

/** A readiness cohort includes an eligible administrator's activation path,
 * without claiming that the eligible role is currently active in Impact. */
function applies(effect: PolicyEffect, id: string, snapshot: TenantSnapshot, context: ScopeEvidence): 'in' | 'out' | 'unknown' {
  const current = accountApplicability(effect.scope, id, snapshot, context)
  if (!effect.scope.roles.include.length && !effect.scope.roles.exclude.length) return current
  const answers = [current]
  for (const role of snapshot.roles.eligible?.[id] ?? []) {
    const roles = { active: { ...snapshot.roles.active, [id]: [...(snapshot.roles.active[id] ?? []), role] } }
    answers.push(accountApplicability(effect.scope, id, { users: snapshot.users, roles }, context))
  }
  return answers.includes('in') ? 'in' : answers.includes('unknown') ? 'unknown' : 'out'
}

/** Cache belongs to a single immutable scan derivation, never a saved plan. */
export function createMethodPreparationCache(snapshot: TenantSnapshot, context: ScopeEvidence = {}) {
  const indexedContext: ScopeEvidence = { ...context, groupMemberSets: Object.fromEntries(Object.entries(context.groupMembers ?? {}).map(([id, members]) => [id, new Set(members.map(member => member.toLowerCase()))])) }
  return { snapshot, indexedContext, availability: methodAvailability(snapshot, indexedContext),
    combinations: new Map<string, Map<string, ReturnType<typeof strengthSatisfaction>>>(),
    combinationSets: new WeakMap<string[], Map<string, ReturnType<typeof strengthSatisfaction>>>(),
    unrestrictedStrengths: new Map<string, Map<string, Answer>>(),
    // A person's answer for one method requirement, with whether it is unknown
    // only because their proof aged out, or no only because the methods policy
    // refuses what they registered: all belong to the answer, so a step that
    // reads it from the cache reads all of them (R4-15, R4-41).
    scopeAnswers: new Map<string, Map<string, 'in' | 'out' | 'unknown'>>(), methodAnswers: new Map<string, Map<string, Judged>>(),
    methods: new Map<string, { usableMethods: string[]; possibleMethods: string[]; refused: boolean; signature: string }>(),
    strengths: tenantStrengthsOf(snapshot), registrations: new Map(snapshot.registrationDetails.map(r => [r.id, r])), users: new Map(snapshot.users.map(u => [u.id, u])) }
}
type PreparationCache = ReturnType<typeof createMethodPreparationCache>

/** Registration suitability for the actual target policies. This is separate
 * from proving a sign-in, enrollment, or recovery workflow succeeded. */
export function methodPreparation(effects: readonly PolicyEffect[], candidates: readonly string[], snapshot: TenantSnapshot, context: ScopeEvidence = {}, cached?: PreparationCache): MethodPreparation {
  const cache = cached?.snapshot === snapshot ? cached : createMethodPreparationCache(snapshot, context)
  const { indexedContext, availability, combinations, strengths, registrations, users } = cache
  const combinationAnswer = (combination: string, methods: string[]) => {
    // A person's method arrays are immutable for this derivation. Resolve the
    // shared method-set cache once, rather than serializing it per combination.
    let answers = cache.combinationSets.get(methods)
    if (!answers) {
      const key = JSON.stringify(methods)
      answers = combinations.get(key)
      if (!answers) { answers = new Map(); combinations.set(key, answers) }
      cache.combinationSets.set(methods, answers)
    }
    let answer = answers.get(combination)
    if (answer === undefined) { answer = strengthSatisfaction([combination], methods); answers.set(combination, answer) }
    return answer
  }
  const targets = effects.filter(e => !e.blocks && e.asksForMethod)
  const scopedTargets = targets.map(effect => {
    const scopeKey = JSON.stringify(effect.scope)
    const methodKey = JSON.stringify([effect.operator, effect.requirements, effect.unknown])
    if (!cache.scopeAnswers.has(scopeKey)) cache.scopeAnswers.set(scopeKey, new Map())
    if (!cache.methodAnswers.has(methodKey)) cache.methodAnswers.set(methodKey, new Map())
    return { effect, scopes: cache.scopeAnswers.get(scopeKey)!, methods: cache.methodAnswers.get(methodKey)! }
  })
  // A passkey sign-in settles nothing once the passkey method is off or excludes everyone.
  const fido2 = ((snapshot.config.authMethodsPolicy?.rows?.[0] as { authenticationMethodConfigurations?: { id?: string; state?: string; excludeTargets?: { id?: string }[] }[] } | undefined)?.authenticationMethodConfigurations ?? []).find(c => String(c.id).toLowerCase() === 'fido2')
  const fido2Open = fido2?.state === 'enabled' && !(fido2.excludeTargets ?? []).some(t => String(t.id).toLowerCase() === 'all_users')
  // The method classes each person was seen succeeding with in the last 30 days.
  const since = new Date(Date.parse(snapshot.asOf) - 30 * 86_400_000).toISOString()
  const provenCache = new Map<string, Set<string>>()
  // The same classes with no window at all, to tell "never confirmed" from
  // "confirmed, and the confirmation is older than the window".
  const everCache = new Map<string, Set<string>>()
  const everClasses = (id: string): Set<string> => {
    let got = everCache.get(id)
    if (!got) {
      got = new Set((snapshot.signInEvidence?.[id]?.proofs ?? []).map(p => p.cls))
      everCache.set(id, got)
    }
    return got
  }
  const provenClasses = (id: string): Set<string> => {
    let got = provenCache.get(id)
    if (!got) {
      got = new Set((snapshot.signInEvidence?.[id]?.proofs ?? []).filter(p => p.at >= since).map(p => p.cls))
      provenCache.set(id, got)
    }
    return got
  }
  const result: MethodPreparation = { ids: [], readyIds: [], unknownIds: [], staleIds: [], offIds: [], completeScope: effects.length > 0 && snapshot.sources?.users?.status === 'ok' }
  /**
   * Whether a successful sign-in with one of these method classes settles a
   * requirement registration left unknown. One rule, read twice: for the
   * sign-ins inside the proof window, which count, and for every sign-in ever
   * recorded, which says whether a person is unknown only because theirs aged out.
   */
  const settles = (requirement: Requirement, classes: ReadonlySet<string>): boolean => {
    if (classes.size === 0) return false
    if (requirement.kind === 'mfa') return true
    if (requirement.kind !== 'strength') return false
    // Only an unrestricted strength: a sign-in does not show which key model
    // it used, so model restrictions stay the registration reading's to judge.
    const strength = strengths.get(requirement.id.toLowerCase())
    if (!strength || !Array.isArray(strength.combinationConfigurations) || strength.combinationConfigurations.length > 0) return false
    const combos = (strength.allowedCombinations ?? []).map(c => c.toLowerCase().split(','))
    return combos.some(parts => parts.length === 1 && [...classes].some(cls => PROOF_COMBINATION[cls] === parts[0] && (cls !== 'passkey' || fido2Open)))
  }
  /** One policy's answer from its requirements' answers. */
  const combine = (effect: PolicyEffect, answers: readonly Answer[]): Answer => {
    // AND's device/app tests belong to their own readiness checks. For OR a
    // suitable method is sufficient; an unmeasured alternative is not failure.
    if (effect.operator === 'OR') return answers.includes('yes') ? 'yes' : answers.includes('unknown') ? 'unknown' : 'no'
    const methods = effect.requirements.map((r, i) => ({ r, answer: answers[i] })).filter(x => x.r.kind === 'mfa' || x.r.kind === 'strength').map(x => x.answer)
    return methods.includes('no') ? 'no' : methods.includes('unknown') ? 'unknown' : 'yes'
  }
  /** What one person registered, read against the tenant's method settings once per scan. */
  const methodsOf = (id: string, row: TenantSnapshot['registrationDetails'][number]) => {
    let registrationMethods = cache.methods.get(id)
    if (!registrationMethods) {
      const states = row.methodsRegistered.map(method => ({ method, usable: availability.usable(id, method) }))
      const usableMethods = states.filter(m => m.usable === 'yes').map(m => m.method)
      const possibleMethods = states.filter(m => m.usable !== 'no').map(m => m.method)
      // Registered something, and the methods policy stops every one of them.
      const refused = states.length > 0 && states.every(m => m.usable === 'no' && availability.refused(id, m.method))
      registrationMethods = { usableMethods, possibleMethods, refused, signature: JSON.stringify([usableMethods, possibleMethods]) }
      cache.methods.set(id, registrationMethods)
    }
    return registrationMethods
  }
  // The registrations Require MFA accepts: Microsoft's built-in Multifactor authentication strength.
  const mfaCombinations = BUILT_IN_STRENGTHS.get(BUILT_IN_MFA_STRENGTH)!
  /**
   * One policy's method requirements against what one person registered.
   * `methods` is what the tenant lets them use (usable) and might (possible).
   * `ifAllowed` asks the other question: what the policy would answer if the
   * tenant's Authentication methods policy let them use every method they
   * registered — so a refusal is put down to the methods policy only where it
   * is the refusal that stands between the person and the step (offIds).
   */
  const judge = (effect: PolicyEffect, id: string, row: TenantSnapshot['registrationDetails'][number], methods: { usableMethods: string[]; possibleMethods: string[]; signature: string }, ifAllowed: boolean): Answer[] => {
    const { usableMethods, possibleMethods } = methods
    // The registration report's own reading is made under the methods policy;
    // with that policy set aside, the methods themselves say it.
    const mfaCapable = ifAllowed ? strengthSatisfaction(mfaCombinations, row.methodsRegistered) === 'yes' : row.isMfaCapable
    return effect.requirements.map((requirement): Answer => {
      if (requirement.kind === 'mfa') return !mfaCapable || !row.methodsRegistered.length ? 'no' : usableMethods.length ? 'yes' : possibleMethods.length ? 'unknown' : 'no'
      if (requirement.kind !== 'strength') return 'unknown'
      const strength = strengths.get(requirement.id.toLowerCase())
      if (!strength) return 'unknown'
      if (Array.isArray(strength.combinationConfigurations) && strength.combinationConfigurations.length === 0) {
        // Without key/model restrictions this answer depends only on the usable
        // method sets and the strength, not on which account registered them.
        let shared = cache.unrestrictedStrengths.get(requirement.id.toLowerCase())
        if (!shared) { shared = new Map(); cache.unrestrictedStrengths.set(requirement.id.toLowerCase(), shared) }
        const signature = methods.signature
        let answer = shared.get(signature)
        if (answer === undefined) {
          const usable = strength.allowedCombinations.length ? strengthSatisfaction(strength.allowedCombinations, usableMethods) : 'no'
          answer = usable !== 'no' ? usable : strength.allowedCombinations.length && strengthSatisfaction(strength.allowedCombinations, possibleMethods) !== 'no' ? 'unknown' : 'no'
          shared.set(signature, answer)
        }
        return answer
      }
      let unknown = false
      for (const combination of strength.allowedCombinations) {
        const answer = combinationAnswer(combination, usableMethods)
        if (answer === 'no') { if (combinationAnswer(combination, possibleMethods) !== 'no') unknown = true; continue }
        if (answer === 'unknown' || strength.combinationConfigurations === null) { unknown = true; continue }
        const configs = strength.combinationConfigurations as Record<string, unknown>[]
        if (configs.some(c => !Array.isArray(c.appliesToCombinations) && typeof c.appliesToCombinations !== 'string')) { unknown = true; continue }
        const matching = configs.filter(c => (Array.isArray(c.appliesToCombinations) ? c.appliesToCombinations : [c.appliesToCombinations]).some(value => String(value).toLowerCase() === combination.toLowerCase()))
        if (matching.length === 0) return 'yes'
        // A registered FIDO2 method alone cannot prove a model restriction.
        // Compare the collected key's AAGUID where the strength supplies it.
        const keys = snapshot.authMethods?.[id]
        const checks = matching.map(c => {
          if (!String(c['@odata.type'] ?? '').toLowerCase().includes('fido2combinationconfiguration') || !Array.isArray(c.allowedAAGUIDs)) return 'unknown'
          const allowed = c.allowedAAGUIDs.map(v => String(v).toLowerCase())
          if (!Array.isArray(keys)) return 'unknown'
          const fido = keys.filter(k => k.kind === 'fido2' || k.kind === 'passkey')
          // Whether the methods policy lets that key sign in is the question `ifAllowed` sets aside.
          if (fido.some(k => k.aaGuid && allowed.includes(k.aaGuid.toLowerCase()))) return ifAllowed ? 'yes' : availability.passkey(id, allowed)
          return fido.some(k => !k.aaGuid) ? 'unknown' : 'no'
        })
        if (checks.every(a => a === 'yes')) return 'yes'
        if (!checks.includes('no')) unknown = true
      }
      return unknown ? 'unknown' : 'no'
    })
  }
  const registered = (effect: PolicyEffect, id: string): Judged => {
    if (effect.unknown.length > 0) return { answer: 'unknown', stale: false, off: false }
    const row = registrations.get(id)
    if (!row || !['ok', 'partial'].includes(snapshot.sources?.registrationDetails?.status ?? '')) return { answer: 'unknown', stale: false, off: false }
    const registrationMethods = methodsOf(id, row)
    const answers = judge(effect, id, row, registrationMethods, false)
    // The outcome settles what registration could not (prompt 62): a successful
    // sign-in in the last 30 days with a method this requirement accepts shows the
    // method works under the tenant's settings, so an unknown compatibility is not
    // left unknown for somebody seen using it.
    const proven = provenClasses(id)
    for (const [i, requirement] of effect.requirements.entries()) if (answers[i] === 'unknown' && settles(requirement, proven)) answers[i] = 'yes'
    const answer = combine(effect, answers)
    if (answer === 'no') {
      // Refused, every method, by the methods policy; and would this policy
      // take them if it were not? Only then is the methods policy what stopped
      // them. Every method they registered is one it refuses, so "allowed" is
      // all of them.
      if (!registrationMethods.refused) return { answer, stale: false, off: false }
      const all = row.methodsRegistered
      const allowed = judge(effect, id, row, { usableMethods: all, possibleMethods: all, signature: JSON.stringify([all, all]) }, true)
      return { answer, stale: false, off: combine(effect, allowed) === 'yes' }
    }
    if (answer !== 'unknown') return { answer, stale: false, off: false }
    // Whether the SAME settling would have happened on the sign-ins of any age.
    // If it would, this person is not "never confirmed" — the confirmation simply
    // got older than the window, and the readiness number fell without anything
    // in the tenant changing. If it would not, a fresh sign-in with that method
    // settles nothing either, and saying it would is a promise the next scan breaks.
    const ever = everClasses(id)
    const aged = answers.map((a, i): Answer => (a === 'unknown' && settles(effect.requirements[i], ever) ? 'yes' : a))
    return { answer, stale: combine(effect, aged) === 'yes', off: false }
  }
  for (const id of [...new Set(candidates)]) {
    if (users.get(id)?.accountEnabled === false) continue
    // `aged`: every policy that left this person unknown did so only because their proof aged out.
    // `off`: every policy that refused this person would take them if the methods policy let them use what they registered.
    let included = false, failed = false, unknown = false, aged = true, off = true
    for (const target of scopedTargets) {
      let scope = target.scopes.get(id)
      if (scope === undefined) { scope = applies(target.effect, id, snapshot, indexedContext); target.scopes.set(id, scope) }
      if (scope === 'unknown') result.completeScope = false
      if (scope !== 'in') continue
      included = true
      let judged = target.methods.get(id)
      if (judged === undefined) { judged = registered(target.effect, id); target.methods.set(id, judged) }
      if (judged.answer === 'no') { failed = true; if (!judged.off) off = false }
      else if (judged.answer === 'unknown') { unknown = true; if (!judged.stale) aged = false }
    }
    if (!included) continue
    result.ids.push(id)
    if (!failed && !unknown) result.readyIds.push(id)
    else if (!failed) {
      result.unknownIds.push(id)
      if (aged) (result.staleIds ??= []).push(id)
    } else if (off && !unknown) {
      // Not "registered nothing": registered, and held back by the tenant's
      // methods policy alone — a policy that could not judge them leaves that unsaid.
      (result.offIds ??= []).push(id)
    }
  }
  return result
}

export function methodReadiness(family: Readiness['family'], preparation: MethodPreparation): Readiness {
  const { ids, readyIds, unknownIds, completeScope } = preparation
  const staleIds = preparation.staleIds ?? []
  const offIds = preparation.offIds ?? []
  // The people judged without an accepted method the tenant lets them use.
  const short = ids.length - readyIds.length - unknownIds.length
  const unreadable = !completeScope || unknownIds.length > 0
  // The floor, where the people were counted and only their methods could not be
  // judged (types.ts `atLeast`). An incomplete scope has no real denominator, so
  // it has no floor either.
  // And only where somebody was actually judged ready. With the registration
  // source switched off nobody can be, so the floor would be "at least 0%" — true
  // of every tenant, and read as a measurement of the people rather than of what
  // the scan could not see. A floor of zero is not a floor.
  // Rounded down, like the percentage (readiness.ts readinessPercent): 209 of 279
  // is 74.9%, and "at least 75%" was a floor above the reading it floored.
  const atLeast = completeScope && ids.length > 0 && unknownIds.length > 0 && readyIds.length > 0 ? readinessPercent(readyIds.length, ids.length) : undefined
  return { family, percent: unreadable || ids.length === 0 ? null : readinessPercent(readyIds.length, ids.length),
    ...(atLeast !== undefined ? { atLeast } : {}),
    ...(unreadable ? { unmeasured: 'unreadable' as const } : ids.length === 0 ? { unmeasured: 'no-population' as const } : {}),
    // Where NOBODY could be judged, a bare leading zero is an unread count in
    // the shape of a measurement: the same tenant after the permission is
    // granted reads "0 of 2 people have a registered method allowed by the
    // target policies", and a reader had to reach the third clause to learn
    // which kind of zero they were looking at.
    lines: !completeScope
      ? ['The target policy scope must be resolved before method readiness can be measured.']
      // Nobody to count is not a reading: "0 of 0 people in scope of these
      // policies have a registered method" stood on a guest step of a tenant
      // with no guests.
      : ids.length === 0
        ? []
      : readyIds.length === 0 && unknownIds.length === ids.length
        // One person reads as one: "None of the 1 person in scope" was the
        // count-of-one rule applied to a sentence written for many.
        ? [ids.length === 1 ? W.noneJudgedOne : fillText(W.noneJudged, { n: ids.length })]
        // Which people the denominator counts: the ones the target policies
        // apply to, which is neither the step's active count nor its enabled
        // count, and a step can print all three (246, 283, 279 on one card).
        // Then, straight after it, how many of the people it did not count
        // would be counted if the tenant allowed what they registered — the
        // reason the engine has (MethodPreparation.offIds) and the reader could
        // not see — and last, the people it could not judge.
        : [[
          fillText(W.methodLine, { ready: String(readyIds.length), total: String(ids.length) }),
          offIds.length === 0 ? null : fillText(offIds.length === short ? W.methodLineOffAll : W.methodLineOff, { off: String(offIds.length), short: String(short) }),
          staleIds.length > 0 ? fillText(W.methodLineStale, { unknown: String(unknownIds.length), stale: String(staleIds.length) })
            : unknownIds.length > 0 ? fillText(W.methodLineUnknown, { unknown: String(unknownIds.length) }) : null,
        ].filter((x): x is string => x !== null).join(' ')] }
}
