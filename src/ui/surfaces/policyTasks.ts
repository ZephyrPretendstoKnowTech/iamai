// A step drawn with the Establish Emergency Access anatomy (owner, 2026-09-19:
// "there will be ZERO lack of uniformity among UI that SHOULD be identical").
// Every step that carries work is, after the policy-step pilot: the gate is the
// step group registry's `anatomy` field (roadmap/stepGroups.ts), which every
// group that draws work now sets to `task`, so there is no second list of ids
// and the board's grouping and the step's interior cannot answer differently.
//
// Nothing here is a new surface, and nothing here decides anything.
//
// The Tasks Remaining cards are the step's own policy — the subject an account
// is on Step 1 — followed by its Readiness tiles through the adapter Steps 2-3
// already use (emergencyReadiness.ts emergencySubjectTileOf); the only thing
// added back is the tile's own link, which the strip drew and the card would
// otherwise drop.
//
// The Implementation Tasks are the step's own Entra procedure — the portal
// artifact stepBody.ts already built for this step, read back as the numbered
// steps it is — under a title the step's resolved operations
// (roadmap/operations.ts) already decide. The resolved settings the procedure
// carries below it become the task's facts, which the emergency task frame
// already draws.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import type { Lifecycle } from '../../roadmap/lifecycle.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import { contentStepFor, contentStepForPackage } from '../../content/stepTitle.ts'
import { EMERGENCY_ACCESS_GROUP, isGroupMember, usesTaskAnatomy } from '../../roadmap/stepGroups.ts'
import { enforcesByStateOnly, stepOperations } from './stepJson.ts'
import { CONTRACT, FINISHED_FINDINGS } from './stepContract.ts'
import { app, structuralWords } from '../../content/content.ts'
import { toReportOnly } from '../../roadmap/operations.ts'
import { fillText, whatToDoFor, whole } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'

/** The line every package authors above the enforce conditions, and the one place a step's own prerequisites belong. */
const ENFORCE_CHECKLIST = /Do not turn it on unless all of these are true now/i
import type { ContractReadiness, ContractStage, StepContract } from './stepContract.ts'
import { emergencySubjectTileOf, followTask } from './emergencyReadiness.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import { mailDevicesFollowUp } from '../../roadmap/manualWork.ts'
import { mailDevicesOf } from '../../roadmap/answers.ts'
import { shared } from '../../content/content.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { OwnCard } from './prepareSteps.ts'

/** The folded mail follow-up's words (docs/plans/step-redundancy-analysis.md finding 6). */
const MAIL = shared.mailDevices as { title: string; target: string; steps: string[]; action: string }

/**
 * Block Legacy Authentication's second Implementation Task: moving every device
 * the mail-sending answer named onto a supported route and removing its
 * temporary exception. It was a step of its own (`s-question-mail-devices`)
 * drawing a different anatomy beside four policy steps in the same group; it is
 * the second half of this step's own outcome, so it is this step's second task.
 *
 * Absent where the answer named nobody: a tenant with no exception device has
 * nothing to move.
 */
function mailDevicesTaskOf(step: Step, mapping?: Pick<MappingState, 'questionAnswers'>): EmergencyAccountTask | null {
  if (!mailDevicesFollowUp(step.id, mapping)) return null
  return {
    id: 'mail-devices-route',
    accountId: null,
    title: MAIL.title,
    targetUpn: null,
    targetLabel: MAIL.target,
    required: true,
    readinessKey: '',
    evidence: null,
    actionLabel: MAIL.action,
    facts: mailDevicesOf(mapping!).map((id) => ({ label: 'Exception account', value: id })),
    steps: [...MAIL.steps],
  }
}

/** This step's content kind (`policy`, `object`, `check`, `campaign`, `ladder`, `blocker`), or null where the content file has no entry for it. */
function contentKindOf(stepId: string): string | null {
  return (contentStepForPackage(stepId) as { kind?: string } | undefined)?.kind ?? null
}

/** The step a card is on, as the content file has it: its own entry, or the guidance a generated step carries (a baseline-review row). */
type CardStep = { id: string; goalId?: string; guidance?: { card?: { subject: string; check: string } | null; taskTitle?: string | null } }
const entryOf = (step: CardStep): { card?: { subject: string; check: string; satisfied?: string } | null; taskTitle?: string | null } | undefined =>
  contentStepFor({ id: step.id, goalId: step.goalId ?? (step.id.startsWith('s-goal-') ? step.id.slice('s-goal-'.length) : ''), guidance: step.guidance as never })

