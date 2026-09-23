// The content-driven view of a step for the exports (prompt 53 queue item 7):
// what the calendar entry, the prompt pack, the grounding bundle and the plan
// file say about a step is what the step says on screen — the content file's
// title, why and done-when lines filled with the tenant's values, and the
// portal-line translator's What to do — never the v2 engine's own prose
// (what-changes, exit criteria, rings, failure modes), whose vocabulary the
// contract forbids. A step the content file has no entry for (a free-tier
// ladder rung) keeps its own title and its engine lines, as the screen does.
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import type { ExportStep, Step } from '../../roadmap/types.ts'
import { dimensionWords } from '../../roadmap/observation.ts'
import { content } from '../../content/content.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { SHARED_REF_KEYS, fillText, ifWrongFor, listCountVars, whatToDoFor, whole } from '../../content/render.ts'
import { stepVars, withoutScheduleDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, portalNamesFor, unwrittenCorrectionLines } from './stepPortal.ts'
import { instructionsHeld, preparationLines, rescanLinesOf, wholeLines } from './stepInstructions.ts'
import { badgeLabel, CONTRACT, factOf, implementationIsCurrent, proceduresAreReference, stepContract } from './stepContract.ts'
import type { LaneView, PrerequisiteLabel, StepContract } from './stepContract.ts'
import { implementationPackageFor, packageBindings, packageRuntime, packageStateOf, planningPreview, previewNoteLines, selectedPolicyBodiesOf, entraWithSettings } from './stepPackage.ts'
import { projectSafely } from '../../content/implementation/project.ts'
import { BOARD, SUBSTATUS_WORD, boardHolds, laneViewAlone, laneViewFor, laneViewOf, laneWordOf, prerequisiteLabelFor } from './planBoard.ts'
import type { BoardReadings } from './planBoard.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { CleanupExport } from '../../roadmap/types.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import { planFinish } from '../../derive/finish.ts'
import type { Substatus } from '../../actionability/lanes.ts'
import { createsNewPolicy, enforcesByStateOnly, updatesExistingPolicy, heldByTitle, implementationOffered, waitingLine } from './stepJson.ts'
import { awaitingDeployment, enforcementUnearned, forecastEnforcement } from '../../roadmap/forecast.ts'
import { isPreserved, unavailableReason } from '../../roadmap/operations.ts'
import { baselineConflictWords } from '../../roadmap/baselineConflict.ts'
import { heldForCorrection, heldForReview } from '../../roadmap/lifecycle.ts'
import { stepPopulation } from '../../derive/population.ts'
import { list } from '../../copy/statements.ts'
import { answerOf, effectLine } from '../../roadmap/answers.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { namedPortalResource, policyInspectionLines, lifecycleResources, verificationResourceLines } from './stepResources.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { EMERGENCY_ACCOUNTS, EMERGENCY_GROUP, PASSKEY_SETTINGS } from '../../roadmap/emergencyJourney.ts'
import { emergencyGroupTasksOf } from './emergencyGroupTasks.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyAccountTasksOf, emergencyAccountTasksText } from './emergencyAccountTasks.ts'

export type { ExportStep }

/** The shared lines this module fills; the words live in content.json, as every other line's do. */
const SHARED = content.shared as unknown as { commsForecastNote: string }

/**
 * The step's Dates line: a change to an existing policy announces and changes
 * (shared.datesChange); a new policy is deployed in report-only first and
 * enforced after (shared.datesNew).
 *
 * The operation decides (stepJson.ts createsNewPolicy), and it decides first: a
 * step whose content was written for the change case is still a create in a
 * tenant that has no such policy, and a create's dates are the report-only
 * deployment and the enforcement it earns, never "Announce · Change" with the
 * report-only stage missing from between them.
 *
 * Foundation B decides before either of them (roadmap/forecast.ts
 * `awaitingDeployment`, `enforcementUnearned`). While the policy is not deployed
 * there is nothing in the tenant to enforce and nothing has been watched, so the
 * plan states the report-only deployment it can keep and dates no enforcement
 * (shared.datesDeploy). The enforcement date the schedule holds is the roadmap's
 * forecast for a window that has not opened; printing it beside a policy that
 * does not exist announces a change on a day nothing can have earned.
 *
 * The window opening does not date the enforcement either. A policy two days
 * into report-only with nothing left to submit but the enforcement read
 * "Announce Sep 6 · Change Sep 7", while the row beside it read "ready Aug 29"
 * and its Done-when lines named nine people the records had not seen — the same
 * step answering "when" three ways, one of them a change dated on a day nothing
 * had earned. So the line states the two days Foundation B does hold: the day
 * the policy entered report-only, and the review milestone its own gates derive
 * (shared.datesObserve). The enforcement date returns, as a date rather than a
 * forecast, once the evidence makes it `ready-to-enforce`. A report-only policy
 * with a real correction still to make keeps its change dates: that patch leaves
 * it in report-only, it is work for today, and it is not this case.
 */
export function datesLineFor(step: Step, cs: Record<string, unknown>): string | null {
  // A step something holds has no Dates line at all (roadmap/holds.ts): nothing
  // it could be dated to happens until the hold clears, and the schedule has
  // withdrawn its placement. The step says what it waits on instead. The one held
  // step the plan still dates is a create only readiness holds: its report-only
  // creation day (roadmap/stepSchedule.ts scheduledEventOf), enforcement undated.
  if (isHeld(step) && !heldForReview(step)) return scheduledEventOf(step)?.transition === 'createReportOnly' ? '{datesDeploy}' : null
  if (awaitingDeployment(step)) return '{datesDeploy}'
  // Held only on a difference IAMAI does not write, the policy is held like any
  // other and has no Dates line: {datesReview} says "Held until the change
  // somebody made to the policy has been looked at", and nobody changed it — it
  // can be a policy first seen in this scan (R4-25). The step's action names
  // the correction it waits on.
  if (heldForCorrection(step)) return null
  // A policy held for review dates no review either: the window's own date says
  // when the *watching* would have been enough, and it was not counted on the
  // policy that is deployed now (roadmap/lifecycle.ts heldForReview).
  if (heldForReview(step)) return '{datesReview}'
  if (enforcementUnearned(step)) return '{datesObserve}'
  if (createsNewPolicy(step)) return '{datesNew}'
  if (step.kind === 'adjust') return '{datesChange}'
  return typeof cs.dates === 'string' ? cs.dates : null
}

