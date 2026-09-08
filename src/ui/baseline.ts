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

/** Enough moved files to review by hand; past this the head is not a baseline update but a repository reshuffle, and the review says so. */
const MAX_MOVED_FILES = 80

/**
 * The whole source inventory one review may read. The author's repository holds
 * around eighty JSON files at a commit; a repository far past that is source
 * IAMAI cannot establish in one review, so it says incomplete rather than
 * reviewing a subset of it.
 */
const MAX_INVENTORY_FILES = 400

/** One commit's policy-candidate paths and the blob each one holds, so two commits can be compared before either is read. */
type Inventory = Map<string, string>

/**
 * Every path at a commit that could carry a policy, read from the repository
 * tree — the whole inventory, not the files a compare says moved.
 *
 * Discovery has to be the inventory. The author keeps most policies in two
 * files (a copy under `Updated/Policies/` and another under
 * `Updated/Documentation/`), and a commit that edits one copy leaves the other
 * where it was; GitHub then omits the untouched copy from the compare
 * altogether. Reading only the moved paths would show one copy of that policy
 * at the head and report an ordinary reviewed change, when what the source
 * actually holds is two copies of one policy id that contradict each other.
 *
 * `null` is IAMAI saying it could not establish the inventory — the tree would
 * not load, or GitHub truncated it — and makes the review incomplete rather
 * than a review of whatever subset came back.
 */
async function inventoryAt(commit: string, fetchImpl: typeof fetch): Promise<Inventory | null> {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${PINNED_BASELINE.owner}/${PINNED_BASELINE.repo}/git/trees/${commit}?recursive=1`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return null
    const body = (await res.json()) as { tree?: { path?: string; type?: string; sha?: string }[]; truncated?: boolean }
    if (body.truncated === true || !Array.isArray(body.tree)) return null
    const inv: Inventory = new Map()
    for (const e of body.tree) {
      if (e.type !== 'blob' || typeof e.path !== 'string') continue
      if (shouldSkip(e.path) !== null) continue
      // The blob id is what proves two commits hold the same bytes. An entry
      // without one is read as its own blob at its own commit: fetched on the
      // side it appears on, never assumed unchanged.
      inv.set(e.path, typeof e.sha === 'string' && e.sha.length > 0 ? e.sha : `${commit}:${e.path}`)
    }
    return inv
  } catch {
    return null
  }
}

/**
 * The author's *policy* changes between the pinned commit and a candidate head
 * (task 021), for pages.connectNoScan.baselineUpdated and its review list.
 *
 * Both commits are read whole, from their trees (`inventoryAt`), because the
 * author's repository carries one policy in more than one file and renames a
 * policy by adding one file and removing another. Every candidate path is read
 * through the baseline parser and the review is built from stable policy
 * identity (derive/baselineDiff.ts): four file events for one renamed policy
 * are one row, and two copies of one id that disagree are a conflict rather
 * than a change — including when only one of the copies moved.
 *
 * The base is the pinned *package's* commit. `baselines/*.index.json` records an
 * older pin and is not the baseline the plan was derived from, so it never
 * decides what the update is measured against; only the owner/repo are read
 * from it.
 *
 * Nothing here fails to "no changes": a tree that will not load or came back
 * truncated, a file that will not fetch and a file that will not parse all set
 * `incomplete`, and the tile says the review is incomplete rather than that the
 * baseline is understood. The tree is also what makes a 404 legible — it names
 * the blobs the commit holds, so a body that will not come back is always
 * unread source, never an addition, a removal, or a silence.
 */
export async function baselineReview(head: string, fetchImpl: typeof fetch = fetch): Promise<BaselineReview> {
  const base = PINNED.commit
  const [baseInv, headInv] = await Promise.all([inventoryAt(base, fetchImpl), inventoryAt(head, fetchImpl)])
  if (!baseInv || !headInv) return { changes: [], incomplete: true }

  const moved = [...new Set([...baseInv.keys(), ...headInv.keys()])].filter((p) => baseInv.get(p) !== headInv.get(p))
  // No candidate blob moved: the two trees prove there is no update, with nothing fetched.
  if (moved.length === 0) return { changes: [], incomplete: false }
  if (moved.length > MAX_MOVED_FILES) return { changes: [], incomplete: true }

  // One fetch per blob rather than per path per commit: a file both commits
  // share is read once, which is what keeps reading both inventories whole
  // affordable — the author's untouched copies are the same blob on both sides.
  const plan = new Map<string, { commit: string; path: string }>()
  for (const [commit, inv] of [[head, headInv] as const, [base, baseInv] as const]) {
    for (const [path, blob] of inv) if (!plan.has(blob)) plan.set(blob, { commit, path })
  }
  if (plan.size > MAX_INVENTORY_FILES) return { changes: [], incomplete: true }

  let failed = false
  const texts = new Map<string, string>()
  const q = [...plan.entries()]
  const worker = async (): Promise<void> => {
    while (q.length > 0) {
      const [blob, where] = q.shift()!
      let url: string
      try {
        // The same path check every runtime fetch goes through (baseline/github.ts).
        url = rawUrl({ ...PINNED_BASELINE, commit: where.commit }, where.path)
      } catch {
        failed = true
        continue
      }
      try {
        const res = await fetchImpl(url)
        // The tree said this commit holds this blob, so anything but a body —
        // a 404 included — is source IAMAI could not read.
        if (!res.ok) {
          failed = true
          continue
        }
        texts.set(blob, await res.text())
      } catch {
        failed = true
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  const at = (inv: Inventory): SourceArtifact[] =>
    [...inv].flatMap(([path, blob]) => {
      const text = texts.get(blob)
      return text === undefined ? [] : [{ path, text }]
    })
  const baseSet = sourceSet(at(baseInv))
  const headSet = sourceSet(at(headInv))
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