/**
 * The Tasks Remaining card's subject and next check, where the step's own
 * content writes them (quality audit 2.1). A step that delivers a policy is
 * headed by the policy; a step that delivers an object, runs a check or a
 * campaign, or reviews a baseline policy, has no policy to be headed by, and
 * without these words the card was headed by the step's kind and checked by the
 * step's own title.
 */
export function cardWordsOf(step: CardStep): { subject: string; check: string | null } | null {
  const card = entryOf(step)?.card as { subject?: unknown; check?: unknown } | null | undefined
  return card && typeof card.subject === 'string' && (typeof card.check === 'string' || card.check === null) ? { subject: card.subject, check: card.check } : null
}

/**
 * A step's own card as its content writes it beyond the subject (walk list
 * items 2, 14, 26), with the step's values filled in:
 * - `check`, the open card's title ("7 accounts to disable or keep"), or null
 *   where each thing the step works on is a card of its own (Use Separate
 *   Accounts for Admin Work: one card per admin to move), so the step draws no
 *   card of its own while it is open;
 * - `detail: null`, no second line under the title;
 * - `pointer`, the open card points at the step's task by its title;
 * - `satisfied`, the fact the Satisfied card states ("2 kept · 7 disabled";
 *   3.7's "Core - Exception - Service accounts · 2 members"), in place of the
 *   state word, where the scan holds every value it names.
 * Null for a step whose card says none of these, which keeps the card it always had.
 */
export type OwnCardWords = { check: string | null; noDetail: boolean; pointer: boolean; satisfied: string | null }
export function ownCardWordsOf(step: CardStep, ex: Record<string, unknown>): OwnCardWords | null {
  const entry = entryOf(step)
  const card = entry?.card as { check?: unknown; detail?: unknown; pointer?: unknown; satisfied?: unknown } | null | undefined
  // The check for the state the scan read, where the step's whatToDoWhen writes
  // one (content/render.ts whatToDoFor): 3.7's "Not saved yet" once its group is
  // found, and no card of its own on 3.6 while it waits on the office answer.
  const state = whatToDoFor(entry, ex) as { check?: unknown } | null
  const stateCheck = state !== null && 'check' in state ? state.check : undefined
  if (!card || (!('detail' in card || 'pointer' in card || 'satisfied' in card) && stateCheck === undefined)) return null
  const filled = (s: unknown): string | null => (typeof s === 'string' && whole(s, ex) ? fillText(s, ex) : null)
  return { check: filled(stateCheck !== undefined ? stateCheck : card.check), noDetail: card.detail === null, pointer: card.pointer === true, satisfied: filled(card.satisfied) }
}

/**
 * Whether this step draws the Establish Emergency Access anatomy *through this
 * module* — the cards below, the Entra procedure as an Implementation Task, and
 * the resolved settings folded under it.
 *
 * Every step that carries work draws the anatomy (owner, 2026-09-19), and the
 * registry says which those are. The four Establish Emergency Access steps draw
 * the same anatomy from their own producers (emergencyAccountTasks.ts,
 * emergencyGroupTasks.ts, emergencyPasskeyTasks.ts) and are frozen, so they are
 * not this module's: one subject producer per step, never two.
 */
export function drawsTaskAnatomy(stepId: string): boolean {
  return usesTaskAnatomy(stepId) && !isGroupMember(stepId, EMERGENCY_ACCESS_GROUP)
}

/** A step's portal channel, as stepBody.ts built it; only its text is read. */
type PortalArtifact = { id: string; text: () => string }

/**
 * What the operations this step submits make of the procedure, in the words the
 * step's own state already uses: a create lands in report-only (generate.ts
 * buildCreateAction), the state-only update is the one that turns the policy on,
 * and anything else changes settings.
 *
 * A step that submits no operation — an object step that makes a named location
 * or a group, the MFA campaign, a check or a baseline review — has no operation
 * to read, so the task is called what the step is called. That is the fallback,
 * and it is the step's own title, not a sentence written here.
 */
