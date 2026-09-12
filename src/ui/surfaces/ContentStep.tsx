// A step opened in place: the one body the Plan draws for every step it has, and
// the only one (task 011).
//
// The anatomy is the approved Plan design's
// (docs/design/approved/anatomy/plan-step-v1.html, owner update Sep 10, 2026):
// the head with its lifecycle track, then Why, Readiness — the one place a
// prerequisite is shown, A1 §16.1 — What to do where the step has instructions
// of its own, Implementation and Done when, beside a rail that is the Next
// milestone only, over a footer
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
import { useId, useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Step } from '../../roadmap/types.ts'
import { isEmergencyAccess } from '../../roadmap/blockerSteps.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, content } from '../../content/content.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { fillText, whole, SINGLE_CHOICE_SOURCES } from '../../content/render.ts'
import { baselineConflictWords } from '../../roadmap/baselineConflict.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { stepContext } from '../../roadmap/prompts.ts'
import { Button, Callout, Icon, Picker, TabList, onePanelProps } from '../components/index.ts'
import type { PickerOption, TabItem } from '../components/index.ts'
import { filterPickerObjects, pickerUniverse } from './pickerRows.ts'
import type { PickerObject } from './pickerRows.ts'
import { answerParts, answerText, optionsOf, questionFor, valueSource } from './stepQuestion.ts'
import type { QuestionOption } from './stepQuestion.ts'
import { answerKey } from '../../roadmap/decisions.ts'
import { answerOf, effectLine } from '../../roadmap/answers.ts'
import { powershellFor } from './stepPowerShell.ts'
import { policyJsonText, stepOperations } from './stepJson.ts'
import { commsFor, datesLineFor, ifWrongLineFor, managerText, decisionLine, stepExportView } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { REDACTED, exportClipboard, unredactedFrom } from '../exportGuard.ts'
import { CONTRACT, eyebrowOf, implementationEmptyOf, implementationIsCurrent, readinessOf, stepContract } from './stepContract.ts'
import type { ImplementationEmpty, PrerequisiteBlocker } from './stepContract.ts'
import { HARDENING_DEFERRAL_ID } from '../../validation/emergencyTiers.ts'
import { AuthoredText, DoneWhen, HardeningBody, ImplementationEmptyBox, PolicyMembers, ReadinessSection, StepDialog, StepFooter, StepHead, StepRail, StepSection, StepState, WhatIamaiFound, WhatToDoLead, badgeLabel } from './StepSections.tsx'
import { MfaHandoff } from './MfaHandoff.tsx'
import { HEAD } from './stepHeadings.ts'
import { whoBlocks, whoLeadLine } from './whoBlocks.ts'
import type { WhoBlock } from './whoBlocks.ts'
import { BASELINE_COMMIT, artifactText, bindingLabel, implementationPackageFor, mergeReadiness, packageBindings, packageDrawsImplementation, packageReviewFor, packageRuntime, packageSourceLine, packageStateOf, planningPreview, reviewedPackageFor } from './stepPackage.ts'
import { list } from '../../copy/statements.ts'
import { prerequisiteBasis, projectSafely, readinessSafely, troubleshootingSafely } from '../../content/implementation/project.ts'
import type { ChannelArtifact, OutputChannel, OwnerConfirmation, TroubleshootingScenario } from '../../content/implementation/project.ts'
import type { ReadinessTile } from './stepContract.ts'
import { absoluteDate } from '../../copy/dates.ts'

type Ex = Record<string, unknown>

const NO_CONFIRMATIONS: Readonly<Record<string, OwnerConfirmation>> = {}
const NO_BLOCKERS: readonly PrerequisiteBlocker[] = []

type Channel = 'portal' | 'ps' | 'json' | 'ai' | 'email'

/**
 * One channel as the Implementation region draws it: the tab it sits under, how
 * its text is set, the text itself (read when shown, so a long artifact is not
 * built for a tab nobody opens), and the one line of support under the preview
 * that says how it is run.
 */
type Artifact = { id: Channel; form: 'list' | 'code' | 'markdown'; lines: string[]; text: () => string; note: string | null }

/** A package's output channels under the viewer's own tab ids. */
const PACKAGE_CHANNEL: Record<OutputChannel, Channel> = { entra: 'portal', powershell: 'ps', json: 'json', aiInfo: 'ai', email: 'email' }

/**
 * A package channel as an artifact. The words are the package's, bound; the
 * support line is its own metadata — the modes a script's invocation runs it in
 * (content/implementation/invocation.ts), the request a JSON body is sent with —
 * and never a sentence written here.
 */
function packageArtifact(a: ChannelArtifact): Artifact {
  const W = CONTRACT.implementation
  const note =
    a.channel === 'powershell' && a.runs.length > 0
      ? fillText(W.powershellInvocation, { modes: [...new Set(a.runs.map((r) => r.mode))].join(', ') })
      : a.channel === 'json' && a.requests.length > 0
        ? a.requests.map((r) => `${r.method} ${r.endpoint}`).join(' · ')
        : null
  const text = artifactText(a, W.aiWarning)
  return { id: PACKAGE_CHANNEL[a.channel], form: a.format === 'markdown' ? 'markdown' : 'code', lines: [], text: () => text, note }
}

