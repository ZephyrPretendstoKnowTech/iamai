// The author's changes to the baseline, read as *policies* rather than as files
// (task 021). GitHub's compare tells us which files moved; it does not tell us
// what changed, and in the author's repository one evolving policy shows up as
// several file events: a copy under Policies/ and another under
// Documentation/, and a rename as one file added and another removed.
//
// So identity here is the source's own stable policy id. Two artifacts with the
// same non-empty id are the same evolving policy however they are spelled or
// filed; the review pairs them, compares their semantics (baseline/semantics.ts)
// and reports one change. A member the source exported with no id keeps the
// conservative fallback task 003 established — its display name — which means a
// renamed id-less policy reads as a removal and an addition, never as a rename
// nobody can prove.
//
// Nothing here guesses: duplicate copies collapse only when they mean the same
// thing, and a field the baseline model does not represent is reported as
// unreviewed rather than passed over.
//
// Pure, so the whole review is testable on fixtures with no network.
import type { CaPolicy } from '../baseline/types.ts'
import type { GoalMap } from '../coverage/goalIdentity.ts'
import { extractPolicies, nameKey, precedenceFor } from '../baseline/discover.ts'
import { normalizePolicy } from '../baseline/normalize.ts'
import { comparePolicies, samePolicySemantics } from '../baseline/semantics.ts'
import type { FieldChange } from '../baseline/semantics.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { stepIdForGoal } from '../roadmap/stepIds.ts'

/** One source file at one commit, as fetched. */
export type SourceArtifact = { path: string; text: string }

/** Which key proves this member is the same member: the source's policy id, or the fallback display name. */
export type MemberIdentity = 'id' | 'name'

/** One source policy at one commit, after every representation of it has been collapsed. */
export type SourceMember = { key: string; identity: MemberIdentity; displayName: string; policy: CaPolicy; paths: string[] }

/** One source policy whose representations at a commit disagree about what it says. */
export type SourceConflict = { key: string; identity: MemberIdentity; displayName: string; paths: string[] }

/** The author's policies at one commit: what was read, what disagreed, and what could not be read. */
export type SourceSet = { members: SourceMember[]; conflicts: SourceConflict[]; unreadable: { path: string; why: string }[] }

type Candidate = { policy: CaPolicy; path: string; precedence: number }

/** The stable identity of a source policy: its id when it has one, else the display name (task 003's fallback). */
export function memberIdentity(p: { id?: string | null; displayName: string }): { key: string; identity: MemberIdentity } {
  const id = typeof p.id === 'string' ? p.id.trim() : ''
  if (id.length > 0) return { key: id.toLowerCase(), identity: 'id' }
  return { key: nameKey(p.displayName), identity: 'name' }
}

/**
 * The author's policies at one commit, from whatever files were fetched.
 *
 * A file that holds no policy object is not a policy artifact and is ignored —
 * documentation, images and READMEs never reach here. A file that holds one but
 * cannot be parsed is `unreadable`, which makes the review incomplete rather
 * than shorter.
 *
 * Representations collapse by stable identity, and only when they agree: the
 * copy under `Updated/Policies/` and the copy under `Updated/Documentation/`
 * are one member when they mean the same thing, and a conflict when they do
 * not. The name shown is the highest-precedence copy's, by the same rule
 * `discoverPolicies` uses to pick between generations.
 */
export function sourceSet(artifacts: readonly SourceArtifact[]): SourceSet {
  const unreadable: { path: string; why: string }[] = []
  const candidates: Candidate[] = []
  for (const a of artifacts) {
    let parsed: unknown
    try {
      parsed = JSON.parse(a.text.replace(/^﻿/, ''))
    } catch (e) {
      unreadable.push({ path: a.path, why: `invalid JSON: ${(e as Error).message}` })
      continue
    }
    for (const raw of extractPolicies(parsed)) {
      try {
        candidates.push({ policy: normalizePolicy(raw), path: a.path, precedence: precedenceFor(a.path) })
      } catch (e) {
        unreadable.push({ path: a.path, why: (e as Error).message })
      }
    }
  }

  const groups = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const { key } = memberIdentity(c.policy)
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }

  const members: SourceMember[] = []
  const conflicts: SourceConflict[] = []
  for (const [key, list] of groups) {
    const ordered = [...list].sort((a, b) => b.precedence - a.precedence || a.path.localeCompare(b.path))
    const win = ordered[0]
    const { identity } = memberIdentity(win.policy)
    const paths = ordered.map((c) => c.path).sort()
    if (ordered.every((c) => samePolicySemantics(c.policy, win.policy))) {
      members.push({ key, identity, displayName: win.policy.displayName, policy: win.policy, paths })
    } else {
      conflicts.push({ key, identity, displayName: win.policy.displayName, paths })
    }
  }
  members.sort((a, b) => a.displayName.localeCompare(b.displayName))
  conflicts.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return { members, conflicts, unreadable }
}

/** One material difference, as much of it as the model can word. `field` is the model's field name. */
export type SemanticDelta =
  | { field: string; kind: 'added'; n: number }
  | { field: string; kind: 'removed'; n: number }
  | { field: string; kind: 'both'; added: number; removed: number }
  | { field: string; kind: 'set'; value: string }
  | { field: string; kind: 'cleared' }
  | { field: string; kind: 'changed' }

/**
 * What happened to one evolving source policy. `unknown` is not a shrug: it is
 * the review saying it could not establish the change — either the commit holds
 * two representations that disagree, or a differing field the baseline model
 * does not represent.
 */
export type ChangeKind = 'added' | 'removed' | 'renamed' | 'changed' | 'renamedChanged' | 'unknown'