function taskTitle(step: Step, fallback: string): string {
  // A policy the tenant has switched off is set to Report-only: the create the
  // engine still resolves for it is not what the procedure does
  // (stepResources.ts switchedOffLines).
  if (toReportOnly(step).length > 0) return structuralWords.switchedOffTask
  const ops = stepOperations(step)
  if (ops.length === 0) return entryOf(step)?.taskTitle ?? fallback
  if (ops.every((op) => op.mode === 'create')) {
    return ops.every((op) => String((op.body as { state?: unknown }).state ?? '') === 'enabledForReportingButNotEnforced')
      ? 'Create the policy in Report-only'
      : 'Create the policy'
  }
  return enforcesByStateOnly(step) ? 'Turn the policy on' : 'Update the policy settings'
}

/**
 * The portal artifact read back as the procedure it is: its numbered lines are
 * the task's steps, and the resolved settings listed under the artifact's own
 * heading are the task's facts. Nothing is composed — every line is the
 * artifact's.
 */
export function portalProcedureOf(text: string): { steps: string[]; facts: { label: string; value: string }[] } {
  const steps: string[] = []
  const facts: { label: string; value: string }[] = []
  let underHeading = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    if (/^#{1,6}\s/.test(line)) {
      underHeading = true
      continue
    }
    // A list marker with nothing after it is not a step. The enforce block
    // authors its conditions as an indented list under a numbered item, so
    // the number lands on a line of its own and was rendered as an
    // instruction reading "3.".
    if (/^(?:\d+\.|[-*])$/.test(line)) continue
    const item = /^(?:\d+\.|[-*])\s+(.*)$/.exec(line)?.[1] ?? line
    if (!underHeading) {
      steps.push(item)
      continue
    }
    const split = /^(.{1,64}?):\s+(.*)$/.exec(item)
    facts.push(split ? { label: split[1], value: split[2] } : { label: 'Setting', value: item })
  }
  return { steps, facts }
}

/**
 * This step's Implementation Tasks: one task for the step's one Entra procedure,
 * and — on Block Legacy Authentication with exception devices named — a second
 * for moving them to a supported mail route (finding 6).
 *
 * The procedure is whatever the step's portal channel carries, whole: the policy
 * create or update on a policy step, the portal path that makes the named
 * location or the group on an object step, the campaign's own preparation on
 * `s-verify-mfa`, and what to read and where to read it on a check or a
 * baseline-review step. Nothing is written here — this reads the artifact the
 * step already drew under Implementation and calls it a task.
 *
 * A step whose portal channel has no numbered procedure gets no projection and
 * keeps the body it always drew — its artifact is still on the page, which a
 * "no action" frame would hide — and so does a step whose baseline contradicts
 * itself, because nothing anybody does in the portal resolves that (stepContract
 * `fixOf`: such a step asks for nothing), and a task there would be work offered
 * over a step that says there is none.
 */
export function policyTasksOf(step: Step, title: string, artifacts: readonly PortalArtifact[], mapping?: Pick<MappingState, 'questionAnswers'>, outstanding: readonly string[] = []): EmergencyTaskProjection | null {
  if (step.state.condition === 'baseline-conflict') return null
  const portal = artifacts.find((a) => a.id === 'portal')
  if (!portal) return null
  const { steps, facts } = portalProcedureOf(portal.text())
  if (steps.length === 0) return null
  // The step's own unresolved prerequisites, inside the checklist that says
  // "Do not turn it on unless all of these are true now".
  //
  // That checklist is authored per package — forty-odd identical copies —
  // and carried three fixed conditions and nothing about THIS step. So a
  // tenant with security defaults still on had a tile reading "Turn Off
  // Security Defaults · Prerequisite · Waiting" four lines above a checklist
  // that did not mention them, on a policy the security-defaults step names
  // as one of its four replacements. Eight policies went on into a state the
  // product itself calls unsupported and cannot be undone, and the board said
  // Completed. Spliced rather than authored, so no package can miss it.
  const checklist = steps.findIndex((line) => ENFORCE_CHECKLIST.test(line))
  const spliced = [
    outstanding.length === 0
      ? null
      : outstanding.length === 1
        ? fillText(app.plan.enforceOutstanding, { items: outstanding[0] })
        : fillText(app.plan.enforceOutstandingMany, { items: list([...outstanding]) }),
  ].filter((line): line is string => line !== null)
  // ABOVE the heading, not inside the list.
  //
  // Spliced under "Do not turn it on unless all of these are true now:", the
  // outstanding prerequisite became an item in a list of conditions that must
  // be TRUE while saying something is NOT finished. Two readers hit the
  // inversion independently and one followed it literally, enforcing ten
  // policies with the prerequisite open. It is not a condition; it is the
  // reason not to reach the conditions at all, so it stands before them.
  const withOutstanding = checklist < 0 || spliced.length === 0
    ? steps
    : [...steps.slice(0, checklist), ...spliced, ...steps.slice(checklist)]
  const mail = mailDevicesTaskOf(step, mapping)
  const task: EmergencyAccountTask = {
    id: 'policy-procedure',
    accountId: null,
    title: taskTitle(step, title),
    targetUpn: null,
    required: true,
    readinessKey: '',
    evidence: null,
    actionLabel: 'Open the Entra procedure',
    facts,
    steps: withOutstanding,
  }
  // Recommended only where writing the policy is what the step is doing now
  // (roadmap/nextSafeAction.ts implementationIsCurrent). A step the plan's
  // foundation holds keeps the procedure — it is the persistent reference the
  // anatomy asks for — but nothing on the step directs the operator into it,
  // because the card beside it says to finish Establish Emergency Access or
  // approve the Direction answer first, and two directions is none.
  return { tasks: mail ? [task, mail] : [task], recommendedTaskId: implementationIsCurrent(step) ? task.id : null, printAll: true }
}

