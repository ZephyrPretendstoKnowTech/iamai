// The baseline as the UI holds it (moved out of the Baseline page in prompt 47
// Part 4): the pinned index, loaded at its commit; an uploaded package; and
// the restore of either on reload.
import baselineIndex from '../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { fetchBaselineFiles, loadBaseline } from '../baseline/index.ts'
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

/** Load the bundled, pinned baseline (the default, and the reload restore). */
export async function loadPinnedBaseline(onProgress?: (done: number, total: number) => void): Promise<BaselineResult> {
  const { files, failures } = await fetchBaselineFiles(PINNED_BASELINE, { onProgress })
  return {
    source: PINNED_BASELINE.label,
    pkg: loadBaseline(files),
    fetchFailures: failures.length,
    origin: { kind: 'github', owner: PINNED_BASELINE.owner, repo: PINNED_BASELINE.repo, commit: PINNED_BASELINE.commit, files },
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
