// Where every Direction answer is stored (docs/plans/direction-spec.md,
// "Storage"): the one alias table between a Define Your Rollout Scope
// question and the key its answer has always lived under.
//
// A Direction step saves one decision under its own id (`stepDecisions[
// 's-direction-use']`, …), its answers keyed by question. Applying it
// (decisions.ts applyStepDecisions) expands it here into the decisions the
// retired and object steps have always saved — `s-confirm-workloads` for the
// services, `s-goal-block-legacy-auth` for the mail-sending devices, the
// pickers' own steps for the accounts and networks — so every reader
// downstream keeps reading exactly the values it read before, and an answer
// saved before Direction existed still reads as saved.
//
// Each answer is written under the key it is read from, whichever Direction
// step asks it (roadmap-flow Stage 3). The office network's own answer lives
// under `s-direction-locations`, a storage id and not a drawn step since the
// office network question joined Decide How and Where People Sign In: it was
// written under the id of the step being approved and read from
// s-direction-locations only, so it was lost and that step never completed.
//
// Reading goes the other way: `savedAnswerOf` reads a question's saved answer
// from the applied mapping, wherever it was saved from. A legacy "unsure" is
// no answer at all (owner, 2026-09-19): the suggestion shows and the step still
// needs approval.
//
// Pure: no DOM, no network, no engine import.
import type { MappingState } from '../mapping/types.ts'
import type { DirectionQuestion } from './types.ts'
import type { StepDecision, StepDecisionInput } from './decisions.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, answerKey, answerOf, answerTextFor, devicePlanOf, questionLabels, questionOptions } from './answers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { DIRECTION_STEP_IDS } from './stepGroups.ts'
import { directionWords } from '../content/content.ts'

export const DIRECTION_STEP = {
  use: DIRECTION_STEP_IDS[0],
  accounts: DIRECTION_STEP_IDS[1],
  devices: DIRECTION_STEP_IDS[2],
} as const

/**
 * Where the office network's own answer is stored: the id of the Direction step
 * that asked it until Stage 3 (Decide Where People Sign In From). It is a
 * storage id only — no step with this id is drawn — and a decision saved under
 * it still expands like a Direction step's (expandDirectionDecisions).
 */
export const DIRECTION_LOCATIONS_STORAGE = 's-direction-locations'
export type DirectionStepId = (typeof DIRECTION_STEP_IDS)[number]

export const isDirectionStep = (id: string): id is DirectionStepId => (DIRECTION_STEP_IDS as readonly string[]).includes(id)

/** The label prefix of the decision blocker a policy carries while it waits on a Direction answer (direction.ts gateOnDirection). */
export const DIRECTION_BLOCKER = 'direction:'

/**
 * Done: every answer saved, and none contradicted by new evidence. The one
 * reading of whether a Direction step is approved; it lives here, beside where
 * each answer is stored, so the foundation gate (roadmap/foundations.ts) can
 * read it without reaching through the step builder.
 */
export const directionComplete = (questions: readonly DirectionQuestion[]): boolean => questions.every((q) => q.saved !== null && !q.needsReview)

/** The Direction step a blocker waits on, or null for a blocker that is not one. */
export function directionBlockerStep(b: { kind: string; label: string }): DirectionStepId | null {
  if (b.kind !== 'decision' || !b.label.startsWith(DIRECTION_BLOCKER)) return null
  const id = b.label.slice(DIRECTION_BLOCKER.length)
  return isDirectionStep(id) ? id : null
}

/** The retired step whose decision the services have always saved under (workflowAnswers, facetOverrides). */
export const WORKFLOW_DECISION_STEP = 's-confirm-workloads'
/** The services D1 asks about, in the order the spec lists them. Intune is not one: it follows D3. */
export const SERVICE_KEYS = ['avd', 'sharepoint', 'azureManagement', 'inforcer', 'workload'] as const

