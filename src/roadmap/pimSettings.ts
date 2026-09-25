// Require MFA at Every Role Activation: its policy targets an authentication
// context, and role activation asks for that context only once the role's PIM
// setting requires it. Until each role people are eligible for does, the
// enforced policy asks for nothing (R4-18).
//
// The scan reads that setting for every role someone is eligible for
// (graph/collect/collectors.ts collectPimRoleSettings). So the step names the
// roles still to set, and finishes from the scan once none is left, as Block
// Legacy Authentication finishes once no named mail account is left
// (blockSignIns.ts). It replaced the workflow record the person used to make
// (owner, 2026-09-25: the step template bans Workflow Check).
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { setState } from './lifecycle.ts'
import type { Step } from './types.ts'

export const PIM_STEP_ID = 's-goal-pim-activation-reauth'

type Snapshot = Pick<TenantSnapshot, 'config' | 'roles' | 'pimRoleSettings'>
type Apps = { conditions?: { applications?: { includeAuthenticationContextClassReferences?: unknown } } | null }

const contextOfPolicy = (policy: unknown): string | null => {
  const refs = (policy as Apps | null | undefined)?.conditions?.applications?.includeAuthenticationContextClassReferences
  return Array.isArray(refs) && refs.length === 1 && typeof refs[0] === 'string' ? refs[0] : null
}

/**
 * The authentication context the step's policy targets: the one its operation
 * sends, else the one the tenant policy delivering the goal targets (`delivering`:
 * the ids coverage matched, or the policies tracked to the step); null where
 * neither names exactly one.
 */
export function pimContextOf(step: Pick<Step, 'action' | 'tracking'>, snapshot: Pick<TenantSnapshot, 'config'>, delivering: readonly string[] = []): string | null {
  for (const op of step.action.resolution?.policies ?? []) {
    const o = op as { mode?: string; body?: unknown; target?: unknown }
    const context = contextOfPolicy(o.mode === 'update' ? (o.target ?? o.body) : o.body)
    if (context !== null) return context
  }
  const ids = new Set([...delivering, ...(step.tracking?.members ?? []).map((m) => m.policyId ?? '')].filter((id) => id !== '').map((id) => id.toLowerCase()))
  const rows = (snapshot.config.caPolicies?.rows ?? []) as { id?: unknown }[]
  for (const row of rows) if (typeof row.id === 'string' && ids.has(row.id.toLowerCase())) return contextOfPolicy(row)
  return null
}

/** The roles someone is eligible for in PIM, by role id, sorted. */
export function eligibleRoleIds(snapshot: Pick<TenantSnapshot, 'roles'>): string[] {
  return [...new Set(Object.values(snapshot.roles?.eligible ?? {}).flat())].sort()
}

/**
 * The roles someone is eligible for whose activation does not yet require
 * `context`, by role id, sorted. A role whose setting the scan did not read is
 * among them: nothing shows it set.
 */
export function pimRolesToSet(snapshot: Snapshot, context: string): string[] {
  const read = new Map((snapshot.pimRoleSettings ?? []).map((s) => [s.roleDefinitionId.toLowerCase(), s.contextRequired?.toLowerCase() ?? null]))
  return eligibleRoleIds(snapshot).filter((id) => read.get(id.toLowerCase()) !== context.toLowerCase())
}

/** The role management policy of each role to set, where the scan read one: the one PIM rule each carries. */
export function pimPolicyIdsOf(snapshot: Snapshot, roleIds: readonly string[]): string[] {
  const byRole = new Map((snapshot.pimRoleSettings ?? []).map((s) => [s.roleDefinitionId.toLowerCase(), s.policyId]))
  return roleIds.map((id) => byRole.get(id.toLowerCase()) ?? null).filter((id): id is string => id !== null)
}

/**
 * The step's roles still to set (Step.pimRolesToSet). A delivered policy does not
 * finish the step while any is left; the step completes from the scan once none
 * is. Nothing is recorded by hand.
 */
export function settlePimSettings(steps: Step[], snapshot: Snapshot, delivering: readonly string[] = []): void {
  const step = steps.find((s) => s.id === PIM_STEP_ID)
  if (!step || step.state.setAside) return
  const context = pimContextOf(step, snapshot, delivering)
  const toSet = context === null ? [] : pimRolesToSet(snapshot, context)
  if (toSet.length === 0) {
    delete step.pimRolesToSet
    return
  }
  step.pimRolesToSet = toSet
  if (step.state.satisfied) setState(step, { satisfied: false, inPlace: false })
}
