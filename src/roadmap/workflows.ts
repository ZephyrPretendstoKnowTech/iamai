import goals from '../../data/goals.json' with { type: 'json' }
import { workflowWords } from '../content/content.ts'
import type { Learn } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { detectFacets } from '../coverage/applicability.ts'
import type { Facet } from '../coverage/applicability.ts'
import type { NotAssessed } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { OwnerConfirmation } from './decisions.ts'
import { STEP_EXTRAS } from './stepDefaults.ts'
import { setState, stateFields } from './lifecycle.ts'
import type { Step } from './types.ts'
import { MANUAL_REVIEW_ID } from './manualWork.ts'

/** Incomplete pinned definitions retained in source, hidden for the V1 journey. */
export const HIDDEN_AGENT_POLICY = /IAC\s*-\s*AGENT\s*-\s*BLOCK\s*-\s*(HighRiskAgent|NonTrustedAgents)/i
const W = workflowWords
/**
 * The one Microsoft page every generated review row cites, and the day the
 * repository records it as read: `ms-plan-ca` in the source table of
 * docs/plans/ongoing-spec.md section 1, checked 2026-09-20. The row shows that
 * date beside the link (stepBody.ts sourceCheckedLine), which is why the date
 * lives here with the URL and is moved only by re-reading the page.
 */
const PLAN_CA: Learn = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access', checkedOn: '2026-09-20' }
const services: [string, RegExp][] = [['sharepoint', /sharepoint|onedrive/i], ['avd', /\bAVD\b|virtual.desktop/i], ['inforcer', /inforcer/i], ['agents', /agent/i], ['azureManagement', /WindowsAzureAD|BaselineScopes/i]]
/** The service a baseline policy IAMAI does not assess protects, by its name; null for none. */
export function serviceOf(policy: Pick<NotAssessed, 'name'>): string | null { return services.find(([, re]) => re.test(policy.name))?.[0] ?? null }
function idOf(name: string): string {
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `s-review-baseline-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(hash >>> 0).toString(36)}`
}
/** A bare check step: the shape the review rows and the Direction steps start from. */
export function checkStep(id: string, title: string, why: string): Step {
  return { ...STEP_EXTRAS, id, goalId: id, phase: 0, kind: 'check', title, why, ...stateFields({}), blockedBy: [], blockers: [], unblockNotes: [], population: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [], inScope: 0 }, readiness: { family: 'other', percent: null, lines: [] }, evidence: { status: 'none', lines: [], affectedUserIds: [] }, action: { kind: 'prerequisite', summary: [], json: null, portalSteps: [] }, history: [], skipReason: null, deliveredBy: [] }
}

/** What the scan read of a service: seen in use, and whether the read was complete enough to say it is not. The words are Direction's (direction.ts). */
export type ServiceSignal = { used: boolean; complete: boolean }

/**
 * The services this plan's baseline has something to protect (a goal whose
 * applicability is the service, or a baseline policy IAMAI does not assess),
 * and what the scan read of each. The Direction step asks about them
 * (roadmap/direction.ts); the answers persist as workflowAnswers.
 */
export function serviceReading(snapshot: TenantSnapshot, policies: readonly NotAssessed[], availableGoalIds: readonly string[]): { keys: string[]; signal: (key: string) => ServiceSignal } {
  const existing = new Set(availableGoalIds)
  const goalFacets = goals.goals.filter((g) => existing.has(g.id) && g.applicability).map((g) => String(g.applicability))
  const keys = [...new Set([...goalFacets, ...policies.filter((p) => !HIDDEN_AGENT_POLICY.test(p.name)).map(serviceOf).filter((s): s is string => s !== null)])].sort()
  const detected = detectFacets(snapshot, {})
  const reliable = detectFacets({ ...snapshot, appSignInSummary: ['ok', 'partial'].includes(snapshot.sources.appSignInSummary?.status) ? snapshot.appSignInSummary : [], spActivity: ['ok', 'partial'].includes(snapshot.sources.spActivity?.status) ? snapshot.spActivity : [] }, {})
  const signal = (key: string): ServiceSignal => {
    if (key === 'intune') return { used: false, complete: snapshot.config.subscribedSkus?.status === 'ok' }
    if (key === 'workload') return { used: detected.workload.observedUsage === true && snapshot.config.roleAssignments?.status === 'ok', complete: snapshot.config.roleAssignments?.status === 'ok' }
    const complete = snapshot.sources.appSignInSummary?.status === 'ok' && snapshot.sources.spActivity?.status === 'ok'
    return { used: reliable[key as Facet]?.observedUsage === true, complete }
  }
  return { keys, signal }
}

