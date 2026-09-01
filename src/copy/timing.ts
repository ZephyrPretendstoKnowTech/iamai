// Timing copy (scheduling-and-onboarding.md §2, §3.5): the tenant's rhythm,
// the three dates on every step with their reasons, the Safe-today verdict,
// the week view and the This-week card. Product voice; suggestions, never
// commitments.
import { count } from './statements.ts'

export const RHYTHM = {
  sentence: (days: string, from: string, to: string, tz: string, peak: string, quiet: string) =>
    `Your people mostly sign in ${days}, ${from} to ${to} (${tz}). The busiest hour is ${peak}; the quietest working hour is ${quiet}.`,
  /**
   * Said after the pattern when the sample is thin (prompt 37 §18). Reporting
   * Saturday as a working day from thirteen users, flatly, is how a reader
   * learns not to trust the rest of the page (S5).
   */
  provisional: (signIns: number, users: number) =>
    `This is provisional: it reads ${count(signIns, 'sign-in record')} from ${count(users, 'person')}, which is a small sample. Treat the days and hours as a starting point.`,
  flat: (tz: string) => `Sign-ins are spread evenly around the clock (${tz}): the tenant appears to run outside office hours, so the calendar defaults apply.`,
  insufficient: 'Too few sign-in records to read a working pattern yet: the calendar defaults apply.',
  noDays: 'no regular days',
  title: 'When your people work',
}

export const EVENT = {
  announce: 'Announce',
  remind: 'Remind',
  enforce: 'Enforce',
  reason: {
    // The chosen day is named, with the reason it was chosen (prompt 37 §17).
    // The old line stated Tuesday or Wednesday at 09:30 whatever the tenant's
    // pattern said, which is what made a computed rhythm look decorative (S4).
    announceOn: (day: string, time: string) => `${day}, ${time}: one of the days your people work, early enough to be read the same day.`,
    announceDefaultDay: (day: string, time: string) => `${day}, ${time}: Monday inboxes are full and a Friday note is read on Monday.`,
    announceNoRhythm: 'The sign-in sample is too small to read a working pattern, so the calendar defaults apply.',
    announceNotice: (days: number) => `${count(days, 'working day')} of notice for a change of this size.`,
    announceCourtesy: 'One working day of notice, as a courtesy: the records show nobody affected.',
    announceCare: 'At least five working days, and the special-care people are contacted individually first.',
    remindDayBefore: 'The working day before, same time: short enough to still be in memory.',
    remindMorningOf: 'The morning of the change as well: two clear reminders for a high-disruption change.',
    enforcePeak: (peak: string) => `One hour after the busiest hour (${peak}): a full working day of support before the weekend.`,
    enforceDefault: 'Tuesday, Wednesday or Thursday, 10:00: a full working day of support before the weekend.',
    enforceOn: (day: string) => `${day}: the tenant's own working days do not include the usual midweek slot, so the nearest working day was chosen.`,
    enforceReportOnly: 'Any day, any time: creating a policy in report-only affects nobody.',
    enforceSafeToday: 'Safe to enforce today: nothing in the evidence would have been blocked. One working day of notice, as a courtesy.',
    campaignMonday: 'A Monday start gives people a full week.',
    deadlineWednesday: 'A Wednesday deadline leaves two days to chase stragglers.',
    none: 'No announcement: nobody is affected.',
  },
  outOfHours: 'outside working hours',
  suggested: 'Suggested',
  at: (day: string, date: string, time: string) => `${day} ${date}, ${time}`,
}

/**
 * When to send a step's message, said above the draft (prompt 41 §3).
 *
 * The plan dated every event and then left the person to work out which date
 * governed the thing in front of them. Four branches, because the answer is
 * genuinely different in four cases: nobody is affected so no notice is owed,
 * a special-care user sets the floor, the message is already overdue, and
 * the ordinary case.
 */
export const NOTICE_LINE = {
  none: 'Nobody is affected by this change in the records, so the notice is one working day, as a courtesy.',
  care: (send: string, days: number) =>
    `Send this on ${send}, ${days} working days before the change. A special-care user is in scope, so the notice is never shorter than that, and each of them is told individually first.`,
  overdue: (send: string) => `This was due to go out on ${send}. Send it now, and move the change if the notice no longer fits.`,
  standard: (send: string, days: number) => `Send this on ${send}, ${days} working ${days === 1 ? 'day' : 'days'} before the change.`,
} as const

/**
 * The change window a step shares (prompt 41 §9).
 *
 * Three branches: enforced with others, enforced alone, and safe today, which
 * needs no supervised window at all. Said on the step so a person schedules one
 * hour for four changes rather than four hours for four changes.
 */
export const BATCH = {
  withOthers: (others: number, date: string) =>
    `Enforced together with ${others} other ${others === 1 ? 'change' : 'changes'} on ${date}, in one change window.`,
  alone: (date: string) => `Enforced on its own on ${date}.`,
  safeToday: 'Enforced as soon as the evidence holds. It takes no change window and needs no announcement.',
} as const

/**
 * The pace control: how many supervised change windows a week (prompt 42).
 *
 * The comparison numbers are computed by re-running the scheduler, never
 * written here, so the sentence cannot drift from what the plan would do.
 * Three branches, because a slower pace is not offered below one a week and a
 * pace that changes nothing should say so rather than dangle a choice.
 */

