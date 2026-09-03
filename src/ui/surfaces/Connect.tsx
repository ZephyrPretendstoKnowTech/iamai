// Connect (prompt 47 Part 4, target-state §3): one component, four states, now
// rendered from docs/design/content.json (prompt 52 Part 1). Signed out: the
// opener — what it is, who it is built for, what it catches; Sign in; the
// permissions and how to remove them; the IAMAI limitations panel. Signed in:
// who is signed in, the baseline explained in place with the author's site and
// the "updated by its author" line, and the scan, run from here. Scanning: the
// progress line and Stop. Scanned: the tenant's name, the one-line result, Open
// the plan, the tip, and Scan tenant again, run in place.
import { useEffect, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { authReady, signIn, signOut } from '../../graph/auth.ts'
import { isPrivilegeDenial } from '../../graph/collect/roles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineFile } from '../../baseline/index.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { demoUrl } from '../demo.ts'
import { PERMISSIONS, SIGN_IN_SCOPES } from '../../copy/permissions.ts'
import { absoluteDate, monthDay } from '../../copy/dates.ts'
import { Button, Callout, LinkButton } from '../components/index.ts'
import { scopeRows } from '../PermissionsDisclosure.tsx'
const C = app.connect
import { PINNED_BASELINE, baselineChanges, checkAuthorHead, loadPinnedBaseline, loadUploadedBaseline } from '../baseline.ts'
import type { BaselineChange, BaselineResult } from '../baseline.ts'
import { PLAN_HREF } from '../shell/AppShell.tsx'
import { afterScanHref } from '../shell/routes.ts'
import { DeniedSections, ScanDevTools, ScanProgress } from '../scan/ScanProgress.tsx'
import { deniedSources, useScanRunner } from '../scan/useScanRunner.ts'
import type { SectionRow } from '../scan/useScanRunner.ts'

const HOW_HREF = '#/how'
const PACKAGE_HREF = '#/how#package'

const O = pages.opener as Record<string, unknown>
const CN = pages.connectNoScan as Record<string, unknown>
const TN = pages.tenant as Record<string, unknown>

/** Split a filled line on its last " · ", so a trailing control word (Sign out, change) becomes a button. */
function splitControl(line: string): [string, string] {
  const parts = line.split(' · ')
  const label = parts.pop() ?? ''
  return [parts.join(' · '), label]
}

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
  /** Where the scan lands when it finishes: the step that asked for it, or the Plan. */
  returnTo: string | null
  autoScan: boolean
  onAutoScanConsumed: () => void
}) {
  const { account } = props
  return <section className="surface connect">{account ? <SignedIn {...props} account={account} /> : <SignedOut />}</section>
}

