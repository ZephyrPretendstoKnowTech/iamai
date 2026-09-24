// A plan row's Impact column, once, for the row and the tests: who the step's
// own policies reach (derive/whoLine.ts), the row's gap clause, and, on a
// strength policy, its lockout count when it is not zero ("3 people · 2 without a
// passkey"). Pure.
import type { Step } from '../../roadmap/types.ts'
import { app, structuralWords } from '../../content/content.ts'
import { count, figure, plural } from '../../copy/statements.ts'
import { fillText } from '../../content/render.ts'
import { IMPACT, cohortWords, guestsAmong, whoLine } from '../../derive/whoLine.ts'
import { reached } from '../../derive/population.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { REPORT_ONLY_GAP } from '../../coverage/verdict.ts'
import { implementationPackageFor } from './stepPackage.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'

/** How many emergency access accounts the step needs: the count rule's own minimum (validation/rules.ts bgCount). */
const EMERGENCY_ACCOUNTS_NEEDED = 2
/** The emergency access accounts: the ones chosen, and never fewer than the two the steps need. */
const emergencyAccounts = (chosen: number): string => count(Math.max(EMERGENCY_ACCOUNTS_NEEDED, chosen), 'account')
const EXCLUSIONS_GROUP_STEP_ID = 's-prereq-exclusion-group'
const PASSKEY_SETTINGS_STEP_ID = 's-prereq-passkey-settings'

const IMPACT_TOPICS: Record<string, string> = {
  'guests-mfa': 'Guest Accounts', 'mfa-all-users': 'User Authentication', 'admins-phishing-resistant': 'Administrator Accounts',
  'geo-restriction': 'Work Countries', 'block-legacy-auth': 'Legacy Authentication', 'block-device-code': 'Device Code Sign-ins',
  'block-auth-transfer': 'Authentication Transfer', 'require-managed-device': 'Managed Devices', 'block-unsupported-platforms': 'Device Platforms',
  'session-lifetime': 'Session Duration', 'admin-session': 'Administrator Sessions', 'sign-in-risk': 'Risky Sign-ins', 'sign-in-risk-medium': 'Risky Sign-ins',
  'user-risk': 'User Risk', 'user-risk-medium': 'User Risk', 'register-info-protected': 'Method Registration',
  'device-registration-mfa': 'Device Registration', 'token-protection': 'Sign-in Tokens', 'service-accounts-trusted-network': 'Service Accounts',
}
// These review steps construct their population from the exact accounts to review,
// including inactive accounts. Other prerequisites can carry an empty placeholder
// population, so their topic must not turn into a misleading zero.
const ACCOUNT_REVIEW_STEPS = new Set([
  's-prereq-per-user-mfa',
  's-ladder-per-user-mfa-cleanup',
  's-shared-devices',
])
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
}
export function rowWho(step: Step): string {
  // A preparation cohort names its guests beside its people (owner, 2026-09-19): the lead reads the same words.
  if (step.preparation) return step.preparation.ids.length ? cohortWords(step.preparation.ids.length, guestsAmong(step.preparation.ids, step.preparation.guestIds)) : 'User Authentication'
  const counted = COUNTED[step.id]
  if (counted && step.impactCount !== undefined) return count(step.impactCount, counted[0], counted[1])
  // Through count(), as the tile beside it: "3,671 accounts" on both, never "3671".
  if (ACCOUNT_REVIEW_STEPS.has(step.id) && step.population.total > 0) return count(step.population.total, 'account')
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
  // Who the row names is who the step's own policies name (derive/population.ts
  // reached), never the population the goal handed it. The gap beside it is the
  // goal's coverage and stays the goal's: "3 people · covers 1 of 4 active".
  const pop = reached(step)
  // Impact is who the step reaches. A policy whose scope could not be settled
  // claims no count and no names: the column says the reach is not established,
  // never zero, and never the goal's gap clause standing in for it ("does not
  // exclude the exclusions group" says what is wrong with a policy, not who it
  // affects).
  if (pop === null) return IMPACT_TOPICS[step.goalId] ?? implementationPackageFor(step)?.meta.impact?.fallbackLabel ?? structuralWords.impactDefault
  // Nor does the column restate the state: "report-only, not enforced" beside a
  // row whose status word is Report-only said the same thing twice.
  const gap = step.gapShort ?? step.gap ?? null
  // An empty reach is a fact: a policy that reaches nobody has no user impact; a
  // step with no policy of its own says what it touches — its package's
  // `impact.fallbackLabel` — or the placeholder (U13).
  const none = effectsOf(step) === null ? (implementationPackageFor(step)?.meta.impact?.fallbackLabel ?? structuralWords.impactDefault) : IMPACT.noUserImpact
  const head = whoLine(pop, null, none)
  return step.lockout ? `${head} · ${fillText(app.plan.lockoutSuffix, { n: step.lockout })}` : head
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
