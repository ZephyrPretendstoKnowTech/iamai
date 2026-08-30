// Exclusion drift (prompt 44 Part 3).
//
// An exclusion group is the one object in a tenant that quietly undoes every
// policy referencing it. It starts as two break-glass accounts and, a year on,
// holds nine people nobody remembers adding. Entra reports nothing, because from
// its point of view nothing has gone wrong.
//
// So the checkpoint records the size, and this compares. Growth beyond the
// nominated emergency-access accounts is a finding rather than a note: it means
// somebody is now outside controls the plan believes are switched on.
//
// Pure: no DOM, no network.
import { DRIFT } from '../copy/drift.ts'
import type { Checkpoint } from './plan.ts'

/** Enough of a group to compare two checkpoints. */
export type GroupSnapshot = { groupId: string; name: string; memberCount: number; memberIds?: string[] }

export type DriftItem = {
  kind: 'group' | 'direct'
  id: string
  /** True where this is a finding rather than a note: beyond the nominated count. */
  finding: boolean
  sentence: string
  /** The people added since the last checkpoint, named where the group is small. */
  addedNames: string[]
  detail: string | null
}

/**
 * What changed since the last checkpoint.
 *
 * `nominated` is the number of emergency-access accounts the operator named in
 * Setup. It is the bar: a group holding exactly those is doing its job, and a
 * group holding more is doing something nobody asked for.
 */
export function exclusionDrift(args: {
  previous: Checkpoint | null
  current: GroupSnapshot[]
  /** Group ids actually referenced as an exclusion by at least one policy. */
  usedAsExclusion: Set<string>
  nominated: number
  nameOf: (userId: string) => string
  /** Below this, the added members are named rather than counted. */
  nameLimit?: number
}): DriftItem[] {
  const { previous, current, usedAsExclusion, nominated, nameOf } = args
  const nameLimit = args.nameLimit ?? 10
  if (!previous) return []
  const before = new Map(previous.exclusionGroups.map((g) => [g.groupId, g]))
  const since = previous.at
  const out: DriftItem[] = []

  for (const g of current) {
    if (!usedAsExclusion.has(g.groupId)) continue
    const was = before.get(g.groupId)
    if (!was) continue
    const grew = g.memberCount > was.memberCount
    const shrank = g.memberCount < was.memberCount
    const beyond = g.memberCount > nominated
    if (!grew && !shrank && !beyond) continue

    // Naming who arrived needs ids at both ends. An older plan file has counts
    // only, and says so by naming nobody rather than guessing.
    const previousIds = new Set((was as { memberIds?: string[] }).memberIds ?? [])
    const addedIds = (g.memberIds ?? []).filter((id) => !previousIds.has(id))
    const canName = (was as { memberIds?: string[] }).memberIds !== undefined && addedIds.length > 0 && g.memberCount <= nameLimit
    const addedNames = canName ? addedIds.map(nameOf) : []

    const sentence = beyond
      ? DRIFT.beyondNominated(g.name, g.memberCount, nominated)
      : grew
        ? DRIFT.grew(g.name, was.memberCount, g.memberCount, dateOf(since))
        : DRIFT.shrank(g.name, was.memberCount, g.memberCount, dateOf(since))

    out.push({
      kind: 'group',
      id: g.groupId,
      finding: beyond,
      sentence,
      addedNames,
      detail: addedNames.length > 0 ? DRIFT.added(addedNames) : addedIds.length > 0 ? DRIFT.addedMany(addedIds.length) : null,
    })
  }

  return out
}

/**
 * The same treatment for accounts excluded on a policy directly (item 15).
 *
 * These are worse than a group, not better: an account excluded on the policy
 * itself never appears in a group review, so nobody looking at exclusion groups
 * will ever find it.
 */
export function directExclusionDrift(args: {
  previous: Map<string, number> | null
  current: { policyId: string; policyName: string; excludedCount: number }[]
  since: string
}): DriftItem[] {
  const { previous, current, since } = args
  if (!previous) return []
  const out: DriftItem[] = []
  for (const p of current) {
    if (p.excludedCount === 0) continue
    const was = previous.get(p.policyId)
    if (was === undefined) continue
    if (p.excludedCount > was) {
      out.push({
        kind: 'direct',
        id: p.policyId,
        finding: true,
        sentence: DRIFT.direct(p.policyName, was, p.excludedCount, dateOf(since)),
        addedNames: [],
        detail: DRIFT.directBeyond(p.policyName, p.excludedCount),
      })
    }
  }
  return out
}

/** A date a person reads, never a raw timestamp. */
function dateOf(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}
