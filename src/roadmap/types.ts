// Roadmap types (roadmap.md §1, §3–§5). Pure types only.

/** `check`: a decision the operator makes about accounts, done when the count reaches 0 on re-scan (prompt 46 item 8). */
export type StepKind = 'prerequisite' | 'create' | 'adjust' | 'verify' | 'enforce' | 'check'

/**
 * The one word a surface shows for a step. It is a *projection* of the step's
 * state (roadmap/lifecycle.ts): `projectStatus` is the only thing that writes
 * it, so the lifecycle stage, the condition and this word cannot disagree.
 * Nothing new should read it — read `Step.state` instead.
 */
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
  /**
   * Why there is no percentage, where there is none. The two are opposite facts
   * and were one `null`:
   *
   * - `no-population`: nobody is in scope, so there is nothing to be ready and
   *   no threshold to wait for. A step gated on this would wait for a number
   *   that can never arrive.
   * - `unreadable`: the source the number comes from could not be read, so
   *   readiness is *unknown*. Unknown is not met, and it holds enforcement
   *   exactly as a number below the line does (roadmap/generate.ts).
   *
   * Absent where `percent` is a number.
   */
  unmeasured?: 'no-population' | 'unreadable'
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
   * Which required member of the step this operation is — Policy A or Policy B —
   * as a stable opaque key over the baseline's own key for the policy
   * (observation.ts `memberKeyOf`). Not the tenant policy's id, which says which
   * object delivers the member today and nothing about which member it is, and
   * not `sourceName`, which is mutable display text.
   *
   * Foundation B keeps one observation, one artifact identity, one window and
   * one intent per member under this key, and the policies IAMAI creates carry
   * it in their plan tag so a pair cannot collapse to whichever half a search
   * happened to reach first.
   */
  memberKey: string
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

/**
 * One of the baseline's own references only a person can answer (a group, or a
 * location no Preparation step makes, that no settled reading of the baseline
 * explains), and where the answer stands. On a policy step, the ones its
 * policies name; on the source-references step, every one the plan's open
 * policies name, with the steps that name it (`stepIds`).
 */
