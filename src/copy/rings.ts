// Ring copy (roadmap-v2.md §1): names, targeting advice, entry and exit
// criteria with this tenant's numbers filled in. Product voice: IAMAI or the
// imperative; never first person.
import { count } from './statements.ts'

export const RINGS = {
  pilot: 'Pilot',
  ring: (n: number, who: string | null) => (who ? `Ring ${n} - ${who}` : `Ring ${n}`),
  everyone: 'Everyone',
  itAndEarly: 'IT and early adopters',
  and: (a: string, b: string) => `${a} and ${b}`,
  otherDepartments: 'other departments',

  // ---- targeting ----
  members: (n: number) => `Suggested members (${count(n, 'person', 'people')}): verified users first, one admin, never a break-glass account.`,
  membersSpread: (n: number, departments: number) =>
    `Suggested members (${count(n, 'person', 'people')}) across ${count(departments, 'department')}: verified users first, one admin, never a break-glass account.`,
  filterAdvice: (n: number) => `Create the group and add ${count(n, 'person', 'people')} matching this filter; pick verified users first and include one admin.`,
  filter: (rule: string) => `Dynamic membership rule: ${rule}`,
  everyoneTargeting: (n: number) => `No group: the policy's own include covers the remaining ${count(n, 'person', 'people')}.`,
  emptyRing: 'Nobody is left for this ring; it passes as soon as the previous ring exits.',

  // ---- entry criteria ----
  groupExists: (groupName: string, n: number) => `The group ${groupName} exists with ${count(n, 'member')} and is the policy's only include.`,
  reportOnlyClean: (days: number, n: number) => `The policy has run in report-only for at least ${count(days, 'day')} with no failures for these ${count(n, 'person', 'people')}.`,
  ringVerified: (ready: number, n: number) => `${ready} of ${count(n, 'member')} verified as MFA-ready before the ring starts.`,
  ringDevices: (ready: number, n: number) => `${ready} of ${count(n, 'member')} own a compliant device before the ring starts.`,
  breakGlassOut: 'Both break-glass accounts sit in the exclusion group and were tested within the last 90 days.',
  previousSoaked: (prev: string, days: number) => `${prev} has soaked ${count(days, 'day')} with no unexplained sign-in failures.`,
  helpDeskBriefed: (ringName: string) => `The help desk holds the ${ringName} announcement and the what-to-say notes.`,
  announcementSent: (daysBefore: number) => `The announcement went out at least ${count(daysBefore, 'day')} before the ring starts.`,

  // ---- exit criteria ----
  signedIn: (n: number, days: number) => `${count(n, 'member')} signed in successfully under the policy during the ${count(days, 'day')} soak.`,
  accessProblems: (n: number) => `Every access problem raised by the ${count(n, 'member')} during the soak was resolved and has a named cause.`,
  mfaSatisfied: (percent: number) => `At least ${percent}% of the ring's sign-ins satisfied the requirement without a help-desk call.`,
  deviceSatisfied: (percent: number) => `At least ${percent}% of the ring's sign-ins came from a compliant or hybrid-joined device.`,
  blockReviewed: 'Every blocked sign-in in the soak was reviewed and none was legitimate work.',
  sessionAccepted: 'Re-authentication prompts arrived at the set frequency and nobody lost unsaved work to them.',
  operatorInRing: 'The signed-in account completed a sign-in under the policy from its usual device.',
  careVerified: (n: number) => `${count(n, 'handle-with-care user')} in this ring confirmed access personally.`,

  // ---- plan text ----
  summary: (rings: number, soak: number, weeks: number) => `${count(rings, 'ring')}, ${count(soak, 'day')} of soak each, ${count(weeks, 'week')} end to end.`,
  singleRing: 'One ring: this step cannot deny anyone access, so it applies to everyone at once.',
  window: (name: string, start: string, end: string, soak: number) => `${name}: ${start} to ${end} (${count(soak, 'day')} of soak).`,
}
