// Define Your Rollout Scope (docs/plans/direction-spec.md): the Plan's
// second section, and with Emergency Access the plan's foundation. Three
// decision steps, answers only; nothing changes in Entra.
//
//   D1 s-direction-use        Confirm What You Use
//   D2 s-direction-accounts   Identify Service and Shared Accounts
//   D3 s-direction-devices    Decide How and Where People Sign In
//
// Stage 3 (docs/plans/roadmap-flow, V1 decisions 3 and 4): the office network
// question joined D3 from Decide Where People Sign In From, whose id stays only
// as the office network answer's storage key (directionAnswers.ts
// DIRECTION_LOCATIONS_STORAGE); work countries moved to Block Sign-ins From
// Countries Not Allowed, which asks them with its own picker; external
// methods, device exceptions and travel were retired, because nothing read
// their answers.
//
// Every question has a suggestion and nothing is hidden on evidence alone:
//   * a "what you use" question is pre-filled with today's state, from the scan;
//   * a "how it should work" question with the baseline's recommendation, what
//     the scan saw shown beside it;
//   * with no signal, the safe answer: a service is Yes (it keeps its policy),
//     an exception is None or Not used (no exception is granted), and the card
//     shows no evidence line (walk list 14).
// Only data the snapshot already holds is read: no Graph permission, no new
// collection.
//
// A step is done when every answer in it is saved (directionAnswers.ts reads
// where each one lives). A completed step reopens only when new evidence
// contradicts a saved answer — a service answered No that the scan now sees in
// use — and never because evidence went missing.
//
// A policy waits only on the answers it depends on (`gateOnDirection`): until
// they are saved it carries a decision blocker naming the Direction step, which
// holds it undated (roadmap/holds.ts) and the lane engine reads as On Hold ·
// Waiting on your answers (ui/surfaces/planLanes.ts observe). A policy that
// depends on no answer is unaffected.
//
// Pure: no DOM, no network.
import goals from '../../data/goals.json' with { type: 'json' }
import { directionWords } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { list } from '../copy/statements.ts'
import { contentTitle } from '../content/stepTitle.ts'
import type { NotAssessed } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { detectServiceAccounts } from '../mapping/serviceAccounts.ts'
import { personLabels } from '../names.ts'
import { sharedDeviceUsers } from '../derive/sharedDevices.ts'
import { phoneSignInIds } from '../derive/sets.ts'
import { setState } from './lifecycle.ts'
import { DEVICE_GOALS } from './deviations.ts'
import { QUESTION_STEP } from './answers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { checkStep, serviceEvidence, serviceOf, serviceReading } from './workflows.ts'
import type { ServiceSignal } from './workflows.ts'
import { DIRECTION_BLOCKER, DIRECTION_STEP, SERVICE_KEYS, directionComplete, directionStepOf, isDirectionStep, savedAnswerOf, savedBasisOf } from './directionAnswers.ts'
export { DIRECTION_BLOCKER, directionBlockerStep, directionComplete } from './directionAnswers.ts'
import type { DirectionQuestionKey, DirectionStepId } from './directionAnswers.ts'
import type { DirectionQuestion, Step } from './types.ts'

const W = directionWords
const Q = W.questions

type Answer = { value: string; picked: string[] }
const answer = (value: string, picked: readonly string[] = []): Answer => ({ value, picked: [...picked] })
const optionsOf = (words: Record<string, string>): DirectionQuestion['options'] => Object.entries(words).map(([value, label]) => ({ value, label }))

type Context = { snapshot: TenantSnapshot; mapping: MappingState }

function question(key: DirectionQuestionKey, ctx: Context, q: Omit<DirectionQuestion, 'key' | 'saved' | 'needsReview' | 'basis' | 'today' | 'note' | 'pickedWith'> & Partial<Pick<DirectionQuestion, 'today' | 'note' | 'pickedWith' | 'basis' | 'needsReview'>>): DirectionQuestion {
  return { key, today: null, note: null, pickedWith: null, basis: null, needsReview: false, ...q, saved: savedAnswerOf(key, ctx.mapping) }
}

// ---- D1 Confirm What You Use ----

