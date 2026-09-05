// Foundation C: the safety-sensitive decision primitive.
//
// Some of the objects a plan names are ordinary: a display name, a time zone, a
// list of countries. Getting one wrong is untidy. Others decide who a policy
// reaches — the group every policy excludes, the accounts that are the way back
// in, the network a policy calls trusted. Naming the wrong object there does not
// make the plan untidy; it writes a carve-out for the wrong people into a policy
// the operator then deploys, and nobody finds out until the day it matters.
//
// IAMAI can often see which object it probably is. That is a recommendation. It
// is not an answer, and this module is the place that refuses to let the two
// become the same thing. A safety-sensitive choice is in exactly one of five
// states:
//
//   confirmed   — an operator said so, and the object is still there. The only
//                 state with an id anything downstream may act on.
//   recommended — IAMAI has exactly one candidate it would put forward, and is
//                 putting it forward. Nothing in the plan uses it.
//   ambiguous   — more than one object plausibly serves the role. IAMAI does not
//                 choose between them, and offers no recommendation at all.
//   none-found  — nothing in the tenant serves the role. The plan creates one.
//   invalidated — an operator confirmed an object the scan can no longer read.
//                 The choice becomes unresolved; it is never silently replaced
//                 by whatever IAMAI would recommend today, and the operator's
//                 answer is left in storage so it comes back the moment the
//                 object does.
//
// `confirmedId` is null in every state but the first. That is the whole
// contract: one field, and a detection cannot write it.
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { MappingRecord, MappingState } from './types.ts'

/** The safety-sensitive roles. Only the exclusions group is migrated; the type is the primitive's, not this role's. */
export type SafetyRole = 'exclusionsGroup'

export type SafetyStatus = 'confirmed' | 'recommended' | 'ambiguous' | 'none-found' | 'invalidated'

/** One object that plausibly serves the role, with what makes it plausible. */
export type SafetyCandidate = {
  id: string
  name: string
  /** How many members the scan read, or null where it has not read them. */
  memberCount: number | null
  /** How many of the tenant's policies already exclude it, for the exclusions role. */
  excludedFrom: number | null
}

/**
 * Whether an id still names something the scan can see. `unknown` is not
 * `absent`: a confirmed choice is never invalidated because a caller had
 * nothing to check it against.
 */
export type Presence = 'present' | 'absent' | 'unknown'

export type SafetyChoice = {
  role: SafetyRole
  status: SafetyStatus
  /** The only id anything downstream may act on; null unless `status` is `confirmed`. */
  confirmedId: string | null
  confirmedName: string | null
  /** What IAMAI would put forward, when it has exactly one. Never authoritative. */
  recommended: SafetyCandidate | null
  /** Every object that plausibly serves the role, best first. */
  candidates: SafetyCandidate[]
  /** The id an operator confirmed that the scan can no longer read. */
  invalidatedId: string | null
  /** True wherever nothing may act on the choice yet. */
  unresolved: boolean
}

export type SafetyChoiceInput = {
  role: SafetyRole
  /** The operator's own answer, as storage holds it; null when nobody has answered. */
  confirmed: { id: string; name: string | null } | null
  /** Whether that answer is still readable in the tenant. */
  presence: Presence
  /** Every object the scan nominates for the role, best first. */
  candidates: SafetyCandidate[]
}

/**
 * The primitive. Every safety-sensitive role resolves through here, so the rule
 * that a detection cannot become an answer is written once.
 */
export function resolveSafetyChoice(input: SafetyChoiceInput): SafetyChoice {
  const base = { role: input.role, candidates: input.candidates }
  if (input.confirmed !== null) {
    if (input.presence === 'absent') {
      // Unresolved, not replaced: the operator chose an object, and the answer
      // to "it is gone" is to say so, never to quietly choose a different one.
      return { ...base, status: 'invalidated', confirmedId: null, confirmedName: null, recommended: null, invalidatedId: input.confirmed.id, unresolved: true }
    }
    return { ...base, status: 'confirmed', confirmedId: input.confirmed.id, confirmedName: input.confirmed.name, recommended: null, invalidatedId: null, unresolved: false }
  }
  // More than one plausible object is not a close call to be settled by a sort
  // order: it is a question, and the operator answers it.
  const status: SafetyStatus = input.candidates.length === 0 ? 'none-found' : input.candidates.length === 1 ? 'recommended' : 'ambiguous'
  return {
    ...base,
    status,
    confirmedId: null,
    confirmedName: null,
    recommended: status === 'recommended' ? input.candidates[0] : null,
    invalidatedId: null,
    unresolved: true,
  }
}

// ---- The exclusions group ----

/**
 * The mapping key the exclusions group's answer is stored under. The literal
 * lives here and nowhere else: every other module names this constant or one of
 * the functions below, so a reader cannot reach past the choice to the record.
 */
export const EXCLUSIONS_RECORD_KEY = '__globalExclusion'

const lc = (s: string): string => s.toLowerCase()

/**
 * The operator's stored answer for the exclusions group, without checking it
 * against the tenant. Only for deciding what the scan needs to read next
 * (planData loads the group's members so the choice can be resolved at all);
 * never for deciding what a policy says.
 */
export function operatorExclusionsGroupId(mapping: Pick<MappingState, 'records'>): string | null {
  return mapping.records?.[EXCLUSIONS_RECORD_KEY]?.resolvedId ?? null
}