/** The subject a card names where the step delivers one policy; a step that delivers two labels each member ("Policy A") itself. */
const POLICY_SUBJECT = 'Conditional Access policy'

/**
 * The subject a Tasks Remaining card names on a step with no policy member: the
 * kind the step already calls itself in its own eyebrow (stepContract.ts
 * `eyebrowOf` over `pages.app.plan.stepContract.kind` — "Preparation step",
 * "Check step", "Campaign step", "Hardening step"), and the step's title where
 * the content file names no kind.
 *
 * Where the step's content writes its own card subject (`card.subject`) that is
 * the subject, because "Preparation step" names the step's kind and not the
 * thing the card is about. The eyebrow stays the fallback for a step whose
 * content has not been given one, so no card is ever left without a head.
 */
export function taskSubjectOf(step: CardStep, eyebrow: string | null, title: string): string {
  if (contentKindOf(step.id) === 'policy') return POLICY_SUBJECT
  return cardWordsOf(step)?.subject ?? eyebrow ?? title
}

/**
 * The bar over the evidence link: what to do, as Prepare Emergency Access
 * Accounts says it, and not the status word a policy step used to show there
 * ("Ready now") — the step's state is already its badge's.
 *
 * Two sentences, the way that step's own two are two sentences in
 * ContentStep.tsx: there is no content key for them, and the words are the
 * cards' ("task", "complete"), not new vocabulary.
 */
export function policyBarOf(subjects: readonly EmergencySubjectTile[]): string {
  const open = subjects.filter((subject) => !subject.satisfied)
  if (open.length === 0) return 'Every task on this step is complete.'
  // What a finished rollout left behind is a finding, not a task: the policy is
  // on, and nothing on this step moves the number (stepContract.ts
  // `shortReadingOf`). "Complete the next task shown for each item" promised an
  // action no card on the step offers. A policy that went live with no
  // report-only period IAMAI watched is the same kind of finding (owner
  // decision 3): nothing on the step can make that window have happened. So is
  // a tenant's own policy that differs from the baseline's, and a baseline
  // grant below the goal's floor: stated, never asked to change (owner,
  // 2026-09-22).
  if (open.every((subject) => FINISHED_FINDINGS.has(subject.key))) return 'Every task on this step is complete, and it left something behind.'
  return 'Complete the next task shown for each item.'
}

/**
 * Whether this policy is at the last stage of the step's rollout track — the
 * one thing the track still decides on a card, because a policy at its last
 * stage with nothing left to submit has nothing remaining. Null where there is
 * no track to read.
 *
 * The track used to be read as the card's checks: the stages at or below the
 * current index became "Completed checks", the count above it became "N checks
 * remaining", and the next one became the check. All three were wrong in the
 * same way (V1 audit S4-3, S4-4, S4-5). The rollout lifecycle is a state the
 * scan reads, not a checklist anybody worked through: nothing in the plan
 * records who reached a stage or when, so a policy the very first scan found
 * enforced listed three checks somebody completed, with no date, no evidence
 * and no actor. The card no longer says it. Where the tenant holds the fact —
 * a policy in report-only, a policy enforced — the step's head states it beside
 * the badge (stepContract.ts `factOf`), which claims only what the scan read.
 */
