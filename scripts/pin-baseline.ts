// Pin a Conditional Access baseline into IAMAI's own snapshot (prompt 51 Part 3,
// owner decision 1). Dev-only, the one place that reaches the network: fetch the
// author's repo at a commit, normalise every policy to Graph shape, resolve the
// author's object references to placeholder tokens (baseline-onboarding §2 stage
// 2), strip author-specific app exclusions, and write both
// baselines/<repo>.pinned.json (the snapshot, in our schema) and
// baselines/<repo>.index.json (its source record) at the same commit — one
// generation path, so the two can never name different commits again. The
// runtime reads the snapshot; its only network calls are the author-head check
// and the update review it opens.
//
//   node scripts/pin-baseline.ts <commit> [--from <commit>]
//
// The commit is required and must be a full 40-character sha. This script used
// to default to the author's current head, which made "re-pin" and "adopt
// whatever the author pushed since" the same command: a baseline update is a
// promotion of one reviewed version, and a run that discovers its own target has
// already made the decision the review exists to make.
//
// `--from` is the commit the report's diff is read against; it defaults to the
// pin this repository is on. Name it when the artifacts have already moved and
// the report still has to show the promotion a reviewer is reading.
//
// This is a derived artifact in our schema — not a copy of the author's files —
// which is what the supply-chain rule protects (see CLAUDE.md).
import { writeFileSync, mkdirSync } from 'node:fs'
import { discoverPolicies } from '../src/baseline/discover.ts'
import type { CaPolicy } from '../src/baseline/types.ts'
import type { BaselineFile, LoadReport } from '../src/baseline/types.ts'
import { policyFacts } from '../src/coverage/facts.ts'
import { mapGoalsToPolicies } from '../src/coverage/goalIdentity.ts'
import type { GoalMapResult, PolicyForMap } from '../src/coverage/goalIdentity.ts'
import { pinPolicy } from '../src/baseline/pinSource.ts'
import type { PinnedPolicy } from '../src/baseline/pinSource.ts'
import { pinArtifacts, pinMismatch } from '../src/baseline/pinArtifacts.ts'
import type { PinnedFile } from '../src/baseline/pinArtifacts.ts'
import type { BaselineIndex } from '../src/baseline/github.ts'
import { interpretReferences, readInterpretation, referenceUsage } from '../src/baseline/interpretation.ts'
import type { BaselineInterpretation, Interpreted } from '../src/baseline/interpretation.ts'
import { groupSignatures, ROLE_LABELS } from '../src/baseline/signatures.ts'
import { fileURLToPath } from 'node:url'
import { PINNED } from '../src/baseline/pinned.ts'
import index from '../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import interpretationFile from '../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }

const OWNER = index.owner
const REPO = index.repo
const BASE = 'jhope188-conditionalaccesspolicies'
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMMIT = /^[0-9a-f]{40}$/

/**
 * The one commit this run pins, from the command line and from nowhere else.
 *
 * There is no default. A pin is the promotion of a version somebody reviewed and
 * approved by name, so a run with no argument has nothing to promote — it does
 * not get to ask the author what is newest and adopt that. A short sha is
 * refused too: an abbreviation is not the identity the index record, the
 * attribution and the report all claim to name.
 */
export function targetCommit(argv: readonly string[], fallbackFrom: string): { commit: string; from: string } {
  const args = argv.filter((a) => a.trim() !== '')
  const sha = (raw: string, what: string): string => {
    const v = raw.toLowerCase()
    if (!COMMIT.test(v)) throw new Error(`pin-baseline needs a full 40-character commit sha for ${what}, not "${raw}"`)
    return v
  }
  let from: string | null = null
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') {
      const next = args[i + 1]
      if (next === undefined) throw new Error('pin-baseline: --from needs a commit')
      from = sha(next, '--from')
      i++
      continue
    }
    const eq = args[i].match(/^--from=(.*)$/)
    if (eq) {
      from = sha(eq[1], '--from')
      continue
    }
    rest.push(args[i])
  }
  if (rest.length === 0) throw new Error('pin-baseline needs the commit to pin: node scripts/pin-baseline.ts <40-character sha>')
  if (rest.length > 1) throw new Error(`pin-baseline pins one commit; got ${rest.length}: ${rest.join(' ')}`)
  return { commit: sha(rest[0], 'the commit to pin'), from: from ?? fallbackFrom }
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': 'iamai-pin-baseline', Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return (await res.json()) as T
}

