// Test support (dev builds only, ?author=1): an author update over the pinned
// package, so Connect's Baseline tile shows its review rows without the
// network. Two policies the goal map holds (one changed, one added under a new
// name), one it does not, and one removed file the package never had.
import { PINNED } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP, policyKey } from '../roadmap/goalMap.ts'

export type MockAuthorUpdate = { date: string; changes: { policy: string; change: string }[] }

export function mockAuthorUpdate(now: Date = new Date()): MockAuthorUpdate {
  const mapped = new Set(Object.values(PINNED_GOAL_MAP).flat())
  const inMap = PINNED.policies.filter((p) => mapped.has(policyKey(p)))
  const outOfMap = PINNED.policies.filter((p) => !mapped.has(policyKey(p)))
  const file = (name: string): string => `Policies/${name.replace(/\s*-\s*/g, '---')}.json`
  const changes = [
    { policy: file(inMap[0].displayName), change: 'updated' },
    { policy: file(`${inMap[1].displayName} - v2`), change: 'added' },
    { policy: file(outOfMap[0].displayName), change: 'updated' },
    { policy: 'Policies/IAC---OLD---BLOCK---Legacy.json', change: 'removed' },
  ]
  return { date: now.toISOString(), changes }
}
