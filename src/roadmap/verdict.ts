// The report-only readiness verdict (observation-and-readiness.md §2,
// prompt 42 Part 2): for every step in report-only, one answer to "can this be
// enforced yet", with the evidence it rests on and the people it cannot speak
// for, by name.
//
// Pure: no DOM, no network, so it runs in Node tests and in the worker.
import { OBSERVATION_DAYS, OBSERVATION_DAYS_ZERO } from './constants.ts'
import { wouldStrand } from './strand.ts'
import type { Step } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** A person the records cannot speak for, and when they were last seen. */
export type Unseen = { userId: string; lastSignIn: string | null }

export type Verdict = {
  kind: 'ready' | 'notYet' | 'notEnough'
  /** One sentence of reason, always present. */
  reason: string
  /** Days observed against days required. */
  days: { observed: number; required: number }
  /** Sign-ins seen in the window. */
  signIns: number
  /** Affected people who signed in during the window, over those expected to. */
  covered: { seen: number; expected: number }
  /** People whose sign-in would have failed or been interrupted, by id. */
  failures: string[]
  /**
   * Affected people the records cannot speak for: no sign-in in the window AND
   * none in the last 30 days. They never block the verdict (§1); they are named
   * in it.
   */
  unseen: Unseen[]
  /** True when the signed-in operator is among the failures. */
  operatorAtRisk: boolean
}

/**
 * People who signed in at all in the last 30 days are the ones the bar is
 * measured over. Anyone quieter than that will not sign in inside a 3-day
 * window either, so waiting for them makes the short window unreachable.
 */
export const RECENT_WINDOW_DAYS = 30

/** The window this step must serve, in days. Mirrors observationDaysFor. */
export function requiredDays(step: Step): number {
  const family = step.readiness.family
  const affected = family === 'block' || family === 'location' ? step.evidence.affectedUserIds.length : step.population.active
  return step.evidence.status === 'ok' && affected === 0 ? OBSERVATION_DAYS_ZERO : OBSERVATION_DAYS
}

/**
 * Split the step's affected population into those the records can speak for and
 * those they cannot.
 *
 * `lastSignIn` comes from the snapshot's own user rows; a user with no recorded
 * sign-in at all is unseen by definition.
 */
export function coverage(
  step: Step,
  snapshot: TenantSnapshot,
  now: string,
): { expected: string[]; seen: string[]; unseen: Unseen[] } {
  // Sign-in recency lives on the evidence, not the directory row: a user row
  // knows who someone is, the evidence knows when they were last seen.
  const evidence = snapshot.signInEvidence ?? {}
  const signedInDuringWindow = new Set(step.tracking?.failuresByUser.map((f) => f.userId) ?? [])
  const cutoff = Date.parse(now) - RECENT_WINDOW_DAYS * 86_400_000

  const expected: string[] = []
  const unseen: Unseen[] = []
  for (const id of step.population.ids) {
    const last = evidence[id]?.lastSignIn ?? null
    if (last !== null && Date.parse(last) >= cutoff) expected.push(id)
    else unseen.push({ userId: id, lastSignIn: last })
  }
  // Anyone in the expected set the window actually carries a sign-in for. The
  // report-only results record who was evaluated; failuresByUser is the subset
  // that hit something, so it is a floor, not the whole seen set. Where the
  // policy reports sign-ins but names nobody, the count stands in for the set.
  const seen = expected.filter((id) => signedInDuringWindow.has(id))
  return { expected, seen, unseen }
}

/**
 * Can this step be enforced yet.
 *
 * Three verdicts, and the order they are decided in matters:
 *
 *  1. Not enough evidence — the window has not run, or no sign-ins arrived at
 *     all. This never reads as ready, and it is about the people who ARE
 *     signing in, not the quiet ones.
 *  2. Not yet — something would have broken. Any would-be failure at all,
 *     including the operator.
 *  3. Ready — and if the records cannot speak for some people, it says so and
 *     names them. That is not a blocker: the user decides whether to carve them
 *     out, defer them, or proceed (§1).
 */