function serviceQuestion(key: string, signal: ServiceSignal, ctx: Context): DirectionQuestion {
  const saved = savedAnswerOf(`service:${key}`, ctx.mapping)
  // A saved No the scan now contradicts reopens the step; a saved answer whose
  // evidence merely went missing does not (the basis it was saved against says
  // whether that usage was already known).
  const needsReview = saved?.value === 'no' && signal.used && ctx.mapping.workflowEvidenceBasis?.[key] !== 'present'
  const suggested = signal.used ? answer('yes') : signal.complete ? answer('no') : answer('yes')
  const label = (Q.services as Record<string, string>)[key] ?? key
  // What the scan saw, in the one sentence the Inventory's Detected workloads
  // shows too (workflows.ts serviceEvidence); where it saw nothing that can be
  // said, the card says nothing.
  const seen = serviceEvidence(key, signal)
  return {
    // Its consequence line names the plan's steps, so it is written once the plan is whole (noteServiceConsequences).
    ...question(`service:${key}`, ctx, { label, control: 'choice', options: optionsOf(Q.serviceOptions), suggested, evidence: seen ?? '' }),
    needsReview,
    basis: signal.used ? 'present' : signal.complete ? 'absent' : 'unread',
    ...(needsReview && seen !== null ? { evidence: fillText(W.reopened, { answer: Q.serviceOptions.no, evidence: seen }) } : {}),
  }
}

const signInsRead = (s: TenantSnapshot): boolean => s.sources.signInEvidence?.status === 'ok' || s.sources.signInEvidence?.status === 'partial'
/**
 * Whether the sign-in records were read whole, 30 days of them: a sign-in line
 * is said only then, on all three Direction steps. Over a read that stopped
 * short a card says nothing about sign-ins (walk list 14, 64).
 */
const signInsReadWhole = (s: TenantSnapshot): boolean => s.sources?.signInEvidence?.status === 'ok'

/**
 * Devices or apps that send mail by signing in: the accounts the old-protocol
 * sign-in records show sending by SMTP in the last 30 days; null where those
 * records were not read.
 */
export function mailSenderIds(snapshot: TenantSnapshot): string[] | null {
  const legacy = signInsRead(snapshot) ? snapshot.scenarioEvidence?.legacyClients ?? null : null
  return legacy === null ? null : Object.entries(legacy.byPerson).filter(([, clients]) => clients.some((c) => /smtp/i.test(c))).map(([id]) => id).sort()
}

/** Whether the mail-sending picker offers an account: never an emergency access account or a guest. */
export function mailPickable(snapshot: Pick<TenantSnapshot, 'users'>, mapping: Pick<MappingState, 'breakGlassUserIds'>): (id: string) => boolean {
  const guests = new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id))
  return (id) => !guests.has(id) && !mapping.breakGlassUserIds.includes(id)
}

function useQuestions(ctx: Context, services: { keys: string[]; signal: (key: string) => ServiceSignal }): DirectionQuestion[] {
  const { snapshot } = ctx
  const out = SERVICE_KEYS.filter((k) => services.keys.includes(k)).map((k) => serviceQuestion(k, services.signal(k), ctx))
  // The evidence counts every sender the records show; the suggestion picks only
  // the ones the picker offers (mailPickable).
  const senders = mailSenderIds(snapshot)
  const pickable = (senders ?? []).filter(mailPickable(snapshot, ctx.mapping))
  const mailSeen = senders === null || !signInsReadWhole(snapshot) ? '' : senders.length > 0 ? fillText(Q.mailDevices.seen, { n: senders.length }) : Q.mailDevices.notSeen
  // A saved None the scan now contradicts reopens, as a service's No does,
  // unless it was approved while that use was already seen (its basis).
  const mailReview = savedAnswerOf('mailDevices', ctx.mapping)?.value === 'none' && pickable.length > 0 && savedBasisOf('mailDevices', ctx.mapping) !== 'present'
  out.push(question('mailDevices', ctx, {
    label: Q.mailDevices.label, control: 'accounts', options: optionsOf(Q.accountOptions), pickedWith: 'some',
    suggested: pickable.length > 0 ? answer('some', pickable) : answer('none'),
    evidence: mailReview && mailSeen !== '' ? fillText(W.reopened, { answer: Q.accountOptions.none, evidence: mailSeen }) : mailSeen,
    note: Q.mailDevices.consequence,
    needsReview: mailReview,
    basis: senders === null ? 'unread' : pickable.length > 0 ? 'present' : 'absent',
  }))
  const partners = snapshot.scenarioEvidence?.serviceProviderSignIns ?? null
  const partnersUsed = partners !== null && partners.count > 0
  // Accounts, never sign-ins: records that name no account say nothing either way.
  const partnerSeen = partners === null || !signInsReadWhole(snapshot) ? '' : partners.people.length > 0 ? fillText(Q.partner.seen, { n: partners.people.length }) : partners.count === 0 ? Q.partner.notSeen : ''
  const partnerReview = savedAnswerOf('partner', ctx.mapping)?.value === 'no' && partnersUsed && savedBasisOf('partner', ctx.mapping) !== 'present'
  out.push(question('partner', ctx, {
    label: Q.partner.label, control: 'choice', options: optionsOf(Q.partner.options),
    suggested: answer(partnersUsed ? 'yes' : 'no'),
    evidence: partnerReview && partnerSeen !== '' ? fillText(W.reopened, { answer: Q.partner.options.no, evidence: partnerSeen }) : partnerSeen,
    note: Q.partner.consequence,
    needsReview: partnerReview,
    basis: partnersUsed ? 'present' : partners !== null && signInsRead(snapshot) ? 'absent' : 'unread',
  }))
  return out
}

