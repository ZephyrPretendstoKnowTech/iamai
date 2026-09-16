import goals from '../../data/goals.json' with { type: 'json' }
import { workflowWords } from '../content/content.ts'
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

export const WORKFLOW_STEP = 's-confirm-workloads'
/** Incomplete pinned definitions retained in source, hidden for the V1 journey. */
export const HIDDEN_AGENT_POLICY = /IAC\s*-\s*AGENT\s*-\s*BLOCK\s*-\s*(HighRiskAgent|NonTrustedAgents)/i
const W = workflowWords
const services: [string, RegExp][] = [['sharepoint', /sharepoint|onedrive/i], ['avd', /\bAVD\b|virtual.desktop/i], ['inforcer', /inforcer/i], ['agents', /agent/i], ['azureManagement', /WindowsAzureAD|BaselineScopes/i]]
function serviceOf(policy: NotAssessed): string | null { return services.find(([, re]) => re.test(policy.name))?.[0] ?? null }
function idOf(name: string): string {
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `s-review-baseline-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(hash >>> 0).toString(36)}`
}
function base(id: string, title: string, why: string): Step {
  return { ...STEP_EXTRAS, id, goalId: id, phase: 0, kind: 'check', title, why, ...stateFields({}), blockedBy: [], blockers: [], unblockNotes: [], population: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [], inScope: 0 }, readiness: { family: 'other', percent: null, lines: [] }, evidence: { status: 'none', lines: [], affectedUserIds: [] }, action: { kind: 'prerequisite', summary: [], json: null, portalSteps: [] }, history: [], skipReason: null, deliveredBy: [] }
}
export function addWorkflowSteps(steps: Step[], policies: NotAssessed[], snapshot: TenantSnapshot, mapping: MappingState, confirmations: Record<string, Record<string, OwnerConfirmation>> = {}, availableGoalIds?: string[]): void {
  const existing = new Set(availableGoalIds ?? steps.map((s) => s.goalId))
  const goalFacets = new Map(goals.goals.filter((g) => existing.has(g.id) && g.applicability).map((g) => [g.id, String(g.applicability)]))
  const keys = [...new Set([...goalFacets.values(), ...policies.map(serviceOf).filter((s): s is string => s !== null)])].sort()
  const detected = detectFacets(snapshot, {})
  const reliable = detectFacets({ ...snapshot, appSignInSummary: ['ok', 'partial'].includes(snapshot.sources.appSignInSummary?.status) ? snapshot.appSignInSummary : [], spActivity: ['ok', 'partial'].includes(snapshot.sources.spActivity?.status) ? snapshot.spActivity : [] }, {})
  const answer = (key: string): string => mapping.workflowAnswers?.[key] ?? (mapping.facetOverrides[key] ? mapping.facetOverrides[key].on ? 'yes' : 'no' : 'unsure')
  const signal = (key: string): { used: boolean; complete: boolean; evidence: string } => {
    if (key === 'intune') return { used: false, complete: snapshot.config.subscribedSkus?.status === 'ok', evidence: detected.intune.reason }
    if (key === 'workload') return { used: detected.workload.observedUsage === true && snapshot.config.roleAssignments?.status === 'ok', complete: snapshot.config.roleAssignments?.status === 'ok', evidence: detected.workload.evidence ?? detected.workload.reason }
    const complete = snapshot.sources.appSignInSummary?.status === 'ok' && snapshot.sources.spActivity?.status === 'ok'
    return { used: reliable[key as Facet]?.observedUsage === true, complete, evidence: reliable[key as Facet]?.evidence ?? reliable[key as Facet]?.reason ?? W.noSignal }
  }
  const needsReview = (key: string): boolean => answer(key) === 'no' && signal(key).used && mapping.workflowEvidenceBasis?.[key] !== 'present'
  if (keys.length) {
    const step = base(WORKFLOW_STEP, W.title, W.why)
    step.workflowChoices = keys.map((key) => {
      const evidence = signal(key)
      const saved = answer(key)
      const initial = !Object.hasOwn(mapping.workflowAnswers ?? {}, key) && !mapping.facetOverrides[key]
      return { key, label: (W.names as Record<string, string>)[key] ?? key, evidence: needsReview(key) ? `New usage detected. Your saved choice is No. ${evidence.evidence}` : evidence.evidence, answer: initial ? evidence.used ? 'yes' : evidence.complete ? 'no' : 'unsure' : saved, suggested: initial && evidence.used, needsReview: needsReview(key), evidenceBasis: evidence.used ? 'present' : evidence.complete ? 'absent' : 'unread' }
    }).sort((a, b) => Number(b.suggested) - Number(a.suggested))
    const complete = !!mapping.workflowConfirmedAt && keys.every((key) => answer(key) !== 'unsure' && !needsReview(key))
    setState(step, { satisfied: complete, inPlace: complete, condition: complete ? 'healthy' : 'needs-decision' })
    if (complete && mapping.workflowConfirmedAt && Date.parse(mapping.workflowConfirmedAt) <= Date.now()) step.history = [{ at: mapping.workflowConfirmedAt, from: 'blocked', to: 'done', note: W.done }]
    if (!complete) step.blockers = [{ kind: 'decision', label: W.title, binding: `after: ${W.title}` }]
    step.guidance = { id: step.id, kind: 'check', title: W.title, why: W.why, whatToDo: { steps: [W.instructions] }, doneWhen: [W.done] }
    steps.unshift(step)
  }
  for (const step of steps) {
    const key = goalFacets.get(step.goalId)
    if (key && answer(key) === 'unsure' && !step.state.satisfied) {
      step.blockedBy = [...new Set([...step.blockedBy, WORKFLOW_STEP])]
      setState(step, { condition: 'blocked' })
    }
  }
  for (const policy of policies) {
    if (HIDDEN_AGENT_POLICY.test(policy.name)) continue
    const key = serviceOf(policy)
    const name = key ? (W.names as Record<string, string>)[key] : policy.name
    const title = fillText(W.reviewTitle, { service: name, policy: policy.name })
    const step = base(idOf(policy.name), title, fillText(W.reviewWhy, { service: name }))
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
    step.guidance = { id: step.id, kind: 'check', title: words?.title ?? title, why: words?.why ?? step.why, whatToDo: { steps: [fillText(W.source, { policy: policy.name }), ...(words?.instructions ?? [W.generic]), ...W.reviewInstructions] }, doneWhen: [W.reviewDone], learn: { url: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview' } }
    if (applicable === 'no') { step.doesntApply = fillText(W.notUsed, { service: name }); setState(step, { setAside: true }) }
    else if (applicable === 'unsure') { step.blockedBy = [WORKFLOW_STEP]; setState(step, { condition: 'blocked' }) }
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
