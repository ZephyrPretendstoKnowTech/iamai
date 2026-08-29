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
import { BLOCKER_STEP, SEVERITY, SUBJECT, SUBJECT_PLAIN, SUBJECT_WHERE } from '../copy/validation.ts'
import { ruleText } from '../validation/rules.ts'
import type { RuleResult, RuleSubject } from '../validation/rules.ts'
import type { SubjectReport } from '../validation/report.ts'
import { STEP_EXTRAS } from './stepDefaults.ts'
import type { Step } from './types.ts'

/** Subjects whose blockers hold every step that can deny access (design §2). */
export const GATING_SUBJECTS: RuleSubject[] = ['breakGlass', 'exclusionGroup']

export function blockerStepId(subject: RuleSubject): string {
  return `s-blocker-${subject.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}

/** One checklist line: the fact found, then what clears it. */
function checklistLine(r: RuleResult, label: string | null): string {
  const what = ruleText(r.id).what
  const where = r.fix ? ` (${r.fix.label})` : ''
  const who = label ? `${label}: ` : ''
  return `${who}${r.finding ?? what} → ${what}${where}`
}

function linesFor(report: SubjectReport, results: RuleResult[]): string[] {
  const labelOf = new Map<RuleResult, string | null>()
  const multi = report.targets.length > 1
  for (const t of report.targets) for (const r of t.results) labelOf.set(r, multi ? t.label : null)
  return results.map((r) => checklistLine(r, labelOf.get(r) ?? null))
}

/**
 * A step per blocking subject. `heldSteps` is how many deny-capable steps this
 * subject is holding, so the impact sentence says what waits on it.
 */
export function blockerSteps(reports: SubjectReport[], heldSteps: number): Step[] {
  const out: Step[] = []
  for (const report of reports) {
    if (report.blocking.length === 0) continue
    const subject = report.subject
    const name = SUBJECT[subject] ?? subject
    const n = report.blocking.length
    const held = GATING_SUBJECTS.includes(subject) ? heldSteps : 0
    const summary = [BLOCKER_STEP.checklistLead, ...linesFor(report, report.blocking)]
    if (report.warnings.length > 0) summary.push(BLOCKER_STEP.recommended, ...linesFor(report, report.warnings))
    out.push({
      ...STEP_EXTRAS,
      id: blockerStepId(subject),
      goalId: `validation-${subject}`,
      phase: 0,
      kind: 'prerequisite',
      title: name,
      why: BLOCKER_STEP.why(name, n),
      whyAttribution: null,
      whyLink: null,
      status: 'ready',
      blockedBy: [],
      blockers: [],
      unblockNotes: [],
      population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
      readiness: { family: 'other', percent: null, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: { kind: 'prerequisite', summary, json: null, portalSteps: [], powershell: null },
      exitCriteria: [BLOCKER_STEP.exit(n), ...report.blocking.map((r) => ruleText(r.id).what)],
      rollback: BLOCKER_STEP.whatChanges,
      history: [],
      skipReason: null,
      deliveredBy: [],
      stateReason: '',
      impact: BLOCKER_STEP.impact(n, held),
      validationBlocker: true,
      whatChanges: BLOCKER_STEP.whatChanges,
      plainTitle: SUBJECT_PLAIN[subject] ?? name,
      forManager: BLOCKER_STEP.forManager(name),
      verify: {
        // A check that could not run offers no path of its own; the subject's
        // own screen is always where it is settled.
        where: (() => {
          const paths = [...new Set(report.blocking.map((r) => r.fix?.label).filter((x): x is string => typeof x === 'string'))]
          return paths.length > 0 ? paths : [SUBJECT_WHERE[subject] ?? name]
        })(),
        filter: null,
        good: BLOCKER_STEP.exit(n),
      },
    })
  }
  return out
}

/**
 * A subject with warnings and no blockers earns no step of its own; its
 * recommended fixes are attached to the step that already covers the same
 * object, so they appear in the plan rather than only in Setup (design §2).
 */
export function attachWarnings(report: SubjectReport, host: Step): void {
  if (report.warnings.length === 0) return
  const lines = linesFor(report, report.warnings)
  host.action.summary = [...host.action.summary, BLOCKER_STEP.recommended, ...lines]
  const first = report.warnings[0].finding ?? lines[0]
  host.impact = `${host.impact} ${BLOCKER_STEP.alsoRecommended(report.warnings.length, first)}`.trim()
}

/** The sentence a held step shows: the subject, and how many items are open. */
export function gateReason(reports: SubjectReport[]): { stepId: string; label: string } | null {
  for (const subject of GATING_SUBJECTS) {
    const report = reports.find((r) => r.subject === subject)
    if (report && report.blocking.length > 0) {
      return { stepId: blockerStepId(subject), label: BLOCKER_STEP.blockedReason(SUBJECT[subject] ?? subject, report.blocking.length) }
    }
  }
  return null
}

export const SEVERITY_LABEL = SEVERITY
