import { requiredModels } from '../../roadmap/passkeySettings.ts'
import { emergencyAccountAiInfo, emergencyAccountPowerShell, emergencyImplementation } from './emergencyImplementation.ts'
import { emergencyAccountTasksOf } from './emergencyAccountTasks.ts'
import type { EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import { emergencyGroupTasksOf } from './emergencyGroupTasks.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { drawsTaskAnatomy, policyTasksOf } from './policyTasks.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { networkDraftOf } from '../../mapping/networkDraft.ts'
import { initialDomain } from '../../validation/rules.ts'
// The opened step's body, worked out once (A3): everything ContentStep.tsx draws
// that is not a React concern — the contract under the lane engine's reading,
// the instructions, the implementation channels and artifacts, the package's
// projection and readiness, the Readiness tiles, which sections the step draws
// and the words under Implementation when it draws none.
//
// Before this the block lived inside the component, so nothing outside a
// browser could say which sections a step draws or which channels it offers.
// The per-step snapshots (src/testing/stepSnapshots.ts) read it, and the
// component reads it, and neither decides anything the other does not see.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { fillText, whatToDoFor } from '../../content/render.ts'
import { baselineConflictWords } from '../../roadmap/baselineConflict.ts'
import { toReportOnly, unavailableReason } from '../../roadmap/operations.ts'
import { stepContext } from '../../roadmap/prompts.ts'
import { aiBriefingText, aiGroundingText } from './aiGrounding.ts'
import type { TabItem } from '../components/index.ts'
import { powershellFor } from './stepPowerShell.ts'
import { policyJsonText, stepOperations } from './stepJson.ts'
import { ifWrongLineFor, stepExportView } from './stepExport.ts'
import { stepVars, withoutScheduleDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor, unwrittenCorrectionLines } from './stepPortal.ts'
import { preparationLines, preparesWhileCreateWaits, rescanLinesOf, stepInstructions, wholeLines } from './stepInstructions.ts'
import { CONTRACT, SETTLED_FINDINGS, eyebrowOf, implementationEmptyOf, implementationIsCurrent, isReadinessWork, proceduresAreReference, railOf, readinessOf, stepContract } from './stepContract.ts'
import type { ImplementationEmpty, LaneView, PrerequisiteBlocker, PrerequisiteLabel } from './stepContract.ts'
import { boardHolds, laneViewAlone } from './planBoard.ts'
import { DECISION_HEAD, HEAD, taskHeadingsOf } from './stepHeadings.ts'
import { usesDecisionAnatomy } from '../../roadmap/stepGroups.ts'
import { directionMilestoneAction } from '../../roadmap/directionAnswers.ts'
import { whoBlocks, whoLeadLine } from './whoBlocks.ts'
import { BASELINE_COMMIT, artifactText, implementationPackageFor, mergeReadiness, packageBindings, packageDrawsImplementation, packageRuntime, packageSourceLine, packageStateOf, planningPreview, reviewedPackageFor, setupAfterEnforcementOf, sourceCheckedLine, entraWithSettings, jsonWithPlanTag } from './stepPackage.ts'
import { lifecycleResources, policyInspectionLines, resourceChannelAllowed, inspectionResource, emailResource, mfaPreparationEmail, deviceSetupResource, namedPortalResource, switchedOffRequest, switchedOffResources, withWorkflowVerification } from './stepResources.ts'
import { projectSafely, projectExplanation, readinessSafely, troubleshootingSafely } from '../../content/implementation/project.ts'
import type { ChannelArtifact, OutputChannel, OwnerConfirmation, TroubleshootingScenario } from '../../content/implementation/project.ts'

type Ex = Record<string, unknown>

const NO_CONFIRMATIONS: Readonly<Record<string, OwnerConfirmation>> = {}
const NO_BLOCKERS: readonly PrerequisiteBlocker[] = []

export type Channel = 'portal' | 'ps' | 'json' | 'ai' | 'email'

/**
 * One channel as the Implementation region draws it: the tab it sits under, how
 * its text is set, the text itself (read when shown, so a long artifact is not
 * built for a tab nobody opens), and the one line of support under the preview
 * that says how it is run.
 */
export type Artifact = { id: Channel; form: 'list' | 'code' | 'markdown'; lines: string[]; text: () => string; note: string | null; unavailable?: true }

/** A package's output channels under the viewer's own tab ids. */
const PACKAGE_CHANNEL: Record<OutputChannel, Channel> = { entra: 'portal', powershell: 'ps', json: 'json', aiInfo: 'ai', email: 'email' }

/**
 * A package channel as an artifact. The words are the package's, bound; the
 * support line is its own metadata — the modes a script's invocation runs it in
 * (content/implementation/invocation.ts), the request a JSON body is sent with —
 * and never a sentence written here.
 */
function packageArtifact(a: ChannelArtifact, ground: ((own: string) => string) | null = null): Artifact {
  const W = CONTRACT.implementation
  const note =
    a.channel === 'powershell' && a.runs.length > 0
      ? fillText(W.powershellInvocation, { modes: [...new Set(a.runs.map((r) => r.mode))].join(', ') })
      : a.channel === 'json' && a.requests.length > 0
        ? a.requests.map((r) => `${r.method} ${r.endpoint}`).join(' · ')
        : null
  // AI Info carries IAMAI's facts for the step after the package's own words (aiGrounding.ts),
  // so the assistant it is handed to needs no screen. A package AI Info with no words of its
  // own stays empty: the facts never stand in for a channel the package did not produce.
  const own = artifactText(a, W.aiWarning)
  const facts = a.channel === 'aiInfo' && ground !== null && own.trim() !== '' ? ground(own) : ''
  const text = facts === '' ? own : aiBriefingText(own, facts)
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
export const CHANNEL_TABS: TabItem[] = [
  { id: 'portal', label: CONTRACT.railChannels.portal },
  { id: 'ps', label: CONTRACT.railChannels.powershell },
  { id: 'json', label: CONTRACT.railChannels.json },
  { id: 'ai', label: CONTRACT.implementation.ai },
  { id: 'email', label: CONTRACT.implementation.email },
]

/** The tabs the Implementation region draws for these artifacts, in the approved order. */
export function channelTabsOf(artifacts: readonly Artifact[]): TabItem[] {
  const ids = artifacts.map((a) => a.id)
  return CHANNEL_TABS.filter((t) => ids.includes(t.id as Channel))
}

/** A content value that is present: a non-empty list or string, a non-zero number, or true. */
export const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))