/** One answer: the option's value, and the ids picked where the option takes a list. */
export type DirectionAnswer = { value: string; picked: string[] }

/**
 * A question's key: `service:<facet>` for a D1 service, else its own name.
 * Retired in Stage 3 (roadmap-flow V1 decision 4): external methods, device
 * exceptions and travel, which nothing read; work countries moved to the
 * countries step (6.3), which asks them with its own picker.
 */
export type DirectionQuestionKey =
  | `service:${string}`
  | 'mailDevices' | 'deviceCode' | 'partner'
  | 'serviceAccounts' | 'sharedDevices'
  | 'computers' | 'phones' | 'officeNetwork'

/**
 * The alias table: each question, the Direction step that asks it, and where
 * its answer is stored. `stepDecisions[<legacy>]` names the decision the
 * answer is written as; `questionAnswers` the key it lands under.
 */
export const DIRECTION_QUESTIONS: Readonly<Record<Exclude<DirectionQuestionKey, `service:${string}`> | 'service', { step: DirectionStepId; storedAs: string }>> = {
  service: { step: DIRECTION_STEP.use, storedAs: `stepDecisions['${WORKFLOW_DECISION_STEP}'] → workflowAnswers[<service>], facetOverrides[<service>]` },
  mailDevices: { step: DIRECTION_STEP.use, storedAs: `questionAnswers['${QUESTION_STEP.mailDevices}:<decision label>']` },
  deviceCode: { step: DIRECTION_STEP.use, storedAs: `questionAnswers['${QUESTION_STEP.deviceCode}:<decision label>']` },
  partner: { step: DIRECTION_STEP.use, storedAs: `questionAnswers['${QUESTION_STEP.partner}:<question label>']` },
  serviceAccounts: { step: DIRECTION_STEP.accounts, storedAs: 'serviceAccountUserIds, wizardAnswered.serviceAccounts' },
  sharedDevices: { step: DIRECTION_STEP.accounts, storedAs: 'sharedDeviceUserIds' },
  computers: { step: DIRECTION_STEP.devices, storedAs: `questionAnswers['${QUESTION_STEP.devices}:${DEVICE_ANSWER_KEYS.computers}']` },
  phones: { step: DIRECTION_STEP.devices, storedAs: `questionAnswers['${QUESTION_STEP.devices}:${DEVICE_ANSWER_KEYS.phoneManagement}'], [...:${DEVICE_ANSWER_KEYS.phoneAppProtection}]` },
  officeNetwork: { step: DIRECTION_STEP.devices, storedAs: `trustedLocationIds, wizardAnswered.trustedLocations, questionAnswers['${DIRECTION_LOCATIONS_STORAGE}:officeNetwork']` },
}

/** What approving a Direction step's answers does, in its own written words (pages.app.plan.direction.steps.<key>.milestoneAction); null for any other step. */
export function directionMilestoneAction(stepId: string): string | null {
  const key = (Object.entries(DIRECTION_STEP) as [string, string][]).find(([, id]) => id === stepId)?.[0]
  const text = key ? (directionWords.steps as Record<string, { milestoneAction?: unknown }>)[key]?.milestoneAction : undefined
  return typeof text === 'string' && text.trim() !== '' ? text : null
}

/** The Direction step that asks a question. */
export function directionStepOf(key: DirectionQuestionKey): DirectionStepId {
  return DIRECTION_QUESTIONS[key.startsWith('service:') ? 'service' : (key as keyof typeof DIRECTION_QUESTIONS)].step
}

/**
 * The office network's three answers, persisted under its own storage id
 * (DIRECTION_LOCATIONS_STORAGE) *as well as* the trusted-location decision
 * (owner, 2026-09-20): an answer saved before Direction existed still has to
 * read. The legacy
 * decision cannot tell "we have an office, it is not in Entra yet" from "nobody
 * has answered" — both are the office-network option with nothing picked — so
 * the own key carries the answer and the legacy reading remains the fallback.
 */
