// The sets every number is counted over (prompt 37 §1).
//
// Review 07 found the same quantity reported three ways on one screen:
// Progress 11/31, Plan chips summing to 31 with Done 11, Findings 8 of 27
// goals (T3); "13 users in the directory" beside "3 of 12 enabled users"
// (T11); a step header saying "2 active" while the summary said 4 (T11 again).
// None of those were arithmetic errors. Each number was correct about the set
// it counted, and no two surfaces counted the same set.
//
// So the sets live here, named, with the reason each boundary is where it is.
// A page may choose which set to report. It may not invent one.
//
// Pure: no DOM, no network, no clock. Anything time-dependent takes `now` as an
// argument, because a count that reads the clock changes when nothing changed —
// which is how the Progress badge came to show 9, then 11, then 9 in one
// session with no re-scan (T5).
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { CoverageReport, GoalResult } from '../coverage/types.ts'
import type { Step } from '../roadmap/types.ts'
import { INACTIVE_DAYS } from '../scoring/mfaViability.ts'
import { adminUserIds } from '../roles.ts'
import { EXCHANGE_PLANS } from '../mapping/serviceAccounts.ts'

// ---------- people ----------

/**
 * An account that is not a person: a shared mailbox, a room or equipment
 * resource, a service identity. They inflate every readiness population they
 * land in, because nobody is ever going to register MFA for a meeting room
 * (T12: "Feedback Mailbox" counted as a person with "No method").
 *
 * Two signals, both from fields the snapshot already carries. A licence set
 * consisting only of Exchange plans is a mailbox — the same predicate the
 * service-account detector already uses. An account the operator has confirmed
 * as a service account is one by declaration.
 *
 * Deliberately narrow. A quiet person with no department is still a person, so
 * the profile-shaped signals the detector uses to *suggest* candidates are not
 * used to *exclude* anyone here: suggesting wrongly costs a glance, excluding
 * wrongly hides someone from a plan that was meant to protect them.
 */
export function isNonPerson(u: UserRow, confirmedServiceAccountIds: ReadonlySet<string>): boolean {
  if (confirmedServiceAccountIds.has(u.id)) return true
  // Sign-in blocked. A shared mailbox or a resource is created with sign-in
  // disabled; it holds no person, and a policy cannot lock anybody out of it
  // (target-state §8.1, prompt 46 item 7).
  if (u.accountEnabled === false) return true
  const plans = u.assignedPlans.filter((p) => p.capabilityStatus === '' || p.capabilityStatus === 'Enabled')
  // A mailbox with no service plans and no sign-in on record is a shared
  // mailbox somebody created without blocking sign-in. The address is the tell:
  // an account with no plans and no mail is just an unlicensed person.
  if (u.mail && plans.length === 0 && !u.lastSuccessfulSignIn) return true
  return plans.length > 0 && plans.every((p) => EXCHANGE_PLANS.has(p.servicePlanId.toLowerCase()))
}

/** Everyone in the directory who is a person. Guests included: they sign in too. */
export function personAccounts(snapshot: TenantSnapshot, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  return snapshot.users.filter((u) => !isNonPerson(u, confirmedServiceAccountIds))
}

/**
 * People who can sign in. `accountEnabled` is nullable in Graph and a null
 * means the field was not returned, not that the account is disabled, so the
 * test is `!== false` — the same way every existing caller reads it.
 */
export function enabledUsers(snapshot: TenantSnapshot, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  return personAccounts(snapshot, confirmedServiceAccountIds).filter((u) => u.accountEnabled !== false)
}

/**
 * Enabled people who have signed in inside the activity window. One rule, one
 * window (INACTIVE_DAYS), and `now` is passed in so two surfaces rendering the
 * same plan cannot disagree because they asked the clock at different moments.
 *
 * A user with no recorded sign-in is not active: absence of evidence is not
 * evidence of activity, and counting them as active is what makes a readiness
 * denominator larger than the number of people who could possibly be ready.
 */
export function activeUsers(snapshot: TenantSnapshot, now: string, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  const cutoff = Date.parse(now) - INACTIVE_DAYS * 86_400_000
  return enabledUsers(snapshot, confirmedServiceAccountIds).filter((u) => {
    if (!u.lastSuccessfulSignIn) return false
    const at = Date.parse(u.lastSuccessfulSignIn)
    return Number.isFinite(at) && at >= cutoff
  })
}

/**
 * Enabled people holding a role in the admin catalogue. `adminUserIds` in
 * roles.ts is the one definition of "admin"; this narrows it to accounts that
 * can actually sign in, so the admin count and the enabled count are subsets of
 * one another rather than two unrelated numbers.
 */
export function adminUsers(snapshot: TenantSnapshot, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  return enabledUsers(snapshot, confirmedServiceAccountIds).filter((u) => admins.has(u.id))
}

/**
 * Enabled people who are not active: never signed in, or inactive 90+ days
 * (target-state §8.1, prompt 46 item 7). Shown, listed, never in a
 * denominator, and never a reason to delay enforcement — nothing can lock out
 * an account nobody signs into. They carry a risk of a different kind: whoever
 * signs in first registers the MFA method. Wave 0 asks the operator to decide
 * on each.
 */
