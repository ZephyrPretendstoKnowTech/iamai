import { NETWORK_NAME, NETWORK_RANGES, validNetworkRanges } from '../../mapping/networkDraft.ts'
import { PASSKEY_METHODOLOGY, passkeyReadiness } from './passkeyPresentation.ts'
import { PasskeyModelDecision } from './PasskeyModelDecision.tsx'
import { ManualReviewForm } from './ManualReviewForm.tsx'
// A step opened in place: the one body the Plan draws for every step it has, and
// the only one (task 011).
//
// The anatomy is the approved Plan design's
// (docs/design/approved/anatomy/plan-step-v1.html, owner update Sep 10, 2026):
// the head with its lifecycle track, then Why, Readiness — the one place a
// prerequisite is shown, A1 §16.1 — Implementation and Done when, beside an
// action column that holds the milestone and the controls the step takes in
// IAMAI (U2; no step draws What to do, U1), over a footer
// that carries the rollout exception and the scan. Every step draws those
// regions with the same components; its state changes what they say, never which
// component draws them. Every sentence is a string in content.json filled with
// the tenant's values (stepVars.ts); the portal lines are the translator over
// the goal's baseline policy (stepPortal.ts), because the baseline wins.
//
// Three things this body will not do.
//
// It does not require a content entry. A free-tier ladder rung and a validation
// blocker are named and explained by the engine, and before this they opened to
// an empty panel; now the contract's own title, Why and next action stand, and
// the content entry adds only the words the engine has none of.
//
// It does not put everything the engine knows on the first screen. What IAMAI
// found and who the step touches, names and all, are the evidence behind the
// Readiness region and open from it ("Why IAMAI says this"); the person-by-person
// registration state behind them belongs to the MFA readiness surface, not to a
// rollout step. The printed plan keeps every one of them on the page.
//
// And it does not decide anything. What the step is, whether an implementation
// is offered, what blocks it and what finishes it are the contract's answers,
// asked once, below the UI.
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Step } from '../../roadmap/types.ts'
import { isEmergencyAccess } from '../../roadmap/blockerSteps.ts'
import { groupOf, usesTaskAnatomy } from '../../roadmap/stepGroups.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, content, workflowWords } from '../../content/content.ts'
import { fillText, whole, SINGLE_CHOICE_SOURCES } from '../../content/render.ts'
import { Button, Callout, Icon, Picker, TabList, onePanelProps } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import { exclusionsPickerLabel, filterPickerObjects, initialPicked, matchedNoteOf, pickerSaves, pickerSavesAlone, pickerUniverse, printedDefaultLine } from './pickerRows.ts'
import type { PickerObject } from './pickerRows.ts'
import { answerParts, answerText, optionsOf, questionFor, valueSource } from './stepQuestion.ts'
import type { QuestionOption } from './stepQuestion.ts'
import { answerKey } from '../../roadmap/decisions.ts'
import { SPECIAL_CARE_STEP_ID, answerOf, effectLine } from '../../roadmap/answers.ts'
import { commsFor, datesLineFor, managerText, decisionLine } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { REDACTED, exportClipboard, unredactedFrom } from '../exportGuard.ts'
import { CONTRACT, implementationEmptyOf, partnerLinkOf, readinessLeadOf, stepContract } from './stepContract.ts'
import type { ImplementationEmpty, LaneView, PrerequisiteBlocker, PrerequisiteLabel } from './stepContract.ts'
import { HARDENING_DEFERRAL_ID } from '../../validation/emergencyTiers.ts'
import { AuthoredText, DoneWhen, EmergencySlotBody, PolicyMembers, ReadinessSection, ScanNote, StepActionColumn, StepDialog, StepFooter, StepHead, StepSection, StepState, WHY_LINK_SHOWN, WhatIamaiFound, WhatToDoLead, badgeLabel } from './StepSections.tsx'
import { MfaHandoff } from './MfaHandoff.tsx'
import { HEAD, decisionHeadingsOf, taskHeadingsOf } from './stepHeadings.ts'
import { AnsweredInDirection, DirectionQuestions, directionDraftKey } from './DirectionQuestions.tsx'
import { ANSWERED_IN } from '../../roadmap/direction.ts'
import { channelTabsOf, stepBodyOf, truthy } from './stepBody.ts'
import type { Artifact, Channel } from './stepBody.ts'
import { whoBlocks } from './whoBlocks.ts'
import type { WhoBlock } from './whoBlocks.ts'
import { BASELINE_COMMIT, packageDrawsImplementation, planningPreview } from './stepPackage.ts'
import { list } from '../../copy/statements.ts'
import { prerequisiteBasis } from '../../content/implementation/project.ts'
import type { OwnerConfirmation, TroubleshootingScenario } from '../../content/implementation/project.ts'
import type { ReadinessTile } from './stepContract.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { emergencyTaskFacts, emergencyTaskSteps, emergencyTaskText } from './emergencyAccountTasks.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import { consolidateEmergencyReadiness, emergencySubjectsOf } from './emergencyReadiness.ts'
import { cardWordsOf, drawsTaskAnatomy, policyBarOf, policySubjectsOf, taskSubjectOf } from './policyTasks.ts'
import type { EmergencyFact, EmergencySubjectTile } from './emergencyReadiness.ts'
import type { ApprovedModel } from '../../roadmap/emergencyJourney.ts'
import { operatorExclusionsDecision } from '../../mapping/safetyChoice.ts'

type Ex = Record<string, unknown>

const NO_CONFIRMATIONS: Readonly<Record<string, OwnerConfirmation>> = {}
const NO_BLOCKERS: readonly PrerequisiteBlocker[] = []

type EmergencyTaskPreference = { taskId?: string; variants?: Record<string, string> }
// The chosen task and channel variants, kept for this page load only. Its key
// names the tenant, and nothing about a tenant reaches web storage
// (sessionTruth.test): a module-level map survives the step remounting as the
// person moves between steps, and goes when the page does.
const EMERGENCY_TASK_PREFERENCES = new Map<string, EmergencyTaskPreference>()
function readEmergencyTaskPreference(key: string): EmergencyTaskPreference {
  return EMERGENCY_TASK_PREFERENCES.get(key) ?? {}
}
function writeEmergencyTaskPreference(key: string, patch: EmergencyTaskPreference): void {
  EMERGENCY_TASK_PREFERENCES.set(key, { ...readEmergencyTaskPreference(key), ...patch })
}

/** A content string, filled with the tenant's values. */
/** Under every copy box (Tell your people, For the help desk, For your manager): paste it into your own assistant. */
const ADAPT_LINE = String((content.shared as Record<string, unknown>).adaptLine)

/** Doesn't apply here is offered on a content step flagged for it, never on a foundation, never on a policy step whose subject exists. */
function offersDoesntApply(cs: Record<string, any>, step: Step): boolean {
  if (cs.doesntApply !== true || isEmergencyAccess(step)) return false
  if (cs.kind === 'policy' && step.population.total > 0) return false
  return true
}
const SHARED = content.shared as Record<string, string>

/** One who block: the sentence, and its names under it. */
function WhoBlockView({ block }: { block: WhoBlock }) {
  if (block.names.length === 0) return <p className="reason">{block.lead}</p>
  return (
    <div className="names-group">
      {block.lead && <p className="reason">{block.lead}</p>}
      <ol className="names">{block.names.map((nm, i) => <li key={i}>{nm}</li>)}</ol>
    </div>
  )
}

function T({ s, ex }: { s: unknown; ex: Ex }) {
  if (s === null || s === undefined) return null
  return <>{fillText(s, ex as Record<string, unknown>)}</>
}

function ApprovedAuthenticatorModels({ models }: { models: ApprovedModel[] }) {
  return <details className="approved-model-disclosure"><summary>Approved authenticator models</summary>
    <ul className="approved-model-list">{models.map(model => <li key={model.aaguid}><span>{model.name} — {model.aaguid}</span></li>)}</ul>
  </details>
}

/** An identifier (UPN, object id, model id) with break opportunities after "@", "." and "-", so a narrow column wraps it at those boundaries rather than mid-word. */
export function Breakable({ text }: { text: string }) {
  return <>{text.split(/(?<=[@.\-])/).map((part, index) => <Fragment key={index}>{index > 0 && <wbr />}{part}</Fragment>)}</>
}

function EmergencyFacts({ facts }: { facts: EmergencyFact[] }) {
  return <dl>{facts.map((fact, index) => <Fragment key={`${fact.label}:${fact.value}:${index}`}>
    <div className="emergency-fact"><dt><Breakable text={fact.label} /></dt><dd><Breakable text={fact.value} /></dd></div>
    {fact.link && <div className="emergency-fact-action"><a href={fact.link.href}>{fact.link.label}</a></div>}
  </Fragment>)}</dl>
}

/** The Tasks Remaining tile standard, from Step 1's account tile: subject label, the subject(s) of the next check, the remaining count, the next check and what is wrong, one action, then Completed checks. */
function EmergencyAccountStatusTile({ account, printing = false }: { account: EmergencySubjectTile; printing?: boolean }) {
  return <article className={`emergency-account-status${account.satisfied ? ' is-satisfied' : ''}`} data-subject-key={account.key}>
    <p className="emergency-account-label">{account.heading}</p>
    {account.upn && <p className="emergency-account-upn">{account.upn.split('\n').map((line, index) => <span key={index}><Breakable text={line} /></span>)}</p>}
    {account.remainingCount !== null && account.remainingCount > 0 && <p className="emergency-account-count">{account.remainingCount} check{account.remainingCount === 1 ? '' : 's'} remaining</p>}
    <h5>{account.title}</h5>
    {/* A line each: Verify Emergency Access lists the last change and the last sign-in under its sentence. */}
    {account.detail && <p className="emergency-account-lines">{account.detail.split('\n').map((line, index) => <span key={index}><Breakable text={line} /></span>)}</p>}
    {account.instruction && <p>{account.instruction}</p>}
    {account.link && <p><a href={account.link.href}>{account.link.label} →</a></p>}
    {!!account.notes?.length && <div className="emergency-account-note"><EmergencyFacts facts={account.notes} /></div>}
    {account.headsUp && <p className="emergency-account-note">{account.headsUp}</p>}
    {account.completed.length > 0 && <details className="emergency-account-completed" open={printing || undefined}>
      <summary>Completed checks · {account.completed.length}</summary>
      <ul>{account.completed.map(item => <li key={item}><Breakable text={item} /></li>)}</ul>
    </details>}
  </article>
}

/** Tasks Remaining for the four Establish Emergency Access steps: one tile per subject, the satisfied ones under Satisfied · N (the Emergency Access steps are frozen: their words are what the owner approved). */
export function EmergencySubjectReadiness({ subjects, printing, barMain, onWhy }: { subjects: EmergencySubjectTile[]; printing: boolean; barMain: string; onWhy: (() => void) | null }) {
  const remaining = subjects.filter(subject => !subject.satisfied)
  const satisfied = subjects.filter(subject => subject.satisfied)
  const tile = (subject: EmergencySubjectTile) => <EmergencyAccountStatusTile key={subject.key} account={subject} printing={printing} />
  // The bar carried the Why IAMAI says this link; with the link hidden its line only
  // repeated the badge and the cards (owner, 2026-09-23), so it is drawn only with the link.
  const bar = onWhy && WHY_LINK_SHOWN && <div className="readiness-bar">{barMain !== '' && <div className="readiness-bar-main"><span className="readiness-bar-head">{barMain}</span></div>}{WHY_LINK_SHOWN && <button type="button" className="inline-link" onClick={onWhy}>{CONTRACT.readiness.why}</button>}</div>
  return <section className="step-section readiness-section emergency-account-readiness">
    <h4>Tasks Remaining</h4>
    {remaining.length > 0
      ? <div className="emergency-account-status-grid">{remaining.map(tile)}</div>
      : <p className="readiness-clear"><span className="readiness-status readiness-status-good" aria-hidden="true">✓</span><strong>No tasks remaining</strong></p>}
    {satisfied.length > 0 && <details className="readiness-satisfied" open={printing || undefined}>
      <summary>Satisfied · {satisfied.length}</summary>
      <div className="emergency-account-status-grid satisfied">{satisfied.map(tile)}</div>
    </details>}
    <ScanNote />
    {bar}
  </section>
}

