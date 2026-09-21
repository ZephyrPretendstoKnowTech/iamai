import { methodAvailability } from './methodAvailability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Readiness } from './types.ts'
import { accountApplicability, tenantStrengthsOf } from './operations.ts'
import type { PolicyEffect, ScopeEvidence } from './operations.ts'
import { strengthSatisfaction } from './strand.ts'

type Answer = 'yes' | 'no' | 'unknown'
/** The single-method strength combination a sign-in's method class satisfies on its own. */
const PROOF_COMBINATION: Record<string, string> = { passkey: 'fido2', windowsHello: 'windowshelloforbusiness', certificate: 'x509certificatemultifactor' }
export type MethodPreparation = { ids: string[]; readyIds: string[]; unknownIds: string[]; completeScope: boolean }

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
    scopeAnswers: new Map<string, Map<string, 'in' | 'out' | 'unknown'>>(), methodAnswers: new Map<string, Map<string, Answer>>(),
    methods: new Map<string, { usableMethods: string[]; possibleMethods: string[]; signature: string }>(),
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
  const provenClasses = (id: string): Set<string> => {
    let got = provenCache.get(id)
    if (!got) {
      got = new Set((snapshot.signInEvidence?.[id]?.proofs ?? []).filter(p => p.at >= since).map(p => p.cls))
      provenCache.set(id, got)
    }
    return got
  }
  const result: MethodPreparation = { ids: [], readyIds: [], unknownIds: [], completeScope: effects.length > 0 && snapshot.sources?.users?.status === 'ok' }
  const registered = (effect: PolicyEffect, id: string): Answer => {
    if (effect.unknown.length > 0) return 'unknown'
    const row = registrations.get(id)
    if (!row || !['ok', 'partial'].includes(snapshot.sources?.registrationDetails?.status ?? '')) return 'unknown'
    let registrationMethods = cache.methods.get(id)
    if (!registrationMethods) {
      const states = row.methodsRegistered.map(method => ({ method, usable: availability.usable(id, method) }))
      const usableMethods = states.filter(m => m.usable === 'yes').map(m => m.method)
      const possibleMethods = states.filter(m => m.usable !== 'no').map(m => m.method)
      registrationMethods = { usableMethods, possibleMethods, signature: JSON.stringify([usableMethods, possibleMethods]) }
      cache.methods.set(id, registrationMethods)
    }
    const { usableMethods, possibleMethods } = registrationMethods
    const answers = effect.requirements.map((requirement): Answer => {
      if (requirement.kind === 'mfa') return !row.isMfaCapable || !row.methodsRegistered.length ? 'no' : usableMethods.length ? 'yes' : possibleMethods.length ? 'unknown' : 'no'
      if (requirement.kind !== 'strength') return 'unknown'
      const strength = strengths.get(requirement.id.toLowerCase())
      if (!strength) return 'unknown'
      if (Array.isArray(strength.combinationConfigurations) && strength.combinationConfigurations.length === 0) {
        // Without key/model restrictions this answer depends only on the usable
        // method sets and the strength, not on which account registered them.
        let shared = cache.unrestrictedStrengths.get(requirement.id.toLowerCase())
        if (!shared) { shared = new Map(); cache.unrestrictedStrengths.set(requirement.id.toLowerCase(), shared) }
        const signature = registrationMethods!.signature
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
          if (fido.some(k => k.aaGuid && allowed.includes(k.aaGuid.toLowerCase()))) return availability.passkey(id, allowed)
          return fido.some(k => !k.aaGuid) ? 'unknown' : 'no'
        })
        if (checks.every(a => a === 'yes')) return 'yes'
        if (!checks.includes('no')) unknown = true
      }
      return unknown ? 'unknown' : 'no'
    })
    // The outcome settles what registration could not (prompt 62): a successful
    // sign-in in the last 30 days with a method this requirement accepts shows the
    // method works under the tenant's settings, so an unknown compatibility is not
    // left unknown for somebody seen using it.
    const proven = provenClasses(id)
    for (const [i, requirement] of effect.requirements.entries()) {
      if (answers[i] !== 'unknown' || proven.size === 0) continue
      if (requirement.kind === 'mfa') answers[i] = 'yes'
      else if (requirement.kind === 'strength') {
        // Only an unrestricted strength: a sign-in does not show which key model
        // it used, so model restrictions stay the registration reading's to judge.
        const strength = strengths.get(requirement.id.toLowerCase())
        if (!strength || !Array.isArray(strength.combinationConfigurations) || strength.combinationConfigurations.length > 0) continue
        const combos = (strength.allowedCombinations ?? []).map(c => c.toLowerCase().split(','))
        if (combos.some(parts => parts.length === 1 && [...proven].some(cls => PROOF_COMBINATION[cls] === parts[0] && (cls !== 'passkey' || fido2Open)))) answers[i] = 'yes'
      }
    }
    const methods = effect.requirements.map((r, i) => ({ r, answer: answers[i] })).filter(x => x.r.kind === 'mfa' || x.r.kind === 'strength').map(x => x.answer)
    // AND's device/app tests belong to their own readiness checks. For OR a
    // suitable method is sufficient; an unmeasured alternative is not failure.
    if (effect.operator === 'OR') return answers.includes('yes') ? 'yes' : answers.includes('unknown') ? 'unknown' : 'no'
    return methods.includes('no') ? 'no' : methods.includes('unknown') ? 'unknown' : 'yes'
  }
  for (const id of [...new Set(candidates)]) {
    if (users.get(id)?.accountEnabled === false) continue
    let included = false, failed = false, unknown = false
    for (const target of scopedTargets) {
      let scope = target.scopes.get(id)
      if (scope === undefined) { scope = applies(target.effect, id, snapshot, indexedContext); target.scopes.set(id, scope) }
      if (scope === 'unknown') result.completeScope = false
      if (scope !== 'in') continue
      included = true
      let answer = target.methods.get(id)
      if (answer === undefined) { answer = registered(target.effect, id); target.methods.set(id, answer) }
      if (answer === 'no') failed = true
      else if (answer === 'unknown') unknown = true
    }
    if (!included) continue
    result.ids.push(id)
    if (!failed && !unknown) result.readyIds.push(id)
    else if (!failed) result.unknownIds.push(id)
  }
  return result
}

export function methodReadiness(family: Readiness['family'], preparation: MethodPreparation): Readiness {
  const { ids, readyIds, unknownIds, completeScope } = preparation
  const unreadable = !completeScope || unknownIds.length > 0
  // The floor, where the people were counted and only their methods could not be
  // judged (types.ts `atLeast`). An incomplete scope has no real denominator, so
  // it has no floor either.
  const atLeast = completeScope && ids.length > 0 && unknownIds.length > 0 ? Math.round(readyIds.length / ids.length * 100) : undefined
  return { family, percent: unreadable || ids.length === 0 ? null : Math.round(readyIds.length / ids.length * 100),
    ...(atLeast !== undefined ? { atLeast } : {}),
    ...(unreadable ? { unmeasured: 'unreadable' as const } : ids.length === 0 ? { unmeasured: 'no-population' as const } : {}),
    lines: completeScope ? [`${readyIds.length} of ${ids.length} people have a registered method allowed by the target policies.${unknownIds.length > 0 ? ` Method compatibility is not yet established for ${unknownIds.length}.` : ''}`] : ['The target policy scope must be resolved before method readiness can be measured.'] }
}