/**
 * The step's If-it-goes-wrong line, by the same rule and for the same reason:
 * putting a created policy back means setting it to report-only or deleting it
 * (shared.policyIfWrong), because there were no settings to restore. The change
 * line is kept for a step that changes a policy the tenant already had —
 * "delete it" would delete the tenant's own policy.
 */
export function ifWrongLineFor(step: Step, cs: Record<string, unknown>, ex: Record<string, unknown>): string | null {
  // The line for the state the scan read (content/render.ts ifWrongFor): where
  // security defaults were read already off, Turn Off Security Defaults made no
  // changeover here, so it has no way back to describe.
  const line = ifWrongFor(cs, ex)
  // A goal the tenant already delivers has no way back, because nothing went
  // forward: this step creates no policy and submits no change, so there is no
  // inverse to describe. Every rollback line the content offers is written for a
  // change that was made, and over a policy IAMAI neither created nor touched
  // they all read as instructions to take a working control away — "Set the
  // policy back to report-only, or delete it" was rendering on the screen, the
  // exports, the print, the calendar entry and the prompt pack of every step
  // that was already satisfied, over the tenant's own policy. The rule the
  // module already applies to a policy that cannot be written (no completion
  // criteria, no rollback, no dates) is the rule here: preserve means preserve.
  if (isPreserved(step)) return null
  if (line === '{changeIfWrong}' && createsNewPolicy(step)) return '{policyIfWrong}'
  // And the same rule the other way. A step whose content was written for a
  // policy IAMAI creates is submitting an update once that policy exists, and
  // "or delete it" is the undo of a create. It would remove a deployed policy in
  // answer to a change that never made one, which is both destructive and not
  // the inverse of what was submitted.
  //
  // What replaces it is decided by the patch, never by update mode alone. The
  // one update whose inverse is report-only is the state-only enforcement: it
  // turned the policy on and touched nothing else, so setting it back to
  // report-only puts the tenant exactly where it was — never Off (owner,
  // 2026-09-23): a policy left in report-only keeps collecting the sign-in data
  // its next turn-on is judged by. Every other update changed a setting —
  // including a correction to a policy the tenant already enforces — and the way
  // back from those is to restore the settings the step shows above the line.
  // Report-only would be the wrong instruction twice over there: it weakens a
  // live control the change never turned on, and it leaves the changed setting
  // in place.
  if (line === '{policyIfWrong}' && updatesExistingPolicy(step)) return enforcesByStateOnly(step) ? '{enforceIfWrong}' : '{changeIfWrong}'
  return line
}

/**
 * The screen's preview note (stepBody.ts `previewNote`), for an export that carries the
 * walk-through of work the package can only preview because values IAMAI does not hold
 * are missing. Without it the export read "Ready · Create" over a create the screen said
 * could not be copied (review 7 queue 2). Only a values hold is read: the export has no
 * owner confirmations, and a missing value holds whatever they satisfy. The lines are
 * the screen's own (stepPackage.ts previewNoteLines), so a "Ready · Create" export is
 * never over a note that says the create is not ready to run.
 */
function previewValueLines(step: Step, ctx: StepVarContext, contract: StepContract): string[] {
  const pkg = implementationPackageFor(step)
  const state = pkg ? packageStateOf(step, contract, ctx.snapshot) : null
  if (!pkg || state === null) return []
  const bindings = packageBindings(step, ctx, contract)
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  const hold = planningPreview(pkg, step, contract, ctx.snapshot, bindings, runtime, projectSafely(pkg, state, bindings, runtime))?.hold ?? null
  if (hold === null || hold.missingBindings.length === 0) return []
  return previewNoteLines(step, contract, hold)
}

/** Administrator-recorded results remain visible even when a later scan makes them historical. */
export function manualEvidenceLines(step: Step, ctx: StepVarContext): string[] {
  const review = step.manualReview
  const record = review?.record
  if (!review) return []
  const states = { current: 'Current', unread: 'Not verified by the latest scan', changed: 'Configuration changed; review needed', incomplete: 'Incomplete', historical: 'Historical' }
  const lines = [`Evidence status: ${review.verification ? states[review.verification] : review.confirmedAt ? 'Recorded' : 'Not recorded'}.`]
  if (review.staleReason) lines.push(review.staleReason)
  if (!record) {
    if (review.confirmedAt) lines.push(`Recorded on: ${review.confirmedAt}.`)
    return lines
  }
  const clean = (value: string) => value.replace(/[\r\n]+/g, ' ').trim()
  const person = (id: string) => { const name = ctx.nameOf(id); return name && name !== id ? `${clean(name)} (${id})` : id }
  const outcomes = { passed: 'Successful', failed: 'Unsuccessful', retained: 'Access retained', revoked: 'Access revoked', investigate: 'Investigation needed' }
  if (record.outcome) lines.push(`Outcome: ${outcomes[record.outcome]}.`)
  if (record.accountIds?.length) lines.push(`Accounts: ${record.accountIds.map(person).join('; ')}.`)
  if (record.workflow) lines.push(`Workflow: ${clean(record.workflow)}.`)
  if (record.testedAt) lines.push(`Tested or reviewed on: ${record.testedAt}.`)
  lines.push(`Record saved: ${record.at}.`)
  if (record.replacementAccountId) lines.push(`Dedicated administrator account: ${person(record.replacementAccountId)}.`)
  if (record.roleIds?.length) lines.push(`Required roles: ${record.roleIds.map(clean).join('; ')}.`)
  if (record.exceptionRemoved !== undefined) lines.push(`Temporary exception removed: ${record.exceptionRemoved ? 'Yes' : 'No'}.`)
  if (record.reference) lines.push(`Change record: ${clean(record.reference)}.`)
  for (const field of review.fields ?? []) {
    if (!['contextId', 'networkId', 'configurationVerified'].includes(field.key)) continue
    const value = record[field.key]
    if (value === undefined || value === null || value === '') continue
    const named = field.options?.find(option => option.value === value)?.label
    const detail = typeof value === 'boolean' ? value ? 'Yes' : 'No' : named && named !== value ? `${clean(named)} (${clean(String(value))})` : clean(String(value))
    lines.push(`${clean(field.label)}: ${detail}.`)
  }

  if (review.pendingAccountIds?.length) lines.push(`Accounts still needing a result: ${review.pendingAccountIds.map(person).join('; ')}.`)
  return lines
}

/**
 * The step as the screen says it, for an export.
 *
 * `lane` is the board's one state reading of the step (planBoard.ts laneViewOf,
 * A1c: the lane engine states every surface, the exports included). The Export
 * page hands down the board's (exportViewsOf); a caller with no board reads the
 * step with nothing around it (planBoard.ts laneViewAlone).
 */
