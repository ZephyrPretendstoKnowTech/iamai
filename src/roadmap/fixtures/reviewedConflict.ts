// A reviewed baseline conflict for the tests of the mechanism (roadmap/baselineConflict.ts).
//
// The product carries no reviewed conflict since 2026-10-03: the owner read Jon
// Hope's Admin Portal block as an incident switch, and Prepare the Lockdown Kit
// builds it Off (roadmap/lockdownKit.ts). The mechanism stays for the next
// reviewed item, and its tests run on the review it last carried, handed to the
// engine the way a future entry would be (RoadmapInput.reviewedSources) with a
// map that hands the policy to the admin-portals goal again, as an uploaded
// baseline's own map would.
//
// The review as it was read: the README documented "blocks access to Microsoft
// admin portals for non-admin users", the export blocks `includeUsers: ["All"]`.
// Its explanation's content key is gone with the product entry, so a step in
// this conflict carries no explanation sentence.
//
// Pure data: no DOM, no network.
import type { CaPolicy } from '../../baseline/types.ts'
import type { ReviewedSource } from '../baselineConflict.ts'
import { PINNED_GOAL_MAP } from '../goalMap.ts'
import type { GoalMap } from '../goalMap.ts'
import type { RoadmapInput } from '../generate.ts'
import { LOCKDOWN_KIT_GOAL } from '../lockdownKit.ts'

/** The goal the review's map hands the reviewed policy. */
export const CONFLICT_GOAL = 'admin-portals-protected'
/** The reviewed policy's stable id in the pin. */
export const CONFLICT_SOURCE = 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'

/** The exported reading: a Block over every account in the directory. */
function blocksEveryoneInTheDirectory(policy: CaPolicy): boolean {
  const users = policy.conditions?.users ?? {}
  const blocks = (policy.grantControls?.builtInControls ?? []).some((c) => c.toLowerCase() === 'block')
  const everyone = (users.includeUsers ?? []).some((u) => u.toLowerCase() === 'all')
  return blocks && everyone
}

/** The documented reading: the policy is for the people who do not hold an admin role. */
const DOCUMENTS_NON_ADMIN_SCOPE = /non[-\s]?admin|without an admin|standard users|except .{0,24}admin|exclud\w* .{0,24}admin/i

/** Documentation that expressly adopts the meaning the export really has: this block is for everyone in the tenant. */
const ADOPTS_EVERYONE_SCOPE = /\b(all users|all accounts|every account|every user|everyone)\b/i

/** The Admin Portal review as the product carried it until 2026-10-03. */
export const ADMIN_PORTAL_REVIEW: ReviewedSource = {
  key: CONFLICT_SOURCE,
  reviewedName: 'IAC - ZTCA - GLOBAL – BLOCK – Admin Portal',
  words: 'adminPortalNonAdminScope',
  unresolved: (policy, doc) => {
    // Side one: a version whose export no longer claims the whole directory says only one thing.
    if (!blocksEveryoneInTheDirectory(policy)) return false
    // Side two: the documentation the review read stands unless the package ships its own that adopts the exported meaning.
    const intent = doc?.intent
    if (intent === undefined) return true
    return !(ADOPTS_EVERYONE_SCOPE.test(intent) && !DOCUMENTS_NON_ADMIN_SCOPE.test(intent))
  },
}

/** The pinned map with the reviewed policy handed back to the admin-portals goal, and out of the lockdown kit. */
export const CONFLICT_GOAL_MAP: GoalMap = {
  ...PINNED_GOAL_MAP,
  [CONFLICT_GOAL]: [CONFLICT_SOURCE],
  [LOCKDOWN_KIT_GOAL]: (PINNED_GOAL_MAP[LOCKDOWN_KIT_GOAL] ?? []).filter((k) => k !== CONFLICT_SOURCE),
}

/** The engine input that plans the reviewed conflict: the review, and a map that hands its policy to a goal. */
export const conflictInput = (map: GoalMap = CONFLICT_GOAL_MAP): Partial<RoadmapInput> => ({ goalMap: map, reviewedSources: [ADMIN_PORTAL_REVIEW] })
