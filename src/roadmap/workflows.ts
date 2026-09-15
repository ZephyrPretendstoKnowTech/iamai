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
  const answer = (key: string): string => mapping.workflowAnswers?.[key] ?? (mapping.facetOverrides[key] ? mapping.facetOverrides[key].on ? 'yes' : 'no' : 'unsure')
  if (keys.length) {
    const step = base(WORKFLOW_STEP, W.title, W.why)
    step.workflowChoices = keys.map((key) => ({ key, label: (W.names as Record<string, string>)[key] ?? key, evidence: detected[key as Facet]?.evidence ?? detected[key as Facet]?.reason ?? W.noSignal, answer: answer(key), suggested: !Object.hasOwn(mapping.workflowAnswers ?? {}, key) && !mapping.facetOverrides[key] && detected[key as Facet]?.observedUsage === true })).sort((a, b) => Number(b.suggested) - Number(a.suggested))
    const complete = keys.every((key) => answer(key) !== 'unsure')
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
    steps.push(step)
  }
}
