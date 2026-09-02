// The rows of a step's picker (target-state §6.4, prompt 52 Part 3): one row per
// thing the scan nominated, in the content file's row shape, with the ids
// behind the rows and the ones ticked before any decision is saved. The ticked
// set is the plan's current value (the mapping), so the picker shows what the
// plan uses; where the mapping holds nothing yet, everything nominated starts
// ticked. The rows come from the detections the plan already runs, never a
// second reading of the tenant.
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import type { TenantSnapshot, UserRow } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { detectEmergencyAccess, emergencySignals } from '../../mapping/emergencyAccess.ts'
import { suggestCountries, countryName } from '../../mapping/countries.ts'
import { detectServiceAccounts } from '../../mapping/serviceAccounts.ts'
import { sharedDeviceUsers, sharedDeviceSignals } from '../../derive/sharedDevices.ts'
import { DECISION_STEPS } from '../../roadmap/decisions.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { engine, shared } from '../../content/content.ts'

export type PickerContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  /** The groups the plan loaded (every group a policy names, and the plan's own). */
  groups?: GroupMembers
}

/** The picker's variables: `<key>` holds the rows, `<key>Ids` the ids behind them, `<key>Ticked` the ids ticked before a decision. */
export type PickerVars = Record<string, string[]>

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
  return { [key]: rows, [`${key}Ids`]: ids, [`${key}Ticked`]: ticked }
}

/** The mapping's own ids where it holds any (the plan's current value), else everything nominated. */
function tickedFrom(current: readonly string[], ids: string[]): string[] {
  const held = current.filter((id) => ids.includes(id))
  return held.length > 0 ? held : ids
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

  // Emergency access: the accounts two or more signals nominate, strongest
  // first, then any the plan already holds that the signals missed.
  if (DECISION_STEPS.emergency.has(stepId)) {
    const candidates = detectEmergencyAccess(snapshot, policies)
    const ids = [...new Set([...candidates.map((c) => c.id), ...mapping.breakGlassUserIds])]
    const rows = ids.map((id) => {
      const u = userOf(id)
      const signals = candidates.find((c) => c.id === id)?.signals ?? (u ? emergencySignals(u, snapshot, policies) : [])
      return row(template, { name: nameOf(id), upn: u?.userPrincipalName ?? undefined, signals: signals.map((s) => engine.emergencySignals[s] ?? s).join(', ') || undefined })
    })
    return vars('emergencyCandidates', rows, ids, tickedFrom(mapping.breakGlassUserIds, ids))
  }

  // The exclusions group: every group the plan knows (the ones policies name
  // and the ones it loaded) with how many policies already exclude each; the
  // group the mapping recognised first, then the most excluded.
  if (DECISION_STEPS.exclusions.has(stepId)) {
    const known = new Map<string, string>()
    for (const [id] of ctx.groups ?? []) known.set(lc(id), id)
    for (const p of policies) for (const id of [...policyGroups(p).include, ...policyGroups(p).exclude]) if (!known.has(lc(id))) known.set(lc(id), id)
    const resolved = mapping.records['__globalExclusion']?.resolvedId ?? null
    const isResolved = (id: string): number => (resolved !== null && lc(id) === lc(resolved) ? 1 : 0)
    const excludedFrom = (id: string): number => policies.filter((p) => policyGroups(p).exclude.some((g) => lc(g) === lc(id))).length
    const ids = [...known.values()].sort((a, b) => isResolved(b) - isResolved(a) || excludedFrom(b) - excludedFrom(a) || nameOf(a).localeCompare(nameOf(b)))
    const rows = ids.map((id) => {
      const g = ctx.groups?.get(id)
      return row(template, { name: g?.displayName ?? nameOf(id), memberCount: g?.memberCount, excludedFrom: excludedFrom(id), policyCount: policies.length })
    })
    const ticked = ids.filter((id) => isResolved(id) === 1)
    return vars('groups', rows, ids, ticked.length > 0 ? ticked : ids.slice(0, 1))
  }

  // Allowed countries: every country the sign-in records or a usage location
  // name, most people first, plus any the plan already allows. Sign-ins per
  // country are not collected, so that segment of the row is left out.
  if (stepId === DECISION_STEPS.countries) {
    const seen = suggestCountries(snapshot).countries
    const allowed = mapping.allowedCountries.map((c) => c.toUpperCase())
    const ids = [...new Set([...seen.map((c) => c.code), ...allowed])]
    const rows = ids.map((code) => row(template, { country: countryName(code), people: seen.find((c) => c.code === code)?.users }))
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