export type StepBodyOptions = {
  /** The board's one state reading of this step (planBoard.ts laneViewOf, A1b decision 1); a caller with no board gets the engine's reading of the step on its own. */
  lane?: LaneView | null
  /** The engine's unresolved prerequisites of this step's next action (planBoard.ts readinessBlockersOf). */
  blockers?: readonly PrerequisiteBlocker[]
  /** A prerequisite tile's label by the prerequisite's own lane (planBoard.ts prerequisiteLabelFor, decision 12); null keeps the tiles' own labels. */
  prerequisiteLabel?: PrerequisiteLabel | null
  /** This step's owner confirmations of the checks IAMAI cannot read, by prerequisite id (roadmap/decisions.ts). */
  confirmations?: Readonly<Record<string, OwnerConfirmation>>
  /** The baseline commit implementation content is matched against: this build's pin, always, on every product surface. */
  baselineCommit?: string
  /**
   * Work the enforce checklist's own conditions depend on that is not a
   * prerequisite of this step's NEXT action, by title.
   *
   * The checklist says "Emergency access is prepared and tested." and the thing
   * that tests it is a Cleanup row, not a step, so nothing on the card named
   * it: a reader went looking for a step called something like that, did not
   * find one, and carried on. The engine does make the drill a hard
   * prerequisite of every policy's ENFORCEMENT (dependency-data.json), but a
   * step being created today is not enforcing today, so it is not among
   * `blockers` — and the checklist is precisely about the day it will be.
   */
  enforceWaits?: readonly string[]
}

