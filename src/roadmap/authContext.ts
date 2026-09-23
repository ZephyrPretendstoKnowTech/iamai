// The authentication contexts a step's policy would newly target that another of
// the tenant's Conditional Access policies already targets (R4-18 review).
//
// IAMAI reads no authentication contexts. The one thing a scan does see about
// them is which of the tenant's policies target one, and a context another
// policy targets is in use for something this plan did not make: sensitivity
// labels, Defender for Cloud Apps, an application's own step-up. A policy the
// plan puts on it — Require MFA at Every Role Activation creates an All-users
// "strong authentication, every time" policy on the baseline's c1 — applies to
// every sign-in that requests that context from the moment it is enforced, and
// its preparation would ask the reader to create a context that is already
// there. IAMAI does not choose another context ID for the reader either: the
// step holds, and says why (roadmap/generate.ts; planLanes.ts observe reads the
// blocker as a tenant fact).
//
// This is the one reading of the fact. The Plan row, Readiness and every
// channel follow the hold; the package's bindings name the context the
// operation sends (ui/surfaces/stepPackage.ts), and never decide it again.
import type { PolicyOperation } from './types.ts'

/** The blocker label the hold carries (Step.blockers), which its Readiness heading is keyed by (pages.plan.blockedSubject). */
export const AUTH_CONTEXT_IN_USE = 'auth-context-in-use'

type Row = { id?: unknown; conditions?: { applications?: { includeAuthenticationContextClassReferences?: unknown } } | null }

const contextsOf = (policy: unknown): string[] => {
  const refs = (policy as Row | null | undefined)?.conditions?.applications?.includeAuthenticationContextClassReferences
  return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : []
}

/**
 * Each authentication context the operations put a policy on that another of
 * the tenant's policies — in any state: a disabled one still names it — already
 * targets. A create puts its policy on every context its body names; an update
 * only on the ones it adds to the policy it changes, whose own targets are the
 * tenant's choice. `own` are the policies that are this step's (its plan tag),
 * never "another" policy.
 */
export function contextsTakenElsewhere(ops: readonly PolicyOperation[], rows: readonly unknown[], own: readonly string[] = []): string[] {
  const policies = (rows as Row[]).filter((r): r is Row & { id: string } => typeof r.id === 'string')
  const ownIds = new Set(own.map((id) => id.toLowerCase()))
  const out = new Map<string, string>()
  for (const op of ops) {
    const changed = op.mode === 'update' ? op.policyId.toLowerCase() : null
    const current = new Set(contextsOf(policies.find((r) => r.id.toLowerCase() === changed)).map((c) => c.toLowerCase()))
    for (const context of contextsOf(op.mode === 'update' ? (op.target ?? op.body) : op.body)) {
      const want = context.toLowerCase()
      if (current.has(want) || out.has(want)) continue
      const elsewhere = policies.some((r) => r.id.toLowerCase() !== changed && !ownIds.has(r.id.toLowerCase()) && contextsOf(r).some((c) => c.toLowerCase() === want))
      if (elsewhere) out.set(want, context)
    }
  }
  return [...out.values()]
}
