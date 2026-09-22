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
import { pages } from '../content/content.ts'
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
 * The two answers every Baseline mapping is given in (content.json
 * pages.plan.settings.mappings.options), in order: this tenant needs no
 * counterpart, or this tenant's own object, picked into the option's variable.
 * An answer persists under the mappings key, one per source id (sourceMappings.ts).
 */
export function referenceOptions(): string[] {
  const raw = ((pages.plan as { settings?: { mappings?: { options?: unknown } } }).settings?.mappings?.options)
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : []
}

/** A source-reference answer read back: leave it out, or the tenant object picked; null while unanswered or unreadable. */
export function referenceAnswer(answer: string | null | undefined): { omit: true } | { objectId: string } | null {
  const parsed = parseAnswer(answer, referenceOptions())
  if (!parsed) return null
  if (parsed.index === 0) return { omit: true }
  return parsed.index === 1 && parsed.picked.length > 0 ? { objectId: parsed.picked[0] } : null
}

/**
 * The labels a step's decision block carries in content.json: the decision's
 * own (its options), its question's, and its strict toggle's. The answer keys
 * are built from these, so the content file is the one source of a label.
 */
export function questionLabels(stepId: string): Record<AnswerKind, string | null> {
  const d = contentDecision(stepId)
  return { decision: str(d?.label), question: str(d?.question?.label), strict: str(d?.strict?.label) ?? (stepId === PREREQ_STEP_ID.devicePlan ? 'Block phones' : null) }
}

/** The options a step's decision block offers, by kind; the strict toggle offers its one option. */
export function questionOptions(stepId: string, kind: AnswerKind): string[] {
  const d = contentDecision(stepId)
  // Read saved restrictions from before the redundant toggle was removed.
  if (stepId === PREREQ_STEP_ID.devicePlan && kind === 'strict' && !d?.strict) return ['Block phones that are not enrolled']
  const raw = kind === 'decision' ? d?.options : kind === 'question' ? d?.question?.options : d?.strict?.option !== undefined ? [d.strict.option] : undefined
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : []
}

const VAR = /\{(?:list:)?[a-zA-Z0-9_]+\}/

/** The answer an option makes: its text, with the picked ids in the variable's place. */
export function answerTextFor(option: string, picked: readonly string[] = []): string {
  return VAR.test(option) ? option.replace(VAR, picked.join(', ')) : option
}

/**
 * Option words the content has since renamed, old → new: the device decision's
 * US spelling and structure (owner, 2026-09-11). A stored answer is its option's
 * words, so a rename would read every saved answer as unanswered; the old words
 * still answer the option they always answered.
 */
const RENAMED_OPTIONS: Readonly<Record<string, string>> = {
  'Enrol phones in Intune': 'Enroll phones in Intune',
  'Protect the apps only': 'Protect company apps only',
  'No company data on phones': 'Keep company data off phones',
  'Enrol in Intune': 'Enroll in Intune',
  'Hybrid-joined is enough': 'Hybrid-joined Windows computers',
  'Hybrid join is sufficient': 'Hybrid-joined Windows computers',
}

/** A stored answer in the content's current words. */
export function currentAnswerText(answer: string): string {
  if (answer.startsWith('Regularly: add: ')) return answer.replace('Regularly: add: ', 'Countries used regularly: ')
  const mail = /^Yes: add: (.*); the service-accounts group carries them$/.exec(answer)
  if (mail) return `Temporary exception accounts: ${mail[1]}`
  return RENAMED_OPTIONS[answer] ?? answer
}

/**
 * A stored answer parsed against its options: the option's index and the ids
 * picked into its variable; null when no option matches (the content changed
 * since the answer was saved, and the plan reads it as unanswered).
 */