export type SourceReference = { id: string; kind: 'group' | 'namedLocation'; answer: 'pending' | 'mapped' | 'omitted'; stepIds?: string[] }

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
   *
   * `unreadable` marks the ones no step ends: a source object no settled reading
   * of the baseline explains, which the surfaces say in words rather than by
   * naming an id out of the author's tenant (resolvePolicy.ts `unsettled`).
   */
  missing?: { token: string; stepId: string | null; unreadable?: true; decision?: true }[]
  /**
   * The baseline's own references a person said this tenant needs no counterpart
   * for (mapping.omittedReferences): left out of every body, and never waited on.
   * Kept apart from `authorOnly`, which rests on evidence rather than on a
   * person's answer.
   */
  omitted?: string[]
  /**
   * The baseline's own references this step's policies name that only a person
   * can answer — a group or a location no settled reading explains — with the
   * answer so far (resolvePolicy.ts `decisions`). The source-references step
   * lists them; a pending one is in `missing` and waits on that step.
   */
  sourceReferences?: SourceReference[]
  /**
   * The author's own objects this tenant's copy of the policy does without: a
   * source reference the baseline's interpretation settles, with evidence, as
   * the author's own environment — something this tenant has no counterpart for
   * and needs none (resolvePolicy.ts `authorOnly`).
   *
   * Apart from `missing` because that reading has already said there is nothing
   * to go and do. It is never inferred from where the reference sits: a group
   * only ever excluded, with nothing to say what it is, holds the step instead.
   */
  authorOnly?: string[]
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
  /**
   * The emergency access accounts this step's *final* policies do not put out of
   * scope (Foundation A, roadmap/generate.ts emergencyExposureOf). `reached` is
   * an account a final user scope names; `unproven` is one the scope cannot
   * settle either way on the membership this scan read completely.
   *
   * Written on the action before anything reads the step, because either list
   * being non-empty is the last word on whether the policy may be offered at
   * all — the step then has no operation, no cohort, no rings and no dates,
   * exactly as a missing object leaves it.
   */
  emergencyExposure?: { reached: string[]; unproven: string[] }
  /**
   * The readiness prerequisite this step's *enforcement* is held behind: the
   * measure, what it has to reach, and where it is now (roadmap/constants.ts
   * thresholds). Set on any open policy step whose threshold is unmet — and on
   * one whose readiness the scan could not measure at all, because a number
   * nobody established is not a number that has been reached.
   *
   * It is here, on the action, for the same reason the escape hatch is: the hold
   * has to be an implementation fact rather than a word. A step reading
   * "Blocked · when device readiness reaches 80% (now 29%)" still carried the
   * portal lines, the JSON, the PowerShell, four dated rings and an enforcement
   * event, and the calendar export handed the operator a dated entry for it.
   *
   * What it holds: every enforcement. Nothing is dated — no rings, no
   * enforcement event, no announcement, no calendar entry (`enforcementHeld`) —
   * and an operation that would enforce the moment it is submitted is not
   * offered at all (roadmap/operations.ts `policyResult`).
   *
   * What it deliberately does not hold: a safe report-only preparation. A new
   * policy lands in report-only and a patch that leaves a report-only policy in
   * report-only denies nobody; withholding those would be the tool requiring
   * strictness rather than helping with it, and they are how readiness gets to
   * the threshold in the first place.
   */
  readinessGate?: { measure: string; threshold: string; value: string }
  /**
   * The emergency-access foundation this step is held behind while its own
   * checks have not passed (roadmap/blockerSteps.ts GATING_SUBJECTS): the
   * break-glass accounts, or the exclusions group. Set only on a step that can
   * deny access, which is what those two hold.
   *
   * The step already carried this as a `blockedBy` edge and a status. Holding it
   * here as well is what makes the hold an implementation fact rather than a
   * word: the design says no enforcement is offered while the way back in is
   * unverified, and a step whose Portal, JSON, PowerShell and Download were all
   * there under the heading "Blocked" was offering exactly that.
   */
  escapeHatch?: { stepId: string }
}

/**
 * A named cause. `binding` is the cause in one of the three blocked-reason
 * shapes (copy/reasons.ts BLOCKED_REASON), set by whoever knows the numbers;
 * a step blocker needs none, its step title is the reason.
 */
