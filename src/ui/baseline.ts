// The baseline as the UI holds it (moved out of the Baseline page in prompt 47
// Part 4): the pinned index, loaded at its commit; an uploaded package; and
// the restore of either on reload.
import baselineIndex from '../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { loadBaseline } from '../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../baseline/index.ts'
import { PINNED, pinnedFiles, pinnedPackage } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP, goalMapFor } from '../roadmap/goalMap.ts'
import type { GoalMap } from '../roadmap/goalMap.ts'
import { app } from '../content/content.ts'

export type BaselineResult = {
  source: string
  pkg: BaselinePackage
  fetchFailures: number
  /** How to restore it on reload (prompt 14 §6). The pinned baseline keeps its fetched files so a reload restores it without the network. */
  origin: { kind: 'github'; owner: string; repo: string; commit: string; files?: BaselineFile[] } | { kind: 'upload'; files: BaselineFile[] }
  /**
   * The goal map of this baseline (walk-51 item 9): which goals it holds and the
   * policy that stands for each. The pinned baseline's is stored in pinned.json;
   * an uploaded package has no stored map, so it is built once at load with the
   * pin-time rule (goalMap.ts). Absent means the pinned map.
   */
  goalMap?: GoalMap
}

export const PINNED_BASELINE = baselineIndex as BaselineIndex

export { PINNED }

/**
 * Load the bundled, pinned baseline — IAMAI's own snapshot in our schema,
 * read from baselines/*.pinned.json, no network (prompt 51 decision 1). The only
 * runtime network call is checkAuthorHead, which drives the "Baseline updated" line.
 * The package is the one src/baseline/pinned.ts builds, shared with the demo.
 */
export async function loadPinnedBaseline(onProgress?: (done: number, total: number) => void): Promise<BaselineResult> {
  const files = pinnedFiles()
  onProgress?.(files.length, files.length)
  return {
    source: PINNED_BASELINE.label,
    pkg: pinnedPackage(),
    fetchFailures: 0,
    origin: { kind: 'github', owner: PINNED_BASELINE.owner, repo: PINNED_BASELINE.repo, commit: PINNED.commit, files },
    goalMap: PINNED_GOAL_MAP,
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

export type BaselineChange = { policy: string; change: string }

/**
 * The policy files that changed between the pinned commit and the author's head,
 * from the GitHub compare API (prompt 52 Part 1) — the data behind
 * pages.connectNoScan.baselineUpdated and its baselineUpdatedRow review list.
 * The compare returns the changed file list, so no policy content is fetched.
 * A network failure returns an empty list; Connect shows the update only when
 * the list is non-empty, so the count and rows are always real.
 */
export async function baselineChanges(head: string, fetchImpl: typeof fetch = fetch): Promise<BaselineChange[]> {
  const word: Record<string, string> = { added: 'added', modified: 'updated', changed: 'updated', removed: 'removed', renamed: 'renamed' }
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${PINNED_BASELINE.owner}/${PINNED_BASELINE.repo}/compare/${PINNED.commit}...${head}`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return []
    const body = (await res.json()) as { files?: { filename: string; status: string }[] }
    return (body.files ?? [])
      .filter((f) => /\.json$/i.test(f.filename) && !/\b(index|readme)\b/i.test(f.filename))
      .map((f) => ({ policy: (f.filename.split('/').pop() ?? f.filename).replace(/\.json$/i, ''), change: word[f.status] ?? f.status }))
  } catch {
    return []
  }
}

/** Restore a saved baseline from its stored files; the pinned one is refetched only when no files were kept. */
export async function restoreBaseline(origin: BaselineResult['origin']): Promise<BaselineResult> {
  if (origin.kind === 'upload') return loadUploadedBaseline(origin.files)
  if (origin.files && origin.files.length > 0) {
    return { source: PINNED_BASELINE.label, pkg: loadBaseline(origin.files), fetchFailures: 0, origin, goalMap: PINNED_GOAL_MAP }
  }
  return loadPinnedBaseline()
}

export function loadUploadedBaseline(files: BaselineFile[]): BaselineResult {
  const pkg = loadBaseline(files)
  // An uploaded baseline has no stored map: built once here, with the pin-time rule.
  return { source: app.connect.uploadedSource, pkg, fetchFailures: 0, origin: { kind: 'upload', files }, goalMap: goalMapFor(pkg.policies, new Map()).map }
}
