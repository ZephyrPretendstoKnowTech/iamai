// The rows of a step's picker (target-state §6.4, prompt 52 Part 3): one row per
// thing the scan nominated, in the content file's row shape, with the ids
// behind the rows and the ones ticked before any decision is saved. The ticked
// set is the plan's current value (the mapping), so the picker shows what the
// plan uses; where the mapping holds nothing yet, everything nominated starts
// ticked — except on the two safety-sensitive pickers, the exclusions group and
// the emergency-access accounts, where nothing is ticked that nobody ticked.
// The rows come from the detections the plan already runs, never a second
// reading of the tenant.
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import type { TenantSnapshot, UserRow } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { emergencySignals } from '../../mapping/emergencyAccess.ts'
import { emergencySelection } from '../../mapping/emergencyChoice.ts'
import { suggestCountries, countryName } from '../../mapping/countries.ts'
import { detectServiceAccounts } from '../../mapping/serviceAccounts.ts'
import { sharedDeviceUsers, sharedDeviceSignals } from '../../derive/sharedDevices.ts'
import { DECISION_STEPS, applyStepDecisions } from '../../roadmap/decisions.ts'
import { exclusionsGroupChoice, operatorExclusionsDecision } from '../../mapping/safetyChoice.ts'
import type { DirectoryEvidence } from '../../mapping/safetyChoice.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { engine, shared } from '../../content/content.ts'

export type PickerContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  /** The groups the plan loaded (every group a policy names, and the plan's own). */
  groups?: GroupMembers
  /** What this scan's directory reads established about those groups (Foundation C). */
  directory?: DirectoryEvidence
}

/** The picker's variables: `<key>` holds the rows, `<key>Ids` the ids behind them, `<key>Ticked` the ids ticked before a decision; `pickerKey` names the key, so a picker never reads another step's list. */
export type PickerVars = Record<string, string[] | string>

const lc = (s: string): string => s.toLowerCase()
/** The separator between a row's segments, as content.json writes its pickerRow shapes. */
const SEP = ' · '

/**
 * The content row shape, filled a segment at a time: a segment naming a value
 * the scan does not hold (sign-ins per country) is left out, never a hole.
 */
function row(template: string, values: Record<string, unknown>): string {
  return template
    .split(SEP)
    .filter((seg) => missingVars(seg, values).length === 0)
    .map((seg) => fillText(seg, values))
    .join(SEP)
}

function vars(key: string, rows: string[], ids: string[], ticked: string[]): PickerVars {
  return { pickerKey: key, [key]: rows, [`${key}Ids`]: ids, [`${key}Ticked`]: ticked }
}

/**
 * The mapping's own ids where it holds any (the plan's current value), else the
 * fallback — everything nominated, unless a picker names a narrower default
 * (the emergency picker ticks only what a scan may classify by itself).
 */
function tickedFrom(current: readonly string[], ids: string[], fallback: string[] = ids): string[] {
  const held = current.filter((id) => ids.includes(id))
  return held.length > 0 ? held : fallback
}

