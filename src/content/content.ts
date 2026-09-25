// The content loader (prompt 51 Part 1, target-state §8.9). Every sentence the
// product shows lives in docs/design/content.json and is imported here at build
// time; the engine fills its variables and never composes a sentence. This
// module is the single import point and the typed accessor; the fill engine
// (fill.ts) and the renderers (render.ts) read from it.
import contentJson from '../../docs/design/content.json' with { type: 'json' }

/**
 * A step's Microsoft page. `checkedOn` (ISO date) is the day the repository
 * records that page as read — a wave spec's source table — and is what a step
 * with no implementation-content package dates its source line from
 * (stepPackage.ts sourceCheckedLine). Absent where nothing recorded a check; it
 * is never inferred (S6).
 */
export type Learn = { url: string; checkedOn?: string }

/**
 * One entry in the step catalogue; fields absent on a given step are
 * null/undefined.
 *
 * `title` and `why` are optional because two step families carry their own: a
 * free-tier ladder rung is named by data/free-tier-ladder.json, and a validation
 * blocker's title and its "N must-fix checks outstanding" sentence are composed
 * from the failing checks (src/copy/validation.ts). Their entries here add only
 * the words the engine does not have - What to do, and Done when - rather than
 * writing the title down a second time.
 */
export type ContentStep = {
  id: string
  kind: 'blocker' | 'object' | 'check' | 'campaign' | 'policy' | 'ladder' | 'decision'
  title?: string
  changeLine?: string | null
  partner?: string | null
  placement?: string | null
  licence?: string | null
  why?: string
  learn?: Learn | null
  who?: Record<string, unknown> | null
  decision?: Record<string, unknown> | null
  whatToDo?: Record<string, unknown> | null
  /** The What to do for a read state (render.ts whatToDoFor): a fact the scan read, and the object that replaces `whatToDo` where it holds. */
  whatToDoWhen?: Record<string, Record<string, unknown>> | null
  dates?: string | null
  doneWhen?: string[] | null
  /** The Done-when for a read state (render.ts doneWhenFor): a fact the scan read, and the lines that replace `doneWhen` where it holds. */
  doneWhenWhen?: Record<string, string[]> | null
  /**
   * The Tasks Remaining card's own words on a step that delivers no policy: the
   * subject the card is about, and the check the scan's reading is. Without
   * them the card is headed by the step's kind and checked by the step's own
   * title, so three of its four lines are the step's name (quality audit 2.1).
   */
  card?: { subject: string; check: string } | null
  /** The Implementation Task's name where the step submits no operation: a verb phrase, not the step's title. */
  taskTitle?: string | null
  /** A held policy's end state in this step's own words (stepContract.ts doneWhenOf), else the shared one. */
  doneEnd?: string | null
  ifWrong?: string | null
  /** The If-it-goes-wrong line for a read state (render.ts ifWrongFor): a fact the scan read, and the line — or null, none — that replaces `ifWrong` where it holds. */
  ifWrongWhen?: Record<string, string | null> | null
  lockedOut?: { label: string; steps: string[] } | null
  comms?: Record<string, unknown> | null
  doesntApply?: boolean
  skip?: boolean
  scanControl?: boolean
  more?: Record<string, unknown> | null
  example?: Record<string, unknown> | null
  mergesGoals?: string[]
}

export type ContentFile = {
  $comment: string
  version: number
  shared: Record<string, unknown>
  /** The Plan's group names: the numbered phases, and the floor group (roadmap/floor.ts), which is dated by nothing and named by itself. */
  phases: { first: string; middle: string; last: string; heading: string; headingDay: string; recommended: string }
  pages: Record<string, Record<string, unknown>>
  cleanup: Record<string, { title: string; learn: Learn; why: string; whatToDo: string[]; doneWhen: string[] }>
  steps: ContentStep[]
}

export const content = contentJson as unknown as ContentFile

/** The shared references usable inside any string, and the per-step catalogue. */
export const shared = content.shared
export const steps = content.steps
export const stepById: Record<string, ContentStep> = Object.fromEntries(steps.map((s) => [s.id, s]))
export const cleanup = content.cleanup
export const phases = content.phases
export const pages = content.pages
/**
 * The product's wordmark, name and descriptor. The wordmark and the descriptor make
 * the page title (vite.config.ts); the name is the registered Entra application's.
 * They live with the app's own words (pages.app.shell.product) rather than on the
 * home page, which since task 016 introduces IAMAI by what it does, not by a tool card.
 */
export const planner = (content.pages.app.shell as { product: { wordmark: string; name: string; descriptor: string } }).product

