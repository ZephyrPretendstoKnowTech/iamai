// Roadmap step copy: titles, kind labels, impact lines, exit criteria,
// prerequisite instructions, announcements. Pure; used by the roadmap engine.
import type { StepKind, StepStatus } from '../roadmap/types.ts'
import { count, list, plural } from './statements.ts'
import { TERMS } from './terms.ts'

export const STEP_KIND_LABEL: Record<StepKind, string> = TERMS.stepKind

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  done: 'Done',
  ready: 'Ready',
  blocked: 'Blocked',
  'in-report-only': 'In report-only',
  'ready-to-enforce': 'Ready to enforce',
  skipped: 'Skipped',
}

export const PHASE_NAME: Record<number, string> = {
  0: 'Foundations',
  1: 'Low-impact blocks',
  2: 'MFA for everyone',
  3: 'Admin hardening',
  4: 'Guests and locations',
  5: 'Devices',
  6: 'Sessions',
  7: 'Advanced',
}

/** One precise sentence per blocker group (prompt 13 §9). */
export const BLOCKED = {
  setup: (numbers: number[]) =>
    numbers.length === 1
      ? `Blocked until Setup question ${numbers[0]} is answered`
      : `Blocked until Setup questions ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]} are answered`,
  step: (title: string) => `Blocked until '${title}' is done`,
  readiness: (label: string) => `Blocked while ${label}`,
  evidence: 'Blocked until report-only evidence is clean',
}

export const OPERATOR = {
  inScope: (n: number | 'some' | null, total: number | null) =>
    n === null
      ? 'Your account is in scope. No sign-in records are available to say how many of your sign-ins would have been affected.'
      : n === 'some'
        ? `Your account is in scope. In the last 30 days, some of your ${total ?? ''} sign-ins would have been affected.`.replace('  ', ' ')
        : `Your account is in scope. In the last 30 days, ${n}${total !== null ? ` of your ${total}` : ''} sign-in${n === 1 ? '' : 's'} would have been affected.`,
  whatIf: (result: string) => `What If: ${result}`,
}

export const NAMING = {
  fromBaseline: (name: string) => `from baseline: ${name}`,
}

export const BLOCKER = {
  trustedLocation: 'needs the trusted named location first',
  countriesChoice: 'needs the countries policy style chosen',
  deviceReadiness: (percent: number, threshold: number) => `device readiness is ${percent}%: the threshold is ${threshold}%`,
  evidence: 'report-only evidence is not clean yet',
}

export const PRINT = {
  title: (tenant: string) => `Conditional Access rollout plan. ${tenant}`,
  cover: {
    baseline: 'Baseline',
    dates: 'Plan dates',
    generated: 'Generated',
    pace: 'Pace',
    prepared: (by: string) => `Prepared with IAMAI by ${by}`,
  },
  contents: 'Contents',
  summary: 'Summary',
  timeline: 'Timeline',
  timelineColumns: { wave: 'Wave', dates: 'Dates', steps: 'Steps' },
  appendix: 'Appendix: policy JSON',
  step: {
    kind: 'Kind',
    status: 'Status',
    why: 'Why',
    who: 'Who is affected',
    readiness: 'Readiness',
    change: 'The change',
    portal: 'Portal steps',
    exit: 'Done when',
    rollback: 'If it goes wrong',
  },
  runningHeader: (tenant: string, date: string) => `IAMAI plan · ${tenant} · ${date}`,
}

/** Step titles are the goal name as an imperative: the kind is a chip, never a prefix. */
export function stepTitle(goalName: string): string {
  return goalName.charAt(0).toUpperCase() + goalName.slice(1)
}

