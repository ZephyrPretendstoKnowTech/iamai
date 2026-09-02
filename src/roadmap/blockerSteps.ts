// Phase 0 steps for the subjects the validation registry blocks on
// (validation-rules.md §2, §5).
//
// A blocking subject is one whose must-fix checks have not passed. It gets one
// step, ordered before everything else, holding every blocker as a checklist
// with the portal path for each and the criteria that clear it. Break-glass and
// the exclusions group additionally hold every step that can deny access: no
// enforcement is offered while the escape hatch is unverified.
//
// Pure: no DOM, no network.
import { ATTESTATION_DONE_WHEN, ATTESTATION_RULES, BLOCKER_STEP, HOUSEKEEPING_ONLY_RULES, RULE_ACTION, SEVERITY, SUBJECT, SUBJECT_PLAIN, fallbackAction } from '../copy/validation.ts'
import { ruleText } from '../validation/rules.ts'
import type { RuleSubject } from '../validation/rules.ts'
import type { SubjectReport } from '../validation/report.ts'
import { STEP_EXTRAS } from './stepDefaults.ts'
import { stepChecks } from '../validation/checkFixes.ts'
import type { Step } from './types.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'

/** Subjects whose blockers hold every step that can deny access (design §2). */
export const GATING_SUBJECTS: RuleSubject[] = ['breakGlass', 'exclusionGroup']

export function blockerStepId(subject: RuleSubject): string {
  // The exclusions group's checks live on its own prerequisite step, which every plan has.
  if (subject === 'exclusionGroup') return 's-prereq-exclusion-group'
  return `s-blocker-${subject.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}

/**
 * Steps that establish or repair emergency access, which can never be skipped
 * (prompt 44 item 6).
 *
 * There is no single flag for these, and there could not easily be one: they
 * come from four different builders with four id conventions. validationBlocker
 * is not it - that is true for trusted locations and service accounts too.
 *
 * Skipping one of these is not untidy, it is unsafe. skipped is treated as
 * satisfied in three places (safeTodayFor, isWork, mergePersisted), so skipping
 * the break-glass blocker today would flip every held deny-capable step to
 * "safe today" and drop the hard scheduling edges that keep the exclusion group
 * ahead of the policies that reference it.
 */
export function isEmergencyAccess(step: { id: string; goalId?: string }): boolean {
  return EMERGENCY_ACCESS_STEP_IDS.has(step.id)
}

export const EMERGENCY_ACCESS_STEP_IDS: ReadonlySet<string> = new Set([
  's-prereq-break-glass',
  's-prereq-exclusion-group',
  's-ladder-break-glass-accounts',
  ...GATING_SUBJECTS.map(blockerStepId),
])

/**
 * A check step's Do it (prompt 48.1 item 9): the failing must-fix checks as
 * numbered imperative actions. Could-not-run checks (outcome unknown) and the
 * migration-state checks are Housekeeping, never here; the two attestations are
 * Done-when lines, returned separately.
 */
function checkActions(report: SubjectReport): { actions: string[]; doneWhen: string[] } {
  const failing = report.blocking.filter((r) => r.outcome === 'fail' && !HOUSEKEEPING_ONLY_RULES.has(r.id))
  const actions: string[] = []
  const doneWhen: string[] = []
  for (const r of failing) {
    if (ATTESTATION_RULES.has(r.id)) {
      doneWhen.push(ATTESTATION_DONE_WHEN[r.id] ?? ruleText(r.id).what)
      continue
    }
    const make = RULE_ACTION[r.id]
    actions.push(make ? make(r.finding ?? null) : fallbackAction(ruleText(r.id).what, null))
  }
  return { actions: [...new Set(actions)], doneWhen: [...new Set(doneWhen)] }
}

/**
 * A step per blocking subject. `heldSteps` is how many deny-capable steps this
 * subject is holding, so the impact sentence says what waits on it.
 */
export function blockerSteps(reports: SubjectReport[]): Step[] {
  const out: Step[] = []
  for (const report of reports) {
    if (report.blocking.length === 0 || report.subject === 'exclusionGroup') continue
    const subject = report.subject
    const name = SUBJECT[subject] ?? subject
    const n = report.blocking.length
    // The Do it is numbered imperative actions (prompt 48.1 item 9), not the old
    // finding-to-rule checklist. Attestations become Done-when lines; recommended
    // fixes wait under More; could-not-run checks are Housekeeping only.
    const { actions } = checkActions(report)
    out.push({
      ...STEP_EXTRAS,
      id: blockerStepId(subject),
      goalId: `validation-${subject}`,
      phase: 0,
      kind: 'prerequisite',
      title: name,
      why: BLOCKER_STEP.why(name, n),
      status: 'ready',
      blockedBy: [],
      blockers: [],
      unblockNotes: [],
      population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
      readiness: { family: 'other', percent: null, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: { kind: 'check', summary: actions, json: null, portalSteps: actions, powershell: null },
      checks: stepChecks(report),
      history: [],
      skipReason: null,
      gap: null,
      deliveredBy: [],
      plainTitle: SUBJECT_PLAIN[subject] ?? name,
      forManager: BLOCKER_STEP.forManager(name),
    })
  }
  return out
}

/** The cause a held step carries: the gating step, in the blocked-reason shape (target-state §8.5). */
export function gateReason(reports: SubjectReport[]): { stepId: string; label: string } | null {
  for (const subject of GATING_SUBJECTS) {
    const report = reports.find((r) => r.subject === subject)
    if (report && report.blocking.length > 0) {
      return { stepId: blockerStepId(subject), label: BLOCKED_REASON.after(SUBJECT_PLAIN[subject] ?? SUBJECT[subject] ?? subject) }
    }
  }
  return null
}

export const SEVERITY_LABEL = SEVERITY

