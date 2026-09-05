// Foundation C: the safety-sensitive decision primitive.
//
// Most of the objects a plan names are ordinary. Getting a display name or a
// time zone wrong is untidy. Others decide who a policy reaches — the group
// every policy excludes, the accounts that are the way back in, the network a
// policy calls trusted. Naming the wrong object there does not make the plan
// untidy: it writes a carve-out for the wrong people into a policy the operator
// then deploys, and nobody finds out until the day it matters.
//
// Four facts, and this module exists to stop any of them standing in for
// another:
//
//   detected    — what the tenant's own evidence currently shows.
//   recommended — what IAMAI would put forward, given evidence complete enough
//                 to put anything forward at all.
//   confirmed   — what the operator explicitly chose. Storage keeps this, and
//                 nothing but an operator's confirmation writes it.
//   actionable  — the operator's choice AND an object this scan read for itself.
//                 The only id anything downstream may put in a policy.
//
// Two of the distinctions are easy to lose, so they are written out here:
//
// A stored confirmation is not current actionability. The operator's answer
// survives a scan that cannot verify it — it is their decision, not IAMAI's
// reading — but it stops being usable until a scan reads the object again. It
// becomes usable again by itself, the moment one does; nobody is asked to
// choose again because a request failed once.
//
// An empty candidate list is not proof that nothing qualifies. It is that only
// where the evidence the detection needs was complete. Where it was not, IAMAI
// says it could not tell, offers no recommendation, and above all does not
// conclude that the tenant should create a second group.
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { GroupRead, MemberEvidence, ObjectPresence } from '../graph/collect/presence.ts'
import type { MappingRecord, MappingState } from './types.ts'

export type { ObjectPresence, MemberEvidence } from '../graph/collect/presence.ts'

/** The safety-sensitive roles. Only the exclusions group is migrated; the primitive is the type's owner, not this role. */
export type SafetyRole = 'exclusionsGroup'

/**
 * Whether the detection behind `candidates` had the evidence it needs. Only
 * `complete` lets an empty list mean "nothing qualifies".
 */
export type DetectionEvidence = 'complete' | 'incomplete'

export type SafetyStatus =
  /** The operator chose it and this scan read the object: actionable. */
  | 'confirmed'
  /** The operator chose it and this scan could not establish whether it exists. */
  | 'unverified'
  /** The operator chose it and this scan proved it is gone. */
  | 'invalidated'
  /** Nobody has chosen; complete evidence, exactly one verified candidate. */
  | 'recommended'
  /** Nobody has chosen; more than one verified candidate. IAMAI does not pick. */
  | 'ambiguous'
  /** Nobody has chosen; complete evidence, nothing qualifies. The tenant creates one. */
  | 'none-found'
  /** Nobody has chosen and the evidence cannot say whether anything qualifies. */
  | 'undetermined'

/** One object that plausibly serves the role, with what makes it plausible. */
export type SafetyCandidate = {
  id: string
  name: string
  /** How many members this scan read; null where it did not read them. */
  memberCount: number | null
  /** How many of the tenant's policies already exclude it. */
  excludedFrom: number | null
}

export type SafetyChoice = {
  role: SafetyRole
  status: SafetyStatus
  /** What the operator chose, as storage holds it — kept whatever this scan can verify. */
  storedId: string | null
  storedName: string | null
  /** What this scan established about `storedId`; null when nobody has chosen. */
  presence: ObjectPresence | null
  /**
   * The only id anything downstream may act on. Non-null exactly when
   * `status === 'confirmed'`: an operator's answer this scan verified.
   */
  actionableId: string | null
  actionableName: string | null
  /** What IAMAI would put forward. Never authoritative, and never a substitute for a stored choice. */
  recommended: SafetyCandidate | null
  /** Every object that plausibly serves the role, best first. Verified candidates only. */
  candidates: SafetyCandidate[]
  /** Whether the detection behind `candidates` was complete enough to conclude from. */
  evidence: DetectionEvidence
  /** True wherever nothing may act on the choice yet. */
  unresolved: boolean
}