/**
 * The contract's gate as one line: its own words, ended as a sentence so it
 * stands beside the action rather than trailing it. Null where nothing gates
 * the action.
 *
 * Only where the gate is the board's own words for a waiting row (the lane's
 * tail on Up Next or On Hold: "After Configure Passkey Authentication",
 * "Waiting on your direction"), which the row itself shows. The engine's
 * milestone clause is not a sentence ("until both policies of the pair can be
 * matched", "when admin readiness reaches 100% (now 66%)"), and the board's
 * "Not supported" over a policy already in place is a group label, not an
 * instruction: every export printed them as What to do lines the opened step
 * never draws (Phase 2 export finding 13). The reason's own sentence says what
 * holds such a step, and the Threshold card's sentence travels under Before
 * turn-on.
 */
function gateLine(gatedBy: string | null, lane: LaneView): string | null {
  const gate = (gatedBy ?? '').trim()
  if (gate.length === 0) return null
  const waiting = lane.lane === 'Up Next' || lane.lane === 'On Hold'
  if (!waiting || lane.tail === null || gate !== lane.tail || gate === BOARD.blockers.unsupported) return null
  // A readiness gate's tail is its clause, which the row reads beside the lane
  // word ("On Hold" · "when admin readiness reaches 100% (now 66%)"): not a line
  // of its own. The Threshold card's whole sentence is under Before turn-on.
  if (/^[a-z]/.test(gate)) return null
  return /[.!?]$/.test(gate) ? gate : `${gate}.`
}

/**
 * The Export page's view of every step — the one its calendar, grounding
 * bundle and prompt pack read — each under the lane the board reads it in.
 * `board` is planBoard.ts boardReadingsOf, the one construction the Plan builds
 * its rows with, Cleanup rows and all; the page builds it once and hands the
 * same board to this and to `exportHoldOf`.
 *
 * The page built its own lane readings, with no Cleanup rows, so the
 * emergency-access drill did not exist there. A policy the board held Up Next
 * behind the drill went into the calendar runbook as "Ready · Ready to
 * enforce", beside the very guard that said not to turn it on until emergency
 * access was tested (R4-22). The page calls this, and the tests call this.
 */
export function exportViewsOf(board: Pick<BoardReadings, 'readings' | 'titleOf'>, ctxOf: (s: Step) => StepVarContext): (s: Step) => ExportStep {
  // Where a readiness route's chain starts, as the board reads it (R4-33): the
  // opened step builds its contract with it, so the Threshold card's sentence
  // names the first thing anybody can do, and the export says the same sentence.
  const { startOf } = prerequisiteLabelFor(board.readings)
  return (s) => stepExportView(s, ctxOf(s), laneViewFor(s, board), startOf)
}

/**
 * The board's hold on each step (planBoard.ts boardHolds), on the board
 * `exportViewsOf` reads: what the Export page's plan-wide dates
 * (stepVars.ts planDates) and the prompt pack's announcement
 * (exportAnnouncementOf) ask before any view exists, so that a
 * step the board holds lends neither its turn-on day (owner decision 2). The
 * page built the board twice per render, once here and once for its views,
 * from the same arguments; it builds it once now and hands it to both.
 */
export function exportHoldOf(board: Pick<BoardReadings, 'readings' | 'titleOf'>): (s: Step) => boolean {
  return (s) => boardHolds(s, laneViewFor(s, board))
}

/**
 * The Export page's Cleanup rows, each as the board reads it: the When column the
 * Plan's row shows (cleanupExport.ts cleanupWhenOnBoard), on the same board
 * `exportViewsOf` reads, and no day while the plan cannot finish. The prompt
 * pack printed "Verify Emergency Access (Sep 1, 2026)." and the bundle carried
 * that day under a row the board read "After prerequisites" (Phase 2 export
 * finding 3; owner decision 2).
 */
export function exportCleanupViewsOf(board: Pick<BoardReadings, 'readings' | 'titleOf'>, steps: Step[], phase: CleanupPhase | null | undefined): CleanupExport[] {
  const undated = planFinish(steps, phase?.end ?? null).held
  return cleanupExportViews(phase, { undated, laneOf: (id) => { const r = board.readings.get(id); return r ? laneViewOf(r, board.titleOf) : null } })
}

/**
 * The operation each Ready substatus hands over, as the schedule names a day's
 * transition (roadmap/stepSchedule.ts). Review, Decision and Observing hand over
 * none: the day is for looking, not for a change.
 */
const OPERATION_OF: Partial<Record<Substatus, ExportStep['operation']>> = { Create: 'createReportOnly', Correct: 'change', 'Ready to enforce': 'enforce' }

