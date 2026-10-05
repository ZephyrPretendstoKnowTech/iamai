// The pinned baseline as a package (prompt 51 decision 1; walk-51 item 9): IAMAI's
// own snapshot in its own schema, read from baselines/*.pinned.json and built
// into a BaselinePackage with no network. One module so the product, the demo
// and the demo fixture all derive through the same baseline — the demo never
// carries a baseline of its own.
//
// Pure: no DOM, no network. Runs in Node tests, in the worker and in the app.
import { DEFAULT_BASELINE } from './registry.ts'
import type { BaselineDefinition } from './registry.ts'
import { loadBaseline } from './index.ts'
import type { BaselineFile, BaselinePackage } from './types.ts'
import { corrected } from './authorCorrections.ts'

export type PinnedPolicy = { id: string | null; displayName: string; state: string | null; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }
export type PinnedBaseline = { commit: string; generatedAt: string; policies: PinnedPolicy[]; stripped: string[]; goalMap?: Record<string, string[]> }

export const PINNED = DEFAULT_BASELINE.pinned as unknown as PinnedBaseline

/**
 * The pinned policies as baseline files, so loadBaseline builds the package with
 * no network. A policy its author confirmed was meant otherwise is read as he
 * confirmed it (authorCorrections.ts); the pinned file itself is never changed.
 * 'published' is the export as its author published it, which is what
 * interpretation.json reads the source's references against.
 */
export function pinnedFiles(read: 'corrected' | 'published' = 'corrected', def: BaselineDefinition = DEFAULT_BASELINE): BaselineFile[] {
  return (def.pinned as unknown as PinnedBaseline).policies.map((p) => (read === 'corrected' ? corrected(p) : p)).map((p, i) => ({ path: `Policies/${(p.displayName || p.id || `policy-${i}`).replace(/[^\w-]+/g, '-')}.json`, text: JSON.stringify(p) }))
}

const cached = new Map<string, BaselinePackage>()

/** A curated baseline's pinned policies as one package (Jon Hope's by default), built once and shared; never mutated by its readers. */
export function pinnedPackage(def: BaselineDefinition = DEFAULT_BASELINE): BaselinePackage {
  let pkg = cached.get(def.id)
  if (pkg === undefined) cached.set(def.id, (pkg = { ...loadBaseline(pinnedFiles('corrected', def)), curatedId: def.id }))
  return pkg
}
