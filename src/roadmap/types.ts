// Roadmap types (roadmap.md §1, §3–§5). Pure types only.
import type { GoalScore } from '../scoring/priority.ts'

export type StepKind = 'prerequisite' | 'create' | 'adjust' | 'verify' | 'enforce' | 'recurring'

export type StepStatus = 'done' | 'ready' | 'blocked' | 'in-report-only' | 'ready-to-enforce' | 'skipped'

export type StepPopulation = {
  total: number
  active: number
  admins: number
  guests: number
  ids: string[]
}

export type Readiness = {
  family: 'mfa' | 'admin' | 'device' | 'guest' | 'block' | 'location' | 'other'
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
}

export type Blocker =
  | { kind: 'step'; stepId: string; label: string }
  | { kind: 'setup'; questionNumber: number; label: string }
  | { kind: 'readiness'; label: string }
  | { kind: 'evidence'; label: string }

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
  exitCriteria: string[]
  rollback: string
  history: StepHistoryEntry[]
  skipReason: string | null
  /** Policies that already deliver the goal (name and state), the evidence a Done step cites (ux-review-04 §5). */
  deliveredBy: string[]
  /** One line: why the step is in its current state; filled by annotateStateReasons. */
  stateReason: string
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
  owner: string | null
  /** An operator-set start date; the schedule moves the step and its dependants to it. */
  scheduledDate: string | null
  /** What actually happened, from evidence (roadmap-v2.md §5); null until a policy matches. */
  tracking: StepTracking | null
  /** Satisfied by a policy whose evidence predates the plan: not executed by the plan, never a slip (ux-review-07 §1). */
  alreadyInPlace: boolean
}

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

export type FailureMode = { title: string; applies: 'yes' | 'no' | 'unknown'; evidence: string }
export type Verify = { where: string[]; filter: string | null; good: string }
export type HelpDesk = { callsAbout: string[]; whatToSay: string[] }
