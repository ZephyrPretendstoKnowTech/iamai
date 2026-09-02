// The pinned baseline as a package (prompt 51 decision 1; walk-51 item 9): IAMAI's
// own snapshot in its own schema, read from baselines/*.pinned.json and built
// into a BaselinePackage with no network. One module so the product, the demo
// and the demo fixture all derive through the same baseline — the demo never
// carries a baseline of its own.
//
// Pure: no DOM, no network. Runs in Node tests, in the worker and in the app.
import pinnedBaseline from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { loadBaseline } from './index.ts'
import type { BaselineFile, BaselinePackage } from './types.ts'

export type PinnedPolicy = { id: string | null; displayName: string; state: string | null; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }
export type PinnedBaseline = { commit: string; generatedAt: string; policies: PinnedPolicy[]; stripped: string[]; goalMap?: Record<string, string[]> }

export const PINNED = pinnedBaseline as unknown as PinnedBaseline

/** The pinned policies as baseline files, so loadBaseline builds the package with no network. */
export function pinnedFiles(): BaselineFile[] {
  return PINNED.policies.map((p, i) => ({ path: `Policies/${(p.displayName || p.id || `policy-${i}`).replace(/[^\w-]+/g, '-')}.json`, text: JSON.stringify(p) }))
}

let cached: BaselinePackage | null = null

/** The pinned baseline as one package, built once and shared; never mutated by its readers. */
export function pinnedPackage(): BaselinePackage {
  if (cached === null) cached = loadBaseline(pinnedFiles())
  return cached
}
