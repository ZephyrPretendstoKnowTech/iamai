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
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { COLLECTOR_REGISTRY, capabilityLicence } from '../../graph/collect/registry.ts'
import { CORE_SOURCES } from '../../graph/collect/coreSections.ts'
import { fillText } from '../../content/render.ts'
import type { CollectorSpec } from '../../graph/collect/registry.ts'
import { app, pages, stepById } from '../../content/content.ts'

/** One row of "Every check": what it looks for, what a failure does, why, what it reads and where it comes from. */
export type HowCheckRow = {
  id: string
  what: string
  /** A rule's severity, `housekeeping` for a static rule, whose failure is a Housekeeping line on the Plan, or `prerequisite` for a prerequisite step the policies that need it wait on. */
  severity: RuleSeverity | 'housekeeping' | 'prerequisite'
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
  const P = app.how.prerequisiteChecks
  const prerequisites: HowCheckTable = {
    key: 'prerequisites',
    caption: SUBJECT.authStrength,
    rows: Object.keys(PREREQUISITE_READS).map((stepId) => ({
      id: stepId,
      what: P.rows[stepId]?.what ?? '',
      severity: 'prerequisite' as const,
      severityLabel: P.severity,
      why: fillText(P.rows[stepId]?.why ?? '', { step: stepById[stepId]?.title ?? stepId }),
      needs: needsOf(PREREQUISITE_READS[stepId]),
      source: null,
    })),
  }
  return [...rules, prerequisites, statics]
}

/**
 * The plan's checks that are prerequisite steps rather than registry rules, by
 * step id, with the scan sections each reads. The baseline's authentication
 * strength (generate.ts, s-prereq-auth-strength) reads the scanned strengths;
 * while none matches, the policies that require it wait on the step. How listed
 * it only through the registry's str.* rules, which no plan evaluates, and lost
 * it with them (Phase 2 review).
 */
const PREREQUISITE_READS: Record<string, readonly string[]> = {
  [PREREQ_STEP_ID.authStrength]: ['authStrengths'],
}

/**
 * Limits: every limitation IAMAI states. Connect's scan tile lists its own
 * (pages.connect.scan.limits) and sends the reader here for "its limits in
 * full", so How draws those lines from the same list, then its own, then the
 * no-AI line, which sat outside the list (Phase 2 audit).
 */
export function howLimits(): string[] {
  const connect = (pages.connect as unknown as { scan: { limits: string[] } }).scan.limits
  return [...connect, ...app.how.limitsList, (pages.how as Record<string, string>).noAi]
}

/** One row of "What IAMAI reads"; `endpoints` is the registry's path, then the paths it also reads. */
export type HowReadRow = { name: string; endpoints: string[]; version: CollectorSpec['version']; scopes: string; conditions: string; why: string }
export type HowReadTable = { lane: CollectorSpec['lane']; caption: string; rows: HowReadRow[] }

const LANES: CollectorSpec['lane'][] = ['0', 'A', 'B', 'on-demand']

/** The scan section a registry read fills, in coreSections.ts's naming; null for a read that is not a section. */
function sectionOf(s: CollectorSpec): string | null {
  return s.configKey ? `config:${s.configKey}` : (s.sourceKey ?? null)
}

/**
 * A read's Conditions cell: the licence it needs (the registry's
 * requiredCapability), what the page says of it, and, for a scan section, what a
 * refusal does (coreSections.ts: a core section builds no plan, any other is
 * named on Connect by unreadSources).
 */
function conditionsOf(s: CollectorSpec): string {
  const W = app.how.readConditions
  const section = sectionOf(s)
  return [
    s.requiredCapability ? fillText(W.licence, { licence: capabilityLicence(s.requiredCapability) }) : null,
    app.how.readRows[s.name]?.note ?? null,
    section === null ? null : (CORE_SOURCES as readonly string[]).includes(section) ? W.core : W.section,
  ].filter((x): x is string => x !== null).join(' ')
}

/**
 * "What IAMAI reads": one table per lane, one row per registry read. The
 * registry's gate and purpose are developer notes; the page shows the plain
 * lines in content (app.how.readRows), keyed by the registry's name. It printed
 * the notes, "none" for twelve reads among them (Phase 2 audit).
 */
export function howReadTables(): HowReadTable[] {
  return LANES.map((lane) => ({
    lane,
    caption: app.how.lanes[lane],
    rows: COLLECTOR_REGISTRY.filter((s) => s.lane === lane).map((s) => ({
      name: s.name,
      endpoints: [s.endpoint, ...(s.alsoReads ?? [])],
      version: s.version,
      scopes: s.scopes.join(', '),
      conditions: conditionsOf(s),
      why: app.how.readRows[s.name]?.why ?? '',
    })),
  }))
}
