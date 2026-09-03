// Connect (docs/design/connect-mockup.html). Signed out: the opener — what it
// is, who it is built for, what it catches; Sign in; the permissions and how to
// remove them; the IAMAI limitations panel. Signed in: four numbered tiles from
// connectView.ts — Signed in, Baseline, What happens next, and Scan in exactly
// one of its states (complete, finished with gaps, not started for want of a
// role, scanning, or ready for the first scan). Every action is a button in one
// of three weights; Global Reader is the only role IAMAI names.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { authReady, getGraphToken, signIn, signInAnother, signOut } from '../../graph/auth.ts'
import { READ_EVERYTHING_ROLE } from '../../graph/collect/roles.ts'
import type { TokenSource } from '../../graph/collect/runScan.ts'
import { GLOBAL_ADMINISTRATOR, coreRoleGap, rolesInToken } from '../../graph/collect/tokenRoles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineFile } from '../../baseline/index.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { stepIdForGoal } from '../../roadmap/stepIds.ts'
import { roleName } from '../../roles.ts'
import { demoUrl, isDemo } from '../demo.ts'
import { PERMISSIONS, SIGN_IN_SCOPES } from '../../copy/permissions.ts'
import { elapsedLabel } from '../format.ts'
import { Button, LinkButton } from '../components/index.ts'
import { scopeRows } from '../PermissionsDisclosure.tsx'
import { PINNED_BASELINE, baselineChanges, checkAuthorHead, loadPinnedBaseline, loadUploadedBaseline } from '../baseline.ts'
import type { BaselineResult } from '../baseline.ts'
import { PLAN_HREF } from '../shell/AppShell.tsx'
import { afterScanHref } from '../shell/routes.ts'
import { ScanBar, ScanDevTools, laneOf } from '../scan/ScanProgress.tsx'
import { useScanRunner } from '../scan/useScanRunner.ts'
import type { SectionRow } from '../scan/useScanRunner.ts'
import { W, accountTile, baselineTile, nextTile, scanTile } from '../scan/connectView.ts'
import type { Action, BaselineUpdate, ScanInput, Tone } from '../scan/connectView.ts'

const C = app.connect
const HOW_HREF = '#/how'
const PACKAGE_HREF = '#/how#package'

const O = pages.opener as Record<string, unknown>

