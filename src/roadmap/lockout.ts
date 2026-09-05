// The lockout list of a strength policy (E8, and its row count): who in the
// step's scope is not yet at Passkey or security key, proven (derive/ladder.ts
// rung 5), and so is stopped, not prompted, once the policy enforces. One rule
// for the row's who-column ("3 people · 2 not yet at Passkey or security key,
// proven"), the step's Who lines (by name when three or fewer, a count
// otherwise) and the risk policy's first-enforcement rung. The admin steps read
// the ladder: a passkey registered but never used, or Windows Hello on one PC,
// is not the rung the policy needs.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds } from '../roles.ts'
import { rungOf } from '../derive/ladder.ts'
import type { PolicyEffect, ScopeEvidence } from './operations.ts'
import { operationReach, policyVerdict } from './strand.ts'

/** The strength policies, and whose lockout each counts: the admins for the admin policy, the eligible role holders for role activation, everyone with only Authenticator approval for the risk policy. */
export const LOCKOUT_GOALS = new Set(['admins-phishing-resistant', 'pim-activation-reauth', 'sign-in-risk'])

/** Not on the top rung: no passkey or security key proven in the records. */
const belowTop = (v: MfaViability): boolean => rungOf(v) !== 5
const noPhishingResistant = (v: MfaViability): boolean => !v.methodTiers.includes('phishingResistant')

/** The ids the goal's policy would lock out today; empty for a goal that is not a strength policy. */
export function lockoutIds(goalId: string, viability: readonly MfaViability[], snapshot: TenantSnapshot, exclude: ReadonlySet<string> = new Set()): string[] {
  const active = viability.filter((v) => v.activity === 'active' && !exclude.has(v.userId))
  if (goalId === 'admins-phishing-resistant') {
    const admins = adminUserIds(snapshot.roles ?? { active: {} })
    return active.filter((v) => admins.has(v.userId) && belowTop(v)).map((v) => v.userId)
  }
  if (goalId === 'pim-activation-reauth') {
    const byId = new Map(active.map((v) => [v.userId, v]))
    return Object.keys(snapshot.roles?.eligible ?? {}).filter((id) => byId.has(id) && belowTop(byId.get(id)!))
  }
  if (goalId === 'sign-in-risk') return active.filter((v) => v.methodTiers.includes('push') && noPhishingResistant(v) && !v.methodTiers.includes('passwordless')).map((v) => v.userId)
  return []
}

/**
 * Who a step's own policies would stop rather than prompt: every active person
 * in the tenant each policy actually reaches whose methods do not satisfy the
 * strength it requires, judged combination by combination and alternative by
 * alternative (strand.ts policyVerdict). The people come from the directory and
 * the reach from the policy's own conditions — never from the step's list or the
 * goal it is filed under.
 *
 * Null where there is nothing to count, and null wherever the answer is not
 * known: no policy requires a strength; a scope the scan cannot settle; a
 * strength this tenant does not describe; an alternative way through that
 * cannot be judged. A count nobody can stand behind is not offered.
 */
export function lockoutCount(
  effects: readonly PolicyEffect[],
  viability: readonly MfaViability[],
  snapshot: TenantSnapshot,
  strengths: Map<string, string[]>,
  exclude: ReadonlySet<string> = new Set(),
  evidence: ScopeEvidence = {},
): number | null {
  const withStrength = effects.filter((e) => e.requirements.some((r) => r.kind === 'strength'))
  if (withStrength.length === 0) return null
  const ctx = { ...evidence, strengths }
  let count = 0
  for (const person of viability) {
    if (person.activity !== 'active' || exclude.has(person.userId)) continue
    for (const effect of withStrength) {
      const reached = operationReach(effect, person.userId, snapshot, ctx)
      if (reached.answer === 'out') continue
      if (reached.answer === 'unknown') return null
      const verdict = policyVerdict(effect, person.userId, snapshot, ctx)
      if (verdict.unknown) return null
      if (verdict.stranded) {
        count += 1
        break
      }
    }
  }
  return count
}