/**
 * Which implementation channels this step actually has, in the approved order.
 *
 * Availability is production's, read and not guessed: the portal channel exists
 * when the translator produced lines for this step, and the two machine channels
 * exist together when Foundation A offers an implementation
 * (`contract.implementation.offered`, which is roadmap/operations.ts
 * `implementationOffered` and is also `stepJson.jsonOffered`). Nothing here asks
 * a second time, and nothing here manufactures a channel to fill a strip.
 *
 * AI Info is the approved design's fourth channel. It describes the step the
 * other channels implement — the step context the prompts already ground
 * themselves in (roadmap/prompts.ts `stepContext`) — so it stands beside them and
 * never on its own: a step with nothing to implement has nothing to describe.
 */
function channelsFor(hasPortal: boolean, machineOffered: boolean): Channel[] {
  const out: Channel[] = []
  if (hasPortal) out.push('portal')
  if (machineOffered) out.push('ps', 'json')
  if (out.length > 0) out.push('ai')
  return out
}

/**
 * The channels under the labels an operator reads on the page, in the approved
 * order — Entra, PowerShell, JSON, AI Info — with Email appended, the fifth
 * member the owner authorised for a package that projects one. The first three
 * are `CONTRACT.railChannels`, the words those channels have always had; the ids
 * are the internal ones and do not move (`portal` renders the Entra portal
 * instructions, whatever the console is called this year).
 */