export const PREREQ = {
  setupQuestions: {
    title: (n: number) => `Answer ${count(n, 'setup question')}`,
    why: 'A few answers about the tenant turn templates into exact, safe policy changes.',
    how: (titles: string[]) => [`Open the Setup step and answer: ${list(titles)}.`, 'Each takes under a minute; every pick is validated.'],
    exit: ['Every required Setup question answered.'],
  },
  breakGlass: {
    title: 'Create two break-glass accounts',
    why: 'Emergency access that works when everything else fails: the first move of any lockout-proof rollout.',
    how: [
      'Create two cloud-only accounts (no on-premises sync) with long random passwords stored offline.',
      'Assign Global Administrator as a permanent active assignment (not PIM-eligible).',
      'Register a FIDO2 security key on each; never text message only.',
      'Add them to the exclusions group, then answer the Setup question so IAMAI can validate them.',
    ],
    exit: ['Two accounts exist, validated by the Setup question.'],
  },
  globalExclusion: {
    title: 'Create the policy exclusions group',
    why: 'One assigned group, containing only break-glass, excluded from every policy in the plan: a single, auditable escape hatch.',
    how: [
      'Entra admin center → Groups → New group → Security, assigned membership (never dynamic).',
      'Name it clearly, e.g. "CA - Policy Exclusions".',
      'Add only the break-glass accounts.',
      'Then answer the Setup question so every generated policy excludes it.',
    ],
    exit: ['The group exists and is picked in Setup.'],
  },
  trustedLocation: {
    title: 'Create a trusted named location',
    why: 'Some baseline policies treat the office network as a safe context; that needs a named location.',
    how: [
      'Entra admin center → Protection → Conditional Access → Named locations → + IP ranges location.',
      'Add the office egress ranges (never 0.0.0.0/0, nothing wider than /16) and mark the location as trusted.',
      'Then answer the Setup question.',
    ],
    exit: ['A trusted location exists and is picked in Setup.'],
  },
  securityDefaults: {
    title: 'Turn off security defaults',
    why: 'Security defaults and Conditional Access are mutually exclusive; the first policy cannot exist while they are on.',
    how: [
      'Entra admin center → Identity → Overview → Properties → Manage security defaults → Disabled.',
      'Do this only when the phase 1–2 policies are ready to take over.',
    ],
    exit: ['Security defaults report disabled on the next scan.'],
  },
  verifyMfa: {
    title: 'Run the MFA verification campaign',
    why: 'Before MFA is enforced, every active user should have a working, verified method: enforcement should change nothing for them.',
    how: (c: { none: number; unverified: number; notChallenged: number }, careNames: string[], departments: number) => [
      c.none + c.unverified + c.notChallenged === 0
        ? 'Everyone active is already verified or likely viable: confirm the Readiness table and move on.'
        : `Work the Readiness table top-down: ${count(c.none, 'user')} without a method (issue Temporary Access Passes), ${c.unverified} unverified, ${c.notChallenged} never challenged.`,
      ...(careNames.length > 0 ? [`Walk through setup personally with ${list(careNames)}: never an email blast for them.`] : []),
      departments > 1
        ? `Pilot suggestion: Verified and Likely-viable users across the ${departments} departments, one admin, never break-glass or handle-with-care.`
        : 'Pilot suggestion: a handful of Verified users plus one admin; never break-glass or handle-with-care.',
    ],
    exit: (threshold: number) => [`Readiness reaches ${threshold}% of active users.`],
  },
  breakGlassDrill: {
    title: 'Break-glass sign-in drill',
    why: (days: number) => `An emergency account that has not signed in for ${days} days is unproven exactly when it matters.`,
    how: ['Sign in with each break-glass account, complete its strong method, and record the drill.'],
    exit: (days: number) => [`Every break-glass account has a successful sign-in within ${days} days.`],
    overdue: (names: string[]) => `${count(names.length, 'account')} overdue: ${list(names)}`,
    allDrilled: 'All accounts recently drilled.',
  },
}

export const ACTION = {
  alreadyDelivered: 'Already delivered by existing policies: nothing to do.',
  createReportOnly: 'Create this policy in report-only mode; the description tag lets re-scans track it.',
  createsGroup: (name: string) => `This step also creates the assigned group "${name}" it targets: create it empty first; pilot users go in later.`,
  noBaselineMatch: 'No baseline policy matches this goal directly: create a policy that meets the goal floor.',
  raiseGrant: (detail: string) => `Raise the grant control: ${detail}.`,
  tightenSession: (detail: string) => `Tighten the session controls: ${detail}.`,
  reviewExclusion: (detail: string) => `Review the exclusion (${detail}): remove it or confirm it in Setup.`,
  extendScope: (n: number) => `Extend the include scope: ${count(n, 'expected user')} ${n === 1 ? 'is' : 'are'} never targeted.`,
  broadenApps: 'Broaden the target resources to all apps (currently narrower than the goal).',
  moveToEnforced: 'The covering policy is report-only: enforce it once the evidence is clean.',
  floorRaised: (to: string, by: string) => `The baseline raises the bar to ${to} (via ${by}).`,
  bringToFloor: 'Bring the covering policies up to the goal floor.',
}

const READINESS_NAME: Record<string, string> = {
  mfa: 'MFA readiness',
  guest: 'guest MFA readiness',
  admin: 'admin phishing-resistant readiness',
  device: 'device readiness',
}

export const UNBLOCK = {
  setup: 'finish the Setup questions first',
  question: (n: number, title: string, ask: string) => `Blocked until Setup question ${n}. ${title}: ${ask}`,
  createObject: 'create the missing object first (phase 0)',
  readiness: (percent: number, family: string, threshold: number) =>
    `${READINESS_NAME[family] ?? 'readiness'} is ${percent}%: the threshold is ${threshold}%; verify users first (phase 2)`,
}