export type Blocker =
  /**
   * `held`: the step waited on is itself held (roadmap/holds.ts markHoldChains),
   * so this wait is a hold and not sequencing. Absent on every other wait.
   */
  | { kind: 'step'; stepId: string; label: string; binding?: string; held?: true }
  | { kind: 'setup'; questionNumber: number; label: string; binding?: string }
  | { kind: 'readiness'; label: string; binding?: string }
  | { kind: 'evidence'; label: string; binding?: string }
  /**
   * A question for the operator, on the step where they answer it: the step is
   * not waiting on work, on a number, or on another step, it is waiting on a
   * person to choose (roadmap/lifecycle.ts `conditionFor` → `needs-decision`).
   *
   * Before this kind existed the only cause a step could name was work, so the
   * step that *holds* a safety-sensitive decision — the exclusions group nobody
   * has chosen (mapping/safetyChoice.ts) — read Healthy · Ready and was told to
   * "Make the object this step names", which is an instruction to create a
   * second group while two of the tenant's own already qualify.
   */
  | { kind: 'decision'; label: string; binding?: string }

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
  /**
   * Where the step is in the Conditional Access lifecycle, what condition it is
   * in, whether the goal is already delivered and whether the operator set it
   * aside. The authority: `status` below is derived from it.
   */
  state: import('./lifecycle.ts').StepState
  /** Derived from `state` by roadmap/lifecycle.ts `projectStatus`; never assigned anywhere else. */
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
  /**
   * The emergency-access step's two tiers (validation/emergencyTiers.ts): how
   * many minimum safety checks and hardening recommendations are outstanding, the
   * basis a deferral of the hardening is given against, and when the operator
   * deferred it where a deferral covers what is outstanding now.
   */
  emergency?: { minimum: number; hardening: number; basis: string; deferredAt: string | null } | null
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
  /**
   * Which tenant policies satisfy this step's goal, copied verbatim from the
   * classifier that decided it was satisfied (coverage/types.ts `Satisfaction`).
   * Absent on a step whose goal the classifier did not find satisfied.
   *
   * It is here because a surface has the step and not the coverage report, and
   * because the question "which policy delivers this goal" has exactly one
   * right answer and it is the classifier's. The scan's own member match
   * answers a different question — which deployed object this step's history is
   * about — and on a goal two policies satisfy together it resolves to one of
   * them, so nothing may read it as the satisfaction identity.
   */
  satisfiedBy?: { policies: string[]; sufficient: string | null }
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
   * The rollout cohort: the accounts this step's own policies *name*, read from
   * their user scope and resolved where the snapshot is (roadmap/strand.ts
   * scopeCohort). The rings, the who-line, the names and the announcement's
   * audience are this and nothing else.
   *
   * Absent on a step with no policy of its own — one already in place, the
   * enforce step, a prerequisite — which is bounded by the people it lists, as
   * it always was; and absent on an open policy whose scope could not be
   * settled, where an exact cohort is then never claimed and never filled in
   * from `population`.
   */
  cohort?: StepPopulation
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
  /**
   * The day the plan deploys this step's policy in report-only (the schedule's
   * own `reportOnlyAt`, carried on the step so every surface reads one date).
   * It is the only day a step whose policy is not deployed has: the rings and
   * the enforce event are a plan for a window that has not opened, and no
   * surface dates an enforcement from them until a scan finds the policy in
   * report-only. Null on a step that creates no policy.
   */
  reportOnlyAt?: string | null
  /**
   * Where the finished plan schedules this step (roadmap/stepSchedule.ts): its
   * class, the transition and day of its next milestone, its span and its phase.
   * Written once on the finished plan (roadmap/forecast.ts settleForecast); the
   * row's When, the phase it sits in, the phase's range, the rail and Waiting all
   * read it. Absent on a step no finished plan carries.
   */
  scheduled?: import('./stepSchedule.ts').StepSchedule
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
 *
 * Every field here is the frozen Step Contract's own answer (Foundation D). The
 * calendar entry, the prompt pack and the grounding bundle used to carry the
 * title, the why, What to do and Done when and nothing else, so a step the Plan
 * showed as "Not deployed · Blocked — Fix before continuing: finish Create or
 * Correct Exclusions Group first" left this browser as eight portal steps with
 * the thing it waits on nowhere in the file. The stage, the condition, the
 * dated next line, the reach, the outstanding prerequisites and whether an
 * implementation is offered at all travel with the step now, read once here and
 * never worked out again by an artifact builder.
 */
export type ExportStep = {
  title: string
  why: string
  /** Foundation B's lifecycle stage in words, or the outcome that stands in its place. */
  stage: string
  /** Foundation B's condition in words: Healthy, Blocked, Needs decision, Review required, Baseline conflict. */
  condition: string
  /** The one word the Plan's collapsed row shows; a projection of the two above, for scanning. */
  status: string
  /** Foundation B's dated next line, where it holds a date for one; null otherwise. */
  next: string | null
  /** Who the policy reaches, from the one population authority; null where the step reaches nobody. */
  who: string | null
  /**
   * How many active people the policy reaches: the one denominator the screen
   * states, from the same population authority, and null where Foundation A
   * could not settle the scope. A machine artifact reads this rather than a
   * stored count beside it.
   */
  population: number | null
  whatToDo: string[]
  /** What must be cleared before this step can move (never a passed check); empty where nothing holds it. */
  fix: string[]
  doneWhen: string[]
  ifWrong: string | null
  dates: string | null
  /** Whether Foundation A hands over an implementation today: the same answer the JSON, the PowerShell and the download read. */
  implementation: boolean
}
export type StepView = (step: Step) => ExportStep