export type SafetyChoiceInput = {
  role: SafetyRole
  /** The operator's own answer, as storage holds it; null when nobody has answered. */
  stored: { id: string; name: string | null } | null
  /** What this scan established about that answer's object. Ignored when nobody has answered. */
  presence: ObjectPresence
  /** The objects this scan verified as plausible for the role. */
  candidates: SafetyCandidate[]
  /** Whether the detection had the evidence it needed. */
  evidence: DetectionEvidence
}

/**
 * The primitive. Every safety-sensitive role resolves through here, so the rule
 * that neither a detection nor a stale record can become a usable id is written
 * once.
 */
export function resolveSafetyChoice(input: SafetyChoiceInput): SafetyChoice {
  const base = { role: input.role, candidates: input.candidates, evidence: input.evidence }
  if (input.stored !== null) {
    // The operator's answer is theirs. It stays in every branch below; what
    // changes is whether IAMAI may act on it today. And in no branch is it
    // replaced by whatever IAMAI would recommend instead — a recommendation
    // answers a question nobody asked here.
    const stored = { storedId: input.stored.id, storedName: input.stored.name, recommended: null, presence: input.presence }
    if (input.presence === 'present') {
      return { ...base, ...stored, status: 'confirmed', actionableId: input.stored.id, actionableName: input.stored.name, unresolved: false }
    }
    // Gone, and said so by Graph itself: the operator is told it is gone.
    // Not established: the operator is told exactly that, and not that it was
    // deleted. Neither is usable, and both come back on their own.
    return { ...base, ...stored, status: input.presence === 'absent' ? 'invalidated' : 'unverified', actionableId: null, actionableName: null, unresolved: true }
  }
  const nobody = { storedId: null, storedName: null, presence: null, actionableId: null, actionableName: null, unresolved: true }
  // Evidence IAMAI could not complete says nothing about what exists. More than
  // one verified candidate is still more than one however incomplete the rest
  // of the reading was, so that much can be said; a single candidate cannot be
  // called the only one, and an empty list cannot be called none.
  if (input.evidence === 'incomplete') {
    return { ...base, ...nobody, status: input.candidates.length > 1 ? 'ambiguous' : 'undetermined', recommended: null }
  }
  // More than one plausible object is not a close call to be settled by a sort
  // order: it is a question, and the operator answers it.
  const status: SafetyStatus = input.candidates.length === 0 ? 'none-found' : input.candidates.length === 1 ? 'recommended' : 'ambiguous'
  return { ...base, ...nobody, status, recommended: status === 'recommended' ? input.candidates[0] : null }
}

// ---- What a scan read of the directory ----

/** One directory object as this scan read it, reduced to what a choice needs. */
export type ObjectEvidence = {
  presence: ObjectPresence
  members: MemberEvidence
  displayName: string | null
  memberIds: readonly string[]
  memberCount: number | null
}

/**
 * The scan's own readings, keyed by lowercased object id. An id this holds no
 * entry for is `unknown` — never `absent`: a caller that did not look proves
 * nothing about what is there.
 */
export type DirectoryEvidence = { groups: ReadonlyMap<string, ObjectEvidence> }

/** The read boundary's results as evidence (graph/collect/onDemand.ts readGroup). */
export function directoryEvidenceOf(reads: readonly GroupRead[]): DirectoryEvidence {
  const groups = new Map<string, ObjectEvidence>()
  for (const r of reads) {
    groups.set(r.groupId.toLowerCase(), {
      presence: r.presence,
      members: r.members,
      displayName: r.object?.displayName ?? null,
      memberIds: r.memberIds,
      memberCount: r.memberCount,
    })
  }
  return { groups }
}

/**
 * The evidence a caller holding only loaded memberships can offer: every group
 * whose members it has is one it read. It says nothing about the groups it does
 * not hold, which therefore stay unknown — the loaded map is a record of
 * successes, and a missing entry is a failure whose kind it does not record.
 */
export function directoryEvidenceFromGroups(groups: GroupMembers | null | undefined): DirectoryEvidence {
  const out = new Map<string, ObjectEvidence>()
  for (const [id, g] of groups ?? []) {
    out.set(id.toLowerCase(), {
      presence: 'present',
      members: g.sampled ? 'sampled' : 'complete',
      displayName: g.displayName ?? null,
      memberIds: g.memberIds,
      memberCount: g.memberCount,
    })
  }
  return { groups: out }
}

