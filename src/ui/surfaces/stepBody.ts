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
import { fillText } from '../../content/render.ts'
import { baselineConflictWords } from '../../roadmap/baselineConflict.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { stepContext } from '../../roadmap/prompts.ts'
import { aiBriefingText, aiGroundingText } from './aiGrounding.ts'
import type { TabItem } from '../components/index.ts'
import { powershellFor } from './stepPowerShell.ts'
import { policyJsonText, stepOperations } from './stepJson.ts'
import { stepExportView } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { CONTRACT, eyebrowOf, implementationEmptyOf, implementationIsCurrent, railOf, readinessOf, stepContract } from './stepContract.ts'
import { FEEDBACK_ADDRESS } from '../../feedback.ts'
import type { ImplementationEmpty, LaneView, PrerequisiteBlocker } from './stepContract.ts'
import { laneViewFor } from './planBoard.ts'
import { HEAD } from './stepHeadings.ts'
import { whoBlocks, whoLeadLine } from './whoBlocks.ts'
import { BASELINE_COMMIT, artifactText, implementationPackageFor, mergeReadiness, packageBindings, packageDrawsImplementation, packageReviewFor, packageRuntime, packageSourceLine, packageStateOf, planningPreview, previewNoteLines, reviewedPackageFor } from './stepPackage.ts'
import { list } from '../../copy/statements.ts'
import { projectSafely, readinessSafely, troubleshootingSafely } from '../../content/implementation/project.ts'
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

/**
 * A channel with no content to show (content review D2): its tab still draws,
 * with the one line that says its content could not be loaded and where to
 * report it, and nothing to copy. No channel is ever suppressed.
 */
