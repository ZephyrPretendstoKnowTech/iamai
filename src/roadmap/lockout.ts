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
