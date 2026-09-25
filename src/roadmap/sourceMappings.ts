// The baseline's own references only a person can answer (resolvePolicy.ts
// `decisions`), read across the plan: one record per reference, with the open
// policies that name it, the part it plays and where the answer stands (S4,
// playbook §18.1). Nothing here is a step: the policies that name an unanswered
// reference carry a `sourceMapping` blocker each and sit On Hold; the answers are
// given in Plan settings → Baseline mappings and persist under one plan-record
// key, so no row of the plan stands for the question.
//
// Pure: no DOM, no content, no engine import.
import type { SourceReference, Step } from './types.ts'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }

const UNEXPLAINED_GROUPS = new Set(interpretation.references.filter(r => r.kind === 'group' && r.classification === 'decisionRequired').map(r => r.id.toLowerCase()))

/** Approved V1 assumption for unexplained optional source exclusions only.
 * These are source IDs, never existing tenant exclusions. The AVD allow-list's
 * excluded groups define who can use the service and cannot be guessed away.
 * 5628ad67 is one of them: the owner takes it as a second break-glass group
 * (2026-09-19, applied 2026-09-24), and the exclusions group every policy the
 * plan writes already excludes (resolvePolicy.ts) stands where it stood. It had
 * held Require MFA to Register a Device and Reset Passwords for Medium-Risk
 * Users on a Baseline mappings question.
 */
export function assumedAbsentSourceGroups(policy: Record<string, unknown>, policies: readonly unknown[]): string[] {
  if (/AVD.*AllowedAVDUsers/i.test(String(policy.displayName ?? ''))) return []
  const users = (policy.conditions as { users?: { excludeGroups?: string[] } } | undefined)?.users
  const included = new Set(policies.flatMap(raw => ((raw as { conditions?: { users?: { includeGroups?: string[] } } }).conditions?.users?.includeGroups ?? []).map(id => id.toLowerCase())))
  return (users?.excludeGroups ?? []).map(id => id.toLowerCase()).filter(id => UNEXPLAINED_GROUPS.has(id) && !included.has(id))
}

/**
 * The plan-record key the Baseline mappings persist under (`stepDecisions`,
 * decisions.ts applyStepDecisions), one answer per source id. It is the id the
 * question carried when it was a row of the plan, kept so a record saved then
 * still answers now; it names no step.
 */
export const BASELINE_MAPPINGS_KEY = 's-prereq-source-references'

/** True for a step whose body is still to be written: open policy work that names the baseline's references. */
function namesReferences(s: Step): boolean {
  return s.status !== 'done' && s.status !== 'skipped' && (s.kind === 'create' || s.kind === 'adjust')
}

/**
 * Every reference the plan's open policies name, each once, with the steps that
 * name it. A reference one policy still waits on is pending for the record,
 * whatever another policy made of the answer. Ordered by how many steps wait on
 * it, then by id.
 */
export function sourceMappingsOf(steps: readonly Step[]): SourceReference[] {
  const byId = new Map<string, SourceReference & { stepIds: string[] }>()
  for (const s of steps) {
    if (!namesReferences(s)) continue
    for (const r of s.action.sourceReferences ?? []) {
      const at = byId.get(r.id) ?? { ...r, stepIds: [] }
      if (r.answer === 'pending') at.answer = 'pending'
      if (at.role === undefined && r.role !== undefined) Object.assign(at, { role: r.role, baselinePolicies: r.baselinePolicies, baselineTotal: r.baselineTotal })
      if (!at.stepIds.includes(s.id)) at.stepIds.push(s.id)
      byId.set(r.id, at)
    }
  }
  return [...byId.values()].sort((a, b) => b.stepIds.length - a.stepIds.length || a.id.localeCompare(b.id))
}

/** The references still without an answer: each holds every step in its `stepIds`. */
export function unresolvedSourceMappings(steps: readonly Step[]): SourceReference[] {
  return sourceMappingsOf(steps).filter((r) => r.answer === 'pending')
}
