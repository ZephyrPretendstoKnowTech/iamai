// The countries a work-countries list leaves out that people sign in from (v1.1
// T1-2). Block Sign-ins From Countries Not Allowed blocks every country its list
// leaves out, so a country an administrator or anyone else signed in from in the
// window, left off the list, is somebody locked out on the day it is turned on.
//
// One reading for every reader: the two lockout checks (validation/rules.ts
// cty.includesOperator, cty.seenCountriesIncluded), the turn-on's hold
// (generate.ts, COUNTRIES_LOCKOUT_WAIT) and the Work countries decision's Left
// out on purpose list (ui/surfaces/countriesDecision.ts). A country the operator
// marked as left out on purpose, saved with the countries answer
// (MappingState.countriesLeftOut), no longer holds anything.
//
// Where the records hold nothing to read (no administrator's sign-in carries a
// country, no counts by country), nothing is said and nothing is held: the checks
// report that themselves, and IAMAI never invents a lockout.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { countryName } from '../mapping/countries.ts'
import { shared } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { namesOf } from './blockSignIns.ts'

/** The readiness blocker label that holds the countries policy's turn-on while a country people sign in from is left out (generate.ts). */
export const COUNTRIES_LOCKOUT_WAIT = 'countries-lockout'

/** A country the list leaves out that the records show in use: who signed in from it. */
export type LeftOutCountry = {
  /** ISO 3166 code, upper case. */
  code: string
  /** The administrators (active directory roles) whose sign-ins came from it, in directory order. */
  adminIds: string[]
  /** Distinct people the records counted signing in from it; 0 where only an administrator's own countries name it. */
  people: number
}

type Snapshot = Pick<TenantSnapshot, 'roles' | 'signInEvidence' | 'evidenceAggregates'>
type Acknowledging = Partial<Pick<MappingState, 'countriesLeftOut'>>

const up = (c: string): string => c.trim().toUpperCase()

/** The countries the operator said are left out on purpose, saved with the countries answer. */
export function countriesAcknowledged(mapping: Acknowledging): Set<string> {
  return new Set((mapping.countriesLeftOut ?? []).map(up))
}

/**
 * The administrators' sign-in countries the list leaves out, each with the
 * administrators seen there; null where no administrator's sign-in carries a
 * country, which decides nothing. The administrators, never the signed-in
 * account alone: the people who could lock themselves out of the portal,
 * whoever ran the scan.
 */
export function adminCountriesLeftOut(snapshot: Snapshot, allowed: readonly string[], acknowledged: ReadonlySet<string> = new Set()): { code: string; adminIds: string[] }[] | null {
  const admins = Object.keys(snapshot.roles?.active ?? {})
  const seen = [...new Set(admins.flatMap((id) => (snapshot.signInEvidence[id]?.countries ?? []).map(up)))].filter((c) => c.length > 0)
  if (seen.length === 0) return null
  const keep = new Set(allowed.map(up))
  return seen
    .filter((c) => !keep.has(c) && !acknowledged.has(c))
    .map((code) => ({ code, adminIds: admins.filter((id) => (snapshot.signInEvidence[id]?.countries ?? []).some((c) => up(c) === code)) }))
}

/**
 * The countries the records counted people signing in from that the list
 * leaves out, each with how many; null where the scan holds no counts by
 * country, which decides nothing.
 */
export function seenCountriesLeftOut(snapshot: Snapshot, allowed: readonly string[], acknowledged: ReadonlySet<string> = new Set()): { code: string; people: number }[] | null {
  const byCountry = snapshot.evidenceAggregates?.byCountry ?? null
  if (byCountry === null) return null
  const keep = new Set(allowed.map(up))
  return Object.entries(byCountry)
    .filter(([c]) => c.trim().length > 0 && !keep.has(up(c)) && !acknowledged.has(up(c)))
    .map(([c, n]) => ({ code: up(c), people: n }))
}

/**
 * Every country left out that the records show in use and nobody marked as left
 * out on purpose, the administrators' first: what holds the turn-on. Empty where
 * nothing is left out, or nothing could be read.
 */