export function notActiveUsers(snapshot: TenantSnapshot, now: string, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  const active = new Set(activeUsers(snapshot, now, confirmedServiceAccountIds).map((u) => u.id))
  return enabledUsers(snapshot, confirmedServiceAccountIds).filter((u) => !active.has(u.id))
}

/** Every people-count on one screen, over one directory, at one instant. */
export type PeopleCounts = { directory: number; enabled: number; active: number; notActive: number; admins: number }

export function peopleCounts(snapshot: TenantSnapshot, now: string, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): PeopleCounts {
  return {
    directory: personAccounts(snapshot, confirmedServiceAccountIds).length,
    enabled: enabledUsers(snapshot, confirmedServiceAccountIds).length,
    active: activeUsers(snapshot, now, confirmedServiceAccountIds).length,
    notActive: notActiveUsers(snapshot, now, confirmedServiceAccountIds).length,
    admins: adminUsers(snapshot, confirmedServiceAccountIds).length,
  }
}

// ---------- steps ----------

/**
 * The steps a plan is measured against. A skipped step is a decision the
 * operator already made, so counting it as outstanding work misreports the
 * plan; counting it in the denominator makes the plan look permanently
 * unfinishable.
 *
 * This existed already, in tracking.ts, and the Overview tile used it while the
 * Plan chips counted every step including skipped ones — which is why the chips
 * summed to 31 and the badge read 11/31 over a different 31 (T2, T3).
 */
export function trackableSteps(steps: Step[]): Step[] {
  return steps.filter((s) => s.status !== 'skipped')
}

/** Steps that are finished, over the trackable set. */
export function doneSteps(steps: Step[]): Step[] {
  return trackableSteps(steps).filter((s) => s.status === 'done')
}

/** Steps still to do: trackable, not done. The set "Do this next" draws from. */
export function outstandingSteps(steps: Step[]): Step[] {
  return trackableSteps(steps).filter((s) => s.status !== 'done')
}

/**
 * Steps that can deny access, over the trackable set. The population the
 * enforcement language is about ("N steps that can deny access are held"), and
 * the same test the ring generator uses, so a step described as deniable is
 * also a step that got rings.
 */
export function denyingSteps(steps: Step[]): Step[] {
  return trackableSteps(steps).filter((s) => s.rings.length > 0)
}

// ---------- goals ----------

/**
 * The goals a tenant is scored against: every goal the coverage engine
 * evaluated, minus the ones that do not apply and the ones a licence puts out
 * of reach. This is the denominator in "N of M security goals are in place".
 *
 * The Findings page used to pair this numerator with a denominator from
 * `goalsCoveredBy`, which counts matched goals in the *unfiltered* baseline
 * package — a different set over different data, which is how the page came to
 * say "1 goal in this baseline, 16 apply to this tenant" (T3).
 */
export function applicableGoals(report: CoverageReport): GoalResult[] {
  return report.results.filter((r) => r.status !== 'not-applicable' && r.status !== 'licence-limited')
}

export type GoalCounts = { applicable: number; inPlace: number; partly: number; missing: number; unknown: number }

/**
 * The four states a goal can be in, over the applicable set, plus the set size.
 * `inPlace + partly + missing + unknown === applicable` always — the previous
 * inline version left `unknown` out of every numerator while leaving it in the
 * denominator, so the three published numbers silently failed to add up.
 */
export function goalCounts(report: CoverageReport): GoalCounts {
  const applicable = applicableGoals(report)
  const is = (...statuses: GoalResult['status'][]): number => applicable.filter((r) => statuses.includes(r.status)).length
  return {
    applicable: applicable.length,
    inPlace: is('enforced'),
    partly: is('partial', 'below-baseline'),
    missing: is('absent'),
    unknown: is('unknown'),
  }
}

/**
 * Steps nothing can start yet. The one blocked set (prompt 40 §9).
 *
 * Five places counted this independently and printed three different numbers on
 * one screen: "20 steps that can deny access are held", "15 blocked", and "18
 * steps waiting on Setup question 2" (review-08 A9). They were not disagreeing
 * about arithmetic — they were three different subsets, each described as
 * though it were the whole. So the set is defined once, and anything narrower
 * is expressed as a subset of it rather than as its own count.
 */
export function blockedSteps(steps: Step[]): Step[] {
  return trackableSteps(steps).filter((s) => s.status === 'blocked')
}

/** The blocked steps a particular step is holding up. A subset, and named as one. */
export function heldBy(steps: Step[], blockerStepId: string): Step[] {
  return blockedSteps(steps).filter((s) => s.blockedBy.includes(blockerStepId))
}

/** The blocked steps waiting on a Setup answer, by question number. */
export function waitingOnSetup(steps: Step[]): Map<number, Step[]> {
  const out = new Map<number, Step[]>()
  for (const s of blockedSteps(steps)) {
    for (const b of s.blockers) {
      if (b.kind !== 'setup') continue
      out.set(b.questionNumber, [...(out.get(b.questionNumber) ?? []), s])
    }
  }
  return out
}
