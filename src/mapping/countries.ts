// Allowed-countries suggestions (ux-review-03 §A4): countries seen in the
// sign-in records (distinct users and sign-ins) plus every usageLocation. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'

export type CountrySuggestion = {
  code: string
  /** Distinct users seen signing in from it (0 when only usageLocation). */
  users: number
  /** Users whose usageLocation is this country. */
  usageLocationUsers: number
  /** Sign-ins seen from it (0 when only usageLocation, or when the snapshot never counted them). */
  signIns: number
}

export type CountrySuggestions = {
  countries: CountrySuggestion[]
  /** False when no sign-in records carried a location: usageLocation only. */
  hasSignInLocations: boolean
  /** False when the snapshot predates the per-country sign-in count. */
  hasSignInCounts: boolean
}

export function suggestCountries(snapshot: TenantSnapshot): CountrySuggestions {
  const byCode = new Map<string, CountrySuggestion>()
  const get = (code: string): CountrySuggestion => {
    const key = code.toUpperCase()
    return byCode.get(key) ?? byCode.set(key, { code: key, users: 0, usageLocationUsers: 0, signIns: 0 }).get(key)!
  }
  const seen = snapshot.evidenceAggregates?.byCountry ?? {}
  for (const [code, users] of Object.entries(seen)) {
    if (/^[A-Za-z]{2}$/.test(code)) get(code).users += users
  }
  const counted = snapshot.evidenceAggregates?.signInsByCountry ?? null
  for (const [code, n] of Object.entries(counted ?? {})) {
    if (/^[A-Za-z]{2}$/.test(code)) get(code).signIns += n
  }
  for (const u of snapshot.users) {
    if (u.userType === 'guest' || !u.usageLocation || !/^[A-Za-z]{2}$/.test(u.usageLocation)) continue
    get(u.usageLocation).usageLocationUsers += 1
  }
  const countries = [...byCode.values()].sort((a, b) => b.users - a.users || b.usageLocationUsers - a.usageLocationUsers || a.code.localeCompare(b.code))
  return { countries, hasSignInLocations: countries.some((c) => c.users > 0), hasSignInCounts: counted !== null }
}

let displayNames: Intl.DisplayNames | null | undefined

/** "Australia" for "AU"; the code itself when the runtime cannot name it. */
export function countryName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      displayNames = null
    }
  }
  try {
    return displayNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** The tenant's country named location whose set equals the allowed list, if any. */
export function tenantCountryLocation(snapshot: TenantSnapshot, allowed: string[], preferredIds: readonly string[] = []): { id: string; displayName: string } | null {
  const want = [...new Set(allowed.map((c) => c.toUpperCase()))].sort().join(',')
  if (want === '' || snapshot.config.namedLocations?.status !== 'ok') return null
  const locations = snapshot.config.namedLocations.rows.map(raw => raw as { id?: string; displayName?: string; '@odata.type'?: string; countriesAndRegions?: unknown; countryLookupMethod?: string; includeUnknownCountriesAndRegions?: boolean })
  const exact = locations.filter(l => String(l['@odata.type'] ?? '').includes('countryNamedLocation') && Array.isArray(l.countriesAndRegions) && typeof l.id === 'string'
    && [...new Set(l.countriesAndRegions.map(c => String(c).toUpperCase()))].sort().join(',') === want
    && l.countryLookupMethod === 'clientIpAddress' && l.includeUnknownCountriesAndRegions === false)
  // Explicit identity wins; if it drifts, correct that object rather than quietly
  // changing all dependent references to another equally named location.
  const selected = locations.filter(l => l.id && preferredIds.includes(l.id) && String(l['@odata.type'] ?? '').includes('countryNamedLocation'))
  const candidates = selected.length ? exact.filter(l => selected.some(s => s.id === l.id)) : exact
  if (selected.length && candidates.length !== selected.length) return null
  const match = candidates.sort((a, b) => a.id!.localeCompare(b.id!))[0]
  return match ? { id: match.id!, displayName: match.displayName ?? match.id! } : null
}

/** True when a baseline policy uses the location as "everywhere except" with a block: the allowlist-style geo policy. */
export function isCountryLocationRef(refId: string, policies: { conditions?: { locations?: { includeLocations?: string[]; excludeLocations?: string[] } | null }; grantControls?: { builtInControls?: string[] } | null }[]): boolean {
  return policies.some((p) => {
    const loc = p.conditions?.locations
    if (!loc) return false
    const excluded = (loc.excludeLocations ?? []).includes(refId)
    const block = (p.grantControls?.builtInControls ?? []).includes('block')
    return excluded && block
  })
}

/** Allowlist style: applies everywhere except the allowed location, and blocks. */
export function isAllowlistGeoPolicy(p: { conditions?: { locations?: { includeLocations?: string[]; excludeLocations?: string[] } | null }; grantControls?: { builtInControls?: string[] } | null }): boolean {
  const loc = p.conditions?.locations
  if (!loc) return false
  const includeAll = (loc.includeLocations ?? []).some((l) => l.toLowerCase() === 'all')
  return includeAll && (loc.excludeLocations ?? []).length > 0 && (p.grantControls?.builtInControls ?? []).includes('block')
}

/** ISO two-letter country/region catalogue for Graph countryNamedLocation.
 * https://learn.microsoft.com/graph/api/resources/countrynamedlocation
 * Kept separate from observed suggestions: choosing a country never claims activity there.
 */
export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