/**
 * Whether the authentication methods policy the scan read has an external
 * authentication method (a third-party MFA provider) enabled; null where the
 * policy was not read.
 *
 * Confirm What You Use asked about this until Stage 3 retired the question
 * (roadmap-flow V1 decision 4: nothing read its answer). The detection is kept,
 * unasked, because a later release may need it.
 */
export function externalMethodsEnabled(snapshot: Pick<TenantSnapshot, 'config'>): boolean | null {
  const methods = snapshot.config.authMethodsPolicy?.status === 'ok' ? (snapshot.config.authMethodsPolicy.rows ?? []) : null
  return methods === null ? null : methods.some((row) => ((row as { authenticationMethodConfigurations?: { '@odata.type'?: string; state?: string }[] }).authenticationMethodConfigurations ?? []).some((c) => /externalAuthenticationMethod/i.test(c['@odata.type'] ?? '') && c.state === 'enabled'))
}

// ---- D2 Identify Service and Shared Accounts ----

function accountQuestions(ctx: Context, nameOf: (id: string) => string): DirectionQuestion[] {
  const { snapshot, mapping } = ctx
  // Whether the directory's user rows were read. A read without last-sign-in
  // times (partial: signInActivity is licence-gated) still holds every account.
  const usersRead = snapshot.sources.users?.status === 'ok' || snapshot.sources.users?.status === 'partial'
  const candidates = detectServiceAccounts(snapshot, [...mapping.breakGlassUserIds, ...mapping.serviceAccountRejectedIds]).map((c) => c.id)
  const shared = sharedDeviceUsers(snapshot).map((u) => u.id).filter((id) => !mapping.breakGlassUserIds.includes(id))
  const setAside = mapping.breakGlassUserIds.length > 0 ? fillText(W.alreadySetAside, { names: mapping.breakGlassUserIds.map(nameOf).join(', ') }) : null
  // What the scan saw; where the user rows were not read it holds no fact, and the card shows no evidence line.
  const seen = (words: { seen: string; seenOne: string; notSeen: string }, n: number): string => !usersRead ? '' : n > 1 ? fillText(words.seen, { n }) : n === 1 ? words.seenOne : words.notSeen
  return [
    question('serviceAccounts', ctx, {
      label: Q.serviceAccounts.label, control: 'accounts', options: optionsOf(Q.accountOptions), pickedWith: 'some',
      suggested: candidates.length > 0 ? answer('some', candidates) : answer('none'),
      evidence: seen(Q.serviceAccounts, candidates.length),
      note: [Q.serviceAccounts.note, setAside].filter((line): line is string => line !== null).join(' '),
    }),
    question('sharedDevices', ctx, {
      label: Q.sharedDevices.label, control: 'accounts', options: optionsOf(Q.accountOptions), pickedWith: 'some',
      suggested: shared.length > 0 ? answer('some', shared) : answer('none'),
      evidence: seen(Q.sharedDevices, shared.length),
      note: Q.sharedDevices.note,
    }),
  ]
}

// ---- D3 Decide How and Where People Sign In ----

