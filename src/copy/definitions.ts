// Definitions behind every state, tile, and chip a user sees: written for a
// novice. Every number on screen has an InfoTip that reads from here.

import { TERMS } from './terms.ts'
import { EVIDENCE_WINDOW_DAYS } from '../graph/collect/constants.ts'

/** Every headline percentage names its population and, where one applies, its window (ux-review-04 §1). */
export const POPULATION = { enabled: 'enabled users', active: 'active users', scored: 'scored goals' } as const
export const WINDOW = `the last ${EVIDENCE_WINDOW_DAYS} days`

export type Definition = { title: string; text: string }

// Titles come from the terminology dictionary (ux-review-03 §A8).
export const MFA_STATE = {
  verified: { title: TERMS.mfaState.verified, text: 'Completed MFA in the collected sign-in records: proven, not assumed.' },
  likelyViable: {
    title: TERMS.mfaState.likelyViable,
    text: 'A current Authenticator app, a recent registration, or a recently active Windows Hello device suggests MFA would succeed if required.',
  },
  notChallenged: {
    title: TERMS.mfaState.notChallenged,
    text: 'Signed in during the collected window, but nothing ever required MFA of them: enforcement is their first real test.',
  },
  unverified: { title: TERMS.mfaState.unverified, text: 'A method is registered but nothing shows it working: verify before enforcing.' },
  none: { title: TERMS.mfaState.none, text: 'No MFA-capable method registered. Email and security questions do not count.' },
} as const satisfies Record<string, Definition>

export const ACTIVITY_STATE = {
  active: { title: TERMS.activity.active, text: 'A successful sign-in within the last 90 days.' },
  dormant: { title: TERMS.activity.dormant, text: 'No successful sign-in for more than 90 days: planned separately, never counted as an MFA success.' },
  neverSignedIn: { title: TERMS.activity.neverSignedIn, text: 'No successful sign-in on record; the account creation date is shown instead.' },
} as const satisfies Record<string, Definition>

export const METHOD_TIER = {
  phishingResistant: { title: TERMS.methodTier.phishingResistant, text: 'Passkeys / FIDO2 security keys, Windows Hello for Business, or certificates.' },
  passwordless: { title: TERMS.methodTier.passwordless, text: 'Microsoft Authenticator passwordless phone sign-in.' },
  push: { title: TERMS.methodTier.push, text: 'Microsoft Authenticator push approval.' },
  otp: { title: TERMS.methodTier.otp, text: 'Software or hardware one-time passcodes.' },
  smsVoice: { title: TERMS.methodTier.smsVoice, text: 'Phone-based methods only: they work, but they are the weakest tier.' },
  none: { title: TERMS.methodTier.none, text: 'No MFA-capable method registered.' },
} as const satisfies Record<string, Definition>

export const GOAL_STATUS = {
  enforced: { title: 'In place', text: 'An enabled policy delivers this goal for everyone it should cover.' },
  partial: { title: 'Partly in place', text: 'A policy covers some of the people, or covers them with a weaker control than the goal needs.' },
  'below-baseline': { title: 'Below the baseline', text: 'The goal itself is met; the baseline sets a stricter bar (a stronger control or tighter limits) that the current policy does not reach.' },
  absent: { title: 'Missing', text: 'No enabled policy does this yet.' },
  'not-applicable': { title: 'Does not apply', text: 'The workload this goal protects is not used in this tenant, so it is left out of the score.' },
  'licence-limited': { title: 'Needs a licence', text: 'This goal needs a licence tier the tenant does not have. Listed for reference, not scored.' },
  unknown: { title: 'Could not tell', text: "A group's members could not be read, so the people this goal covers could not be counted." },
} as const satisfies Record<string, Definition>

export const STEP_STATUS = {
  done: { title: 'Done', text: 'Already delivered by an existing policy, or completed and confirmed by a re-scan.' },
  ready: { title: 'Ready', text: 'Nothing blocks this step; it can start on its scheduled date.' },
  blocked: { title: 'Blocked', text: 'A named earlier step, or a readiness threshold, has to clear first. The step says exactly which.' },
  'in-report-only': { title: 'In report-only', text: 'The policy exists in report-only mode and is collecting evidence; nobody is affected yet.' },
  'ready-to-enforce': { title: 'Ready to enforce', text: 'Report-only evidence meets the exit criteria: enough days, enough sign-ins, zero failures.' },
  skipped: { title: 'Skipped', text: 'Marked not applicable, with a written reason. Skipped steps stay in the plan for the record.' },
} as const satisfies Record<string, Definition>

export const STEP_KIND = {
  prerequisite: { title: 'Prerequisite', text: 'Something that has to exist before policies can be created: an account, a group, a location.' },
  create: { title: 'New policy', text: 'A policy to create in report-only mode, observe, then enforce.' },
  adjust: { title: 'Change', text: 'An existing policy that needs its scope or controls changed to meet the baseline.' },
  verify: { title: 'Verify', text: 'A campaign to prove people can complete MFA before anything is enforced.' },
  enforce: { title: 'Enforce', text: 'Switch a policy from report-only to on, once its evidence is clean.' },
  recurring: { title: 'Recurring', text: 'A check that repeats on a schedule, such as the break-glass sign-in drill.' },
} as const satisfies Record<string, Definition>

