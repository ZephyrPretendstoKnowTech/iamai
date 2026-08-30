// Post-enforcement watch and the effort estimate (comms-and-bridges.md §3.1,
// §3.4). After a step is enforced, each scan compares sign-in failures
// carrying its policy in the hours since with the days before, by user,
// against a revert threshold. Effort: admin minutes per step and help-desk
// contacts from the affected people and the control type. Pure.
import { EFFORT, WATCH } from '../copy/comms.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Step } from './types.ts'

export const WATCH_HOURS = 72
export const DEFAULT_REVERT_PERCENT = 5

export type WatchResult = {
  hours: number
  failuresAfter: number
  failuresBefore: number
  perDayBefore: number
  perDayAfter: number
  byUser: { userId: string; count: number }[]
  topShare: number
  thresholdPercent: number
  thresholdPeople: number
  breached: boolean
  hasEvidence: boolean
  sentence: string
  baseline: string
  threshold: string
  verdict: string
}

/** The watch for a step enforced at `enforcedAt`, from the policy's per-day failures. */
export function watchFor(step: Step, snapshot: TenantSnapshot, nameOf: (id: string) => string, thresholdPercent: number = DEFAULT_REVERT_PERCENT, now: string = snapshot.asOf): WatchResult | null {
  const enforcedAt = step.tracking?.enforcedAt
  const policyId = step.tracking?.policyId
  if (!enforcedAt || !policyId || step.status !== 'done') return null
  const pr = snapshot.evidencePolicyResults.find((p) => p.policyId === policyId)
  const byDay = pr?.byDay ?? null
  const people = Math.max(1, step.population.active || step.population.total)
  const thresholdPeople = Math.max(1, Math.ceil((people * thresholdPercent) / 100))
  const hours = Math.max(0, Math.min(WATCH_HOURS, Math.round((Date.parse(now) - Date.parse(enforcedAt)) / 3_600_000)))
  const empty: WatchResult = {
    hours,
    failuresAfter: 0,
    failuresBefore: 0,
    perDayBefore: 0,
    perDayAfter: 0,
    byUser: [],
    topShare: 0,
    thresholdPercent,
    thresholdPeople,
    breached: false,
    hasEvidence: false,
    sentence: WATCH.noEvidence,
    baseline: '',
    threshold: WATCH.threshold(thresholdPercent, people),
    verdict: '',
  }
  if (!byDay) return empty
  const enforcedDay = enforcedAt.slice(0, 10)
  const afterEnd = new Date(Date.parse(enforcedAt) + WATCH_HOURS * 3_600_000).toISOString().slice(0, 10)
  const beforeStart = new Date(Date.parse(enforcedAt) - 7 * 86_400_000).toISOString().slice(0, 10)
  let failuresAfter = 0
  let failuresBefore = 0
  let beforeDays = 0
  const users = new Map<string, number>()
  for (const [day, d] of Object.entries(byDay)) {
    if (day >= enforcedDay && day <= afterEnd) {
      failuresAfter += d.failures
      for (const id of d.userIds) users.set(id, (users.get(id) ?? 0) + 1)
    } else if (day >= beforeStart && day < enforcedDay) {
      failuresBefore += d.failures
      beforeDays += 1
    }
  }
  const byUser = [...users.entries()].map(([userId, count]) => ({ userId, count })).sort((a, b) => b.count - a.count)
  const topShare = failuresAfter > 0 && byUser[0] ? Math.round((byUser[0].count / failuresAfter) * 100) : 0
  const perDayBefore = beforeDays > 0 ? Math.round((failuresBefore / beforeDays) * 10) / 10 : 0
  const perDayAfter = hours > 0 ? Math.round((failuresAfter / Math.max(1, hours / 24)) * 10) / 10 : failuresAfter
  const failingPeople = byUser.length
  const breached = failingPeople > thresholdPeople
  return {
    ...empty,
    failuresAfter,
    failuresBefore,
    perDayBefore,
    perDayAfter,
    byUser,
    topShare,
    breached,
    hasEvidence: true,
    sentence: WATCH.sentence(failuresAfter, hours, topShare, byUser[0] ? nameOf(byUser[0].userId) : null),
    baseline: WATCH.baseline(perDayBefore, perDayAfter),
    verdict: breached ? WATCH.breached : WATCH.clear,
  }
}

// ---- Effort (§3.4): what fits in the time you have ----

const CALL_RATE: Record<string, number> = { mfa: 0.03, guest: 0.03, admin: 0.05, device: 0.08, location: 0.02, block: 0.01, other: 0.01 }

export function adminMinutes(step: Step): number {
  switch (step.kind) {
    case 'prerequisite':
      return 10
    case 'verify':
      return 30
    case 'recurring':
      return 15
    case 'adjust':
      return 10
    default:
      return 15 + Math.min(30, step.rings.length * 5)
  }
}

export function helpDeskContacts(step: Step): number {
  if (step.kind !== 'create' && step.kind !== 'adjust') return 0
  if (step.safeToday) return 0
  const family = step.readiness.family
  const affected = family === 'block' || family === 'location' ? step.evidence.affectedUserIds.length : step.population.active
  if (affected === 0) return 0
  // People who are not ready when the change lands are near-certain callers, so
  // they set the floor. Below that, any affected population rounds up rather
  // than down: a change that touches somebody is not a change nobody asks about
  // (review-08 F, prompt 40 §23).
  const notReady = step.readiness.percent === null ? 0 : Math.round(affected * (1 - step.readiness.percent / 100))
  return Math.max(notReady, 1, Math.round(affected * (CALL_RATE[family] ?? CALL_RATE.other)))
}

export function effortFor(step: Step): { minutes: number; contacts: number; sentence: string } {
  const minutes = adminMinutes(step)
  const contacts = helpDeskContacts(step)
  return { minutes, contacts, sentence: `${EFFORT.minutes(minutes)} (${EFFORT.fits(minutes)}); ${EFFORT.calls(contacts)}.` }
}

/**
 * The plan's total effort, reconcilable with the step cards (prompt 41 §11).
 *
 * Two things were wrong. The total summed every outstanding step while only
 * some kinds print an estimate on their card, so "about 8 hours" could not be
 * checked against the twenty numbers on screen that add to six (review-09
 * finding 4). And "20 help-desk contacts" on a tenant with four active people
 * reads as twenty people (finding 3). It is twenty contacts: one person asking
 * about one change, and four people spread over many changes account for
 * several each. The arithmetic was right and the noun was doing the lying, so
 * the sentence now carries the step count and the unit says what it counts.
 */
export function planEffort(steps: Step[]): { minutes: number; contacts: number; steps: number; sentence: string } {
  const work = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  const minutes = work.reduce((n, s) => n + adminMinutes(s), 0)
  const contacts = work.reduce((n, s) => n + helpDeskContacts(s), 0)
  return { minutes, contacts, steps: work.length, sentence: EFFORT.total(minutes, contacts, work.length) }
}
