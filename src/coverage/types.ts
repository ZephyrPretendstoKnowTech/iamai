// Types for the coverage engine (docs/design/intents.md). Pure types only.

export type StrengthTier = 'phishingResistant' | 'passwordless' | 'mfa'

export type GuestKinds = string[] // guestOrExternalUserTypes tokens; empty = unspecified

export type PolicyFacts = {
  name: string
  id: string
  state: 'enabled' | 'enabledForReportingButNotEnforced' | 'disabled' | 'unknown'
  isMicrosoftManaged: boolean
  who: {
    all: boolean
    members: boolean
    guests: GuestKinds | null
    roles: Set<string>
    groups: Set<string>
    users: Set<string>
  }
  whoNot: {
    roles: Set<string>
    groups: Set<string>
    users: Set<string>
    guests: boolean
  }
  apps: {
    all: boolean
    office365: boolean
    adminPortals: boolean
    ids: Set<string>
    excludedIds: Set<string>
    userActions: Set<string>
    authContexts: Set<string>
    filterRule: string | null
  }
  clientApps: Set<string>
  platforms: { include: Set<string>; exclude: Set<string> } | null
  locations: { include: Set<string>; exclude: Set<string> } | null
  flows: Set<string>
  signInRisk: Set<string>
  userRisk: Set<string>
  spRisk: Set<string>
  deviceFilter: { mode: string; rule: string } | null
  workload: { sps: Set<string>; filterRule: string | null } | null
  grant: {
    operator: 'AND' | 'OR'
    controls: Set<string>
    strength: StrengthTier | null
    strengthId: string | null
    tou: boolean
  } | null
  session: {
    signInFrequencyHours: number | null
    /** frequencyInterval "everyTime" — reauthenticate on every sign-in. */
    signInFrequencyEveryTime: boolean
    persistentBrowser: 'always' | 'never' | null
    secureSignInSession: boolean
    cloudAppSecurity: string | null
    appEnforced: boolean
  }
}

export type GrantFloor =
  | 'mfa'
  | 'passwordless'
  | 'phishingResistant'
  | 'block'
  | 'compliantDevice'
  | 'compliantApplication'
  | 'approvedApplication'
  | 'passwordChange'

export type SessionFloor = {
  maxSignInFrequencyHours?: number
  signInFrequencyEveryTime?: boolean
  appEnforced?: boolean
  persistentBrowserNever?: boolean
  secureSignInSession?: boolean
  anyOf?: boolean
}

export type Floor = { grant?: GrantFloor; session?: SessionFloor }

export type Signature = Record<string, unknown>

export type PopulationSpec = { kind: 'all' | 'members' | 'guests' | 'coreAdmins' | 'workload' }

export type Implementation = {
  tier: 'free' | 'p1' | 'p2' | 'intune' | 'workloadId' | 'gsa' | 'mcas'
  kind: 'ca' | 'setting'
  signature: Signature
  expectedWho: PopulationSpec
  expectedApps: string
  floor: Floor
  allowedExclusions: string[]
  /**
   * The goal floor written as a Graph conditionalAccessPolicy body, with the
   * tenant's own objects as placeholders (src/roadmap/template.ts). The Do-it
   * body whenever no baseline policy matches the goal (prompt 46 item 11).
   */
  template: Record<string, unknown>
}

/**
 * How the catalogue groups goals (prompt 37 §12). Rebalanced so no group holds
 * one item while another holds six: Guests and Locations each held a single
 * goal, and Identity held six by absorbing every protocol block. The blocks are
 * now "Legacy access", guest MFA and the country restriction are identity
 * conditions, and the admin session control sits with the other admin goals.
 * "Other" is for a goal that came from a baseline and matched no catalogue
 * entry; it is never guessed into a real group.
 */
export type Domain = 'Identity' | 'Admins' | 'Devices' | 'Sessions' | 'Legacy access' | 'Risk' | 'Other'

export type Goal = {
  id: string
  name: string
  /** The control noun, at most six words: what the proposed policy is named after (target-state §8.4). */
  shortName: string
  description: string
  phase: number
  /** Scoring inputs (ux-review-03 §A7); ad-hoc goals may lack them. */
  domain?: Domain
  securityValue?: number
  baseEffort?: number
  applicability: string | null
  implementations: Implementation[]
  free: unknown[]
  /** Microsoft Learn reference with a one-line summary, for every step/finding. */
  learnUrl?: string
  tldr?: string
  /** Related CIS Controls v8 safeguard ids. */
  cis?: string[]
}

