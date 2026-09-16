// A plan row's Impact column, once, for the row and the tests: who the step's
// own policies reach (derive/whoLine.ts), the row's gap clause, and, on a
// strength policy, its lockout count when it is not zero ("3 people · 2 without a
// passkey"). Pure.
import type { Step } from '../../roadmap/types.ts'
import { app, structuralWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { IMPACT, whoLine } from '../../derive/whoLine.ts'
import { reached } from '../../derive/population.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { REPORT_ONLY_GAP } from '../../coverage/verdict.ts'
import { implementationPackageFor } from './stepPackage.ts'

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
  's-check-dormant-accounts', 's-ladder-stale-accounts', 's-prereq-per-user-mfa',
  's-ladder-per-user-mfa-cleanup', 's-check-separate-admin-accounts',
  's-shared-devices', 's-ladder-break-glass-accounts',
])
export function rowWho(step: Step): string {
  if (step.preparation) return step.preparation.ids.length ? `${step.preparation.ids.length} ${step.preparation.ids.length === 1 ? 'person' : 'people'}` : 'User Authentication'
  if (ACCOUNT_REVIEW_STEPS.has(step.id) && step.population.total > 0) {
    return `${step.population.total} ${step.population.total === 1 ? 'account' : 'accounts'}`
  }
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