export const IMPACT = {
  done: 'Already in force: no change for anyone.',
  blockZero: 'Zero sign-ins would have been affected in the last 30 days: free security.',
  blockSome: (n: number) => `${count(n, 'user')} used this in the last 30 days and would be affected: contact them first.`,
  adjust: (affected: number, admins: number) =>
    `${count(affected, 'user')} ${affected === 1 ? 'sees' : 'see'} a change${admins > 0 ? ` (${count(admins, 'admin')})` : ''}; nobody new is targeted.`,
  mfaNotReady: (notReady: number, active: number) =>
    `${notReady} of ${count(active, 'active user')} ${notReady === 1 ? 'is' : 'are'} not verified yet: they would be interrupted at their next sign-in.`,
  mfaAllReady: (active: number) =>
    active === 0 ? 'No active users in scope: enforcement changes nothing today.' : `All ${count(active, 'active user')} ${active === 1 ? 'is' : 'are'} ready: enforcement changes nothing for them.`,
  inScope: (active: number) => `${count(active, 'active user')} in scope.`,
  verifyCampaign: (n: number) => `${count(n, 'active user')} ${n === 1 ? 'needs' : 'need'} attention before MFA can be enforced safely.`,
}

export const CARE = {
  order: (n: number) => `Rollout order for this step: pilot → everyone else → ${n === 1 ? 'this user' : `these ${n} users`} last, after the approach is proven.`,
  noMethod: (name: string) => `${name}: no MFA method yet: issue a Temporary Access Pass and set up Authenticator together.`,
  unverified: (name: string) => `${name}: not verified yet: have them complete one MFA sign-in before this is enforced.`,
  allVerified: 'All verified: this step can be enforced for them when the evidence is clean.',
}

export const EXIT = {
  staysEnforced: 'Stays enforced on every re-scan.',
  reportOnlyDays: (days: number) => `Policy live in report-only for at least ${count(days, 'day')}.`,
  signIns: (perUser: number, absolute: number) => `At least ${count(perUser, 'sign-in')} per active user in the population (or ${absolute} total).`,
  zeroFailures: 'Zero report-only failures or interruptions.',
  careVerified: (n: number) => `Every handle-with-care user in scope is verified (${n} to check).`,
  operatorStrong: 'The signed-in account has a strong method registered. IAMAI checks this.',
  thenEnforce: 'Then enable the policy (Enforce).',
}

export const ROLLBACK = {
  prerequisite: 'Nothing destructive here: objects created can be deleted.',
  adjust: 'Revert the changed fields to their previous values; the previous body is in the policy history.',
  create: 'Switch the policy back to report-only (or delete it); nothing else changes.',
}

export const COMMS = {
  verify: (tenant: string) =>
    `Hi everyone,\n\nOver the next two weeks ${tenant} is checking that everyone can use Microsoft Authenticator. Two minutes now saves a lockout later: go to https://aka.ms/mfasetup and add Microsoft Authenticator. We will follow up personally with anyone who gets stuck.\n\nIT`,
}

export const READINESS = {
  mfaCounts: (c: Record<'verified' | 'likelyViable' | 'notChallenged' | 'unverified' | 'none', number>) =>
    `${c.verified} verified, ${c.likelyViable} likely viable, ${c.notChallenged} not challenged, ${c.unverified} unverified, ${c.none} without a method`,
  mfaReady: (percent: number, active: number) => (active === 0 ? 'No active users in scope.' : `${percent}% of ${count(active, 'active user')} ready`),
  guests: (n: number) => `${count(n, 'active guest')} in the collected sign-in records`,
  adminsPr: (withPr: number, total: number) =>
    total === 0 ? 'No active admins in scope.' : `${withPr} of ${count(total, 'admin')} hold a phishing-resistant method`,
  eligibleOnly: (n: number) => `${count(n, 'eligible-only admin')} out of scope until activation`,
  devices: (withDevice: number, members: number) =>
    members === 0 ? 'No active members in scope.' : `${withDevice} of ${count(members, 'active member')} own a compliant device`,
  block: 'Readiness is measured by usage: see who used this below.',
  location: 'Compare the countries seen in the sign-in records with the allowed list.',
}

export const EVIDENCE = {
  unusable: 'Sign-in records are not usable for this scan: readiness alone is shown; nothing is hidden.',
  noUsage: (label: string) => `Nobody used ${label} in the collected sign-in records: expect zero impact.`,
  usage: (users: number, label: string, signIns: number, detail: string) =>
    `${count(users, 'user')} used ${label} (${count(signIns, 'sign-in')}; ${detail}): these are the people the change touches.`,
  reportOnly: (signIns: number, days: number, failures: number) =>
    `Report-only results: ${count(signIns, 'sign-in')} over ${count(days, 'day')}, ${count(failures, 'failure or interruption', 'failures or interruptions')}.`,
  notSeenYet: 'The created policy has not appeared in sign-in results yet.',
  none: "No sign-ins in the last 30 days matched this policy's conditions.",
  notMeasured: 'Sign-in records measure this once the policy exists in report-only; until then readiness is the guide.',
  legacyAuth: 'legacy authentication',
  deviceCode: 'the device-code flow',
  authTransfer: 'authentication transfer',
}

export function affectedLine(total: number, active: number, admins: number, guests: number): string {
  const bits = [`${count(total, 'person', 'people')}`, `${active} active`]
  if (admins > 0) bits.push(`${count(admins, 'admin')}`)
  if (guests > 0) bits.push(`${count(guests, 'guest')}`)
  return bits.join(' · ')
}

export { plural }