const OFFICE_NETWORK = ['office', 'notInEntra', 'remote'] as const

type Mapping = Pick<MappingState, 'questionAnswers' | 'workflowAnswers' | 'facetOverrides' | 'serviceAccountUserIds' | 'sharedDeviceUserIds' | 'wizardAnswered' | 'assumed' | 'trustedLocationIds'>

const answer = (value: string, picked: readonly string[] = []): DirectionAnswer => ({ value, picked: [...picked] })
/** A picker's own answer was saved by a person, never by the detected pass (pickerRows.ts defaultDecisions). */
const confirmed = (m: Mapping, q: string): boolean => m.wizardAnswered?.[q] === true && m.assumed?.[q] !== 'detected'

/**
 * Phones, as the three D3 options, from the device answers however they were
 * saved. "App protection only" and "Unmanaged" are one option now, No device
 * requirement, stored as apps: an old answer of either reads as it.
 */
function phonesOf(m: Mapping): string | null {
  const plan = devicePlanOf(m)
  if (!plan) return null
  if (plan.phoneManagement === 'enrolled' || (plan.phoneManagement === undefined && plan.phones === 'enrol')) return 'enrolled'
  if (plan.phoneManagement === 'blocked' || plan.noWorkPhones || (plan.phoneManagement === undefined && plan.phones === 'none')) return 'blocked'
  return 'apps'
}

/**
 * A question's saved answer, read from the applied mapping wherever it was
 * saved from (a Direction approval or the step that asked it before); null
 * while nobody has answered it. A legacy "unsure" is null.
 */
export function savedAnswerOf(key: DirectionQuestionKey, m: Mapping): DirectionAnswer | null {
  if (key.startsWith('service:')) {
    const facet = key.slice('service:'.length)
    const saved = m.workflowAnswers?.[facet]
    if (saved === 'yes' || saved === 'no') return answer(saved)
    if (saved === 'unsure') return null
    const override = m.facetOverrides?.[facet as keyof typeof m.facetOverrides]
    return override ? answer(override.on ? 'yes' : 'no') : null
  }
  switch (key) {
    case 'mailDevices': {
      const a = answerOf(m, QUESTION_STEP.mailDevices, 'decision')
      return a === null ? null : a.index === 0 ? answer('none') : answer('some', a.picked)
    }
    case 'deviceCode': {
      const a = answerOf(m, QUESTION_STEP.deviceCode, 'decision')
      return a === null ? null : answer(a.index === 0 ? 'unused' : 'used')
    }
    case 'partner': {
      const a = answerOf(m, QUESTION_STEP.partner, 'question')
      return a === null ? null : answer(a.index === 0 ? 'no' : 'yes')
    }
    case 'serviceAccounts':
      return confirmed(m, 'serviceAccounts') ? (m.serviceAccountUserIds.length > 0 ? answer('some', m.serviceAccountUserIds) : answer('none')) : null
    case 'sharedDevices':
      return m.sharedDeviceUserIds === undefined ? null : m.sharedDeviceUserIds.length > 0 ? answer('some', m.sharedDeviceUserIds) : answer('none')
    case 'computers': {
      // Hybrid joined is part of Managed now: an old hybrid answer reads as it.
      const c = devicePlanOf(m)?.computers ?? null
      return c === null ? null : answer(c === 'unmanaged' ? 'unmanaged' : 'managed')
    }
    case 'phones': {
      const p = phonesOf(m)
      return p === null ? null : answer(p)
    }
    case 'officeNetwork': {
      const own = m.questionAnswers?.[answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]
      if (typeof own === 'string' && (OFFICE_NETWORK as readonly string[]).includes(own)) return own === 'office' ? answer('office', m.trustedLocationIds) : answer(own)
      return confirmed(m, 'trustedLocations') ? (m.trustedLocationIds.length > 0 ? answer('office', m.trustedLocationIds) : answer('remote')) : null
    }
    default:
      return null
  }
}