function policyGroups(p: unknown): { include: string[]; exclude: string[] } {
  const users = (p as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
  return { include: users?.includeGroups ?? [], exclude: users?.excludeGroups ?? [] }
}

/**
 * The picker rows for a step, or null when the step has no picker of its own
 * (the campaign's special-care rows come from the content lists). `template` is
 * the content step's `decision.pickerRow`.
 */
export function pickerVars(stepId: string, template: string, ctx: PickerContext): PickerVars | null {
  const { snapshot, mapping, nameOf } = ctx
  const policies = snapshot.config.caPolicies?.rows ?? []
  const userOf = (id: string): UserRow | undefined => snapshot.users.find((u) => u.id === id)

  // Emergency access: the accounts the signals nominate, the recommended ones
  // first, then whatever the operator confirmed or an older record left behind.
  //
  // Nothing is ticked that nobody ticked. A tick here is the plan's
  // classification — it takes the account out of the people population, decides
  // what a policy's emergency exposure is measured against, and decides what the
  // exclusions group must contain (mapping/emergencyChoice.ts). An ordinary
  // Global Administrator on the initial domain with no licence carries three of
  // the five signals, and even an account plainly named "Breakglass" is a
  // reading of a name and not a person's answer. IAMAI shows what it would put
  // forward; the operator ticks it or does not.
  if (DECISION_STEPS.emergency.has(stepId)) {
    const sel = emergencySelection({ snapshot, mapping, tenantPolicies: policies })
    const rows = sel.offeredIds.map((id) => {
      const u = userOf(id)
      const signals = sel.candidates.find((c) => c.id === id)?.signals ?? (u ? emergencySignals(u, snapshot, policies) : [])
      return row(template, { name: nameOf(id), upn: u?.userPrincipalName ?? undefined, signals: signals.map((s) => engine.emergencySignals[s] ?? s).join(', ') || undefined })
    })
    return vars('emergencyCandidates', rows, sel.offeredIds, sel.offeredIds.filter((id) => sel.confirmedIds.includes(id)))
  }

  // The exclusions group: every group the plan knows (the ones policies name
  // and the ones it loaded) with how many policies already exclude each; the
  // operator's own answer first, then the groups the detection puts forward,
  // then the most excluded.
  //
  // Nothing is ticked that nobody ticked. This is a safety-sensitive choice
  // (Foundation C): the group every policy excludes decides who still gets in
  // when a policy goes wrong, a tick here is applied as the plan's own decision
  // (defaultDecisions), and every fixture in this repo has two groups that
  // qualify — so a pre-tick was a coin toss written into a policy. IAMAI shows
  // what it would put forward; the operator ticks it or does not.
  if (DECISION_STEPS.exclusions.has(stepId)) {
    const known = new Map<string, string>()
    for (const [id] of ctx.groups ?? []) known.set(lc(id), id)
    for (const p of policies) for (const id of [...policyGroups(p).include, ...policyGroups(p).exclude]) if (!known.has(lc(id))) known.set(lc(id), id)
    // The tick is the operator's own answer and only that. A record an older
    // version's detection wrote holds an id, and pre-ticking it would show a
    // machine's reading back to the operator as their own decision — one Save
    // away from being exactly that. It still sorts to the top, because it is
    // the group IAMAI has been watching and the one they most likely want.
    const choice = exclusionsGroupChoice({ snapshot, mapping, groups: ctx.groups, directory: ctx.directory })
    const stored = operatorExclusionsDecision(mapping)?.id ?? null
    const candidate = new Set(choice.candidates.map((c) => lc(c.id)))
    const isStored = (id: string): number => (stored !== null && lc(id) === lc(stored) ? 1 : 0)
    const isRecorded = (id: string): number => (choice.recordedId !== null && lc(id) === lc(choice.recordedId) ? 1 : 0)
    const excludedFrom = (id: string): number => policies.filter((p) => policyGroups(p).exclude.some((g) => lc(g) === lc(id))).length
    const ids = [...known.values()].sort((a, b) => isStored(b) - isStored(a) || isRecorded(b) - isRecorded(a) || Number(candidate.has(lc(b))) - Number(candidate.has(lc(a))) || excludedFrom(b) - excludedFrom(a) || nameOf(a).localeCompare(nameOf(b)))
    const rows = ids.map((id) => {
      const g = ctx.groups?.get(id)
      return row(template, { name: g?.displayName ?? nameOf(id), memberCount: g?.memberCount, excludedFrom: excludedFrom(id), policyCount: policies.length })
    })
    return vars('groups', rows, ids, ids.filter((id) => isStored(id) === 1))
  }

  // Allowed countries: every country the sign-in records or a usage location
  // name, most people first, plus any the plan already allows; the people and
  // the sign-ins seen from each (a snapshot that never counted sign-ins leaves
  // that segment out).
  if (stepId === DECISION_STEPS.countries) {
    const suggested = suggestCountries(snapshot)
    const seen = suggested.countries
    const allowed = mapping.allowedCountries.map((c) => c.toUpperCase())
    const ids = [...new Set([...seen.map((c) => c.code), ...allowed])]
    const rows = ids.map((code) => {
      const c = seen.find((x) => x.code === code)
      return row(template, { country: countryName(code), people: c?.users, signIns: suggested.hasSignInCounts ? (c?.signIns ?? 0) : undefined })
    })
    const signedInFrom = seen.filter((c) => c.users > 0).map((c) => c.code)
    return vars('countriesWithCounts', rows, ids, tickedFrom(allowed, signedInFrom.length > 0 ? signedInFrom : ids))
  }

  // The trusted network: the tenant's IP-range locations, with their ranges
  // and how many sign-ins the records matched to each; ticked as the mapping
  // holds them, else the ones the tenant already marks trusted.
  if (stepId === DECISION_STEPS.trustedLocation) {
    const locations = (snapshot.config.namedLocations?.rows ?? [])
      .map((raw) => raw as { id?: string; displayName?: string; '@odata.type'?: string; isTrusted?: boolean; ipRanges?: { cidrAddress?: string }[] })
      .filter((l) => typeof l.id === 'string' && String(l['@odata.type'] ?? '').includes('ipNamedLocation'))
    const matches = snapshot.scenarioEvidence?.trustedLocationMatches.byLocation ?? null
    const ids = locations.map((l) => l.id as string)
    const rows = locations.map((l) => {
      const name = l.displayName ?? nameOf(l.id as string)
      const ranges = (l.ipRanges ?? []).map((r) => r.cidrAddress).filter((r): r is string => typeof r === 'string' && r.length > 0)
      return row(template, { name, ranges: ranges.length > 0 ? ranges.join(', ') : undefined, matches: matches ? (matches[name] ?? 0) : undefined })
    })
    const trusted = locations.filter((l) => l.isTrusted === true).map((l) => l.id as string)
    return vars('locationsWithMatches', rows, ids, tickedFrom(mapping.trustedLocationIds, trusted.length > 0 ? trusted : ids))
  }

  // Service accounts: the candidates the signals nominate (the rejected ones
  // and the emergency accounts left out), plus any the plan already holds.
  if (stepId === DECISION_STEPS.serviceAccounts) {
    const candidates = detectServiceAccounts(snapshot, [...mapping.breakGlassUserIds, ...mapping.serviceAccountRejectedIds])
    const ids = [...new Set([...candidates.map((c) => c.id), ...mapping.serviceAccountUserIds])]
    const rows = ids.map((id) => row(template, { name: nameOf(id), signals: candidates.find((c) => c.id === id)?.evidence.join('; ') || undefined }))
    return vars('accountsWithSignals', rows, ids, tickedFrom(mapping.serviceAccountUserIds, ids))
  }

  // Shared devices: the accounts a shared-device licence or device-only
  // sign-ins mark, with the signal in words. No mapping field holds these; the
  // decision is recorded and the accounts derive again on every scan.
  if (stepId === DECISION_STEPS.sharedDevices) {
    const words = shared.sharedDeviceSignals as Record<string, string>
    const users = sharedDeviceUsers(snapshot)
    const ids = users.map((u) => u.id)
    const rows = users.map((u) => row(template, { name: nameOf(u.id), signals: sharedDeviceSignals(u, snapshot).map((s) => words[s] ?? s).join('; ') || undefined }))
    return vars('devicesWithSignals', rows, ids, ids)
  }

  return null
}

export type DefaultsContext = PickerContext & { now: string }

/**
 * Every picker's pre-ticked default as a decision: the allowed countries,
 * trusted network, service accounts and special care. The derivation applies
 * these as if saved, so the step, its checks and every portal line read them on
 * first open; a Save only overrides. The shared-devices picker has no mapping
 * field and is not here.
 *
 * The two safety-sensitive pickers are not here and must not be: the exclusions
 * group (mapping/safetyChoice.ts) and the emergency-access accounts
 * (mapping/emergencyChoice.ts). Both decide who still gets in when a policy goes
 * wrong, and a default applied as the plan's decision is exactly the
 * detection-becomes-confirmation this repo had — a Global Administrator with
 * enough circumstantial signals stopped being a person without anybody saying
 * so. Both stay operator actions until an operator acts.
 */
export function defaultDecisions(ctx: DefaultsContext): Record<string, StepDecision> {
  const at = ctx.snapshot.asOf
  const out: Record<string, StepDecision> = {}
  const pick = (stepId: string, key: string): void => {
    const ticked = pickerVars(stepId, '', ctx)?.[`${key}Ticked`]
    if (Array.isArray(ticked) && ticked.length > 0) out[stepId] = { picked: ticked, at }
  }
  pick(DECISION_STEPS.countries, 'countriesWithCounts')
  pick(DECISION_STEPS.trustedLocation, 'locationsWithMatches')
  pick(DECISION_STEPS.serviceAccounts, 'accountsWithSignals')
  const care = contentLists({ snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, now: ctx.now }).specialCareIds
  if (care.length > 0) out[DECISION_STEPS.campaign] = { picked: care, at }
  return out
}

/**
 * The mapping the plan and every surface derive from (target-state §6.4): the
 * stored record with every picker's detected default applied as the plan's
 * decision, then every saved step decision over it. Today, the Plan and Connect
 * all read this, so there is one population (derive/facts.ts). The emergency
 * accounts are not in the detected pass: they are the operator's own decision,
 * carried in the saved decisions and recognised again from there on every scan.
 */
export function appliedMapping(ctx: DefaultsContext, saved: Record<string, StepDecision> | null | undefined): MappingState {
  return applyStepDecisions(applyStepDecisions(ctx.mapping, defaultDecisions(ctx), 'detected'), saved ?? null)
}

/** One object a picker can hold: the id behind a chip, its name, its UPN or count, and, for a nomination, the signal text. */
export type PickerObject = { id: string; name: string; secondary?: string; why?: string }

/** The kind of thing a picker chooses, from the step and its content source. */
export type PickerKind = 'accounts' | 'groups' | 'locations' | 'countries' | 'strengths' | 'other'
export function pickerKind(stepId: string, source: string | null): PickerKind {
  if (DECISION_STEPS.emergency.has(stepId) || stepId === DECISION_STEPS.serviceAccounts || stepId === DECISION_STEPS.sharedDevices || stepId === DECISION_STEPS.campaign || source === 'accounts') return 'accounts'
  if (DECISION_STEPS.exclusions.has(stepId) || source === 'groups') return 'groups'
  if (stepId === DECISION_STEPS.trustedLocation) return 'locations'
  if (stepId === DECISION_STEPS.countries) return 'countries'
  if (source === 'strengths') return 'strengths'
  return 'other'
}

/**
 * Every object of the picker's kind in the tenant, to type against: accounts by
 * name and UPN, the groups the plan knows, the named locations, the countries
 * seen or allowed, the authentication strengths.
 */
export function pickerUniverse(stepId: string, source: string | null, ctx: PickerContext): PickerObject[] {
  const { snapshot, mapping, nameOf } = ctx
  const kind = pickerKind(stepId, source)
  if (kind === 'accounts') return snapshot.users.map((u) => ({ id: u.id, name: nameOf(u.id), secondary: u.userPrincipalName ?? undefined }))
  if (kind === 'groups') {
    const known = new Map<string, string>()
    for (const [id] of ctx.groups ?? []) known.set(lc(id), id)
    for (const p of snapshot.config.caPolicies?.rows ?? []) for (const id of [...policyGroups(p).include, ...policyGroups(p).exclude]) if (!known.has(lc(id))) known.set(lc(id), id)
    return [...known.values()].map((id) => {
        const g = ctx.groups?.get(id)
        return { id, name: g?.displayName ?? nameOf(id), secondary: g ? `${g.memberCount} members` : undefined }
      })
  }
  if (kind === 'locations') {
    return (snapshot.config.namedLocations?.rows ?? [])
      .map((raw) => raw as { id?: string; displayName?: string })
      .filter((l) => typeof l.id === 'string')
      .map((l) => ({ id: l.id as string, name: l.displayName ?? nameOf(l.id as string) }))
  }
  if (kind === 'countries') {
    const codes = [...new Set([...suggestCountries(snapshot).countries.map((c) => c.code), ...mapping.allowedCountries.map((c) => c.toUpperCase())])]
    return codes.map((code) => ({ id: code, name: countryName(code), secondary: code }))
  }
  if (kind === 'strengths') {
    return (snapshot.config.authStrengths?.rows ?? [])
      .map((raw) => raw as { id?: string; displayName?: string })
      .filter((s) => typeof s.id === 'string')
      .map((s) => ({ id: s.id as string, name: s.displayName ?? (s.id as string) }))
  }
  return []
}

/** The objects whose name or UPN contains the query, case-insensitively; an empty query matches none (the picker shows its nominations then). */
export function filterPickerObjects(objects: readonly PickerObject[], query: string): PickerObject[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []
  return objects.filter((o) => o.name.toLowerCase().includes(q) || (o.secondary ?? '').toLowerCase().includes(q))
}
