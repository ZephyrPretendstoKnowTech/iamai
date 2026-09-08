// Test support (dev builds only, ?author=1): an author update over the pinned
// package, so Connect's Baseline tile shows its review rows without the network.
//
// The mock is source *files*, not a finished answer: it builds the artifacts the
// author's repository would hold at two commits and runs them through the same
// sourceSet/policyChanges the live review uses (task 021). So what ?author=1
// draws is what a real compare would draw, and the four file events for the
// renamed policy collapse to one row here for the same reason they do live.
//
// It carries one of each shape the review must tell apart: a policy renamed and
// materially changed (held in two source paths at the old commit, as the author's
// repository holds them), one added, one changed that no goal maps to, and one
// removed.
import { PINNED } from '../baseline/pinned.ts'
import type { PinnedPolicy } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP, policyKey } from '../roadmap/goalMap.ts'
import { policyChanges, sourceSet } from '../derive/baselineDiff.ts'
import type { SourceArtifact } from '../derive/baselineDiff.ts'
import type { BaselineUpdate } from '../ui/scan/connectView.ts'

/** The author exports policies, not IAMAI's pinned schema: the pin's placeholder record is not part of a source file. */
function asSource(p: PinnedPolicy): Record<string, unknown> {
  const { placeholders: _placeholders, ...rest } = p
  return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>
}

const file = (dir: string, name: string): string => `Updated/${dir}/${name.replace(/\s*-\s*/g, '---')}.json`

export function mockAuthorUpdate(now: Date = new Date()): BaselineUpdate {
  const mapped = new Set(Object.values(PINNED_GOAL_MAP).flat())
  const inMap = PINNED.policies.filter((p) => mapped.has(policyKey(p)) && p.id)
  const outOfMap = PINNED.policies.filter((p) => !mapped.has(policyKey(p)))

  // 1. The evolving policy: renamed, given a custom authentication strength and
  //    one more excluded group. At the old commit it sits in two source paths.
  const evolvingOld = asSource(inMap[0])
  const evolvingNew = asSource(inMap[0])
  evolvingNew.displayName = `${inMap[0].displayName} - MFA Strength`
  const grant = (evolvingNew.grantControls as Record<string, unknown> | null) ?? { operator: 'OR', builtInControls: ['mfa'] }
  evolvingNew.grantControls = { ...grant, authenticationStrength: { id: '42de22a7-5339-4a58-b560-28565d53b14d', displayName: 'Modern MFA + TAP' } }
  const conditions = evolvingNew.conditions as Record<string, unknown>
  const users = (conditions.users as Record<string, unknown> | undefined) ?? {}
  conditions.users = { ...users, excludeGroups: [...((users.excludeGroups as string[] | undefined) ?? []), '5628ad67-f9d1-4495-abe3-99dc8f9074f1'] }

  // 2. A policy the author added under a new id.
  const added = asSource(inMap[1])
  added.id = 'b21c9f5e-3a44-4e0f-9d2b-7c1a08f6d310'
  added.displayName = `${inMap[1].displayName} - v2`

  // 3. A policy no goal maps to, turned off.
  const offOld = asSource(outOfMap[0])
  const offNew = asSource(outOfMap[0])
  offOld.state = 'enabled'
  offNew.state = 'disabled'

  // 4. A policy the author dropped.
  const removed = { id: '0f0b8f43-2d1a-4a9c-9f21-6b3a5cc41e07', displayName: 'IAC - OLD - BLOCK - Legacy', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }

  const base: SourceArtifact[] = [
    { path: file('Policies', inMap[0].displayName), text: JSON.stringify(evolvingOld) },
    { path: `Updated/Documentation/${inMap[0].displayName.replace(/\s*-\s*/g, '---')}/policy.json`, text: JSON.stringify(evolvingOld) },
    { path: file('Policies', outOfMap[0].displayName), text: JSON.stringify(offOld) },
    { path: file('Policies', removed.displayName), text: JSON.stringify(removed) },
  ]
  const head: SourceArtifact[] = [
    { path: file('Policies', evolvingNew.displayName as string), text: JSON.stringify(evolvingNew) },
    { path: `Updated/Documentation/${(evolvingNew.displayName as string).replace(/\s*-\s*/g, '---')}/policy.json`, text: JSON.stringify(evolvingNew) },
    { path: file('Policies', added.displayName as string), text: JSON.stringify(added) },
    { path: file('Policies', outOfMap[0].displayName), text: JSON.stringify(offNew) },
  ]
  return { date: now.toISOString(), changes: policyChanges(sourceSet(base), sourceSet(head)) }
}
