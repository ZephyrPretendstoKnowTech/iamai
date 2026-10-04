// The Work countries decision's own additions (Block Sign-ins From Countries Not
// Allowed's first task, saved under the location's id): the countries left out
// on purpose (v1.1 T1-2) and the countries to block outright (v1.1 D4). Pure, so
// the decision's tests read exactly what the form draws and saves
// (ContentStep.tsx SingleDecision).
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import { COUNTRIES_BLOCKED_ANSWER, COUNTRIES_LEFT_OUT_ANSWER, blockedAndAllowed, countryCodesAnswer, leftOutChoiceLabel, leftOutChoices, parseCountryCodes } from '../../roadmap/countriesLockout.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { countryName } from '../../mapping/countries.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'

/** One country the Left out on purpose list offers: its code and its line. */
export type LeftOutOption = { code: string; label: string }

/**
 * The countries the Left out on purpose list offers against the work countries
 * picked now (not the saved ones, so adding a country above takes it off the
 * list at once): every country the sign-in records show in use that they leave
 * out, ticked or not. Empty where there is none, and then the list is not drawn.
 */
export function leftOutOptions(snapshot: Pick<TenantSnapshot, 'roles' | 'signInEvidence' | 'evidenceAggregates'>, picked: readonly string[]): LeftOutOption[] {
  return leftOutChoices(snapshot, picked).map((c) => ({ code: c.code, label: leftOutChoiceLabel(c) }))
}

/** The countries ticked when the decision opens: the saved decision's, else the plan's. */
export function initialLeftOut(saved: Pick<StepDecision, 'answers'> | null, mapping: Pick<MappingState, 'countriesLeftOut'>): string[] {
  const answer = saved?.answers?.[COUNTRIES_LEFT_OUT_ANSWER]
  return typeof answer === 'string' ? parseCountryCodes(answer) : [...(mapping.countriesLeftOut ?? [])]
}

/** What Save Countries saves for the list: the ticked countries still offered (one added above is no longer left out). */
export function leftOutAnswers(ticked: readonly string[], offered: readonly LeftOutOption[]): Record<string, string> {
  const shown = new Set(offered.map((o) => o.code))
  return { [COUNTRIES_LEFT_OUT_ANSWER]: countryCodesAnswer(ticked.filter((c) => shown.has(c.toUpperCase()))) }
}

/** The countries to block outright when the decision opens: the saved decision's, else the plan's; none by default. */
export function initialBlocked(saved: Pick<StepDecision, 'answers'> | null, mapping: Pick<MappingState, 'countriesBlockedOutright'>): string[] {
  const answer = saved?.answers?.[COUNTRIES_BLOCKED_ANSWER]
  return typeof answer === 'string' ? parseCountryCodes(answer) : [...(mapping.countriesBlockedOutright ?? [])]
}

/** What Save Countries saves for the countries to block outright. */
export function blockedAnswers(blocked: readonly string[]): Record<string, string> {
  return { [COUNTRIES_BLOCKED_ANSWER]: countryCodesAnswer(blocked) }
}

type BlockedWords = { label: string; text: string; conflictOne: string; conflictMany: string }

/** The decision's words for the countries to block outright (content: the allowed countries location's decision.blockedOutright). */
export function blockedWords(): BlockedWords | null {
  const d = (contentStepFor({ id: PREREQ_STEP_ID.allowedCountries, goalId: '' })?.decision ?? null) as { blockedOutright?: BlockedWords } | null
  return d?.blockedOutright ?? null
}

/**
 * Why the decision refuses to save, where a country is on both lists: a block on
 * an allowed country stops the people who work there. Null where nothing is on
 * both, and Save Countries saves.
 */
export function blockedConflictLine(allowed: readonly string[], blocked: readonly string[]): string | null {
  const both = blockedAndAllowed(allowed, blocked)
  const w = blockedWords()
  if (both.length === 0 || w === null) return null
  return fillText(both.length === 1 ? w.conflictOne : w.conflictMany, { countries: list(both.map(countryName)) })
}
