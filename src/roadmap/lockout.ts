// The lockout list of a strength policy (E8, and its row count): who the step's
// own policies would stop rather than prompt once they enforce. One answer, from
// the strength each policy will actually require measured against each person's
// registered methods — the row's who-column ("3 people · 2 not yet at Passkey or
// security key, proven"), the step's Who lines (by name when three or fewer, a
// count otherwise) and the count itself. No goal has a lockout list of its own.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { PolicyEffect, ScopeEvidence } from './operations.ts'
import { operationReach, policyVerdict } from './strand.ts'

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
function lockoutPeople(
  effects: readonly PolicyEffect[],
  viability: readonly MfaViability[],
  snapshot: TenantSnapshot,
  strengths: Map<string, string[]>,
  exclude: ReadonlySet<string> = new Set(),
  evidence: ScopeEvidence = {},
): string[] | null {
  const withStrength = effects.filter((e) => e.requirements.some((r) => r.kind === 'strength'))
  if (withStrength.length === 0) return null
  const ctx = { ...evidence, strengths }
  const stopped: string[] = []
  for (const person of viability) {
    if (person.activity !== 'active' || exclude.has(person.userId)) continue
    for (const effect of withStrength) {
      const reached = operationReach(effect, person.userId, snapshot, ctx)
      if (reached.answer === 'out') continue
      if (reached.answer === 'unknown') return null
      const verdict = policyVerdict(effect, person.userId, snapshot, ctx)
      if (verdict.unknown) return null
      if (verdict.stranded) {
        stopped.push(person.userId)
        break
      }
    }
  }
  return stopped
}

/** How many of them there are: the count and the names are one answer, never two. */
export function lockoutCount(
  effects: readonly PolicyEffect[],
  viability: readonly MfaViability[],
  snapshot: TenantSnapshot,
  strengths: Map<string, string[]>,
  exclude: ReadonlySet<string> = new Set(),
  evidence: ScopeEvidence = {},
): number | null {
  return lockoutPeople(effects, viability, snapshot, strengths, exclude, evidence)?.length ?? null
}
