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
//   node scripts/pin-baseline.ts            # re-pin to the author's current head, diff from the old pin
//   node scripts/pin-baseline.ts <commit>   # pin to a specific commit
//
// This is a derived artifact in our schema — not a copy of the author's files —
// which is what the supply-chain rule protects (see CLAUDE.md).
import { writeFileSync, mkdirSync } from 'node:fs'
import { discoverPolicies } from '../src/baseline/discover.ts'
import type { CaPolicy } from '../src/baseline/types.ts'
import type { BaselineFile } from '../src/baseline/types.ts'
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

async function fetchFiles(commit: string, paths: string[]): Promise<BaselineFile[]> {
  const out: BaselineFile[] = []
  const q = [...paths]
  const worker = async (): Promise<void> => {
    while (q.length) {
      const path = q.shift()!
      const res = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${commit}/${encodeURI(path)}`)
      if (res.ok) out.push({ path, text: await res.text() })
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return out
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

async function snapshotAt(commit: string, interpretation: BaselineInterpretation): Promise<{ policies: PinnedPolicy[]; stripped: string[]; indexFiles: string[]; read: Interpreted; discovered: CaPolicy[] }> {
  const tree = await treeAt(commit)
  const files = await fetchFiles(commit, tree.policyPaths)
  const discovered = discoverPolicies(files).policies
  const { placeholderFor, read } = placeholdersFor(discovered, interpretation)
  const policies: PinnedPolicy[] = []
  const stripped: string[] = []
  for (const p of discovered) {
    const r = pinPolicy(p, placeholderFor)
    policies.push(r.policy)
    stripped.push(...r.stripped)
  }
  policies.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return { policies, stripped, indexFiles: tree.indexFiles, read, discovered }
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
  const target = process.argv[2] ?? (await api<{ sha: string }[]>(`https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`))[0].sha
  // The commit the shipped snapshot was built from — not index.commit, which
  // recorded an older pin for as long as the two were written apart.
  const oldCommit = PINNED.commit
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
