// What a running scan shows (prompt 47 Part 4, target-state §3): one progress
// bar with the current lane in plain words, and Stop. The failure paths keep
// their words: an expired session pauses with Sign in again; a slow sign-in
// service says so. The section list and the diagnostics bundle are developer
// tools, under ?dev=1 only.
import { CONNECT } from '../../copy/connect.ts'
import { SCAN } from '../../copy/pages.ts'
import { ACCESS } from '../../copy/access.ts'
import { isPrivilegeDenial, rolesForSource } from '../../graph/collect/roles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { elapsedLabel } from '../format.ts'
import { downloadScanDiagnostics } from '../diagnosticsDownload.ts'
import { Button, Callout, ProgressBar } from '../components/index.ts'
import type { ScanRunner } from './useScanRunner.ts'

const DEV = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'
const TOTAL_SECTIONS = Object.keys(SCAN.sections).length

export function ScanProgress({ runner }: { runner: ScanRunner }) {
  const { sections, laneB, startedAt, nowTick } = runner
  const list = Object.values(sections).filter((s) => s.source !== 'signInEvidence')
  const finished = list.filter((s) => s.status !== 'started').length
  const total = TOTAL_SECTIONS - 1
  const percent = Math.min(100, Math.round((finished / total) * 100))
  const inProgress = list.filter((s) => s.status === 'started').map((s) => SCAN.sections[s.source] ?? s.source)
  const signIns = sections['signInEvidence']
  const lane =
    signIns && signIns.status === 'started' && inProgress.length === 0
      ? laneB === null
        ? CONNECT.waitingSignIns
        : CONNECT.readingSignIns(laneB.pages, laneB.rows)
      : CONNECT.reading(inProgress)
  const elapsed = startedAt !== null ? elapsedLabel(startedAt, nowTick) : null
  return (
    <>
      <ProgressBar percent={signIns && signIns.status === 'started' && finished >= total ? null : percent} caption={lane} />
      <p className="reason">
        {lane}
        {elapsed && ` · ${CONNECT.elapsed(elapsed)}`}
      </p>
      {runner.state === 'paused' && (
        <Callout kind="warning">
          {CONNECT.paused}{' '}
          <Button variant="primary" onClick={runner.signInAgain}>
            {CONNECT.signInAgain}
          </Button>
        </Callout>
      )}
      {runner.state === 'running' && runner.slow && <Callout kind="warning">{CONNECT.slow}</Callout>}
      <p className="actions">
        <Button variant="secondary" onClick={runner.stop}>
          {CONNECT.stop}
        </Button>
      </p>
    </>
  )
}

/** Graph refused some sections for the signed-in account: name the role to ask for (pre-share-blockers). */
export function DeniedSections({ denied, all }: { denied: string[]; all: boolean }) {
  if (denied.length === 0) return null
  return (
    <Callout kind="warning" title={ACCESS.deniedTitle}>
      <p>{all ? ACCESS.deniedAll : ACCESS.denied(denied.length)}</p>
      <p>{ACCESS.askFor}</p>
      <ul className="sections">
        {denied.map((source) => (
          <li key={source}>
            <em>{SCAN.sections[source] ?? source}</em>: {ACCESS.roleFor(rolesForSource(source).least)}
          </li>
        ))}
      </ul>
      <p>
        {ACCESS.partial}{' '}
        <a href={ACCESS.learnUrl} target="_blank" rel="noopener noreferrer">
          {ACCESS.learnLabel}
        </a>
      </p>
    </Callout>
  )
}

/** Developer tools (?dev=1): the section list with timings, and the diagnostics bundle. */
export function ScanDevTools({ tenantId, runner, snapshot }: { tenantId: string; runner: ScanRunner; snapshot: TenantSnapshot | null }) {
  if (!DEV) return null
  const rows = Object.values(runner.sections)
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
                  ? SCAN.found(SCAN.sections[s.source] ?? s.source, s.rows)
                  : `${SCAN.sections[s.source] ?? s.source}: ${statusLabel(s.status, s.reason)}`}
              {s.reason && <span className="muted"> ({s.reason})</span>}
              {isPrivilegeDenial(s.reason) && <div className="reason">{ACCESS.needsRole(rolesForSource(s.source).least)}</div>}
              {s.ms !== undefined && <span className="muted"> · {s.ms} ms</span>}
            </li>
          ))}
          {runner.laneB?.oldest && <li>{SCAN.signInsBar(runner.laneB.rows, absoluteDate(runner.laneB.oldest))}</li>}
        </ul>
        <Button variant="tertiary" onClick={() => void downloadScanDiagnostics(tenantId, snapshot, rows)}>
          {CONNECT.diagnostics}
        </Button>
      </details>
    </div>
  )
}