/**
 * What the Managed answer costs in licences, where the scan read them.
 *
 * Null where Intune was never read: an absent capability is not the same as
 * zero seats, and inventing a licence position is the failure this whole
 * question exists to avoid.
 */
function intuneSeatLine(ctx: Context): string | null {
  const intune = ctx.snapshot.capabilities?.intune
  if (intune === undefined || intune === null) return null
  if (intune.enabled !== true) return Q.computers.intuneAbsent
  const { seats, consumed } = intune
  if (typeof seats !== 'number' || typeof consumed !== 'number') return null
  return fillText(Q.computers.intuneSeats, { consumed, seats })
}

function deviceQuestions(ctx: Context): DirectionQuestion[] {
  const evidence = ctx.snapshot.scenarioEvidence ?? null
  const unjoined = evidence?.unjoinedComputers?.people.length
  const registered = evidence?.registeredComputers?.people.length
  // Who signed in from a phone: the one reading MFA Readiness draws its phones from (derive/sets.ts).
  const phones = phoneSignInIds(ctx.snapshot)?.length
  // A sign-in line is said only over sign-in records read whole, 30 days of
  // them; over a read that stopped short the card says nothing about sign-ins
  // (walk list 64).
  const readWhole = ctx.snapshot.sources?.signInEvidence?.status === 'ok'
  const seen = (n: number | undefined, some: string, none: string | null): string | null => !readWhole || n === undefined ? null : n > 0 ? fillText(some, { n }) : none
  const lines = (...all: (string | null)[]): string => all.filter((line): line is string => line !== null).join(' ')
  return [
    question('computers', ctx, {
      label: Q.computers.label, control: 'choice', options: optionsOf(Q.computers.options),
      // What Managed would cost here: the Intune licences the tenant holds.
      suggested: answer('managed'),
      // Two populations, each saying what it counted. `unjoinedComputers` is
      // devices with NO trust type; a REGISTERED computer is not joined either,
      // so leaving the registered ones out understated a 2,339-person fleet as 3.
      evidence: lines(
        intuneSeatLine(ctx),
        seen(unjoined, Q.computers.today, Q.computers.todayNone),
        unjoined === undefined ? null : seen(registered, Q.computers.todayRegistered, null),
      ),
      note: Q.computers.note,
    }),
    question('phones', ctx, {
      label: Q.phones.label, control: 'choice', options: optionsOf(Q.phones.options),
      suggested: answer('apps'),
      evidence: lines(seen(phones, Q.phones.today, Q.phones.todayNone)),
      // Blocked from company data adds a policy step of its own (generate.ts
      // s-ladder-phone-access-restriction); Compliant adds phones to the
      // managed-device policy, which only a tenant with Intune licences can use.
      note: lines(Q.phones.note, ctx.snapshot.capabilities?.intune?.enabled === true ? Q.phones.noteIntune : null),
    }),
    officeNetworkQuestion(ctx),
  ]
}

/**
 * The office network, asked beside the device questions that use it (Stage 3,
 * V1 decision 3: it came from Decide Where People Sign In From). Its answer is
 * still stored under that step's old id (directionAnswers.ts
 * DIRECTION_LOCATIONS_STORAGE).
 */
function officeNetworkQuestion(ctx: Context): DirectionQuestion {
  const { snapshot } = ctx
  const read = snapshot.config.namedLocations?.status === 'ok'
  const locations = read ? (snapshot.config.namedLocations.rows ?? []).map((raw) => raw as { id?: string; displayName?: string; isTrusted?: boolean; '@odata.type'?: string }).filter((l) => typeof l.id === 'string' && l.isTrusted === true && String(l['@odata.type'] ?? '').includes('ipNamedLocation')) : []
  const trusted = locations.map((l) => l.id as string)
  const names = locations.map((l) => l.displayName ?? (l.id as string)).join(', ')
  return (
    question('officeNetwork', ctx, {
      label: Q.officeNetwork.label, control: 'locations', options: optionsOf(Q.officeNetwork.options), pickedWith: 'office',
      // A tenant with no trusted named location is not thereby all-remote, and
      // the scan reads nothing either way. Suggesting "Everyone works remotely"
      // switched off the step that would have defined the office network in the
      // first place, on no evidence; the suggestion that keeps the work on the
      // plan is the conservative one (owner, 2026-09-20).
      suggested: trusted.length > 0 ? answer('office', trusted) : answer('notInEntra'),
      // The evidence, and — where the saved answer contradicts it — what that
      // answer does with it. "Everyone works remotely" sat beside "1 named
      // location is marked trusted" with nothing joining them: the evidence is
      // true, argues for the opposite answer, and the suggestion WAS the
      // opposite answer. A reader who reads carefully, which is who this
      // question is for, met a contradiction on one line and no way to tell
      // which half to believe.
      // Named locations not read: no evidence line (walk list 60).
      evidence: [
        !read ? null : trusted.length > 0 ? fillText(Q.officeNetwork.seen, { n: trusted.length, names }) : Q.officeNetwork.notSeen,
        read && trusted.length > 0 && savedAnswerOf('officeNetwork', ctx.mapping)?.value === 'remote'
          ? fillText(Q.officeNetwork.savedRemoteUnused, { names })
          : null,
      ].filter((line): line is string => line !== null).join(' '),
      note: Q.officeNetwork.note,
    })
  )
}

