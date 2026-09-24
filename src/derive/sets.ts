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
import { sharedDeviceIds } from './sharedDevices.ts'
import { READINESS_WINDOW_DAYS, devicesSeen } from '../scoring/phishingResistant.ts'
import { isPhoneOs } from './platforms.ts'

/**
 * The accounts the plan's decisions say are not people: the confirmed service
 * accounts and the confirmed emergency accounts (which exist to survive every
 * policy, never to be rolled out to). A nominated emergency account is not in
 * it: a nomination is evidence, and the account stays a person until the
 * operator chooses it (mapping/emergencyChoice.ts). One set, passed wherever
 * the people sets are built, so Today's count and table, the campaign, the
 * readiness strip and the dormant step read one population; Inventory and the
 * emergency step still list them. Every `notPeople` parameter below is this set.
 *
 * It carries the saved shared-device answer too, where there is one
 * (`sharedDeviceUserIds`), which the people sets read in place of the detection,
 * as they read the saved service accounts.
 */
export function notPeopleIds(mapping: AccountDecisions): Set<string> & NotPeople {
  const out = new Set([...mapping.serviceAccountUserIds, ...mapping.breakGlassUserIds])
  return mapping.sharedDeviceUserIds === undefined ? out : Object.assign(out, { sharedDeviceUserIds: mapping.sharedDeviceUserIds })
}

/** The not-people set (`notPeopleIds`), with the saved shared-device answer where there is one. */
export type NotPeople = ReadonlySet<string> & { readonly sharedDeviceUserIds?: readonly string[] }

/** The shared-device accounts: the saved answer where there is one, the detection (derive/sharedDevices.ts) only while it is unanswered. */
function sharedIdsOf(snapshot: TenantSnapshot, saved: readonly string[] | undefined): Set<string> {
  return new Set(saved ?? sharedDeviceIds(snapshot))
}

// ---------- what an account is ----------

/** An account that is not a person, by why: listed wherever accounts are listed, counted in no people population. */
export type NotPersonKind = 'emergency' | 'service' | 'shared' | 'disabled'
/** What an account is. One answer per account; every people set in this module is the `person` answer. */
export type AccountKind = 'person' | NotPersonKind

/** The decisions the classification reads: the confirmed emergency and service accounts, and the saved shared-device answer (undefined while unanswered), by object id. */
export type AccountDecisions = { breakGlassUserIds: readonly string[]; serviceAccountUserIds: readonly string[]; sharedDeviceUserIds?: readonly string[] }

/**
 * The one classification of an account, by object id, first answer wins:
 *
 *   emergency  the operator chose it on the emergency step (never a nomination)
 *   service    the operator confirmed it, or an enabled account shaped like a
 *              mailbox (isNonPerson)
 *   shared     the saved shared-device answer; while it is unanswered, a Teams
 *              Rooms or shared-device licence, or sign-ins only from a Teams
 *              device (derive/sharedDevices.ts)
 *   disabled   sign-in blocked
 *   person     everyone else, guests included: they sign in too
 *
 * The readiness ladder lists the first four by kind; `personAccounts` and every
 * set built on it count the fifth. Two surfaces that disagree about whether an
 * account is a person are two readings, and this is the only one.
 */
export function accountKinds(snapshot: TenantSnapshot, decisions: AccountDecisions): Map<string, AccountKind> {
  const emergency = new Set(decisions.breakGlassUserIds)
  const service = new Set(decisions.serviceAccountUserIds)
  const shared = sharedIdsOf(snapshot, decisions.sharedDeviceUserIds)
  return new Map(snapshot.users.map((u) => [u.id, kindOf(u, emergency, service, shared)]))
}

function kindOf(u: UserRow, emergency: ReadonlySet<string>, service: ReadonlySet<string>, shared: ReadonlySet<string>): AccountKind {
  if (emergency.has(u.id)) return 'emergency'
  if (service.has(u.id) || (u.accountEnabled !== false && isNonPerson(u, service))) return 'service'
  if (shared.has(u.id)) return 'shared'
  if (u.accountEnabled === false) return 'disabled'
  return 'person'
}

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