// ---- the Direction decision, as saved ----

/**
 * Whether a question's answer can be approved: an answer that carries a list
 * carries at least one item. Approve answers is disabled until every question on
 * the step passes (DirectionQuestions.tsx); anything that approves on a person's
 * behalf reads the same rule.
 */
export function directionAnswerComplete(q: Pick<DirectionQuestion, 'control' | 'pickedWith'>, a: DirectionAnswer): boolean {
  return q.pickedWith !== null && a.value === q.pickedWith ? a.picked.length > 0 : true
}

/** The answers a Direction step's Approve writes: every question at once, the picked ids beside each, a service's evidence basis beside it. */
export function directionDecisionOf(answers: Readonly<Record<string, DirectionAnswer>>, basis: Readonly<Record<string, string>> = {}): StepDecisionInput {
  const out: Record<string, string> = {}
  for (const [key, a] of Object.entries(answers)) {
    out[key] = a.value
    if (a.picked.length > 0) out[`${key}:picked`] = a.picked.join(',')
    if (typeof basis[key] === 'string') out[`${key}:basis`] = basis[key]
  }
  return { answers: out }
}

/** The answers a saved Direction decision holds, by question key. */
export function answersOfDecision(d: Pick<StepDecision, 'answers'> | null | undefined): Record<string, DirectionAnswer> {
  const out: Record<string, DirectionAnswer> = {}
  for (const [key, value] of Object.entries(d?.answers ?? {})) {
    if (key.endsWith(':picked') || key.endsWith(':basis') || typeof value !== 'string') continue
    const picked = d?.answers?.[`${key}:picked`]
    out[key] = { value, picked: typeof picked === 'string' && picked.length > 0 ? picked.split(',') : [] }
  }
  return out
}

/**
 * A Direction step's saved decision as the decisions its answers have always
 * been saved as (the alias table above), in the order they apply: the legacy
 * steps' decisions, then the answer only Direction stores, under the storage
 * id it is read from (the office network's own answer, under
 * DIRECTION_LOCATIONS_STORAGE, whichever step asked it). `previous` is every
 * saved decision, so a legacy decision's other parts (a saved network draft)
 * are kept.
 */
