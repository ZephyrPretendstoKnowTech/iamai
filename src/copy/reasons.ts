// Why a goal is not fully in place (prompt 19 audit D2): the sentences the
// Findings page shows under "Why not fully". Built here, not in the engine, so
// every branch (0, 1, all, none) is explicit and lint-checked.
import { count, list } from './statements.ts'
import { engine, pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'

const COVERAGE = engine.coverage

export const REASON = {
  /** The goal's own policy carves out the exclusions group and this policy does not. */
  exclusionMissing: (policy: string): string => fillText(COVERAGE.reason.exclusionMissing, { policy }),
  /** Conditions confine the policy to fewer sign-ins than the baseline's (coverage/classify.ts narrowerConditions), in words. */
  conditionsNarrower: (policy: string, dimensions: string[]): string =>
    fillText(COVERAGE.reason.conditionsNarrower, { policy, conditions: list([...new Set(dimensions.map((d) => COVERAGE.conditions[d] ?? COVERAGE.conditions.unread))]) }),
  /** The goal's satisfiers between them reach fewer guest and external user kinds than its baseline policies. */
  guestTypes: (reached: number, required: number): string => fillText(COVERAGE.reason.guestTypes, { reached, required }),
  /** People the goal expects that no enabled policy includes. */
  notTargeted: (n: number, expected: number): string =>
    n > 0 && n === expected
      ? 'No enabled policy includes anyone this goal should cover'
      : n === 1
        ? 'No enabled policy includes this user'
        : `No enabled policy includes these ${count(n, 'user')}`,
  reportOnly: 'Covered only by a report-only policy, so nothing is enforced yet',
  appsNarrower: (policy: string): string => `${policy} covers fewer apps than the goal expects`,
  /** The tenant policy leaves out applications the baseline member covers (Part C: an exclusion is never silently discarded). */
  appsExcluded: (policy: string, n: number): string =>
    `${policy} leaves ${n === 1 ? 'an application' : `${n} applications`} out that the baseline covers`,
  /** An application filter narrows the scope by an amount IAMAI does not evaluate, so the scope is not proven. */
  appsFiltered: (policy: string): string => `${policy} narrows its applications with a filter IAMAI cannot read`,
  weakerControl: (policy: string, floor: string): string => `${policy} applies but is weaker than the goal needs (${floor})`,
  belowBaseline: (policy: string, floor: string): string => `${policy} meets the goal but not the baseline's stricter version (${floor})`,
  disabledCandidates: (names: string[]): string =>
    names.length === 1 ? `A matching policy is switched off: ${names[0]}` : `${count(names.length, 'matching policy', 'matching policies')} are switched off: ${list(names)}`,
  excludedByRole: (roles: number): string => `Excluded by role (${roles === 1 ? 'one role' : count(roles, 'role')})`,
  guestsExcluded: 'Guests are excluded',
  /** The ids are replaced by names before display (nameifyText), so the account is named (ux-review-06 §14). */
  excludedDirectly: (breakGlass: boolean, assumedNote: string, userIds: string[] = []): string =>
    `Excluded directly${userIds.length > 0 ? `: ${userIds.join(', ')}` : ''}${breakGlass ? ` (break-glass${assumedNote})` : ''}`,
}

/** Why a baseline policy is listed as not assessed (prompt 46 item 14): one reason, at most twelve words. */
export const NOT_ASSESSED = {
  noGoal: 'No security goal in the catalogue matches this policy',
  agentIdentity: 'An agent-identity policy; IAMAI does not assess these yet',
}

/**
 * The one binding reason a blocked row shows (target-state §8.5, prompt 46
 * item 16): at most twelve words, in one of the three pages.plan.blocked shapes.
 * The rest of the reasons stay on the step, under More.
 */
export const BLOCKED_REASON_MAX_WORDS = 12
const BLOCKED = (pages.plan as { blocked: { after: string; readiness: string; count: string; baseline: string; exclusionsGroup: string; devicePlan: string; unsettled: string; sourceMapping: string; pairUnmatched: string; noOperation: string; manualCorrection: string; unverifiedExclusion: string; emergency: string } }).blocked
export const BLOCKED_REASON = {
  after: (stepTitle: string): string => fillText(BLOCKED.after, { stepTitle }),
  reaches: (measure: string, threshold: string, now: string): string => fillText(BLOCKED.readiness, { measure, threshold, value: now }),
  exist: (n: number, thing: string, now: number): string => fillText(BLOCKED.count, { n, thing: count(n, thing).replace(/^\d+ /, ''), have: now }),
  /** The baseline's own definition of a policy contradicts itself (roadmap/baselineConflict.ts): nothing in the tenant holds this step. */
  baseline: BLOCKED.baseline,
  /**
   * The one safety-sensitive choice nobody has made (Foundation C,
   * mapping/safetyChoice.ts `awaitsOperator`). Not work and not a number: the
   * step is waiting on a person, and the row says which person's answer.
   */
  exclusionsGroup: BLOCKED.exclusionsGroup,
  /** The device decision nobody has made (roadmap/generate.ts): the step waits on a person, not on work. */
  devicePlan: BLOCKED.devicePlan,
  /**
   * What holds a policy Foundation A cannot write when no step of the plan is what
   * it waits on (roadmap/stateReason.ts holdReasonFor): a source group no settled
   * reading explains, a pair it cannot match, a step with no policy to write, and
   * emergency access it cannot prove is out of scope.
   */
  unsettled: BLOCKED.unsettled,
  /** The baseline's own references a person has not mapped yet (roadmap/sourceMappings.ts): the policy holds until Plan settings → Baseline mappings answers it. */
  sourceMapping: BLOCKED.sourceMapping,
  pairUnmatched: BLOCKED.pairUnmatched,
  noOperation: BLOCKED.noOperation,
  /** A deployed policy that is not what the plan asked for in a part IAMAI does not write (roadmap/operations.ts `manual-correction`): a person corrects it. */
  manualCorrection: BLOCKED.manualCorrection,
  /** A group a policy names that this scan could not read (roadmap/generate.ts): the goal's coverage cannot be settled until it can. */
  unverifiedExclusion: (group: string): string => fillText(BLOCKED.unverifiedExclusion, { group }),
  emergency: BLOCKED.emergency,
}

/** The measure a readiness threshold is stated against, by family. */
export const READINESS_MEASURE: Record<string, string> = {
  mfa: 'MFA readiness',
  guest: 'guest MFA readiness',
  admin: 'admin readiness',
  device: 'device readiness',
}