function unavailableArtifact(id: Channel, reason: string): Artifact {
  const text = reason || fillText(CONTRACT.implementation.channelUnavailable, { address: FEEDBACK_ADDRESS })
  return { id, form: 'markdown', lines: [], text: () => text, note: null, unavailable: true }
}

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
  prerequisiteLabel?: ((id: string) => string | null) | null
  /** This step's owner confirmations of the checks IAMAI cannot read, by prerequisite id (roadmap/decisions.ts). */
  confirmations?: Readonly<Record<string, OwnerConfirmation>>
  /** The baseline commit implementation content is matched against: this build's pin, always, on every product surface. */
  baselineCommit?: string
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
  const ex = stepVars(step, ctx) as Ex
  // The Step Contract (stepContract.ts): the state, the next milestone, the one
  // action, the blockers and the completion, worked out once from Foundations A,
  // B and C, with the lane engine's reading of the step as its one state (A1b).
  // Everything below renders it; nothing below asks them again.
  const laneView = lane ?? laneViewFor(step)
  const contract = stepContract(step, ctx, ex as Record<string, unknown>, laneView)
  // The one title, from the one resolver the row reads (content/stepTitle.ts), so
  // the row and the body it opens can never disagree.
  const title = contentTitle(step)
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
  const deployNow = cs.kind !== 'policy' || implementationIsCurrent(step)
  const manualLines = cs.kind !== 'policy' ? instructions.steps.filter((l): l is string => typeof l === 'string').map((l) => fillText(l, ex)).filter((l) => !/\{[^}]+\}/.test(l)) : []
  const hasPortal = (portal !== null && portal.length + before.length > 0) || manualLines.length > 0
  const channels = step.workflowChoices ? ['ai' as Channel] : deployNow ? channelsFor(hasPortal, contract.implementation.offered) : []
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
  const hasEvidence = contract.found.length > 0 || showWho || pkgEvidence
  // Readiness is the one prerequisite surface (A1 §16.1): the contract's own
  // fixes and the engine's blockers on the next action, one tile each, with the
  // package's gates merged in (stepPackage.ts mergeReadiness). Nothing below
  // lists a prerequisite a second time.
  const readiness = mergeReadiness(readinessOf(step, contract, blockers, prerequisiteLabel ?? undefined), pkgReadiness)
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
  const rail = railOf(contract, pkg?.meta.milestone?.actionText ?? null)
  // What kind of step this is, and "Resolution step" for one whose source
  // contradicts itself (stepContract.ts eyebrowOf).
  const eyebrow = eyebrowOf(contract, typeof cs.kind === 'string' ? cs.kind : null)
  // IAMAI's facts for this step (aiGrounding.ts): one grounding for a package's AI Info and
  // for the step's own, so both hand an assistant the same facts.
  // The request the briefing describes is the JSON channel the package projects, or previews, for this state.
  const jsonChannel = (preview ?? projection)?.channels.find((a) => a.channel === 'json') ?? null
  const groundingJson = jsonChannel ? { text: jsonChannel.text, requests: jsonChannel.requests, preview: preview !== null } : null
  const grounding = (own: string): string => aiGroundingText({ step, ctx, contract, lane: laneView, cs, ex: ex as Record<string, unknown>, bindings: pkgBindings as Record<string, unknown> | null, json: groundingJson }, own)
  const textOf = (ch: Channel): string =>
    ch === 'portal'
      ? portalLines.map((l, i) => `${i + 1}. ${l}`).join('\n')
      : ch === 'ps'
        ? powershellFor(stepOperations(step))
        : ch === 'json'
          ? policyJsonText(step)
          : ((facts) => (facts !== '' ? aiBriefingText('', facts) : stepContext(step, (s) => stepExportView(s, ctx, laneView))))(grounding(''))
  // The channels the Implementation region draws: the package's projected
  // channels where a package is active, and otherwise the ones this step always
  // had. Never both.
  // PowerShell and JSON are offered on Conditional Access policy steps only
  // (RUN-CONTEXT-B decision 12, U15): an account, a group or a setting is portal
  // work, and filtering here keeps the tabs, the viewer and Copy on one list.
  const machine = cs.kind === 'policy'
  // A package channel whose every line waited on a value IAMAI does not hold (the AI
  // Info shared warning aside) has no content: it is not drawn as a blank tab.
  const produced: Artifact[] = (
    packaged
      ? ((preview ?? projection)?.channels ?? []).map((a) => packageArtifact(a, grounding)).filter((a) => a.text().trim() !== '')
      : channels.map((ch): Artifact => ({ id: ch, form: ch === 'portal' ? 'list' : 'code', lines: ch === 'portal' ? portalLines : [], text: () => textOf(ch), note: null }))
  ).filter((a) => machine || (a.id !== 'ps' && a.id !== 'json'))
  // Keep every channel supported somewhere in this step's lifecycle. A temporarily
  // unavailable channel explains the next action; a permanently unsupported format has no tab.
  const supported = new Set<Channel>(pkg ? Object.values(pkg.blocks).map((b) => PACKAGE_CHANNEL[b.meta.channel as OutputChannel]).filter((ch): ch is Channel => Boolean(ch) && (machine || (ch !== 'ps' && ch !== 'json'))) : machine ? ['portal', 'ps', 'json', 'ai'] : channels)
  const artifacts: Artifact[] = CHANNEL_TABS.filter((t) => supported.has(t.id as Channel)).map((t) => produced.find((a) => a.id === t.id) ?? unavailableArtifact(t.id as Channel, contract.whatToDo.text))
  const W = CONTRACT.implementation
  // Why a preview's work cannot be copied: the values still to resolve, never the
  // blocker again. No Planned work banner draws it over the channels (U4); it is
  // the disabled Copy's reason (U18, B5).
  // The lead follows the step's intended next action, and the export reads the same
  // lines (stepPackage.ts previewNoteLines).
  const previewNote = preview ? { lines: previewNoteLines(step, contract, preview.hold) } : null
  // A channel the package could not finish on its own (project.ts `degraded`) is
  // not offered, and nothing stands in for it (S6, A1 §16.2): a line that only
  // says a channel is missing is not implementation content, and whatever really
  // holds the step is a Readiness tile already.
  // A package the semantic re-pin review set aside (stepPackage.ts packageReviewFor):
  // the step draws the baseline's own channels, and says why, before anything else.
  // A step the baseline defines two ways draws no channels at all, so it says
  // nothing about where they come from (content review S4).
  const review = conflictWords === null ? packageReviewFor(step) : null
  const notes = review ? [review.status === 'held' ? W.review.held : W.review.reviewNeeded] : []
  // Every step draws its Implementation region, a decision, a question and a check
  // included (content review D2, which replaces the owner's 2026-09-11 rule that a
  // step with nothing to implement by design draws none).
  const showImplementation = artifacts.length > 0
  // A held projection says why, by the reason it holds: a check to confirm first,
  // a difference no correction covers, content the runtime could not project, or
  // a value IAMAI does not hold. None of them is ever offered an artifact.
  const hold = packaged ? (projection?.hold ?? null) : null
  const heldBox = (key: string): ImplementationEmpty => ({ key, tone: 'warn', title: W.empty[key][0], text: W.empty[key][1] })
  const empty: ImplementationEmpty =
    hold === null
      ? implementationEmptyOf(contract, readiness.tiles.length)
      : hold.pendingPrerequisites.length > 0
        ? heldBox('confirmationsPending')
        : hold.unknownMismatches.length > 0
          ? heldBox('correctionUnknown')
          : hold.invalid.length > 0
            ? heldBox('packageFault')
            : heldBox('bindingMissing')
  // The date the package's Microsoft sources were last checked (stepPackage.ts
  // packageSourceLine), or no line: never a pin, never a fabricated date (S6). A
  // package the re-pin review set aside keeps its date beside why it is set aside.
  const sourcePkg = pkg ?? (review ? reviewedPackageFor(step) : null)
  const sourceLine = sourcePkg ? packageSourceLine(sourcePkg, W) : null
  // The step's Microsoft Learn link (its content entry's `learn.url`): at the end
  // of Why on every step (RUN-CONTEXT-B decision 14), and under Implementation,
  // beside Troubleshooting, where the region is drawn (S6).
  const learnUrl: string | null = typeof learn.url === 'string' && learn.url !== '' ? learn.url : null
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
    previewNote,
    notes,
    showImplementation,
    empty,
    sourceLine,
    learnUrl,
  }
}

export type StepBody = ReturnType<typeof stepBodyOf>

/**
 * The section headings the opened step draws, in the order the component draws
 * them (ContentStep.tsx, the canonical order planAnatomy.test.ts asserts): Why
 * and Readiness always; the conflict attention where the source contradicts
 * itself; Implementation where the step offers or owes one; Done when where the
 * contract has lines. No step draws What to do (U1).
 */
export function headingsOf(b: StepBody): string[] {
  return [
    HEAD.why,
    CONTRACT.readiness.heading,
    ...(b.conflictWords ? [CONTRACT.attentionConflict] : []),
    ...(b.showImplementation ? [CONTRACT.implementation.heading] : []),
    ...(b.contract.doneWhen.length > 0 ? [HEAD.doneWhen] : []),
  ]
}
