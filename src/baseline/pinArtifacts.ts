// The two files a pin writes, built together (task 021 §11).
//
// A pin used to write `baselines/<repo>.pinned.json` at a new commit and leave
// `baselines/<repo>.index.json` naming the previous one, so the repository
// carried two commits for one baseline and every consumer had to know which was
// the real one. That is a generation defect, not a reading defect: whatever
// writes the pin writes the index record for the same commit, from the same
// values, in one call — and `pinMismatch` refuses to let a caller write a pair
// that disagrees.
//
// `indexRecord` is also the one place the index record's shape and its
// attribution sentence are written, so `scripts/build-index.ts` and
// `scripts/pin-baseline.ts` cannot drift apart.
//
// Pure: no fs, no network, so a pin's output is testable without touching the
// pinned artifacts the product ships.
import type { BaselineIndex } from './github.ts'

/** The pinned snapshot IAMAI ships: policies in our schema at one source commit. */
export type PinnedFile = {
  commit: string
  generatedAt: string
  policies: unknown[]
  stripped: string[]
  goalMap: Record<string, string[]>
}

export type IndexFields = {
  owner: string
  repo: string
  commit: string
  label: string
  generatedAt: string
  files: string[]
}

/** The attribution sentence, which names the commit — so it is rebuilt whenever the commit is. */
export function attributionFor(owner: string, repo: string, commit: string): string {
  return `Policies and documentation © ${owner} (${owner}/${repo}). Fetched live from GitHub at commit ${commit.slice(0, 7)}; not redistributed by IAMAI.`
}

/**
 * One index record. `carry` supplies the descriptive fields an earlier record
 * already holds (author, description, goal, tiers); everything that names the
 * commit is regenerated, never carried.
 */
export function indexRecord(carry: Partial<BaselineIndex>, fields: IndexFields): BaselineIndex {
  const { commit: _c, generatedAt: _g, files: _f, attribution: _a, owner: _o, repo: _r, label: _l, ...rest } = carry
  return {
    ...rest,
    owner: fields.owner,
    repo: fields.repo,
    commit: fields.commit,
    label: fields.label,
    generatedAt: fields.generatedAt,
    files: [...fields.files].sort(),
    attribution: attributionFor(fields.owner, fields.repo, fields.commit),
  }
}

/**
 * The pinned file and its index record for one commit. A caller cannot write one
 * without the other, which is what stops the index going stale again.
 */
export function pinArtifacts(input: {
  previousIndex: Partial<BaselineIndex>
  owner: string
  repo: string
  label: string
  commit: string
  generatedAt: string
  files: string[]
  policies: unknown[]
  stripped: string[]
  goalMap: Record<string, string[]>
}): { pinned: PinnedFile; index: BaselineIndex } {
  const pinned: PinnedFile = {
    commit: input.commit,
    generatedAt: input.generatedAt,
    policies: input.policies,
    stripped: input.stripped,
    goalMap: input.goalMap,
  }
  const index = indexRecord(input.previousIndex, {
    owner: input.owner,
    repo: input.repo,
    commit: input.commit,
    label: input.label,
    generatedAt: input.generatedAt,
    files: input.files,
  })
  return { pinned, index }
}

/** Why a pin and its index disagree, or null when they name the same source at the same commit. A pin is not written while this returns a reason. */
export function pinMismatch(pinned: { commit: string }, index: { owner?: string; repo?: string; commit: string; attribution?: string }): string | null {
  if (pinned.commit !== index.commit) return `the pinned snapshot is at ${pinned.commit} and its index records ${index.commit}`
  if (index.owner && index.repo && index.attribution && index.attribution !== attributionFor(index.owner, index.repo, index.commit)) {
    return `the index attribution names a commit other than ${index.commit.slice(0, 7)}`
  }
  return null
}