/** True when a content line has every variable it names — no hole (walk-51 item 2). */

/** A content line as a paragraph, rendered only when it has no hole. */
function Line({ s, ex, cls }: { s: unknown; ex: Ex; cls?: string }) {
  if (s === null || s === undefined || !whole(s, ex)) return null
  return <p className={cls}><T s={s} ex={ex} /></p>
}

type Dialog = 'readiness' | 'implementation' | 'troubleshooting' | 'confirm' | 'rollout' | 'doesnt-apply' | null

export function ContentStep({
  step,
  ctx,
  onSkip,
  onUnskip,
  onDoesntApply,
  onScan,
  decision = null,
  onDecide,
  confirmations = NO_CONFIRMATIONS,
  onConfirm,
  onUnconfirm,
  saveStatus,
  baselineCommit = BASELINE_COMMIT,
  enforceWaits,
  printing = false,
  lane = null,
  blockers = NO_BLOCKERS,
  prerequisiteLabel = null,
  onOpenMappings,
  followUp,
  objectTask,
}: {
  step: Step
  ctx: StepVarContext
  /**
   * The saved decision of the object this step makes itself, and its Save
   * (Step.objectTask; Stage 3): the countries location's picker, drawn on the
   * countries step and saved under the location's own id, as it always was.
   */
  objectTask?: { saved: StepDecision | null; onDecide?: (decision: StepDecisionInput) => void }
  /** The campaign's "Turn on without them for now" list: its saved decision and its Save (roadmap/followUp.ts). Only the campaign is given one. */
  followUp?: { saved: StepDecision | null; onDecide: (decision: StepDecisionInput) => void }
  /**
   * The board's one state reading of this step (planBoard.ts laneViewOf, A1b
   * decision 1): the badge, the bar and the rail read it. A caller with no board
   * (the printed step) gets the engine's reading of the step on its own.
   */
  lane?: LaneView | null
  /** The engine's unresolved prerequisites of this step's next action (planBoard.ts readinessBlockersOf), each a Readiness tile the contract's own fixes do not already state. */
  blockers?: readonly PrerequisiteBlocker[]
  /** A prerequisite tile's label by the prerequisite's own lane (planBoard.ts prerequisiteLabelFor, decision 12); null keeps the tiles' own labels. */
  prerequisiteLabel?: PrerequisiteLabel | null
  /** Opens Plan settings → Baseline mappings, where a Readiness tile links there. */
  onOpenMappings?: () => void
  onCredentialStorage?: (done: boolean) => void
  /** The rollout exception, with the operator's reason (roadmap/sets.ts skip). */
  onSkip: (reason: string) => void
  onUnskip: () => void
  /** Doesn't apply here, with the person's one-line reason (content steps flagged doesntApply). */
  onDoesntApply?: (reason: string) => void
  onScan?: () => void
  /** This step's saved decision, when one was made (prompt 52 Part 3). */
  decision?: StepDecision | null
  /** The picker's Save: the ticked ids, the chosen option and the question's answer become the plan's decision. */
  onDecide?: (decision: StepDecisionInput) => void
  saveStatus?: 'idle' | 'saving' | 'saved' | 'failed'
  /** This step's owner confirmations of the checks IAMAI cannot read, by prerequisite id (roadmap/decisions.ts). */
  confirmations?: Readonly<Record<string, OwnerConfirmation>>
  /** Records confirmations, each with the values it was given against. */
  /** The checks confirmed, each with the basis it was given against; the record stamps the time. */
  onConfirm?: (confirmed: Record<string, import('../../roadmap/decisions.ts').ManualReviewInput>) => void
  /** Withdraws the confirmations of these prerequisites. */
  onUnconfirm?: (prerequisites: string[]) => void
  /**
   * The baseline commit implementation content is matched against: this build's
   * pin, always, on every product surface. Only the dev review harness
   * (src/testing/pilotPreview.tsx, never built) renders a package as a build
   * pinned to that package's own baseline would.
   */
  baselineCommit?: string
  /** Work the enforce checklist's conditions depend on that is not a prerequisite of this step's next action (stepBody.ts enforceWaits). */
  enforceWaits?: readonly string[]
  /** Printing: the evidence and More stand open on the page, so every step prints in full (§7). */
  printing?: boolean
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const closeDialog = (): void => setDialog(null)
  const [copied, setCopied] = useState<string | null>(null)
  // The opened step's body, decided once (stepBody.ts stepBodyOf): the content
  // step, the contract under the lane engine's reading, the instructions, the
  // channels, the package's projection and readiness, the Readiness tiles, which
  // sections this step draws and the words under Implementation when it draws
  // none. Everything below renders it; nothing below asks again.
  const body = stepBodyOf(step, ctx, { lane, blockers, prerequisiteLabel, confirmations, baselineCommit, enforceWaits })
  const { cs, ex, laneView, contract, title, d, taskDecision, reason, conflictWords, pkg, pkgBindings, pkgRuntime, pkgReadiness, scenarios, packaged, whoInline, whoHeld, lead, showWho, whoFull, hasEvidence, readiness, allTiles, decides, instructed, rail, eyebrow, artifacts, emergencyAccountTasks, previewNote, notes, showImplementation, empty, sourceLine, learnUrl, ifWrong } = body
  const isPasskeySettings = step.id === 's-prereq-passkey-settings'
  const isEmergencyAccounts = step.id === 's-prereq-break-glass'
  // Which steps draw the task anatomy (the Tasks Remaining cards and the
  // Implementation task frame): every step that carries work (owner, 2026-09-19),
  // which the step group registry answers once (roadmap/stepGroups.ts `anatomy`).
  // All of them are fed by the same projection (stepBody.ts emergencyAccountTasks)
  // and draw the same components.
  //
  // `isOwnTaskStep` is the same question minus the four Establish Emergency
  // Access steps — the drill is a Cleanup row, never drawn here — which are
  // frozen: their subjects, their bar and their Entra tab are their own
  // producers' and must not move (policyTasks.ts drawsTaskAnatomy).
  const isTaskStep = usesTaskAnatomy(step.id)
  const isOwnTaskStep = drawsTaskAnatomy(step.id)
  // The four task-step headings, for any member of a group that uses them (stepGroups.ts).
  const taskHead = taskHeadingsOf(step.id)
  // The three decision-step headings, for a member of a decision-anatomy group (Define Your Rollout Scope).
  const decisionHead = decisionHeadingsOf(step.id)
  const displayedScenarios: TroubleshootingScenario[] = isEmergencyAccounts ? [...scenarios, {
    id: 'emergency-temporary-access-pass', title: 'Temporary Access Pass',
    symptom: 'The emergency account cannot complete the sign-in needed to register its approved passkey.', likelyCauses: [],
    check: ['Confirm which one emergency account needs bootstrap access and keep another authorized administrator session open.'],
    fix: [
      'As an Authentication Policy Administrator, open Entra ID → Authentication methods → Policies → Temporary Access Pass. Enable and scope it to the intended account only when needed; preserve unrelated targeting.',
      'As a Privileged Authentication Administrator, open Entra ID → Users → the emergency account → Authentication methods → Add authentication method → Temporary Access Pass.',
      'Issue a short-lived, single-use pass within the tenant’s allowed settings. Enter it only in Microsoft’s registration sign-in for that account.',
      'Complete passkey registration and the private-window sign-in. Remove any still-valid temporary pass afterward.',
    ],
    doNot: ['Do not assume Temporary Access Pass bypasses Conditional Access or authentication-strength requirements. Do not weaken a blocking policy automatically.'],
    then: ['Return to Set up an approved passkey and finish the selected method procedure.'],
    sources: [{ id: 'microsoft-temporary-access-pass', title: 'Temporary Access Pass roles and use', url: 'https://learn.microsoft.com/entra/identity/authentication/howto-authentication-temporary-access-pass', checkedOn: '2026-09-12' }],
  }] : scenarios
  const hasPasskeyFindings = isPasskeySettings && !!step.configurationFindings?.length
  const baseReadiness = passkeyReadiness(step, readiness)
  const emergencyAccountUpns = new Map(ctx.mapping.breakGlassUserIds.flatMap(id => {
    const upn = ctx.snapshot.users.find(row => row.id.toLowerCase() === id.toLowerCase())?.userPrincipalName?.trim()
    return upn ? [[id, upn] as const] : []
  }))
  const displayedReadiness = isTaskStep ? consolidateEmergencyReadiness(baseReadiness, emergencyAccountTasks, emergencyAccountUpns, !printing) : baseReadiness
  // The Tasks Remaining cards of a task-anatomy step other than Step 1, which
  // draws its accounts: the step's own work as a card followed by its Readiness
  // tiles — each of them a thing it waits on — everywhere this module produces
  // the subjects, and the Readiness tiles alone on Emergency Access Steps 2–3.
  // The bar reads them, so they are decided once.
  const taskSubjects = isOwnTaskStep ? policySubjectsOf(contract, displayedReadiness, emergencyAccountTasks, taskSubjectOf(step, eyebrow, title), cardWordsOf(step)?.check ?? null) : emergencySubjectsOf(displayedReadiness, emergencyAccountTasks)
  // The one next action said once (owner, 2026-09-23): where it is the action
  // column's Next milestone, the Readiness bar does not say it again.
  const leadInRail = rail.headline === readinessLeadOf(contract)
  const emergencyTaskPreferenceKey = `iamai:emergency-task:${ctx.mapping.tenantId}:${step.id}`
  const [implementationChannel, setImplementationChannel] = useState<Channel | null>(null)
  const [emergencyTaskId, setEmergencyTaskId] = useState<string | null>(() => readEmergencyTaskPreference(emergencyTaskPreferenceKey).taskId ?? null)
  const chooseEmergencyTask = (id: string | null): void => {
    setEmergencyTaskId(id)
    writeEmergencyTaskPreference(emergencyTaskPreferenceKey, { taskId: id ?? undefined })
  }
  const copied1500 = (id: string) => (ok: boolean): void => {
    setCopied(ok ? id : 'copy-failed')
    setTimeout(() => setCopied(null), ok ? 1500 : 6000)
  }
  // The copy boxes under More (the email, the help-desk and manager text) are
  // text a person forwards, and leave the app redacted.
  const copy = (id: string, text: string): void => {
    void exportClipboard(text, REDACTED).then(copied1500(id))
  }
  // An implementation artifact is copied exactly as the viewer shows it: the
  // tenant's own object ids and Microsoft's own constants are what make a JSON
  // body, a script or a portal procedure deployable, and a redacted copy would be
  // a different, invalid artifact (exportGuard.ts `implementation-artifact`).
  const copyArtifact = (id: string, text: string): void => {
    void copyImplementationArtifact(text).then(copied1500(id))
  }
  // The one next action (stepContract.ts actionOf), under the Readiness bar where
  // the step has no instructions of its own. Where it led instructions it was
  // What to do's first line, and it left with What to do (U1).
  const actionLead = <WhatToDoLead contract={contract} />
  // The check a person is confirming, from the Readiness tile that states it.
  const confirmTile: ReadinessTile | null = confirmKey ? (allTiles.find((t) => t.key === confirmKey) ?? null) : null
  const closeConfirm = (): void => {
    setConfirmKey(null)
    setDialog(null)
  }
  const confirmedByPerson = confirmTile?.confirm ? (pkgRuntime?.prerequisites ?? []).filter((p) => confirmTile.confirm!.prerequisites.includes(p.id) && p.by === 'confirmation') : []
  const confirmedOn = confirmedByPerson.map((p) => p.confirmedAt ?? '').filter((d) => d !== '').sort().at(-1) ?? null
  // Each confirmation carries the values it was given against, so a later scan
  // that finds them changed no longer counts it. A check a tenant fact already
  // satisfies needs nobody's word and is not recorded.
  const confirmChecks = (tile: ReadinessTile): void => {
    if (!pkg || !pkgBindings || !tile.confirm || !onConfirm) return
    const byEvidence = new Set((pkgRuntime?.prerequisites ?? []).filter((p) => p.by === 'evidence').map((p) => p.id))
    const given = (pkg.meta.prerequisites ?? []).filter((pr) => tile.confirm!.prerequisites.includes(pr.id) && !byEvidence.has(pr.id))
    onConfirm(Object.fromEntries(given.map((pr) => [pr.id, { basis: prerequisiteBasis(pr, pkgBindings) }])))
  }
  // The footer's deferral (A1b decision 3): `Defer this step` is the existing
  // skip, offered only where the step's content entry marks it deferrable, and
  // `Doesn't apply here` where the step is flagged for it. A deferred step
  // offers the way back.
  const RO = CONTRACT.rollout
  const exceptions: ReactNode[] = printing
    ? []
    : step.status === 'skipped'
      ? [<Button key="put-back" variant="secondary" onClick={onUnskip}>{app.plan.putBack}</Button>]
      : [
          cs.skip ? <Button key="exclude" variant="secondary" className="rollout-exception" onClick={() => setDialog('rollout')}>{RO.control}</Button> : null,
          offersDoesntApply(cs, step) && onDoesntApply ? <Button key="doesnt-apply" variant="secondary" onClick={() => setDialog('doesnt-apply')}>{SHARED.doesntApplyControl}</Button> : null,
        ].filter((x) => x !== null)
  const partnerLink = step.id === 's-prereq-exclusion-group' ? null : partnerLinkOf(cs)

  return (
    // The opened step, as the approved Plan design draws it
    // (docs/design/approved/anatomy/plan-step-v1.html `.step`): one frame attached
    // under the roadmap row that opened it, with the head above and the main
    // column and its action column below.
    // `data-task-anatomy` is the one styling hook for a step drawn with the task
    // anatomy, and it carries the group whose anatomy that is, so app.css can
    // hold a rule back from the frozen Establish Emergency Access run without
    // listing its ids a second time.
    <article className="step panel panel-key" data-step-id={step.id} data-task-anatomy={isTaskStep ? groupOf(step.id)?.key : undefined}>
      {/* A task-anatomy step draws no lifecycle track: the Emergency Access
          steps have none, and every step drawn as they are is drawn without it
          (docs/plans/policy-anatomy-deviations.md item 2 — the four stages are
          the subject card's checks instead). */}
      <StepHead eyebrow={eyebrow} title={title} sub={<>
            {/* The one supporting line the step already carried under its
                title: what this change is, and the step it is done with. */}
            <Line s={cs.changeLine} ex={ex} cls="step-sub" />
            <Line s={cs.partner} ex={ex} cls="step-sub partner" />
            {partnerLink !== null && <p className="step-sub partner"><a className="inline-link" href={partnerLink.href}>{partnerLink.label}</a></p>}
          </>} badge={badgeLabel(contract)} tone={laneView.tone} fact={contract.state.fact} track={isTaskStep ? [] : contract.track}>
        {/* What happens next: the track caption, above the track it captions. */}
        <StepState contract={contract} />
        <PolicyMembers members={contract.members} />
      </StepHead>
      {/* Two columns (U2): Why and Readiness, then Implementation and Done when,
          on the left; the action column on the right. The left column is two
          elements because the action column sits between them in the DOM (U5). */}
      <div className="step-body has-rail">
        <div className="step-main step-main-lead">
          {/* The contract's Why: the step's own sentence where the content file
              has one, and the engine's where it does not, ending in the step's
              Microsoft Learn link (RUN-CONTEXT-B decision 14). */}
          <section className="step-section">
            <h4>{taskHead?.why ?? decisionHead?.why ?? HEAD.why}</h4>
            <p>
              {contract.why}{' '}
              {learnUrl && (
                <a href={learnUrl} target="_blank" rel="noopener noreferrer">
                  Learn →
                </a>
              )}
            </p>
          </section>

          {/* Readiness: the one prerequisite surface. Every unresolved
              prerequisite of the next action is a tile — the emergency account
              slots, each with its own minimum blockers or hardening and the
              deferral under the first slot with hardening open, the state's own,
              the emergency boundary, each fix, each engine blocker — over the
              bar that says where the step stands with its one action under it,
              and — where this step's enforcement waits on the people it reaches —
              who they are, handed to MFA Readiness (derive/stepMfaReadiness.ts). */}
          {decisionHead ? <DirectionQuestions key={directionDraftKey(step)} step={step} ctx={ctx} heading={decisionHead.questions} onDecide={onDecide} printing={printing} saving={saveStatus === 'saving'} />
          : isEmergencyAccounts && emergencyAccountTasks ? <EmergencySubjectReadiness subjects={emergencyAccountTasks.accounts ?? []} printing={printing} barMain={(emergencyAccountTasks.accounts ?? []).some(account => !account.satisfied) ? '' : 'Account preparation is verified.'} onWhy={hasEvidence && !printing ? () => setDialog('readiness') : null} />
          : isTaskStep && emergencyAccountTasks && !printing ? <EmergencySubjectReadiness
            subjects={taskSubjects}
            printing={printing}
            barMain={isOwnTaskStep ? policyBarOf(taskSubjects) : displayedReadiness.bar.main}
            onWhy={hasEvidence ? () => setDialog('readiness') : null}
          /> : <ReadinessSection
            readiness={displayedReadiness}
            heading={taskHead?.remaining}
            scanNote={isTaskStep}
            showClosedCount={!isTaskStep}
            lead={instructed || hasPasskeyFindings || leadInRail ? null : actionLead}
            onWhy={hasEvidence && !printing ? () => setDialog('readiness') : null}
            onConfirm={!printing && onConfirm ? (key) => { setConfirmKey(key); setDialog('confirm') } : null}
            onOpenMappings={null}
            printing={printing}
            extra={(t) => {
              // Printed Steps 2–3 draw the source findings; Step 3 protections also list the approved models.
              const taskBody = isPasskeySettings && t.key === 'configuration:protection' && emergencyAccountTasks ? <div className="emergency-readiness-extra"><ApprovedAuthenticatorModels models={emergencyAccountTasks.approvedModels ?? []} /></div> : null
              const slot = t.key === 'configuration:credential-custody' && contract.hardening
                ? { key: t.key, label: t.label, accountId: null, state: 'hardening' as const, minimum: [], hardening: [] }
                : contract.emergencySlots.find((s) => s.key === t.key)
              if (!slot || (slot.state !== 'minimum' && slot.state !== 'hardening')) return taskBody
              const deferralSlot = t.key === 'configuration:credential-custody' || contract.emergencySlots.find((s) => s.state === 'hardening')?.key === slot.key
              return (
                <>
                  <EmergencySlotBody
                    slot={slot}
                    hardening={deferralSlot && contract.hardening ? { ...contract.hardening, ...(t.key === 'configuration:credential-custody' ? { unchecked: 0 } : {}) } : null}
                    onDefer={!printing && onConfirm && contract.hardening ? () => onConfirm({ [HARDENING_DEFERRAL_ID]: { basis: contract.hardening!.basis } }) : null}
                    onUndo={!printing && onUnconfirm ? () => onUnconfirm([HARDENING_DEFERRAL_ID]) : null}
                  />
                  {taskBody}
                </>
              )
            }}
          >
            {step.id === 's-verify-mfa' ? <p><a href="#/readiness/step/s-verify-mfa">Open MFA Readiness</a></p> : <MfaHandoff step={step} snapshot={ctx.snapshot} mapping={ctx.mapping} />}
          </ReadinessSection>}

          {/* The baseline defines this policy two ways (roadmap/baselineConflict.ts):
              the approved design's danger attention, under Readiness. The words
              belong to the reviewed source policy the step's own state names, and
              they are the content file's; nothing here composes them. */}
          {conflictWords && (
            <section className="step-section">
              <Callout kind="danger">
                <h4>{CONTRACT.attentionConflict}</h4>
                {conflictWords.split('\n\n').map((paragraph, i) => (
                  <p key={i}>
                    <T s={paragraph} ex={ex} />
                  </p>
                ))}
              </Callout>
            </section>
          )}

        </div>

        {/* The action column (U2): the milestone, and under it the controls this
            step takes in IAMAI. On a step that needs a decision the decision is
            the action: IAMAI cannot choose, so nothing is offered to submit until
            a person has (Foundation C). */}
        <StepActionColumn rail={rail}>
          {/* A question that moved to Define Your Rollout Scope is answered there; this step says where, and what (roadmap/direction.ts ANSWERED_IN). */}
          {/* The picker is the step's own, or — on a step that makes an object itself and asks nothing of its own — the object's, saved under the object's id (stepBody.ts taskDecision; Stage 3: the countries location's Work Countries, on the countries step). */}
          {ANSWERED_IN[step.id] ? <AnsweredInDirection stepId={step.id} ctx={ctx} /> : step.dormantChoices ? <DormantDecision step={step} onDecide={onDecide} printing={printing} /> : decides && <Decision key={step.id} d={taskDecision?.d ?? d} ex={taskDecision?.ex ?? ex} saved={taskDecision ? objectTask?.saved ?? null : decision} onDecide={taskDecision ? objectTask?.onDecide : onDecide} stepId={taskDecision?.stepId ?? step.id} ctx={ctx} printing={printing} railInstruction={!taskDecision && rail.instruction !== null} />}
          {step.id === SPECIAL_CARE_STEP_ID && (followUp || printing) && <FollowUpDecision key={`${step.id}:follow-up`} step={step} ctx={ctx} saved={followUp?.saved ?? null} onDecide={followUp?.onDecide} printing={printing} />}
          {/* The one thing a scan cannot see, recorded where every other control
              on a step is (owner, 2026-09-20). It used to stand in the main
              column below Completion Criteria — a sixth section, outside the four
              the anatomy has, on twelve steps. */}
          {step.manualReview && !printing && <ManualReviewForm key={`${step.id}:${step.manualReview.basis}:${step.manualReview.record?.at ?? ''}`} review={step.manualReview} ctx={ctx} printing={false} onConfirm={onConfirm} onUnconfirm={onUnconfirm} />}
          {/* Configure Passkey Settings' settings: the approved models and the
              models an owner adds, in the column with every other control
              (owner, 2026-09-23). They stood under the step, right of the scan. */}
          {isPasskeySettings && !printing && (
            <div className="rail-settings">
              <ApprovedAuthenticatorModels models={emergencyAccountTasks?.approvedModels ?? []} />
              <details className="passkey-model-disclosure">
                <summary>Add additional AAGUIDs</summary>
                <PasskeyModelDecision mapping={ctx.mapping} saved={decision ?? null} onDecide={onDecide} />
              </details>
            </div>
          )}
        </StepActionColumn>

        <div className="step-main step-main-rest">
          {showImplementation && (
            <Implementation
              artifacts={artifacts}
              drawnBy={packaged ? 'package' : 'translator'}
              preview={previewNote}
              notes={notes}
              title={title}
              empty={empty}
              source={sourceLine}
              learn={learnUrl}
              onTroubleshooting={displayedScenarios.length > 0 && !printing ? () => setDialog('troubleshooting') : null}
              open={dialog === 'implementation'}
              onOpen={() => setDialog('implementation')}
              onClose={closeDialog}
              copy={copyArtifact}
              copied={copied}
              printing={printing}
              tasks={emergencyAccountTasks}
              chosenChannel={isTaskStep ? implementationChannel : null}
              onChooseChannel={isTaskStep ? setImplementationChannel : null}
              chosenTaskId={isTaskStep ? emergencyTaskId : null}
              onChooseTask={isTaskStep ? chooseEmergencyTask : null}
              taskPreferenceKey={isTaskStep ? emergencyTaskPreferenceKey : null}
              taskSettings={isOwnTaskStep}
              heading={taskHead?.implementation}
            />
          )}

          {step.baselineReviewSource?.json && <details className="step-section baseline-definition" open={printing || undefined}>
            <summary>{workflowWords.definitionTitle}</summary>
            <p>{workflowWords.definitionNote}</p>
            <pre className="mono">{step.baselineReviewSource.json}</pre>
          </details>}

          {/* Every step has a completion, and it is concrete (stepContract.ts doneWhenOf). */}
          <DoneWhen heading={taskHead?.doneWhen ?? decisionHead?.doneWhen ?? HEAD.doneWhen} lines={contract.doneWhen} />
          {/* Configure Passkey Settings' methodology, folded under the four
              sections every Emergency Access step draws, as Verify Emergency
              Access folds its recovery procedure (owner, 2026-09-23: the four
              steps draw the same sections in the same order). */}
          {isPasskeySettings && (
            <details className="step-section passkey-methodology" open={printing || undefined}>
              <summary><strong>Methodology</strong></summary>
              <ul>{PASSKEY_METHODOLOGY.map(line => <li key={line}>{line}</li>)}</ul>
            </details>
          )}
          {/* Printing keeps it in the main column: a printed plan is one column,
              and the recorded result belongs with the step it is about. */}
          {step.manualReview && printing && <ManualReviewForm key={`${step.id}:${step.manualReview.basis}:${step.manualReview.record?.at ?? ''}`} review={step.manualReview} ctx={ctx} printing onConfirm={onConfirm} onUnconfirm={onUnconfirm} />}

          {/* The printed plan is the whole step: the evidence and More stand on
              the page there, in the order they always printed. */}
          {printing && (
            <>
              {/* A finding the Readiness tiles already state, word for word, is
                  not printed twice: the tile is the reading, and the page keeps
                  every finding it does not already carry. */}
              <WhatIamaiFound found={contract.found.filter((f) => !allTiles.some((t) => t.note === f.text || t.value === f.text))} />
              {showWho && (
                <section className="step-section">
                  <h4>{HEAD.who}</h4>
                  {lead && <p className="line">{lead}</p>}
                  {whoInline.map((b) => <WhoBlockView key={b.key} block={b} />)}
                  {contract.who !== null && !contract.who.known && <p className="reason">{contract.who.text}</p>}
                </section>
              )}
              {reason === null && !contract.undated && datesLineFor(step, cs) && whole(datesLineFor(step, cs), ex) && (
                <section className="step-section">
                  <h4>{HEAD.dates}</h4>
                  <p className="line"><T s={datesLineFor(step, cs)} ex={ex} /></p>
                </section>
              )}
              <section className="step-section">
                <More
                  cs={cs}
                  ex={ex}
                  step={step}
                  contractWho={whoHeld}
                  ifWrong={ifWrong}
                  comms={reason === null ? commsFor(cs, ex as Record<string, unknown>, step) : null}
                  onSkip={onSkip}
                  onUnskip={onUnskip}
                  onDoesntApply={onDoesntApply}
                  copy={copy}
                  copied={copied}
                  open
                />
              </section>
            </>
          )}
        </div>
      </div>
      {!printing && (saveStatus === 'saving' || saveStatus === 'failed') && <p className="reason step-save-feedback" role="status">{saveStatus === 'saving' ? 'Saving plan…' : 'Plan could not be saved. Use Retry Saving above.'}</p>}
      <StepFooter controls={exceptions.length > 0 ? exceptions : null} onScan={printing ? null : (onScan ?? null)} />
      {!printing && (
        <>
          <StepDialog open={dialog === 'readiness'} onClose={closeDialog} eyebrow={CONTRACT.readiness.dialogEyebrow} title={CONTRACT.readiness.dialogTitle} closeLabel={CONTRACT.readiness.close}>
            <div className="dialog-prose">
              {contract.found.length > 0 && (
                <>
                  <h4>{CONTRACT.foundHeading}</h4>
                  {contract.found.map((f) => <p key={f.key}>{f.text}</p>)}
                </>
              )}
              {showWho && (
                <>
                  <h4>{HEAD.who}</h4>
                  {lead && <p className="line">{lead}</p>}
                  {whoFull.map((b) => <WhoBlockView key={b.key} block={b} />)}
                  {contract.who !== null && !contract.who.known && <p className="reason">{contract.who.text}</p>}
                </>
              )}
              {/* The package's own evidence for this state (project.ts
                  packageReadiness): its conclusion for the next transition, why
                  the gate matters, what IAMAI cannot prove, and the Microsoft
                  references behind it. Each is the package's sentence. */}
              {pkgReadiness?.conclusion && (
                <>
                  <h4>{CONTRACT.readiness.package.conclusion}</h4>
                  <p>{pkgReadiness.conclusion}</p>
                </>
              )}
              {pkgReadiness?.whyItMatters && (
                <>
                  <h4>{CONTRACT.readiness.package.whyItMatters}</h4>
                  <p>{pkgReadiness.whyItMatters}</p>
                </>
              )}
              {pkgReadiness && pkgReadiness.unknowns.length > 0 && (
                <>
                  <h4>{CONTRACT.readiness.package.unknown}</h4>
                  {pkgReadiness.unknowns.map((u, i) => <p key={i}>{u}</p>)}
                </>
              )}
              {pkgReadiness && pkgReadiness.references.length > 0 && (
                <>
                  <h4>{CONTRACT.readiness.package.references}</h4>
                  <ul className="source-links">
                    {pkgReadiness.references.map((s) => (
                      <li key={s.id}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.title} ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {/* What the step says about consequence rather than about the next
                  action — what could go wrong, the way back, the recovery
                  runbook, the three boxes of text to send, and the dates — is
                  here (owner, 2026-09-20). It used to be reachable only by
                  printing the plan, which is not where a person reads it. The
                  printed page draws the same component below, unchanged. */}
              {reason === null && !contract.undated && datesLineFor(step, cs) && whole(datesLineFor(step, cs), ex) && (
                <>
                  <h4>{HEAD.dates}</h4>
                  <p className="line"><T s={datesLineFor(step, cs)} ex={ex} /></p>
                </>
              )}
              <MoreReading
                cs={cs}
                ex={ex}
                ifWrong={ifWrong}
                comms={reason === null ? commsFor(cs, ex as Record<string, unknown>, step) : null}
                copy={copy}
                copied={copied}
              />
            </div>
          </StepDialog>
          <StepDialog open={dialog === 'troubleshooting'} onClose={closeDialog} eyebrow={CONTRACT.troubleshooting.eyebrow} title={title} closeLabel={CONTRACT.troubleshooting.close}>
            <Troubleshooting scenarios={displayedScenarios} />
          </StepDialog>
          {/* A person's confirmation of a check IAMAI cannot read from Microsoft
              (roadmap/decisions.ts OwnerConfirmation): the tile's own authored
              line, what confirming means, and when it was confirmed. */}
          <StepDialog open={dialog === 'confirm' && confirmTile?.confirm !== undefined} onClose={closeConfirm} eyebrow={CONTRACT.confirm.eyebrow} title={confirmTile?.label ?? ''} closeLabel={CONTRACT.confirm.cancel}>
            {confirmTile?.confirm && (
              <div className="dialog-prose">
                {confirmTile.note && <p>{confirmTile.note}</p>}
                <p>{CONTRACT.confirm.body}</p>
                {confirmedOn && <p className="reason">{fillText(CONTRACT.confirm.confirmedOn, { date: absoluteDate(confirmedOn) })}</p>}
                <div className="dialog-actions-row">
                  <Button variant="secondary" onClick={closeConfirm}>
                    {CONTRACT.confirm.cancel}
                  </Button>
                  {confirmedByPerson.length > 0 ? (
                    <Button variant="secondary" onClick={() => { onUnconfirm?.(confirmedByPerson.map((p) => p.id)); closeConfirm() }}>
                      {CONTRACT.confirm.remove}
                    </Button>
                  ) : !confirmTile.confirm.satisfied ? (
                    <Button variant="primary" onClick={() => { confirmChecks(confirmTile); closeConfirm() }}>
                      {CONTRACT.confirm.confirm}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </StepDialog>
          <StepDialog open={dialog === 'rollout'} onClose={closeDialog} eyebrow={RO.eyebrow} title={RO.title} closeLabel={RO.cancel}>
            <ReasonForm body={RO.body} label={RO.reason} placeholder={RO.placeholder} cancel={RO.cancel} confirm={RO.control} multiline onCancel={closeDialog} onConfirm={(r) => { closeDialog(); onSkip(r) }} />
          </StepDialog>
          <StepDialog open={dialog === 'doesnt-apply'} onClose={closeDialog} eyebrow={RO.eyebrow} title={SHARED.doesntApplyControl} closeLabel={RO.cancel}>
            <ReasonForm body={fillText(SHARED.doesntApplyPrompt, { tenant: String(ex.tenant ?? '') })} label={RO.reason} placeholder="" cancel={RO.cancel} confirm="Save" onCancel={closeDialog} onConfirm={(r) => { closeDialog(); onDoesntApply?.(r) }} />
          </StepDialog>
        </>
      )}
    </article>
  )
}

/**
 * The Implementation region (docs/design/approved/anatomy/plan-step-v1.html
 * `.implementation-section`): the channels this step has, as pill tabs over a
 * fixed preview with Copy and Expand on its corner, and the whole artifact in the
 * implementation dialog. Every channel is a tab (content review D2); one with no
 * content says so and offers nothing to copy, and where none has content the
 * truthful reason (stepContract.ts implementationEmptyOf) stands over the tabs.
 *
 * The artifacts are their own modules' — the package's bound blocks
 * (project.ts), or the portal translator's lines, stepPowerShell.ts, stepJson.ts
 * and the prompts' step context — and nothing is composed here. The preview,
 * the expanded viewer and Copy read the same text.
 */
/**
 * Copy from the Implementation viewer, exactly as it shows the artifact: the one
 * place the unredacted `implementation-artifact` surface is claimed, for every
 * step body that draws the viewer (a Plan step and the Cleanup verification row).
 */
export function copyImplementationArtifact(text: string): Promise<boolean> {
  return exportClipboard(text, unredactedFrom('implementation-artifact'))
}

export function Implementation({ artifacts, drawnBy, preview, notes, title, empty, source, learn, onTroubleshooting, open, onOpen, onClose, copy, copied, printing, tasks, chosenChannel, onChooseChannel, chosenTaskId, onChooseTask, taskPreferenceKey, taskSettings = false, emptyTaskText, heading }: {
  artifacts: Artifact[]
  /** Who draws the region: the step's implementation-content package, or the translator's own channels (stepPackage.ts packageDrawsImplementation). */
  drawnBy: 'package' | 'translator'
  /** Unresolved values remain visible without preventing copying the guidance. */
  preview: { lines: string[] } | null
  /** Why the package's own guidance is set aside (a re-pin review), where it is. */
  notes: string[]
  title: string
  empty: ImplementationEmpty
  /** "Source checked <date>", from the package's verified sources or the step's own dated Learn entry; null where there is no truthful date. */
  source: string | null
  /** The step's Microsoft Learn page, where its content entry names one. */
  learn: string | null
  onTroubleshooting: (() => void) | null
  open: boolean
  onOpen: () => void
  onClose: () => void
  copy: (id: string, text: string) => void
  copied: string | null
  printing: boolean
  tasks: EmergencyTaskProjection | null
  chosenChannel: Channel | null
  onChooseChannel: ((channel: Channel | null) => void) | null
  chosenTaskId: string | null
  onChooseTask: ((taskId: string | null) => void) | null
  taskPreferenceKey?: string | null
  /** The one policy the owner is judging the resolved settings on (policyTasks.ts): its task's facts stand under the procedure, folded. */
  taskSettings?: boolean
  emptyTaskText?: string
  heading?: string
}) {
  const [localChannel, setLocalChannel] = useState<Channel | null>(null)
  const [variants, setVariants] = useState<Record<string, string>>(() => taskPreferenceKey ? readEmergencyTaskPreference(taskPreferenceKey).variants ?? {} : {})
  const base = useId()
  const dialogBase = useId()
  const W = CONTRACT.implementation
  const ids = artifacts.map((a) => a.id)
  const chosen = onChooseChannel ? chosenChannel : localChannel
  const chooseChannel = (channel: Channel): void => onChooseChannel ? onChooseChannel(channel) : setLocalChannel(channel)
  // The chosen tab is clamped to what is available, so a step that offers only
  // some channels cannot be left showing another's panel — the frame is reused
  // across rows and the state is not.
  // Untouched, the first channel with content leads (D2: every channel is a tab).
  const tab: Channel = chosen !== null && ids.includes(chosen) ? chosen : (artifacts.find((a) => a.unavailable !== true)?.id ?? ids[0] ?? 'portal')
  const active = artifacts.find((a) => a.id === tab) ?? null
  const tabs = channelTabsOf(artifacts)
  const taskList = tasks?.tasks ?? []
  const activeTask = taskList.find(item => item.id === chosenTaskId) ?? taskList.find(item => item.id === tasks?.recommendedTaskId) ?? taskList.find(item => item.required) ?? taskList[0] ?? null
  const activeVariant = activeTask?.variants?.find(item => item.id === variants[activeTask.id])?.id ?? activeTask?.defaultVariantId ?? activeTask?.variants?.[0]?.id ?? null
  const renderTask = (item: EmergencyAccountTask, cls: string) => {
    const variant = item.variants?.find(row => row.id === variants[item.id])?.id ?? item.defaultVariantId ?? item.variants?.[0]?.id ?? null
    const taskFacts = emergencyTaskFacts(item, variant)
    // The Task selector already names the task on screen; printing lists every task, so it keeps the title.
    return <section key={item.id} className={`${cls} emergency-task-body`} data-emergency-account-tasks="true">
      <h5 className={printing ? undefined : 'sr-only'}>{item.title}</h5>
      {(item.targetUpn || item.targetLabel) && <p className="emergency-task-target">{item.targetUpn ?? item.targetLabel}</p>}
      {printing && !!taskFacts.length && <dl className="emergency-task-facts">{taskFacts.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd><AuthoredText text={row.value} /></dd></div>)}</dl>}
      <ol>{emergencyTaskSteps(item, variant).map((line, index) => <li key={index}><AuthoredText text={line} /></li>)}</ol>
      {/* The resolved settings this procedure was written against, on the one
          policy the owner is judging them on (owner, 2026-09-19). They are the
          task's own facts — printed and copied already — under the heading the
          artifact gave them, in the disclosure this file already draws a
          resolved list in (Approved authenticator models). */}
      {!printing && taskSettings && !!taskFacts.length && <details className="approved-model-disclosure">
        <summary>{SHARED.policySettingsForAction}</summary>
        <dl className="emergency-task-facts">{taskFacts.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd><AuthoredText text={row.value} /></dd></div>)}</dl>
      </details>}
    </section>
  }
  const printableTasks = tasks?.printAll ? taskList : taskList.filter(item => item.required)
  const body = (cls: string, dialog = false) =>
    tasks && tab === 'portal' ? printing
      ? printableTasks.length
        ? <div className="emergency-task-print" data-emergency-account-tasks="true">{printableTasks.map(item => renderTask(item, cls))}</div>
        : <div className={`${cls} emergency-task-empty`} data-emergency-account-tasks="true">{emptyTaskText ?? 'No Entra action is currently identified. Review Readiness.'}</div>
      : activeTask
        ? renderTask(activeTask, cls)
        : <div className={`${cls} emergency-task-empty`} data-emergency-account-tasks="true">{emptyTaskText ?? 'No Entra action is currently identified. Review Readiness.'}</div>
    : active === null ? null : active.form === 'list' ? (
      <ol className={cls}>
        {active.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    ) : active.form === 'markdown' ? (
      <div className={`${cls} authored`}>
        <AuthoredText text={active.text()} />
      </div>
    ) : (
      <pre className={`${cls} mono`}>{active.text()}</pre>
    )
  const support = (active?.note ?? null) !== null || source !== null || onTroubleshooting !== null || learn !== null
  const copyable = active !== null && active.unavailable !== true
  // Copying guidance is available even when the planned operation needs review.
  const copyReason = copyable ? W.copy : active?.unavailable ? active.text() : (preview?.lines.join(' ') ?? W.copy)
  const selectedTaskText = activeTask ? emergencyTaskText(activeTask, activeVariant) : active?.text() ?? ''
  const copyControl = tasks && tab === 'portal' ? (
    <button type="button" className="icon-btn" aria-label="Copy task" title="Copy task" aria-disabled={!activeTask} onClick={() => activeTask && copy('emergency-task', selectedTaskText)}><Icon name={copied === 'emergency-task' ? 'check' : 'copy'} size={14} /></button>
  ) : (
    <button
      type="button"
      className="icon-btn"
      aria-label={W.copy}
      title={copyReason}
      aria-description={copyable ? undefined : copyReason}
      aria-disabled={!copyable}
      onClick={() => {
        if (copyable) copy('implementation', active?.text() ?? '')
      }}
    >
      <Icon name={copied === 'implementation' ? 'check' : 'copy'} size={14} />
    </button>
  )
  const taskControls = tasks && tab === 'portal' && activeTask && !printing ? <>
    <label className="emergency-task-select"><span>Task</span><select value={activeTask.id} onChange={event => onChooseTask?.(event.currentTarget.value)}>{taskList.map(item => <option key={item.id} value={item.id}>{item.title}{item.targetUpn ? ` — ${item.targetUpn}` : ''}</option>)}</select></label>
    {activeTask.variants?.length && <label className="emergency-task-select"><span>Method</span><select value={activeVariant ?? ''} onChange={event => {
      const taskId = activeTask.id
      const variantId = event.currentTarget.value
      setVariants(value => {
        const next = { ...value, [taskId]: variantId }
        if (taskPreferenceKey) writeEmergencyTaskPreference(taskPreferenceKey, { variants: next })
        return next
      })
    }}>{activeTask.variants.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
  </> : null
  // The channels, the preview and the expanded viewer. Named so the one
  // decision below — whether a finished step opens them closed — is made in
  // one place and changes nothing inside them.
  const channels = (
        <>
          {tasks ? <div className="emergency-channel-toolbar no-print"><TabList base={base} tabs={tabs} active={tab} onSelect={(id) => chooseChannel(id as Channel)} panelId={() => `${base}-panel`} className="tabs impl-tabs" />{tab !== 'portal' && <div className="emergency-channel-actions">{copyControl}<button type="button" className="icon-btn" aria-label={W.expand} title={W.expand} onClick={onOpen}><Icon name="external-link" size={14} /></button></div>}</div> : <TabList base={base} tabs={tabs} active={tab} onSelect={(id) => chooseChannel(id as Channel)} panelId={() => `${base}-panel`} className="tabs impl-tabs no-print" />}
          <div className="impl-preview" data-emergency-account-tasks={tasks && tab === 'portal' ? 'true' : undefined} {...onePanelProps(base, tab)}>
            {(!tasks || tab === 'portal') && <div className={`${tasks ? 'emergency-task-toolbar' : 'preview-actions'} no-print`}>{taskControls}{copyControl}<button type="button" className="icon-btn" aria-label={W.expand} title={W.expand} onClick={onOpen}><Icon name="external-link" size={14} /></button></div>}
            {copied === 'copy-failed' && <p role="status">{W.copyFailed}</p>}
            {body('preview-text')}
          </div>
          {/* The expanded viewer (S6): the same channel the preview shows, the
              whole artifact at reading size, with the channel tabs and the
              icon-only Copy in the sticky head beside Minimize (U16, U17). */}
          <StepDialog
            open={open}
            onClose={onClose}
            eyebrow={W.dialogEyebrow}
            title={title}
            sub={tabs.find((t) => t.id === tab)?.label ?? null}
            closeLabel={W.close}
            wide
            toolbar={
              <>
                <TabList base={dialogBase} tabs={tabs} active={tab} onSelect={(id) => chooseChannel(id as Channel)} panelId={() => `${dialogBase}-panel`} className="tabs impl-tabs" />
                {taskControls}
                {copyControl}
              </>
            }
          >
            {copied === 'copy-failed' && <p role="status">{W.copyFailed}</p>}
            {active?.note && <p className="impl-dialog-note">{active.note}</p>}
            <div data-emergency-account-tasks={tasks && tab === 'portal' ? 'true' : undefined} {...onePanelProps(dialogBase, tab)}>{body('dialog-code', true)}</div>
          </StepDialog>
        </>
  )

  return (
    <section className="step-section implementation-section" data-implementation={drawnBy} data-preview={preview ? 'true' : undefined}>
      <h4>{heading ?? W.heading}</h4>
      {/* Every channel is a tab (content review D2). Where none has content, the
          truthful reason stands over them as a note, never as a box beside a strip. */}
      {artifacts.every((a) => a.unavailable === true) && (
        <div className="impl-empty-note" data-empty={empty.key}>
          <strong>{empty.title}</strong>
          <span>{empty.text}</span>
        </div>
      )}
        {/* Every procedure stands open, on a finished step as on an open one, with
            no fold and no qualifier (owner, 2026-09-23). */}
        {channels}
      {/* The support line (S6): Microsoft Learn · Troubleshooting on the left,
          the package's run note beside them, and the source-checked date on the
          right — or nothing at all where the step has none of them. */}
      {support && (
        <div className="impl-support">
          {(learn || onTroubleshooting) && (
            <span className="impl-support-links">
              {learn && (
                <a className="inline-link" href={learn} target="_blank" rel="noopener noreferrer">
                  {W.learn}
                </a>
              )}
              {/* A text separator, not a box of its own: a flex item reads as a line of
                  its own ("·" alone) to anything that reads the step's text. */}
              {learn && onTroubleshooting && ' · '}
              {onTroubleshooting && (
                <button type="button" className="inline-link" onClick={onTroubleshooting}>
                  {W.troubleshooting}
                </button>
              )}
            </span>
          )}
          {artifacts.length > 0 && active?.note && <span className="impl-support-note">{active.note}</span>}
          {source && <span className="impl-support-source">{source}</span>}
        </div>
      )}
    </section>
  )
}

/**
 * The package's troubleshooting scenarios for the step's state, under the
 * guide's six labels (§30.3). Every sentence is the package author's; a label
 * with nothing under it is left out.
 */
function Troubleshooting({ scenarios }: { scenarios: TroubleshootingScenario[] }) {
  const L = CONTRACT.troubleshooting
  const part = (label: string, items: string[]) =>
    items.length === 0 ? null : (
      <>
        <h5 className="key-label">{label}</h5>
        {items.length === 1 ? <p>{items[0]}</p> : <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      </>
    )
  return (
    <div className="dialog-prose troubleshooting">
      {scenarios.map((s) => (
        <section key={s.id} className="troubleshooting-scenario">
          <h4>{s.title}</h4>
          {part(L.seeing, s.symptom ? [s.symptom] : [])}
          {part(L.cause, s.likelyCauses)}
          {part(L.check, s.check)}
          {part(L.fix, s.fix)}
          {part(L.doNot, s.doNot)}
          {part(L.then, s.then)}
          {s.sources.length > 0 && (
            <>
              <h5 className="key-label">{L.sources}</h5>
              <ul className="source-links">
                {s.sources.map((src) => (
                  <li key={src.id}>
                    <a href={src.url} target="_blank" rel="noopener noreferrer">
                      {src.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
    </div>
  )
}

/**
 * The reason a rollout exception is recorded with. It is mounted only while its
 * dialog is open, so every opening starts empty, and it confirms nothing until
 * there is a reason to record.
 */
function ReasonForm({ body, label, placeholder, cancel, confirm, multiline = false, onCancel, onConfirm }: {
  body: string
  label: string
  placeholder: string
  cancel: string
  confirm: string
  multiline?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const id = useId()
  const given = reason.trim()
  return (
    <div className="dialog-prose">
      <p>{body}</p>
      <label className="key-label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} className="rollout-field" value={reason} placeholder={placeholder} onChange={(e) => setReason(e.currentTarget.value)} />
      ) : (
        <input id={id} type="text" required className="rollout-field rollout-field-line" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
      )}
      <div className="dialog-actions-row">
        <Button variant="secondary" onClick={onCancel}>
          {cancel}
        </Button>
        <Button variant="primary" disabled={given.length === 0} onClick={() => { if (given.length > 0) onConfirm(given) }}>
          {confirm}
        </Button>
      </div>
    </div>
  )
}

function Decision(props: { d: Record<string, any>; ex: Ex; saved: StepDecision | null; onDecide?: (decision: StepDecisionInput) => void; stepId: string; ctx: StepVarContext; printing?: boolean; railInstruction?: boolean }) {
  return <div className="decision-form"><SingleDecision {...props} /></div>
}

/**
 * `railInstruction`: the action column already carries this decision's
 * instruction line under its milestone (stepBody.ts rail.instruction), so the
 * decision does not open with its help a second time.
 */
function SingleDecision({ d, ex, saved, onDecide, stepId, ctx, printing = false, railInstruction = false }: { d: Record<string, any>; ex: Ex; saved: StepDecision | null; onDecide?: (decision: StepDecisionInput) => void; stepId: string; ctx: StepVarContext; printing?: boolean; railInstruction?: boolean }) {
  // The typeahead (target-state §6.4): empty, it lists the objects the scan
  // nominated with their signal text, ticked by default as chips; typing filters
  // every object of the kind in the tenant by name and UPN; the chips are the
  // selection, and Save writes their ids exactly as the ticks did. A picker with
  // no source reads the key its own rows were built under (pickerKey), never
  // another step's list. Nothing nominated and nothing to type against: no picker.
  const source: string | null = typeof d.pickerSource === 'string' ? d.pickerSource : null
  const keys: string[] = source ? [source] : typeof ex.pickerKey === 'string' ? [ex.pickerKey] : []
  const key = d.pickerRow ? (keys.find((k) => Array.isArray(ex[k]) && (ex[k] as unknown[]).length > 0) ?? null) : null
  const rows: string[] = key ? (ex[key] as string[]) : []
  const idsOf = key ? ex[`${key}Ids`] : undefined
  const ids: string[] = Array.isArray(idsOf) && (idsOf as string[]).length === rows.length ? (idsOf as string[]) : rows
  // A group, a location or a strength is one choice: one chip.
  const single = !d.multi && SINGLE_CHOICE_SOURCES.includes(String(source ?? key ?? ''))
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }
  const universe = useMemo(() => (d.pickerRow ? pickerUniverse(stepId, source, pickerCtx) : []), [d.pickerRow, stepId, source, ctx.snapshot, ctx.mapping, ctx.nameOf, ctx.groups])
  const byId = useMemo(() => new Map(universe.map((o) => [o.id, o])), [universe])
  const nominated: PickerOption[] = ids.map((id, i) => {
    const known = byId.get(id)
    const name = known?.name ?? rows[i].split(' · ')[0]
    const why = rows[i].startsWith(name) ? rows[i].slice(name.length).replace(/^\s*·\s*/, '') : rows[i]
    return { id, name, secondary: known?.secondary, why: why || undefined }
  })
  const isExclusionsGroup = stepId === 's-prereq-exclusion-group'
  const savedExclusionsGroup = isExclusionsGroup ? operatorExclusionsDecision(ctx.mapping) : null
  const optionOf = (id: string): PickerOption => isExclusionsGroup && savedExclusionsGroup?.id.toLowerCase() === id.toLowerCase()
    ? { id, name: exclusionsPickerLabel(ctx.mapping, ctx.groups, id) }
    : nominated.find((n) => n.id === id) ?? byId.get(id) ?? { id, name: ctx.nameOf(id) }
  // A match the scan made unambiguously opens as a chip saying so (U24); it is the
  // plan's decision only once Save writes it, so the step still reads Decision.
  const initial = initialPicked(ex, key, saved, ids, single)
  const initialIds = isExclusionsGroup ? (savedExclusionsGroup ? [savedExclusionsGroup.id] : []) : initial.picked
  const [chips, setChips] = useState<PickerOption[]>(() => initialIds.map((id) => isExclusionsGroup ? optionOf(id) : (initial.matched.includes(id) ? { ...optionOf(id), badge: app.picker.matched } : optionOf(id))))
  const isNetwork = stepId === 's-prereq-trusted-location'
  const [remote, setRemote] = useState(isNetwork && saved?.picked?.length === 0 && saved?.option !== 'office-network')
  const [networkName, setNetworkName] = useState(saved?.answers?.[NETWORK_NAME] ?? '')
  const [networkRanges, setNetworkRanges] = useState(saved?.answers?.[NETWORK_RANGES] ?? '')
  const networkDraftValid = networkName.trim().length > 0 && validNetworkRanges(networkRanges)
  const matchedNote = isExclusionsGroup ? null : matchedNoteOf(d.matchedNote, chips, app.picker.matched)
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const hasPicker = rows.length > 0 || universe.length > 0
  // The decision's own options, and its question under the picker: a whole
  // option is a radio; one that needs a value the scan cannot fill (the travel
  // countries, the mail-sending devices) is a picker of the step's kind, accounts
  // otherwise, and its chips are the answer. The question's answer persists as
  // questionAnswers[stepId:label] (decisions.ts).
  const options = optionsOf(d.options, ex)
  const accountPickerOnly = stepId === 's-goal-block-legacy-auth'
  const question = questionFor(d, ex)
  const needsValue = options.some((o) => o.needs !== null) || (question?.options.some((o) => o.needs !== null) ?? false)
  const valueUniverse = useMemo(() => (needsValue ? pickerUniverse(stepId, valueSource(stepId), pickerCtx) : []), [needsValue, stepId, ctx.snapshot, ctx.mapping, ctx.nameOf, ctx.groups])
  const [option, setOption] = useState<string | null>(saved?.option ?? null)
  const [answer, setAnswer] = useState<string | null>(question ? (saved?.answers?.[question.label] ?? null) : null)
  // The strict toggle (the device decision's Block phones): off unless ticked;
  // its answer is its one option's words, under its own label.
  // `label` is the answer's key (questionAnswers[step:label]); `heading` is what the page shows over it, where the content names one.
  // `when` is the decision option the toggle follows (S-DD-1): Unmanaged phones is
  // asked only when phones are enrolled; otherwise it is hidden and a Save clears it.
  const strict = d.strict && typeof d.strict.label === 'string' && typeof d.strict.option === 'string' ? (d.strict as { label: string; option: string; heading?: string; text?: string; help?: string; when?: string }) : null
  const [strictOn, setStrictOn] = useState<boolean>(strict ? saved?.answers?.[strict.label] === strict.option : false)
  const strictShown = strict !== null && (typeof strict.when !== 'string' || answerParts(option, options)?.option.text === strict.when)
  const chooseOption = (next: string | null): void => {
    setOption(next)
    if (strict && typeof strict.when === 'string' && answerParts(next, options)?.option.text !== strict.when) setStrictOn(false)
  }
  const base = useId()
  const complete = (value: string | null, choices: QuestionOption[]): boolean => {
    const parsed = answerParts(value, choices)
    return parsed !== null && (parsed.option.needs === null || parsed.picked.length > 0)
  }
  const canSaveWith = (picked: PickerOption[]): boolean => (accountPickerOnly || options.length === 0 || complete(option, options)) && (!question || stepId === 's-prereq-allowed-countries' || complete(answer, question.options)) && (isNetwork ? remote || picked.length > 0 || networkDraftValid : (!single && stepId !== 's-prereq-allowed-countries') || picked.length > 0)
  const canSave = canSaveWith(chips)
  // The picker saves (owner, 2026-09-23): Done in its list, or a chip taken off,
  // saves the decision with the selection as it stands, through the same Save
  // as ever (pickerRows.ts pickerSaves). Where the picker is the decision's
  // only input no Save button stands beside it (pickerSavesAlone).
  const saves = pickerSaves(d, stepId)
  const savesAlone = hasPicker && pickerSavesAlone(d, stepId)
  const save = (picked: PickerOption[] = chips): void => {
    if (!canSaveWith(picked)) return
    onDecide?.({
      ...(hasPicker || isNetwork ? { picked: remote ? [] : picked.map((c) => c.id) } : {}),
      ...(isNetwork ? { option: remote ? 'remote' : 'office-network', answers: { [NETWORK_NAME]: !remote && picked.length === 0 ? networkName.trim() : '', [NETWORK_RANGES]: !remote && picked.length === 0 ? networkRanges.trim() : '' }, ...(remote ? {assumed: 'none'} : {}) } : {}),
      ...(option !== null ? { option } : accountPickerOnly ? { option: 'None' } : {}),
      ...(question && (answer !== null || stepId === 's-prereq-allowed-countries') ? { answers: { [question.label]: answer ?? 'No Recurring Destinations' } } : {}),
      ...(strict && strictShown && strictOn ? { answers: { ...(question && answer !== null ? { [question.label]: answer } : {}), [strict.label]: strict.option } } : {}),
    })
  }
  // Each effect line shows once its answer applied (answers.ts effectLine): the
  // applied mapping holds the stored answer, so the line is true when it shows.
  const decisionAnswer = answerOf(ctx.mapping, stepId, 'decision')
  const questionEffect = question ? effectLine((d.question as { effect?: unknown }).effect, answerOf(ctx.mapping, stepId, 'question')) : null
  // The help is explanatory prose and renders in the flow, not inside the
  // .decision row (which the contract measures against the row budget); once
  // the decision is answered, its effect line stands where the help stood
  // (stepExport.ts decisionLine): one line, never both.
  return (
    <>
      {!railInstruction && !isExclusionsGroup && decisionAnswer === null && <Line s={decisionLine(d, null)} ex={ex} cls="reason" />}
      <div className="decision">
        {/* Each label is an element the controls under it can name (task 017):
            the picker takes it as its group label, the radios as their
            radiogroup's, so a decision is heard as a question with answers. */}
        {/* The action column's heading (content review R6): the input's own label, bold, over the first input. */}
        <h5 className="dlabel action-heading" id={`${base}-decision`}>{d.heading ?? d.label}</h5>
        {/* A pre-filled match says what it is and what Save does (content review S2). */}
        {matchedNote !== null && <p className="reason">{matchedNote}</p>}
        {/* Each part of a decision reads the same way: its heading, its question, its answers. */}
        {!isExclusionsGroup && typeof d.text === 'string' && <p className="reason"><T s={d.text} ex={ex} /></p>}
        {isNetwork && <label className="remote-choice"><input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} />Everyone Is Remote</label>}
        {/* The campaign's support list is IAMAI's: the person confirms it,
            rather than composing one. It is computed from the readiness the
            plan already holds — every active admin, everyone with no method,
            everyone on SMS alone (derive/contentLists.ts specialCareIds) —
            and somebody added by hand changes who the plan says needs help,
            which is a number other steps read (owner, 2026-09-22).
            On paper, a picker nobody saved (pickerRows.ts initialPicked
            `defaulted`) says its chips are IAMAI's suggestion and not saved
            (printedDefaultLine): it had printed them as the answer, and then
            the heading over nothing. */}
        {(hasPicker || isNetwork) && !remote && (printing && initial.defaulted && !isExclusionsGroup
          ? <p className="reason">{printedDefaultLine(chips.map((c) => c.name))}</p>
          : <Picker labelledBy={`${base}-decision`} selected={chips} options={results} suggestions={isNetwork ? nominated.slice(0, 3) : nominated} onChange={setChips} onSearch={setQuery} single={single} readOnly={stepId === SPECIAL_CARE_STEP_ID} onCommit={saves ? (picked) => save(picked) : undefined} />)}
        {isNetwork && !remote && chips.length === 0 && <div className="decision-fields">
          {universe.length === 0 && <p className="reason">{ctx.snapshot.config.namedLocations?.status === 'ok' ? 'No IP named locations were found in this scan.' : 'Named locations could not be fully read. Scan again to load existing office networks.'}</p>}
          <div className="decision-field"><label htmlFor={`${base}-network-name`}><strong>Office Network Name</strong></label><input type="text" id={`${base}-network-name`} value={networkName} onChange={e => setNetworkName(e.target.value)} /></div>
          <div className="decision-field"><label htmlFor={`${base}-network-ranges`}><strong>Public IP Ranges</strong></label><textarea id={`${base}-network-ranges`} value={networkRanges} placeholder="203.0.113.10/32" onChange={e => setNetworkRanges(e.target.value)} /></div>
          {networkRanges.trim() && !validNetworkRanges(networkRanges) && <p role="alert">Enter IPv4 or IPv6 ranges with a prefix, one per line. A whole-internet range is not allowed.</p>}
        </div>}
        {isNetwork && !remote && <p className="reason">If your office network is not listed, save its name and approved public ranges here. Follow the Entra steps to create it, then scan again and select it.</p>}
        {options.length > 0 && <Options name={answerKey(stepId, String(d.label))} labelledBy={`${base}-decision`} pickerOnly={accountPickerOnly} options={options} answer={option} onAnswer={chooseOption} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} select />}
        {!isExclusionsGroup && decisionAnswer !== null && <Line s={decisionLine(d, decisionAnswer)} ex={ex} cls="reason effect" />}
        {question && (
          <>
            <h5 className="dlabel" id={`${base}-question`}>{question.label.replace(/:$/, "")}</h5>
            <p className="reason"><T s={question.text} ex={ex} /></p>
            <Options name={answerKey(stepId, question.label)} labelledBy={`${base}-question`} pickerOnly={stepId === 's-prereq-allowed-countries'} options={question.options} answer={answer} onAnswer={setAnswer} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} select />
            {questionEffect && whole(questionEffect, ex) && <p className="reason effect"><T s={questionEffect} ex={ex} /></p>}
          </>
        )}
        {strict && strictShown && (
          <>
            <div className="dlabel" id={`${base}-strict`}>{strict.heading ?? strict.label}</div>
            {strict.text && <p className="reason"><T s={strict.text} ex={ex} /></p>}
            {strict.help && <p className="reason"><T s={strict.help} ex={ex} /></p>}
            <div className="picker" role="group" aria-labelledby={`${base}-strict`}>
              <label>
                <input type="checkbox" checked={strictOn} onChange={(e) => setStrictOn(e.currentTarget.checked)} /> <T s={strict.option} ex={ex} />
              </label>
            </div>
          </>
        )}
        {!savesAlone && <Button variant="secondary" disabled={!canSave} onClick={() => save()}>{d.save || 'Save'}</Button>}
      </div>
    </>
  )
}

/**
 * Options as radios; the one that needs a value as a picker, its chips the
 * answer in the option's own words.
 *
 * `labelledBy` is the id of the `.dlabel` above (task 017): without it a screen
 * reader reads each option on its own and never the question they answer, and
 * two decisions on one step read as one undifferentiated run of radios.
 */
/**
 * A decision's options: radios, or a picker where an option takes a value. Shared
 * with Plan settings -> Baseline mappings. `select` draws options that are all
 * one-line labels as a dropdown (archetype rule A1, S-DD-1), with nothing chosen
 * until a person chooses.
 */
export function Options({ name, labelledBy, options, answer, onAnswer, ex, universe, nameOf, single = false, select = false, pickerOnly = false }: { name: string; labelledBy: string; options: QuestionOption[]; answer: string | null; onAnswer: (answer: string | null) => void; ex: Ex; universe: PickerObject[]; nameOf: (id: string) => string; single?: boolean; select?: boolean; pickerOnly?: boolean }) {
  const parts = answerParts(answer, options)
  const valued = options.find((o) => o.needs !== null) ?? null
  const [chips, setChips] = useState<PickerOption[]>(() => (parts?.option.needs ? parts.picked.map((id) => universe.find((u) => u.id === id) ?? { id, name: nameOf(id) }) : []))
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  if (pickerOnly && valued) return <Picker labelledBy={labelledBy} selected={chips} options={results} onSearch={setQuery} onChange={next => { setChips(next); onAnswer(next.length ? answerText(valued, next.map(c => c.id)) : answerText(options.find(o => o.needs === null)!)) }} />
  if (select && options.every((o) => o.needs === null)) {
    return (
      <select className="decision-select" name={name} aria-labelledby={labelledBy} value={parts ? String(options.indexOf(parts.option)) : ''} onChange={(e) => onAnswer(e.currentTarget.value === '' ? null : answerText(options[Number(e.currentTarget.value)]))}>
        <option value="">{app.picker.choose}</option>
        {options.map((o, i) => (
          <option key={i} value={String(i)}>
            {fillText(o.text, ex as Record<string, unknown>)}
          </option>
        ))}
      </select>
    )
  }
  const pick = (next: PickerOption[]): void => {
    setChips(next)
    if (valued) onAnswer(answerText(valued, next.map((c) => c.id)))
  }
  // A group of radios only where they are radios: an option that takes a value
  // renders a picker instead, and a radiogroup around a combobox is a lie.
  const radios = options.every((o) => o.needs === null)
  return (
    <div className="picker" role={radios ? 'radiogroup' : 'group'} aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        if (o.needs === null) {
          return (
            <label key={i}>
              <input type="radio" name={name} checked={parts?.option === o} onChange={() => onAnswer(answerText(o))} /> <T s={o.text} ex={ex} />
            </label>
          )
        }
        const [before, after] = o.text.split(/\{(?:list:)?[a-zA-Z0-9_]+\}/)
        return (
          <div key={i} className="option-value">
            <label><input type="radio" name={name} checked={parts?.option === o} onChange={() => onAnswer(answerText(o, chips.map(c => c.id)))} />{fillText(before, ex as Record<string, unknown>).replace(/:\s*$/, '').trim() || 'Choose Accounts'}</label>
            {parts?.option === o && <><Picker selected={chips} options={results} suggestions={[]} onChange={pick} onSearch={setQuery} single={single} />
            {after.trim() && <span className="reason">{fillText(after, ex as Record<string, unknown>)}</span>}</>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * What the step says about consequence, rather than about the next action: what
 * could go wrong, the way back, the recovery runbook, and the three boxes of
 * text to send.
 *
 * It has one source and two places (owner, 2026-09-20): behind "Why IAMAI says
 * this" on screen, where a person can reach it without printing, and on the
 * printed page, where it always stood. Risk is on no card — the card says what
 * to do next — unless a step declares very high implementation risk, and no
 * step declares one today.
 */
function MoreReading({ cs, ex, ifWrong, comms, copy, copied }: {
  cs: Record<string, any>
  ex: Ex
  /** The rollback the step's operation earns, where the change is one that could be made. */
  ifWrong: string | null
  /** The email as the exports say it (stepExport.ts commsFor), where the step asks anybody to do anything. */
  comms: { salutation: string; body: string; extra: string[]; signature: string } | null
  copy: (id: string, t: string) => void
  copied: string | null
}) {
  const more = cs.more || {}
  const risks = (more.risks || []) as { text: string; applies?: string }[]
  const applies = risks.filter((r) => r.applies && truthy(ex[r.applies]))
  const rest = risks.filter((r) => !(r.applies && truthy(ex[r.applies])))
  const commsText = comms ? [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n') : null
  return (
    <>
      {/* The pack draws the disclosure as a two-column grid of small cards at
          the wider widths (`docs/design/approved/anatomy/plan-step-v1.html`
          `.more-grid` / `.more-card`), and its own sample cards are these two:
          what could go wrong, and the way back. Production already writes both
          in that shape, so they take the grid. Nothing is invented to fill a
          second column — one card alone is one card — and the work artifacts
          below (the names, the recovery runbook, the three copy boxes) stay
          full width, because a copy box halved is a copy box nobody can read. */}
      {(risks.length > 0 || (ifWrong !== null && whole(ifWrong, ex))) && (
        <div className="more-grid">
          {risks.length > 0 && (
            <div className="more-card">
              <h5>{HEAD.risks}</h5>
              {/* The items that apply here first, marked; the rest under Also possible.
                  When none applies the rest stand under the heading, never an empty list. */}
              {applies.length > 0 && <ul className="sections">{applies.map((r, i) => <li key={i}><T s={r.text} ex={ex} /> <span className="chip">applies here</span></li>)}</ul>}
              {rest.length > 0 && applies.length > 0 && <p className="sub">{HEAD.alsoPossible}</p>}
              {rest.length > 0 && <ul className="sections">{rest.map((r, i) => <li key={i}><T s={r.text} ex={ex} /></li>)}</ul>}
            </div>
          )}
          {/* The rollback the step's operation earns, not the one its content was
              written with: a created policy is set back to report-only or deleted,
              a changed one has its settings put back (stepExport.ts ifWrongLineFor). */}
          {ifWrong && whole(ifWrong, ex) && (
            <div className="more-card">
              <h5>{HEAD.ifWrong}</h5>
              <p className="line"><T s={ifWrong} ex={ex} /></p>
            </div>
          )}
        </div>
      )}
      {/* The recovery runbook the emergency-access step carries: what to do the
          day a change locks somebody out. It is not the next action on any step,
          and it is here whole rather than half of it above. */}
      {cs.lockedOut && (
        <>
          <h4>{cs.lockedOut.label}</h4>
          <ul className="sections">{(cs.lockedOut.steps || []).map((x: unknown, i: number) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
        </>
      )}
      {comms && commsText && (
        <>
          <h4>{HEAD.comms}</h4>
          <div className="copy-box">
            <Button variant="secondary" onClick={() => copy('comms', commsText)}>
              {copied === 'comms' ? 'Copied' : 'Copy'}
            </Button>
            <p>{comms.salutation}</p>
            <p>{comms.body}</p>
            {comms.extra.map((l, i) => <p key={i}>{l}</p>)}
            <p>{comms.signature}</p>
          </div>
        </>
      )}
      {Array.isArray(more.helpDesk) && (more.helpDesk as unknown[]).filter((x) => whole(x, ex)).length > 0 && (
        <>
          <h4>{HEAD.helpDesk}</h4>
          <ul className="sections">{(more.helpDesk as unknown[]).filter((x) => whole(x, ex)).map((x, i) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
        </>
      )}
      {managerText(cs, ex as Record<string, unknown>) !== null && (
        <>
          <h4>{HEAD.manager}</h4>
          {/* The three sentences, and the clause the records earn (managerNone under its applies, E9). */}
          <p className="reason">{managerText(cs, ex as Record<string, unknown>)}</p>
          <p className="actions"><Button variant="secondary" onClick={() => copy('manager', managerText(cs, ex as Record<string, unknown>) ?? '')}>{copied === 'manager' ? 'Copied' : 'Copy'}</Button></p>
        </>
      )}
    </>
  )
}

/**
 * Audit depth and work artifacts, under one disclosure.
 *
 * What is here is what does not change the next action: the names behind the
 * counts stated above, what could go wrong, the way back from a change, the
 * recovery runbook, and the three boxes of text to send. What is never here is a
 * blocker — those are the contract's `fix`, and they render above, in a section
 * of their own.
 *
 * `open` while printing, so a printed step is the whole step (§7).
 */
function More({ cs, ex, step, contractWho, ifWrong, comms, onSkip, onUnskip, onDoesntApply, copy, copied, open = false }: {
  cs: Record<string, any>
  ex: Ex
  step: Step
  /** The name lists the default step stated as counts (whoBlocks). */
  contractWho: WhoBlock[]
  /** The rollback the step's operation earns, where the change is one that could be made. */
  ifWrong: string | null
  /** The email as the exports say it (stepExport.ts commsFor), where the step asks anybody to do anything. */
  comms: { salutation: string; body: string; extra: string[]; signature: string } | null
  onSkip: (r: string) => void
  onUnskip: () => void
  onDoesntApply?: (reason: string) => void
  copy: (id: string, t: string) => void
  copied: string | null
  open?: boolean
}) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <details className="more" open={open || undefined}>
      <summary>{HEAD.more}</summary>
      {/* The people behind the counts above: the same lines, with their names
          under them. Nothing here is new evidence; it is the evidence the step
          already stated, at the length it actually is. */}
      <StepSection heading={HEAD.namesHeld} when={contractWho.length > 0} frame={false}>
        {contractWho.map((b) => (
          <div key={b.key} className="names-group">
            {b.lead && <p className="reason">{b.lead}</p>}
            {b.names.length > 0 && <ol className="names">{b.names.map((nm, i) => <li key={i}>{nm}</li>)}</ol>}
          </div>
        ))}
      </StepSection>
      <MoreReading cs={cs} ex={ex} ifWrong={ifWrong} comms={comms} copy={copy} copied={copied} />
      {/* Defer this step (decision 3), and beside it Doesn't apply here on the content
          steps flagged for it: never a foundation (emergency access, the exclusions
          group), never a policy step whose subject exists. Pressing it asks one line,
          required, that goes on the plan; the step then leaves its phase for the footer. */}
      {step.status !== 'skipped' && (
        <p className="actions">
          {cs.skip && <Button variant="tertiary" onClick={() => onSkip('Not needed for this tenant')}>{CONTRACT.rollout.control}</Button>}
          {offersDoesntApply(cs, step) && onDoesntApply && !asking && <Button variant="tertiary" onClick={() => setAsking(true)}>{SHARED.doesntApplyControl}</Button>}
        </p>
      )}
      {asking && step.status !== 'skipped' && (
        <div className="decision">
          <p className="reason">{fillText(SHARED.doesntApplyPrompt, { tenant: String(ex.tenant ?? '') })}</p>
          <input type="text" required aria-label={fillText(SHARED.doesntApplyPrompt, { tenant: String(ex.tenant ?? '') })} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Button variant="secondary" disabled={reason.trim().length === 0} onClick={() => { if (reason.trim().length > 0) onDoesntApply?.(reason.trim()) }}>Save</Button>
        </div>
      )}
      {step.status === 'skipped' && <p className="actions"><Button variant="tertiary" onClick={onUnskip}>{app.plan.putBack}</Button></p>}
    </details>
  )
}

/**
 * Disable or Confirm Dormant Accounts, as one control.
 *
 * It drew a dropdown and a text box per account — two controls on the demo, and
 * **1,462 on a directory with 731 dormant accounts**, in the action column of one
 * step. Nobody works a list that long through a form (owner, 2026-09-20: if a
 * step looks like too much, it is).
 *
 * Only one of the three answers was ever needed here. The step completes when
 * every listed account is disabled, active again, or kept with a recorded reason
 * (generate.ts), and the first two the scan sees for itself — an account
 * disabled in Entra reads back disabled. "Investigate" clears nothing. So the
 * only thing a person has to tell IAMAI is which accounts they are **keeping**,
 * and why: the picker Establish Emergency Access already uses for exactly this
 * shape of answer, and one reason for the set.
 */
/**
 * The campaign's "Turn on without them for now" list (roadmap/followUp.ts, owner
 * decision 9): anyone not ready whom a person chooses not to wait for, such as
 * someone on leave. Nobody is pre-selected — only a Save marks anyone — and the
 * policies that waited on the campaign name whoever is.
 */
function FollowUpDecision({ step, ctx, saved, onDecide, printing }: { step: Step; ctx: StepVarContext; saved: StepDecision | null; onDecide?: (d: StepDecisionInput) => void; printing: boolean }) {
  const F = CONTRACT.followUp
  const notReady = step.preparation?.missingIds ?? []
  const marked = step.preparation?.followUpIds ?? []
  const optionOf = (id: string): PickerOption => ({ id, name: ctx.nameOf(id) })
  const [picked, setPicked] = useState<PickerOption[]>(() => (saved?.picked ?? marked).filter((id) => notReady.includes(id)).map(optionOf))
  const [query, setQuery] = useState('')
  if (notReady.length === 0 && marked.length === 0) return null
  if (printing) return <div className="decision"><p className="reason">{marked.length > 0 ? fillText(F.printed, { names: list(marked.map((id) => ctx.nameOf(id))) }) : F.printedNone}</p></div>
  const labelId = `follow-up-${step.id}`
  const options = notReady.map(optionOf)
  const results = options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
  return <div className="decision">
    <h5 className="dlabel" id={labelId}>{F.pickerLabel}</h5>
    <p className="reason">{F.pickerHelp}</p>
    <Picker labelledBy={labelId} selected={picked} options={results} suggestions={options.slice(0, 3)} onSearch={setQuery} onChange={setPicked} onCommit={(next) => onDecide?.({ picked: next.map((o) => o.id) })} />
  </div>
}

function DormantDecision({ step, onDecide, printing }: { step: Step; onDecide?: (d: StepDecisionInput) => void; printing: boolean }) {
  const rows = step.dormantChoices ?? []
  const open = rows.filter(row => !row.disabled)
  const kept = rows.filter(row => row.outcome === 'keep')
  const [picked, setPicked] = useState<PickerOption[]>(() => kept.map(row => ({ id: row.id, name: row.name })))
  const [reason, setReason] = useState<string>(() => kept.find(row => row.reason.trim())?.reason ?? '')
  const [query, setQuery] = useState('')
  const labelId = `dormant-${step.id}`
  const options: PickerOption[] = open.map(row => ({ id: row.id, name: row.name }))
  const results = options.filter(option => option.name.toLowerCase().includes(query.toLowerCase()))
  const disabled = rows.filter(row => row.disabled).length
  if (printing) return <div className="decision">
    <p className="reason">{kept.length > 0 ? `Kept: ${kept.map(row => row.name).join(', ')}${reason ? ` — ${reason}` : ''}` : 'No account is recorded as kept.'}</p>
    {disabled > 0 && <p className="reason">{disabled} already disabled in the directory.</p>}
  </div>
  // Every account the picker does not hold is expected to be disabled in Entra;
  // the next scan is what completes it, so nothing is saved for them here.
  const save = (keeping: PickerOption[] = picked): void => onDecide?.({ answers: Object.fromEntries(rows.flatMap(row => {
    const keep = keeping.some(option => option.id === row.id)
    return [[`outcome:${row.id}`, keep ? 'keep' : ''], [`reason:${row.id}`, keep ? reason.trim() : '']]
  })) })
  return <div className="decision">
    <h5 className="dlabel" id={labelId}>Accounts you are keeping</h5>
    {/* The picker's Done saves as every picker's does, once there is a reason for
        what it keeps; the Save below is the reason's. */}
    <Picker labelledBy={labelId} selected={picked} options={results} suggestions={options.slice(0, 3)} onSearch={setQuery} onChange={setPicked} onCommit={(next) => { if (next.length === 0 || reason.trim()) save(next) }} />
    <label className="dlabel" htmlFor={`${labelId}-reason`}>Why they are kept</label>
    <input id={`${labelId}-reason`} value={reason} onChange={e => setReason(e.currentTarget.value)} />
    <p className="reason">Disable the rest in Entra, then scan again. {disabled > 0 ? `${disabled} of these are already disabled.` : 'None of these are disabled yet.'}</p>
    <Button variant="primary" disabled={picked.length > 0 && !reason.trim()} onClick={() => save()}>Save</Button>
  </div>
}
