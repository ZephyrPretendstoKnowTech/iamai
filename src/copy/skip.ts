// Skipping a step (prompt 44 Part 1).
//
// The plan is advice, not a contract. Somebody who cannot do a thing, or has
// decided not to, must be able to say so and keep a coherent plan. What the tool
// owes them is an honest account of what they are giving up — not an obstacle,
// not a warning designed to change their mind, and not a record that quietly
// forgets the decision was made.
import { count } from './statements.ts'

/** The reasons people actually have. "Other" carries free text. */
export const SKIP_REASONS = [
  { id: 'notApplicable', label: 'Not applicable to this tenant' },
  { id: 'declined', label: 'The business declined it' },
  { id: 'noLicence', label: 'No licence for it' },
  { id: 'deferred', label: 'Deferred to a later phase' },
  { id: 'covered', label: 'Another control covers it' },
  { id: 'other', label: 'Other' },
] as const

export type SkipReasonId = (typeof SKIP_REASONS)[number]['id']

export const SKIP = {
  action: 'Skip this step…',
  panelTitle: 'Skip this step',
  reasonLabel: 'Why',
  detailLabel: 'Anything to add',
  detailPlaceholder: 'Optional. Recorded in the change record.',
  detailRequired: 'Say what the other reason is.',
  confirm: 'Skip it',
  cancel: 'Keep it in the plan',

  /**
   * What the tenant is left exposed to. One short paragraph, from the goal's own
   * risk text, with the number of people still affected. No scare language and
   * no persuasion beyond the fact.
   *
   * Three branches on the population, because "0 people remain affected" and
   * "everyone remains affected" mean very different things and a single sentence
   * with a number in it reads as neither.
   */
  exposure: (risk: string, people: number) =>
    people === 0
      ? `${risk} Nobody in this tenant is affected by the gap today, so skipping it costs nothing measurable now. It will cost something the day somebody is.`
      : `${risk} ${count(people, 'person', 'people')} ${people === 1 ? 'remains' : 'remain'} exposed to that while this is skipped.`,
  exposureUnknown: (risk: string) => `${risk} IAMAI cannot say how many people are exposed, because the evidence for it is missing.`,

  /** A skip that leaves other steps blocked names them (item 5). */
  dependents: (titles: string[]) =>
    titles.length === 1
      ? `${titles[0]} waits for this step. Skipping this one leaves it blocked.`
      : `${titles.length} steps wait for this one: ${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}. Skipping this one leaves them blocked.`,
  dependentsAlso: 'Skip those as well',
  dependentsKeep: 'Leave them blocked',
  blockedBySkip: (title: string) => `${title} is done, or no longer skipped`,

  /** Item 7: a high-value goal is confirmed twice. No shaming, no dark pattern. */
  highRiskLabel: (name: string) => `Type ${name} to confirm`,
  highRiskWhy: 'This is one of the highest-value changes in the plan, so IAMAI asks twice. Nothing is hidden behind this; it is here so a skip cannot happen by a stray click.',
  highRiskMismatch: 'That does not match the name above.',

  /** Item 6: the steps that make everything else reversible. */
  cannotSkip: 'This one cannot be skipped: emergency access is what makes every other change reversible.',

  /** Item 8: one click back. */
  unskip: 'Put it back in the plan',
  skippedChip: 'Skipped',
  skippedOn: (reason: string, when: string) => `Skipped ${when}: ${reason}`,

  /** Item 9: Findings groups them, and the percentage says so. */
  findingsGroup: 'Skipped',
  findingsLead: 'Decisions somebody made, kept visible so they can be revisited. These are not counted as gaps.',
  percentNote: (n: number) => `${count(n, 'goal')} skipped, and not counted either way.`,
} as const
