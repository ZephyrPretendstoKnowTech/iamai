// Roadmap types (roadmap.md §1, §3–§5). Pure types only.

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
}

export type StepHistoryEntry = { at: string; from: StepStatus; to: StepStatus; note: string | null }

export type Step = {
  id: string
  goalId: string
  phase: number
  kind: StepKind
  title: string
  why: string
  whyAttribution: { author: string; url: string } | null
  status: StepStatus
  blockedBy: string[]
  unblockNotes: string[] // exactly what unblocks it (roadmap.md §6)
  population: StepPopulation
  readiness: Readiness
  evidence: Evidence
  action: Action
  exitCriteria: string[]
  rollback: string
  history: StepHistoryEntry[]
  skipReason: string | null
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
}