export function stepExportView(step: Step, ctx: StepVarContext, lane: LaneView | null = null, startOf?: PrerequisiteLabel['startOf']): ExportStep {
  const cs = contentStepFor(step) as Record<string, any> | undefined
  // The frozen Step Contract, once, for every step. It is read and never
  // re-decided: the badge, the dated next line, the reach, the one action, the
  // outstanding prerequisites, the completion and whether an implementation is
  // offered are all its answers, and an artifact that carried its own reading of
  // any of them would be a second authority. The state is the lane label the
  // row and the opened step's badge show (planBoard.ts laneLabelOf), and the
  // lane's parts travel beside it for a reader that keys on them.
  // No lane handed down is a step read with nothing around it (planBoard.ts
  // laneViewAlone); the Export page hands down the board's (exportViewsOf).
  const laneView = lane ?? laneViewAlone(step)
  // Whether the board holds the step (planBoard.ts boardHolds), on the reading
  // handed down: a held step carries no date in any artifact — no Dates line, no
  // Next line, no day in its words, and no calendar entry (owner decision 2,
  // 2026-09-22). The export of a policy whose turn-on the board held read
  // "Announce Sep 20, 2026 · Change Sep 21, 2026" under a row reading "After
  // prerequisites" (R4-55).
  const undated = boardHolds(step, lane)
  const contract = stepContract(step, ctx, undefined, laneView, startOf, undated)
  // The readiness threshold that holds the turn-on: the contract's gate finding,
  // which is the Threshold card's own sentence on the same route start
  // (stepContract.ts foundOf), and holds the enforcement, never the create
  // (owner, 2026-09-11). No export carried it, so the calendar, the pack and the
  // bundle read a clean week of report-only as the finish of a policy the screen
  // said waits for 90% (Phase 2 export finding 7). A policy already on waits for
  // nothing — the card then states only the count (readinessSentence's own
  // `waiting` test) — so it is no turn-on wait: demo Require MFA for Everyone, a
  // correction to a policy already enforced, exported "Before turning on: At
  // least 69% …".
  const threshold = step.state.lifecycle === 'enforced' ? null : (contract.found.find((f) => f.key === 'gate')?.text ?? null)
  const shell = {
    state: badgeLabel(contract),
    manualEvidence: manualEvidenceLines(step, ctx),
    // The lane word alone; a step the person ruled out reads its own label (Doesn't apply).
    lane: laneView.tail === null ? laneView.label : laneWordOf(laneView.lane),
    substatus: laneView.substatus === null ? null : SUBSTATUS_WORD[laneView.substatus],
    reason: laneView.lane === 'Ready' ? null : laneView.tail,
    fact: factOf(step),
    next: contract.milestone.line,
    who: contract.who?.text ?? null,
    // The count behind that sentence, from the one population authority
    // (derive/population.ts), and null on exactly the steps whose scope
    // Foundation A could not settle — the same steps the contract's `who` says
    // it does not know. An unknown reach is never written down as a number.
    population: stepPopulation(step)?.active ?? null,
    // A finding with no detail ended "Passkey protections: Needs correction. " —
    // a stop and a space with nothing after them. The detail joins the verdict
    // only when there is one to join.
    fix: [...new Set([...contract.fix.map((f) => f.text), ...(step.configurationFindings ?? []).filter(f => f.outcome !== 'pass').map(f => [`${f.label}: ${f.value}.`, f.detail.trim()].filter(part => part !== '').join(' '))])],
    // What holds only the turn-on while the create is next, from the contract's
    // one list, apart from `fix`: the create is not blocked by any of it (R4-31).
    beforeTurnOn: [...new Set([...contract.enforcementWaits.map((f) => f.text), ...(threshold === null ? [] : [threshold])])],
    implementation: contract.implementation.offered,
    // The board's row hands over an operation only from Ready (Phase 2 export
    // finding 0): the calendar booked "Create in report-only" for a row the board
    // held Up Next behind its prerequisites, from the step's schedule alone.
    operation: laneView.lane === 'Ready' && laneView.substatus !== null ? OPERATION_OF[laneView.substatus] ?? null : null,
    undated,
  }
  if (!cs) {
    // No content entry at all. Every step the plan draws has one now (task 011),
    // so this is a step nothing has words for: the export carries what the
    // contract knows about it — where it is, what to do next and what would
    // finish it — and none of the engine's prose, exactly as the screen does.
    return { title: contentTitle(step), why: contract.why, ...shell, whatToDo: [contract.whatToDo.text, gateLine(contract.whatToDo.gatedBy, laneView)].filter((l): l is string => l !== null), doneWhen: contract.doneWhen, ifWrong: null, dates: null }
  }
  const ex = undated ? withoutScheduleDates(stepVars(step, ctx), step, ctx) : stepVars(step, ctx)
  const names = portalNamesFor(ctx, ex, contentTitle(step))
  // The settings the lines state are the ones the step's package selects for its JSON
  // (stepPackage.ts selectedPolicyBodiesOf), read only where the lines are handed over.
  const selected = cs.kind === 'policy' && implementationOffered(step) && implementationIsCurrent(step) ? selectedPolicyBodiesOf(step, ctx, contract) : null
  const portal = cs.kind === 'policy' ? stepPortalLines(step, names, selected) : null
  // The screen's rule, in the export: where no implementation is offered the
  // export carries the explanation, never the instructions
  // (roadmap/operations.ts). The reasons a policy cannot be implemented — an
  // object it names is missing, a pair the plan cannot match, a baseline that
  // contradicts itself, a final scope that reaches the emergency accounts or
  // cannot be shown not to — each carry their own next action and none of them
  // carries a rollout.
  const reason = cs.kind === 'policy' ? unavailableReason(step) : null
  // The step has an implementation and today is not the day to run it: its
  // policy is in report-only and the only thing left to submit is the
  // enforcement the window has not earned (roadmap/forecast.ts). The artifacts
  // carry what the screen carries — the next action, which is to keep watching —
  // and none of the instructions for making the change.
  const unearned = cs.kind === 'policy' && enforcementUnearned(step)
  // The one reading the screen makes too (stepInstructions.ts): while an
  // authority holds the change, the lead and the "before" lines say nothing on
  // either surface.
  const held = instructionsHeld(step, cs)
  const suppressed = cs.kind === 'policy' && !implementationOffered(step)
  const waiting = reason === 'missing-object'
  const unmatched = reason === 'unmatched-pair'
  const conflicted = reason === 'baseline-conflict'
  const conflictWords = baselineConflictWords(step)
  const noOperation = reason === 'no-operation'
  const manual = reason === 'manual-correction'
  const emergencyUnsafe = reason === 'unsafe-emergency-access'
  const emergencyUnproven = reason === 'unverified-emergency-exclusion'
  const escapeHatch = reason === 'escape-hatch-unverified'
  const readinessHeld = reason === 'readiness-unmet'
  const inPlace = suppressed && reason === null && isPreserved(step)
  // The What to do for the state the scan read (content/render.ts whatToDoFor).
  const w = (whatToDoFor(cs, ex) ?? {}) as Record<string, unknown>
  const lines: string[] = []
  // The lead and the "before" lines are part of implementing the policy — a
  // setting to change before it is created. While it cannot be written they say
  // nothing here either, on any surface that reads this view (the exports, the
  // print, the prompts, the grounding bundle): the next action stands alone.
  if (!held && typeof w.lead === 'string' && whole(w.lead, ex)) lines.push(fillText(w.lead, ex))
  if (!held) lines.push(...wholeLines(w.before, ex))
  // The screen draws these lines only in the channel strip, and only while the
  // implementation is the step's current action (stepBody.ts `deployNow`). An
  // enforced block policy held on emergency access exported the correction that
  // removes its direct break-glass exclusion under "Clear what this step is
  // waiting on."; held, the export carries the action alone, as the screen does.
  if (portal && portal.length > 0) {
    if (implementationIsCurrent(step)) lines.push(...portal, ...previewValueLines(step, ctx, contract))
  }
  else if (waiting) lines.push(waitingLine(step, String(ex.tenant ?? '')))
  else if (unmatched) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan[step.action.ambiguousTarget ? 'targetAmbiguous' : 'pairUnmatched']), { tenant: String(ex.tenant ?? '') }))
  // The conflict explanation belongs to the reviewed source policy the step's
  // own state names (roadmap/baselineConflict.ts), never to the goal's content
  // entry: the artifacts say the same thing the screen says about it, on
  // whichever goal the active baseline hands that source.
  else if (conflicted && conflictWords !== null) lines.push(fillText(conflictWords, ex))
  // The screen's own reason line (stepContract.ts reasonLine), not a second copy
  // of the generic one: "Scan again to rebuild it" is false over a policy the
  // tenant switched off, one that already delivers the goal, and one that
  // already holds everything this step writes, and only the screen knew that.
  else if (noOperation) lines.push((contract.implementation.offered ? null : contract.implementation.because) ?? fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.noOperation), { tenant: String(ex.tenant ?? '') }))
  else if (manual) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.manualCorrection), { tenant: String(ex.tenant ?? ''), fields: dimensionWords(step.state.observation?.unwritten ?? []) }))
  else if (emergencyUnsafe) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.emergencyUnsafe), { tenant: String(ex.tenant ?? '') }))
  else if (emergencyUnproven) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.emergencyUnproven), { tenant: String(ex.tenant ?? '') }))
  else if (escapeHatch) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.escapeHatchHeld), { tenant: String(ex.tenant ?? ''), steps: heldByTitle(step) }))
  else if (readinessHeld) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.readinessHeld), { tenant: String(ex.tenant ?? ''), ...(step.action.readinessGate ?? {}) }))
  // A goal the tenant already delivers says *which* policy delivers it, in the
  // artifacts as on the screen. The line used to be the bare "nothing to
  // create", which is also the contract's action and is unshifted in front of
  // it below — so the calendar entry, the prompt pack, the grounding bundle and
  // the plan file all said a policy existed and none of them said which one.
  // Read from the frozen Step Contract's own finding, so the two cannot drift.
  else if (inPlace) lines.push(...contract.found.filter((x) => x.key === 'in-place').map((x) => x.text))
  // The steps' promise that a scan shows progress follows them while a scan can
  // (stepInstructions.ts rescanLinesOf, R4-20), in the artifacts as on the screen.
  else if (!unearned && Array.isArray(w.steps)) lines.push(...wholeLines([...w.steps, ...rescanLinesOf(step, cs).steps], ex))
  // The next action the screen states, in the artifact. Where the step's content
  // carries a lead it is already the first line above and the contract's action
  // is that same sentence; where it carries none the contract falls back to
  // Foundation B's milestone ("Create the policy in report-only."), and without
  // this the calendar entry, the prompt pack and the bundle began at the portal
  // path with the operation itself never said. Read from the frozen Step
  // Contract, not decided again here.
  //
  // It is unshifted for every step, an unavailable one included. The reason
  // branches above state a policy that cannot be written; on the baseline
  // conflict that is the contradiction's own paragraph, and the action the
  // screen puts above it — "Wait for a reviewed baseline that settles the
  // contradiction; there is nothing to submit." — was in no artifact at all.
  // Where the reason line and the action are the same sentence (a missing
  // object, an emergency account in reach) the guard below keeps it once.
  const pkg = implementationPackageFor(step)
  const state = pkg ? packageStateOf(step, contract, ctx.snapshot) : null
  let hasPackagePortal = false
  if (pkg && state && cs.kind === 'policy') {
    const bindings = packageBindings(step, ctx, contract)
    const { runtime } = packageRuntime(pkg, state, bindings, {})
    const projection = projectSafely(pkg, state, bindings, runtime)
    const preview = planningPreview(pkg, step, contract, ctx.snapshot, bindings, runtime, projection)
    const projectedEntra = (preview?.channels ?? projection.channels).find(channel => channel.channel === 'entra')
    const entra = projectedEntra ?? lifecycleResources(pkg, state, bindings, runtime).find(channel => channel.channel === 'entra')
    if (entra) {
      hasPackagePortal = true
      lines.splice(0)
      // The portal channel the opened step draws: its preparation where that
      // stands in for the package's procedure (stepInstructions.ts
      // preparationLines), else the package's own.
      const preparation = preparationLines(step, cs, true)
      lines.push(...(preparation ?? [...(projectedEntra ? entraWithSettings(entra.text, step, ctx, contract, preview ?? projection) : entra.text).replace(/\*\*(.*?)\*\*/g, '$1').split(/\r?\n/).map(line => line.trim()).filter(Boolean), ...(preview ? previewNoteLines(step, contract, preview.hold) : [])]))
    }
  }
  // A policy the tenant has switched off inspects the one that is there, in
  // every channel that carries these lines.
  //
  // The package's blocked projection is the create procedure, and
  // `hasPackagePortal` let it through to the export and to the AI brief — so
  // the brief read "Turning it back on is the change here, not a new policy"
  // and then, two lines later, "1. Open Entra ID > Conditional Access >
  // Policies > New policy. 2. Name: ...". That is the channel most likely to be
  // pasted into an assistant, which would then confidently instruct the
  // duplicate this whole reason exists to prevent.
  const switchedOff = cs.kind === 'policy' && unavailableReason(step) === 'switched-off'
  if (switchedOff || (!conflicted && !inPlace && !hasPackagePortal && cs.kind === 'policy' && !(portal?.length && implementationIsCurrent(step)))) lines.splice(0, lines.length, ...policyInspectionLines(step))
  // The correction a person owes in a part IAMAI does not write, as the screen's
  // portal carries it (stepPortal.ts unwrittenCorrectionLines), once.
  if (cs.kind === 'policy') {
    const correction = unwrittenCorrectionLines(step, names, String(ex.tenant ?? ''))
    lines.unshift(...correction.filter((l) => !lines.includes(l)))
  }
  lines.push(...verificationResourceLines(step, ctx.mapping))
  const action = contract.whatToDo.text
  if (cs.kind !== 'policy' && contract.state.lane?.lane === 'Completed') lines.splice(0)
  // What the action waits on, beside the action, where the action is the wait
  // (stepContract.ts `ContractAction.gatedBy`). The screen said "Waiting on your
  // direction" on the row and the badge and nothing here did, so a step this
  // browser handed to a change board read "Clear what this step is waiting on."
  // with no way to find out what that was. The contract's own field, in the
  // contract's own words: nothing is composed and nothing is decided again.
  const gate = gateLine(contract.whatToDo.gatedBy, laneView)
  if (gate !== null && !lines.includes(gate)) lines.unshift(gate)
  if (action.trim().length > 0 && !lines.includes(action)) lines.unshift(action)
  // The three emergency preparation steps export the task text the screen shows
  // (stepBody.ts), not the content's older What to do lines (overnight review B5).
  const emergencyTasks = step.id === EMERGENCY_ACCOUNTS ? emergencyAccountTasksOf(step, ctx)
    : step.id === EMERGENCY_GROUP ? emergencyGroupTasksOf(step, ctx)
      : step.id === PASSKEY_SETTINGS ? emergencyPasskeyTasksOf(step, ctx)
        : null
  if (emergencyTasks) {
    // A finished step's procedures are reference here too, as on the screen.
    //
    // The lines of a Completed step are cleared above, and these three steps
    // then refilled them with every procedure, so the export and AI Info of a
    // finished Prepare Emergency Access Accounts read thirty-one numbered
    // imperative lines as its What to do — "Create an emergency account … 2.
    // Open … New user → Create new user" — while the screen folded the same
    // words under the reference label and the print listed the step by title
    // (R4-45). Same words, same label, same rule as the screen.
    const reference = proceduresAreReference(laneView) ? [CONTRACT.implementation.reference] : []
    lines.splice(0, lines.length, ...reference, ...emergencyAccountTasksText(emergencyTasks).replace(/\*\*/g, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))
    // The export opens with the screen's action, as every artifact does (013.A).
    if (action.trim().length > 0 && !lines.includes(action)) lines.unshift(action)
  }
  // The completion, from the contract, for every step. Nothing here implies the
  // policy can be rolled out while it cannot be written: where a reason holds
  // it, the contract's completion is what would *clear the reason*
  // ("Create the object this policy names in {tenant}."), never the report-only
  // days and failure rates of a rollout nobody can start. This used to be an
  // empty list on exactly those steps — the calendar entry said nothing and the
  // prompt pack filled the gap with "the next scan confirms it", a completion
  // no authority had stated.
  const doneWhen = contract.doneWhen
  return {
    title: contentTitle(step),
    why: typeof cs.why === 'string' ? fillText(cs.why, ex) : contract.why,
    ...shell,
    whatToDo: namedPortalResource({ id: 'portal', form: 'list', lines, text: () => lines.join('\n'), note: null }, ctx).lines,
    doneWhen,
    ifWrong: ((line) => (reason === null && line && whole(line, ex) ? fillText(line, ex) : null))(ifWrongLineFor(step, cs, ex)),
    dates: !undated && reason === null && whole(datesLineFor(step, cs), ex) && datesLineFor(step, cs) ? fillText(datesLineFor(step, cs), ex) : null,
  }
}

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))
const listKeys = (line: string): string[] => [...line.matchAll(/\{list:([^}]+)\}/g)].map((m) => m[1])
/**
 * A sentence reads this tenant when it names a variable the scan fills. One
 * with no variables at all, or only shared references — the baseline's strength,
 * the report-only line — is standing guidance, true of every tenant, and says
 * nothing about what was found here.
 */
