// A Cleanup row's body (target-state §5; prompt 52 Part 3): Why, What to do and
// Done when from content.cleanup, filled with the tenant's lists, shared by the
// Plan (opened in place) and the print (every step in full). A line with a hole
// is dropped (walk-51 item 2). The live controls (E3): Done records the row's
// date in the plan's checkpoints; the not-assessed row takes a per-policy
// "does not apply" note with its reason, stored in the plan file.
//
// It draws its sections with the step components and the one heading source
// (task 011), so a Cleanup row reads as the same kind of thing as a step rather
// than as a page that happens to sit under the same board.
import { useState } from 'react'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { app } from '../../content/content.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { Button, Status } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'
import { DoneWhen, StepSection } from './StepSections.tsx'
import { HEAD } from './stepHeadings.ts'
import { cleanupEntry, cleanupVars, cleanupWhen } from './cleanupExport.ts'
import type { NotAssessedNotes } from './cleanupExport.ts'

export { cleanupEntry, cleanupVars, cleanupWhen } from './cleanupExport.ts'
export type { CleanupEntry, NotAssessedNotes } from './cleanupExport.ts'

const A = app.plan

/** Today as the Done control's default, in the display zone's calendar day shape. */
function todayDate(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function CleanupBody({ phase, row, status, onScan, onClose, onDone, notes = {}, onNote, tenant = '' }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  status: { word: string; tone: StatusTone }
  /** The live controls; absent when printing. */
  onScan?: () => void
  onClose?: () => void
  /** Done: record the date (YYYY-MM-DD) in the plan's checkpoints. */
  onDone?: (date: string) => void
  /** The not-assessed row's notes by policy name, and the control that writes one (null clears it). */
  notes?: NotAssessedNotes
  onNote?: (policy: string, reason: string | null) => void
  tenant?: string
}) {
  const entry = cleanupEntry(row.kind)
  const [date, setDate] = useState(todayDate)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  if (!entry) return null
  const ex = cleanupVars(phase, row, notes)
  const whole = (line: string): boolean => missingVars(line, ex).length === 0
  const doneWhen = entry.doneWhen.filter(whole)
  const policies: string[] = row.kind === 'notAssessed' ? row.lists.policies ?? [] : []
  return (
    <div className="step-body">
      <p className="line">
        <span className="step-title">{entry.title}</span> <Status tone={status.tone}>{status.word}</Status>
      </p>
      {/* The same sections, in the same order, under the same headings as a step
          (StepSections.tsx, stepHeadings.ts). A Cleanup row is not a policy and
          has no lifecycle to be at, so it activates fewer of them; it does not
          get its own layout for the ones it does. */}
      <StepSection heading={HEAD.why}>
        <p>
          {fillText(entry.why, ex)}{' '}
          {entry.learn?.url && (
            <a href={entry.learn.url} target="_blank" rel="noopener noreferrer">
              Learn →
            </a>
          )}
        </p>
      </StepSection>
      <StepSection heading={HEAD.whatToDo}>
        <ol className="sections">{entry.whatToDo.filter(whole).map((l, i) => <li key={i}>{fillText(l, ex)}</li>)}</ol>
      </StepSection>
      {onNote && policies.length > 0 && (
        <div className="decision">
          <div className="dlabel">{A.notAssessedLabel}</div>
          {policies.map((p) => (
            <div key={p} className="option-value">
              <span className="reason">{p}</span>
              <input type="text" aria-label={fillText(A.notAssessedPrompt, { policy: p, tenant })} placeholder={fillText(A.notAssessedPrompt, { policy: p, tenant })} value={drafts[p] ?? notes[p] ?? ''} onChange={(e) => { const v = e.currentTarget.value; setDrafts((d) => ({ ...d, [p]: v })) }} />
              <Button variant="secondary" onClick={() => onNote(p, (drafts[p] ?? notes[p] ?? '').trim() || null)}>{A.notAssessedSave}</Button>
            </div>
          ))}
        </div>
      )}
      <DoneWhen heading={HEAD.doneWhen} lines={doneWhen.map((l) => fillText(l, ex))} />
      {onDone && (
        <div className="decision">
          <div className="dlabel">{A.cleanupDoneOn}</div>
          <input type="date" aria-label={A.cleanupDoneOn} value={date} onChange={(e) => setDate(e.currentTarget.value)} />
          <Button variant="secondary" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)} onClick={() => onDone(date)}>{A.cleanupDone}</Button>
          {row.done && <p className="reason">{cleanupWhen(row)}</p>}
        </div>
      )}
      {(onScan || onClose) && (
        <p className="actions no-print">
          {onScan && (
            <Button variant="secondary" onClick={onScan}>
              Scan to update the plan
            </Button>
          )}
          {onClose && (
            <Button variant="tertiary" onClick={onClose}>
              Close
            </Button>
          )}
        </p>
      )}
    </div>
  )
}