function SignedOut() {
  // The redirect takes seconds to start; the button must not look inert.
  const [opening, setOpening] = useState(false)
  // MSAL is warming: until it is ready the button carries a spinner but stays
  // clickable; a click made now is queued and fires the moment it is ready, so
  // the first click always lands (prompt 50.1 item 7).
  const [signInReady, setSignInReady] = useState(false)
  const firing = useRef(false)
  useEffect(() => {
    let live = true
    void authReady().then(() => {
      if (live) setSignInReady(true)
    })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (signInReady && opening && !firing.current) {
      firing.current = true
      void signIn().catch(() => {
        firing.current = false
        setOpening(false)
      })
    }
  }, [signInReady, opening])
  // The body mounts once the disclosure is opened: closed, a <details> still
  // lays its children out, and the closed page must measure as what it shows.
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const rows = scopeRows().filter((r) => !SIGN_IN_SCOPES.includes(r.scope) && r.usedBy.length > 0)
  return (
    <>
      <h1>{O.h1 as string}</h1>
      <p className="lede">{O.intro as string}</p>
      <h2>{O.builtForLabel as string}</h2>
      <p>{O.builtFor as string}</p>
      <h2>{O.catchesLabel as string}</h2>
      <ul>
        {(O.catches as string[]).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="actions">
        <Button
          variant="primary"
          loading={opening}
          busy={!signInReady}
          onClick={() => {
            setOpening(true)
          }}
        >
          {O.signIn as string}
        </Button>
      </p>
      <details className="permissions" onToggle={(e) => setPermissionsOpen(e.currentTarget.open)}>
        <summary>{O.permissionsSummary as string}</summary>
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
            <p>{O.permissionsNote as string}</p>
            <h3>{O.removingLabel as string}</h3>
            <ol>
              {(O.removing as string[]).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </>
        )}
      </details>
      <p className="footer-link">
        <a href={HOW_HREF}>{(O.links as string[])[0]}</a>
      </p>
      <p className="footer-link">
        <a href={demoUrl()}>{(O.links as string[])[1]}</a>
      </p>
      {/* The blind spots the tenant's records cannot show (target-state §3): a
          raised disclosure, closed by default. Its body is caveat prose, not the
          page's flow, so it renders outside the inventory's prose blocks — the
          same way the permissions caveats sit outside the budget by being
          closed. The summary is captured; the copy is one file (content.json). */}
      <details className="limits">
        <summary>{O.cantCatchSummary as string}</summary>
        <div className="limits-intro">{O.cantCatchIntro as string}</div>
        <div className="limits-list">
          {(O.cantCatch as string[]).map((line) => (
            <div className="limit" key={line}>
              {line}
            </div>
          ))}
        </div>
      </details>
      <p className="tip">{O.tip as string}</p>
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
  returnTo,
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
  /** Where the scan lands when it finishes: the step that asked for it, or the Plan. */
  returnTo: string | null
  autoScan: boolean
  onAutoScanConsumed: () => void
}) {
  // A re-scan returns to the plan when it finishes (target-state §2); a first
  // scan stays here and offers it.
  const hadScanRef = useRef(lastScan !== null)
  const returnToRef = useRef(returnTo)
  returnToRef.current = returnTo
  const runner = useScanRunner(account.tenantId, {
    frozen,
    onRunningChange,
    onComplete: (snapshot, at) => {
      onComplete(snapshot, at)
      if (hadScanRef.current) window.location.hash = afterScanHref(returnToRef.current)
    },
  })
  const scanning = runner.state === 'running' || runner.state === 'paused'
  useEffect(() => {
    if (!autoScan || scanning) return
    onAutoScanConsumed()
    hadScanRef.current = lastScan !== null
    void runner.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan])
  const snapshot = lastScan?.snapshot ?? null
  const scanned = !scanning && snapshot !== null
  const { denied, all } = deniedSources(runner.sections, snapshot, isPrivilegeDenial)
  const window_ = snapshot?.sources.signInEvidence?.coveredWindow ?? null
  const [signedInText, signOutLabel] = splitControl(fillText(CN.signedIn as string, { tenant: tenantName ?? account.username, upn: account.username }))
  return (
    <>
      <h1>{scanned ? fillText(TN.h1 as string, { tenant: tenantName ?? account.username }) : (CN.h1 as string)}</h1>
      <p className="line">
        {signedInText}
        {!scanning && (
          <>
            {' · '}
            <Button variant="tertiary" onClick={() => void signOut()}>
              {signOutLabel}
            </Button>
          </>
        )}
      </p>
      <BaselineLine baseline={baseline} restoreError={baselineRestoreError} onBaseline={onBaseline} locked={scanning} tenant={tenantName ?? account.username} />
      {scanning && <ScanProgress runner={runner} />}
      {!scanning && runner.state === 'failed' && runner.error && <Callout kind="danger">{fillText(C.failed, { why: runner.error })}</Callout>}
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
              {CN.scanButton as string}
            </Button>
          </p>
          <p className="reason">{CN.scanNote as string}</p>
        </>
      )}
      {scanned && snapshot && (
        <>
          <p className="line">
            {fillText(TN.scanLine as string, {
              people: snapshot.users.length,
              policies: snapshot.config.caPolicies?.rows.length ?? 0,
              from: window_ ? monthDay(window_.from) : '',
              to: window_ ? monthDay(window_.to) : '',
            })}
          </p>
          <DeniedSections denied={denied} all={all} />
          <p className="actions">
            <LinkButton href={PLAN_HREF}>{TN.open as string}</LinkButton>
            <Button variant="secondary" onClick={() => void runner.start()}>
              {CN.scanButton as string}
            </Button>
          </p>
          <p className="tip">{TN.tip as string}</p>
        </>
      )}
      <ScanDevTools tenantId={account.tenantId} runner={runner} snapshot={snapshot} />
      {!scanning && (
        <p className="footer-link">
          <a href={HOW_HREF}>{(O.links as string[])[0]}</a>
        </p>
      )}
    </>
  )
}

