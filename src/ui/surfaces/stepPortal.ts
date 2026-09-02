// The What-to-do portal lines for a policy step (prompt 51 §3.2, owner: the
// baseline wins). The runtime renders the portal-line translator over the goal's
// mapped baseline policy — never the content file's reference lines — so the
// instruction shown is the baseline's actual policy. A merged goal renders
// Policy A and Policy B. A step whose goal the baseline does not hold has no
// policy and renders no portal block (its content is exempt).
//
// Pure: no DOM, no network.
import pinned from '../../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { policyFacts } from '../../coverage/facts.ts'
import type { CaPolicy } from '../../baseline/types.ts'
import { policiesForGoal, PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { portalLines, portalLinesAB } from '../../roadmap/portalLines.ts'
import type { PortalContext } from '../../roadmap/portalLines.ts'
import { shared } from '../../content/content.ts'

type PinnedPolicy = { id: string | null; displayName: string; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }
const POLICIES = pinned.policies as unknown as PinnedPolicy[]

/** The token → resolved-name map used to fill a policy's ids with the tenant's names. */
export type PortalNames = {
  nameOf: (id: string) => string
  policyName: string
  strengthName?: string | null
  exclusionsGroupId?: string | null
  serviceAccountsGroupId?: string | null
}

function contextFor(p: PinnedPolicy, names: PortalNames): PortalContext {
  const ph = p.placeholders ?? {}
  let exclusionsGroupId: string | null = names.exclusionsGroupId ?? null
  let serviceAccountsGroupId: string | null = names.serviceAccountsGroupId ?? null
  for (const [id, token] of Object.entries(ph)) {
    if (token === 'exclusionsGroup') exclusionsGroupId = id.toLowerCase()
    if (token === 'serviceAccountsGroup') serviceAccountsGroupId = id.toLowerCase()
  }
  const strengthName = names.strengthName ?? (p.grantControls as { authenticationStrength?: { displayName?: string } } | null)?.authenticationStrength?.displayName ?? null
  return {
    policyName: names.policyName,
    nameOf: names.nameOf,
    strengthName,
    portalRoot: shared.portalRoot as string,
    portalOpen: (shared.portalOpen as string).replace('{policy}', names.policyName),
    reportOnlyLine: shared.reportOnlyLine as string,
    exclusionsLine: (shared.exclusionsLine as string).replace('{exclusionsGroup}', exclusionsGroupId ? names.nameOf(exclusionsGroupId) : 'the exclusions group'),
    exclusionsGroupId,
    serviceAccountsGroupId,
  }
}

/**
 * The portal lines for a goal's step, from its mapped baseline policy. Returns
 * null when the baseline does not hold the goal (no policy to render).
 */
/** The authentication-strength name the goal's mapped baseline policy requires, for the who and decision lines (walk-51 item 18). */
/**
 * The sign-in frequency the goal's baseline policy wants, in words ("4 hours",
 * "weekly"), for the content lines that name {wanted}; null when the mapped
 * policy sets none (walk of f3d140b: the manager note read "expire after and").
 */
export function sessionWantedForGoal(goalId: string): string | null {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped) {
    const sc = (p.sessionControls ?? null) as { signInFrequency?: { isEnabled?: boolean; value?: number; type?: string } } | null
    const f = sc?.signInFrequency
    if (!f || f.isEnabled === false || typeof f.value !== 'number') continue
    const hours = /^day/i.test(String(f.type ?? '')) ? f.value * 24 : f.value
    return hoursInWords(hours)
  }
  return null
}

export function strengthForGoal(goalId: string): string | null {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped as PinnedPolicy[]) {
    const s = (p.grantControls as { authenticationStrength?: { displayName?: string } } | null)?.authenticationStrength?.displayName
    if (typeof s === 'string' && s.length > 0) return s
  }
  return null
}

export function stepPortalLines(goalId: string, names: PortalNames): string[] | null {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  if (mapped.length === 0) return null
  if (mapped.length >= 2) {
    const a = mapped[0] as PinnedPolicy
    const b = mapped[1] as PinnedPolicy
    return portalLinesAB(
      { facts: policyFacts(a as unknown as CaPolicy, new Map()), ctx: contextFor(a, names) },
      { facts: policyFacts(b as unknown as CaPolicy, new Map()), ctx: contextFor(b, names) },
      { a: 'A', b: 'B' },
    )
  }
  const p = mapped[0] as PinnedPolicy
  return portalLines(policyFacts(p as unknown as CaPolicy, new Map()), contextFor(p, names))
}
