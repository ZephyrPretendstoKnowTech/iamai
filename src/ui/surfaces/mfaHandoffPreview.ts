// The people the Plan step's MFA handoff previews (MfaHandoff.tsx), worked out
// once here so the component only draws them. Pure: no DOM, no network.
//
// The handoff named each person by `displayName ?? userPrincipalName`, beside a
// product that names people by one rule (names.ts personLabels). On getiamai two
// accounts are called Kai Brown, an administrator and a guest: the admin step's
// preview named the administrator by that bare name, and the MFA, admin portal,
// guest and device-registration steps named the guest by it, without even its
// guest marker. An administrator reading that Kai Brown has no method could not
// tell which account to help register. The preview reads the one rule now: a
// name another account shares carries its sign-in address, and a guest among
// them its marker.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MethodClass } from '../../scoring/phishingResistant.ts'
import { methodClassesOf } from '../../derive/ladder.ts'
import { adminUserIds } from '../../roles.ts'
import { UNNAMED, personLabels } from '../../names.ts'

/**
 * How many people the Plan previews before handing off. Three is enough to make
 * the hold concrete without the step quietly becoming a second readiness table.
 * The TOTAL is never this number: it is the hold's own count, and the line under
 * the preview carries it.
 */
export const PREVIEW = 3

/** One previewed person: who, what they have, and whether their method needs a compatibility check. */
export type HandoffPerson = { id: string; name: string; admin: boolean; methods: MethodClass[]; checkCompat: boolean }

/**
 * The first people of a hold the step already made (derive/stepMfaReadiness.ts
 * stepMfaHold), named by the one rule for naming a person. `labels` is that
 * rule over the whole directory; the component builds it once per snapshot.
 */
export function handoffPreview(step: Step, ids: readonly string[] | null, snapshot: TenantSnapshot, labels: ReadonlyMap<string, string> = personLabels(snapshot.users)): HandoffPerson[] {
  const unknown = new Set(step.methodPreparation?.unknownIds ?? [])
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  return (ids ?? [])
    .filter((id) => byId.has(id))
    .slice(0, PREVIEW)
    .map((id) => ({ id, name: labels.get(id) || byId.get(id)?.userPrincipalName || UNNAMED, admin: admins.has(id), methods: methodClassesOf(snapshot, id) ?? [], checkCompat: unknown.has(id) }))
}
