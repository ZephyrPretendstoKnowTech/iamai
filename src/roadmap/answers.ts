// What a stored answer means for the plan (E1, E2). A decision block in
// content.json offers options (its own, its question's, its strict toggle's);
// the answer persists as questionAnswers[stepId + ':' + label] in the option's
// own words, with the picked ids in the variable's place. This module parses an
// answer back against the content options and says what it changes: the
// countries a travellers answer adds, whether service providers leave the guests
// and countries policies, the accounts the mail-sending devices answer names,
// and how phones and computers are managed. The content file is the one source
// of every label and option; nothing here duplicates its words.
//
// Pure: no DOM, no network, and no import of the engine, so the engine, the
// decisions module and the surfaces can all read an answer.
import type { MappingState } from '../mapping/types.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { PREREQ_STEP_ID, stepIdForGoal } from './stepIds.ts'

/** The mapping key a step's answer persists under: questionAnswers[stepId + ':' + label]. */
export const answerKey = (stepId: string, label: string): string => `${stepId}:${label}`

/** The three places a decision block keeps options: its own, its question's, its strict toggle's. */
export type AnswerKind = 'decision' | 'question' | 'strict'

type ContentDecision = { label?: unknown; options?: unknown; question?: { label?: unknown; options?: unknown }; strict?: { label?: unknown; option?: unknown } }

