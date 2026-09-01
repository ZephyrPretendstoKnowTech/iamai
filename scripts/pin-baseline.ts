// Pin a Conditional Access baseline into IAMAI's own snapshot (prompt 51 Part 3,
// owner decision 1). Dev-only, the one place that reaches the network: fetch the
// author's repo at a commit, normalise every policy to Graph shape, resolve the
// author's object references to placeholder tokens (baseline-onboarding §2 stage
// 2), strip author-specific app exclusions, and write
// baselines/<repo>.pinned.json in our schema. The runtime reads that file; its
// only network call is the author-head check that drives "Baseline updated".
//
//   node scripts/pin-baseline.ts            # re-pin to the author's current head, diff from the old pin
//   node scripts/pin-baseline.ts <commit>   # pin to a specific commit
//
// This is a derived artifact in our schema — not a copy of the author's files —
// which is what the supply-chain rule protects (see CLAUDE.md).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { discoverPolicies } from '../src/baseline/discover.ts'
import type { CaPolicy } from '../src/baseline/types.ts'
import type { BaselineFile } from '../src/baseline/types.ts'
import firstParty from '../data/first-party-apps.json' with { type: 'json' }
import index from '../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }

const OWNER = index.owner
const REPO = index.repo
const BASE = 'jhope188-conditionalaccesspolicies'
const FIRST_PARTY = new Set((firstParty as { apps: { appId: string }[] }).apps.map((a) => a.appId.toLowerCase()))
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': 'iamai-pin-baseline', Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Every Policies/*.json path at a commit, from the git tree. */
async function policyPaths(commit: string): Promise<string[]> {
  const tree = await api<{ tree: { path: string; type: string }[] }>(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${commit}?recursive=1`)
  // The author moved Policies/ under Updated/ between ceccdc2 and head; match a
  // Policies directory at any depth, files directly in it (not Documentation/).
  return tree.tree.filter((t) => t.type === 'blob' && /(^|\/)Policies\/[^/]+\.json$/i.test(t.path)).map((t) => t.path)
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

const s = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

type PinnedPolicy = { id: string | null; displayName: string; state: string | null; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }

/** Classify the author's object GUIDs to placeholder tokens (§2 stage 2), across the policy set. */
function classify(policies: CaPolicy[]): { placeholderFor: Map<string, string>; strengthIds: Set<string> } {
  const excludedCount = new Map<string, number>()
  const strengthIds = new Set<string>()
  for (const p of policies) {
    for (const g of s(p.conditions?.users?.excludeGroups)) if (GUID.test(g)) excludedCount.set(g, (excludedCount.get(g) ?? 0) + 1)
    const st = p.grantControls?.authenticationStrength?.id
    if (typeof st === 'string' && GUID.test(st)) strengthIds.add(st.toLowerCase())
  }
  const placeholderFor = new Map<string, string>()
  // The group excluded from the most policies is the exclusions group (§2 stage 2).
  const topExcluded = [...excludedCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (topExcluded) placeholderFor.set(topExcluded.toLowerCase(), 'exclusionsGroup')
  for (const p of policies) {
    const name = p.displayName.toLowerCase()
    const isAdminPortal = s(p.conditions?.applications?.includeApplications).some((a) => /MicrosoftAdminPortals/i.test(a))
    const isCountries = /countr|geo|location|region/i.test(name)
    for (const g of s(p.conditions?.users?.includeGroups)) if (GUID.test(g) && isAdminPortal) placeholderFor.set(g.toLowerCase(), 'adminsGroup')
    for (const g of s(p.conditions?.users?.excludeGroups)) {
      const k = g.toLowerCase()
      if (placeholderFor.has(k)) continue
      if (isCountries) placeholderFor.set(k, 'travellersGroup')
      else placeholderFor.set(k, 'serviceAccountsGroup')
    }
    for (const l of [...s(p.conditions?.locations?.includeLocations), ...s(p.conditions?.locations?.excludeLocations)]) {
      const k = l.toLowerCase()
      if (!GUID.test(l) || placeholderFor.has(k)) continue
      placeholderFor.set(k, isCountries ? 'allowedCountries' : 'trustedLocation')
    }
  }
  for (const id of strengthIds) placeholderFor.set(id, 'strength')
  return { placeholderFor, strengthIds }
}

function pinPolicy(p: CaPolicy, placeholderFor: Map<string, string>): { policy: PinnedPolicy; stripped: string[] } {
  const placeholders: Record<string, string> = {}
  const note = (id?: string | null): void => {
    if (typeof id === 'string' && placeholderFor.has(id.toLowerCase())) placeholders[id] = placeholderFor.get(id.toLowerCase())!
  }
  const u = p.conditions?.users
  for (const g of [...s(u?.includeGroups), ...s(u?.excludeGroups)]) note(g)
  for (const l of [...s(p.conditions?.locations?.includeLocations), ...s(p.conditions?.locations?.excludeLocations)]) note(l)
  note(p.grantControls?.authenticationStrength?.id)
  // Strip author-specific app exclusions: an excluded application id that is not a
  // Microsoft first-party id is the author's own app (§2 stage 2, validator app-01).
  const stripped: string[] = []
  const exApps = s(p.conditions?.applications?.excludeApplications)
  const keptApps = exApps.filter((a) => {
    const keep = !GUID.test(a) || FIRST_PARTY.has(a.toLowerCase())
    if (!keep) stripped.push(a)
    return keep
  })
  const conditions = JSON.parse(JSON.stringify(p.conditions))
  if (conditions.applications && exApps.length !== keptApps.length) conditions.applications.excludeApplications = keptApps
  return { policy: { id: p.id ?? null, displayName: p.displayName, state: p.state ?? null, conditions, grantControls: p.grantControls ?? null, sessionControls: p.sessionControls ?? null, placeholders }, stripped: stripped.map((a) => `${p.displayName}: ${a}`) }
}

async function snapshotAt(commit: string): Promise<{ policies: PinnedPolicy[]; stripped: string[] }> {
  const files = await fetchFiles(commit, await policyPaths(commit))
  const discovered = discoverPolicies(files).policies
  const { placeholderFor } = classify(discovered)
  const policies: PinnedPolicy[] = []
  const stripped: string[] = []
  for (const p of discovered) {
    const r = pinPolicy(p, placeholderFor)
    policies.push(r.policy)
    stripped.push(...r.stripped)
  }
  policies.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return { policies, stripped }
}

function diff(oldP: PinnedPolicy[], newP: PinnedPolicy[]): { added: string[]; removed: string[]; changed: string[] } {
  const key = (p: PinnedPolicy): string => p.displayName.toLowerCase().replace(/\s+/g, ' ').trim()
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

async function main(): Promise<void> {
  const target = process.argv[2] ?? (await api<{ sha: string }[]>(`https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`))[0].sha
  const oldCommit = index.commit
  process.stdout.write(`pin-baseline: pinning ${OWNER}/${REPO} at ${target}\n`)
  const next = await snapshotAt(target)
  const generatedAt = new Date().toISOString()
  const pinned = { commit: target, generatedAt, policies: next.policies, stripped: next.stripped }
  writeFileSync(`baselines/${BASE}.pinned.json`, JSON.stringify(pinned, null, 2) + '\n')
  process.stdout.write(`pin-baseline: wrote baselines/${BASE}.pinned.json (${next.policies.length} policies, ${next.stripped.length} stripped exclusions)\n`)

  process.stdout.write(`pin-baseline: diffing from ${oldCommit}\n`)
  const prev = await snapshotAt(oldCommit)
  const d = diff(prev.policies, next.policies)
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
  ].join('\n')
  mkdirSync(`docs/baselines/${BASE}`, { recursive: true })
  writeFileSync(`docs/baselines/${BASE}/${target}.md`, md)
  process.stdout.write(`pin-baseline: wrote docs/baselines/${BASE}/${target}.md (added ${d.added.length}, removed ${d.removed.length}, changed ${d.changed.length})\n`)
  void readFileSync
}

main().catch((e) => {
  process.stderr.write(`pin-baseline: ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