function atLastStage(track: readonly ContractStage[], lifecycle: Lifecycle | null): boolean | null {
  const at = track.findIndex((stage) => stage.key === lifecycle)
  const index = at >= 0 ? at : track.findIndex((stage) => stage.current)
  if (track.length === 0 || index < 0) return null
  return index === track.length - 1
}

/**
 * The step's own work as Tasks Remaining cards: one card per policy the step
 * delivers, drawn by the same component an Emergency Access account is drawn by,
 * because the policy is this step's subject the way an account is that step's.
 *
 * Every line is already somewhere in the contract: the policy's name is its
 * member's (Foundation B), the next check is the step's own content, its
 * condition or its task, what that check means is the step's one action, and
 * the action is the matching Implementation Task, directed to in the words
 * emergencyReadiness.ts already uses. No taxonomy is invented.
 *
 * The rollout stages are not the card's checks (V1 audit S4-3, S4-4, S4-5):
 * `atLastStage` says why, and where the tenant holds the stage as a fact the
 * step's head states it beside the badge.
 *
 * A card is satisfied only when the policy has reached the last stage and the
 * step has no task left to do, so "No tasks remaining" cannot be shown over work
 * that Implementation Tasks still lists.
 */
export function policyCardsOf(contract: StepContract, projected: EmergencyTaskProjection | null, subject: string = POLICY_SUBJECT, check: string | null = null, words: OwnCardWords | null = null, own: OwnCard | null = null): EmergencySubjectTile[] {
  // A finished preparation step states its fact, one card each, in place of
  // "In place · No change needed." (step template rule 6).
  if ((contract.satisfiedFacts?.length ?? 0) > 0) {
    return contract.satisfiedFacts.map((fact, index) => ({ key: `fact:${index}`, accountId: null, heading: fact.heading, upn: null, title: fact.title, detail: fact.detail ?? '', instruction: '', completed: [], remainingCount: null, satisfied: true }))
  }
  const task = projected?.tasks.find((item) => item.required) ?? projected?.tasks[0] ?? null
  // One task needs no pointer sentence (owner, 2026-09-20). On Emergency Access
  // the sentence earns its place because the step has three or four tasks and
  // the card picks one; with one task the section below carries the same words,
  // and the card said it twice.
  const pointer = (projected?.tasks.length ?? 0) > 1
  // The task the card sends the operator to: the one this step is recommending
  // now. A projection that recommends none is a step whose next thing is not the
  // procedure (policyTasksOf), so the card states the check and stops there.
  const directed = projected && (projected.recommendedTaskId ?? null) !== null ? task : null
  const subjects = contract.members.length > 0
    ? contract.members.map((member) => ({ key: `policy:${member.key}`, heading: member.label ?? subject, name: member.name, lifecycle: member.lifecycle ?? contract.state.lifecycle }))
    : [{ key: 'policy', heading: subject, name: contract.existing?.names.join(', ') ?? null, lifecycle: contract.state.lifecycle }]
  // A step whose content draws each thing it works on as a card of its own
  // (ownCardWordsOf: no `check`) draws no card of its own while it is open. A
  // step that reads its people (prepareSteps.ts OwnCard) always draws its own.
  if (own === null && words !== null && words.check === null && !contract.state.satisfied) return []
  return subjects.map((subject) => {
    // Nothing is left on the policy itself when the goal is already delivered
    // (Foundation B's own `satisfied`: "nothing to create; keep it as it is"),
    // or when it has reached its last stage with nothing left to submit.
    const satisfied = contract.state.satisfied || (atLastStage(contract.track, subject.lifecycle) === true && task === null)
    // A policy IAMAI has resolved: a member this step delivers, or the tenant's
    // own policy that already delivers the goal. With neither there is no policy
    // for a stage to be a stage of, and the card states none (S4-3) — an admin
    // ticking "device code is blocked" off a card that read `Enforced` over
    // "This step has no policy for IAMAI to write in this plan" had blocked
    // nothing. The step's own state word is all that is left to say.
    const resolved = contract.members.length > 0 || contract.existing !== null
    const here = resolved ? contract.state.stage || contract.state.word : contract.state.word
    // The next check, and never a rollout stage (S4-4). One slot cannot mean the
    // stage a policy is sitting in on one card and a stage it has not reached on
    // the next, with nothing marking which, so it means neither: a stage is
    // where the policy is, and the check is what has to pass next.
    //
    // In order: the check the step's own content writes (`card.check`); then the
    // condition that holds the step, which is the thing that has to clear before
    // any stage is reachable at all — the hold outranks the stage track, which
    // is the inversion of the one root cause all three tile passes named; then
    // the decision, where the step's one action is to make one; then the task
    // the step has to complete. Every word is one the product already uses for
    // this state (`stepContract.condition`), so no second vocabulary is made. A
    // satisfied card states where the policy ended up, which is an outcome and
    // not a promise.
    const next = check
      ?? (contract.state.condition !== 'healthy' ? CONTRACT.condition[contract.state.condition] : null)
      ?? (contract.whatToDo.kind === 'decide' ? CONTRACT.condition['needs-decision'] : null)
      ?? task?.title ?? null
    // A step that reads its people states them itself, open or satisfied
    // (prepareSteps.ts): who it is about, and the fact, never "In place · No
    // change needed." (walk list section 3 items 14, 41 and 46).
    if (own !== null) return { key: subject.key, accountId: null, heading: subject.heading, upn: own.upn ?? subject.name, title: own.title, detail: own.detail, instruction: '', completed: [], remainingCount: null, satisfied, ...(own.link ? { link: own.link } : {}) }
    return {
      key: subject.key,
      accountId: null,
      heading: subject.heading,
      upn: subject.name,
      // A finished card states its fact where the step's content writes one (walk list item 14).
      title: satisfied ? words?.satisfied ?? here : next ?? here,
      // What that check means, in the contract's own words for this step: its one
      // action (Foundation B's milestone where nothing overrules it, and the more
      // specific sentence where something does — "this policy names an object
      // Contoso does not have yet", "in place already: nothing to create").
      detail: words !== null && (words.noDetail || (satisfied && words.satisfied !== null)) ? '' : contract.whatToDo.text,
      instruction: satisfied ? '' : words?.pointer && task !== null ? followTask(task.title) : directed === null || !pointer ? '' : followTask(directed.title),
      // The rollout lifecycle is not a list of checks anybody completed, and
      // stages left are not checks remaining (S4-5): the card claims neither.
      completed: [],
      remainingCount: null,
      satisfied,
    }
  })
}