/** The record an operator's confirmation writes. A null id clears the answer. */
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
  return { ...before, placeholder: EXCLUSIONS_RECORD_KEY, resolvedId: id, resolvedName: id === before.resolvedId ? before.resolvedName : null, provenance: 'confirmed', doesNotExist: id === null, validation: null }
}

/** The records with no exclusions-group answer at all: what a detection leaves behind. */
export function withoutExclusionsGroupAnswer(records: Record<string, MappingRecord>): Record<string, MappingRecord> {
  const out = { ...records }
  delete out[EXCLUSIONS_RECORD_KEY]
  return out
}

export type ExclusionsGroupContext = {
  snapshot: Pick<TenantSnapshot, 'config'>
  mapping: Pick<MappingState, 'records' | 'breakGlassUserIds'>
  /** The groups the scan read: their names, member counts and members. Absent means it has read none. */
  groups?: GroupMembers | null
}

type PolicyUsers = { state?: string; conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }

function policiesOf(ctx: ExclusionsGroupContext): PolicyUsers[] {
  return (ctx.snapshot.config.caPolicies?.rows ?? []) as PolicyUsers[]
}

/** Every group id the scan has any reading of: one it loaded, or one a policy names. */
function knownGroupIds(ctx: ExclusionsGroupContext): Set<string> {
  const out = new Set<string>()
  for (const [id] of ctx.groups ?? []) out.add(lc(id))
  for (const p of policiesOf(ctx)) {
    for (const g of p.conditions?.users?.includeGroups ?? []) out.add(lc(g))
    for (const g of p.conditions?.users?.excludeGroups ?? []) out.add(lc(g))
  }
  return out
}

/**
 * Whether the confirmed group is still readable. A scan that read no groups and
 * holds no policies has nothing to say, and says `unknown` rather than dropping
 * somebody's answer on the strength of having looked nowhere.
 */
export function exclusionsGroupPresence(ctx: ExclusionsGroupContext, id: string): Presence {
  const known = knownGroupIds(ctx)
  if (known.size === 0) return 'unknown'
  return known.has(lc(id)) ? 'present' : 'absent'
}

/**
 * The groups that plausibly are the one every policy excludes. Two readings, and
 * both are about what the tenant's own policies and groups do, never about what
 * a group is called:
 *
 *  * the signature the adapter already infers from the policies (`groupSignatures`,
 *    the one source of that reading): excluded from most user-targeting policies
 *    and included by none;
 *  * a group whose every member is an emergency-access account.
 *
 * A name that reads like an exclusions group is a nomination for the picker
 * (wizard.ts suggestGroups), never a candidate for the role: "CA-Exclusions" is
 * what somebody typed, not what the tenant does with it.
 *
 * The list is what the operator is asked about. Its length is the answer to a
 * different question — whether IAMAI may recommend at all — and one is the only
 * length that lets it.
 */
export function exclusionsGroupCandidates(ctx: ExclusionsGroupContext): SafetyCandidate[] {
  const policies = policiesOf(ctx)
  const excludedFrom = (id: string): number => policies.filter((p) => (p.conditions?.users?.excludeGroups ?? []).some((g) => lc(g) === lc(id))).length
  const bg = new Set(ctx.mapping.breakGlassUserIds.map(lc))
  const ids = new Set<string>()
  for (const s of groupSignatures(policies as unknown as CaPolicy[])) {
    if (s.inferredRole === 'globalExclusion' || s.inferredRole === 'broadExclusion') ids.add(lc(s.id))
  }
  if (bg.size > 0) {
    for (const [id, g] of ctx.groups ?? []) {
      if (g.sampled || g.memberIds.length === 0) continue
      if (g.memberIds.every((m) => bg.has(lc(m)))) ids.add(lc(id))
    }
  }
  const out: SafetyCandidate[] = []
  for (const key of ids) {
    // The id as the tenant writes it, not as this walk lower-cased it.
    const actual = [...(ctx.groups ?? [])].find(([g]) => lc(g) === key)?.[0] ?? key
    const g = ctx.groups?.get(actual) ?? null
    out.push({ id: actual, name: g?.displayName ?? actual, memberCount: g?.memberCount ?? null, excludedFrom: excludedFrom(key) })
  }
  return out.sort((a, b) => (b.excludedFrom ?? 0) - (a.excludedFrom ?? 0) || a.name.localeCompare(b.name))
}

/** The exclusions group as a safety-sensitive choice: the one authority on which group the plan may name. */
export function exclusionsGroupChoice(ctx: ExclusionsGroupContext): SafetyChoice {
  const record = ctx.mapping.records?.[EXCLUSIONS_RECORD_KEY] ?? null
  const id = record?.resolvedId ?? null
  const loadedName = id === null ? null : ([...(ctx.groups ?? [])].find(([g]) => lc(g) === lc(id))?.[1]?.displayName ?? null)
  return resolveSafetyChoice({
    role: 'exclusionsGroup',
    confirmed: id === null ? null : { id, name: loadedName ?? record?.resolvedName ?? null },
    presence: id === null ? 'unknown' : exclusionsGroupPresence(ctx, id),
    candidates: exclusionsGroupCandidates(ctx),
  })
}

/** The group id the plan may write into a policy: the operator's, still readable, or nothing. */
export function confirmedExclusionsGroupId(ctx: ExclusionsGroupContext): string | null {
  return exclusionsGroupChoice(ctx).confirmedId
}