function contentDecision(stepId: string): ContentDecision | null {
  const d = contentStepFor({ id: stepId, goalId: stepId.replace(/^s-goal-/, '') })?.decision
  return (d as ContentDecision | null | undefined) ?? null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

/**
 * The labels a step's decision block carries in content.json: the decision's
 * own (its options), its question's, and its strict toggle's. The answer keys
 * are built from these, so the content file is the one source of a label.
 */
export function questionLabels(stepId: string): Record<AnswerKind, string | null> {
  const d = contentDecision(stepId)
  return { decision: str(d?.label), question: str(d?.question?.label), strict: str(d?.strict?.label) }
}

/** The options a step's decision block offers, by kind; the strict toggle offers its one option. */
export function questionOptions(stepId: string, kind: AnswerKind): string[] {
  const d = contentDecision(stepId)
  const raw = kind === 'decision' ? d?.options : kind === 'question' ? d?.question?.options : d?.strict?.option !== undefined ? [d.strict.option] : undefined
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : []
}

const VAR = /\{(?:list:)?[a-zA-Z0-9_]+\}/

/** The answer an option makes: its text, with the picked ids in the variable's place. */
export function answerTextFor(option: string, picked: readonly string[] = []): string {
  return VAR.test(option) ? option.replace(VAR, picked.join(', ')) : option
}

/**
 * A stored answer parsed against its options: the option's index and the ids
 * picked into its variable; null when no option matches (the content changed
 * since the answer was saved, and the plan reads it as unanswered).
 */
export function parseAnswer(answer: string | null | undefined, options: readonly string[]): { index: number; picked: string[] } | null {
  if (typeof answer !== 'string') return null
  const exact = options.indexOf(answer)
  if (exact >= 0) return { index: exact, picked: [] }
  for (const [index, o] of options.entries()) {
    const m = VAR.exec(o)
    if (!m) continue
    const before = o.slice(0, m.index)
    const after = o.slice(m.index + m[0].length)
    if (answer.length < before.length + after.length || !answer.startsWith(before) || !answer.endsWith(after)) continue
    const middle = answer.slice(before.length, answer.length - after.length)
    return { index, picked: middle.split(', ').map((s) => s.trim()).filter((s) => s.length > 0) }
  }
  return null
}

export type Answer = { index: number; picked: string[]; text: string }

/** The stored answer to a step's decision, question or strict toggle, parsed against its content options; null while unanswered. */
export function answerOf(mapping: Pick<MappingState, 'questionAnswers'>, stepId: string, kind: AnswerKind): Answer | null {
  const label = questionLabels(stepId)[kind]
  if (!label) return null
  const text = mapping.questionAnswers?.[answerKey(stepId, label)]
  const parsed = parseAnswer(text, questionOptions(stepId, kind))
  return parsed && typeof text === 'string' ? { ...parsed, text } : null
}

/**
 * The effect line a decision block shows once its answer applied. The block's
 * `effect` is one line for every option but the first (the first option is the
 * answer that changes nothing), or one line per option, where an empty entry
 * shows nothing.
 */
export function effectLine(effect: unknown, answer: { index: number } | null): string | null {
  if (!answer) return null
  if (Array.isArray(effect)) {
    const e = effect[answer.index]
    return typeof e === 'string' && e.length > 0 ? e : null
  }
  return typeof effect === 'string' && effect.length > 0 && answer.index > 0 ? effect : null
}

// ---- The questions whose answers change the plan ----

/** The step each question sits on: the travellers question (the countries step), the partner question (the guests policy), the mail-sending devices (the legacy block), the device decision (its own step). */
export const QUESTION_STEP = {
  travel: PREREQ_STEP_ID.allowedCountries,
  partner: stepIdForGoal('guests-mfa'),
  mailDevices: stepIdForGoal('block-legacy-auth'),
  devices: PREREQ_STEP_ID.devicePlan,
} as const

/** The countries the travellers answer adds to the allowed list (Regularly: add: …), as upper-case codes. */
export function travelCountriesOf(mapping: Pick<MappingState, 'questionAnswers'>): string[] {
  const a = answerOf(mapping, QUESTION_STEP.travel, 'question')
  return a ? a.picked.map((c) => c.toUpperCase()) : []
}

/** True when the partner answer excludes the Service provider type from the guests and countries policies. */
export function serviceProvidersExcluded(mapping: Pick<MappingState, 'questionAnswers'>): boolean {
  const a = answerOf(mapping, QUESTION_STEP.partner, 'question')
  return a !== null && a.index > 0
}

/** The accounts the mail-sending devices answer names: they join the service-accounts group. */
export function mailDevicesOf(mapping: Pick<MappingState, 'questionAnswers'>): string[] {
  return answerOf(mapping, QUESTION_STEP.mailDevices, 'decision')?.picked ?? []
}

/** The steps an answered question adds to the plan (their words are content steps). */
export const CARVE_OUT_STEP_ID = { travel: 's-question-travel', partner: 's-question-partner', mailDevices: 's-question-mail-devices' } as const

/** The carve-out steps the stored answers call for: a travel notice when anyone travels, the partner exclusion, the mail-sending devices' relay. */
export function answeredCarveOuts(mapping: Pick<MappingState, 'questionAnswers'>): string[] {
  const out: string[] = []
  const travel = answerOf(mapping, QUESTION_STEP.travel, 'question')
  if (travel && travel.index > 0) out.push(CARVE_OUT_STEP_ID.travel)
  if (serviceProvidersExcluded(mapping)) out.push(CARVE_OUT_STEP_ID.partner)
  if (mailDevicesOf(mapping).length > 0) out.push(CARVE_OUT_STEP_ID.mailDevices)
  return out
}

// ---- The device decision (E2) ----

/** How phones and computers are managed, from the device step's answers, in the order its content options are written. */
export type DevicePlan = {
  phones: 'enrol' | 'apps' | 'none'
  /** Null while only the phones half is answered. */
  computers: 'enrol' | 'hybrid' | 'unmanaged' | null
  /** The strict option: a phone that is not enrolled is blocked, rather than left out of the policy. */
  blockPhones: boolean
  phonesText: string
  computersText: string | null
}
const PHONES = ['enrol', 'apps', 'none'] as const
const COMPUTERS = ['enrol', 'hybrid', 'unmanaged'] as const

/** The device decision as answered, or null while it is open. */
export function devicePlanOf(mapping: Pick<MappingState, 'questionAnswers'>): DevicePlan | null {
  const phones = answerOf(mapping, QUESTION_STEP.devices, 'decision')
  if (!phones) return null
  const computers = answerOf(mapping, QUESTION_STEP.devices, 'question')
  const strict = answerOf(mapping, QUESTION_STEP.devices, 'strict')
  return {
    phones: PHONES[phones.index] ?? 'none',
    computers: computers ? (COMPUTERS[computers.index] ?? null) : null,
    blockPhones: strict !== null,
    phonesText: phones.text,
    computersText: computers?.text ?? null,
  }
}

/**
 * Which platforms the device policies cover, and what counts as a managed
 * computer, from the answer. Open: phones out, computers in, compliant only.
 */
export type DeviceScope = { phones: boolean; computers: boolean; hybridCounts: boolean }
export function deviceScopeOf(plan: DevicePlan | null): DeviceScope {
  if (!plan) return { phones: false, computers: true, hybridCounts: false }
  return { phones: plan.phones === 'enrol' || plan.blockPhones, computers: plan.computers !== 'unmanaged', hybridCounts: plan.computers === 'hybrid' }
}

export { PHONE_PLATFORMS, COMPUTER_PLATFORMS, isPhoneOs } from '../derive/platforms.ts'