const readsTenant = (line: string): boolean => [...line.matchAll(/\{(?:list:)?([a-zA-Z0-9_]+)\}/g)].some((m) => !SHARED_REF_KEYS.has(m[1]))

/**
 * The sentence a claim leaves behind when it cannot be filled (R4). An unfilled
 * claim says so; it never empties its slot and lets the opposite claim stand
 * there instead.
 */
export const WHO_UNRESOLVED: string = String((content.shared as Record<string, unknown>).whoUnresolved)

/**
 * The Who lead's template, whole: the step's own, or — where the only hole in it
 * is a date the plan does not hold — its undated form. Who a step reaches is not
 * a date, and the campaign's lead ("… the plan waits for 90% until {enrollBy}")
 * vanished whole while nothing was dated (roadmap/holds.ts), taking the people
 * it counts with it. Null where neither fills. The screen (whoBlocks.ts) and the
 * rendered lines below read this one choice.
 *
 * `who.leadWhen` is a lead per read state — the fact the sentence asserts, and
 * the sentence. The one whose fact this scan read stands; where the scan read
 * none of them the lead is unresolved, because a sentence written for one state
 * is not evidence of another (R4: the security-defaults step described
 * protections that were off).
 */
export function whoLeadTemplate(who: Record<string, unknown>, ex: Record<string, unknown>): string | null {
  const when = who.leadWhen as Record<string, string> | undefined
  if (when) {
    for (const [fact, line] of Object.entries(when)) if (truthy(ex[fact]) && whole(line, ex)) return line
    return WHO_UNRESOLVED
  }
  for (const line of [who.lead, who.leadUndated]) if (typeof line === 'string' && whole(line, ex)) return line
  return null
}