export const SAFE = {
  verdictSafe: 'Safe to enforce today',
  verdictNotYet: (reason: string) => `Not yet: ${reason}`,
  cardSentence: 'Nothing in the last 30 days would have been blocked by this. Safe to enforce today, with one working day of notice as a courtesy.',
  filter: 'Safe today',
  tile: 'Safe today',
  reasons: {
    prerequisites: (title: string) => `${title} is not done yet`,
    breakGlass: 'the break-glass accounts are not verified and excluded yet',
    operator: 'the signed-in account would be caught by it',
    evidenceWindow: (days: number, needed: number) => `only ${count(days, 'day')} of sign-in records; ${needed} are needed`,
    evidenceCoverage: (have: number, needed: number) => `only ${count(have, 'sign-in')} in the records; at least ${needed} are needed to be sure`,
    evidenceNone: 'no usable sign-in records to prove nobody is affected',
    affected: (n: number) => `${count(n, 'person', 'people')} would have been affected in the last 30 days`,
    readiness: (percent: number, threshold: number) => `readiness is ${percent}%, below the ${threshold}% bar`,
    notReady: (n: number) => `${count(n, 'active person', 'active people')} still lack a working method`,
    done: 'already in place',
    kind: 'this step is not a policy change',
    reportOnlyFirst: 'the policy has not run in report-only yet',
  },
}

export const WEEK_VIEW = {
  title: 'Week by week',
  // Two rules, not one, because they govern different things. Saying only the
  // first made two enforcement cells for one audience in a week look like a
  // contradiction of the rule printed above them (review-09 finding 13,
  // prompt 42 §14).
  hint: 'Days across, the three kinds of event down: what to announce, remind about, and enforce on each day. Times are local. One message per audience per week, however many changes it covers. Changes are grouped per day rather than per week, because a change takes effect on the day it takes effect; two on one audience in a week means two supervised windows, which the labels name.',
  weekOf: (date: string) => `Week of ${date}`,
  rows: { announce: 'Announce', remind: 'Remind', enforce: 'Enforce' },
  nothing: 'Nothing this week.',
  outOfHours: (n: number) => `${count(n, 'event')} outside working hours`,
  everyone: 'Everyone',
  /**
   * A quiet row says so rather than vanishing (prompt 42 §13). One per row,
   * because "none needed" means something different in each: nothing to
   * announce, nothing to remind about, nothing taking effect.
   */
  noneNeeded: {
    announce: 'Nothing to announce this week.',
    remind: 'Nothing needs a reminder this week.',
    enforce: 'No changes take effect this week.',
  } as Record<string, string>,
  /**
   * One cell per audience per day on the Enforce row (prompt 40 §16), named by
   * what kind of change it is, so two cells for one audience in a week read as
   * two different windows rather than a duplicate (prompt 42 §14).
   */
  enforceBundle: (audience: string, steps: number, kind: string | null) =>
    kind ? `${audience}, ${kind}: ${steps} changes take effect` : `${audience}: ${steps} changes take effect`,
  /** Plain names for the disruption classes a change window can hold. */
  batchKind: {
    zero: 'nobody affected',
    mfa: 'sign-in methods',
    deviceSession: 'devices and sessions',
    other: 'other changes',
  } as Record<string, string>,
  /** One cell per bulletin, naming what it covers (prompt 37 §14). */
  bulletin: (audience: string, steps: number) => `${audience}: ${count(steps, 'change')}`,
}

export const THIS_WEEK = {
  title: 'This week',
  nothing: 'Nothing due this week.',
  nothingUntil: (date: string, why: string) => `Nothing to do until ${date}, when ${why}.`,
  observationEnds: 'the observation window ends',
  noticeEnds: 'the notice period ends',
  campaignEnds: 'the registration campaign ends',
  announce: (n: number, day: string) => `send ${n === 1 ? 'one announcement' : `${n} announcements`} (${day})`,
  remind: (n: number, day: string) => `send ${n === 1 ? 'one reminder' : `${n} reminders`} (${day})`,
  enforce: (title: string, when: string) => `enforce ${title} (${when})`,
  setUp: (names: string) => `set up MFA for ${names}`,
  prerequisite: (title: string) => `${title}`,
  lead: (items: string[]) => `This week: ${items.join(', ')}.`,
}

export const MANAGER = {
  title: 'What to tell your manager',
  copy: 'Copy for your manager',
}

export const LICENCE_HEADER = {
  sentence: (tier: string, available: number, total: number, missing: number, needs: string) =>
    missing === 0
      ? `With this tenant's ${tier}, every one of the ${count(total, 'step')} is available now.`
      : `With this tenant's ${tier}, ${available} of ${count(total, 'step')} are available now. ${count(missing, 'step')} need${missing === 1 ? 's' : ''} ${needs}; the Licensing guide shows what they would add.`,
  unavailableTitle: 'Needs a licence this tenant does not have',
  unavailableText: 'Not counted against the plan. Each names the tier that would make it available.',
  tier: { p2: 'Entra ID P2', p1: 'Entra ID P1', free: 'Entra ID Free' },
  tierName: (tier: string) => ({ p1: 'Entra ID P1', p2: 'Entra ID P2', intune: 'Intune', workloadId: 'Workload Identities Premium', gsa: 'Global Secure Access', mcas: 'Defender for Cloud Apps', free: 'Entra ID Free' })[tier] ?? tier,
}

export const TERM_WORDS = { reportOnly: 'What report-only means' }

export const PLAIN = {
  technical: (name: string) => name,
}
