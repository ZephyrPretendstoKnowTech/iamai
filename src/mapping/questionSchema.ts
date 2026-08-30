// The Setup questions as data (prompt 36 part 3).
//
// Before this file, each question's component decided its own affordances: how
// many confirm buttons it drew, what the confirm button said, whether it
// offered a way out and how many. That is how one tenant ends up with three
// different labels for "yes, that is right" and seven different ways to skip a
// question. A question may no longer make those decisions. It declares what it
// is, and the renderer draws the affordances that follow.
//
// Pure: no DOM, no network. The copy fields are keys into SETUP_QUESTIONS, not
// sentences, so a question cannot inline its own wording either.
import type { RuleSubject } from '../validation/rules.ts'
import { SETUP_QUESTIONS } from '../copy/setup.ts'
import type { WizardQuestionId } from './wizard.ts'

/**
 * What kind of answer the question takes. The type, not the question, decides
 * which affordances the renderer draws.
 *
 * - `pick-objects`      choose named things from the tenant (users, groups)
 * - `confirm-default`   IAMAI has already worked out the answer; agree or change it
 * - `multi-select-confirm` choose any number from a fixed list, then confirm
 * - `toggle-grid`       a grid of on/off detections to correct, then confirm
 */
export type QuestionType = 'pick-objects' | 'confirm-default' | 'multi-select-confirm' | 'toggle-grid'

/**
 * The one way out of a question, or none.
 *
 * `doesNotExistYet` is the only permitted opt-out, and it is an answer rather
 * than a refusal: it tells IAMAI to put the thing in the plan. A question that
 * would need "not applicable to us" is a question that should not have been
 * asked of this tenant, which is what the applicability detection is for.
 *
 * Declaring this as one field rather than a set of booleans is the point: a
 * second opt-out is unrepresentable, not merely discouraged.
 */
export type OptOut = 'none' | 'doesNotExistYet'

export type QuestionCopyKeys = {
  /** Key in SETUP_QUESTIONS[id] holding the question itself. */
  title: 'question'
  /** Key holding the "why this matters" sentence. */
  why: 'why'
  /** Key holding the helper text behind the InfoTip. */
  help: 'help'
}

export type QuestionSchema = {
  id: WizardQuestionId
  type: QuestionType
  optOut: OptOut
  /** Fewest selections that count as answered. 0 means an empty answer is valid. */
  min: number
  /** Most selections allowed, or null for no ceiling. */
  max: number | null
  /** Which validation rules speak about this answer, or null if none do. */
  validationSubject: RuleSubject | null
  copy: QuestionCopyKeys
}

/** Every question reads its wording from the same three keys. */
const COPY: QuestionCopyKeys = { title: 'question', why: 'why', help: 'help' }

/**
 * The one confirm label in the app. Every confirm affordance says this, whatever
 * it is confirming: a list of countries, a time zone, a set of detected service
 * accounts, a grid of toggles. Three labels for one act made the tool feel like
 * four tools (review 07, C2).
 */
export const CONFIRM_LABEL_KEY = 'confirmLooksRight'

export const QUESTION_SCHEMA: QuestionSchema[] = [
  // Q1 and Q2 have no opt-out at all: a tenant either has break-glass accounts
  // and an exclusion group or needs them, and both cases are answers.
  { id: 'breakGlass', type: 'pick-objects', optOut: 'none', min: 2, max: null, validationSubject: 'breakGlass', copy: COPY },
  { id: 'globalExclusion', type: 'pick-objects', optOut: 'none', min: 1, max: 1, validationSubject: 'exclusionGroup', copy: COPY },
  { id: 'countries', type: 'multi-select-confirm', optOut: 'doesNotExistYet', min: 0, max: null, validationSubject: 'allowedCountries', copy: COPY },
  { id: 'highCare', type: 'pick-objects', optOut: 'doesNotExistYet', min: 0, max: null, validationSubject: null, copy: COPY },
  { id: 'trustedLocations', type: 'multi-select-confirm', optOut: 'doesNotExistYet', min: 0, max: null, validationSubject: 'trustedLocation', copy: COPY },
  { id: 'serviceAccounts', type: 'pick-objects', optOut: 'doesNotExistYet', min: 0, max: null, validationSubject: 'serviceAccount', copy: COPY },
  { id: 'timeZone', type: 'confirm-default', optOut: 'none', min: 1, max: 1, validationSubject: null, copy: COPY },
  { id: 'frameworks', type: 'multi-select-confirm', optOut: 'doesNotExistYet', min: 0, max: null, validationSubject: null, copy: COPY },
  { id: 'applicability', type: 'toggle-grid', optOut: 'none', min: 0, max: null, validationSubject: null, copy: COPY },
]

const BY_ID = new Map(QUESTION_SCHEMA.map((q) => [q.id, q]))

export function schemaFor(id: WizardQuestionId): QuestionSchema {
  const found = BY_ID.get(id)
  if (!found) throw new Error(`no schema for question ${id}`)
  return found
}

/** Resolve a question's declared copy keys to the sentences themselves. */
export function copyFor(id: WizardQuestionId): { title: string; why: string; help: string } {
  const { copy } = schemaFor(id)
  const source = SETUP_QUESTIONS[id]
  return { title: source[copy.title], why: source[copy.why], help: source[copy.help] }
}