/**
 * "Baseline: <label> (46 policies) · change", the three explanation lines (what
 * the baseline is, its aim, how IAMAI uses it), and —
 * when the author's repository is ahead of the pin — the "updated by its author"
 * line with its review list (prompt 52 Part 1). The default loads itself when
 * nothing is saved; change opens a picker with two choices.
 */
function BaselineLine({
  baseline,
  restoreError,
  onBaseline,
  locked,
  tenant,
}: {
  baseline: BaselineResult | null
  restoreError: string | null
  onBaseline: (r: BaselineResult) => void
  locked: boolean
  /** The tenant's name, for the line that says what the baseline is compared with. */
  tenant: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const loadPinned = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setBusy(fillText(C.baselineLoading, { source: PINNED_BASELINE.label }))
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
    setBusy(fillText(C.readingFiles, { n: fileList.length }))
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

  const [baselineText, changeLabel] = baseline ? splitControl(fillText(CN.baselineLine as string, { baselineName: baseline.source, policyCount: baseline.pkg.policies.length })) : ['', 'change']

  return (
    <>
      <p className="line">
        {busy ?? (baseline ? baselineText : C.baselineNone)}
        {!locked && !busy && (
          <>
            {' · '}
            <Button variant="tertiary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {changeLabel}
            </Button>
          </>
        )}
      </p>
      {error && <p className="reason">{fillText(C.baselineFailed, { why: error })}</p>}
      {!error && !baseline && restoreError && <p className="reason">{C.restoreFailed}</p>}
      {!locked && !busy && baseline && (
        <>
          <p className="reason">{CN.baselineWhat as string}</p>
          <p className="reason">{CN.baselineGoal as string}</p>
          <p className="reason">{fillText(CN.baselineHow as string, { tenant })}</p>
          <BaselineUpdated />
        </>
      )}
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

/**
 * The "Baseline updated by its author" line and its review list, shown only when
 * the author's head differs from the pin and the changed-policy list is known
 * (prompt 52 Part 1). The one runtime network call and its compare both fail
 * closed, so the line never appears without real changes behind it.
 */
function BaselineUpdated() {
  const [date, setDate] = useState<string | null>(null)
  const [changes, setChanges] = useState<BaselineChange[]>([])
  const [reviewing, setReviewing] = useState(false)
  useEffect(() => {
    let live = true
    void checkAuthorHead().then(async (head) => {
      if (!live || !head.updated || !head.head) return
      const list = await baselineChanges(head.head)
      if (!live || list.length === 0) return
      setChanges(list)
      setDate(head.date ? absoluteDate(head.date) : null)
    })
    return () => {
      live = false
    }
  }, [])
  if (changes.length === 0 || !date) return null
  const [updatedText, reviewLabel] = splitControl(fillText(CN.baselineUpdated as string, { date, n: changes.length }))
  return (
    <>
      <p className="reason">
        {updatedText}
        {' · '}
        <Button variant="tertiary" aria-expanded={reviewing} onClick={() => setReviewing((r) => !r)}>
          {reviewLabel}
        </Button>
      </p>
      <p className="sub">{CN.baselineUpdatedNote as string}</p>
      {reviewing && (
        <div className="found">
          {changes.map((c) => (
            <div className="frow" key={c.policy}>
              {fillText(CN.baselineUpdatedRow as string, { policy: c.policy, change: c.change })}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
