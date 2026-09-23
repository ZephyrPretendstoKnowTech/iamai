// AI Info's shared briefing (consolidated batch; release review R03; editorial batch A).
//
// AI Info is a briefing a customer hands to their own assistant, and that
// assistant cannot see the IAMAI screen. It opens with the shared request
// (aiFacts.opening), carries the package's own words for the step's state, and then
// IAMAI's facts for the step, from the authorities the screen already reads, in six
// sections:
//
// - Step and purpose: the title and why it matters;
// - Tenant and scope: the tenant, the scan it rests on, who the step reaches, and
//   the people and accounts the step names (each with its id where the step holds
//   the ids beside the names);
// - What IAMAI observed: the contract's findings, a finished policy that went live
//   with no report-only period IAMAI watched (said on the step by its Readiness tile,
//   never under What IAMAI found), the policies the step tracks, the tenant policies
//   already delivering the goal, and the tenant policy a correction changes with its
//   state, the fields that differ and the exclusions it removes;
// - Intended result: the settings of every policy the step resolves, translated from
//   the body its package's JSON sends where it sends one (stepPackage.ts
//   selectedPolicyBodiesOf), so the briefing never states a setting the JSON does not;
//   what is proposed but not yet handed over, and what the scan could not settle;
// - What remains: the state, the next action, what holds it, the dates, Done when and
//   the way back — the labelled run the prompt pack and calendar carry;
// - Implementation and verification: the request the step's JSON sends and the
//   step's own focus for the assistant.
//
// Nothing is invented to fill a section: a fact IAMAI does not hold is absent or
// named as not available, a resolved empty list says None, and a line the package's
// own words already carry is not repeated. Names and ids stay: this briefing is
// identifiable by design, and the redacted exports are a separate, explicit choice.
// Pure: no DOM, no network. It reads the step's export view and its already-projected
// JSON channel; it never renders the step body.
import { directionWords, workflowWords, shared } from '../../content/content.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import type { ChannelArtifact } from '../../content/implementation/project.ts'
import { fillText } from '../../content/render.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { stepExportView } from './stepExport.ts'
import { CONTRACT } from './stepContract.ts'
import { enforcedUnwatched } from './doneWhen.ts'
import type { LaneView, PrerequisiteLabel, StepContract } from './stepContract.ts'
import { implementationOffered } from './stepJson.ts'
import { submitsEnforcementOnly, toReportOnly } from '../../roadmap/operations.ts'
import { incompleteFieldsOf, plannedOperationsOf, policyBodiesOfChannel } from './stepPackage.ts'
import { plannedPortalLines, portalNamesFor } from './stepPortal.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { whoBlocks } from './whoBlocks.ts'

export type GroundingInput = {
  step: Step
  ctx: StepVarContext
  contract: StepContract
  lane: LaneView
  /** The step's content entry (content/stepTitle.ts contentStepFor), or {}. */
  cs: Record<string, unknown>
  /** The step's resolved content variables (stepVars.ts). */
  ex: Record<string, unknown>
  /** The package bindings IAMAI holds for the step (stepPackage.ts packageBindings), or null without a package. */
  bindings: Record<string, unknown> | null
  /** The JSON channel the step's package projects (or previews) for its state, or null: the request the briefing describes. */
  json?: (Pick<ChannelArtifact, 'text' | 'requests'> & { preview: boolean }) | null
  /** Where a readiness route's chain starts on the board (planBoard.ts prerequisiteLabelFor), so What remains states the Threshold card's sentence (R4-33). */
  startOf?: PrerequisiteLabel['startOf']
}

type AiFactWords = typeof CONTRACT.implementation.aiFacts & {
  opening: string[]
  sections: { purpose: string; scope: string; observed: string; intended: string; remains: string; implementation: string }
  tenant: string
  scanned: string
  proposed: string
  previewValues: string
  unresolvedFields: string
  request: string
  focus: string
  unavailable: string
  /** The device-platform scope the resolved target sets, beside the location scope (`policy.target.platformWords`). */
  platforms: string
}

/** The most names one list in a briefing carries; the rest are counted. */
export const NAMES_IN_BRIEFING = 50

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])
const normal = (s: string): string => s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
const words = (): AiFactWords => CONTRACT.implementation.aiFacts as AiFactWords
const WHO_HEADING = (): string => (CONTRACT as unknown as { headings: { who: string } }).headings.who