/** A Cleanup row as an export says it (E4): the calendar entry on its day, the prompt pack's and the bundle's cleanup list. Built by src/ui/surfaces/cleanupExport.ts. */
export type CleanupExport = { kind: string; day: string; done: string | null; title: string; why: string; whatToDo: string[]; doneWhen: string[] }

export type StepEvent = { kind: 'announce' | 'remind' | 'enforce'; at: string; reason: string; outOfHours: boolean }
export type StepEvents = { announce: StepEvent | null; remind: StepEvent | null; remindMorning: StepEvent | null; enforce: StepEvent; noticeDays: number }

/**
 * One required policy member of a step, as this scan found it (Foundation B).
 *
 * A step is a row of the plan and a goal the baseline implements with two
 * policies is one step delivering two deployed artifacts. Everything temporal
 * belongs to the artifact, not to the row: the object watched, the window it has
 * served, Microsoft's evidence about it, the movement its own operation asked
 * for. So each member holds its own, and the step's aggregate below is derived
 * from all of them rather than taken from whichever one was found first.
 */
export type MemberTracking = {
  /** The member's stable identity (observation.ts `memberKeyOf`). */
  key: string
  /** The baseline's own name for this member, for the record. */
  sourceName: string
  /** The one tenant policy delivering this member; null where none is resolved. */
  policyId: string | null
  policyName: string | null
  /**
   * How the member was tied to that object, strongest first: the operation's own
   * target (Foundation A already settled it), the member's own plan tag, a plan
   * tag from before members were tagged plus the name the plan gives this member,
   * or — on a step with a single member only — the goal's coverage fingerprint.
   */
  matchedBy: 'operation-target' | 'member-tag' | 'step-tag' | 'member-name' | 'fingerprint' | null
  /**
   * The plan cannot say which object is this member: more than one candidate, or
   * a pair whose halves nothing tells apart. Nothing advances on a guess.
   */
  ambiguous: boolean
  /** Where this member's own policy is; never another member's stage. */
  lifecycle: import('./lifecycle.ts').Lifecycle
  /** Graph's own state for the matched policy, or `absent` where none is. */
  state: string
  createdAt: string | null
  modifiedAt: string | null
  reportOnlyAt: string | null
  reportOnlyAtSource: 'sign-in-evidence' | 'first-seen-by-iamai' | null
  enforcedAt: string | null
  enforcedAtSource: 'policy-modified' | 'policy-created' | 'carried-forward' | null
  /** This member has served its own window or met its own evidence gate. Never another member's. */
  ready: boolean
  /** This member's semantics moved somewhere its own operation did not ask for. */
  reviewRequired: boolean
  daysInReportOnly: number
  readyOn: string | null
  readyNow: boolean
  /** The sign-in collection covers the whole of this member's own report-only window, so its records are a reading of it. */
  windowRead: boolean
  seenInScope: number | null
  activeInScope: number | null
  signIns: number
  /** Failing or interrupted records for this member's own policy; null where its records were not read at all. */
  failures: number | null
  failuresByUser: { userId: string; count: number }[]
  evidenceQuality: 'enough' | 'thin' | 'none'
  /**
   * `configuration` on a member whose policy is scoped to a User Action, which
   * Microsoft does not evaluate in report-only (roadmap/evidenceStrategy.ts): its
   * readiness is its configuration, and no sign-in window is waited for or
   * claimed. Absent on every policy whose readiness is its sign-in records.
   */
  evidenceStrategy?: 'configuration'
}

