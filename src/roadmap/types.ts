// Roadmap types (roadmap.md §1, §3–§5). Pure types only.
import type { GoalScore } from '../scoring/priority.ts'

/** `check`: a decision the operator makes about accounts, done when the count reaches 0 on re-scan (prompt 46 item 8). */
export type StepKind = 'prerequisite' | 'create' | 'adjust' | 'verify' | 'enforce' | 'recurring' | 'check'

export type StepStatus = 'done' | 'ready' | 'blocked' | 'in-report-only' | 'ready-to-enforce' | 'skipped'

export type StepPopulation = {
  /** Enabled accounts in scope (the "covers N enabled" count). */
  total: number
  active: number
  admins: number
  guests: number
  /** Every enabled id in scope. */
  ids: string[]
  /** The active in-scope people a row and a step name (target-state §8.1). */
  activeIds?: string[]
  /** Enabled accounts in scope, shown once as "covers N enabled". */
  inScope?: number
}

export type Readiness = {
  family: 'mfa' | 'admin' | 'device' | 'guest' | 'block' | 'location' | 'risk' | 'other'
  percent: number | null // null when readiness is evidence (block goals)
  lines: string[] // plain-language numbers per §4
}

export type Evidence = {
  status: 'ok' | 'partial' | 'insufficient' | 'disabled' | 'pending' | 'error' | 'none'
  lines: string[]
  affectedUserIds: string[]
  reportOnly: {
    daysObserved: number
    signIns: number
    failures: number
    meetsExitCriterion: boolean
  } | null
}

export type Action = {
  kind: StepKind
  summary: string[] // adjust: the exact field changes in words; others: what to do
  json: string | null // the policy body to create (report-only, tagged)
  portalSteps: string[] // Entra admin center click path, portal vocabulary
  powershell: string | null
  /** The roles a collapsed "All N directory roles" stands for (ux-review-05 §6). */
  roleList?: { summary: string; names: string[] } | null
  /** For a change to an existing policy: current value → new value, field by field (roadmap-v2.md §4). */
  changes?: { field: string; from: string; to: string }[]
  /** Objects a downloaded JSON leaves out because they do not exist yet (prompt 49.1 item 1); the caption above the tabs names them. */
  omits?: string[]
}

/**
 * A named cause. `binding` is the cause in one of the three blocked-reason
 * shapes (copy/reasons.ts BLOCKED_REASON), set by whoever knows the numbers;
 * a step blocker needs none, its step title is the reason.
 */
export type Blocker =
  | { kind: 'step'; stepId: string; label: string; binding?: string }
  | { kind: 'setup'; questionNumber: number; label: string; binding?: string }
  | { kind: 'readiness'; label: string; binding?: string }
  | { kind: 'evidence'; label: string; binding?: string }

export type StepHistoryEntry ={ at: string; from: StepStatus; to: StepStatus; note: string | null }

export type PopulationView = import('./population.ts').PopulationView

// ---- rings (roadmap-v2.md §1) ----
export type RingTargeting = {
  kind: 'group' | 'all'
  /** Group to create, in the tenant's naming convention; null for the policy's own include. */
  groupName: string | null
  memberCount: number
  /** Proposed members from readiness data; empty above the filter threshold. */
  suggestedMemberIds: string[]
  /** Dynamic membership rule in Entra's terms, when a list would be too long. */
  filter: string | null
  /** Departments the ring draws from (how two rings are compared above the filter threshold). */
  departments: string[]
  /** One sentence of targeting advice for this ring. */
  advice: string
}

export type Ring = {
  index: number
  name: string
  targeting: RingTargeting
  entryCriteria: string[]
  exitCriteria: string[]
  soakDays: number
  plannedStart: string
  plannedEnd: string
  /** Filled by re-scan evidence (roadmap-v2.md §5). */
  actualStart: string | null
  actualEnd: string | null
}

