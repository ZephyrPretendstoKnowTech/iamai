// The assumptions a plan rests on (2026-08-27 redesign, detected since prompt
// 46): seven answers, each given a detected default at scan time so nothing is
// asked before the plan exists. A person changes an answer on the plan's own
// pickers (prune B); the detection is recomputed until they do. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembersCacheEntry } from '../graph/collect/cache.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import type { MappingRecord, MappingState, QuestionGroup } from './types.ts'
import { detectServiceAccounts } from './serviceAccounts.ts'
import { exclusionsGroupCandidates, withoutExclusionsGroupAnswer } from './safetyChoice.ts'
import { suggestCountries } from './countries.ts'
import { autoEmergencyAccess } from './emergencyAccess.ts'

export type WizardQuestionId = 'breakGlass' | 'globalExclusion' | 'countries' | 'trustedLocations' | 'serviceAccounts' | 'timeZone' | 'applicability'

/** The seven answers, in the order a person once saw them. */
export const ANSWER_IDS: WizardQuestionId[] = ['breakGlass', 'globalExclusion', 'countries', 'trustedLocations', 'serviceAccounts', 'timeZone', 'applicability']

// Detected records carry provenance 'auto' so they are recomputed on every scan
// instead of freezing at the first one.
const auto = (
  key: string,
  kind: string,
  group: QuestionGroup,
  resolvedId: string | null,
  resolvedName: string | null,
  doesNotExist = false,
): MappingRecord => ({
  placeholder: key,
  kind,
  group,
  resolvedId,
  resolvedName,
  provenance: 'auto',
  doesNotExist,
  validation: null,
})

/**
 * The answers this tenant is asked for. Service accounts only when something
 * was found or confirmed; the trusted network only when the tenant has named
 * locations to mark trusted (prompt 37 §7: an answer nobody can give must not
 * hold the plan provisional forever).
 */
export function askedAnswers(snapshot: TenantSnapshot, state: MappingState): WizardQuestionId[] {
  return ANSWER_IDS.filter((id) => {
    if (id === 'serviceAccounts') {
      if (state.serviceAccountUserIds.length > 0 || state.serviceAccountsGroupId) return true
      return detectServiceAccounts(snapshot, [...state.breakGlassUserIds, ...state.serviceAccountRejectedIds]).length > 0
    }
    if (id === 'trustedLocations') {
      if (state.trustedLocationIds.length > 0) return true
      return (snapshot.config.namedLocations?.rows ?? []).length > 0
    }
    return true
  })
}

/** True once every answer this tenant is asked for has one, detected or a person's: coverage then reads the mapping's exclusions as confirmed. */
export function answersComplete(snapshot: TenantSnapshot, state: MappingState): boolean {
  return askedAnswers(snapshot, state).every((id) => state.wizardAnswered[id] === true)
}

// ---- The exclusions and service-accounts groups, from the tenant's own policy shapes ----

const GROUP_NAME_PATTERN = /\bbreak.?glass\b|\bemergency\b|\bglass\b|(?:^|[\s._-])admin(?:$|[\s._-])|^it[-_]|[\s._]it[-_]|\bsvc\b|\bservice[-_]|\bexclusion|^ca[-_]|[\s_]ca[-_]/i

/** A group the scan nominates: rank 0 from what the policies do with it, rank 1 from its name alone. */
export type GroupSuggestion = { id: string; name: string; rank: 0 | 1 }

export type GroupSuggestContext = {
  snapshot: TenantSnapshot
  tenantPolicies: unknown[]
  knownGroups: GroupMembersCacheEntry[]
  /** The emergency access accounts, so a group holding only them ranks first. */
  breakGlassUserIds?: string[]
}

