// Roadmap types (roadmap.md §1, §3–§5). Pure types only.

/** `check`: a decision the operator makes about accounts, done when the count reaches 0 on re-scan (prompt 46 item 8). */
export type StepKind = 'prerequisite' | 'create' | 'adjust' | 'verify' | 'enforce' | 'check'

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
}

/**
 * One operation a step runs against the tenant: the whole of what IAMAI asks a
 * person to do for one policy, decided once at the roadmap boundary
 * (roadmap/generate.ts over roadmap/resolvePolicy.ts). The portal instructions,
 * the JSON, the PowerShell and the download all describe this operation — its
 * mode, its target and its body — and nothing else.
 */
type PolicyOperationBase = {
  /** The baseline's own name for the policy, so a merged goal can label Policy A and Policy B. */
  sourceName: string
  /**
   * The exact Graph request body to submit: the whole policy for a create, only
   * the fields that change for an update. Every field this body does not carry
   * is left as it is on the tenant's policy.
   */
  body: Record<string, unknown>
  /**
   * The same body without the person's answers — the baseline's own version —
   * present only where an answer changed the policy, so a step can show the
   * choice beside what the baseline said. Never a second thing to submit.
   */
  baseline?: Record<string, unknown>
  /**
   * The whole policy the operation is working towards, where the operation
   * itself is a partial update. Explanation, impact and audit read it; it is not
   * a second actionable body and no channel submits it.
   */
  target?: Record<string, unknown>
}

/**
 * A policy IAMAI writes: a new one, naming no tenant policy, or a change to the
 * one tenant policy it names. The two shapes are distinct so a mode can never
 * disagree with a target — an update without a policy is not an operation at
 * all, and roadmap/operations.ts refuses it rather than creating something.
 */
export type PolicyOperation = (PolicyOperationBase & { mode: 'create'; policyId?: null }) | (PolicyOperationBase & { mode: 'update'; policyId: string })

/**
 * The step's operations: one per policy the baseline uses for the goal, in the
 * baseline's order. `Action.json` is these operations' bodies and `Action.missing`
 * gates every channel that would run them.
 */
export type StepResolution = {
  /** One entry per policy the baseline uses for the goal, in the map's order. */
  policies: PolicyOperation[]
  /** The tenant objects the resolution used, so an instruction names the object the body actually holds. */
  tenant: { exclusionsGroupId: string | null; serviceAccountsGroupId: string | null; emergencyIds?: string[] }
}

export type Action = {
  kind: StepKind
  summary: string[] // adjust: the exact field changes in words; others: what to do
  json: string | null // the policy body to create (report-only, tagged)
  portalSteps: string[] // Entra admin center click path, portal vocabulary
  /** The roles a collapsed "All N directory roles" stands for (ux-review-05 §6). */
  roleList?: { summary: string; names: string[] } | null
  /** For a change to an existing policy: current value → new value, field by field (roadmap-v2.md §4). */
  changes?: { field: string; from: string; to: string }[]
  /**
   * Objects the body names that the tenant does not have yet: the token or id
   * left out of the JSON, and the Preparation step that creates it (null when no
   * step does). The JSON and PowerShell tabs wait on these; nothing is dropped silently.
   */
  missing?: { token: string; stepId: string | null }[]
  /**
   * The step's operations. Portal, JSON, PowerShell and Download all render
   * from these; nothing resolves a baseline reference or decides a mode again.
   */
  resolution?: StepResolution
  /**
   * Why the step offers no implementation although nothing it names is missing:
   * the plan cannot tell which of the tenant's policies is which half of a pair,
   * so it will not guess. The step says so and waits for a person to sort it out.
   */
  unmatchedPair?: boolean
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
}

