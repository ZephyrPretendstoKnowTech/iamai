// What the baseline's author confirmed an exported policy was meant to be, where
// the export says otherwise. The pinned export stays exactly as it was fetched
// (baselines/*.pinned.json is human-owned, and its hash is the provenance); the
// correction is applied as the package is loaded, and the goal it then delivers
// joins the pinned goal map. Every reader — coverage, the plan, the portal
// lines, the Not in this plan footer — sees the one corrected policy.
//
// The pinned baseline wins over IAMAI's own templates (owner, 2026-09-25: "the
// baseline plan is king"). Protect Sign-in Method Registration was written from
// Microsoft's registration template because the export's registration policy
// targets something else; Jon confirmed that part of his export was a mistake.
//
// Pure: no DOM, no network.

type Policy = { id: string | null; displayName: string; conditions: unknown; [key: string]: unknown }

export type AuthorCorrection = {
  /** The exported policy, by its display name in the pin. */
  policy: string
  /** The goal it delivers once corrected. */
  goal: string
  /** What the author confirmed, and where it is recorded. */
  evidence: string
  /** The corrected policy; the export itself is never changed. */
  apply: (policy: Policy) => Policy
}

type Conditions = { users?: Record<string, unknown>; applications?: Record<string, unknown>; platforms?: unknown; [key: string]: unknown }

export const AUTHOR_CORRECTIONS: readonly AuthorCorrection[] = [
  {
    policy: 'IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration',
    goal: 'register-info-protected',
    evidence: "Jon confirmed his export targets device registration on iPhones only by mistake: it protects security-information registration (docs/plans/roadmap-flow/v1-plan.md, Phase 2a: \"5.1 stays: it is what Jon said his export meant\"). Its include is his own registration pilot group, which no tenant holds (interpretation.json: decisionRequired), so the plan reads it as the people the plan rolls out to, All users, as his other policies include them.",
    apply: (p) => {
      const c = (p.conditions ?? {}) as Conditions
      const users = { ...(c.users ?? {}), includeUsers: ['All'], includeGroups: [] }
      const applications = { ...(c.applications ?? {}), includeUserActions: ['urn:user:registersecurityinfo'] }
      return { ...p, conditions: { ...c, users, applications, platforms: null } }
    },
  },
]

const byName = new Map(AUTHOR_CORRECTIONS.map((c) => [c.policy, c]))

/** The policy as its author confirmed it, or the policy itself where nothing corrects it. */
export function corrected<T extends { displayName: string }>(policy: T): T {
  const c = byName.get(policy.displayName)
  return c ? (c.apply(policy as unknown as Policy) as unknown as T) : policy
}

/**
 * The goal map with each corrected policy on the goal it delivers, where the map
 * holds no policy for that goal already (`keyOf` a policy's key in the map).
 */
export function withCorrectedGoals(map: Record<string, string[]>, policies: readonly Policy[], keyOf: (p: Policy) => string): Record<string, string[]> {
  const out = { ...map }
  for (const c of AUTHOR_CORRECTIONS) {
    if ((out[c.goal] ?? []).length > 0) continue
    const p = policies.find((x) => x.displayName === c.policy)
    if (p) out[c.goal] = [keyOf(p)]
  }
  return out
}