/** The opened step's body: every value the component draws, decided once here. */
export function stepBodyOf(step: Step, ctx: StepVarContext, o: StepBodyOptions = {}) {
  const lane = o.lane ?? null
  const blockers = o.blockers ?? NO_BLOCKERS
  const prerequisiteLabel = o.prerequisiteLabel ?? null
  const confirmations = o.confirmations ?? NO_CONFIRMATIONS
  const baselineCommit = o.baselineCommit ?? BASELINE_COMMIT
  // The content step (resolved the same way the plan row resolves its title).
  // The step's own words, where the content file has any. A step it has no entry
  // for is not a step without a body: the contract still knows where it is, why
  // it matters and what to do next, and this renders that.
  const cs = (contentStepFor(step) ?? {}) as Record<string, any>
  // Whether the board holds the step (planBoard.ts boardHolds), on the reading
  // the board handed down: a held step carries no date anywhere, so its words
  // lose the days the plan scheduled for it and its contract names none (owner
  // decision 2, 2026-09-22). A step opened with no board is never held.
  const undated = boardHolds(step, lane)
  const ex = (undated ? withoutScheduleDates(stepVars(step, ctx), step, ctx) : stepVars(step, ctx)) as Ex
  // The Step Contract (stepContract.ts): the state, the next milestone, the one
  // action, the blockers and the completion, worked out once from Foundations A,
  // B and C, with the lane engine's reading of the step as its one state (A1b).
  // Everything below renders it; nothing below asks them again. No lane handed
  // down is a step opened with nothing around it (planBoard.ts laneViewAlone);
  // every surface that draws a step hands down the board's. The board's answer
  // to where a held chain starts goes into the contract, not the card alone, so
  // the Threshold card, its finding and the AI Info briefing agree (R4-33).
  const laneView = lane ?? laneViewAlone(step)
  const contract = stepContract(step, ctx, ex as Record<string, unknown>, laneView, prerequisiteLabel?.startOf, undated)
  // The one title, from the one resolver the row reads (content/stepTitle.ts), so
  // the row and the body it opens can never disagree.
  const title = contentTitle(step)
  const learn = cs.learn || {}
  const who = cs.who || {}
  const d = cs.decision
  // The What to do for the state the scan read (content/render.ts whatToDoFor).
  const w = whatToDoFor(cs, ex) || {}
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
  const deployNow = cs.kind !== 'policy' || implementationIsCurrent(step)
  const manualLines = cs.kind !== 'policy' ? instructions.steps : []
  const hasPortal = (portal !== null && portal.length + before.length > 0) || manualLines.length > 0
  const channels = step.directionQuestions ? ['ai' as Channel] : deployNow ? channelsFor(hasPortal, contract.implementation.offered) : []
  const portalLines = hasPortal ? [...before, ...(portal ?? manualLines)] : []
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
  // What the step says about consequence rather than about the next action now
  // stands behind "Why IAMAI says this" (owner, 2026-09-20), so a step that
  // carries it opens the dialog even where the scan found nothing to state.
  // Before, that content was reachable only by printing the plan.
  const more = (cs?.more ?? {}) as { risks?: unknown[]; helpDesk?: unknown[]; manager?: unknown }
  const hasReading = (more.risks?.length ?? 0) > 0 || (more.helpDesk?.length ?? 0) > 0 || more.manager !== undefined || cs?.lockedOut !== undefined
  const hasEvidence = contract.found.length > 0 || showWho || pkgEvidence || hasReading
  // Readiness is the one prerequisite surface (A1 §16.1): the contract's own
  // fixes and the engine's blockers on the next action, one tile each, with the
  // package's gates merged in (stepPackage.ts mergeReadiness). Nothing below
  // lists a prerequisite a second time.
  const readiness = mergeReadiness(readinessOf(step, contract, blockers, prerequisiteLabel ?? undefined, { setupAfterEnforcement: setupAfterEnforcementOf(step) !== null }), pkgReadiness)
  const allTiles = [...readiness.tiles, ...readiness.satisfied]
  // The step's own instructions — its decision, its create lines, its own steps —
  // were What to do, and no step draws What to do (U1, RUN-CONTEXT-B decision 1).
  // The decision's controls are the action column's (U2); the prose stays in the
  // content for the per-step pass to move into Implementation. The one next
  // action stays under the Readiness bar on a step whose action it was, and
  // leaves with What to do where it led instructions.
  const decides = Boolean(d) && (typeof d.applies !== 'string' || truthy(ex[d.applies]))
  const createIfNeeded = truthy(ex.createIfNeeded) && typeof w.createIfNeeded === 'string'
  const creates = (truthy(ex.needsCreate) || truthy(ex.createIfNeeded)) && Array.isArray(w.create)
  const implementing = packaged ? preview === null && (projection?.channels.length ?? 0) > 0 : Boolean(portal) && channels.length > 0
  const ownSteps = !implementing && (hasSteps || before.length > 0)
  const instructed = decides || createIfNeeded || creates || ownSteps
  // The milestone the action column leads with, over the package's own words for
  // it or none (stepContract.ts railOf, U3).
  // The rail's sub-line: the package's own action text, or — on a Direction
  // step, which has no package — the sentence its content writes for what
  // approving its answers does. Both are written; neither is composed here
  // (stepLayout.test.ts U3).
  const rail = railOf(contract, pkg?.meta.milestone?.actionText ?? directionMilestoneAction(step.id))
  // What kind of step this is, and "Resolution step" for one whose source
  // contradicts itself (stepContract.ts eyebrowOf).
  const eyebrow = eyebrowOf(contract, typeof cs.kind === 'string' ? cs.kind : null)
  // IAMAI's facts for this step (aiGrounding.ts): one grounding for a package's AI Info and
  // for the step's own, so both hand an assistant the same facts.
  // The request the briefing describes is the JSON channel the package projects, or previews, for this state.
  // Where the step's preparation stands in for the package's procedure while a
  // reason holds the policy (stepInstructions.ts preparationLines), the package's
  // create is withheld from every channel: the JSON channel only reads, and AI
  // Info described "This state creates two guest MFA policies" with the batch
  // POST beside it (Phase 2 export finding 4). It hands over the step's own brief.
  const createWithheld = preparationLines(step, cs, true) !== null
  const jsonChannel = createWithheld ? null : (preview ?? projection)?.channels.find((a) => a.channel === 'json') ?? null
  // A policy the tenant has switched off hands over the patch that sets it to
  // Report-only, and the briefing describes that request: the package's own
  // JSON for this state is the create, or a pair's turn-on
  // (stepResources.ts switchedOffResources).
  const reportOnly = cs.kind === 'policy' && toReportOnly(step).length > 0
  const offRequest = reportOnly ? switchedOffRequest(step, ctx) : null
  const groundingJson = offRequest
    ? { text: offRequest.text, requests: offRequest.requests, preview: false }
    : reportOnly ? null
      : jsonChannel ? { text: jsonChannel.text, requests: jsonChannel.requests, preview: preview !== null } : null
  const grounding = (own: string): string => aiGroundingText({ step, ctx, contract, lane: laneView, cs, ex: ex as Record<string, unknown>, bindings: pkgBindings as Record<string, unknown> | null, json: groundingJson, startOf: prerequisiteLabel?.startOf }, own)
  const textOf = (ch: Channel): string =>
    ch === 'portal'
      ? portalLines.map((l, i) => `${i + 1}. ${l}`).join('\n')
      : ch === 'ps'
        ? powershellFor(stepOperations(step))
        : ch === 'json'
          ? policyJsonText(step)
          : ((facts) => (facts !== '' ? aiBriefingText('', facts) : stepContext(step, (s) => stepExportView(s, ctx, laneView, prerequisiteLabel?.startOf))))(grounding(''))
  // The channels the Implementation region draws: the package's projected
  // channels where a package is active, and otherwise the ones this step always
  // had. Never both.
  // Policy artifacts use the resolved operation. Supporting steps retain the
  // substantive formats their package defines, including inspection resources.
  const machine = cs.kind === 'policy'
  const shownProjection = preview ?? projection
  // A package channel whose every line waited on a value IAMAI does not hold (the AI
  // Info shared warning aside) has no content: it is not drawn as a blank tab.
  const produced: Artifact[] = (
    packaged
      ? (shownProjection?.channels ?? []).map((a) => packageArtifact(a.channel === 'entra' && machine && shownProjection ? { ...a, text: entraWithSettings(a.text, step, ctx, contract, shownProjection) } : a.channel === 'json' && machine ? { ...a, text: jsonWithPlanTag(a.text, step) } : a, grounding)).filter((a) => a.text().trim() !== '')
      : channels.map((ch): Artifact => ({ id: ch, form: ch === 'portal' ? 'list' : 'code', lines: ch === 'portal' ? portalLines : [], text: () => textOf(ch), note: null }))
  ).filter((a) => resourceChannelAllowed(step, a.id))
    // A policy the tenant has switched off keeps no channel that would build one.
    //
    // The step's own answer is "set the one that is there to Report-only"
    // (operations.ts toReportOnly), and the package's blocked projection is
    // still the create procedure — "Open Entra ID > Conditional Access >
    // Policies > New policy" — because no package authors a switched-off
    // block. Following that tab makes the second policy this whole fix exists
    // to prevent. A pair's package projects its create of both, or its
    // turn-on of both, which takes the one that is Off straight to On. Nor do
    // the step's preparation lines replace it (stepInstructions.ts
    // preparationLines).
    //
    // `missing-object` renders the same procedure on twenty-four steps and is
    // right to where the policy genuinely is not in the tenant yet. Where the
    // step's policy is there and Off, it rendered the create beside it; it
    // hands over the Report-only procedure too (operations.ts toReportOnly).
    //
    // What it keeps instead says the one change, the same on every channel: set
    // each policy that is Off to Report-only, never straight to On (owner,
    // 2026-09-23). The portal lines, and the one-field patches as JSON and
    // PowerShell (stepResources.ts switchedOffResources).
    .filter((a) => !reportOnly || !['portal', 'ps', 'json'].includes(a.id))
  if (reportOnly) produced.push(...switchedOffResources(step, ctx, String(ex.tenant ?? '')))
  // Keep every substantively supported lifecycle format. Fill missing machine
  // projections with clearly labelled inspection, never a placeholder message.
  const supported = new Set<Channel>(pkg ? Object.values(pkg.blocks).map((b) => PACKAGE_CHANNEL[b.meta.channel as OutputChannel]).filter((ch): ch is Channel => Boolean(ch) && resourceChannelAllowed(step, ch)) : machine ? ['portal', 'ps', 'json', 'ai'] : channels)
  const resources = pkg && pkgState && pkgBindings && pkgRuntime ? lifecycleResources(pkg, pkgState, pkgBindings, pkgRuntime.runtime) : []
  for (const resource of resources) {
    const artifact = packageArtifact(resource, grounding)
    if (resourceChannelAllowed(step, artifact.id) && !produced.some(a => a.id === artifact.id) && artifact.text().trim()) produced.push(artifact)
  }
  // A policy step whose package drew no Entra procedure — its projection has
  // none, and no lifecycle resource holds every value it names — hands over the
  // step's own resolved lines, the translator's create with the plan tag, as
  // the export does (stepExport.ts: `portal` while the implementation is
  // current). With one of the guests pair resolved, the lifecycle channel is
  // dropped for the name IAMAI does not hold (stepResources.ts), and the screen
  // then fell through to the content's preparation lines while the export, the
  // print, the prompt pack and the AI Info's intended result carried the create:
  // two instructions for one step. The preparation lines stay for a step that
  // has no resolved operation to offer.
  if (machine && reason === null && deployNow && portalLines.length > 0 && !produced.some(a => a.id === 'portal') && resourceChannelAllowed(step, 'portal')) {
    supported.add('portal')
    produced.push({ id: 'portal', form: 'list', lines: portalLines, text: () => portalLines.map((line, index) => `${index + 1}. ${line}`).join('\n'), note: null })
  }
  const explanations = pkg && pkgState && pkgBindings && pkgRuntime ? projectExplanation(pkg, pkgState, pkgBindings, pkgRuntime.runtime).channels : []
  for (const explanation of explanations) {
    const artifact = packageArtifact(explanation, grounding)
    if (!produced.some((a) => a.id === artifact.id) && artifact.text().trim() !== '') produced.push(artifact)
  }
  // An explanatory-only package must not replace a supporting step's existing
  // portal instructions with an unavailable placeholder.
  if (!machine && !step.directionQuestions && portalLines.length > 0 && !produced.some(a => a.id === 'portal')) {
    supported.add('portal')
    produced.push({ id: 'portal', form: 'list', lines: portalLines, text: () => portalLines.map((line, index) => `${index + 1}. ${line}`).join('\n'), note: null })
  }
  // Keep each validated model on its own copyable line without allowing arbitrary
  // tenant text to inject new template lines or script content.
  if (step.id === 's-prereq-passkey-settings') {
    const portal = produced.find(a => a.id === 'portal')
    const modelLines = requiredModels(ctx.mapping).map(model => `- ${oneLine(model.name)} — ${model.aaguid}`)
    if (portal) { const original = portal.text(); portal.text = () => original.replace(modelLines.join(' '), modelLines.join('\n')) }
  }
  // Every step can explain its purpose, facts, decisions and remaining work,
  // even when no executable change can be offered yet.
  if (createWithheld) for (let i = produced.length - 1; i >= 0; i--) if (produced[i].id === 'ai') produced.splice(i, 1)
  supported.add('ai')
  if (!produced.some((a) => a.id === 'ai')) produced.push({ id: 'ai', form: 'code', lines: [], text: () => aiBriefingText('', grounding('')), note: null })
  if (step.id === 's-prereq-break-glass') supported.delete('email')
  // Preparation is useful even when the executable policy cannot yet be built.
  // It does not replace a resolved operation or bypass its prerequisites.
  // The rule is the export's too (stepInstructions.ts preparationLines).
  const preparation = preparationLines(step, cs, produced.some(a => a.id === 'portal'))
  if (preparation !== null) {
    const lines = preparation
    const previous = produced.findIndex(a => a.id === 'portal')
    if (previous >= 0) produced.splice(previous, 1)
    produced.push({ id: 'portal', form: 'list', lines, text: () => lines.map((line: string, index: number) => `${index + 1}. ${line}`).join('\n'), note: null })
    supported.add('portal')
  }
  if (step.id === 's-prereq-trusted-location') {
    const draft = networkDraftOf(ctx.mapping)
    const portal = produced.find(a => a.id === 'portal')
    if (draft && portal && !step.state.satisfied) {
      const intro = `Saved office network: ${draft.name}. Public IP ranges: ${draft.ranges.join(', ')}.`
      const original = portal.text
      portal.text = () => `${intro}\n\n${original()}`
      if (portal.form === 'list') portal.lines = [intro, ...portal.lines]
    }
  }
  if (step.id === 's-prereq-auth-strength' && step.state.satisfied) {
    const lines = ['An existing authentication strength already matches the baseline’s method combinations and restrictions. No new strength is needed.', 'Keep that strength in place. Scan again after any authentication-strength changes to verify it still matches.']
    for (let i = produced.length - 1; i >= 0; i--) if (['portal', 'ps', 'json'].includes(produced[i].id)) produced.splice(i, 1)
    produced.push({id: 'portal', form: 'list', lines, text: () => lines.join('\n'), note: null})
    supported.add('portal')
  }
  for (const channel of [...supported]) if (!resourceChannelAllowed(step, channel)) supported.delete(channel)
  // A retained format always contains actual work or inspection, never a message
  // saying the format has nothing to offer. Resolved mutations remain first choice.
  for (const channel of ['ps', 'json'] as const) {
    const index = produced.findIndex(a => a.id === channel)
    const unresolved = index >= 0 && /‹[^›]+›/.test(produced[index].text())
    if (unresolved) produced.splice(index, 1)
    if (supported.has(channel) && !produced.some(a => a.id === channel)) produced.push(inspectionResource(step, channel))
  }
  if (supported.has('email')) {
    const existing = produced.findIndex(a => a.id === 'email')
    if (existing >= 0) produced.splice(existing, 1)
    produced.push(step.id === 's-verify-mfa' ? mfaPreparationEmail(ctx) : emailResource(step, ctx, contract.why))
  }
  if (step.id === 's-verify-mfa') {
    // Each list's promise that a scan shows progress follows it, while a scan can (stepInstructions.ts rescanLinesOf, R4-20).
    const rescan = rescanLinesOf(step, cs)
    const lines = wholeLines([...(Array.isArray(w.steps) ? w.steps : []), ...rescan.steps, ...(Array.isArray(w.generic) ? w.generic : []), ...rescan.generic], ex).filter(line => line.trim())
    for (const channel of ['portal', 'ps', 'ai'] as const) {
      const existing = produced.findIndex(a => a.id === channel)
      if (existing >= 0) produced.splice(existing, 1)
      supported.add(channel)
    }
    produced.push({ id: 'portal', form: 'list', lines, text: () => lines.map((line, i) => `${i + 1}. ${line}`).join('\n'), note: null })
    produced.push(inspectionResource(step, 'ps'))
    produced.push({ id: 'ai', form: 'markdown', lines: [], text: () => aiBriefingText('Help prepare the people in this plan for their actual MFA requirements. Explain who needs a method, which registered methods satisfy their target, and who needs help. Distinguish registered-method readiness from a tested workflow. Explain useful Microsoft Authenticator registration-campaign options without claiming a campaign object is required or already configured.', grounding('')), note: null })
  }
  if (step.id === 's-prereq-device-plan') {
    const existing = produced.findIndex(a => a.id === 'portal')
    if (existing >= 0) produced.splice(existing, 1)
    supported.add('portal')
    produced.push(deviceSetupResource(ctx))
  }
  if (supported.has('portal') && !produced.some(a => a.id === 'portal')) {
    // A create that waits on device readiness hands over its preparation, the
    // content's "before" lines, where another held policy is inspected
    // (stepInstructions.ts preparesWhileCreateWaits), and the Implementation
    // Task drawn from this tab is that preparation.
    const preparation = preparesWhileCreateWaits(step, cs) ? before : []
    const lines = portalLines.length ? portalLines : preparation.length ? preparation : policyInspectionLines(step)
    produced.push({ id: 'portal', form: 'list', lines, text: () => lines.map((line, i) => `${i + 1}. ${line}`).join('\n'), note: null })
  }
  // A part of the policy IAMAI does not write that the scan found is not what the
  // plan asked for: the portal names it, with the plan's value where the plan
  // sets one, before whatever else it says (stepPortal.ts unwrittenCorrectionLines).
  const correction = machine ? unwrittenCorrectionLines(step, portalNames, String(ex.tenant ?? '')) : []
  const portalArtifact = produced.find((a) => a.id === 'portal')
  if (correction.length > 0 && portalArtifact) {
    const original = portalArtifact.text
    if (portalArtifact.form === 'list') {
      const lines = [...correction, ...portalArtifact.lines]
      portalArtifact.lines = lines
      portalArtifact.text = () => lines.map((line, i) => `${i + 1}. ${line}`).join('\n')
    } else portalArtifact.text = () => `${correction.join('\n\n')}\n\n${original()}`
  }
  const accountTasks = step.id === 's-prereq-break-glass' ? emergencyAccountTasksOf(step, ctx) : null
  const emergencyAccountTasks = accountTasks
    ?? (step.id === 's-prereq-exclusion-group' ? emergencyGroupTasksOf(step, ctx)
      : step.id === 's-prereq-passkey-settings' ? emergencyPasskeyTasksOf(step, ctx)
        : null)
  const emergencyPortal = emergencyImplementation(step, ctx, accountTasks)
  if (emergencyPortal !== null) {
    for (let i = produced.length - 1; i >= 0; i--) if (produced[i].id === 'portal') produced.splice(i, 1)
    supported.add('portal')
    produced.push({ id: 'portal', form: 'markdown', lines: [], text: () => emergencyPortal, note: null })
  }
  if (step.id === 's-prereq-break-glass' && accountTasks) {
    const powershell = produced.find(a => a.id === 'ps')
    if (powershell) powershell.text = () => emergencyAccountPowerShell(initialDomain(ctx.snapshot))
    const ai = produced.find(a => a.id === 'ai')
    if (ai) ai.text = () => emergencyAccountAiInfo(step, ctx, accountTasks)
  }
  const artifacts: Artifact[] = CHANNEL_TABS.filter(t => supported.has(t.id as Channel)).flatMap(t => produced.filter(a => a.id === t.id).slice(0, 1)).map(a => withWorkflowVerification(namedPortalResource(a, ctx), step, ctx.mapping))
  // Every step that carries work draws the Emergency Access task anatomy
  // (policyTasks.ts, owner 2026-09-19): its Implementation Tasks are the portal
  // procedure the channel above already carries — the policy create, the portal
  // path that makes the object, the campaign's preparation, the review's reading
  // — so the task frame draws exactly what this step drew. The four Emergency
  // Access steps keep their own producers above and are never this.
  const outstandingForEnforce = [...new Set([...blockers.map((b) => b.title ?? b.label).filter((x): x is string => typeof x === 'string' && x.length > 0), ...(o.enforceWaits ?? [])])]
  const taskProjection: EmergencyTaskProjection | null = emergencyAccountTasks ?? (drawsTaskAnatomy(step.id) ? policyTasksOf(step, title, artifacts, ctx.mapping, outstandingForEnforce) : null)
  // A finished step's procedures are reference, not instructions.
  //
  // They stay on purpose (emergencyAccountTasks.ts: "with none needing any,
  // every change stays available as a reference") and they are typeset as
  // commands, so a step reading Completed drew three task blocks of eight,
  // nine and ten imperative lines and a reader took them for work that
  // remained. The words do not change; what changes is whether they are open.
  // The board's own reading, so the page and the row cannot disagree about
  // whether this step is finished.
  const implementationReference = taskProjection !== null && proceduresAreReference(laneView)
  const W = CONTRACT.implementation
  // Guidance stays copyable. Concrete unresolved findings remain in Readiness.
  const previewNote = null as { lines: string[] } | null
  // A channel the package could not finish on its own (project.ts `degraded`) is
  // not offered, and nothing stands in for it (S6, A1 §16.2): a line that only
  // says a channel is missing is not implementation content, and whatever really
  // holds the step is a Readiness tile already.
  // A package the semantic re-pin review set aside (stepPackage.ts packageReviewFor):
  // the step draws the baseline's own channels. A step the baseline defines two
  // ways draws no channels at all, so it says nothing about where they come from
  // (content review S4).
  const notes: string[] = []
  // Every step draws its Implementation region, a decision, a question and a check
  // included (content review D2, which replaces the owner's 2026-09-11 rule that a
  // step with nothing to implement by design draws none).
  const showImplementation = artifacts.length > 0 && !usesDecisionAnatomy(step.id)
  // A held projection says why, by the reason it holds: a check to confirm first,
  // a difference no correction covers, content the runtime could not project, or
  // a value IAMAI does not hold. None of them is ever offered an artifact.
  const hold = packaged ? (projection?.hold ?? null) : null
  const heldBox = (key: string): ImplementationEmpty => ({ key, tone: 'warn', title: W.empty[key][0], text: W.empty[key][1] })
  // The open Readiness work a delivered step still waits on: the cards that
  // are work (stepContract.ts isReadinessWork, never the people card), less a
  // fact the finished step states and nothing in Readiness can clear (a policy
  // that went live unwatched, a tenant's own policy that differs from the
  // baseline's, a baseline grant below the goal's floor: SETTLED_FINDINGS).
  const openWork = readiness.tiles.filter((t) => isReadinessWork(t) && !SETTLED_FINDINGS.has(t.key)).length
  const empty: ImplementationEmpty =
    hold === null
      ? implementationEmptyOf(contract, openWork)
      : hold.pendingPrerequisites.length > 0
        ? heldBox('confirmationsPending')
        : hold.unknownMismatches.length > 0
          ? heldBox('correctionUnknown')
          : hold.invalid.length > 0
            ? heldBox('packageFault')
            : heldBox('bindingMissing')
  // The date the step's Microsoft sources were last checked (stepPackage.ts
  // sourceCheckedLine), or no line: never a pin, never a fabricated date (S6).
  // Every step that shows a Learn link shows the date it was checked beside it
  // (owner, 2026-09-20), and there are two ways to hold one. A package the
  // re-pin review set aside keeps its date: when its sources were checked is a
  // fact about the pages, not about whether its guidance applies, so a baseline
  // conflict does not take the date away either (quality audit §2.5). A step with
  // no package at all carries the date on its own Learn entry (`learn.checkedOn`),
  // which is where a generated row records what its wave spec dated.
  const sourcePkg = pkg ?? reviewedPackageFor(step)
  const sourceLine = sourcePkg ? packageSourceLine(sourcePkg, W) : sourceCheckedLine(typeof learn.checkedOn === 'string' ? learn.checkedOn : null, W)
  // The step's Microsoft Learn link (its content entry's `learn.url`): at the end
  // of Why on every step (RUN-CONTEXT-B decision 14), and under Implementation,
  // beside Troubleshooting, where the region is drawn (S6).
  const learnUrl: string | null = typeof learn.url === 'string' && learn.url !== '' ? learn.url : null
  // The way back, for the state the scan read (stepExport.ts ifWrongLineFor):
  // decided here once, so the opened step and its printed copy draw the line the
  // exports carry. None while a reason holds the policy: nothing is rolled out.
  const ifWrong = reason === null ? ifWrongLineFor(step, cs, ex as Record<string, unknown>) : null
  return {
    cs,
    ex,
    laneView,
    contract,
    title,
    d,
    w,
    instructions,
    before,
    reason,
    conflictWords,
    pkg,
    pkgBindings,
    pkgRuntime,
    pkgReadiness,
    scenarios,
    packaged,
    whoInline,
    whoHeld,
    lead,
    showWho,
    whoFull,
    hasEvidence,
    readiness,
    allTiles,
    decides,
    createIfNeeded,
    creates,
    ownSteps,
    instructed,
    rail,
    eyebrow,
    artifacts,
    emergencyAccountTasks: taskProjection,
    implementationReference,
    previewNote,
    notes,
    showImplementation,
    empty,
    sourceLine,
    learnUrl,
    ifWrong,
  }
}