// ---- the steps ----

const STEP_WORDS: Readonly<Record<DirectionStepId, { title: string; why: string }>> = {
  [DIRECTION_STEP.use]: W.steps.use,
  [DIRECTION_STEP.accounts]: W.steps.accounts,
  [DIRECTION_STEP.devices]: W.steps.devices,
}

/** A Direction step's title (content.json pages.app.plan.direction.steps). */
export const directionTitleOf = (id: DirectionStepId): string => STEP_WORDS[id].title

function directionStep(id: DirectionStepId, questions: DirectionQuestion[], savedAt: string | null): Step {
  const words = STEP_WORDS[id]
  const step = checkStep(id, words.title, words.why)
  step.directionQuestions = questions
  step.guidance = { id, kind: 'decision', title: words.title, why: words.why, whatToDo: { steps: [W.notSure] }, doneWhen: [W.done] }
  if (directionComplete(questions)) {
    setState(step, { satisfied: true, inPlace: true, condition: 'healthy' })
    if (savedAt !== null && Date.parse(savedAt) <= Date.now()) step.history = [{ at: savedAt, from: 'blocked', to: 'done', note: W.done }]
  } else {
    // Waiting on a person (owner, 2026-09-11): it reads Decision, never Create.
    step.blockers = [{ kind: 'decision', label: 'direction', binding: BLOCKED_REASON.direction }]
    setState(step, { condition: 'needs-decision' })
  }
  return step
}

export type DirectionInput = {
  snapshot: TenantSnapshot
  mapping: MappingState
  /** The baseline policies IAMAI does not assess (their services are D1 questions). */
  notAssessed: readonly NotAssessed[]
  /** The goals this plan can hold (licence-limited ones are not asked about). */
  availableGoalIds: readonly string[]
  nameOf?: (id: string) => string
  /** When each Direction step was last approved (stepDecisions[id].at), where the caller knows it. */
  approvedAt?: Readonly<Partial<Record<DirectionStepId, string>>>
}

/** The three Direction steps, built from the snapshot and the saved answers. */
export function directionSteps(input: DirectionInput): Step[] {
  const ctx = { snapshot: input.snapshot, mapping: input.mapping }
  const services = serviceReading(input.snapshot, input.notAssessed, input.availableGoalIds)
  // A caller that passes no namer gets the one rule for naming a person (names.ts personLabels).
  const nameOf = input.nameOf ?? ((labels) => (id: string) => labels.get(id) ?? id)(personLabels(input.snapshot.users))
  const at = (id: DirectionStepId): string | null => input.approvedAt?.[id] ?? (id === DIRECTION_STEP.use ? input.mapping.workflowConfirmedAt ?? null : null)
  return [
    directionStep(DIRECTION_STEP.use, useQuestions(ctx, services), at(DIRECTION_STEP.use)),
    directionStep(DIRECTION_STEP.accounts, accountQuestions(ctx, nameOf), at(DIRECTION_STEP.accounts)),
    directionStep(DIRECTION_STEP.devices, deviceQuestions(ctx), at(DIRECTION_STEP.devices)),
  ]
}

// ---- an answer in words ----

/**
 * An answer as the page says it: its option's label, and for an answer that
 * carries a list, the names picked (accounts or locations), through
 * `nameOf`. A list answer with nothing picked reads None.
 */
