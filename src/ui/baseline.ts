// The baseline as the UI holds it (moved out of the Baseline page in prompt 47
// Part 4): the pinned index, loaded at its commit; an uploaded package; and
// the restore of either on reload.
import baselineIndex from '../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import pinnedBaseline from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { loadBaseline } from '../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../baseline/index.ts'
import { CONNECT } from '../copy/connect.ts'

export type BaselineResult = {
  source: string
  pkg: BaselinePackage
  fetchFailures: number
  /** How to restore it on reload (prompt 14 §6). The pinned baseline keeps its fetched files so a reload restores it without the network. */
  origin: { kind: 'github'; owner: string; repo: string; commit: string; files?: BaselineFile[] } | { kind: 'upload'; files: BaselineFile[] }
}

export const PINNED_BASELINE = baselineIndex as BaselineIndex

type PinnedPolicy = { id: string | null; displayName: string; state: string | null; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }
type PinnedBaseline = { commit: string; generatedAt: string; policies: PinnedPolicy[]; stripped: string[]; goalMap?: Record<string, string[]> }
export const PINNED = pinnedBaseline as unknown as PinnedBaseline

/** The pinned policies as baseline files, so loadBaseline builds the package with no network (prompt 51 decision 1). */
function pinnedFiles(): BaselineFile[] {
  return PINNED.policies.map((p, i) => ({ path: `Policies/${(p.displayName || p.id || `policy-${i}`).replace(/[^\w-]+/g, '-')}.json`, text: JSON.stringify(p) }))
}

/**
 * Load the bundled, pinned baseline — IAMAI's own snapshot in our schema,
 * read from baselines/*.pinned.json, no network (prompt 51 decision 1). The only
 * runtime network call is checkAuthorHead, which drives the "Baseline updated" line.
 */
export async function loadPinnedBaseline(onProgress?: (done: number, total: number) => void): Promise<BaselineResult> {
  const files = pinnedFiles()
  onProgress?.(files.length, files.length)
  return {
    source: PINNED_BASELINE.label,
    pkg: loadBaseline(files),
    fetchFailures: 0,
    origin: { kind: 'github', owner: PINNED_BASELINE.owner, repo: PINNED_BASELINE.repo, commit: PINNED.commit, files },
  }
}

export type AuthorHead = { updated: boolean; pinned: string; head: string | null; date: string | null }

/**
 * The one runtime network call (prompt 51 decision 1): the author's current head
 * commit, compared with the pinned one. When it differs, Connect renders
 * pages.connectNoScan.baselineUpdated and taking the update re-derives the plan.
 * Failures are swallowed to `updated: false` — a check that cannot reach the
 * network never blocks the plan.
 */
export async function checkAuthorHead(fetchImpl: typeof fetch = fetch): Promise<AuthorHead> {
  const pinned = PINNED.commit
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${PINNED_BASELINE.owner}/${PINNED_BASELINE.repo}/commits?per_page=1`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return { updated: false, pinned, head: null, date: null }
    const body = (await res.json()) as { sha?: string; commit?: { author?: { date?: string } } }[]
    const head = body[0]?.sha ?? null
    const date = body[0]?.commit?.author?.date ?? null
    return { updated: head !== null && head !== pinned, pinned, head, date }
  } catch {
    return { updated: false, pinned, head: null, date: null }
  }
}

/** Restore a saved baseline from its stored files; the pinned one is refetched only when no files were kept. */
export async function restoreBaseline(origin: BaselineResult['origin']): Promise<BaselineResult> {
  if (origin.kind === 'upload') return loadUploadedBaseline(origin.files)
  if (origin.files && origin.files.length > 0) {
    return { source: PINNED_BASELINE.label, pkg: loadBaseline(origin.files), fetchFailures: 0, origin }
  }
  return loadPinnedBaseline()
}

export function loadUploadedBaseline(files: BaselineFile[]): BaselineResult {
  return { source: CONNECT.uploadedSource, pkg: loadBaseline(files), fetchFailures: 0, origin: { kind: 'upload', files } }
}