/** A Conditional Access state as the step's own track words it; any other value as Graph returned it. */
function stateWord(state: string): string {
  const L = CONTRACT.lifecycle as Record<string, string>
  if (state === 'enabled') return L.enforced ?? state
  if (state === 'enabledForReportingButNotEnforced') return L['report-only'] ?? state
  return state
}

/**
 * The AI Info text: the shared opening, the package's own words for the state, and
 * IAMAI's facts. One composition for a package's AI Info and for the step's own.
 */
export function aiBriefingText(own: string, facts: string): string {
  const parts = [words().opening.join('\n\n'), own.trim(), facts].filter((p) => p.trim() !== '')
  return parts.join('\n\n')
}

/**
 * IAMAI's facts for one step, as the AI Info briefing carries them after the
 * package's own words (`own`). Empty where IAMAI holds nothing to add.
 */
export function aiGroundingText(i: GroundingInput, own = ''): string {
  const W = words()
  const S = W.sections
  const already = normal(own)
  const b = i.bindings ?? {}
  const text = (k: string): string | null => (typeof b[k] === 'string' && (b[k] as string).trim() !== '' ? (b[k] as string) : null)
  // An object IAMAI holds by id, by the name the scan read and the id; a literal ("All") as it is.
  const named = (id: string): string => {
    const name = i.ctx.nameOf?.(id)
    return name && name !== id ? `${name} (${id})` : id
  }
  const sections: string[][] = []
  /** One section under its heading: its lines, each dropped where the package's own words already say it. */
  const section = (heading: string, lines: (string | null | undefined)[]): void => {
    const kept = lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '' && !(normal(l).length >= 12 && already.includes(normal(l.replace(/^- /, '')))))
    if (kept.length > 0) sections.push([heading, ...kept])
  }
  const labelled = (label: string, items: readonly string[]): string[] => (items.length === 0 ? [] : items.length === 1 ? [`${label}: ${items[0]}`] : [`${label}:`, ...items.map((x) => `- ${x}`)])
  const c = i.contract
  const view = stepExportView(i.step, i.ctx, i.lane, i.startOf)

  // Intended result, first, so What remains does not repeat the settings it states.
  const selected = i.json ? policyBodiesOfChannel(i.json, i.json.preview) : null
  const intended: string[] = []
  if (c.policy) {
    // A step that withholds its implementation withholds the turn-on here too.
    // This section stated "Enable policy: On → Save — only when all of this is
    // true now", then "The step cannot hand them over yet": the instruction the
    // Portal, JSON and PowerShell channels had just withheld, with a warning
    // after it — on a held admin policy whose checklist did not even name the
    // readiness gate holding it, and whose "no failures in the sign-in records"
    // was vacuously true on a tenant with none (Priya D6). Where turning the
    // policy on is the whole of the change, there is no intended setting left
    // to state; where it is part of it, the rest is stated and the turn-on is not.
    const offered = implementationOffered(i.step)
    const names = portalNamesFor(i.ctx, i.ex, contentTitle(i.step))
    const planned = plannedOperationsOf(i.step)
    const turnOnOnly = planned.length > 0 && planned.every(submitsEnforcementOnly)
    // A policy this plan tagged that the tenant switched off is not one to build:
    // the operation the engine resolves for it is still a create, and the
    // briefing stated "→ New policy, Name: …, Description: [IAMAI:plan-…]" beside
    // a step saying the policy is there and switched off (Jordan D6). Following
    // it makes a second policy.
    const switchedOff = toReportOnly(i.step).length > 0
    const lines = (!offered && turnOnOnly) || switchedOff ? [] : plannedPortalLines(i.step, offered ? names : { ...names, withholdTurnOn: true }, selected) ?? []
    intended.push(...lines)
    if (lines.length > 0 && !offered) intended.push(W.proposed)
    const open = [...new Set(plannedOperationsOf(i.step).flatMap((op) => [...incompleteFieldsOf(i.step, op)]))].sort()
    if (open.length > 0) intended.push(fillText(W.unresolvedFields, { fields: open.join(', ') }))
  } else if (i.json && selected === null && i.json.text.trim() !== '') {
    // A settings step's request (a method policy, a location): the body it sends, as it sends it.
    let body = i.json.text.trim()
    try {
      body = JSON.stringify(JSON.parse(body))
    } catch {
      // A preview keeps its stand-ins as written.
    }
    intended.push(...i.json.requests.map((r) => `${W.request}: ${r.method} ${r.endpoint}`), body)
  }
  if (intended.length > 0 && i.json?.preview) intended.push(W.previewValues)
  const intendedLines = new Set(intended)

  // Step and purpose.
  section(S.purpose, [`${view.title}.`, view.why])

  // Tenant and scope: the tenant, the scan, who it reaches, and the people it names
  // under the step's own words for them (whoBlocks.ts).
  const tenant = tenantNameOf(i.ctx.snapshot)
  const scope: (string | null)[] = [
    tenant ? `${W.tenant}: ${tenant}` : null,
    typeof i.ctx.snapshot.asOf === 'string' && i.ctx.snapshot.asOf !== '' ? `${W.scanned}: ${absoluteDate(i.ctx.snapshot.asOf)}` : null,
    view.who === null ? null : `${WHO_HEADING()}: ${view.who}`,
    // Why an observation cannot complete, where the step knows it
    // (roadmap/evidence.ts). This brief carries the enable preconditions —
    // "only when all of this is true now: the required report-only period is
    // complete, with no failures on this policy in the sign-in records" — and
    // on a tenant whose records could not be read that reads as SATISFIED,
    // because no failures are listed when there is nothing to list. It is the
    // one line in the product that can walk somebody through an enforcement
    // believing it was observed.
    // Only while there is an enforcement still to come: on a policy already
    // enforced or in place it read "Time in report-only cannot complete it"
    // under the step's own Completed — a report-only sentence on a finished
    // policy, which the screen, gating the same line on an open observation,
    // never showed (Priya D13).
    ...(i.step.status !== 'done' && i.step.status !== 'skipped' && !i.step.state.satisfied ? i.step.evidence.lines : []),
  ]
  const who = (i.cs.who ?? {}) as Record<string, unknown>
  const { inline, held } = whoBlocks(who, i.ex as never)
  const blocks = [...inline.map((x) => held.find((h) => h.key === x.key) ?? x), ...held.filter((h) => !inline.some((x) => x.key === h.key))]
  const tokens = [...new Set([...JSON.stringify(who).matchAll(/\{list:([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))]
  for (const block of blocks) {
    // The block's own list variable: a rung's by its key, an evidence line's by the list its names are.
    const group = block.key.startsWith('group:') ? block.key.slice('group:'.length) : null
    const token = group ?? tokens.find((t) => {
      const list = asList(i.ex[t])
      return list.length > 0 && list.length === block.names.length && list.every((w, n) => w === block.names[n])
    })
    const ids = token ? asList(i.ex[`${token}Ids`]) : []
    const lead = block.lead.replace(/:\s*$/, '').trim()
    // A briefing names a readable number of people; past that it says how many more there are, never a thousand-name list.
    const shown = block.names.slice(0, NAMES_IN_BRIEFING)
    const items = shown.map((name, n) => (ids.length === block.names.length ? `${name} (id ${ids[n]})` : name))
    if (block.names.length > shown.length) items.push(fillText(W.more, { n: block.names.length - shown.length }))
    scope.push(...labelled(lead || W.accounts, items))
  }
  section(S.scope, scope)

  // What IAMAI observed: the findings, the policies in play, and on a policy step
  // the tenant policy a correction changes.
  const currentName = text('policy.current.displayName')
  const currentId = text('policy.current.id')
  const currentState = text('policy.current.state')
  // A finished policy that went live with no report-only period IAMAI watched
  // (owner decision 3). The step says it once, on its Readiness tile, and leaves
  // it out of What IAMAI found; this briefing reads the findings and no tile, so
  // it said only "IAMAI watched it get there" and an assistant read the rollout
  // as watched. The tile's own words, once.
  const unwatched = enforcedUnwatched(i.step) ? [`${CONTRACT.readiness.tiles.observation}: ${CONTRACT.foundEnforcedUnwatched}`] : []
  section(S.observed, [
    ...labelled(W.observed, [...c.found.map((f) => `${f.label}: ${f.text}`), ...unwatched]),
    ...labelled(W.members, c.members.map((m) => m.line)),
    ...(c.existing !== null ? labelled(W.existing, c.existing.names) : []),
    ...(c.policy
      ? [
          currentName || currentId ? `${W.current}: ${currentName && currentId ? `${currentName} (${currentId})` : (currentName ?? currentId)}` : null,
          currentState ? `${W.currentState}: ${stateWord(currentState)}` : null,
          ...labelled(W.changedFields, asList(b[CHANGED_FIELDS_BINDING])),
          ...labelled(W.removedExclusions, asList(b['policy.current.removedExclusions'])),
        ]
      : []),
  ])

  // Intended result: the settings, then the names and ids behind them. A check or a
  // preparation step has no policy target, whatever bindings its package shares with
  // the policies.
  const target: (string | null)[] = []
  if (c.policy) {
    const excludeGroups = Array.isArray(b['policy.target.excludeGroups']) ? asList(b['policy.target.excludeGroups']) : null
    const excludeUsers = text('policy.target.excludeUsersSummary') ?? (Array.isArray(b['policy.target.excludeUsers']) ? (asList(b['policy.target.excludeUsers']).map(named).join(', ') || W.none) : null)
    target.push(
      text('policy.target.displayName') ? `${W.targetName}: ${text('policy.target.displayName')}` : null,
      ...labelled(W.includeUsers, asList(b['policy.target.includeUsers']).map(named)),
      ...labelled(W.includeRoles, asList(b['policy.target.includeRoles']).map(named)),
      excludeGroups === null ? null : `${W.excludeGroups}: ${excludeGroups.length === 0 ? W.none : excludeGroups.map(named).join(', ')}`,
      excludeUsers === null ? null : `${W.excludeUsers}: ${excludeUsers}`,
      text('policy.target.locationWords') ? `${W.locations}: ${text('policy.target.locationWords')}` : null,
      text('policy.target.platformWords') ? `${W.platforms}: ${text('policy.target.platformWords')}` : null,
      text('policy.target.grantWords') ? `${W.grant}: ${text('policy.target.grantWords')}` : null,
      text('authStrength.target.displayName') ? `${W.strength}: ${text('authStrength.target.displayName')}` : null,
    )
    // A multi-policy step's members, each by its role: its target name, the tenant policy it tracks, and its state.
    const roles = new Map<string, string[]>()
    for (const key of Object.keys(b)) {
      const m = /^policies\.[^.]+\.([^.]+)\.(target\.displayName|current\.displayName|current\.id|current\.state)$/.exec(key)
      if (!m || typeof b[key] !== 'string') continue
      const parts = roles.get(m[1]) ?? []
      parts.push(m[2] === 'current.state' ? `${W.currentState}: ${stateWord(b[key] as string)}` : m[2] === 'current.id' ? `id ${b[key]}` : String(b[key]))
      roles.set(m[1], parts)
    }
    for (const [role, parts] of roles) target.push(`${role}: ${parts.join('; ')}`)
  }
  const facts = target.filter((l): l is string => l !== null)
  section(S.intended, [...intended, ...(facts.length > 0 ? [`${W.target}:`, ...facts.map((l) => `- ${l}`)] : [])])

  // What remains: the labelled run every artifact carries, without the settings the
  // intended result already states.
  section(S.remains, stepArtifactLines({ ...view, why: '', who: null, whatToDo: view.whatToDo.filter((l) => !intendedLines.has(l)) }))

  // Implementation and verification: the request the step's JSON sends, and the
  // step's own focus for the assistant.
  const focus = typeof i.cs.aiFocus === 'string' && i.cs.aiFocus.trim() !== '' ? `${W.focus}: ${i.cs.aiFocus}` : null
  section(S.implementation, [...(c.policy && i.json ? i.json.requests.map((r) => `${W.request}: ${r.method} ${r.endpoint}`) : []), focus])

  if (i.step.id === 's-direction-devices') section((shared.deviceBriefing as { options: string }).options, (shared.deviceBriefing as { details: string[] }).details)
  if (text('emergency.passkey.compatibility')) section((shared.passkeyCompatibility as Record<string, string>).heading, [text('emergency.passkey.compatibility')])
  // A Direction step's questions: each answer as saved, or the suggestion and that it is one, with its evidence.
  if (i.step.directionQuestions) section(workflowWords.choiceContext, i.step.directionQuestions.map((q) => { const a = q.saved ?? q.suggested; const label = q.options.find((o) => o.value === a.value)?.label ?? a.picked.join(', '); return `${q.label}: ${label}${q.saved ? '' : ` (${directionWords.suggested})`}. ${q.evidence}` }))
  if (i.step.baselineReviewSource) section(workflowWords.baselineContext, [i.step.baselineReviewSource.name, i.step.baselineReviewSource.reason, i.step.baselineReviewSource.json])
  if (sections.length === 0) return ''
  return [W.heading, W.boundary, ...sections.map((s) => s.join('\n'))].join('\n\n')
}