/**
 * The who-line evidence sentences this tenant earns — the one gate for the
 * screen and the exports, and every sentence it returns is whole, so neither
 * caller has a gate of its own to disagree with. The existing-coverage line only
 * when a policy delivers the goal; a line with a list only when the list has
 * people; a line with {n} and no list not at zero; the none branch only when no
 * reading of this tenant rendered.
 *
 * R4, the rule this enforces: **a claim that cannot be filled says so, and never
 * falls through to its own negation.** A claim whose evidence is present but
 * whose sentence has a hole used to be dropped by the callers' own `whole`
 * gate — which emptied the slot and let the step's none branch print the
 * opposite: "Nobody used a legacy protocol since Jul 29, 2026" two steps after
 * the product named the three accounts that did. Here such a claim keeps its
 * slot with WHO_UNRESOLVED, and an unresolved claim holds the none branch back.
 * The negation stands only where this tenant was read and found clean.
 */
export function whoEvidenceLines(who: Record<string, unknown>, ex: Record<string, unknown>): string[] {
  const out: string[] = []
  let none: string | null = null
  // A reading of this tenant rendered / a reading of this tenant could not be
  // completed. Either one holds the none branch back; only general guidance,
  // which names no variable this tenant fills, leaves it free.
  let read = false
  let unresolved = false
  const coverage = String((content.shared as Record<string, unknown>).existingCoverage)
  for (const [k, v] of Object.entries(who)) {
    // A key ending in Undated holds another key's undated forms (below), never lines of its own.
    if (k.startsWith('$comment') || k.endsWith('Undated') || ['lead', 'leadWhen', 'groups', 'adminsNote', 'timeline', 'overlap'].includes(k)) continue
    // A licence caveat has no placeholders, so `whole()` can never gate it: it
    // was drawn on every tenant, seven of eight of which hold Entra ID P1, which
    // made the one honest sentence about the licence carry no information at all
    // (V1 audit S4-21). It is drawn only where the licence withheld the records.
    if (k === 'licenceNote' && !truthy(ex.signInsNeedP1)) continue
    if (k === 'none') {
      none = typeof v === 'string' ? v : null
      continue
    }
    const arr = Array.isArray(v) ? (v as string[]) : typeof v === 'string' ? [v] : []
    // The undated forms of this key's lines, by the line's place (who.<key>Undated):
    // a line that names the day the plan turns the policy on, without that day.
    // A step carries no such day where the board holds it (owner decision 2,
    // 2026-09-22), where the roadmap holds it or where it is finished, and the
    // dated line then could not be completed: it took its people with it, or
    // said IAMAI could not finish the line though the scan read every person in
    // it. The undated form keeps the rest of the line, so it completes exactly
    // where the day was the only hole.
    const undatedForms = (who[`${k}Undated`] ?? null) as Record<string, unknown> | null
    for (const [i, raw] of arr.entries()) {
      let line = raw
      if (line === '{existingCoverage}') {
        if (!truthy(ex.existingPolicies)) continue
        line = coverage
      }
      const lk = listKeys(line)
      if (lk.length > 0 && lk.every((k2) => !truthy(ex[k2]))) continue
      if (lk.length === 0 && line.includes('{n}') && (ex.n ?? 1) === 0) continue
      // The existing-coverage line reads the plan, not the tenant's people; the
      // licence caveat is a reading of what the scan was allowed to see.
      const reading = line !== coverage && (readsTenant(line) || k === 'licenceNote')
      const undated = undatedForms?.[String(i)]
      if (!whole(line, listCountVars(line, ex) as Record<string, unknown>) && typeof undated === 'string' && whole(undated, listCountVars(undated, ex) as Record<string, unknown>)) line = undated
      if (!whole(line, listCountVars(line, ex) as Record<string, unknown>)) {
        // A claim whose people are already on the page — its list has them — and
        // whose sentence still cannot be completed is the R4 case: the evidence
        // is not in doubt, only the wording around it, and the slot says so. A
        // line with no list of its own is one of a pair the content writes for
        // the same reading (the names, or the count past NAMES_UP_TO); the one
        // whose variable this tenant does not fill is simply not its turn.
        if (reading && lk.length > 0) unresolved = true
        continue
      }
      if (reading) read = true
      out.push(line)
    }
  }
  // The slot the negation would have taken. It gets the negation only where this
  // tenant was read and nothing was found; where a claim about the same subject
  // could not be completed, or where the negation itself cannot be stated, the
  // slot says so instead. This is the whole of R4: the step still has one
  // sentence here, and it is never the opposite of what was read.
  // `evidenceNotRead` is the seventh instance of the same fault (R4): a negation
  // is a claim about what a section holds, and a section the scan never read
  // holds nothing IAMAI can speak for. Where the step declares its own evidence
  // unread, the slot says so rather than stating the negative.
  if (none !== null && !read) out.push(unresolved || truthy(ex.evidenceNotRead) || !whole(none, listCountVars(none, ex) as Record<string, unknown>) ? WHO_UNRESOLVED : none)
  return out
}