export function verdictFor(step: Step, snapshot: TenantSnapshot, now: string, operatorId: string | null): Verdict | null {
  if (step.status !== 'in-report-only' && step.status !== 'ready-to-enforce') return null
  const required = requiredDays(step)
  const t = step.tracking
  const ro = step.evidence.reportOnly
  const observed = t?.daysInReportOnly ?? ro?.daysObserved ?? 0
  const signIns = t?.signIns ?? ro?.signIns ?? 0
  const { expected, seen, unseen } = coverage(step, snapshot, now)
  const failures = (t?.failuresByUser ?? []).map((f) => f.userId)
  const operatorAtRisk = operatorId !== null && failures.includes(operatorId)
  const base = { days: { observed, required }, signIns, covered: { seen: seen.length, expected: expected.length }, failures, unseen, operatorAtRisk }

  if (observed < required) {
    return { ...base, kind: 'notEnough', reason: VERDICT_REASON.tooEarly(required - observed) }
  }
  if (signIns === 0) {
    return { ...base, kind: 'notEnough', reason: VERDICT_REASON.noSignIns(observed) }
  }
  // The bar: a sign-in from every affected person who has signed in recently.
  if (expected.length > 0 && seen.length < expected.length && failures.length === 0 && signIns < expected.length) {
    return { ...base, kind: 'notEnough', reason: VERDICT_REASON.thin(seen.length, expected.length) }
  }
  if (operatorAtRisk) return { ...base, kind: 'notYet', reason: VERDICT_REASON.operator }
  if (failures.length > 0) return { ...base, kind: 'notYet', reason: VERDICT_REASON.failures(failures.length) }
  return { ...base, kind: 'ready', reason: unseen.length > 0 ? VERDICT_REASON.readyWithUnseen(unseen.length) : VERDICT_REASON.ready }
}

/** Kept here rather than in copy/ so the reasons stay next to the rules. */
export const VERDICT_REASON = {
  tooEarly: (left: number) => `The window has ${left === 1 ? 'a day' : `${left} days`} left to run.`,
  noSignIns: (days: number) => `No sign-ins have been recorded against this policy in ${days === 1 ? 'a day' : `${days} days`}, so there is nothing to judge it on.`,
  thin: (seen: number, expected: number) => `Only ${seen} of the ${expected} people who sign in regularly have been seen against this policy.`,
  operator: 'The signed-in account is among those this would have stopped.',
  failures: (n: number) => (n === 1 ? 'One person would have been stopped or interrupted.' : `${n} people would have been stopped or interrupted.`),
  ready: 'The window has run, and nothing would have been stopped.',
  readyWithUnseen: (n: number) =>
    `The window has run and nothing would have been stopped. The records cannot speak for ${n === 1 ? 'one person' : `${n} people`}, named below.`,
} as const

/**
 * The two links every verdict carries (§2, "show your work").
 *
 * IAMAI is reading Microsoft's own data, so a user who wants to check it should
 * be one click away rather than asked to trust a summary. Ids are encoded
 * because a policy id reaches these from tenant data.
 */
export function insightsUrl(tenantId: string, policyId: string): string {
  return `https://entra.microsoft.com/${encodeURIComponent(tenantId)}/#view/Microsoft_AAD_ConditionalAccess/PolicyBlade/policyId/${encodeURIComponent(policyId)}/insights~/true`
}

export function whatIfUrl(tenantId: string, policyId: string, userId: string): string {
  const q = new URLSearchParams({ policyId, userId })
  return `https://entra.microsoft.com/${encodeURIComponent(tenantId)}/#view/Microsoft_AAD_ConditionalAccess/WhatIfBlade/~/${encodeURIComponent(q.toString())}`
}

// ---- Operator pre-flight (observation-and-readiness.md §3, prompt 42 Part 3) ----

export type Preflight = {
  go: boolean
  /** The steps in this change window that would stop the operator, by id. */
  blockedBy: string[]
  /** Why, per blocking step, in the operator's own terms. */
  reasons: string[]
  /** True when the answer rests on missing evidence rather than on a clean read. */
  unknown: boolean
}

/**
 * Can the person doing this change still sign in afterwards.
 *
 * Run against the whole change window, not the single step: the operator is
 * about to enforce several policies in one supervised hour, and any of them can
 * lock them out. An operator who locks themselves out cannot fix what they just
 * broke, so a no-go blocks the event rather than warning about it.
 *
 * Computed from the scan every time rather than cached in the plan. A cached
 * go is a promise about a tenant that has since changed; the plan file would
 * carry it forward and it would be believed.
 */
export function preflightFor(
  batch: Step[],
  operatorId: string | null,
  snapshot: TenantSnapshot,
  allowedCountries: string[],
): Preflight {
  if (operatorId === null) return { go: true, blockedBy: [], reasons: [], unknown: true }
  const blockedBy: string[] = []
  const reasons: string[] = []
  let unknown = false
  for (const step of batch) {
    const v = wouldStrand(step, operatorId, snapshot, { breakGlass: false, allowedCountries })
    if (v.unknown) unknown = true
    if (!v.stranded) continue
    blockedBy.push(step.id)
    reasons.push(`${step.plainTitle || step.title}: ${v.reason}`)
  }
  return { go: blockedBy.length === 0, blockedBy, reasons, unknown }
}
