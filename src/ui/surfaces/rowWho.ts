// A plan row's Impact column, once, for the row and the tests: a count of what
// the step changes (derive/whoLine.ts), never a label (step template rule 11;
// walk list 4.x item 25). Pure.
import type { Step } from '../../roadmap/types.ts'
import { structuralWords } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { count, figure, plural } from '../../copy/statements.ts'
import { IMPACT, affectedIds, cohortWords, guestsAmong, whoLine } from '../../derive/whoLine.ts'
import { impactReachOf, reached } from '../../derive/population.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { implementationPackageFor } from './stepPackage.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import { SECURITY_DEFAULTS_STEP_ID } from '../../roadmap/enforceWaits.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'

/** How many emergency access accounts the step needs: the count rule's own minimum (validation/rules.ts bgCount). */
const EMERGENCY_ACCOUNTS_NEEDED = 2
/** The emergency access accounts: the ones chosen, and never fewer than the two the steps need. */
const emergencyAccounts = (chosen: number): string => count(Math.max(EMERGENCY_ACCOUNTS_NEEDED, chosen), 'account')
const EXCLUSIONS_GROUP_STEP_ID = 's-prereq-exclusion-group'
const PASSKEY_SETTINGS_STEP_ID = 's-prereq-passkey-settings'

// These review steps construct their population from the exact accounts to review,
// including inactive accounts. Other prerequisites can carry an empty placeholder
// population, so their topic must not turn into a misleading zero.
const ACCOUNT_REVIEW_STEPS = new Set([
  's-ladder-per-user-mfa-cleanup',
  's-shared-devices',
])
/**
 * Finish Moving Off Per-User MFA counts the accounts still on per-user MFA
 * (walk list 4.x item 25): "3 accounts", and "no accounts" once none is left,
 * never the label "Per-user MFA".
 */
const PER_USER_MFA_STEP_ID = 's-prereq-per-user-mfa'
/**
 * Turn Off Security Defaults counts the policies that take over from security
 * defaults (walk list 4.x item 25: "4 policies"): the section's own policies,
 * the four its content names ("four policies of this plan take over all of it").
 */
const TAKE_OVER_POLICIES = membersOf('core').filter((id) => id.startsWith('s-goal-')).length
/** A step whose content is a Conditional Access policy (content.json steps[].kind). */
const isPolicyStep = (step: Step): boolean => (contentStepFor(step) as { kind?: unknown } | undefined)?.kind === 'policy'
/**
 * The Prepare steps' Impact, counted in what each changes (walk list item 16,
 * owner 2026-09-23; roadmap/generate.ts sets `impactCount`): the dormant
 * accounts still to disable or keep, the admins seen on Outlook or Teams, the
 * service accounts picked, and the plan's policies that wait on the
 * authentication strength and on the trusted network. Never a label, and "no
 * accounts" once nothing is left.
 */