/** What a step's Tell your people box says, with the tenant's values. */
export type CommsView = { salutation: string; body: string; extra: string[]; signature: string }

/**
 * The step's email, as the screen shows it (one rule for the screen, the copy
 * button and the exports): the body keyed on the tenant's state, the extra
 * lines an answer or the state adds (each only when whole), the salutation
 * and the signature. The campaign carries a second body for a tenant where
 * Require MFA for Everyone is already in place (comms.bodyMfaInPlace, with
 * comms.extraMfaInPlace), the passkey version; otherwise comms.body.
 *
 * The step's own enforcement day reaches the email through `{enforceLong}`, and
 * what that day is worth is not the email's decision (roadmap/forecast.ts
 * `forecastEnforcement`). While it is the roadmap's projection the message says
 * so, in its own paragraph under the one that states the day, so the email and
 * the Dates line above it answer "when" the same way instead of the line
 * withholding an enforcement date the email underneath commits to. Once
 * Foundation B's evidence has earned the date the email states it plainly, with
 * nothing added — the same words the prompt pack's draft carries
 * (`exportAnnouncementOf`).
 */
export function commsFor(cs: Record<string, unknown>, ex: Record<string, unknown>, step: Step): CommsView | null {
  const comms = (cs.comms ?? null) as Record<string, unknown> | null
  if (!comms) return null
  // A step already in place asks nobody to do anything: no email (stepVars stepDone).
  if (ex.stepDone) return null
  const inPlace = Boolean(ex.mfaInPlace) && typeof comms.bodyMfaInPlace === 'string'
  const dated = inPlace ? comms.bodyMfaInPlace : comms.body
  // The campaign is work for today: it is how readiness reaches the number the
  // plan waits for, so its email is needed most while the plan dates nothing
  // (roadmap/holds.ts). Where the dated body cannot fill, its undated form stands
  // in — it names no day, no window and no phase, and says the date comes later.
  // Every other hole still withholds the email whole: the undated form carries the
  // same tenant and guidance variables.
  const undated = inPlace ? comms.bodyMfaInPlaceUndated : comms.bodyUndated
  const body = typeof dated === 'string' && whole(dated, ex) ? dated : typeof undated === 'string' && whole(undated, ex) ? undated : dated
  // The hole rule, once, for the screen, the copy box, the exports and the
  // tests' lines: the email renders whole or not at all, like any other line.
  if (![comms.salutation, body, comms.signature].every((part) => typeof part === 'string' && whole(part, ex))) return null
  const extraRaw = inPlace && comms.extraMfaInPlace !== undefined ? comms.extraMfaInPlace : comms.extra
  const extraTemplates = (Array.isArray(extraRaw) ? extraRaw : extraRaw === undefined || extraRaw === null ? [] : [extraRaw]).filter((l): l is string => typeof l === 'string' && whole(l, ex))
  // Only a message that actually states this step's enforcement day is
  // qualified: a template that names no date has nothing to qualify, and a
  // committed date needs no qualifying.
  const forecast = forecastEnforcement(step) && [body as string, ...extraTemplates].some((t) => t.includes('{enforceLong}'))
  const extra = extraTemplates.map((l) => fillText(l, ex))
  if (forecast) extra.push(SHARED.commsForecastNote)
  return { salutation: fillText(comms.salutation, ex), body: fillText(body, ex), extra, signature: fillText(comms.signature, ex) }
}