export type Step = {
  id: string
  goalId: string
  phase: number
  kind: StepKind
  title: string
  why: string
  whyAttribution: { author: string; url: string } | null
  /** A reference the baseline author pasted into the intent, shown as a named link (ux-review-05 §18). */
  whyLink: string | null
  status: StepStatus
  blockedBy: string[]
  /** Named causes (prompt 12 §B): a step, a Setup question, a readiness threshold, or evidence. */
  blockers: Blocker[]
  unblockNotes: string[] // exactly what unblocks it (roadmap.md §6)
  population: StepPopulation
  readiness: Readiness
  evidence: Evidence
  action: Action
  /**
   * A check step's failing checks and counts (prompt 52, walk-51 item 14),
   * routed from the validation rules through the content checkFixes templates.
   * Null on steps that carry no checks.
   */
  checks?: import('../validation/checkFixes.ts').StepChecks | null
  exitCriteria: string[]
  rollback: string
  history: StepHistoryEntry[]
  skipReason: string | null
  /**
   * The gap a partly-in-place or below-baseline goal leaves, as the clause a
   * plan row shows: "sessions expire every 168h, baseline wants 4h". Null when
   * there is no gap to state (prompt 46 item 9).
   */
  gap: string | null
  /** The gap shortened to one dimension for the row (prompt 50.1 item 9); the full sentence (gap) stays on the step. */
  gapShort: string | null
  /** Policies that already deliver the goal (name and state), the evidence a Done step cites (ux-review-04 §5). */
  deliveredBy: string[]
  /** One line: why the step is in its current state; filled by annotateStateReasons. */
  stateReason: string
  /**
   * The one binding reason while blocked (target-state §8.5): at most twelve
   * words, in one of three shapes; null otherwise. The full list is `blockers`.
   */
  blockedReason: string | null
  // ---- 2026-08-27 redesign ----
  /** One sentence: what this changes for THIS tenant, in numbers. */
  impact: string
  /** Zero observed usage + ready → promoted to the "safe today" lane. */
  safeToday: boolean
  /** Handle-with-care users this step touches; enforcement gates on ready. */
  highCare: { userIds: string[]; ready: boolean; notes: string[] }
  /** Paste-ready end-user announcement, personalized for this tenant. */
  comms: string | null
  learn: { url: string; tldr: string; cis: string[] } | null
  includesOperator: boolean
  operatorSafe: boolean | null // null when not applicable/unknown
  // ---- prompt 13 ----
  /** Evidence sentence for the operator's own account, when in scope. */
  operatorNote?: string | null
  /** What-If result for the operator, when available. */
  operatorWhatIf?: string | null
  /** Proposed policy name in the tenant's convention, and the baseline's original. */
  naming?: { proposed: string; fromBaseline: string | null; note?: string | null } | null
  // ---- prompt 17 ----
  /** Security value, effort, disruption, priority; null for prerequisite and recurring steps. */
  score?: GoalScore | null
  // ---- roadmap v2 ----
  /** Ordered rollout rings; one entry (or none) for steps that cannot deny access. */
  rings: Ring[]
  currentRing: number
  /** Whether enforcing this step can deny or interrupt access (grant, block, session), from the goal's floor. */
  denies?: boolean
  /** "N of M enabled users (P%), of whom K ..." (roadmap-v2.md §3). */
  populationBasis: string
  /** Everyone under 25 people; the ten riskiest above. */
  populationNames: string[]
  populationView: PopulationView | null
  // ---- step content (roadmap-v2.md §4) ----
  /** One sentence a non-technical manager understands. */
  whatChanges: string
  failureModes: FailureMode[]
  verify: Verify | null
  helpDesk: HelpDesk | null
  /** The announcement per ring, dated. */
  ringComms: { ring: string; date: string; text: string }[]
  /** The previous policy body for a change step, to restore byte for byte. */
  rollbackBody: string | null
  /** Reserved for an enterprise tier (SPEC §11a): never rendered or asked for. */
  owner: string | null
  /** An operator-set start date; the schedule moves the step and its dependants to it. */
  scheduledDate: string | null
  /** What actually happened, from evidence (roadmap-v2.md §5); null until a policy matches. */
  tracking: StepTracking | null
  /** Satisfied by a policy whose evidence predates the plan: not executed by the plan, never a slip (ux-review-07 §1). */
  alreadyInPlace: boolean
  // ---- prompt 28 ----
  /** Announce, remind, enforce: local day, date, time and reason (scheduling-and-onboarding.md §2.2). */
  events: StepEvents | null
  /** One line at the top of the card: safe to enforce today, or the single reason it is not. */
  safeVerdict: { safe: boolean; reason: string; sentence: string }
  /** The plain-language title; `title` stays the technical name (§3.1). */
  plainTitle: string
  /** Three sentences for a manager: the risk closed, the cost to people, what happens if not done (§3.3). */
  forManager: string
  /** A rung of the free-tier ladder (SPEC §12): the plan itself, never groundwork for a policy. */
  ladder?: boolean
  /** A must-fix validation subject (validation-rules.md §2); leads every surface. */
  validationBlocker?: boolean
  // ---- prompt 48: the lockout-scenario lines from this tenant's evidence ----
  /** Named lines built from the derivations that fired (docs/design/lockout-scenarios.md). */
  scenarioLines?: import('./scenarioLines.ts').ScenarioLine[]
  /** What the tool cannot see for this step, plain text under More; never a question. */
  cantSee?: string[]
  /** One-off notes on the Dates section (item 7): a device certificate prompt, a block's session-refresh timing. */
  dateNotes?: string[]
  /** The two recorded-by-hand emergency-access facts, ticked by hand and stored in the plan file (prompt 49 item 5). */
  tickable?: { text: string; key: 'credentialStorage' | 'signInMonitoring'; done: boolean }[]
}

export type StepEvent = { kind: 'announce' | 'remind' | 'enforce'; at: string; day: string; date: string; time: string; reason: string; outOfHours: boolean }
export type StepEvents = { announce: StepEvent | null; remind: StepEvent | null; remindMorning: StepEvent | null; enforce: StepEvent; noticeDays: number }

export type StepTracking = {
  policyId: string
  policyName: string
  matchedBy: 'tag' | 'fingerprint'
  note: string
  createdAt: string | null
  modifiedAt: string | null
  state: string
  reportOnlyAt: string | null
  enforcedAt: string | null
  regressedAt: string | null
  /** The scan that noticed the event; the event's own date is enforcedAt / reportOnlyAt. */
  noticedAt: string | null
  daysInReportOnly: number
  signIns: number
  failures: number
  interruptions: number
  failuresByUser: { userId: string; count: number }[]
  evidenceQuality: 'enough' | 'thin' | 'none'
}

/** Where the warning comes from: a Microsoft page, or an explicit field-practice label (audit-program §6). */
export type FailureMode = {
  title: string
  applies: 'yes' | 'no' | 'unknown'
  evidence: string
  citation?: import('../copy/validation.ts').Citation
}
export type Verify = { where: string[]; filter: string | null; good: string }
export type HelpDesk = { callsAbout: string[]; whatToSay: string[] }
