// The content loader (prompt 51 Part 1, target-state §8.9). Every sentence the
// product shows lives in docs/design/content.json and is imported here at build
// time; the engine fills its variables and never composes a sentence. This
// module is the single import point and the typed accessor; the fill engine
// (fill.ts) and the renderers (render.ts) read from it.
import contentJson from '../../docs/design/content.json' with { type: 'json' }

export type Learn = { url: string }

/** One entry in the step catalogue; fields absent on a given step are null/undefined. */
export type ContentStep = {
  id: string
  kind: 'blocker' | 'object' | 'check' | 'campaign' | 'policy' | 'ladder'
  title: string
  changeLine?: string | null
  partner?: string | null
  placement?: string | null
  licence?: string | null
  why: string
  learn?: Learn | null
  who?: Record<string, unknown> | null
  decision?: Record<string, unknown> | null
  whatToDo?: Record<string, unknown> | null
  dates?: string | null
  doneWhen?: string[] | null
  ifWrong?: string | null
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
  phases: { first: string; middle: string; last: string; heading: string }
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
/** The product's name and descriptor (pages.home.planner): the wordmark and the page title. */
export const planner = (content.pages.home as { planner: { name: string; descriptor: string } }).planner

/** The words the app chrome and the surfaces show (pages.app): the header, the scan progress, the print cover, the export alerts. */
export type AppWords = {
  shell: Record<string, string> & { tabs: { today: string; plan: string; export: string } }
  /** The error page (components/ErrorBoundary.tsx): the lead, what is intact, the three buttons and where to send the diagnostics. */
  error: { title: string; lead: string; body: string; reload: string; diagnostics: string; startOver: string; send: string; detail: string }
  scan: { reading: string; found: string; signInsBar: string; signInsBarCovered: string; evidenceStatus: Record<string, string>; sections: Record<string, string> }
  connect: Record<string, string>
  plan: Record<string, string>
  today: Record<string, string>
  export: Record<string, string>
  print: Record<string, string> & { cover: Record<string, string>; posture: Record<string, string>; timelineColumns: Record<string, string> }
  how: Record<string, string> & { limitsList: string[]; lanes: Record<string, string>; columns: Record<string, string> }
  inventory: { caps: Record<string, string>; workloadNames: Record<string, string> }
  picker: { placeholder: string; remove: string; searching: string; noMatches: string; typeToSearch: string; suggestions: string; results: string; done: string }
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
  /** What this scan saw against what the last one saw (roadmap/observation.ts). */
  observation: Record<string, string> & { states: { absent: string; disabled: string; reportOnly: string; enforced: string; unknown: string } }
}
export const engine = shared.engine as unknown as EngineWords