export type StepBody = ReturnType<typeof stepBodyOf>

/**
 * The section headings the opened step draws, in the order the component draws
 * them (ContentStep.tsx, the canonical order planAnatomy.test.ts asserts): Why
 * and Readiness always; the conflict attention where the source contradicts
 * itself; Implementation where the step offers or owes one; Done when where the
 * contract has lines. No step draws What to do (U1).
 *
 * A step drawn with the task anatomy — an Establish Emergency Access step, and
 * since 2026-09-19 every step that carries work — names those same four sections its own
 * way (stepHeadings.ts taskHeadingsOf), and this says what the step draws, so it
 * says those. Without this the step-snapshot corpus recorded "Why, Readiness,
 * Implementation, Done when" for every one of them while the screen read "About
 * this Step, Tasks Remaining, Implementation Tasks, Completion Criteria", which
 * is the one thing a snapshot of a rendered step must not do.
 */
export function headingsOf(b: StepBody): string[] {
  // A decision-anatomy step (Decide Your Tenant's Direction) draws its own three: nothing is built.
  if (usesDecisionAnatomy(b.contract.id)) return [DECISION_HEAD.why, DECISION_HEAD.questions, ...(b.contract.doneWhen.length > 0 ? [DECISION_HEAD.doneWhen] : [])]
  const task = taskHeadingsOf(b.contract.id)
  return [
    task?.why ?? HEAD.why,
    task?.remaining ?? CONTRACT.readiness.heading,
    ...(b.conflictWords ? [CONTRACT.attentionConflict] : []),
    ...(b.showImplementation ? [task?.implementation ?? CONTRACT.implementation.heading] : []),
    ...(b.contract.doneWhen.length > 0 ? [task?.doneWhen ?? HEAD.doneWhen] : []),
  ]
}
