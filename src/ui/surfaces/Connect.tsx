// Connect (prompt 47 Part 4, target-state §3): one component, four states.
// Signed out: what is needed, what is read, what never happens; Sign in; the
// permissions and how to remove them. Signed in: who is signed in, the
// baseline line with its picker, and the scan, run from here. Scanning: the
// progress line and Stop. Scanned: the one-line result and Open the plan.
import { useEffect, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { signIn, signOut } from '../../graph/msal.ts'
import { isPrivilegeDenial } from '../../graph/collect/roles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineFile } from '../../baseline/index.ts'
import { CONNECT as C } from '../../copy/connect.ts'
import { PERMISSIONS, SIGN_IN_SCOPES } from '../../copy/permissions.ts'
import { monthDayRange } from '../../copy/dates.ts'
import { Button, Callout, LinkButton } from '../components/index.ts'
import { scopeRows } from '../PermissionsDisclosure.tsx'
import { PINNED_BASELINE, loadPinnedBaseline, loadUploadedBaseline } from '../baseline.ts'
import type { BaselineResult } from '../baseline.ts'
import { PLAN_HREF } from '../shell/AppShell.tsx'
import { DeniedSections, ScanDevTools, ScanProgress } from '../scan/ScanProgress.tsx'
import { deniedSources, useScanRunner } from '../scan/useScanRunner.ts'
import type { SectionRow } from '../scan/useScanRunner.ts'

/** Until prompt 49 lands How IAMAI works, the footer link opens the reads page and the package section keeps its own page. */
const HOW_HREF = '#/reads'
const PACKAGE_HREF = '#/package'

export function Connect(props: {
  account: AccountInfo | null
  tenantName: string | null
  baseline: BaselineResult | null
  baselineRestoreError: string | null
  onBaseline: (r: BaselineResult) => void
  lastScan: { snapshot: TenantSnapshot; at: string } | null
  frozen: Record<string, SectionRow> | null
  onRunningChange: (running: boolean) => void
  onComplete: (snapshot: TenantSnapshot, at: string) => void
  /** The header's Re-scan asked for a scan as soon as this page mounts. */
  autoScan: boolean
  onAutoScanConsumed: () => void
}) {
  const { account } = props
  return (
    <section className="surface connect">
      <h1>{C.title}</h1>
      {account ? <SignedIn {...props} account={account} /> : <SignedOut />}
    </section>
  )
}

function SignedOut() {
  // The redirect takes seconds to start; the button must not look inert.
  const [opening, setOpening] = useState(false)
  // The body mounts once the disclosure is opened: closed, a <details> still
  // lays its children out, and the closed page must measure as what it shows.
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const rows = scopeRows().filter((r) => !SIGN_IN_SCOPES.includes(r.scope) && r.usedBy.length > 0)
  return (
    <>
      <p className="lede">{C.lede}</p>
      <ul>
        {C.need.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="actions">
        <Button
          variant="primary"
          loading={opening}
          onClick={() => {
            setOpening(true)
            void signIn().catch(() => setOpening(false))
          }}
        >
          {C.signIn}
        </Button>
      </p>
      <details className="permissions" onToggle={(e) => setPermissionsOpen(e.currentTarget.open)}>
        <summary>{C.permissionsSummary}</summary>
        {permissionsOpen && (
          <>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{PERMISSIONS.columns.permission}</th>
                <th>{PERMISSIONS.columns.reads}</th>
                <th>{PERMISSIONS.columns.without}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.scope}>
                  <td>
                    <code>{r.scope}</code>
                  </td>
                  <td>{r.reads}</td>
                  <td>{r.without}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{C.signInScopes}</p>
        <h3>{C.removalTitle}</h3>
        <ol>
          {PERMISSIONS.removal.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
          </>
        )}
      </details>
      <p className="footer-link">
        <a href={HOW_HREF}>{C.how}</a>
      </p>
    </>
  )
}

function SignedIn({
  account,
  tenantName,
  baseline,
  baselineRestoreError,
  onBaseline,
  lastScan,
  frozen,
  onRunningChange,
  onComplete,
  autoScan,
  onAutoScanConsumed,
}: {
  account: AccountInfo
  tenantName: string | null
  baseline: BaselineResult | null
  baselineRestoreError: string | null
  onBaseline: (r: BaselineResult) => void
  lastScan: { snapshot: TenantSnapshot; at: string } | null
  frozen: Record<string, SectionRow> | null
  onRunningChange: (running: boolean) => void
  onComplete: (snapshot: TenantSnapshot, at: string) => void
  autoScan: boolean
  onAutoScanConsumed: () => void
}) {
  // A re-scan returns to the plan when it finishes (target-state §2); a first
  // scan stays here and offers it.
  const hadScanRef = useRef(lastScan !== null)
  const runner = useScanRunner(account.tenantId, {
    frozen,
    onRunningChange,
    onComplete: (snapshot, at) => {
      onComplete(snapshot, at)
      if (hadScanRef.current) window.location.hash = PLAN_HREF
    },
  })
  const scanning = runner.state === 'running' || runner.state === 'paused'
  useEffect(() => {
    if (!autoScan || scanning) return
    onAutoScanConsumed()
    hadScanRef.current = lastScan !== null
    void runner.start()
    // Runs once per request from the header; the runner's own guard stops a second start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan])
  const snapshot = lastScan?.snapshot ?? null
  const scanned = !scanning && snapshot !== null
  const { denied, all } = deniedSources(runner.sections, snapshot, isPrivilegeDenial)
  const window_ = snapshot?.sources.signInEvidence?.coveredWindow ?? null
  return (
    <>
      <p className="line">
        {C.signedInTo} <strong>{tenantName ?? account.username}</strong> {C.as} {account.username}
        {!scanning && (
          <>
            {' · '}
            <Button variant="tertiary" onClick={() => void signOut()}>
              {C.signOut}
            </Button>
          </>
        )}
      </p>
      <BaselineLine baseline={baseline} restoreError={baselineRestoreError} onBaseline={onBaseline} locked={scanning} />
      {scanning && <ScanProgress runner={runner} />}
      {!scanning && runner.state === 'failed' && runner.error && <Callout kind="danger">{C.failed(runner.error)}</Callout>}
      {!scanning && !scanned && (
        <>
          <p className="actions">
            <Button
              variant="primary"
              onClick={() => {
                hadScanRef.current = false
                void runner.start()
              }}
            >
              {C.scan}
            </Button>
          </p>
          <p className="reason">{C.scanNote}</p>
        </>
      )}
      {scanned && snapshot && (
        <>
          <p className="line">
            {C.complete(snapshot.users.length, snapshot.config.caPolicies?.rows.length ?? 0, window_ ? monthDayRange(window_.from, window_.to) : null)}
          </p>
          <DeniedSections denied={denied} all={all} />
          <p className="actions">
            <LinkButton href={PLAN_HREF}>{C.openPlan}</LinkButton>
          </p>
        </>
      )}
      <ScanDevTools tenantId={account.tenantId} runner={runner} snapshot={snapshot} />
      {!scanning && (
        <p className="footer-link">
          <a href={HOW_HREF}>{C.how}</a>
        </p>
      )}
    </>
  )
}

/**
 * "Baseline: <the label> (46 policies) · change". The default
 * loads itself when nothing is saved; change opens a picker with two choices.
 */
function BaselineLine({
  baseline,
  restoreError,
  onBaseline,
  locked,
}: {
  baseline: BaselineResult | null
  restoreError: string | null
  onBaseline: (r: BaselineResult) => void
  locked: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const loadPinned = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setBusy(C.baselineLoading(PINNED_BASELINE.label))
    setError(null)
    try {
      onBaseline(await loadPinnedBaseline())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      loadingRef.current = false
      setBusy(null)
    }
  }
  const loadUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setBusy(C.readingFiles(fileList.length))
    setError(null)
    try {
      const files: BaselineFile[] = await Promise.all([...fileList].map(async (f) => ({ path: f.name, text: await f.text() })))
      onBaseline(loadUploadedBaseline(files))
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  // Nothing saved, nothing failed: the default loads itself.
  useEffect(() => {
    if (baseline || restoreError || busy || error) return
    void loadPinned()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline, restoreError])

  return (
    <>
      <p className="line">
        {busy ?? (baseline ? C.baseline(baseline.source, baseline.pkg.policies.length) : C.baselineNone)}
        {!locked && !busy && (
          <>
            {' · '}
            <Button variant="tertiary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {C.change}
            </Button>
          </>
        )}
      </p>
      {error && <p className="reason">{C.baselineFailed(error)}</p>}
      {!error && !baseline && restoreError && <p className="reason">{C.restoreFailed}</p>}
      {open && !locked && (
        <div className="picker" role="group" aria-label={C.pickerLabel}>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false)
              void loadPinned()
            }}
          >
            {PINNED_BASELINE.label}
          </Button>
          <label>
            <span>{C.uploadChoice}</span>
            <input type="file" accept=".json" multiple aria-label={C.uploadLabel} onChange={(e) => void loadUpload(e.currentTarget.files)} disabled={busy !== null} />
          </label>
          <a href={PACKAGE_HREF}>{C.howToMakeOne}</a>
        </div>
      )}
    </>
  )
}
