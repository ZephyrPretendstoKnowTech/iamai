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
}

export type Goal = {
  id: string
  name: string
  description: string
  phase: number
  applicability: string | null
  implementations: Implementation[]
  free: unknown[]
  /** Microsoft Learn reference with a one-line summary, for every step/finding. */
  learnUrl?: string
  tldr?: string
  /** Related CIS Controls v8 safeguard ids. */
  cis?: string[]
  /** Set for ad-hoc goals built from unmatched baseline policies. */
  adHocSource?: string
  /** Third-party vendor the policy targets (SPEC §7); not-applicable unless the app is seen in the tenant. */
  vendor?: { name: string; appIds: string[] }
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
  /** weaker-control / session-weaker: what the policy does today, in words. */
  current?: string
  /** weaker-control / session-weaker: what the baseline expects, in words. */
  floor?: string
}

export type CandidateContribution = {
  policyId: string
  policyName: string
  state: PolicyFacts['state']
  contribution: 'strong' | 'weak' | 'reportOnly' | 'disabled'
  caveats: string[]
}

export type GoalStatus =
  | 'enforced'
  | 'partial'
  | 'absent'
  | 'licence-limited'
  | 'not-applicable'
  | 'unknown'

export type GoalResult = {
  goal: Goal
  status: GoalStatus
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

export type OrganisationReport = {
  notInBaseline: { id: string; name: string; state: string }[]
  consolidation: { goalId: string; goalName: string; policyNames: string[] }[]
  naming: {
    pattern: string | null
    share: number
    outliers: string[]
    /** The dominant prefix as written ("Core") and its separator (" - "). */
    prefix: string | null
    separator: string | null
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
    absent: number
    notApplicable: number
    licenceLimited: number
    unknown: number
    scoredPercent: number
  }
}