export function parseAnswer(answer: string | null | undefined, options: readonly string[]): { index: number; picked: string[] } | null {
  if (typeof answer !== 'string') return null
  answer = currentAnswerText(answer)
  if (options.includes('No Recurring Destinations')) {
    if (answer === 'Nobody' || answer.startsWith('Occasionally:')) answer = 'No Recurring Destinations'
    if (answer.startsWith('Countries used regularly: ')) answer = answer.replace('Countries used regularly: ', 'Select Recurring Destinations ')
  }
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
  const legacyLabels = stepId === PREREQ_STEP_ID.allowedCountries
    ? kind === 'decision' ? ['Allowed countries', 'Work Countries'] : kind === 'question' ? ['People who travel or work abroad', 'Recurring Travel Countries'] : []
    : []
  const text = [label, ...legacyLabels].map(key => mapping.questionAnswers?.[answerKey(stepId, key)]).find(value => typeof value === 'string')
  const parsed = parseAnswer(text, questionOptions(stepId, kind))
  return parsed && typeof text === 'string' ? { ...parsed, text: currentAnswerText(text) } : null
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

/** The step each question sits on: the travellers question (the countries step), the partner question (the guests policy), the mail-sending devices (the legacy block), device code sign-in (the device code block), the device decision (its own step). */
export const QUESTION_STEP = {
  travel: PREREQ_STEP_ID.allowedCountries,
  partner: stepIdForGoal('guests-mfa'),
  mailDevices: stepIdForGoal('block-legacy-auth'),
  deviceCode: stepIdForGoal('block-device-code'),
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

/** The plan's device code decision (decisions.deviceCodeWorkflows): true where someone uses device code sign-in, false on None, null until a Save. */
export function deviceCodeWorkflowsOf(mapping: Pick<MappingState, 'questionAnswers'>): boolean | null {
  const a = answerOf(mapping, QUESTION_STEP.deviceCode, 'decision')
  return a === null ? null : a.index > 0
}

/*
 * There are no carve-out steps left. Three answers each used to add a step of
 * their own (docs/plans/step-redundancy-analysis.md findings 4, 5 and 6):
 *
 *   travel        named a step nothing ever pushed, so it could not be generated;
 *   partner       named a step whose whole instruction was to read two others,
 *                 both of which already carry the Service provider exclusion;
 *   mailDevices   named a step whose work is the second half of Block Legacy
 *                 Authentication's own outcome, and which drew a different
 *                 anatomy beside it in the same group.
 *
 * Each answer still asks, stores and changes the plan exactly as it did; what
 * changed is that the work landed on the step that owns the outcome.
 */

/**
 * The conditional inputs (U28): questions whose answer changes the plan and that
 * the scan can only suggest — the mail-sending devices, device code sign-in,
 * partner access. Each is asked in Decide Your Tenant's Direction (roadmap/
 * direction.ts) and persists as questionAnswers[stepId:label] on the step it
 * changes; evidence may pre-fill one, and only an approval records it, "None"
 * included. Until then the step it changes is short of Completed.
 */
/** The registration campaign, whose special-care list a person confirms (S-MC-2). */
export const SPECIAL_CARE_STEP_ID = 's-verify-mfa'

type InputRecord = Pick<MappingState, 'questionAnswers' | 'specialCareConfirmed'>

/**
 * `prefilled`: IAMAI has an answer already and is waiting to have it
 * confirmed, not waiting to be told. The three questions genuinely ask the
 * person something the tenant cannot say; the campaign's support list is
 * computed from readiness and opens filled (ui/surfaces/pickerRows.ts
 * defaultDecisions). A row that says "waiting on your answer" over a list of
 * ten names IAMAI worked out itself is telling the reader the wrong thing
 * about who is holding the step.
 */
const CONDITIONAL_INPUTS: readonly { stepId: string; kind: AnswerKind; prefilled?: true; saved?: (mapping: InputRecord) => boolean }[] = [
  { stepId: QUESTION_STEP.mailDevices, kind: 'decision' },
  { stepId: QUESTION_STEP.deviceCode, kind: 'decision' },
  { stepId: QUESTION_STEP.partner, kind: 'question' },
  // The campaign's special-care people (B10 P0-10, S-MC-2, A6): saved once a
  // person's Save confirms the list, an empty one included.
  { stepId: SPECIAL_CARE_STEP_ID, kind: 'decision', prefilled: true, saved: (mapping) => Array.isArray(mapping.specialCareConfirmed) },
]

/** The labels of the conditional inputs on a step nobody has saved; a question its content does not ask is not one. */
export function unsavedInputsOf(stepId: string, mapping: InputRecord): string[] {
  return openInputsOf(stepId, mapping).map((input) => input.label)
}

/** The same inputs, each saying whether IAMAI has already filled it (`prefilled`) or is asking. */
export function openInputsOf(stepId: string, mapping: InputRecord): { label: string; prefilled: boolean }[] {
  const out: { label: string; prefilled: boolean }[] = []
  for (const input of CONDITIONAL_INPUTS) {
    if (input.stepId !== stepId) continue
    const label = questionLabels(stepId)[input.kind]
    const saved = input.saved ? input.saved(mapping) : answerOf(mapping, stepId, input.kind) !== null
    if (label !== null && !saved) out.push({ label, prefilled: input.prefilled === true })
  }
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
  phoneManagement?: 'enrolled' | 'registered' | 'unmanaged' | 'blocked'
  phoneAppProtection?: 'required' | 'not-required'
  noWorkPhones?: boolean
}
export const DEVICE_ANSWER_KEYS = { phoneManagement: 'phoneManagement', phoneAppProtection: 'phoneAppProtection', computers: 'computerManagement' } as const
const PHONES = ['enrol', 'apps', 'none'] as const
const COMPUTERS = ['enrol', 'hybrid', 'unmanaged'] as const

/** The device decision as answered, or null while it is open. */
export function devicePlanOf(mapping: Pick<MappingState, 'questionAnswers'>): DevicePlan | null {
  const values = mapping.questionAnswers ?? {}
  const read = (key: string) => values[answerKey(QUESTION_STEP.devices, key)]
  const management = read(DEVICE_ANSWER_KEYS.phoneManagement)
  if (management !== undefined) {
    const apps = read(DEVICE_ANSWER_KEYS.phoneAppProtection)
    const computer = read(DEVICE_ANSWER_KEYS.computers)
    if (!['enrolled', 'registered', 'unmanaged', 'blocked'].includes(management) || !['required', 'not-required'].includes(apps ?? '') || !['enrolled', 'hybrid', 'unmanaged'].includes(computer ?? '')) return null
    const phoneManagement = management as NonNullable<DevicePlan['phoneManagement']>
    return {
      phones: management === 'enrolled' ? 'enrol' : management === 'blocked' ? 'none' : 'apps',
      computers: computer === 'enrolled' ? 'enrol' : computer as 'hybrid' | 'unmanaged',
      blockPhones: false,
      phoneManagement,
      phoneAppProtection: apps as NonNullable<DevicePlan['phoneAppProtection']>,
      noWorkPhones: management === 'blocked',
      phonesText: ({ enrolled: 'Enrolled in Intune', registered: 'Registered in Entra', unmanaged: 'No device management', blocked: 'Keep company data off phones' })[phoneManagement],
      computersText: ({ enrolled: 'Enrolled in Intune', hybrid: 'Hybrid-joined Windows computers', unmanaged: 'Unmanaged computers' })[computer as 'enrolled' | 'hybrid' | 'unmanaged'],
    }
  }
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
    phoneManagement: phones.index === 0 ? 'enrolled' : phones.index === 2 ? 'blocked' : undefined,
    phoneAppProtection: phones.index === 1 ? 'required' : phones.index === 2 ? 'not-required' : undefined,
    noWorkPhones: phones.index === 2,
  }
}

/** Legacy scope is preserved while newly split, previously unanswered choices remain open. */
export function devicePlanComplete(plan: DevicePlan | null): boolean {
  return !!plan && plan.computers !== null && plan.phoneManagement !== undefined && plan.phoneAppProtection !== undefined
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