export type Ring = {
  index: number
  name: string
  targeting: RingTargeting
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
  history: StepHistoryEntry[]
  skipReason: string | null
  /** The person's reason this step does not apply here (mapping.notApplicable): the step sits in the footer's Doesn't apply here group. */
  doesntApply?: string | null
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
  /** A strength policy's lockout count (roadmap/lockout.ts): the people in scope with no phishing-resistant method today; the row shows it when it is not zero. */
  lockout?: number
  /**
   * Who the records show this step's own policies touching (roadmap/strand.ts
   * measuredReach), computed where the snapshot is. Absent wherever the answer
   * is not known, and a zero is then never claimed: zero impact, the courtesy
   * notice, the zero batch class and the short soak all read this and nothing
   * filed under the goal.
   */
  measured?: { ids: string[] }
  /**
   * The one binding reason while blocked (target-state §8.5): at most twelve
   * words, in one of three shapes; null otherwise. The full list is `blockers`.
   */
  blockedReason: string | null
  // ---- 2026-08-27 redesign ----
  /** Paste-ready end-user announcement, personalized for this tenant. */
  comms: string | null
  learn: { url: string; tldr: string; cis: string[] } | null
  includesOperator: boolean
  operatorSafe: boolean | null // null when not applicable/unknown
  // ---- prompt 13 ----
  /** Evidence sentence for the operator's own account, when in scope. */
  operatorNote?: string | null
  /** Proposed policy name in the tenant's convention, and the baseline's original. */
  naming?: { proposed: string; fromBaseline: string | null; note?: string | null } | null
  // ---- prompt 17 ----
  // ---- roadmap v2 ----
  /** Ordered rollout rings; one entry (or none) for steps that cannot deny access. */
  rings: Ring[]
  currentRing: number
  /** Reserved for an enterprise tier (SPEC §11a): never rendered or asked for. */
  owner: string | null
  /** What actually happened, from evidence (roadmap-v2.md §5); null until a policy matches. */
  tracking: StepTracking | null
  // ---- prompt 28 ----
  /** Announce, remind, enforce: local day, date, time and reason (scheduling-and-onboarding.md §2.2). */
  events: StepEvents | null
  /** The plain-language title; `title` stays the technical name (§3.1). */
  plainTitle: string
  /** Three sentences for a manager: the risk closed, the cost to people, what happens if not done (§3.3). */
  forManager: string
  /** Microsoft recommended, not in this baseline (target-state §13, floor.ts): rendered from Microsoft's template because the active baseline lacks the goal. */
  floor?: boolean
  // ---- prompt 48: the lockout-scenario lines from this tenant's evidence ----
  /** Named lines built from the derivations that fired (docs/design/lockout-scenarios.md). */
  scenarioLines?: import('./scenarioLines.ts').ScenarioLine[]
  /** What the tool cannot see for this step, plain text under More; never a question. */
  cantSee?: string[]
  /** One-off notes on the Dates section (item 7): a device certificate prompt, a block's session-refresh timing. */
  dateNotes?: string[]
  /** The two recorded-by-hand emergency-access facts, ticked by hand and stored in the plan file (prompt 49 item 5). */
}

/**
 * What an export says about a step (prompt 53 queue item 7): the content file's
 * title, why and done-when lines filled with the tenant's values, the
 * translator's What to do — what the screen says, never the v2 engine's prose.
 * Built by src/ui/surfaces/stepExport.ts; the exporters take it as a function.
 */
export type ExportStep = {
  title: string
  why: string
  whatToDo: string[]
  doneWhen: string[]
  ifWrong: string | null
  dates: string | null
}
export type StepView = (step: Step) => ExportStep

/** A Cleanup row as an export says it (E4): the calendar entry on its day, the prompt pack's and the bundle's cleanup list. Built by src/ui/surfaces/cleanupExport.ts. */
export type CleanupExport = { kind: string; day: string; done: string | null; title: string; why: string; whatToDo: string[]; doneWhen: string[] }

export type StepEvent = { kind: 'announce' | 'remind' | 'enforce'; at: string; reason: string; outOfHours: boolean }
export type StepEvents = { announce: StepEvent | null; remind: StepEvent | null; remindMorning: StepEvent | null; enforce: StepEvent; noticeDays: number }

export type StepTracking = {
  policyId: string
  policyName: string
  matchedBy: 'tag' | 'fingerprint'
  note: string
  createdAt: string | null
  modifiedAt: string | null
  state: string
  /**
   * In report-only since: the earlier of the scan that first saw the policy in
   * report-only (PlanDecisions.reportOnlySeen) and the first sign-in record that
   * shows it evaluated in report-only. Null until the policy is in report-only.
   */
  reportOnlyAt: string | null
  enforcedAt: string | null
  regressedAt: string | null
  /** The scan that noticed the event; the event's own date is enforcedAt / reportOnlyAt. */
  noticedAt: string | null
  /** Days from reportOnlyAt to the scan. */
  daysInReportOnly: number
  /** The time gate: reportOnlyAt plus the step's observation window (constants.ts); null until the policy is in report-only. */
  readyOn: string | null
  /** The evidence gate: the records since reportOnlyAt show zero failures and every active person in scope at least once. */
  readyNow: boolean
  /** Active people in scope the records since reportOnlyAt have seen, over the active people in scope. */
  seenInScope: number
  activeInScope: number
  /** Records of this policy in the scan's window (any result). */
  signIns: number
  /** Failing or interrupted records since reportOnlyAt (the gate's zero). */
  failures: number
  failuresByUser: { userId: string; count: number }[]
  evidenceQuality: 'enough' | 'thin' | 'none'
}

/** Where the warning comes from: a Microsoft page, or an explicit field-practice label (audit-program §6). */
