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
export function tenantCountryLocation(snapshot: TenantSnapshot, allowed: string[]): { id: string; displayName: string } | null {
  const want = [...new Set(allowed.map((c) => c.toUpperCase()))].sort().join(',')
  if (want === '') return null
  for (const raw of snapshot.config.namedLocations?.rows ?? []) {
    const l = raw as { id?: string; displayName?: string; '@odata.type'?: string; countriesAndRegions?: unknown }
    if (!String(l['@odata.type'] ?? '').includes('countryNamedLocation') || !Array.isArray(l.countriesAndRegions)) continue
    const have = [...new Set(l.countriesAndRegions.map((c) => String(c).toUpperCase()))].sort().join(',')
    if (have === want && typeof l.id === 'string') return { id: l.id, displayName: l.displayName ?? l.id }
  }
  return null
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