export function answerTextOf(q: Pick<DirectionQuestion, 'options' | 'pickedWith' | 'control'>, a: { value: string; picked: readonly string[] }, nameOf: (id: string) => string): string {
  const option = q.options.find((o) => o.value === a.value)?.label ?? null
  const names = a.picked.map(nameOf).join(', ')
  if (q.pickedWith !== null && a.value === q.pickedWith) return names || W.none
  return option ?? a.value
}

/**
 * The steps whose question moved to Direction, and which questions (docs/plans/
 * direction-spec.md, Retire or fold). Such a step no longer asks it, and shows
 * no Answered in block where it used to (walk list item 19).
 */
export const ANSWERED_IN: Readonly<Record<string, readonly DirectionQuestionKey[]>> = {
  [PREREQ_STEP_ID.trustedLocation]: ['officeNetwork'],
  [PREREQ_STEP_ID.serviceAccountsGroup]: ['serviceAccounts'],
  's-shared-devices': ['sharedDevices'],
  [QUESTION_STEP.mailDevices]: ['mailDevices'],
  [QUESTION_STEP.partner]: ['partner'],
}

/**
 * The Direction steps that ask a step's moved questions, or none. A policy held
 * by one of these steps is held by the Direction answer that step is waiting
 * for, so the two are one fact and the nearest one — the step — is the one to
 * say (docs/plans/step-redundancy-analysis.md finding 3).
 */
export function directionStepsAnswering(stepId: string): readonly string[] {
  return [...new Set((ANSWERED_IN[stepId] ?? []).map(directionStepOf))]
}

/**
 * Whether the steps a step waits on (`via`) already carry its wait on the
 * Direction step `direction` (docs/plans/step-redundancy-analysis.md finding
 * 3): every question the step itself waits on there is one those steps ask
 * (ANSWERED_IN), so the nearest cause — the step that makes what the answer
 * chooses — says it, once. By question, not by Direction step (Stage 3):
 * Decide How and Where People Sign In asks the devices and the office network,
 * and Define the Trusted Network carries only the office network, so a device
 * policy's own computers-and-phones wait is not its to carry.
 */
export function directionWaitRelayed(step: Pick<Step, 'goalId' | 'baselineReviewSource'> | null, via: readonly string[], direction: string): boolean {
  const carried = new Set(via.flatMap((id) => [...(ANSWERED_IN[id] ?? [])]))
  if (carried.size === 0) return false
  const mine = (step ? directionDependenciesOf(step) : []).filter((k) => directionStepOf(k) === direction)
  return mine.length > 0 ? mine.every((k) => carried.has(k)) : [...carried].some((k) => directionStepOf(k) === direction)
}

// ---- per-answer gating ----

/** The Direction answers each goal's policy depends on (docs/plans/direction-spec.md, owner decision 3). */
const GOAL_DEPENDS: Readonly<Record<string, readonly DirectionQuestionKey[]>> = {
  'block-legacy-auth': ['mailDevices'],
  'guests-mfa': ['partner'],
  // Work countries are asked on the countries step itself (6.3), which holds its
  // own decision until one is saved; travel was retired (Stage 3).
  'geo-restriction': ['partner'],
  'service-accounts-trusted-network': ['serviceAccounts', 'officeNetwork'],
  'register-info-protected': ['officeNetwork'],
  ...Object.fromEntries([...DEVICE_GOALS].map((g) => [g, ['computers', 'phones'] as const])),
}
/** A goal whose applicability is a D1 service depends on that service's answer. */
const SERVICE_GOAL: ReadonlyMap<string, string> = new Map(goals.goals.filter((g) => typeof g.applicability === 'string' && (SERVICE_KEYS as readonly string[]).includes(String(g.applicability))).map((g) => [g.id, String(g.applicability)]))

/** The Direction questions a step's policy depends on: its goal's, or a review row's service. */
export function directionDependenciesOf(step: Pick<Step, 'goalId' | 'baselineReviewSource'>): DirectionQuestionKey[] {
  const out: DirectionQuestionKey[] = [...(GOAL_DEPENDS[step.goalId] ?? [])]
  const service = SERVICE_GOAL.get(step.goalId) ?? (step.baselineReviewSource ? serviceOf(step.baselineReviewSource) : null)
  if (service !== null && (SERVICE_KEYS as readonly string[]).includes(service)) out.push(`service:${service}`)
  return out
}