export type StepTracking = {
  /**
   * Every required policy member of the step, resolved or not. The authority:
   * every aggregate field below is derived from these, and a surface that needs
   * one member's own fact reads it here rather than off the step.
   */
  members: MemberTracking[]
  /**
   * The one tenant policy delivering the step, where there is one. Null on a
   * step the baseline implements with two policies: no single object describes
   * the pair, and naming Policy A would say the step is what Policy A is.
   */
  policyId: string | null
  policyName: string | null
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
  /**
   * Which of the two `reportOnlyAt` is: a sign-in record evaluated under the
   * policy in report-only, which is Microsoft's own evidence that it was in
   * report-only that day, or IAMAI's own first sighting of it. Never a
   * transition time nobody recorded.
   */
  reportOnlyAtSource: 'sign-in-evidence' | 'first-seen-by-iamai' | null
  enforcedAt: string | null
  /**
   * Where `enforcedAt` comes from. The policy's own stamps are the tenant's
   * record of the object, not proof of the moment it began to enforce; a value
   * carried from an earlier scan is older still. Null when nothing dates it.
   */
  enforcedAtSource: 'policy-modified' | 'policy-created' | 'carried-forward' | null
  regressedAt: string | null
  /** The scan that noticed the event; the event's own date is enforcedAt / reportOnlyAt. */
  noticedAt: string | null
  /** Days from reportOnlyAt to the scan. */
  daysInReportOnly: number
  /** The time gate: reportOnlyAt plus the step's observation window (constants.ts); null until the policy is in report-only. */
  readyOn: string | null
  /** The evidence gate: the records since reportOnlyAt show zero failures and every active person in scope at least once. */
  readyNow: boolean
  /** `configuration` where every member's readiness is its configuration rather than its records (MemberTracking.evidenceStrategy). */
  evidenceStrategy?: 'configuration'
  /**
   * Whether the sign-in collection covers the whole window the evidence gate is
   * read over — `reportOnlyAt` to this scan — and dates the records it holds
   * about it (graph/collect/types.ts `reportOnlyDated`).
   *
   * False is not a fault in the tenant and not a failing record: it is a reading
   * that stopped short of the window, and the numbers beside it are what a part
   * of the window showed rather than what the window did. The gate cannot open
   * on it (tracking.ts `windowCollected`) and the surfaces say which of the two
   * they are looking at, so a partial reading is never stated as a clean one.
   * Meaningful only while the policy is in report-only.
   */
  windowRead: boolean
  /** Active people in scope the records since reportOnlyAt have seen, over the active people in scope. */
  /**
   * The evidence gate's two numbers, over the scope of the *matched tenant
   * policy* — the object the records are about — resolved from its own
   * conditions (roadmap/strand.ts scopeCohort). Never the goal's population:
   * a policy the tenant deployed reaches who it names, not who a goal is
   * filed under.
   *
   * Null where that scope could not be settled. A scope nobody established is
   * not an empty one, so the gate cannot be read as met and no count is shown.
   */
  seenInScope: number | null
  activeInScope: number | null
  /** Records of this policy in the scan's window (any result). */
  signIns: number
  /**
   * Failing or interrupted records since reportOnlyAt (the gate's zero).
   *
   * Null where the records this policy would be judged on were not read at all:
   * a scan with no sign-in evidence, a window that covers none of it, a policy
   * the evidence carries no result for. No records is not a clean window, and a
   * zero drawn from an empty set reads to a person exactly like a zero the
   * records prove (coverage/coverage.ts reportOnlyObservation says the same of
   * the same fact). The evidence gate cannot open either way, so nothing turns
   * on it but the words.
   */
  failures: number | null
  failuresByUser: { userId: string; count: number }[]
  evidenceQuality: 'enough' | 'thin' | 'none'
}

/** Where the warning comes from: a Microsoft page, or an explicit field-practice label (audit-program §6). */