/**
 * This step's Tasks Remaining cards: its own policy first, then its Readiness
 * tiles, remaining then satisfied, as the subject tiles Steps 2-3 draw — with
 * the tile's own link kept as the card's one action.
 *
 * Which tiles are out of the way is the contract's answer and not a second
 * reading of a tone here: a tile the contract put under `satisfied` is a
 * satisfied card, so it folds under the completed disclosure the way it folded
 * under the strip's own.
 */
export function policySubjectsOf(contract: StepContract, readiness: ContractReadiness, projected: EmergencyTaskProjection | null, subject: string = POLICY_SUBJECT, check: string | null = null, words: OwnCardWords | null = null, own: OwnCard | null = null): EmergencySubjectTile[] {
  // One task needs no pointer sentence (owner, 2026-09-20): the one pointer the
  // adapter can write on this step is to the step's only task, and the section
  // below it carries the same words.
  const only = projected && projected.tasks.length === 1 ? followTask(projected.tasks[0].title) : null
  const card = (tile: ContractReadiness['tiles'][number], satisfied: boolean): EmergencySubjectTile => {
    const subject = emergencySubjectTileOf(tile, projected)
    const link = tile.link && 'href' in tile.link ? tile.link : null
    return { ...subject, satisfied, ...(only !== null && subject.instruction === only ? { instruction: '' } : {}), ...(link && !subject.link ? { link } : {}) }
  }
  const rest = [...readiness.tiles.map((tile) => card(tile, false)), ...readiness.satisfied.map((tile) => card(tile, true))]
  // One sentence, said once. The policy card's sentence is the contract's one
  // action, and on a step whose action is a tile's own words — a baseline
  // conflict says "This step is on hold until the baseline author resolves a
  // contradiction" on the policy card and again on the Baseline definition card
  // — the two cards read identically. The card that names the subject the
  // sentence is about keeps it; the general one drops it and states its check.
  const said = new Set(rest.map((c) => (c.instruction ?? '').trim()).filter((s) => s !== ''))
  const cards = policyCardsOf(contract, projected, subject, words?.check ?? check, words, own).map((c) => (said.has((c.detail ?? '').trim()) ? { ...c, detail: '' } : c))
  return [...cards, ...rest]
}