const CHANNEL_TABS: TabItem[] = [
  { id: 'portal', label: CONTRACT.railChannels.portal },
  { id: 'ps', label: CONTRACT.railChannels.powershell },
  { id: 'json', label: CONTRACT.railChannels.json },
  { id: 'ai', label: CONTRACT.implementation.ai },
  { id: 'email', label: CONTRACT.implementation.email },
]

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))

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
  baselineCommit = BASELINE_COMMIT,
  printing = false,
  when = null,
  blockers = NO_BLOCKERS,
  onOpenMappings,
}: {
  step: Step
  ctx: StepVarContext
  /** The row's When column (planBoard.ts boardWhenOf), which the rail repeats for an undated held step rather than saying something else. */
  when?: string | null
  /** The engine's unresolved prerequisites of this step's next action (planBoard.ts readinessBlockersOf), each a Readiness tile the contract's own fixes do not already state. */
  blockers?: readonly PrerequisiteBlocker[]
  /** Opens Plan settings → Baseline mappings, where a Readiness tile links there. */
  onOpenMappings?: () => void
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
  /** This step's owner confirmations of the checks IAMAI cannot read, by prerequisite id (roadmap/decisions.ts). */
  confirmations?: Readonly<Record<string, OwnerConfirmation>>
  /** Records confirmations, each with the values it was given against. */
  /** The checks confirmed, each with the basis it was given against; the record stamps the time. */
  onConfirm?: (confirmed: Record<string, Pick<OwnerConfirmation, 'basis'>>) => void
  /** Withdraws the confirmations of these prerequisites. */
  onUnconfirm?: (prerequisites: string[]) => void
  /**
   * The baseline commit implementation content is matched against: this build's
   * pin, always, on every product surface. Only the dev review harness
   * (src/testing/pilotPreview.tsx, never built) renders a package as a build
   * pinned to that package's own baseline would.
   */
  baselineCommit?: string
  /** Printing: the evidence and More stand open on the page, so every step prints in full (§7). */
  printing?: boolean
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const closeDialog = (): void => setDialog(null)
  const [copied, setCopied] = useState<string | null>(null)
  // The content step (resolved the same way the plan row resolves its title).
  // The step's own words, where the content file has any. A step it has no entry
  // for is not a step without a body: the contract still knows where it is, why
  // it matters and what to do next, and this renders that.
  const cs = (contentStepFor(step) ?? {}) as Record<string, any>
  const ex = stepVars(step, ctx) as Ex
  // The Step Contract (stepContract.ts): the state, the next milestone, the one
  // action, the blockers and the completion, worked out once from Foundations A,
  // B and C. Everything below renders it; nothing below asks them again.
  const contract = stepContract(step, ctx, ex as Record<string, unknown>)
  // The one title, from the one resolver the row reads (content/stepTitle.ts), so
  // the row and the body it opens can never disagree.
  const title = contentTitle(step)
  const copied1500 = (id: string) => (ok: boolean): void => {
    if (!ok) return
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
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
    void exportClipboard(text, unredactedFrom('implementation-artifact')).then(copied1500(id))
  }
  const learn = cs.learn || {}
  const who = cs.who || {}
  const d = cs.decision
  const w = cs.whatToDo || {}
  // The tenant's objects behind the baseline's placeholders (a saved decision
  // included), or the names the plan proposes for them, so every line is a name.
  const portalNames = portalNamesFor(ctx, ex, title)
  // What the step offers today (stepInstructions.ts): the step's own resolved
  // policies through the translator — the same bodies the JSON and the
  // PowerShell carry — the content's leading "before" lines, and the step's own
  // instruction lines. All three are withheld together while an authority holds
  // the change, so the screen cannot instruct a change the artifacts refuse to
  // describe.
  const instructions = stepInstructions(step, cs, ex as Record<string, unknown>, portalNames)
  const portal = instructions.portal
  // Whether the step has *dates* and a rollback to print, which it does not
  // while its policy cannot be written.
  const reason = cs.kind === 'policy' ? unavailableReason(step) : null
  // The contradiction this step's own source carries, where it carries one
  // (roadmap/baselineConflict.ts): the explanation follows the reviewed source
  // policy recorded on the step, so it renders on whichever goal the active
  // baseline hands that source.
  const conflictWords = baselineConflictWords(step)
  // The content's leading "before" lines (a setting to change before the policy
  // is created) stay above the translator's portal lines, numbered with them.
  const before = instructions.before
  // What the step is offering RIGHT NOW. The capability is unchanged — the
  // artifacts exist and `contract.implementation.offered` still says so — but a
  // step whose current action is to clear a blocker, answer a decision or read
  // new evidence is not also offering the deployment (stepContract.ts
  // `implementationIsCurrent`). The same channels come back when the condition
  // does, from the same call, with nothing regenerated.
  const deployNow = implementationIsCurrent(step)
  const hasPortal = portal !== null && portal.length + before.length > 0
  const channels = deployNow ? channelsFor(hasPortal, contract.implementation.offered) : []
  const portalLines = hasPortal ? [...before, ...(portal ?? [])] : []
  const hasSteps = instructions.steps.length > 0
  // The step's implementation-content package, where one is active
  // (stepPackage.ts): IAMAI's state and bindings in, the package's own blocks
  // out. A package state with nothing to implement projects no channel; a
  // required value IAMAI does not hold projects nothing at all.
  const pkg = implementationPackageFor(step)
  const pkgState = pkg ? packageStateOf(step, contract, ctx.snapshot) : null
  const pkgBindings = pkg && pkgState ? packageBindings(step, ctx, contract) : null
  // What the runtime knows beside the bindings: which prerequisites a tenant fact
  // or a person's still-valid confirmation satisfies now. The projection, the
  // readiness and the troubleshooting never throw: a package the runtime cannot
  // project holds its implementation and the fault is reported (project.ts).
  const pkgRuntime = pkg && pkgState && pkgBindings ? packageRuntime(pkg, pkgState, pkgBindings, confirmations, baselineCommit) : null
  const projection = pkg && pkgState && pkgBindings && pkgRuntime ? projectSafely(pkg, pkgState, pkgBindings, pkgRuntime.runtime) : null
  const pkgReadiness = pkg && pkgState && pkgBindings && pkgRuntime ? readinessSafely(pkg, pkgState, pkgBindings, pkgRuntime.runtime) : null
  const scenarios: TroubleshootingScenario[] = pkg && pkgState && pkgBindings ? troubleshootingSafely(pkg, pkgState, pkgBindings) : []
  // The planning preview (owner, 2026-09-11): where the package authors the work
  // this step will require but it cannot run yet, the planned work stands in the
  // Implementation region for review and estimation — never copyable, and saying
  // what is unresolved (stepPackage.ts planningPreview).
  const preview = pkg && pkgBindings && pkgRuntime ? planningPreview(pkg, step, contract, ctx.snapshot, pkgBindings, pkgRuntime.runtime, projection) : null
  // Whether the package's projection or the step's own channels draw the
  // Implementation region (stepPackage.ts packageDrawsImplementation).
  const packaged = preview !== null || packageDrawsImplementation(pkg, projection)
  // Who this touches (whoBlocks.ts), in the Readiness evidence: each line whole,
  // with the names it ends in. Whether the reach is knowable at all is the
  // contract's answer (Foundation A) — a scope this scan could not settle says so
  // in one line and shows no count.
  const { inline: whoInline, held: whoHeld } = whoBlocks(who, ex as Record<string, unknown>)
  const lead = whoLeadLine(who, ex as Record<string, unknown>, [...whoInline, ...whoHeld])
  const showWho = lead !== null || whoInline.length > 0 || (contract.who !== null && !contract.who.known)
  const whoFull = [...whoInline.map((b) => whoHeld.find((h) => h.key === b.key) ?? b), ...whoHeld.filter((h) => !whoInline.some((b) => b.key === h.key))]
  const pkgEvidence = pkgReadiness !== null && (pkgReadiness.conclusion !== null || pkgReadiness.whyItMatters !== null || pkgReadiness.unknowns.length > 0 || pkgReadiness.references.length > 0)
  const hasEvidence = contract.found.length > 0 || showWho || pkgEvidence
  // Readiness is the one prerequisite surface (A1 §16.1): the contract's own
  // fixes and the engine's blockers on the next action, one tile each, with the
  // package's gates merged in (stepPackage.ts mergeReadiness). Nothing below
  // lists a prerequisite a second time.
  const readiness = mergeReadiness(readinessOf(step, contract, blockers), pkgReadiness)
  const allTiles = [...readiness.tiles, ...readiness.satisfied]
  // What to do, where the step has instructions of its own. On a step whose
  // action IS the implementation the approved design draws no What to do: the
  // action is the Readiness bar's line and the instructions are the channels.
  const decides = Boolean(d) && (typeof d.applies !== 'string' || truthy(ex[d.applies]))
  const createIfNeeded = truthy(ex.createIfNeeded) && typeof w.createIfNeeded === 'string'
  const creates = (truthy(ex.needsCreate) || truthy(ex.createIfNeeded)) && Array.isArray(w.create)
  const implementing = packaged ? preview === null && (projection?.channels.length ?? 0) > 0 : Boolean(portal) && channels.length > 0
  const ownSteps = !implementing && (hasSteps || before.length > 0)
  const showWhatToDo = decides || createIfNeeded || creates || ownSteps
  // The one next action (stepContract.ts actionOf), drawn once: under the
  // Readiness bar where the step has no instructions of its own, and at the head
  // of What to do where it does, because there it leads the list it introduces.
  const actionLead = <WhatToDoLead contract={contract} />
  // What kind of step this is, and "Resolution step" for one whose source
  // contradicts itself (stepContract.ts eyebrowOf).
  const eyebrow = eyebrowOf(contract, typeof cs.kind === 'string' ? cs.kind : null)
  const textOf = (ch: Channel): string =>
    ch === 'portal'
      ? portalLines.map((l, i) => `${i + 1}. ${l}`).join('\n')
      : ch === 'ps'
        ? powershellFor(stepOperations(step))
        : ch === 'json'
          ? policyJsonText(step)
          : stepContext(step, (s) => stepExportView(s, ctx))
  // The channels the Implementation region draws: the package's projected
  // channels where a package is active, and otherwise the ones this step always
  // had. Never both.
  const artifacts: Artifact[] = packaged
    ? ((preview ?? projection)?.channels ?? []).map(packageArtifact)
    : channels.map((ch) => ({ id: ch, form: ch === 'portal' ? 'list' : 'code', lines: ch === 'portal' ? portalLines : [], text: () => textOf(ch), note: null }))
  const W = CONTRACT.implementation
  // What a preview says beside the planned work: that it is a preview, the values
  // still to resolve, and where the checks to confirm are. Never the blocker again.
  const previewNote = preview
    ? {
        label: W.preview.label,
        lines: [
          // Nothing to fix and nothing holding it: what stands between the step and
          // Copy is values IAMAI cannot fill, not prerequisites (correction batch 1).
          contract.fix.length === 0 && !contract.state.held ? W.preview.textValues : W.preview.text,
          ...(preview.hold && preview.hold.missingBindings.length > 0 ? [fillText(W.preview.values, { values: list([...new Set(preview.hold.missingBindings.map(bindingLabel))]) })] : []),
        ],
      }
    : null
  // A channel the package could not finish on its own (project.ts `degraded`) is
  // not offered, and nothing stands in for it (S6, A1 §16.2): a line that only
  // says a channel is missing is not implementation content, and whatever really
  // holds the step is a Readiness tile already.
  // A package the semantic re-pin review set aside (stepPackage.ts packageReviewFor):
  // the step draws the baseline's own channels, and says why, before anything else.
  const review = packageReviewFor(step)
  const notes = review ? [review.status === 'held' ? W.review.held : W.review.reviewNeeded] : []
  // A step with nothing to implement by design — a decision, a question, a check —
  // draws no Implementation region at all: its What to do is the work, and "No
  // generated implementation" beside it said nothing (owner, 2026-09-11). A policy
  // step keeps the region, with its planned work or the truthful reason it has none.
  const showImplementation = artifacts.length > 0 || contract.policy
  // A held projection says why, by the reason it holds: a check to confirm first,
  // a difference no correction covers, content the runtime could not project, or
  // a value IAMAI does not hold. None of them is ever offered an artifact.
  const hold = packaged ? (projection?.hold ?? null) : null
  const heldBox = (key: string): ImplementationEmpty => ({ key, tone: 'warn', title: W.empty[key][0], text: W.empty[key][1] })
  const empty: ImplementationEmpty =
    hold === null
      ? implementationEmptyOf(contract)
      : hold.pendingPrerequisites.length > 0
        ? heldBox('confirmationsPending')
        : hold.unknownMismatches.length > 0
          ? heldBox('correctionUnknown')
          : hold.invalid.length > 0
            ? heldBox('packageFault')
            : heldBox('bindingMissing')
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
  // The date the package's Microsoft sources were last checked (stepPackage.ts
  // packageSourceLine), or no line: never a pin, never a fabricated date (S6). A
  // package the re-pin review set aside keeps its date beside why it is set aside.
  const sourcePkg = pkg ?? (review ? reviewedPackageFor(step) : null)
  const sourceLine = sourcePkg ? packageSourceLine(sourcePkg, W) : null
  // The step's Microsoft Learn link (its content entry's `learn.url`): under
  // Implementation, beside Troubleshooting, where the region is drawn (S6), and
  // in Why on a step that draws no Implementation — one link per step.
  const learnUrl: string | null = typeof learn.url === 'string' && learn.url !== '' ? learn.url : null
  // The footer's rollout exception: the existing skip, offered only where the
  // step's content entry marks it excludable, and Doesn't apply here where the
  // step is flagged for it. A step already set aside offers the way back.
  const RO = CONTRACT.rollout
  const exceptions: ReactNode[] = printing
    ? []
    : step.status === 'skipped'
      ? [<Button key="put-back" variant="secondary" onClick={onUnskip}>{app.plan.putBack}</Button>]
      : [
          cs.skip ? <Button key="exclude" variant="secondary" className="rollout-exception" onClick={() => setDialog('rollout')}>{RO.control}</Button> : null,
          offersDoesntApply(cs, step) && onDoesntApply ? <Button key="doesnt-apply" variant="secondary" onClick={() => setDialog('doesnt-apply')}>{SHARED.doesntApplyControl}</Button> : null,
        ].filter((x) => x !== null)

  return (
    // The opened step, as the approved Plan design draws it
    // (docs/design/approved/anatomy/plan-step-v1.html `.step`): one frame attached
    // under the roadmap row that opened it, with the head above and the main
    // column and its Next milestone rail below.
    <article className="step panel panel-key">
      <StepHead eyebrow={eyebrow} title={title} sub={<>
            {/* The one supporting line the step already carried under its
                title: what this change is, and the step it is done with. */}
            <Line s={cs.changeLine} ex={ex} cls="step-sub" />
            <Line s={cs.partner} ex={ex} cls="step-sub partner" />
          </>} badge={badgeLabel(contract)} tone={contract.state.tone} track={contract.track}>
        {/* What happens next: the track caption, above the track it captions. */}
        <StepState contract={contract} />
        <PolicyMembers members={contract.members} />
      </StepHead>
      <div className="step-body has-rail">
        <div className="step-main">
          {/* The contract's Why: the step's own sentence where the content file
              has one, and the engine's where it does not. */}
          <section className="step-section">
            <h4>{HEAD.why}</h4>
            <p>
              {contract.why}{' '}
              {learnUrl && !showImplementation && (
                <a href={learnUrl} target="_blank" rel="noopener noreferrer">
                  Learn →
                </a>
              )}
            </p>
          </section>

          {/* Readiness: the one prerequisite surface. Every unresolved
              prerequisite of the next action is a tile — the state's own, the
              emergency boundary, each fix, each engine blocker, and last the
              hardening, secondary and never a block, with its recommendations
              and its deferral as the Resilience tile's own evidence — over the
              bar that says where the step stands with its one action under it,
              and — where this step's enforcement waits on the people it reaches —
              who they are, handed to MFA Readiness (derive/stepMfaReadiness.ts). */}
          <ReadinessSection
            readiness={readiness}
            lead={showWhatToDo ? null : actionLead}
            onWhy={hasEvidence && !printing ? () => setDialog('readiness') : null}
            onConfirm={!printing && onConfirm ? (key) => { setConfirmKey(key); setDialog('confirm') } : null}
            onOpenMappings={!printing && onOpenMappings ? onOpenMappings : null}
            printing={printing}
            extra={(t) =>
              t.key === 'resilience' && contract.hardening ? (
                <HardeningBody
                  hardening={contract.hardening}
                  onDefer={!printing && onConfirm ? () => onConfirm({ [HARDENING_DEFERRAL_ID]: { basis: contract.hardening!.basis } }) : null}
                  onUndo={!printing && onUnconfirm ? () => onUnconfirm([HARDENING_DEFERRAL_ID]) : null}
                />
              ) : null
            }
          >
            <MfaHandoff step={step} snapshot={ctx.snapshot} mapping={ctx.mapping} />
          </ReadinessSection>

          {/* The baseline defines this policy two ways (roadmap/baselineConflict.ts):
              the approved design's danger attention, under Readiness. The words
              belong to the reviewed source policy the step's own state names, and
              they are the content file's; nothing here composes them. */}
          {conflictWords && (
            <section className="step-section">
              <Callout kind="danger">
                <h4>{CONTRACT.attentionConflict}</h4>
                <p>
                  <T s={conflictWords} ex={ex} />
                </p>
              </Callout>
            </section>
          )}

          {showWhatToDo && (
            <section className="step-section">
              <h4>{HEAD.whatToDo}</h4>
              {actionLead}
              {/* The decision comes before the instructions, and on a step that
                  needs one it *is* the action: IAMAI cannot choose, so nothing is
                  offered to submit until a person has (Foundation C). */}
              {decides && <Decision d={d} ex={ex} saved={decision} onDecide={onDecide} stepId={step.id} ctx={ctx} />}
              {/* The create instructions. `needsCreate` is a proof that nothing
                  qualifies; `createIfNeeded` is the same instructions offered to
                  an operator who knows they need one (mapping/safetyChoice.ts). */}
              {createIfNeeded && <p className="reason"><T s={w.createIfNeeded} ex={ex} /></p>}
              {creates && <ol className="sections">{(w.create as unknown[]).map((l, i) => <li key={i}><T s={l} ex={ex} /></li>)}</ol>}
              {ownSteps && (
                <div className="instruction">
                  <ol className="sections">{[...before.map((l) => <>{l}</>), ...instructions.steps.map((l) => <T s={l} ex={ex} />)].map((node, i) => <li key={i}>{node}</li>)}</ol>
                </div>
              )}
            </section>
          )}

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
              onTroubleshooting={scenarios.length > 0 && !printing ? () => setDialog('troubleshooting') : null}
              open={dialog === 'implementation'}
              onOpen={() => setDialog('implementation')}
              onClose={closeDialog}
              copy={copyArtifact}
              copied={copied}
            />
          )}

          {/* Every step has a completion, and it is concrete (stepContract.ts doneWhenOf). */}
          <DoneWhen heading={HEAD.doneWhen} lines={contract.doneWhen} />

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
              {reason === null && datesLineFor(step, cs) && whole(datesLineFor(step, cs), ex) && (
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
                  ifWrong={reason === null ? ifWrongLineFor(step, cs) : null}
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
        {/* The rail belongs to this step: beside the main column at full width
            and under it once the body collapses to one column. It is the Next
            milestone and nothing else. */}
        <StepRail contract={contract} when={when} />
      </div>
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
            </div>
          </StepDialog>
          <StepDialog open={dialog === 'troubleshooting'} onClose={closeDialog} eyebrow={CONTRACT.troubleshooting.eyebrow} title={title} closeLabel={CONTRACT.troubleshooting.close}>
            <Troubleshooting scenarios={scenarios} />
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
 * implementation dialog. A step with no channel shows the one truthful no-action
 * box instead (stepContract.ts implementationEmptyOf) and never an artifact.
 *
 * The artifacts are their own modules' — the package's bound blocks
 * (project.ts), or the portal translator's lines, stepPowerShell.ts, stepJson.ts
 * and the prompts' step context — and nothing is composed here. The preview,
 * the expanded viewer and Copy read the same text.
 */
function Implementation({ artifacts, drawnBy, preview, notes, title, empty, source, learn, onTroubleshooting, open, onOpen, onClose, copy, copied }: {
  artifacts: Artifact[]
  /** Who draws the region: the step's implementation-content package, or the translator's own channels (stepPackage.ts packageDrawsImplementation). */
  drawnBy: 'package' | 'translator'
  /** A planning preview's note (stepPackage.ts planningPreview): the artifacts are the planned work and are not offered to copy. */
  preview: { label: string; lines: string[] } | null
  /** Why the package's own guidance is set aside (a re-pin review), where it is. */
  notes: string[]
  title: string
  empty: ImplementationEmpty
  /** "Source checked <date>", from the package's verified sources; null where there is no truthful date. */
  source: string | null
  /** The step's Microsoft Learn page, where its content entry names one. */
  learn: string | null
  onTroubleshooting: (() => void) | null
  open: boolean
  onOpen: () => void
  onClose: () => void
  copy: (id: string, text: string) => void
  copied: string | null
}) {
  const [chosen, setChosen] = useState<Channel>('portal')
  const base = useId()
  const dialogBase = useId()
  const W = CONTRACT.implementation
  const ids = artifacts.map((a) => a.id)
  // The chosen tab is clamped to what is available, so a step that offers only
  // some channels cannot be left showing another's panel — the frame is reused
  // across rows and the state is not.
  const tab: Channel = ids.includes(chosen) ? chosen : (ids[0] ?? 'portal')
  const active = artifacts.find((a) => a.id === tab) ?? null
  const tabs = CHANNEL_TABS.filter((t) => ids.includes(t.id as Channel))
  const body = (cls: string) =>
    active === null ? null : active.form === 'list' ? (
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
  const copyable = preview === null && active !== null
  const planning = preview && (
    <div className="impl-planning">
      <strong>{preview.label}</strong>
      {preview.lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  )
  return (
    <section className="step-section implementation-section" data-implementation={drawnBy} data-preview={preview ? 'true' : undefined}>
      <h4>{W.heading}</h4>
      {artifacts.length === 0 ? (
        <>
          <ImplementationEmptyBox empty={empty} />
          {/* Why the written guidance is set aside, where it is (a re-pin review), even with nothing to implement. */}
          {notes.length > 0 && (
            <div className="impl-planning" data-review="true">
              {notes.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {planning}
          {notes.length > 0 && (
            <div className="impl-planning" data-review="true">
              {notes.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </div>
          )}
          <TabList base={base} tabs={tabs} active={tab} onSelect={(id) => setChosen(id as Channel)} panelId={() => `${base}-panel`} className="tabs impl-tabs no-print" />
          {tab === 'ai' && (
            <div className="ai-warning">
              <Callout kind="warning">{W.aiWarning}</Callout>
            </div>
          )}
          <div className="impl-preview" {...onePanelProps(base, tab)}>
            <div className="preview-actions no-print">
              {/* A planning preview is not executable: it is never offered to copy. */}
              {copyable && (
                <button type="button" className="icon-btn" aria-label={W.copy} title={W.copy} onClick={() => copy('implementation', active?.text() ?? '')}>
                  <Icon name={copied === 'implementation' ? 'check' : 'copy'} size={14} />
                </button>
              )}
              <button type="button" className="icon-btn" aria-label={W.expand} title={W.expand} onClick={onOpen}>
                <Icon name="external-link" size={14} />
              </button>
            </div>
            {body('preview-text')}
          </div>
          {/* The expanded viewer (S6): the same channel the preview shows, the
              whole artifact at reading size, and a visible Copy where the
              artifact is copyable — never on a planning preview. */}
          <StepDialog open={open} onClose={onClose} eyebrow={W.dialogEyebrow} title={title} sub={tabs.find((t) => t.id === tab)?.label ?? null} closeLabel={W.close} wide>
            <div className="dialog-toolbar">
              <TabList base={dialogBase} tabs={tabs} active={tab} onSelect={(id) => setChosen(id as Channel)} panelId={() => `${dialogBase}-panel`} className="tabs impl-tabs" />
              {copyable && (
                <Button variant="secondary" icon={copied === 'implementation' ? 'check' : 'copy'} onClick={() => copy('implementation', active?.text() ?? '')}>
                  {W.copy}
                </Button>
              )}
            </div>
            {tab === 'ai' && (
              <div className="ai-warning">
                <Callout kind="warning">{W.aiWarning}</Callout>
              </div>
            )}
            {planning}
            {active?.note && <p className="impl-dialog-note">{active.note}</p>}
            <div {...onePanelProps(dialogBase, tab)}>{body('dialog-code')}</div>
          </StepDialog>
        </>
      )}
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
              {learn && onTroubleshooting && <span aria-hidden="true">·</span>}
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

function Decision(props: { d: Record<string, any>; ex: Ex; saved: StepDecision | null; onDecide?: (decision: StepDecisionInput) => void; stepId: string; ctx: StepVarContext }) {
  return <SingleDecision {...props} />
}

function SingleDecision({ d, ex, saved, onDecide, stepId, ctx }: { d: Record<string, any>; ex: Ex; saved: StepDecision | null; onDecide?: (decision: StepDecisionInput) => void; stepId: string; ctx: StepVarContext }) {
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
  const optionOf = (id: string): PickerOption => nominated.find((n) => n.id === id) ?? byId.get(id) ?? { id, name: ctx.nameOf(id) }
  const tickedOf = key ? ex[`${key}Ticked`] : undefined
  const initial: string[] = saved?.picked ?? (Array.isArray(tickedOf) ? (tickedOf as string[]) : single ? ids.slice(0, 1) : ids)
  const [chips, setChips] = useState<PickerOption[]>(() => initial.map(optionOf))
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const hasPicker = rows.length > 0 || universe.length > 0
  // The decision's own options, and its question under the picker: a whole
  // option is a radio; one that needs a value the scan cannot fill (the travel
  // countries, the mail-sending devices) is a picker of the step's kind, accounts
  // otherwise, and its chips are the answer. The question's answer persists as
  // questionAnswers[stepId:label] (decisions.ts).
  const options = optionsOf(d.options, ex)
  const question = questionFor(d, ex)
  const needsValue = options.some((o) => o.needs !== null) || (question?.options.some((o) => o.needs !== null) ?? false)
  const valueUniverse = useMemo(() => (needsValue ? pickerUniverse(stepId, valueSource(stepId), pickerCtx) : []), [needsValue, stepId, ctx.snapshot, ctx.mapping, ctx.nameOf, ctx.groups])
  const [option, setOption] = useState<string | null>(saved?.option ?? null)
  const [answer, setAnswer] = useState<string | null>(question ? (saved?.answers?.[question.label] ?? null) : null)
  // The strict toggle (the device decision's Block phones): off unless ticked;
  // its answer is its one option's words, under its own label.
  // `label` is the answer's key (questionAnswers[step:label]); `heading` is what the page shows over it, where the content names one.
  const strict = d.strict && typeof d.strict.label === 'string' && typeof d.strict.option === 'string' ? (d.strict as { label: string; option: string; heading?: string; text?: string; help?: string }) : null
  const [strictOn, setStrictOn] = useState<boolean>(strict ? saved?.answers?.[strict.label] === strict.option : false)
  const base = useId()
  const save = (): void =>
    onDecide?.({
      ...(hasPicker ? { picked: chips.map((c) => c.id) } : {}),
      ...(option !== null ? { option } : {}),
      ...(question && answer !== null ? { answers: { [question.label]: answer } } : {}),
      ...(strict && strictOn ? { answers: { ...(question && answer !== null ? { [question.label]: answer } : {}), [strict.label]: strict.option } } : {}),
    })
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
      {decisionAnswer === null && <Line s={decisionLine(d, null)} ex={ex} cls="reason" />}
      <div className="decision">
        {/* Each label is an element the controls under it can name (task 017):
            the picker takes it as its group label, the radios as their
            radiogroup's, so a decision is heard as a question with answers. */}
        <div className="dlabel" id={`${base}-decision`}>{d.label}</div>
        {/* Each part of a decision reads the same way: its heading, its question, its answers. */}
        {typeof d.text === 'string' && <p className="reason"><T s={d.text} ex={ex} /></p>}
        {hasPicker && <Picker labelledBy={`${base}-decision`} selected={chips} options={results} suggestions={nominated} onChange={setChips} onSearch={setQuery} single={single} />}
        {options.length > 0 && <Options name={answerKey(stepId, String(d.label))} labelledBy={`${base}-decision`} options={options} answer={option} onAnswer={setOption} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} />}
        {decisionAnswer !== null && <Line s={decisionLine(d, decisionAnswer)} ex={ex} cls="reason effect" />}
        {question && (
          <>
            <div className="dlabel" id={`${base}-question`}>{question.label}</div>
            <p className="reason"><T s={question.text} ex={ex} /></p>
            <Options name={answerKey(stepId, question.label)} labelledBy={`${base}-question`} options={question.options} answer={answer} onAnswer={setAnswer} ex={ex} universe={valueUniverse} nameOf={ctx.nameOf} />
            {questionEffect && whole(questionEffect, ex) && <p className="reason effect"><T s={questionEffect} ex={ex} /></p>}
          </>
        )}
        {strict && (
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
        <Button variant="secondary" onClick={save}>{d.save || 'Save'}</Button>
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
/** A decision's options: radios, or a picker where an option takes a value. Shared with Plan settings -> Baseline mappings. */
export function Options({ name, labelledBy, options, answer, onAnswer, ex, universe, nameOf, single = false }: { name: string; labelledBy: string; options: QuestionOption[]; answer: string | null; onAnswer: (answer: string | null) => void; ex: Ex; universe: PickerObject[]; nameOf: (id: string) => string; single?: boolean }) {
  const parts = answerParts(answer, options)
  const valued = options.find((o) => o.needs !== null) ?? null
  const [chips, setChips] = useState<PickerOption[]>(() => (parts?.option.needs ? parts.picked.map((id) => universe.find((u) => u.id === id) ?? { id, name: nameOf(id) }) : []))
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const pick = (next: PickerOption[]): void => {
    setChips(next)
    if (valued) onAnswer(next.length > 0 ? answerText(valued, next.map((c) => c.id)) : null)
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
            {before && <span className="reason">{fillText(before, ex as Record<string, unknown>)}</span>}
            <Picker selected={chips} options={results} suggestions={[]} onChange={pick} onSearch={setQuery} single={single} />
            {after && <span className="reason">{fillText(after, ex as Record<string, unknown>)}</span>}
          </div>
        )
      })}
    </div>
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
  const more = cs.more || {}
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const risks = (more.risks || []) as { text: string; applies?: string }[]
  const applies = risks.filter((r) => r.applies && truthy(ex[r.applies]))
  const rest = risks.filter((r) => !(r.applies && truthy(ex[r.applies])))
  const commsText = comms ? [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n') : null
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
          <p className="reason adapt no-print">{ADAPT_LINE}</p>
        </>
      )}
      {Array.isArray(more.helpDesk) && (more.helpDesk as unknown[]).filter((x) => whole(x, ex)).length > 0 && (
        <>
          <h4>{HEAD.helpDesk}</h4>
          <ul className="sections">{(more.helpDesk as unknown[]).filter((x) => whole(x, ex)).map((x, i) => <li key={i}><T s={x} ex={ex} /></li>)}</ul>
          <p className="reason adapt no-print">{ADAPT_LINE}</p>
        </>
      )}
      {managerText(cs, ex as Record<string, unknown>) !== null && (
        <>
          <h4>{HEAD.manager}</h4>
          {/* The three sentences, and the clause the records earn (managerNone under its applies, E9). */}
          <p className="reason">{managerText(cs, ex as Record<string, unknown>)}</p>
          <p className="actions"><Button variant="secondary" onClick={() => copy('manager', managerText(cs, ex as Record<string, unknown>) ?? '')}>{copied === 'manager' ? 'Copied' : 'Copy'}</Button></p>
          <p className="reason adapt no-print">{ADAPT_LINE}</p>
        </>
      )}
      {/* Skip, and beside it Doesn't apply here on the content steps flagged for it:
          never a foundation (emergency access, the exclusions group), never a policy
          step whose subject exists. Pressing it asks one line, required, that goes
          on the plan; the step then leaves its phase for the footer. */}
      {step.status !== 'skipped' && (
        <p className="actions">
          {cs.skip && <Button variant="tertiary" onClick={() => onSkip('Not needed for this tenant')}>Skip this step</Button>}
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