export const TILE = {
  inPlace: { title: 'In place', text: 'Goals an enabled policy fully delivers today.' },
  partly: { title: 'Partly', text: 'Goals a policy delivers for some people, or with a weaker control than the baseline expects.' },
  missing: { title: 'Missing', text: 'Goals no enabled policy delivers yet.' },
  scoredGoals: { title: 'Scored goals', text: 'Goals that apply to this tenant and its licence. Goals that do not apply, or need a missing licence, are left out.' },
  activeUsers: {
    title: 'Active users',
    text: `People with a successful sign-in in the last 90 days. The collected sign-in records cover only ${WINDOW}, so Sign-in records can show fewer distinct users than there are active users.`,
  },
  // Rollout tiles (ux-review-04 §1): every one is computed over all enabled
  // users, names that population, and names the sign-in window.
  mfaProven: {
    title: `MFA proven in ${WINDOW}`,
    text: `Enabled users with a successful MFA sign-in in the collected sign-in records (${WINDOW}), as a share of all enabled users. Proven means seen in a record, never assumed from a registered method; this is the share the old challenged rate described.`,
  },
  noMethod: {
    title: 'No MFA method',
    text: 'Enabled users with no MFA-capable method registered, as a share of all enabled users. Email and security questions do not count.',
  },
  registeredUnproven: {
    title: 'Registered but unproven',
    text: `Enabled users with a method but no successful MFA sign-in in ${WINDOW}: never prompted, or possibly broken. As a share of all enabled users.`,
  },
  toSetUp: {
    title: 'To set up before enforcement',
    text: `No MFA method plus Registered but unproven, over all enabled users: the people the verification campaign has to work through before any MFA policy is enforced.`,
  },
  readyToday: { title: 'Ready today', text: 'Steps nothing blocks: they can start on their scheduled date. Zero here is a state, not a failure: everything remaining waits on something the plan names.' },
  stepsDone: { title: 'Steps done', text: 'Plan steps already delivered by existing policies or completed since the plan started.' },
  weeks: { title: 'Weeks', text: 'Calendar weeks from the start date to the last phase end, counting the report-only observation windows.' },
  seats: { title: 'Seats', text: 'Licences purchased, and how many are assigned to users.' },
  seatShortfall: { title: 'Covers every user?', text: 'Whether purchased seats are enough for every user in the directory; the gap is users minus seats.' },
  registration: {
    title: 'Registration statistics',
    text: 'From the registration report: users who can complete MFA (capable), who have registered a method, who can sign in without a password, and a count per registered method.',
  },
  phaseProgress: { title: 'Done in this wave', text: 'Steps in this wave already delivered by existing policies or completed since the plan started.' },
} as const satisfies Record<string, Definition>

/** The three scores on every finding and step (ux-review-03 §A7). */
export const SCORE = {
  value: { title: 'Security value', text: 'How much the goal reduces risk, 1 to 5, from the catalogue; raised by one when the tenant shows the exposure it closes.' },
  effort: { title: 'Effort', text: 'How much work the change is, 1 to 5: the base effort plus prerequisites, objects to create, and a readiness gap.' },
  disruption: { title: 'Disruption', text: 'How many active users feel it and how hard, 1 to 5; lower when they are ready, when evidence is clean, and in smaller tenants.' },
  priority: { title: 'Priority', text: 'Security value × (6 − disruption): the biggest gain for the least interruption comes first; ties go to the easier change.' },
} as const satisfies Record<string, Definition>

export const CHIP = {
  safeToday: { title: 'Safe today', text: 'Nobody used what this policy blocks in the last 30 days, so enforcing it interrupts no one.' },
  care: { title: 'Handle with care', text: 'Named in Setup as someone an accidental lockout would hurt. Changes still apply; enforcement waits until they are verified, and they go last.' },
  guest: { title: 'Guest', text: 'An external account invited into this tenant.' },
  admin: { title: 'Admin', text: 'Holds at least one active directory role.' },
  cis: { title: 'CIS Controls', text: 'The CIS Controls v8 safeguard this goal supports: evidence for a compliance framework.' },
  expectedExclusion: { title: 'Expected exclusion', text: 'A break-glass account or the exclusions group: meant to be left out, so not counted as a gap.' },
} as const satisfies Record<string, Definition>

/** Legend groups in display order, for the Scan and Roadmap legends. */
export const LEGEND: { heading: string; items: Definition[] }[] = [
  { heading: TERMS.legendGroups.mfaState, items: Object.values(MFA_STATE) },
  { heading: TERMS.legendGroups.activity, items: Object.values(ACTIVITY_STATE) },
  { heading: TERMS.legendGroups.methodTier, items: Object.values(METHOD_TIER).filter((d) => d.title !== TERMS.methodTier.none) },
  { heading: 'Goal status', items: Object.values(GOAL_STATUS) },
  { heading: 'Step status', items: Object.values(STEP_STATUS) },
  { heading: 'Step kind', items: Object.values(STEP_KIND) },
  { heading: 'Numbers', items: Object.values(TILE) },
]

/**
 * Headline metrics and the population each is computed over. The
 * definitions test asserts the tile text names that population (and the
 * window, when one applies), so a filtered percentage can never read as a
 * whole-tenant one (ux-review-04 §1).
 */
export const HEADLINE_METRICS: { tile: Definition; population: string; window: string | null }[] = [
  { tile: TILE.mfaProven, population: POPULATION.enabled, window: WINDOW },
  { tile: TILE.noMethod, population: POPULATION.enabled, window: null },
  { tile: TILE.registeredUnproven, population: POPULATION.enabled, window: WINDOW },
  { tile: TILE.toSetUp, population: POPULATION.enabled, window: null },
  { tile: TILE.scoredGoals, population: POPULATION.scored, window: null },
]