/** The words the app chrome and the surfaces show (pages.app): the header, the scan progress, the print cover, the export alerts. */
export type AppWords = {
  shell: Record<string, string> & { tabs: { connect: string; plan: string; readiness: string; export: string; how: string } }
  /** The error page (components/ErrorBoundary.tsx): the lead, what is intact, the three buttons and where to send the diagnostics. */
  error: { title: string; lead: string; body: string; reload: string; diagnostics: string; startOver: string; send: string; detail: string }
  scan: { reading: string; found: string; signInsBar: string; signInsBarCovered: string; evidenceStatus: Record<string, string>; sections: Record<string, string> }
  connect: Record<string, string>
  plan: Record<string, string>
  readiness: Record<string, string>
  export: Record<string, string>
  print: Record<string, string> & {
    cover: Record<string, string>
    posture: Record<string, string>
    timelineColumns: Record<string, string>
    /** The undated group the document prints after the phases, as the Plan draws it (planRows.ts). */
    held: { heading: string; lead: string }
  }
  how: Record<string, string> & {
    limitsList: string[]
    lanes: Record<string, string>
    columns: Record<string, string>
    /** The static rules on the tenant's own policies (roadmap/staticRules.ts), one row per engine.staticRules key. */
    staticChecks: { caption: string; severity: string; rows: Record<string, { what: string; why: string }> }
    /** The plan's prerequisite checks that are steps rather than registry rules, by step id ({step} is the step's title). */
    prerequisiteChecks: { severity: string; rows: Record<string, { what: string; why: string }> }
    /** "What IAMAI reads" in plain words, by registry read name (ui/surfaces/howView.ts howReadTables). */
    readConditions: { licence: string; core: string; section: string }
    readRows: Record<string, { why: string; note?: string }>
  }
  /** The Inventory's words (ui/surfaces/inventoryTables.ts): capability names, and what a table says of a section the scan did not read in full. */
  inventory: {
    caps: Record<string, string>
    notRead: string
    notReadNoReason: string
    tooLittle: string
    partlyRead: string
    partlyReadNoReason: string
    columnNotRead: string
    columnNotReadNoReason: string
    columnPartlyRead: string
    columnPartlyReadNoReason: string
    noneSeen: string
    hiddenNoteEligibleUnread: string
    appsNone: string
    appsSource: string
    unnamedGroup: string
    unnamedLocation: string
    locationNotRead: string
    unnamedStrength: string
    strengthNotRead: string
    targetsExcept: string
    authenticatorMode: string
    deviceFilterInclude: string
    deviceFilterExclude: string
    termsOfUse: string
    riskRemediation: string
    signInEveryTime: string
    workloadSeen: string
    workloadNotSeen: string
    licensed: string
    notAsked: string
    policiesNone: string
    licencesNone: string
    blockedNone: string
  }
  picker: { placeholder: string; remove: string; searching: string; noMatches: string; typeToSearch: string; suggestions: string; results: string; done: string; matched: string; choose: string }
}
export const app = content.pages.app as unknown as AppWords

/** The engine's own words (shared.engine): the plan-length sentence, the tracking notes, the housekeeping lines, the picker signal words. */
export type EngineWords = {
  critical: Record<string, string>
  tracking: Record<string, string> & { regression: Record<string, string> }
  skip: { cannotSkip: string; unskip: string }
  planFile: { revisionCreated: string; revisionImported: string }
  staticRules: Record<string, string>
  serviceSignals: Record<string, string>
  emergencySignals: Record<string, string>
  /** What a personal device can still do once devices are required (E7): the browser with limits while the unmanaged-browser step is on the plan, else blocked. */
  personalDevices: { browserLimited: string; blocked: string }
  /** The single next thing on a step (roadmap/lifecycle.ts nextMilestone). */
  milestone: Record<string, string>
  /** The contradiction a reviewed baseline source carries, one entry per reviewed source (roadmap/baselineConflict.ts). */
  baselineConflict: Record<string, string>
  /** What this scan saw against what the last one saw (roadmap/observation.ts). */
  observation: Record<string, string> & { states: { absent: string; disabled: string; reportOnly: string; enforced: string; unknown: string }; dimensions: Record<string, string> }
  /** Which half of a safety choice's detection came up short (mapping/safetyChoice.ts). */
  detectionGap: { groups: string; policies: string }
  /** The value a readiness threshold is stated against where the scan measured none (roadmap/generate.ts). */
  readiness: { notMeasured: string; measureStrength: Record<string, string>; strengthUnnamed: string; blind: string; blindFix: string; blindFixLicensed: string; routeShortfallNone: string; routeShortfallSome: string; noneJudged: string; noneJudgedOne: string; methodLine: string; methodLineSignIn: string; methodLineOff: string; offMethods: Record<string, string>; deviceComputers: string; deviceBoth: string }
  /** Why an observation has not completed (roadmap/evidence.ts); `status` fills {reason} where the sign-in source states none. */
  evidence: { failures: string; legacyBlocked: string; legacyBlockedMail: string; deviceCodeBlocked: string; methodBlocked: string; unreadable: string; status: Record<'pending' | 'insufficient' | 'disabled' | 'error' | 'none', string> }
  /** One cohort's words wherever it is counted: people, guests, or both (derive/whoLine.ts cohortWords). */
  cohort: { people: string; guests: string; both: string }
  /** Who the sign-in records show using what Block Legacy Authentication and Block Device Code Sign-in stop (roadmap/blockSignIns.ts); {n} is a count. */
  blockSignIns: { legacyLabel: string; legacySome: string; legacyNone: string; deviceCodeLabel: string; deviceCodeSome: string; deviceCodeNone: string; legacyMove: string; deviceCodeMove: string; more: string }
  /** Why an existing policy that is the goal's policy does not put it in place (coverage/coverage.ts). */
  coverage: {
    reason: { exclusionMissing: string; conditionsNarrower: string; guestTypes: string; guestTypesWeaker: string }
    gap: { exclusionMissing: string; conditionsNarrower: string; guestTypes: string; guestTypesWeaker: string }
    statement: { exclusionMissing: string; conditionsNarrower: string; conditionsRecorded: string; guestTypes: string; guestTypesWeaker: string }
    conditions: Record<string, string>
  }
  /** The name directory's fallback for a role holder it holds no name for (names.ts label). */
  names: { unnamedHolder: string }
}
export const engine = shared.engine as unknown as EngineWords

export const workflowWords = contentJson.pages.app.plan.workflows

/** Define Your Rollout Scope (roadmap/direction.ts, DirectionStep.tsx): the four steps' words, their questions and the hold the dependent policies read. */
export const directionWords = contentJson.pages.app.plan.direction

export const structuralWords = contentJson.pages.app.plan
export const schedulingWords = contentJson.pages.plan.when
