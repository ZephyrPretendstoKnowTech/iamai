// The Work countries decision's own additions (Block Sign-ins From Countries Not
// Allowed's first task, saved under the location's id): the countries left out
// on purpose (v1.1 T1-2). Pure, so the decision's tests read exactly what the
// form draws and saves (ContentStep.tsx SingleDecision).
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import { COUNTRIES_LEFT_OUT_ANSWER, countryCodesAnswer, leftOutChoiceLabel, leftOutChoices, parseCountryCodes } from '../../roadmap/countriesLockout.ts'

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
