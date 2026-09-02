// A Cleanup row's body (target-state §5; prompt 52 Part 3): Why, What to do and
// Done when from content.cleanup, filled with the tenant's lists, shared by the
// Plan (opened in place) and the print (every step in full). A line with a hole
// is dropped (walk-51 item 2).
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { cleanup as cleanupContent } from '../../content/content.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { Button, Status } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'

export type CleanupEntry = { title: string; why: string; whatToDo: string[]; doneWhen: string[] }

/** The content entry behind a Cleanup row, or null when content.cleanup lacks it. */
export function cleanupEntry(kind: string): CleanupEntry | null {
  return ((cleanupContent as Record<string, CleanupEntry>)[kind] ?? null)
}

/** The values a Cleanup row's lines fill: its lists and the tenant's naming shape. */
export function cleanupVars(phase: CleanupPhase, row: CleanupPhase['rows'][number]): Record<string, unknown> {
  return { ...row.lists, ...(phase.convention ? { convention: phase.convention } : {}) }
}

export function CleanupBody({ phase, row, status, onScan, onClose }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  status: { word: string; tone: StatusTone }
  /** The live controls; absent when printing. */
  onScan?: () => void
  onClose?: () => void
}) {
  const entry = cleanupEntry(row.kind)
  if (!entry) return null
  const ex = cleanupVars(phase, row)
  const whole = (line: string): boolean => missingVars(line, ex).length === 0
  const doneWhen = entry.doneWhen.filter(whole)
  return (
    <div className="step-body">
      <p className="line">
        <span className="step-title">{entry.title}</span> <Status tone={status.tone}>{status.word}</Status>
      </p>
      <h3>Why</h3>
      <p>{fillText(entry.why, ex)}</p>
      <h3>What to do</h3>
      <ol className="sections">{entry.whatToDo.filter(whole).map((l, i) => <li key={i}>{fillText(l, ex)}</li>)}</ol>
      {doneWhen.length > 0 && (
        <>
          <h3>Done when</h3>
          <ul className="sections">{doneWhen.map((l, i) => <li key={i}>{fillText(l, ex)}</li>)}</ul>
        </>
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