// ---- The exclusions group ----

/**
 * The mapping key the exclusions group's answer is stored under. The literal
 * lives here and nowhere else: every other module names this constant or one of
 * the functions below, so no reader can reach past the choice to the record.
 */
export const EXCLUSIONS_RECORD_KEY = '__globalExclusion'

const lc = (s: string): string => s.toLowerCase()

/**
 * The operator's stored answer, without checking it against anything. Only two
 * callers may want this: the one deciding which objects the next scan should
 * read, and the picker showing the operator their own answer back. Never the
 * one deciding what a policy says — that is `actionableExclusionsGroupId`.
 */
export function storedExclusionsGroupId(mapping: Pick<MappingState, 'records'>): string | null {
  return mapping.records?.[EXCLUSIONS_RECORD_KEY]?.resolvedId ?? null
}

/** The record an operator's confirmation writes. A null id clears their answer. */
export function exclusionsGroupRecord(prev: MappingRecord | undefined, id: string | null): MappingRecord {
  const before: MappingRecord = prev ?? {
    placeholder: EXCLUSIONS_RECORD_KEY,
    kind: 'group',
    group: 'globalExclusion',
    resolvedId: null,
    resolvedName: null,
    provenance: 'confirmed',
    doesNotExist: true,
    validation: null,
  }
  return {
    ...before,
    placeholder: EXCLUSIONS_RECORD_KEY,
    resolvedId: id,
    resolvedName: id === before.resolvedId ? before.resolvedName : null,
    provenance: 'confirmed',
    doesNotExist: id === null,
    validation: null,
  }
}

export type ExclusionsContext = {
  snapshot: Pick<TenantSnapshot, 'config'>
  mapping: Pick<MappingState, 'records' | 'breakGlassUserIds'>
  /** The memberships the scan loaded, for names and counts. */
  groups?: GroupMembers | null
  /**
   * What the scan's own directory reads established. Where a caller has this,
   * an object Graph said is gone is `absent` and one a request failed on is
   * `unknown`; where it does not, everything it did not load is `unknown`.
   */
  directory?: DirectoryEvidence | null
}

type PolicyUsers = { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }

function policiesOf(ctx: ExclusionsContext): PolicyUsers[] {
  return (ctx.snapshot.config.caPolicies?.rows ?? []) as PolicyUsers[]
}

/** Every group id the tenant's own policies name: the universe this role is detected over. */
function policyGroupIds(ctx: ExclusionsContext): Set<string> {
  const out = new Set<string>()
  for (const p of policiesOf(ctx)) {
    for (const g of p.conditions?.users?.includeGroups ?? []) out.add(lc(g))
    for (const g of p.conditions?.users?.excludeGroups ?? []) out.add(lc(g))
  }
  return out
}

function evidenceOf(ctx: ExclusionsContext): DirectoryEvidence {
  return ctx.directory ?? directoryEvidenceFromGroups(ctx.groups)
}

/**
 * What this scan established about one group. A policy naming the group is not
 * an answer: a Conditional Access policy goes on holding a group id after the
 * group is deleted, so the reference proves that somebody once excluded it and
 * nothing at all about whether it is there now. Only the directory read
 * answers, and where there was none the answer is `unknown`.
 */
export function groupPresence(ctx: ExclusionsContext, id: string): ObjectPresence {
  return groupEvidence(ctx, id)?.presence ?? 'unknown'
}

/** Everything this scan read of one group, or null where it read nothing. */
export function groupEvidence(ctx: ExclusionsContext, id: string): ObjectEvidence | null {
  return evidenceOf(ctx).groups.get(lc(id)) ?? null
}

/**
 * Whether the detection could conclude. Two things have to hold, because the
 * candidate rules read both:
 *
 *  * the tenant's Conditional Access policies were read (the signature rule
 *    reads what the policies do with each group);
 *  * every group those policies name answered determinately — read, or proved
 *    gone. A group whose object could not be read might be the exclusions
 *    group, so a scan that could not read one cannot say none qualifies.
 *
 * A group whose membership could not be enumerated leaves the second rule
 * (a group holding only the emergency accounts) unanswerable, so that is
 * incomplete too. A *sampled* membership is not: sampling starts above twenty
 * thousand members, and a group that large is not a handful of emergency
 * accounts.
 */
