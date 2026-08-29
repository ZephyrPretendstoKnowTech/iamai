// Schedule copy (roadmap-v2.md §2): the dependency graph, the calendar rules
// and the one sentence that says why the plan is as long as it is.
import { count } from './statements.ts'

export const DEPENDENCY = {
  exclusionGroup: 'the exclusion group must exist before any policy that excludes it',
  breakGlass: 'the break-glass accounts must be verified before the first block policy',
  breakGlassDrill: 'the break-glass sign-in check must pass before the first block policy',
  registration: 'the registration campaign must finish before MFA is enforced',
  namedLocation: 'the named location must exist before the policy that uses it',
  pilotGroup: (group: string) => `the pilot group ${group} must exist before its ring starts`,
  strength: 'the authentication strength must exist before the policy that requires it',
  intune: 'Intune enrollment must cover the population before a compliant-device grant',
  blockedBy: (title: string) => `waits for ${title}`,
  samePeople: (title: string) => `cannot prompt the same people in the same week as ${title}`,
  highDisruption: (title: string) => `cannot overlap ${title}: both are high-disruption for the same people`,
  inFlight: (title: string) => `waits for the ${title} ring in flight: more than half the people overlap`,
}

export const CALENDAR = {
  noFriday: 'Enforcement never starts on a Friday or a weekend.',
  weeklyCap: (n: number) => `At most ${count(n, 'enforcement event')} a week for this size of tenant.`,
  freeze: (from: string, to: string) => `Change freeze from ${from} to ${to}: nothing is enforced inside it.`,
  freezeLabel: 'Change freeze',
  freezeFrom: 'From',
  freezeTo: 'To',
  freezeHint: 'A date range in which nothing is enforced; the schedule moves around it.',
  freezeClear: 'Clear the freeze',
}

export const CRITICAL = {
  sentence: (weeks: number, reason: string) => `The plan is ${count(weeks, 'week')} because ${reason}; everything else fits inside it.`,
  sentenceDone: 'Nothing is left to schedule.',
  verificationOnly: (people: number, campaignWeeks: number) => `MFA registration for ${count(people, 'person', 'people')} takes ${count(campaignWeeks, 'week')} and nothing is enforced yet`,
  verification: (people: number, campaignWeeks: number, step: string, rings: number, soak: number) =>
    `MFA registration for ${count(people, 'person', 'people')} takes ${count(campaignWeeks, 'week')}, then ${step} rolls through ${count(rings, 'ring')} of ${count(soak, 'day')} each`,
  chain: (step: string, waitsFor: string, rings: number, soak: number) =>
    `${step} waits for ${waitsFor}, then rolls through ${count(rings, 'ring')} of ${count(soak, 'day')} each`,
  rings: (step: string, rings: number, soak: number, observation: number) =>
    observation > 0
      ? `${step} observes in report-only for ${count(observation, 'day')} and then rolls through ${count(rings, 'ring')} of ${count(soak, 'day')} each`
      : `${step} rolls through ${count(rings, 'ring')} of ${count(soak, 'day')} each`,
  cap: (n: number, step: string) => `only ${count(n, 'enforcement event')} a week fit this size of tenant, which places ${step} last`,
  freeze: (to: string, step: string) => `the change freeze ends on ${to} and ${step} starts after it`,
  scheduled: (step: string, date: string) => `${step} is scheduled by hand for ${date}`,
  phase: (step: string, phase: string) => `${step} follows the ${phase} steps, which start first`,
  soft: (step: string, other: string) => `${step} cannot overlap ${other} for the same people`,
  prerequisites: (n: number) => `${count(n, 'prerequisite')} take the first days`,
  shorterSoak: (from: number, to: number) => `Each ring soaks ${count(to, 'day')} instead of ${from}; the longer soak would run past the size band.`,
  relaxed: (n: number, weeks: number) =>
    `${count(n, 'step')} would prompt the same people twice in one week. Spacing them out would push the plan past ${count(weeks, 'week')}, so they stay together.`,
}

export const POLICY_COUNT = {
  statement: (existing: number, added: number, after: number, cap: number) =>
    `${count(existing, 'Conditional Access policy', 'Conditional Access policies')} in the tenant today; this plan adds ${added}, for ${after} of the ${cap} Entra allows.`,
  nearCap: (after: number, cap: number) => `${after} of ${cap}: the tenant is approaching the Entra policy cap.`,
  high: (after: number) => `${after} policies after this plan: hard to reason about at that size, and the plan names what to consolidate.`,
  candidates: (n: number) => `${count(n, 'consolidation candidate')}:`,
  disabledPolicy: (name: string) => `${name} is disabled: delete it or fold it into a live policy.`,
  reportOnlyStale: (name: string, days: number) => `${name} has sat in report-only for ${count(days, 'day')}: enforce it or remove it.`,
  duplicate: (goal: string, names: string[]) => `${names.join(' and ')} target the same people with the same controls for ${goal}: merge them.`,
}

export const NAMING = {
  collision: (proposed: string, existing: string) => `${existing} already exists, so the new policy is named ${proposed}; rename either once the old one is retired.`,
}