export type PolicyChange = {
  key: string
  identity: MemberIdentity
  kind: ChangeKind
  /** True when the display name moved, whatever else did — a rename never hides behind another word. */
  renamed: boolean
  oldName: string | null
  newName: string | null
  deltas: SemanticDelta[]
  /** Differing paths the baseline model does not represent. Non-empty means `kind` is `unknown`. */
  unreviewed: string[]
  reason: 'conflictingCopies' | 'unmodelledField' | null
}

function rawAt(p: CaPolicy, path: string): unknown {
  let cur: unknown = p
  for (const seg of path.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/** The new value as the author writes it: a token, or the name of the thing it points at (an authentication strength). */
function displayValue(path: string, head: CaPolicy): string | null {
  const v = rawAt(head, path)
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    for (const k of ['displayName', 'id']) if (typeof o[k] === 'string' && (o[k] as string).trim().length > 0) return (o[k] as string).trim()
  }
  return null
}

function deltaFor(c: FieldChange, head: CaPolicy): SemanticDelta {
  const field = c.field
  if (Array.isArray(c.base) || Array.isArray(c.head)) {
    const before = new Set((Array.isArray(c.base) ? c.base : []).map((x) => JSON.stringify(x)))
    const after = new Set((Array.isArray(c.head) ? c.head : []).map((x) => JSON.stringify(x)))
    const added = [...after].filter((x) => !before.has(x)).length
    const removed = [...before].filter((x) => !after.has(x)).length
    if (added > 0 && removed > 0) return { field, kind: 'both', added, removed }
    if (added > 0) return { field, kind: 'added', n: added }
    if (removed > 0) return { field, kind: 'removed', n: removed }
    return { field, kind: 'changed' }
  }
  if (c.head === undefined) return { field, kind: 'cleared' }
  const value = displayValue(c.path, head)
  return value === null ? { field, kind: 'changed' } : { field, kind: 'set', value }
}

/**
 * The author's policy changes between two commits, one row per evolving policy.
 *
 * Four file events for one renamed policy are one change here, because the id
 * they all carry is the same. Different non-empty ids are never paired, however
 * alike the names look.
 */
export function policyChanges(base: SourceSet, head: SourceSet): PolicyChange[] {
  const conflicted = new Map<string, SourceConflict>()
  for (const c of [...base.conflicts, ...head.conflicts]) conflicted.set(c.key, c)
  const before = new Map(base.members.map((m) => [m.key, m]))
  const after = new Map(head.members.map((m) => [m.key, m]))

  const out: PolicyChange[] = []
  for (const key of new Set([...before.keys(), ...after.keys(), ...conflicted.keys()])) {
    const bm = before.get(key) ?? null
    const hm = after.get(key) ?? null
    const clash = conflicted.get(key) ?? null
    const identity = (bm ?? hm ?? clash)!.identity
    const oldName = bm?.displayName ?? null
    const newName = hm?.displayName ?? null
    const renamed = Boolean(oldName && newName && nameKey(oldName) !== nameKey(newName))

    if (clash) {
      out.push({ key, identity, kind: 'unknown', renamed, oldName, newName: newName ?? clash.displayName, deltas: [], unreviewed: [], reason: 'conflictingCopies' })
      continue
    }
    if (!bm && hm) {
      out.push({ key, identity, kind: 'added', renamed: false, oldName: null, newName: hm.displayName, deltas: [], unreviewed: [], reason: null })
      continue
    }
    if (bm && !hm) {
      out.push({ key, identity, kind: 'removed', renamed: false, oldName: bm.displayName, newName: null, deltas: [], unreviewed: [], reason: null })
      continue
    }
    const cmp = comparePolicies(bm!.policy, hm!.policy)
    const deltas = cmp.changed.map((c) => deltaFor(c, hm!.policy))
    if (cmp.unreviewed.length > 0) {
      out.push({ key, identity, kind: 'unknown', renamed, oldName, newName, deltas, unreviewed: cmp.unreviewed, reason: 'unmodelledField' })
      continue
    }
    if (!renamed && deltas.length === 0) continue
    const kind: ChangeKind = renamed && deltas.length > 0 ? 'renamedChanged' : renamed ? 'renamed' : 'changed'
    out.push({ key, identity, kind, renamed, oldName, newName, deltas, unreviewed: [], reason: null })
  }
  out.sort((a, b) => (a.newName ?? a.oldName ?? '').localeCompare(b.newName ?? b.oldName ?? '') || a.key.localeCompare(b.key))
  return out
}

/**
 * The plan steps a changed source policy stands behind, from the baseline's goal
 * map, in the map's order.
 *
 * The map keys by the same stable identity this review pairs on, so a rename
 * does not lose the step: the id is what the map holds. A member that has only
 * the fallback name identity is looked up by name, and by both names when it
 * was renamed — but a renamed id-less policy never reaches here as one change,
 * so that is the add and the remove each finding whatever the map still holds.
 */
export function stepsForChange(change: Pick<PolicyChange, 'identity' | 'key' | 'oldName' | 'newName'>, goalMap: GoalMap): string[] {
  const candidates = change.identity === 'id' ? [change.key] : [change.newName, change.oldName].filter((n): n is string => typeof n === 'string')
  const want = new Set(candidates.map(nameKey))
  const titles: string[] = []
  for (const [goalId, mapped] of Object.entries(goalMap)) {
    if (!(mapped ?? []).some((k) => want.has(nameKey(k)))) continue
    const title = contentStepFor({ id: stepIdForGoal(goalId), goalId })?.title ?? null
    if (title && !titles.includes(title)) titles.push(title)
  }
  return titles
}