export function Connect(props: {
  account: AccountInfo | null
  tenantName: string | null
  baseline: BaselineResult | null
  baselineRestoreError: string | null
  onBaseline: (r: BaselineResult) => void
  lastScan: { snapshot: TenantSnapshot; at: string } | null
  frozen: Record<string, SectionRow> | null
  /** A scan that just finished with gaps (the mock only). */
  finished: TenantSnapshot | null
  /** The mock's token stand-in; MSAL otherwise. */
  getToken?: TokenSource
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

/** One numbered tile; the badge carries the state colour (accent done, amber gaps, red no role). */
function Tile({ n, title, state, tone, stateTone, children }: { n: number; title: string; state?: string; tone: Tone; stateTone?: 'ok' | 'wait' | 'stop'; children: ReactNode }) {
  return (
    <section className={`step-tile${tone ? ` ${tone}` : ''}`}>
      <span className="n">{n}</span>
      <h2>
        {title}
        {state && (
          <>
            {' '}
            <span className={`state${stateTone ? ` ${stateTone}` : ''}`}>{state}</span>
          </>
        )}
      </h2>
      {children}
    </section>
  )
}

/** An action in one of the three weights, as the mockup assigns them. */
function Act({ action, onClick, href }: { action: Action; onClick?: () => void; href?: string }) {
  if (href) {
    return (
      <LinkButton href={href} variant={action.weight}>
        {action.label}
      </LinkButton>
    )
  }
  return (
    <Button variant={action.weight} onClick={onClick}>
      {action.label}
    </Button>
  )
}

/** The one role IAMAI names, set in the row's weight. */
function roleSpan(text: string): ReactNode {
  const i = text.indexOf(READ_EVERYTHING_ROLE)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <span className="role">{READ_EVERYTHING_ROLE}</span>
      {text.slice(i + READ_EVERYTHING_ROLE.length)}
    </>
  )
}

/** The account's leading text in the tile's weight, the rest of the line after it. */
function lead(upn: string, line: string): ReactNode {
  return line.startsWith(upn) ? (
    <>
      <strong>{upn}</strong>
      {line.slice(upn.length)}
    </>
  ) : (
    line
  )
}

/** The account's directory role for tile 1: Global Administrator or Global Reader first, else the first the catalogue knows. */
function accountRole(roleIds: string[] | null): string | null {
  if (!roleIds) return null
  const names = roleIds.map((id) => roleName(id)).filter((n): n is string => n !== null)
  return names.find((n) => n === GLOBAL_ADMINISTRATOR) ?? names.find((n) => n === READ_EVERYTHING_ROLE) ?? names[0] ?? null
}

function SignedIn({
  account,
  tenantName,
  baseline,
  baselineRestoreError,
  onBaseline,
  lastScan,
  frozen,
  finished,
  getToken,
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
  finished: TenantSnapshot | null
  getToken?: TokenSource
  onRunningChange: (running: boolean) => void
  onComplete: (snapshot: TenantSnapshot, at: string) => void
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
    finished,
    getToken,
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
  // The token's roles, read before the first Graph call (tokenRoles.ts): tile 1
  // names the account's role, and tile 4 says so when none of them reads the
  // tenant. The demo never signs in, so it has no token to read.
  const [roleIds, setRoleIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (isDemo()) return
    let live = true
    const source: TokenSource = getToken ?? getGraphToken
    void source('silent')
      .then((token) => {
        if (live) setRoleIds(rolesInToken(token))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [getToken, account.homeAccountId])
  const roleGap = runner.roleGap ?? coreRoleGap(roleIds)
  const tenant = tenantName ?? account.username
  const upn = account.username
  const start = (first: boolean): void => {
    if (first) hadScanRef.current = false
    void runner.start()
  }

  const t1 = accountTile({ tenant, upn, role: accountRole(roleIds) })
  const t3 = nextTile({ tenant })
  // Tile 4's one state, in priority: no role, scanning, gaps, complete, ready.
  const scanInput: ScanInput = roleGap
    ? { kind: 'role', upn, gap: roleGap }
    : scanning
      ? { kind: 'scanning', lane: laneOf(runner).lane, elapsed: elapsedLabel(runner.startedAt ?? runner.nowTick, runner.nowTick) }
      : runner.gaps.length > 0
        ? { kind: 'gaps', unread: runner.unread, lastScan }
        : lastScan
          ? { kind: 'complete', snapshot: lastScan.snapshot, at: lastScan.at }
          : { kind: 'ready' }
  const t4 = scanTile(scanInput)
  const stateTone = t4.tone === 'done' ? 'ok' : (t4.tone ?? undefined)
  const scanActions = (): ReactNode => {
    switch (t4.kind) {
      case 'complete':
        return (
          <>
            <Act action={t4.actions[0]} href={PLAN_HREF} />
            <Act action={t4.actions[1]} onClick={() => start(false)} />
          </>
        )
      case 'gaps':
        return (
          <>
            <Act action={t4.actions[0]} onClick={() => void signInAnother()} />
            <Act action={t4.actions[1]} onClick={() => start(false)} />
            {t4.actions[2] && <Act action={t4.actions[2]} href={PLAN_HREF} />}
          </>
        )
      case 'role':
        return <Act action={t4.actions[0]} onClick={() => void signInAnother()} />
      case 'scanning':
        return <Act action={t4.actions[0]} onClick={runner.stop} />
      case 'ready':
        return <Act action={t4.actions[0]} onClick={() => start(true)} />
    }
  }
  return (
    <>
      <h1>{W.h1}</h1>
      <Tile n={1} title={t1.title} state={t1.state} tone={t1.tone} stateTone="ok">
        <p>{lead(upn, t1.line)}</p>
        <p className="quiet">{t1.note}</p>
        <div className="actions">
          <Act action={t1.actions[0]} onClick={() => void signInAnother()} />
          <Act action={t1.actions[1]} onClick={() => void signOut()} />
        </div>
      </Tile>
      <BaselineTile baseline={baseline} restoreError={baselineRestoreError} onBaseline={onBaseline} locked={scanning} />
      <Tile n={3} title={t3.title} tone={t3.tone}>
        <ul className="beats">
          {t3.beats.map((b) => (
            <li key={b.label}>
              <b>{b.label}</b> {b.text}
            </li>
          ))}
        </ul>
        <p className="quiet">{t3.readOnly}</p>
        <details>
          <summary>{t3.limits.summary}</summary>
          <ul className="beats">
            {t3.limits.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="quiet">
            {t3.limits.more}{' '}
            <a className="lnk" href={t3.limits.link.href}>
              {t3.limits.link.label}
            </a>
          </p>
        </details>
      </Tile>
      <Tile n={4} title={t4.title} state={t4.state} tone={t4.tone} stateTone={stateTone}>
        {t4.kind === 'scanning' && <ScanBar runner={runner} />}
        {t4.lead && <p>{lead(upn, t4.lead)}</p>}
        {t4.facts && (
          <ul className="facts">
            {t4.facts.map((f) => (
              <li key={f.label}>
                <b>{f.value}</b>
                {f.label}
              </li>
            ))}
          </ul>
        )}
        {t4.rows && (
          <ul className="tile-rows">
            {t4.rows.map((r) => (
              <li key={r.name}>
                <span>{r.name}</span> <span>{roleSpan(r.value)}</span>
              </li>
            ))}
          </ul>
        )}
        {t4.ask && (
          <p className="quiet">
            {roleSpan(t4.ask)}{' '}
            {t4.learn && (
              <a className="lnk" href={t4.learn.url} target="_blank" rel="noopener noreferrer">
                {t4.learn.label}
              </a>
            )}
          </p>
        )}
        {t4.note && <p className="quiet">{t4.note}</p>}
        {!scanning && runner.state === 'failed' && runner.error && <p className="quiet">{fillText(C.failed, { why: runner.error })}</p>}
        <div className="actions">{scanActions()}</div>
      </Tile>
      <ScanDevTools tenantId={account.tenantId} runner={runner} snapshot={lastScan?.snapshot ?? null} />
    </>
  )
}

/**
 * The author's head against the pin (prompt 52 Part 1): when it differs and the
 * changed-policy list is known, tile 2 carries the update as a collapsible. The
 * one runtime network call and its compare both fail closed, so the line never
 * appears without real changes behind it.
 */
function useAuthorUpdate(): BaselineUpdate | null {
  const [update, setUpdate] = useState<BaselineUpdate | null>(null)
  useEffect(() => {
    let live = true
    void checkAuthorHead().then(async (head) => {
      if (!live || !head.updated || !head.head || !head.date) return
      const changes = await baselineChanges(head.head)
      if (!live || changes.length === 0) return
      setUpdate({ date: head.date, changes })
    })
    return () => {
      live = false
    }
  }, [])
  return update
}

/**
 * Tile 2: the baseline's name and count as its state, the approved sentences,
 * the author-update rows (added / removed / changed · policy · the step that
 * changes), and Change baseline, which opens the picker with two choices. The
 * default loads itself when nothing is saved.
 */
function BaselineTile({ baseline, restoreError, onBaseline, locked }: { baseline: BaselineResult | null; restoreError: string | null; onBaseline: (r: BaselineResult) => void; locked: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const update = useAuthorUpdate()

  const loadPinned = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setBusy(PINNED_BASELINE.label)
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
    setBusy(C.uploadedSource)
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

  // The step a changed policy stands for, through the baseline's goal map.
  const stepFor = (policy: string): string | null => {
    const map = baseline?.goalMap ?? {}
    const goalId = Object.keys(map).find((g) => map[g].includes(policy))
    return goalId ? (contentStepFor({ id: stepIdForGoal(goalId), goalId })?.title ?? null) : null
  }
  const t2 = baselineTile({ name: baseline?.source ?? null, policyCount: baseline?.pkg.policies.length ?? 0, loading: busy, update, stepFor })
  return (
    <Tile n={2} title={t2.title} state={t2.state} tone={t2.tone}>
      {t2.paragraphs.map((text) => (
        <p key={text}>{text}</p>
      ))}
      {error && <p className="quiet">{fillText(C.baselineFailed, { why: error })}</p>}
      {!error && !baseline && restoreError && <p className="quiet">{C.restoreFailed}</p>}
      {t2.update && (
        <details>
          <summary>{t2.update.summary}</summary>
          <ul className="diff">
            {t2.update.rows.map((r, i) => (
              <li key={`${i}-${r.policy}`}>
                <span className="tag">{r.tag}</span>
                <span>{r.policy}</span>
                <span className="steps">{r.step}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!busy && (
        <div className="actions">
          {/* Held while a scan runs: the baseline it reads against must not change under it. */}
          <Button variant="secondary" aria-expanded={open} disabled={locked} onClick={() => setOpen((o) => !o)}>
            {t2.actions[0].label}
          </Button>
        </div>
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
          <LinkButton href={PACKAGE_HREF} variant="tertiary">
            {W.baseline.howToMakeOne}
          </LinkButton>
        </div>
      )}
    </Tile>
  )
}