export type ResolvedPopulation = {
  ids: Set<string>
  estimated: boolean
  unresolvedGroups: string[]
}

export type ReasonKind =
  | 'excluded'
  | 'not-targeted'
  | 'weaker-control'
  | 'report-only'
  | 'apps-narrower'
  | 'apps-excluded'
  | 'session-weaker'
  | 'disabled-candidate'

export type Reason = {
  kind: ReasonKind
  userIds: string[]
  detail: string
  /** true when the exclusion is an expected one (break-glass etc.) — reported, not a gap. */
  expected?: boolean
  /** weaker-control only: the policy meets the catalogue floor and misses only the baseline's raised one. */
  belowBaseline?: boolean
  /** weaker-control / session-weaker: what the policy does today, in words. */
  current?: string
  /** weaker-control / session-weaker: what the baseline expects, in words. */
  floor?: string
  /** excluded: the inferred/confirmed role of the excluding object ("breakGlass", "serviceAccounts"…). */
  role?: string | null
}

export type CandidateContribution = {
  policyId: string
  policyName: string
  state: PolicyFacts['state']
  contribution: 'strong' | 'weak' | 'reportOnly' | 'disabled'
  caveats: string[]
}

export type GoalStatus =
  /** The goal is met at the catalogue floor; only the baseline's raised floor is missed (ux-review-05 §10). */
  | 'below-baseline'
  | 'enforced'
  | 'partial'
  | 'absent'
  | 'licence-limited'
  | 'not-applicable'
  | 'unknown'

/**
 * The one verdict a goal has (target-state §8.2, prompt 46 item 9). Computed
 * once here; a step is in place if and only if its goal's verdict is inPlace,
 * and the plan header and footer count the same set. The status field carries
 * the classifier's finer result; the verdict is what every surface renders.
 */
export type Verdict = 'inPlace' | 'partly' | 'missing' | 'belowBaseline' | 'notApplicable' | 'licenceLimited' | 'unknown'

export type GoalResult = {
  goal: Goal
  status: GoalStatus
  /** One verdict, from the status. Set once in computeCoverage. */
  verdict: Verdict
  /**
   * The clause a partly-in-place row shows: "sessions expire every 168h,
   * baseline wants 4h". Null when the goal is in place, missing, or the gap
   * cannot be stated from the facts the classifier kept.
   */
  gapSentence: string | null
  statement: string
  enforcedIds: string[]
  weakIds: string[]
  reportOnlyIds: string[]
  expectedCount: number
  reasons: Reason[]
  candidates: CandidateContribution[]
  floorRaised: { from: string; to: string; by: string } | null
}

export type AssumedExclusions = {
  groups: Map<string, string> // groupId → inferred role label ('breakGlass' | 'globalExclusion' | 'serviceAccounts' …)
  users: Set<string> // directly-excluded assumed break-glass accounts
  confirmed: boolean // false until Mapping confirms — UI shows "assumed" banner
}

/**
 * A baseline policy the plan does not assess (prompt 46 item 14): no catalogue
 * goal matches it, or the adapter could not read it. Named as the baseline
 * names it, with its JSON and one reason, for the Plan footer. Never a goal,
 * a finding or a step.
 */
export type NotAssessed = { name: string; json: string | null; reason: string }

export type OrganisationReport = {
  notInBaseline: { id: string; name: string; state: string }[]
  notAssessed: NotAssessed[]
  consolidation: { goalId: string; goalName: string; policyNames: string[] }[]
  naming: {
    pattern: string | null
    share: number
    outliers: string[]
    /** The dominant prefix as written ("Core") and its separator (" - "). */
    prefix: string | null
    separator: string | null
    /**
     * The full convention: separator, segment count, casing, and whether the
     * prefix is a series (prompt 43 Part 2). Null where there is nothing to
     * read; below the agreement floor it is present but not usable, which is
     * what lets the report say how close the tenant came.
     */
    convention: import('../roadmap/convention.ts').Convention | null
    /** Names carrying no prefix at all, which is what makes a long list unreadable. */
    unprefixed: string[]
    /** Every tenant-owned policy name the convention was read from. */
    names: string[]
  }
  microsoftManaged: { id: string; name: string; state: string }[]
}

export type CoverageReport = {
  results: GoalResult[]
  couldNotEvaluate: { name: string; reason: string }[]
  organisation: OrganisationReport
  assumed: AssumedExclusions
  summary: {
    enforced: number
    partial: number
  /** Counted inside partial; shown with its own chip. */
  belowBaseline: number
    absent: number
    notApplicable: number
    licenceLimited: number
    unknown: number
    scoredPercent: number
  }
}
