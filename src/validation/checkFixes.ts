// The one-to-one map between the validation rules and the content file's
// checkFixes templates (prompt 52, walk-51 item 14). The emergency-access and
// exclusions-group steps render one numbered fix line per failing check, filled
// from that check's structured values; the How page lists the same rules, so the
// two can never disagree. A rule with no template, or a template with no rule,
// is a defect the content test names.
//
// Pure: no DOM, no network.
import type { SubjectReport } from './report.ts'

/** rule id → the checkFixes key in content.json (s-prereq-break-glass / s-prereq-exclusion-group). */
export const RULE_TO_FIX: Record<string, string> = {
  'bg.count': 'second-account',
  'bg.role.permanentGa': 'permanent-global-admin',
  'bg.cloudOnly': 'cloud-only',
  'bg.initialDomain': 'onmicrosoft-domain',
  'bg.enabled': 'enabled',
  'bg.excludedFromAllPolicies': 'excluded-everywhere',
  'bg.excludedFromReportOnly': 'report-only-excluded',
  'bg.microsoftManaged': 'managed-policies-excluded',
  'bg.notInDynamicScope': 'no-dynamic-group',
  'bg.hasMfaMethod': 'mfa-method',
  'bg.separateDevices': 'shared-authenticator',
  'bg.notPersonal': 'not-a-person',
  'bg.phishingResistant': 'phishing-resistant',
  'bg.methodDiversity': 'method-diversity',
  'bg.perUserMfaOff': 'auth-methods-migration',
  'bg.noLicenceNeeded': 'no-licence-no-mailbox',
  'bg.nameIdentifiesPurpose': 'display-name',
  'bg.lastSignIn': 'recent-sign-in',
  'xg.membersApproved': 'members-only-emergency',
  'xg.noExtraAdmins': 'no-admin-members',
  'xg.notDynamic': 'not-dynamic',
  'xg.usedConsistently': 'excluded-from-every-policy',
  'xg.notMailEnabled': 'not-mail-enabled',
}

/**
 * Rules that carry no checkFixes template — informational notes, per-user-MFA
 * state Graph cannot read structurally, and the group-size rule, whose fact
 * (an extra member) is the members-only-emergency line (step-audit item 2: one
 * fix line per fact).
 */
export const RULES_WITHOUT_TEMPLATE = new Set(['bg.drilled', 'bg.credentialStorage', 'bg.signInMonitoring', 'bg.signInCountries', 'bg.mfaSeen', 'xg.sizeReasonable'])

export type StepCheckItem = { fix: string; subject: string; target: string | null; values: Record<string, unknown> }
export type StepChecks = { failing: number; total: number; items: StepCheckItem[] }

/**
 * The failing checks a step renders, and the counts for its "{failing} of
 * {total} checks fail today" line. `total` counts the mapped checks that ran
 * (pass or fail); `failing` counts the fail results, one per rendered fix line
 * (walk-51 item 14: the count line equals the number of fail results). A
 * not-assessed check (a read that could not run) is neither, and renders
 * nothing. Names are resolved by the caller, which holds the directory.
 */
export function stepChecks(report: SubjectReport): StepChecks {
  const results = report.targets.flatMap((t) => t.results)
  const ran = results.filter((r) => RULE_TO_FIX[r.id] !== undefined && (r.outcome === 'pass' || r.outcome === 'fail'))
  const fails = ran.filter((r) => r.outcome === 'fail')
  return {
    failing: fails.length,
    total: ran.length,
    items: fails.map((r) => ({ fix: RULE_TO_FIX[r.id], subject: r.subject, target: r.target, values: { ...(r.values ?? {}) } })),
  }
}