export function suggestGroups(kind: 'globalExclusion' | 'serviceAccounts', ctx: GroupSuggestContext): GroupSuggestion[] {
  const out = new Map<string, GroupSuggestion>()
  const add = (s: GroupSuggestion): void => {
    const cur = out.get(s.id)
    if (!cur || s.rank < cur.rank) out.set(s.id, s)
  }
  const nameOf = (gid: string): string => ctx.knownGroups.find((g) => g.groupId === gid)?.displayName ?? gid
  if (kind === 'globalExclusion') {
    // The exclusions group is a safety-sensitive choice, and safetyChoice.ts is
    // the one place that says which groups plausibly are it. The picker offers
    // the same list; what it may not do is tick one of them.
    const groups: GroupMembers = new Map(ctx.knownGroups.map((g) => [g.groupId, { memberIds: g.memberIds, memberCount: g.memberCount, sampled: g.sampled, displayName: g.displayName ?? undefined }]))
    for (const c of exclusionsGroupCandidates({ snapshot: ctx.snapshot, mapping: { records: {}, breakGlassUserIds: ctx.breakGlassUserIds ?? [] }, groups })) {
      add({ id: c.id, name: c.name === c.id ? nameOf(c.id) : c.name, rank: 0 })
    }
  }
  for (const s of groupSignatures(ctx.tenantPolicies as CaPolicy[])) {
    if (kind === 'serviceAccounts' && s.inferredRole === 'serviceAccounts') add({ id: s.id, name: nameOf(s.id), rank: 0 })
  }
  for (const g of ctx.knownGroups) {
    if (GROUP_NAME_PATTERN.test(g.displayName ?? '')) add({ id: g.groupId, name: g.displayName ?? g.groupId, rank: 1 })
  }
  return [...out.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
}

export type DetectionContext = {
  /** Cached group memberships, for the exclusions and service-accounts groups; empty when none are cached yet. */
  knownGroups: GroupMembersCacheEntry[]
  /** The time zone to assume when the tenant has not said (the operator's browser, in the app). */
  defaultTimeZone?: string | null
}

/**
 * Detected defaults for every answer nobody has given yet (prompt 46 item
 * 19; target-state §5). Nothing is asked before the plan exists: emergency
 * access from its signals, the exclusions group from the tenant's own policy
 * shapes, countries from where people sign in, trusted locations from the
 * ones marked trusted, service accounts from their usage, the time zone from
 * the browser. Where nothing is found the answer is "none found" and the plan
 * starts by creating the thing. Answers a person has already given are left
 * alone; detected ones are recomputed on every scan until a person edits them.
 */
export function applyDetectedDefaults(state: MappingState, snapshot: TenantSnapshot, ctx: DetectionContext): MappingState {
  const next: MappingState = { ...state, records: { ...state.records }, wizardAnswered: { ...state.wizardAnswered }, assumed: { ...(state.assumed ?? {}) } }
  const assumed = next.assumed as NonNullable<MappingState['assumed']>
  const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
  const detectable = (id: WizardQuestionId): boolean => next.wizardAnswered[id] !== true || assumed[id] === 'detected' || assumed[id] === 'noneFound'
  const mark = (id: WizardQuestionId, found: boolean): void => {
    next.wizardAnswered[id] = true
    assumed[id] = found ? 'detected' : 'noneFound'
  }

  if (detectable('breakGlass')) {
    // Only the accounts the tenant named for the job (emergencyAccess.ts): a
    // circumstantial nomination is offered in the picker, never classified here.
    const candidates = autoEmergencyAccess(snapshot, tenantPolicies)
    next.breakGlassUserIds = candidates.map((c) => c.id)
    if (candidates.length > 0) delete next.records['__breakGlassMissing']
    else next.records['__breakGlassMissing'] = auto('__breakGlassMissing', 'user', 'breakGlass', null, null, true)
    mark('breakGlass', candidates.length > 0)
  }

  const suggestCtx: GroupSuggestContext = { snapshot, tenantPolicies, knownGroups: ctx.knownGroups, breakGlassUserIds: next.breakGlassUserIds }
  if (detectable('globalExclusion')) {
    // Foundation C: there is no such thing as a detected exclusions group, only
    // a recommended one. The recommendation is computed where it is shown
    // (safetyChoice.ts) and never written into the mapping, so no reader can
    // pick it up and mistake it for somebody's answer. What a detection leaves
    // behind here is the absence of an answer.
    next.records = withoutExclusionsGroupAnswer(next.records)
    mark('globalExclusion', false)
  }

  if (detectable('countries')) {
    const seen = suggestCountries(snapshot).countries
    const signedInFrom = seen.filter((c) => c.users > 0).map((c) => c.code)
    const codes = signedInFrom.length > 0 ? signedInFrom : seen.map((c) => c.code)
    next.allowedCountries = codes
    mark('countries', codes.length > 0)
  }

  if (detectable('trustedLocations')) {
    const trusted = ((snapshot.config.namedLocations?.rows ?? []) as { id?: string; isTrusted?: boolean }[]).filter((l) => l.isTrusted === true && typeof l.id === 'string').map((l) => l.id as string)
    next.trustedLocationIds = trusted
    mark('trustedLocations', trusted.length > 0)
  }

  if (detectable('serviceAccounts')) {
    const candidates = detectServiceAccounts(snapshot, [...next.breakGlassUserIds, ...next.serviceAccountRejectedIds]).map((c) => c.id)
    next.serviceAccountUserIds = candidates
    const group = candidates.length > 0 ? (suggestGroups('serviceAccounts', suggestCtx).find((x) => x.rank === 0) ?? null) : null
    next.serviceAccountsGroupId = group?.id ?? null
    mark('serviceAccounts', candidates.length > 0)
  }

  if (detectable('timeZone')) {
    next.displayTimeZone = next.displayTimeZone ?? ctx.defaultTimeZone ?? null
    mark('timeZone', next.displayTimeZone !== null)
  }

  if (detectable('applicability')) mark('applicability', true) // facets are detected by the coverage engine; overrides stay

  return next
}