export function exclusionsDetectionEvidence(ctx: ExclusionsContext): DetectionEvidence {
  if ((ctx.snapshot.config.caPolicies?.status ?? 'error') !== 'ok') return 'incomplete'
  const ev = evidenceOf(ctx).groups
  for (const id of policyGroupIds(ctx)) {
    const e = ev.get(id)
    if (!e) return 'incomplete'
    if (e.presence === 'absent') continue
    if (e.presence !== 'present') return 'incomplete'
    if (e.members === 'unknown') return 'incomplete'
  }
  return 'complete'
}

/**
 * The groups that plausibly are the one every policy excludes. Two readings,
 * and both are about what the tenant's own policies and groups do, never about
 * what a group is called:
 *
 *  * the signature the adapter already infers from the policies
 *    (`groupSignatures`, the one source of that reading): excluded from most
 *    user-targeting policies and included by none;
 *  * a group whose every member is an emergency-access account.
 *
 * A name that reads like an exclusions group is a nomination for the picker
 * (wizard.ts suggestGroups), never a candidate for the role: "CA-Exclusions" is
 * what somebody typed, not what the tenant does with it.
 *
 * Every candidate has to be an object this scan read. A group id a policy still
 * names, whose object IAMAI could not read, is evidence that somebody excluded
 * something — not a group to recommend.
 */
export function exclusionsGroupCandidates(ctx: ExclusionsContext): SafetyCandidate[] {
  const policies = policiesOf(ctx)
  const ev = evidenceOf(ctx).groups
  const excludedFrom = (id: string): number => policies.filter((p) => (p.conditions?.users?.excludeGroups ?? []).some((g) => lc(g) === id)).length
  const bg = new Set(ctx.mapping.breakGlassUserIds.map(lc))
  const ids = new Set<string>()
  for (const s of groupSignatures(policies as unknown as CaPolicy[])) {
    if (s.inferredRole === 'globalExclusion' || s.inferredRole === 'broadExclusion') ids.add(lc(s.id))
  }
  if (bg.size > 0) {
    for (const [id, e] of ev) {
      if (e.members !== 'complete' || e.memberIds.length === 0) continue
      if (e.memberIds.every((m) => bg.has(lc(m)))) ids.add(id)
    }
  }
  const out: SafetyCandidate[] = []
  for (const id of ids) {
    const e = ev.get(id)
    // Verified only: presence comes from a directory read, never from the
    // policy that named the id.
    if (e?.presence !== 'present') continue
    const actual = [...(ctx.groups ?? [])].find(([g]) => lc(g) === id)?.[0] ?? id
    out.push({ id: actual, name: e.displayName ?? actual, memberCount: e.memberCount, excludedFrom: excludedFrom(id) })
  }
  return out.sort((a, b) => (b.excludedFrom ?? 0) - (a.excludedFrom ?? 0) || a.name.localeCompare(b.name))
}

/** The exclusions group as a safety-sensitive choice: the one authority on which group the plan may name. */
export function exclusionsGroupChoice(ctx: ExclusionsContext): SafetyChoice {
  const record = ctx.mapping.records?.[EXCLUSIONS_RECORD_KEY] ?? null
  const id = record?.resolvedId ?? null
  const read = id === null ? null : (evidenceOf(ctx).groups.get(lc(id)) ?? null)
  return resolveSafetyChoice({
    role: 'exclusionsGroup',
    stored: id === null ? null : { id, name: read?.displayName ?? record?.resolvedName ?? null },
    presence: id === null ? 'unknown' : (read?.presence ?? 'unknown'),
    candidates: exclusionsGroupCandidates(ctx),
    evidence: exclusionsDetectionEvidence(ctx),
  })
}

/**
 * The group id the plan may write into a policy operation: the operator's own
 * answer, verified in this scan, or nothing. Every policy consumer asks this.
 */
export function actionableExclusionsGroupId(ctx: ExclusionsContext): string | null {
  return exclusionsGroupChoice(ctx).actionableId
}