/**
 * A decision block's one line under its label: the help while the decision is
 * open ("Until you decide, …"), or the effect of the answer once it is made
 * (answers.ts effectLine) — never both (the device decision showed its open
 * line under its answer). One rule for the screen and the rendered lines.
 */
export function decisionLine(d: Record<string, unknown>, answer: { index: number } | null): unknown {
  return answer ? effectLine(d.effect, answer) : d.help
}

/**
 * The manager's three sentences, with the clause a step adds when the records
 * show nobody using what it blocks (more.managerNone, under its `applies`, E9);
 * null when the manager line is not whole.
 */
export function managerText(cs: Record<string, unknown>, ex: Record<string, unknown>): string | null {
  const more = (cs.more ?? {}) as Record<string, unknown>
  if (typeof more.manager !== 'string' || !whole(more.manager, ex)) return null
  const none = more.managerNone as { text?: unknown; applies?: unknown } | undefined
  const applies = none && typeof none.text === 'string' && (typeof none.applies !== 'string' || Boolean(ex[none.applies])) && whole(none.text, ex)
  return applies ? `${fillText(more.manager, ex)} ${fillText(none!.text, ex)}` : fillText(more.manager, ex)
}

/**
 * Every line the step body renders on screen, filled, for the tests that read
 * rendered text without a DOM: the why, the who lines, the decision's words,
 * What to do, Done when, If wrong, the dates, More and the Tell your people box.
 * The gate is the screen's: a line renders only when it is whole.
 */
export function stepLines(step: Step, ctx: StepVarContext): string[] {
  const cs = contentStepFor(step) as Record<string, any> | undefined
  if (!cs) return [contentTitle(step)]
  const ex = stepVars(step, ctx) as Record<string, unknown>
  const out: string[] = []
  const add = (line: unknown, vals: Record<string, unknown> = ex): void => {
    if (typeof line === 'string' && whole(line, vals)) out.push(fillText(line, vals))
  }
  const view = stepExportView(step, ctx)
  out.push(view.title, view.why, ...view.whatToDo, ...view.doneWhen)
  if (view.ifWrong) out.push(view.ifWrong)
  if (view.dates) out.push(view.dates)
  add(cs.changeLine)
  add(cs.partner)
  const who = (cs.who ?? {}) as Record<string, unknown>
  add(whoLeadTemplate(who, ex))
  add(who.adminsNote)
  // The evidence lines as the step gates them; a line that counts and lists counts its own list (render.ts listCountVars).
  for (const line of whoEvidenceLines(who, ex)) add(line, listCountVars(line, ex) as Record<string, unknown>)
  // The campaign's people lists: each bucket's line, only where the bucket has people (as the screen).
  for (const [gk, gl] of Object.entries((who.groups ?? {}) as Record<string, unknown>)) {
    const items = ex[gk]
    if (Array.isArray(items) && items.length > 0) add(gl, { ...ex, n: items.length })
  }
  const d = (cs.decision ?? {}) as Record<string, unknown>
  add(d.label)
  add(decisionLine(d, answerOf(ctx.mapping, step.id, 'decision')))
  for (const o of Array.isArray(d.options) ? d.options : []) add(o)
  // The What to do for the state the scan read (content/render.ts whatToDoFor).
  const w = (whatToDoFor(cs, ex) ?? {}) as Record<string, unknown>
  if (ex.createIfNeeded && typeof w.createIfNeeded === 'string') add(w.createIfNeeded)
  if ((ex.needsCreate || ex.createIfNeeded) && Array.isArray(w.create)) for (const l of w.create) add(l)
  const fixes = (w.checkFixes ?? {}) as Record<string, string>
  for (const [key, vals] of (Array.isArray(ex.failingChecks) ? ex.failingChecks : []) as [string, Record<string, unknown>][]) add(fixes[key], { ...ex, ...vals })
  const more = (cs.more ?? {}) as Record<string, unknown>
  for (const r of Array.isArray(more.risks) ? (more.risks as { text?: string }[]) : []) add(r.text)
  for (const l of Array.isArray(more.helpDesk) ? more.helpDesk : []) add(l)
  const manager = managerText(cs, ex)
  if (manager) out.push(manager)
  const comms = commsFor(cs, ex, step)
  if (comms) out.push(comms.salutation, comms.body, ...comms.extra, comms.signature)
  return out
}

/**
 * The announcement the prompt pack offers to rewrite and translate: the Tell your
 * people email of the first step, in plan order, that shows one (`copyBoxes`,
 * the screen's own box) and that the board does not hold (`held`: a held step
 * carries no date anywhere, owner decision 2), named by that step's title. Null
 * where no step shows an email, and the pack then offers no announcement prompt.
 * It took the generator's draft instead, which could read "No announcement
 * needed: nobody is affected." over a policy reaching 246 people (Phase 2 export
 * finding 5).
 */
export function exportAnnouncementOf(steps: readonly Step[], held: (s: Step) => boolean, ctxOf: (s: Step) => StepVarContext): { step: string; text: string } | null {
  for (const step of steps) {
    if (held(step)) continue
    const email = copyBoxes(step, ctxOf(step)).find((b) => b.kind === 'comms')
    if (email) return { step: contentTitle(step), text: email.text }
  }
  return null
}

/** The step's copy boxes as the screen renders them: Tell your people, For the help desk, For your manager, each followed by the adapt line. */
export function copyBoxes(step: Step, ctx: StepVarContext): { kind: 'comms' | 'helpDesk' | 'manager'; text: string; after: string }[] {
  const cs = contentStepFor(step) as Record<string, any> | undefined
  if (!cs) return []
  const ex = stepVars(step, ctx) as Record<string, unknown>
  const after = String((content.shared as Record<string, unknown>).adaptLine)
  const out: { kind: 'comms' | 'helpDesk' | 'manager'; text: string; after: string }[] = []
  const comms = commsFor(cs, ex, step)
  if (comms) out.push({ kind: 'comms', text: [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n'), after })
  const more = (cs.more ?? {}) as Record<string, unknown>
  const helpDesk = (Array.isArray(more.helpDesk) ? more.helpDesk : []).filter((x) => whole(x, ex))
  if (helpDesk.length > 0) out.push({ kind: 'helpDesk', text: helpDesk.map((x) => fillText(x, ex)).join('\n'), after })
  const manager = managerText(cs, ex)
  if (manager) out.push({ kind: 'manager', text: manager, after })
  return out
}