export function legacyDecisionsOf(_stepId: DirectionStepId | typeof DIRECTION_LOCATIONS_STORAGE, d: StepDecision, previous: Readonly<Record<string, StepDecision>> = {}): [string, StepDecision][] {
  const answers = answersOfDecision(d)
  const at = d.at
  const out: [string, StepDecision][] = []
  const own: Record<string, string> = {}
  const option = (stepId: string, kind: 'decision' | 'question', index: number, picked: readonly string[] = []): string | null => {
    const o = questionOptions(stepId, kind)[index]
    return typeof o === 'string' ? answerTextFor(o, picked) : null
  }
  const services: Record<string, string> = {}
  for (const [key, a] of Object.entries(answers)) {
    if (key.startsWith('service:') && (a.value === 'yes' || a.value === 'no')) {
      const facet = key.slice('service:'.length)
      services[facet] = a.value
      const basis = d.answers?.[`${key}:basis`]
      if (typeof basis === 'string') services[`evidence:${facet}`] = basis
    }
  }
  if (Object.keys(services).length > 0) out.push([WORKFLOW_DECISION_STEP, { answers: { ...(previous[WORKFLOW_DECISION_STEP]?.answers ?? {}), ...services }, at }])
  const mail = answers.mailDevices
  if (mail) {
    const text = mail.value === 'some' && mail.picked.length > 0 ? option(QUESTION_STEP.mailDevices, 'decision', 1, mail.picked) : option(QUESTION_STEP.mailDevices, 'decision', 0)
    if (text !== null) out.push([QUESTION_STEP.mailDevices, { option: text, at }])
  }
  const code = answers.deviceCode
  if (code) {
    const text = option(QUESTION_STEP.deviceCode, 'decision', code.value === 'used' ? 1 : 0)
    if (text !== null) out.push([QUESTION_STEP.deviceCode, { option: text, at }])
  }
  const partner = answers.partner
  const partnerLabel = questionLabels(QUESTION_STEP.partner).question
  if (partner && partnerLabel) {
    const text = option(QUESTION_STEP.partner, 'question', partner.value === 'yes' ? 1 : 0)
    if (text !== null) out.push([QUESTION_STEP.partner, { ...previous[QUESTION_STEP.partner], answers: { ...(previous[QUESTION_STEP.partner]?.answers ?? {}), [partnerLabel]: text }, at }])
  }
  if (answers.serviceAccounts) out.push([PREREQ_STEP_ID.serviceAccountsGroup, { picked: answers.serviceAccounts.value === 'some' ? answers.serviceAccounts.picked : [], at }])
  if (answers.sharedDevices) out.push(['s-shared-devices', { picked: answers.sharedDevices.value === 'some' ? answers.sharedDevices.picked : [], at }])
  const computers = answers.computers
  const phones = answers.phones
  if (computers || phones) {
    const device: Record<string, string> = {}
    const current = previous[QUESTION_STEP.devices]?.answers ?? {}
    for (const k of Object.values(DEVICE_ANSWER_KEYS)) if (typeof current[k] === 'string') device[k] = current[k]
    if (computers) device[DEVICE_ANSWER_KEYS.computers] = computers.value === 'managed' ? 'enrolled' : computers.value
    if (phones) {
      const [management, protection] = ({ enrolled: ['enrolled', 'required'], apps: ['unmanaged', 'required'], unmanaged: ['unmanaged', 'not-required'], blocked: ['blocked', 'not-required'] } as Record<string, [string, string]>)[phones.value] ?? ['unmanaged', 'required']
      device[DEVICE_ANSWER_KEYS.phoneManagement] = management
      device[DEVICE_ANSWER_KEYS.phoneAppProtection] = protection
    }
    out.push([QUESTION_STEP.devices, { answers: device, at }])
  }
  const network = answers.officeNetwork
  if (network) {
    // Three answers, two legacy shapes. "Everyone works remotely" sets the step
    // aside; both "we have one" answers keep it, and the one with nothing picked
    // is the tenant whose office is not a named location yet (decisions.ts:
    // office-network with an empty pick leaves its own question unanswered).
    const remote = network.value === 'remote'
    if ((OFFICE_NETWORK as readonly string[]).includes(network.value)) own.officeNetwork = network.value
    const kept = previous[PREREQ_STEP_ID.trustedLocation]?.answers
    out.push([PREREQ_STEP_ID.trustedLocation, { picked: network.value === 'office' ? network.picked : [], option: remote ? 'remote' : 'office-network', ...(kept ? { answers: kept } : {}), at }])
  }
  // Under the key it is read from (savedAnswerOf), never the approving step's.
  if (Object.keys(own).length > 0) out.push([DIRECTION_LOCATIONS_STORAGE, { answers: own, at }])
  return out
}

/**
 * Every saved decision with each Direction decision expanded in its place into
 * the decisions its answers are stored as (legacyDecisionsOf), so the one
 * applier reads them in the order they were saved: a Direction approval saved
 * after an older answer wins, as that older step's own Save always did.
 */
export function expandDirectionDecisions(stepDecisions: Readonly<Record<string, StepDecision>>): [string, StepDecision][] {
  const out: [string, StepDecision][] = []
  for (const [id, d] of Object.entries(stepDecisions)) {
    if (!d) continue
    // The drawn steps and the office network's storage id, whose decision an
    // older save may hold whole (DIRECTION_LOCATIONS_STORAGE).
    if (isDirectionStep(id) || id === DIRECTION_LOCATIONS_STORAGE) out.push(...legacyDecisionsOf(id, d, stepDecisions))
    else out.push([id, d])
  }
  return out
}
