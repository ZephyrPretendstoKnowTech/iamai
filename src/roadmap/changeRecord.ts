// The change record (roadmap-v2.md §8, prompt 30 §1): a record of what
// changed and when, one row per step, as Markdown or CSV. Pure, so the
// export can be tested for what it contains.
import { absoluteDate } from '../copy/dates.ts'
import { PROGRESS, SCHEDULE_TAB } from '../copy/progress.ts'
import { ROADMAP } from '../copy/pages.ts'
import { SECTION } from '../copy/stepContent.ts'
import { EFFORT, WATCH } from '../copy/comms.ts'
import { STEP_KIND_LABEL, stepKindLabel } from '../copy/steps.ts'
import { TRACK } from '../copy/progress.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Schedule } from './schedule.ts'
import { stepProgress, trackable } from './tracking.ts'
import type { Step } from './types.ts'
import { effortFor, watchFor } from './watch.ts'
import { SKIP } from '../copy/skip.ts'

export const CHANGE_RECORD_HEADER = [SCHEDULE_TAB.colStep, ROADMAP.kindLabel, ROADMAP.goalLabel, ROADMAP.whoItTouches, PROGRESS.colPlanned, PROGRESS.colActual, ROADMAP.evidenceLabel, SECTION.rollback, EFFORT.title, WATCH.title]

export function changeRecordRows(steps: Step[], schedule: Schedule, snapshot: TenantSnapshot, nameOf: (id: string) => string, watchThreshold: number): (string | number)[][] {
  const progress = stepProgress(steps, schedule)
  // Skipped steps are in the record, with their reason.
  //
  // They used to be filtered out with everything else trackable() drops, so a
  // decision somebody made deliberately left no trace in the one artifact meant
  // to be an audit of what was done and why (prompt 44 item 2). A change record
  // that silently omits the changes nobody made is not a record.
  const skipped: (string | number)[][] = steps
    .filter((st) => st.status === 'skipped')
    .map((st) => [
      st.plainTitle || st.title,
      stepKindLabel(st),
      st.goalId,
      st.populationBasis || PROGRESS.absent,
      PROGRESS.absent,
      SKIP.skippedChip,
      st.skipReason ?? SKIP.skippedChip,
      st.rollback,
      '',
      '',
    ])
  const rows: (string | number)[][] = trackable(steps).map((st) => {
    const row = progress.find((r) => r.stepId === st.id)
    const evidence = st.tracking
      ? `${st.tracking.policyName} (${st.tracking.note})${st.tracking.enforcedAt ? `; ${TRACK.enforced(absoluteDate(st.tracking.enforcedAt))}` : ''}`
      : (st.history.at(-1)?.note ?? st.stateReason)
    return [
      st.plainTitle || st.title,
      stepKindLabel(st),
      st.goalId,
      st.populationBasis || PROGRESS.absent,
      row?.plannedStart ? absoluteDate(row.plannedStart) : PROGRESS.absent,
      row?.actualStart ? absoluteDate(row.actualStart) : PROGRESS.absent,
      evidence,
      st.rollback,
      effortFor(st).sentence,
      watchFor(st, snapshot, nameOf, watchThreshold)?.sentence ?? '',
    ]
  })
  return [...rows, ...skipped]
}

export function changeRecordMarkdown(rows: (string | number)[][], tenantName: string, planId: string, revision: number): string {
  const esc = (v: string | number) => String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const lines = [`# Change record: ${tenantName}`, `Plan ${planId}, revision ${revision}, ${absoluteDate(new Date().toISOString())}`, '', `| ${CHANGE_RECORD_HEADER.join(' | ')} |`, `| ${CHANGE_RECORD_HEADER.map(() => '---').join(' | ')} |`]
  for (const r of rows) lines.push(`| ${r.map(esc).join(' | ')} |`)
  return lines.join('\n')
}