/**
 * The author's tree at a commit, split two ways: the Policies/*.json paths the
 * snapshot is built from, and every .json/README.md path, which is the index
 * record's allowlist (the same rule scripts/build-index.ts walks a clone by).
 */
async function treeAt(commit: string): Promise<{ policyPaths: string[]; indexFiles: string[] }> {
  const tree = await api<{ tree: { path: string; type: string }[] }>(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${commit}?recursive=1`)
  const blobs = tree.tree.filter((t) => t.type === 'blob').map((t) => t.path)
  // The author moved Policies/ under Updated/ between ceccdc2 and head; match a
  // Policies directory at any depth, files directly in it (not Documentation/).
  return {
    policyPaths: blobs.filter((p) => /(^|\/)Policies\/[^/]+\.json$/i.test(p)),
    indexFiles: blobs.filter((p) => /\.json$/i.test(p) || /(^|\/)readme\.md$/i.test(p)).sort(),
  }
}

/**
 * Every path, or an account of what did not come back. A failed fetch used to be
 * dropped on the floor, so one 500 from the raw host produced a baseline missing
 * a policy and a pin that claimed the commit anyway — the snapshot would be
 * short a policy and nothing in the artifacts would say so.
 */
async function fetchFiles(commit: string, paths: string[]): Promise<{ files: BaselineFile[]; failed: { path: string; why: string }[] }> {
  const files: BaselineFile[] = []
  const failed: { path: string; why: string }[] = []
  const q = [...paths]
  const worker = async (): Promise<void> => {
    while (q.length) {
      const path = q.shift()!
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${commit}/${encodeURI(path)}`)
        if (res.ok) files.push({ path, text: await res.text() })
        else failed.push({ path, why: `HTTP ${res.status}` })
      } catch (e) {
        failed.push({ path, why: e instanceof Error ? e.message : String(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return { files, failed }
}

/** What one commit's read of the author's policy files came to. */
export type Acquisition = {
  /** Policy paths the commit's tree listed. */
  requested: readonly string[]
  fetched: number
  parsed: number
  skipped: number
  duplicates: number
  errors: number
  failed: readonly { path: string; why: string }[]
}

/**
 * Why this read of the source may not become a pin, or null when it may.
 *
 * A pin is a claim about one commit *whole*: these are our schema's version of
 * everything the author published there, and the runtime and every later diff
 * read it as complete. So an incomplete or uncertain read is not a smaller pin,
 * it is a wrong one — a policy that failed to fetch reads afterwards as a policy
 * the author removed, and a file that would not parse reads as one they never
 * wrote. Both must stop the run before anything is written.
 *
 * A duplicate is not uncertainty: `discoverPolicies` has stated rules for a
 * second copy of a policy — same id, same display name, an older generation —
 * and each one is a decision it made and reported, not a file it could not read.
 * Duplicates are counted and allowed.
 */
export function acquisitionFailure(a: Acquisition, report: LoadReport): string | null {
  if (a.failed.length > 0) return `${a.failed.length} of ${a.requested.length} source file(s) did not come back: ${a.failed.map((f) => `${f.path} (${f.why})`).join(', ')}`
  if (a.fetched !== a.requested.length) return `the commit's tree lists ${a.requested.length} policy file(s) and ${a.fetched} were read`
  if (report.errors.length > 0) return `${report.errors.length} source file(s) could not be read: ${report.errors.map((e) => `${e.path} (${e.error})`).join(', ')}`
  if (report.skipped.length > 0) return `${report.skipped.length} source file(s) held nothing this reader recognised: ${report.skipped.map((x) => `${x.path} (${x.reason})`).join(', ')}`
  if (report.parsed === 0) return 'no policy was read from the commit at all'
  return null
}

/**
 * The pin's tokens for the author's own objects (§2 stage 2).
 *
 * There are exactly two ways a reference gets one. A settled reading in this
 * baseline's interpretation file assigns a meaning, with the evidence it rests
 * on (src/baseline/interpretation.ts). And an authentication strength id takes
 * `strength` from the field it sits in — `grantControls.authenticationStrength.id`
 * is a strength because Graph's own shape says so, which is the source stating
 * it rather than us reading it.
 *
 * Nothing else. This function used to classify by policy display name over a
 * fall-through, so a group nothing explained became `serviceAccountsGroup` and a
 * policy whose name contained "allowed" made its exclusions `travellersGroup`.
 * Both are gone: a reference no record settles carries no token, is returned in
 * `read.unsettled`, and stays the author's own.
 */
export function placeholdersFor(policies: CaPolicy[], interpretation: BaselineInterpretation): { placeholderFor: Map<string, string>; read: Interpreted } {
  const read = interpretReferences(interpretation, referenceUsage(policies))
  const placeholderFor = new Map(read.tokens)
  for (const p of policies) {
    const id = p.grantControls?.authenticationStrength?.id
    if (typeof id === 'string' && GUID.test(id) && !placeholderFor.has(id.toLowerCase())) placeholderFor.set(id.toLowerCase(), 'strength')
  }
  return { placeholderFor, read }
}

async function snapshotAt(
  commit: string,
  interpretation: BaselineInterpretation,
): Promise<{ policies: PinnedPolicy[]; stripped: string[]; indexFiles: string[]; read: Interpreted; discovered: CaPolicy[]; acquisition: Acquisition }> {
  const tree = await treeAt(commit)
  const { files, failed } = await fetchFiles(commit, tree.policyPaths)
  const found = discoverPolicies(files)
  const report = found.report
  const acquisition: Acquisition = {
    requested: tree.policyPaths,
    fetched: files.length,
    parsed: report.parsed,
    skipped: report.skipped.length,
    duplicates: report.duplicates.length,
    errors: report.errors.length,
    failed,
  }
  process.stdout.write(
    `pin-baseline: ${commit.slice(0, 8)} — ${acquisition.requested.length} listed, ${acquisition.fetched} fetched, ${acquisition.parsed} parsed, ${acquisition.skipped} skipped, ${acquisition.duplicates} duplicate, ${acquisition.errors} error, ${acquisition.failed.length} unread\n`,
  )
  const why = acquisitionFailure(acquisition, report)
  if (why) throw new Error(`refusing to pin ${commit}: the source was not read whole — ${why}`)
  const discovered = found.policies
  const { placeholderFor, read } = placeholdersFor(discovered, interpretation)
  const policies: PinnedPolicy[] = []
  const stripped: string[] = []
  for (const p of discovered) {
    const r = pinPolicy(p, placeholderFor)
    policies.push(r.policy)
    stripped.push(...r.stripped)
  }
  policies.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return { policies, stripped, indexFiles: tree.indexFiles, read, discovered, acquisition }
}

function diff(oldP: PinnedPolicy[], newP: PinnedPolicy[]): { added: string[]; removed: string[]; changed: string[] } {
  // Stable identity, so a renamed policy reads as one change here too, not as an addition and a removal.
  const key = (p: PinnedPolicy): string => (p.id ? p.id.toLowerCase() : p.displayName.toLowerCase().replace(/\s+/g, ' ').trim())
  const oldByKey = new Map(oldP.map((p) => [key(p), p]))
  const newByKey = new Map(newP.map((p) => [key(p), p]))
  const added = newP.filter((p) => !oldByKey.has(key(p))).map((p) => p.displayName)
  const removed = oldP.filter((p) => !newByKey.has(key(p))).map((p) => p.displayName)
  const changed: string[] = []
  for (const [k, np] of newByKey) {
    const op = oldByKey.get(k)
    if (!op) continue
    const fields = ['state', 'conditions', 'grantControls', 'sessionControls'] as const
    const diffs = fields.filter((f) => JSON.stringify((op as Record<string, unknown>)[f]) !== JSON.stringify((np as Record<string, unknown>)[f]))
    if (diffs.length) changed.push(`${np.displayName} (${diffs.join(', ')})`)
  }
  return { added, removed, changed }
}

/**
 * The generation path: one commit's values become both artifacts, through the
 * one builder (src/baseline/pinArtifacts.ts), and a pair that disagrees never
 * leaves this function. Exported so the pin script's own path is what a test
 * exercises, rather than a helper the script does not call.
 */
export function pinGeneration(input: {
  previousIndex: Partial<BaselineIndex>
  owner: string
  repo: string
  label: string
  commit: string
  generatedAt: string
  indexFiles: string[]
  policies: PinnedPolicy[]
  stripped: string[]
  goalMap: Record<string, string[]>
}): { pinned: PinnedFile; index: BaselineIndex } {
  const out = pinArtifacts({ ...input, files: input.indexFiles })
  return checked(out)
}

/** Both artifacts, written together for one commit. Neither file is written unless the pair agrees. */
export function writePin(dir: string, base: string, out: { pinned: PinnedFile; index: BaselineIndex }): string[] {
  checked(out)
  mkdirSync(dir, { recursive: true })
  const paths = [`${dir}/${base}.pinned.json`, `${dir}/${base}.index.json`]
  writeFileSync(paths[0], JSON.stringify(out.pinned, null, 2) + '\n')
  writeFileSync(paths[1], JSON.stringify(out.index, null, 2) + '\n')
  return paths
}

function checked(out: { pinned: PinnedFile; index: BaselineIndex }): { pinned: PinnedFile; index: BaselineIndex } {
  const why = pinMismatch(out.pinned, out.index)
  if (why) throw new Error(`refusing to write a pin whose artifacts disagree: ${why}`)
  return out
}

async function main(): Promise<void> {
  // The commit the shipped snapshot was built from — not index.commit, which
  // recorded an older pin for as long as the two were written apart — unless the
  // run names the commit to read the promotion against.
  const { commit: target, from: oldCommit } = targetCommit(process.argv.slice(2), PINNED.commit)
  process.stdout.write(`pin-baseline: pinning ${OWNER}/${REPO} at ${target}\n`)
  // This baseline's settled readings of the author's own objects, which are the
  // only thing that may give a reference a specialised meaning.
  const interpretation = readInterpretation(interpretationFile)
  const next = await snapshotAt(target, interpretation)
  // A baseline update is a promotion, not a synchronisation. A reference whose
  // role in the author's design moved is a question for a person, so the pin
  // stops rather than carrying the old reading into a package it no longer fits.
  if (next.read.reviewRequired.length > 0) {
    throw new Error(
      `refusing to pin: ${next.read.reviewRequired.length} settled reference(s) need review before this commit can be adopted:\n` +
        next.read.reviewRequired.map((r) => `  ${r.id}: ${r.why}`).join('\n'),
    )
  }
  const generatedAt = new Date().toISOString()

  // Stage 3 (baseline-onboarding, owner resolution): map each goal to the one
  // baseline policy that implements it, by the strict identity rule, and store it.
  // The runtime reads this map; it never matches at render time. Two policies in
  // the author's export carry no id, so the map keys by id when present and by
  // the (unique) display name otherwise — recorded in the report below.
  const forMap: PolicyForMap[] = next.policies.map((p) => ({
    id: p.id ?? p.displayName,
    name: p.displayName,
    facts: policyFacts(p, new Map()),
    placeholders: p.placeholders,
  }))
  const goals: GoalMapResult = mapGoalsToPolicies(forMap)
  // One generation for both artifacts, at one commit: the snapshot the runtime
  // reads and the index record that says where it came from (task 021 §11). The
  // index used to be left behind at the previous pin, so the repository named
  // two commits for one baseline.
  const out = pinGeneration({
    previousIndex: index as Partial<BaselineIndex>,
    owner: OWNER,
    repo: REPO,
    label: index.label,
    commit: target,
    generatedAt,
    indexFiles: next.indexFiles,
    policies: next.policies,
    stripped: next.stripped,
    goalMap: goals.map,
  })
  if (next.read.stale.length > 0) process.stdout.write(`pin-baseline: ${next.read.stale.length} settled reading(s) name a reference this commit no longer has: ${next.read.stale.join(', ')}
`)
  const written = writePin('baselines', BASE, out)
  process.stdout.write(`pin-baseline: wrote ${written.join(' and ')} at ${target} (${next.policies.length} policies, ${next.stripped.length} stripped exclusions, ${out.index.files.length} files recorded)\n`)

  process.stdout.write(`pin-baseline: diffing from ${oldCommit}\n`)
  const prev = await snapshotAt(oldCommit, interpretation)
  const d = diff(prev.policies, next.policies)
  // What a person curating the next update reads: what this baseline's settled
  // readings gave the package, and every reference still left as the author's
  // own — each with the structural nomination `groupSignatures` makes of it,
  // which is a candidate to look into and never a meaning.
  const byRecord = new Map(interpretation.references.map((r) => [r.id, r]))
  const signature = new Map(groupSignatures(next.discovered).map((g) => [g.id, g]))
  const settledLines = [...next.read.tokens.entries()].sort().map(([id, token]) => `- \`${id}\` → **${token}** (${byRecord.get(id)?.basis ?? 'structural'}) — ${byRecord.get(id)?.evidence ?? 'the field it sits in.'}`)
  const usage = new Map(referenceUsage(next.discovered).map((u) => [u.id, u]))
  const where = (id: string): string => {
    const u = usage.get(id)
    return u ? `included by ${u.includedIn.length}, excluded from ${u.excludedFrom.length}` : 'not used'
  }
  const unknownLines = interpretation.references
    .filter((r) => r.meaning === 'unknown' && usage.has(r.id))
    .map((r) => `- \`${r.id}\` (${r.kind}, ${where(r.id)}) — ${r.evidence}`)
  const unsettledLines = next.read.unsettled.map((u) => {
    const sig = signature.get(u.id)
    const nominated = sig ? `${ROLE_LABELS[sig.inferredRole]} (${sig.confidence}) — ${sig.evidence}` : 'no structural nomination'
    return `- \`${u.id}\` (${u.kind}, ${where(u.id)}) — **no record**. Candidate to settle: ${nominated}`
  })
  const md = [
    `# ${OWNER}/${REPO} — pinned at ${target}`,
    ``,
    `Generated ${generatedAt}. Previous pin: ${oldCommit}.`,
    ``,
    `- Policies: ${next.policies.length} (was ${prev.policies.length})`,
    `- Author-specific app exclusions stripped: ${next.stripped.length}`,
    `- Source read: ${next.acquisition.requested.length} policy files listed, ${next.acquisition.fetched} fetched, ${next.acquisition.parsed} parsed, ${next.acquisition.skipped} skipped, ${next.acquisition.duplicates} duplicate, ${next.acquisition.errors} error, ${next.acquisition.failed.length} unread`,
    ``,
    `## Diff from ${oldCommit.slice(0, 7)}`,
    ``,
    `### Added (${d.added.length})`,
    ...d.added.map((x) => `- ${x}`),
    ``,
    `### Removed (${d.removed.length})`,
    ...d.removed.map((x) => `- ${x}`),
    ``,
    `### Changed (${d.changed.length})`,
    ...d.changed.map((x) => `- ${x}`),
    ``,
    `## References (stage 2)`,
    ``,
    `A specialised meaning comes from this baseline's interpretation file and its evidence, never from a policy's name. A reference no record settles carries no token and stays the author's own.`,
    ``,
    `### Settled (${settledLines.length})`,
    ...settledLines,
    ``,
    `### Settled as unknown — looked for, no evidence, left as the author's own (${unknownLines.length})`,
    ...unknownLines,
    ``,
    `### Not settled either way — for review (${unsettledLines.length})`,
    ...unsettledLines,
    ``,
    `## Goal map (stage 3)`,
    ``,
    `Each goal's What to do renders from the one policy named here; the runtime reads this map and never matches at render time.`,
    ``,
    `### Mapped (${Object.keys(goals.map).length})`,
    ...Object.entries(goals.map).map(([g, ids]) => `- ${g} → ${ids.map((id) => forMap.find((p) => p.id === id)?.name ?? id).join(' + ')}`),
    ``,
    `### Ties — mapped to nothing, for the reviewer (${goals.ties.length})`,
    ...goals.ties.map((t) => `- ${t.goalId}: ${t.candidates.join(' | ')}`),
    ``,
    `### Variants — same goal, differ only in an exclusion set (${goals.variants.length})`,
    ...goals.variants.map((v) => `- ${v.policy} — variant of ${v.variantOf}`),
    ``,
    `### Goals not in this baseline (${goals.unmappedGoals.length})`,
    ...goals.unmappedGoals.map((g) => `- ${g}`),
    ``,
    `### Policies not assessed — Cleanup rows (${goals.unmappedPolicies.length})`,
    ...goals.unmappedPolicies.map((n) => `- ${n}`),
    ``,
  ].join('\n')
  mkdirSync(`docs/baselines/${BASE}`, { recursive: true })
  writeFileSync(`docs/baselines/${BASE}/${target}.md`, md)
  process.stdout.write(`pin-baseline: wrote docs/baselines/${BASE}/${target}.md (added ${d.added.length}, removed ${d.removed.length}, changed ${d.changed.length})\n`)
}

// Imported for its generation path in a test; only a direct run pins anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    process.stderr.write(`pin-baseline: ${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(1)
  })
}