/** A step only an answer puts on the plan: Keep Company Data Off Phones, while phones are Blocked from company data (generate.ts). */
const ADDED_BY_ANSWER: Readonly<Record<string, readonly DirectionQuestionKey[]>> = {
  's-ladder-phone-access-restriction': ['phones'],
}

/**
 * Each Direction step's Impact (walk list item 25, ui/surfaces/rowWho.ts): how
 * many plan steps its answers decide — a step an answer puts on the plan or
 * takes off it, and a policy that waits on it (directionDependenciesOf, the
 * moved questions of ANSWERED_IN). Only questions the step asks count.
 */
export function countDirectionImpact(steps: Step[]): void {
  const asked = new Set(steps.filter((s) => isDirectionStep(s.id)).flatMap((s) => (s.directionQuestions ?? []).map((q) => q.key)))
  const counts = new Map<string, number>()
  for (const step of steps) {
    if (isDirectionStep(step.id)) continue
    const keys = [...directionDependenciesOf(step), ...(ANSWERED_IN[step.id] ?? []), ...(ADDED_BY_ANSWER[step.id] ?? [])].filter((k) => asked.has(k))
    for (const id of new Set(keys.map(directionStepOf))) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const step of steps) if (isDirectionStep(step.id)) step.impactCount = counts.get(step.id) ?? 0
}

/**
 * Each service card's consequence line: the plan steps its No takes off the
 * plan, by the titles the plan shows — every step whose policy depends on that
 * service's answer (directionDependenciesOf), already set aside or not. Written
 * over the finished plan (progress.ts applyProgress), so it names only steps
 * the plan holds.
 */
export function noteServiceConsequences(steps: Step[]): void {
  const use = steps.find((s) => s.id === DIRECTION_STEP.use)
  for (const q of use?.directionQuestions ?? []) {
    if (!q.key.startsWith('service:')) continue
    const titles = [...new Set(steps.filter((s) => !isDirectionStep(s.id) && directionDependenciesOf(s).includes(q.key as DirectionQuestionKey)).map((s) => contentTitle(s)))]
    q.note = titles.length > 0 ? fillText(Q.serviceConsequence, { steps: list(titles) }) : null
  }
}

/**
 * Per-answer gating (owner decision 3): every open step whose policy depends on
 * a Direction answer nobody has saved waits on the Direction step that asks it,
 * as a decision blocker the lane engine holds the step on (planLanes.ts
 * observe) and the row reads as Waiting on your answers. A policy already
 * enforced is not held by it: the engine asks its questions there instead. A dependency the plan
 * does not ask (a service this baseline has nothing for) waits on nothing, and
 * a step that depends on no answer is left exactly as it was.
 */
export function gateOnDirection(steps: Step[]): void {
  const questions = new Map<string, DirectionQuestion>()
  for (const s of steps) if (isDirectionStep(s.id)) for (const q of s.directionQuestions ?? []) questions.set(q.key, q)
  if (questions.size === 0) return
  for (const step of steps) {
    // An already enforced policy is never held by it: it asks its question where
    // it is (unsavedInputs), so it carries no wait at all.
    if (isDirectionStep(step.id) || step.status === 'done' || step.status === 'skipped' || step.doesntApply != null || step.state.satisfied || step.state.lifecycle === 'enforced') continue
    const waiting = [...new Set(directionDependenciesOf(step).filter((k) => { const q = questions.get(k); return q !== undefined && q.saved === null }).map(directionStepOf))]
    if (waiting.length === 0) continue
    // The wait holds the step (holds.ts; owner, 2026-09-19): it is undated until
    // the answer is approved, like every other hold. The schedule withdraws it once
    // the plan is finished (forecast.ts settleForecast, which runs after this), and
    // the lane engine reads it as Waiting on your answers (planLanes.ts observe).
    // Its reason names the Direction step, in the shape a wait on another step reads.
    for (const id of waiting) step.blockers.push({ kind: 'decision', label: `${DIRECTION_BLOCKER}${id}`, binding: BLOCKED_REASON.after(directionTitleOf(id)) })
    // A step that waits is not Ready (lifecycle.ts conditionFor): it reads
    // Blocked, as a step waiting on another step does.
    if (step.state.condition === 'healthy') setState(step, { condition: 'blocked' })
  }
}