/**
 * One review row per baseline policy IAMAI does not assess. A row's service is
 * a Direction question (roadmap/direction.ts): answered No, the row is set
 * aside; unanswered, it waits on that answer (direction.ts gateOnDirection).
 */
export function addWorkflowSteps(steps: Step[], policies: NotAssessed[], mapping: MappingState, confirmations: Record<string, Record<string, OwnerConfirmation>> = {}): void {
  const answer = (key: string): string => mapping.workflowAnswers?.[key] ?? (mapping.facetOverrides[key] ? mapping.facetOverrides[key].on ? 'yes' : 'no' : 'unsure')
  for (const policy of policies) {
    if (HIDDEN_AGENT_POLICY.test(policy.name)) continue
    const key = serviceOf(policy)
    const name = key ? (W.names as Record<string, string>)[key] : policy.name
    const title = fillText(W.reviewTitle, { service: name, policy: policy.name })
    const step = checkStep(idOf(policy.name), title, fillText(W.reviewWhy, { service: name }))
    step.impactLabel = name
    step.baselineReviewSource = { name: policy.name, json: policy.json, reason: policy.reason }
    // The source and the tenant evidence define the review. Old catch-all Done dates never approve a new individual policy.
    const source = JSON.stringify(policy.json)
    const references = Object.entries(mapping.records).filter(([id]) => source.toLowerCase().includes(id.toLowerCase())).map(([id, r]) => [id, r.resolvedId, r.doesNotExist]).sort(([a], [b]) => String(a).localeCompare(String(b)))
    // A manual review is an operator's attestation, not an automatic coverage verdict.
    // Changes to its source or mapped references reopen it; unrelated tenant policies do not.
    const basis = JSON.stringify([policy.name, policy.json, references, (mapping.omittedReferences ?? []).filter((id) => source.toLowerCase().includes(id.toLowerCase())).sort(), key ? answer(key) : 'yes'])
    const confirmed = confirmations[step.id]?.[MANUAL_REVIEW_ID]
    const applicable = key ? answer(key) : 'yes'
    step.manualReview = { basis, confirmedAt: applicable === 'yes' && confirmed?.basis === basis && Date.parse(confirmed.at) <= Date.now() ? confirmed.at : null, readyToConfirm: applicable === 'yes' }
    const words = W.policies.find((p: { pattern: string }) => new RegExp(p.pattern, 'i').test(policy.name))
    // The Learn link is the planning page, not the Conditional Access overview:
    // this row's job is Microsoft's own "Ask the right questions" — record the
    // answers for each policy before creating it — and the same page carries the
    // report-only, exclusion-testing and rollback instructions the template
    // gives (docs/plans/ongoing-spec.md section 6). Locale-free, like every
    // other Learn URL in the product.
    // The Tasks Remaining card's subject is the baseline policy under review and
    // its check is the state of that review, not the row's own title read back
    // three times (quality audit 2.1).
    step.guidance = { id: step.id, kind: 'check', title: words?.title ?? title, why: words?.why ?? step.why, card: { ...W.reviewCard }, taskTitle: W.reviewTaskTitle, whatToDo: { steps: [fillText(W.source, { policy: policy.name }), ...(words?.instructions ?? [W.generic]), ...W.reviewInstructions] }, doneWhen: [W.reviewDone], learn: PLAN_CA }
    if (applicable === 'no') { step.doesntApply = fillText(W.notUsed, { service: name }); setState(step, { setAside: true }) }
    else if (step.manualReview.confirmedAt) setState(step, { satisfied: true, inPlace: true })
    // The pinned AVD block relies on four source exclusions whose allowed-user
    // purpose has not been established. An acknowledgement cannot turn that
    // unresolved definition into verified protection or a safe deny-all target.
    if (applicable !== 'no' && /AVD.*Exclude.*AllowedAVDUsers/i.test(policy.name)) {
      delete step.manualReview
      step.configurationFindings = [{ key: 'avd-allowed-population', label: 'Allowed AVD Users', value: 'Source definition needs clarification', detail: 'The source blocks all users of the AVD applications and excludes several source groups. The group defining allowed desktop users has not been established. This needs the baseline author’s clarification.', outcome: 'unknown' }]
      step.blockers = [{ kind: 'readiness', label: 'AVD allowed-user scope needs clarification' }]
      setState(step, { satisfied: false, inPlace: false, condition: 'blocked' })
      step.guidance.doneWhen = ['The intended allowed-user group has been established, the tenant policy preserves that access, and approved and unapproved desktop sign-ins have been tested.']
    }
    steps.push(step)
  }
}
