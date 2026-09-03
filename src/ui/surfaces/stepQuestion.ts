// A decision's options and its question (content.json decision.options,
// decision.question): whole options render as radios; an option that needs a
// value the scan cannot fill (the travel countries, the mail-sending devices)
// renders a picker instead, and its answer is the option's own words with the
// picked ids in the variable's place. The answer persists in the mapping as
// questionAnswers[stepId + ':' + label] (decisions.ts answerKey). Pure: no
// React, no DOM, so the demo fixture's tests can read it.
import { missingVars, whole } from '../../content/render.ts'
import { answerTextFor, parseAnswer } from '../../roadmap/answers.ts'
import { pickerKind } from './pickerRows.ts'

type Ex = Record<string, unknown>

/** One option: its text, and the variable it needs a value for (null: a radio). */
export type QuestionOption = { text: string; needs: string | null }
/** A decision's question: its label and text, and its options. */
export type QuestionView = { label: string; text: string; options: QuestionOption[] }

const VAR = /\{(?:list:)?[a-zA-Z0-9_]+\}/

/** The options as offered: whole ones as radios; one with an unfilled variable as a picker. */
export function optionsOf(options: unknown, ex: Ex): QuestionOption[] {
  if (!Array.isArray(options)) return []
  return options.filter((o): o is string => typeof o === 'string').map((text) => ({ text, needs: whole(text, ex) ? null : (missingVars(text, ex)[0] ?? null) }))
}

/** The decision's question, or null when it has none or its text has a hole. */
export function questionFor(d: Record<string, unknown> | null | undefined, ex: Ex): QuestionView | null {
  const q = d?.question as Record<string, unknown> | undefined
  if (!q || typeof q.label !== 'string' || typeof q.text !== 'string' || !whole(q.text, ex)) return null
  const options = optionsOf(q.options, ex)
  if (options.length === 0) return null
  return { label: q.label, text: q.text, options }
}

/** What a value option picks from: the step's own kind (countries on the countries step), accounts otherwise. */
export function valueSource(stepId: string): string | null {
  return pickerKind(stepId, null) === 'other' ? 'accounts' : null
}

/** The answer an option makes: its text, with the picked ids in the variable's place (answers.ts, the one rule). */
export function answerText(option: QuestionOption, picked: string[] = []): string {
  return option.needs ? answerTextFor(option.text, picked) : option.text
}

/** The option and the picked ids an answer came from; null when no option matches it (answers.ts parseAnswer, the one rule). */
export function answerParts(answer: string | null | undefined, options: QuestionOption[]): { option: QuestionOption; picked: string[] } | null {
  const p = parseAnswer(answer, options.map((o) => o.text))
  return p ? { option: options[p.index], picked: p.picked } : null
}