/**
 * Everyone in the directory who is a person (`accountKinds`' person answer).
 * Guests included: they sign in too. A shared device is not one: nobody
 * registers a passkey for a boardroom, and counting it put 31 active people on
 * one Plan step beside 30 on the next.
 */
export function personAccounts(snapshot: TenantSnapshot, notPeople: NotPeople = new Set()): UserRow[] {
  // The signed-in account is a person like any other: the directory decides, never who ran the scan.
  const shared = sharedIdsOf(snapshot, notPeople.sharedDeviceUserIds)
  const chosen = new Set<string>()
  return snapshot.users.filter((u) => kindOf(u, chosen, notPeople, shared) === 'person')
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
 * A person's last successful sign-in: the later of the directory's
 * signInActivity and the newest successful sign-in in the records (prompt 62).
 * The directory's date lags, and an account seen signing in is not "never
 * signed in". The one reading every activity rule takes (scoring/mfaViability.ts too).
 */
export function lastSuccessOf(snapshot: Pick<TenantSnapshot, 'signInEvidence'>, u: Pick<UserRow, 'id' | 'lastSuccessfulSignIn'>): string | null {
  const records = (snapshot.signInEvidence?.[u.id]?.platforms ?? []).map((p) => p.at).sort().pop() ?? null
  return [u.lastSuccessfulSignIn, records].filter((x): x is string => !!x).sort().pop() ?? null
}

/**
 * Whether this person's successful-sign-in activity was read at all. Without
 * Entra ID P1 Graph withholds `signInActivity` from the directory read and the
 * sign-in log with it (graph/collect/collectors.ts collectUsers), so every
 * person comes back with no date — which is NOT READ, never "never signed in".
 * The one reading; scoring/fromSnapshot.ts takes it for `successfulActivityAvailable`
 * and notActiveUsers takes it below, so the dormant list and the activity score
 * cannot disagree (V1 audit S4-21).
 */
export function activityKnown(u: Pick<UserRow, 'successfulSignInActivityRead' | 'lastSuccessfulSignIn'>): boolean {
  return u.successfulSignInActivityRead === true || u.lastSuccessfulSignIn !== null
}

/**
 * Whether nothing this scan read can date this person's activity: the directory
 * returned no successful-sign-in activity for them and the sign-in records hold
 * no sign-in of theirs. `notActiveUsers` cannot judge such a person and leaves
 * them out; `activityUnreadUsers` counts them. One predicate, so the list and
 * the count of what the list could not judge cannot disagree.
 */
function activityUnread(snapshot: Pick<TenantSnapshot, 'signInEvidence'>, u: UserRow): boolean {
  return !activityKnown(u) && (snapshot.signInEvidence?.[u.id]?.platforms ?? []).length === 0
}

/**
 * Enabled people whose activity nothing this scan read can date: the accounts
 * `notActiveUsers` leaves out. A refused signInActivity read (the Users source
 * `partial`, graph/collect/collectors.ts collectUsers) leaves every person here
 * and the dormant list empty, and an empty list read as a directory with
 * nothing dormant — "Ready · Review" over no accounts, the refusal said nowhere
 * (R4-49). The dormant step counts them on that read (roadmap/generate.ts).
 * On a read that succeeded this is not a count of anything unread: Graph leaves
 * signInActivity out for an account that never signed in.
 */
export function activityUnreadUsers(snapshot: TenantSnapshot, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  return enabledUsers(snapshot, confirmedServiceAccountIds).filter((u) => activityUnread(snapshot, u))
}

/**
 * Whoever this scan saw sign in from a phone (iOS, Android), by id, sorted: the
 * devices each person's own sign-in records show (scoring/phishingResistant.ts
 * devicesSeen), which is where MFA Readiness draws their phone from.
 *
 * The device question, the device-plan briefing and the phone lists used to
 * count a second source, the scenario tally over the bulk rows
 * (derive/evidence.ts). A person read on their own after a partial bulk read
 * (graph/collect/laneB.ts readTargeted) reached their record and never the
 * tally, and the shipped fixtures built the tally from rows of their own: the
 * question read "Today: no phone sign-ins were seen." beside an iPhone on MFA
 * Readiness (NEW-Nadia-D4). One source now, and the tally is gone.
 *
 * Inside the window MFA Readiness reads (READINESS_WINDOW_DAYS), counted back
 * from the scan. Null where the sign-in records were not read at all: nobody
 * was seen, which says nothing about phones.
 */
export function phoneSignInIds(snapshot: Pick<TenantSnapshot, 'signInEvidence' | 'sources' | 'asOf'>): string[] | null {
  const status = snapshot.sources?.signInEvidence?.status
  if (status !== 'ok' && status !== 'partial') return null
  // A scan with no readable time has no window to count back from: every record it holds counts.
  const scanned = Date.parse(snapshot.asOf)
  const from = Number.isFinite(scanned) ? new Date(scanned - READINESS_WINDOW_DAYS * 86_400_000).toISOString() : ''
  return Object.entries(snapshot.signInEvidence ?? {}).filter(([, e]) => devicesSeen(e).some((d) => isPhoneOs(d.os) && d.at >= from)).map(([id]) => id).sort()
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
 * Enabled people with no sign-in inside the activity window: never signed in,
 * or inactive 90+ days (target-state §8.1, prompt 46 item 7) — the dormant
 * step's accounts. One rule, one window (INACTIVE_DAYS), and `now` is passed
 * in so two surfaces rendering the same plan cannot disagree because they
 * asked the clock at different moments. A user with no recorded sign-in is
 * not active: absence of evidence is not evidence of activity.
 *
 * Shown, listed, never in a denominator, and never a reason to delay
 * enforcement — nothing can lock out an account nobody signs into. They carry
 * a risk of a different kind: whoever signs in first registers the MFA method.
 * Wave 0 asks the operator to decide on each.
 *
 * This is not the complement of the active people: an account that signs in
 * only to scripting tools is neither dormant nor an active person. The active
 * people are one set, derive/population.ts activePeopleIds.
 *
 * A person whose activity was never read is not here. Without Entra ID P1 that
 * is everybody, and the step this list fills says "Disable it … Account enabled:
 * No" — an instruction the scan has no evidence for (V1 audit S4-21).
 */
export function notActiveUsers(snapshot: TenantSnapshot, now: string, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): UserRow[] {
  const cutoff = Date.parse(now) - INACTIVE_DAYS * 86_400_000
  return enabledUsers(snapshot, confirmedServiceAccountIds).filter((u) => {
    if (activityUnread(snapshot, u)) return false
    // The directory's last sign-in, for the signed-in account too: the population never depends on who ran the scan.
    const last = lastSuccessOf(snapshot, u)
    const at = last ? Date.parse(last) : Number.NaN
    return !(Number.isFinite(at) && at >= cutoff)
  })
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

/**
 * Finished: done, with no conditional input nobody has saved. A delivered policy
 * whose mail-device or partner question was never answered is watched until the
 * Save (U28, RUN-CONTEXT-B decision 17): the Plan's Completed lane does not hold
 * it (actionability/lanes.ts isComplete), so no count of finished steps may.
 */
const finished = (s: Step): boolean => s.status === 'done' && (s.unsavedInputs ?? []).length === 0

/** Steps that are finished, over the trackable set. */
export function doneSteps(steps: Step[]): Step[] {
  return trackableSteps(steps).filter(finished)
}

/** Steps still to do: trackable, not finished. The set "Do this next" draws from. */
export function outstandingSteps(steps: Step[]): Step[] {
  return trackableSteps(steps).filter((s) => !finished(s))
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
