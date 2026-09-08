// The baseline as the UI holds it (moved out of the Baseline page in prompt 47
// Part 4): the pinned index, loaded at its commit; an uploaded package; and
// the restore of either on reload.
import baselineIndex from '../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { loadBaseline, rawUrl } from '../baseline/index.ts'
import type { BaselineFile, BaselineIndex, BaselinePackage } from '../baseline/index.ts'
import { shouldSkip } from '../baseline/discover.ts'
import { policyChanges, sourceSet } from '../derive/baselineDiff.ts'
import type { PolicyChange, SourceArtifact } from '../derive/baselineDiff.ts'
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
 * runtime network calls are checkAuthorHead and the review it opens
 * (baselineReview), which together drive the "Baseline updated" line.
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

/** The author's changes at a candidate head, as policies. `incomplete` means IAMAI could not read enough source to establish the whole diff. */
export type BaselineReview = { changes: PolicyChange[]; incomplete: boolean }

/** Enough changed files to review by hand; past this the compare is not a baseline update but a repository reshuffle, and the review says so. */
const MAX_CANDIDATE_FILES = 80

/**
 * The author's *policy* changes between the pinned commit and a candidate head
 * (task 021), for pages.connectNoScan.baselineUpdated and its review list.
 *
 * The compare API is used for discovery only: it says which files moved, and
 * the author's repository carries one policy in more than one file and renames
 * a policy by adding one file and removing another. So every candidate file is
 * fetched at both commits and read through the baseline parser, and the review
 * is built from stable policy identity (derive/baselineDiff.ts) — four file
 * events for one renamed policy are one row.
 *
 * The base is the pinned *package's* commit. `baselines/*.index.json` records an
 * older pin and is not the baseline the plan was derived from, so it never
 * decides what the update is measured against; only the owner/repo are read
 * from it.
 *
 * Nothing here fails to "no changes": a compare that will not load, a file that
 * will not fetch and a file that will not parse all set `incomplete`, and the
 * tile says the review is incomplete rather than that the baseline is understood.
 */
export async function baselineReview(head: string, fetchImpl: typeof fetch = fetch): Promise<BaselineReview> {
  const base = PINNED.commit
  let files: { filename?: string; previous_filename?: string }[]
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${PINNED_BASELINE.owner}/${PINNED_BASELINE.repo}/compare/${base}...${head}`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return { changes: [], incomplete: true }
    files = ((await res.json()) as { files?: { filename?: string; previous_filename?: string }[] }).files ?? []
  } catch {
    return { changes: [], incomplete: true }
  }

  // A rename is paired by policy id, not by previous_filename, but the old path
  // is still where the old body lives, so both sides of every event are fetched.
  const paths: string[] = []
  for (const f of files) {
    for (const p of [f.filename, f.previous_filename]) {
      if (typeof p !== 'string' || shouldSkip(p) !== null || paths.includes(p)) continue
      paths.push(p)
    }
  }
  if (paths.length === 0) return { changes: [], incomplete: false }
  if (paths.length > MAX_CANDIDATE_FILES) return { changes: [], incomplete: true }

  let failed = false
  const at = async (commit: string): Promise<SourceArtifact[]> => {
    const out: SourceArtifact[] = []
    const q = [...paths]
    const worker = async (): Promise<void> => {
      while (q.length > 0) {
        const path = q.shift()!
        let url: string
        try {
          // The same path check every runtime fetch goes through (baseline/github.ts).
          url = rawUrl({ ...PINNED_BASELINE, commit }, path)
        } catch {
          failed = true
          continue
        }
        try {
          const res = await fetchImpl(url)
          if (res.status === 404) continue
          if (!res.ok) {
            failed = true
            continue
          }
          out.push({ path, text: await res.text() })
        } catch {
          failed = true
        }
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker))
    return out
  }

  const baseSet = sourceSet(await at(base))
  const headSet = sourceSet(await at(head))
  return { changes: policyChanges(baseSet, headSet), incomplete: failed || baseSet.unreadable.length > 0 || headSet.unreadable.length > 0 }
}

/**
 * Restore a saved baseline: an upload from its stored files; the author's
 * baseline from pinned.json, never from a file list a record kept (a record
 * from before the pin carried the repository's files and rebuilt a package
 * with more policies than the pin holds, so the tile's count differed signed
 * in from signed out). One count, from the pinned package.
 */
export async function restoreBaseline(origin: BaselineResult['origin']): Promise<BaselineResult> {
  if (origin.kind === 'upload') return loadUploadedBaseline(origin.files)
  return loadPinnedBaseline()
}

export function loadUploadedBaseline(files: BaselineFile[]): BaselineResult {
  const pkg = loadBaseline(files)
  // An uploaded baseline has no stored map: built once here, with the pin-time rule.
  return { source: app.connect.uploadedSource, pkg, fetchFailures: 0, origin: { kind: 'upload', files }, goalMap: goalMapFor(pkg.policies, new Map()).map }
}
