// What a running scan shows (docs/design/connect-mockup.html): the lane in
// plain words for Connect's tile 3 state line and the line under the header
// on every other page, one bar, and the failure paths that keep their words:
// an expired session pauses with Sign in again; a slow sign-in service says
// so. The scan's state is the session's (ui/session.ts); the buttons are
// ui/actions.ts. The section list and the diagnostics bundle are developer
// tools, under ?dev=1 only.
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { lowerFirst } from '../../copy/statements.ts'
import { ACCESS } from '../../copy/access.ts'
import { isPrivilegeDenial, rolesForSource } from '../../graph/collect/roles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { downloadScanDiagnostics } from '../diagnosticsDownload.ts'
import { Button, Callout, ProgressBar } from '../components/index.ts'
import { resumeScan } from '../actions.ts'
import { useAction } from '../useAction.ts'
import type { ScanState } from '../session.ts'

const DEV = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'
const CONNECT = app.connect
const SCAN = app.scan
const TOTAL_SECTIONS = Object.keys(SCAN.sections).length

/** A section label mid-sentence: "Conditional Access policies" keeps its capitals, "People" becomes "people". */
const laneWords = (label: string): string => (/^[A-Z][a-z]+ [A-Z]/.test(label) ? label : lowerFirst(label))
const readingLine = (labels: string[]): string => (labels.length === 0 ? CONNECT.finishing : fillText(labels.length > 1 ? CONNECT.readingSections : CONNECT.readingSection, { section: laneWords(labels[0]), n: labels.length - 1 }))

/** The lane in plain words ("Reading people", "Reading sign-in records, 3 pages · 120 records", "Finishing up"), and how far along. */
export function laneOf(scan: Pick<ScanState, 'sections' | 'laneB'>): { lane: string; percent: number | null } {
  const { sections, laneB } = scan
  const list = Object.values(sections).filter((s) => s.source !== 'signInEvidence')
  const finished = list.filter((s) => s.status !== 'started').length
  const total = TOTAL_SECTIONS - 1
  const percent = Math.min(100, Math.round((finished / total) * 100))
  const inProgress = list.filter((s) => s.status === 'started').map((s) => SCAN.sections[s.source] ?? s.source)
  const signIns = sections['signInEvidence']
  const onSignIns = signIns !== undefined && signIns.status === 'started' && inProgress.length === 0
  const lane = onSignIns ? (laneB === null ? CONNECT.waitingSignIns : fillText(CONNECT.readingSignIns, { pages: laneB.pages, rows: laneB.rows })) : readingLine(inProgress)
  return { lane, percent: onSignIns && finished >= total ? null : percent }
}

/** The paused notice with Sign in again (ui/actions.ts resumeScan); a failure to resume renders beside the button. */
export function PausedNotice() {
  const { run, error } = useAction()
  return (
    <Callout kind="warning">
      {CONNECT.paused}{' '}
      <Button variant="primary" onClick={() => run(resumeScan())}>
        {CONNECT.signInAgain}
      </Button>
      {error && <span className="quiet"> {error}</span>}
    </Callout>
  )
}

/** The bar, and the pause and slow notices; the tile carries the one line (the lane · elapsed) and Stop, so the bar has no caption. */
export function ScanBar({ scan }: { scan: ScanState }) {
  const { lane, percent } = laneOf(scan)
  return (
    <>
      <ProgressBar percent={percent} label={lane} />
      {scan.state === 'paused' && <PausedNotice />}
      {scan.state === 'running' && scan.slow && <Callout kind="warning">{CONNECT.slow}</Callout>}
    </>
  )
}

/** Developer tools (?dev=1): the section list with timings, and the diagnostics bundle. The per-scope role map stays here, for diagnostics. */
export function ScanDevTools({ tenantId, scan, snapshot }: { tenantId: string; scan: ScanState; snapshot: TenantSnapshot | null }) {
  if (!DEV) return null
  const rows = Object.values(scan.sections)
  const statusLabel = (status: string, reason?: string | null): string => (isPrivilegeDenial(reason) ? ACCESS.refusedStatus : (SCAN.evidenceStatus[status] ?? status))
  return (
    <div className="devtools">
      <details>
        <summary>{CONNECT.details}</summary>
        <ul className="sections">
          {rows.map((s) => (
            <li key={s.source}>
              {s.status === 'started'
                ? `${SCAN.sections[s.source] ?? s.source}: ${SCAN.reading}`
                : s.rows !== undefined
                  ? fillText(SCAN.found, { label: SCAN.sections[s.source] ?? s.source, n: s.rows.toLocaleString('en') })
                  : `${SCAN.sections[s.source] ?? s.source}: ${statusLabel(s.status, s.reason)}`}
              {s.reason && <span className="muted"> ({s.reason})</span>}
              {isPrivilegeDenial(s.reason) && <div className="reason">{ACCESS.needsRole(rolesForSource(s.source).least)}</div>}
              {s.ms !== undefined && <span className="muted"> · {s.ms} ms</span>}
            </li>
          ))}
          {scan.laneB?.oldest && <li>{fillText(SCAN.signInsBarCovered, { rows: scan.laneB.rows, oldest: absoluteDate(scan.laneB.oldest) })}</li>}
        </ul>
        <Button variant="tertiary" onClick={() => void downloadScanDiagnostics(tenantId, snapshot, rows)}>
          {CONNECT.diagnostics}
        </Button>
      </details>
    </div>
  )
}
