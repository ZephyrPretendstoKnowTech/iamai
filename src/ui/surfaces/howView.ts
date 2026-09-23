// How IAMAI works, as the data the page draws (Phase 2 audit). How.tsx renders
// these tables and nothing else, so a test can read what the page says without a
// DOM, and the page stays generated from the registries the product runs from.
//
// Pure: no DOM, no network.
import { REGISTRY, ruleText, citationFor } from '../../validation/rules.ts'
import type { RuleSeverity } from '../../validation/rules.ts'
import { EVALUATED_SUBJECTS } from '../../validation/report.ts'
import { ATTESTATION_RULES, SEVERITY, SUBJECT, NEED_LABEL, CITATION, FIELD_PRACTICE } from '../../copy/validation.ts'
import { STATIC_RULE_READS } from '../../roadmap/staticRules.ts'
import { app } from '../../content/content.ts'

/** One row of "Every check": what it looks for, what a failure does, why, what it reads and where it comes from. */
export type HowCheckRow = {
  id: string
  what: string
  /** A rule's severity, or `housekeeping` for a static rule, whose failure is a Housekeeping line on the Plan. */
  severity: RuleSeverity | 'housekeeping'
  severityLabel: string
  why: string
  needs: string
  /** Where the check comes from: a published source, field practice (no url), or nothing to cite (null). */
  source: { label: string; url: string | null } | null
}

export type HowCheckTable = { key: string; caption: string; rows: HowCheckRow[] }

function needsOf(needs: readonly string[]): string {
  return needs.length === 0 ? 'nothing' : needs.map((n) => NEED_LABEL[n] ?? n).join(', ')
}

/**
 * "Every check": one table per rule subject a plan evaluates
 * (validation/report.ts EVALUATED_SUBJECTS), then the static rules the plan runs
 * on the tenant's own policies (roadmap/staticRules.ts, one per engine.staticRules
 * template). The registry's pilot-group and authentication-strength rules are
 * not here: no plan evaluates them, and How listed them as checks IAMAI runs.
 */
export function howCheckTables(): HowCheckTable[] {
  const rules: HowCheckTable[] = EVALUATED_SUBJECTS.map((subject) => ({
    key: subject,
    caption: SUBJECT[subject] ?? subject,
    rows: REGISTRY.filter((r) => r.subject === subject).map((r) => {
      const c = citationFor(r.id)
      return {
        id: r.id,
        what: ruleText(r.id).what,
        severity: r.severity,
        severityLabel: SEVERITY[r.severity as RuleSeverity],
        why: ruleText(r.id).why,
        // A check that passes on the operator's own answer reads nothing from the
        // tenant; "nothing" read as a fact IAMAI checks (Phase 2 audit).
        needs: ATTESTATION_RULES.has(r.id) ? NEED_LABEL.answers : needsOf(r.needs),
        source: !c || c === FIELD_PRACTICE ? { label: CITATION.fieldPracticeShort, url: null } : { label: c.label, url: c.url },
      }
    }),
  }))
  const S = app.how.staticChecks
  const statics: HowCheckTable = {
    key: 'staticRules',
    caption: S.caption,
    rows: Object.keys(STATIC_RULE_READS).map((key) => ({
      id: key,
      what: S.rows[key]?.what ?? '',
      severity: 'housekeeping' as const,
      severityLabel: S.severity,
      why: S.rows[key]?.why ?? '',
      needs: needsOf(STATIC_RULE_READS[key]),
      source: null,
    })),
  }
  return [...rules, statics]
}