export function countriesLockout(snapshot: Snapshot, mapping: Pick<MappingState, 'allowedCountries'> & Acknowledging, allowed: readonly string[] = mapping.allowedCountries): LeftOutCountry[] {
  const acknowledged = countriesAcknowledged(mapping)
  const out = new Map<string, LeftOutCountry>()
  for (const a of adminCountriesLeftOut(snapshot, allowed, acknowledged) ?? []) out.set(a.code, { code: a.code, adminIds: a.adminIds, people: 0 })
  for (const s of seenCountriesLeftOut(snapshot, allowed, acknowledged) ?? []) {
    const hit = out.get(s.code)
    if (hit) hit.people = s.people
    else out.set(s.code, { code: s.code, adminIds: [], people: s.people })
  }
  return [...out.values()].sort((a, b) => b.adminIds.length - a.adminIds.length || b.people - a.people || a.code.localeCompare(b.code))
}

/**
 * The countries the Left out on purpose list offers against a work-countries
 * list being edited: every country the records show in use that the list leaves
 * out, acknowledged or not, so a tick can be taken off as well as put on.
 */
export function leftOutChoices(snapshot: Snapshot, allowed: readonly string[]): LeftOutCountry[] {
  return countriesLockout(snapshot, { allowedCountries: [...allowed] })
}

// ---- words (content.json shared.countriesLeftOut) ----

type Words = { wait: string; itemPeople: string; itemAdminOne: string; itemAdminMany: string; itemOnlyAdminOne: string; itemOnlyAdminMany: string; choice: string; personOne: string; people: string; adminOne: string; admins: string }
const W = (): Words => (shared as unknown as { countriesLeftOut: Words }).countriesLeftOut

/** How many people, in the content's words: "1 person", "3 people". */
function peopleWords(n: number): string {
  return n === 1 ? W().personOne : fillText(W().people, { n })
}

/** One country and who signed in from it, as the step's wait names it: "Australia, 3 people, the administrator Jane Admin among them". */
function itemOf(c: LeftOutCountry, nameOf: (id: string) => string): string {
  const w = W()
  const country = countryName(c.code)
  // Five names at most, then "and N more": a 51-admin tenant's whole list is no sentence.
  const admins = namesOf(c.adminIds, nameOf, 'sentence')
  if (c.adminIds.length === 0) return fillText(w.itemPeople, { country, people: peopleWords(c.people) })
  const one = c.adminIds.length === 1
  if (c.people === 0) return fillText(one ? w.itemOnlyAdminOne : w.itemOnlyAdminMany, { country, admins })
  return fillText(one ? w.itemAdminOne : w.itemAdminMany, { country, people: peopleWords(c.people), admins })
}

/**
 * The step's wait in full (stepContract.ts waitTextOf): which countries, who
 * signed in from each, and the two ways to clear it. The row says it shorter
 * (copy/reasons.ts BLOCKED_REASON.countriesLeftOut).
 */
export function countriesLockoutWait(lockout: readonly LeftOutCountry[], nameOf: (id: string) => string): string {
  return fillText(W().wait, { items: lockout.map((c) => itemOf(c, nameOf)).join('; ') })
}

/** One country on the Left out on purpose list: "Australia · 3 people, 1 administrator". */
export function leftOutChoiceLabel(c: LeftOutCountry): string {
  const w = W()
  const parts = [...(c.people > 0 ? [peopleWords(c.people)] : []), ...(c.adminIds.length === 0 ? [] : [c.adminIds.length === 1 ? w.adminOne : fillText(w.admins, { n: c.adminIds.length })])]
  return fillText(w.choice, { country: countryName(c.code), who: parts.join(', ') })
}

// ---- the saved answer ----

/** The key the Work countries decision saves its Left out on purpose countries under (StepDecision.answers), beside the picked work countries. */
export const COUNTRIES_LEFT_OUT_ANSWER = 'leftOut'

/** ISO country codes as an answer carries them ("AU, NZ"): upper case, each once, anything that is not a two-letter code dropped. */
export function parseCountryCodes(answer: string | null | undefined): string[] {
  if (typeof answer !== 'string') return []
  return [...new Set(answer.split(',').map(up).filter((c) => /^[A-Z]{2}$/.test(c)))]
}

/** A list of country codes as an answer carries it. */
export function countryCodesAnswer(codes: readonly string[]): string {
  return [...new Set(codes.map(up))].join(', ')
}

/** True when a value is a list of two-letter ISO country codes (a plan file's mapping, roadmap/plan.ts). */
export function isCountryCodeList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((c) => typeof c === 'string' && /^[A-Za-z]{2}$/.test(c))
}