const COUNTED: Readonly<Record<string, readonly [string, string]>> = {
  's-check-dormant-accounts': ['account', 'accounts'],
  's-check-separate-admin-accounts': ['account', 'accounts'],
  's-prereq-service-accounts-group': ['account', 'accounts'],
  's-prereq-auth-strength': ['policy', 'policies'],
  's-prereq-trusted-location': ['policy', 'policies'],
  // The policies Create the Policies in Report-only lists (roadmap/reportOnlyBatch.ts).
  's-create-report-only': ['policy', 'policies'],
}
export function rowWho(step: Step): string {
  // A preparation cohort names its guests beside its people (owner, 2026-09-19): the lead reads the same words.
  if (step.preparation) return step.preparation.ids.length ? cohortWords(step.preparation.ids.length, guestsAmong(step.preparation.ids, step.preparation.guestIds)) : 'User Authentication'
  const counted = COUNTED[step.id]
  if (counted && step.impactCount !== undefined) return count(step.impactCount, counted[0], counted[1])
  // Through count(), as the tile beside it: "3,671 accounts" on both, never "3671".
  if (ACCOUNT_REVIEW_STEPS.has(step.id) && step.population.total > 0) return count(step.population.total, 'account')
  if (step.id === PER_USER_MFA_STEP_ID) return count(step.population.total, 'account')
  // The policies its task turns on (Step.turnsOn, walk list 4.x items 8 and 25): three where one is ruled out.
  if (step.id === SECURITY_DEFAULTS_STEP_ID) return count(step.turnsOn?.length ?? TAKE_OVER_POLICIES, 'policy', 'policies')
  // Prepare Emergency Access Accounts is its accounts: the ones chosen, and never
  // fewer than the two the step needs, so a step with one or none chosen still
  // counts what it is for rather than reading a label.
  if (step.id === BREAK_GLASS_STEP_ID) return emergencyAccounts(step.emergency?.accounts.length ?? 0)
  // Configure Emergency Exclusions and Configure Passkey Authentication count
  // what they change, as 1.1 and 1.4 count their accounts (owner, 2026-09-23):
  // the policies the group must be excluded from, and the people who can register.
  if (step.impactCount !== undefined && step.id === EXCLUSIONS_GROUP_STEP_ID) return count(step.impactCount, 'policy', 'policies')
  if (step.impactCount !== undefined && step.id === PASSKEY_SETTINGS_STEP_ID) return count(step.impactCount, 'person', 'people')
  // A Direction step counts the plan steps its answers decide (walk list item 25; roadmap/direction.ts countDirectionImpact): "N steps", a number even at 0.
  if (step.impactCount !== undefined && isDirectionStep(step.id)) return `${figure(step.impactCount)} ${plural(step.impactCount, 'step')}`
  const namedImpact = step.impactLabel ?? (structuralWords.impactLabels as Record<string, string>)[step.id]
  if (namedImpact) return namedImpact
  // A policy step counts who its policy reaches (walk list 4.x item 25, owner
  // 2026-09-24), never a label: its own scope while it is open (derive/
  // population.ts reached), the tenant policy that delivers it once that is on
  // (R4-30), and where neither scope settles — a group the scan could not read
  // in full, an operation still withheld — the people its goal is about. The
  // row read "Legacy Authentication", "Administrator Accounts" and "User
  // Authentication" there, which counts nothing. Nor does it add the lockout
  // count ("1 person · 1 would be stopped"): the step's Threshold card says who
  // is not ready, and the row says what the step changes.
  // The delivering policies' reach is read only while they still deliver it: a
  // step reopened later in the run (the guests step, delivered by the all-users
  // policy until its own check reopened it) is not reached by their scope
  // (derive/population.ts impactReachOf).
  const policy = isPolicyStep(step)
  const pop = policy ? impactReachOf(step) : reached(step)
  const fallback = implementationPackageFor(step)?.meta.impact?.fallbackLabel ?? structuralWords.impactDefault
  if (pop === null) return fallback
  // A reach of one kind counts that kind: "1 admin", "3 guests", and "2
  // accounts" for accounts that are not people (the service accounts), never "1
  // person" (derive/whoLine.ts populationLine reads `active` the same way).
  const n = affectedIds(pop).length
  if (policy && n > 0) {
    if (pop.admins >= n) return count(n, 'admin')
    if (pop.guests >= n) return count(n, 'guest')
    if (pop.active < n) return count(n, 'account')
  }
  // An empty reach is a fact: a policy that reaches nobody has No user impact; a
  // step with no policy of its own says what it touches — its package's
  // `impact.fallbackLabel` — or the placeholder (U13).
  return whoLine(pop, null, policy || effectsOf(step) !== null ? IMPACT.noUserImpact : fallback)
}

/**
 * A Cleanup row's Impact: who it touches. Verify Emergency Access counts the
 * emergency access accounts as Prepare Emergency Access Accounts does, "2
 * accounts", never "2 people" (owner, 2026-09-23).
 */
export function cleanupRowWho(phase: CleanupPhase, row: CleanupPhase['rows'][number]): string {
  if (row.kind === 'drill') return emergencyAccounts(phase.accountIds.length)
  const accounts = row.kind === 'alerting' ? phase.accountIds : []
  return whoLine({ total: accounts.length, active: accounts.length, admins: 0, guests: 0, ids: accounts, activeIds: accounts, inScope: accounts.length }, null, (structuralWords.cleanupImpacts as Record<string, string>)[row.kind] ?? structuralWords.impactDefault)
}
