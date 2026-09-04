// Connect (docs/design/connect-mockup.html): one heading above four numbered
// tiles in both states, drawn from connectView.ts. Signed out: Sign in (with
// the consent rows and, after a sign-in that did not succeed, one of three
// error states from the MSAL error code), Baseline, Scan (what it reads,
// compares and writes; after sign-in) and Plan with what the sample tenant
// produced. Signed in: Signed in, Baseline, Scan (the limitations, then the scan
// in exactly one of its states: complete, finished with gaps, not started for
// want of a role, scanning, or ready for the first scan) and Plan (ready with
// the facts, the last full plan after a scan with gaps, or waiting for the
// scan). The tenant's name and the scan's age render here and nowhere else,
// from the one stored scan timestamp. Every action is a button in one of three
// weights; Global Reader is the only role IAMAI names.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { authReady, getGraphToken, signIn, signInAnother, signOut } from '../../graph/auth.ts'
import type { SignInError } from '../../graph/authError.ts'
import { READ_EVERYTHING_ROLE } from '../../graph/collect/roles.ts'
import type { TokenSource } from '../../graph/collect/runScan.ts'
import { GLOBAL_ADMINISTRATOR, coreRoleGap, rolesInToken } from '../../graph/collect/tokenRoles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineFile } from '../../baseline/index.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { policyLabel, stepsChangedBy } from '../../derive/baselineDiff.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import type { ScanRecord } from '../scan/scanRecord.ts'
import { roleName } from '../../roles.ts'
import { demoUrl, isDemo } from '../demoMode.ts'
// The sample tenant's four facts, computed from the demo fixture through the
// plan engine at build time (vite.config.ts demoFactsModule): the signed-out
// page reads four numbers and never loads the demo chunk.
import SAMPLE_FACTS from 'virtual:demo-facts'
import { elapsedLabel } from '../format.ts'
import { Button, LinkButton } from '../components/index.ts'
import { PINNED_BASELINE, baselineChanges, checkAuthorHead, loadPinnedBaseline, loadUploadedBaseline } from '../baseline.ts'
import type { BaselineResult } from '../baseline.ts'
import { PLAN_HREF } from '../shell/AppShell.tsx'
import { afterScanHref } from '../shell/routes.ts'
import { ScanBar, ScanDevTools, laneOf } from '../scan/ScanProgress.tsx'
import { useScanRunner } from '../scan/useScanRunner.ts'
import type { SectionRow } from '../scan/useScanRunner.ts'
import { W, accountTile, baselineTile, planTile, scanTile, signInTile } from '../scan/connectView.ts'
import type { Action, BaselineUpdate, PlanInput, PlanTile, ScanInput, ScanTile, Tone } from '../scan/connectView.ts'
import { planCounts } from '../../derive/planHeader.ts'
import { operatorIdOf, usePlanData } from './planData.ts'
import { ladder, ladderCounts } from '../../derive/ladder.ts'
import { LadderTiles } from './LadderTiles.tsx'

const EMPTY_MAPPING = { breakGlassUserIds: [] as string[], serviceAccountUserIds: [] as string[] }

const C = app.connect
const PACKAGE_HREF = '#/how#package'

type BaselineProps = {
  baseline: BaselineResult | null
  baselineRestoreError: string | null
  onBaseline: (r: BaselineResult) => void
  /** Test support (dev builds, ?author=1): an author update in place of the network check. */
  authorUpdate?: BaselineUpdate | null
}

export function Connect(
  props: BaselineProps & {
    account: AccountInfo | null
    tenantName: string | null
    /** A sign-in that returned an error, classified (graph/authError.ts); tile 1 shows it. */
    authError: SignInError | null
    lastScan: ScanRecord | null
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
    /** The demo has no worker: its Scan again advances the sample to week two and back (App.tsx demoWeek2). */
    onDemoScan: () => void
  },
) {
  const { account } = props
  return (
    <section className="surface connect">
      <h1>{W.h1}</h1>
      <p className="lede">{W.intro}</p>
      {account ? <SignedIn {...props} account={account} /> : <SignedOut error={props.authError} baseline={props.baseline} baselineRestoreError={props.baselineRestoreError} onBaseline={props.onBaseline} authorUpdate={props.authorUpdate} />}
    </section>
  )
}

/** One numbered tile; the badge carries the state colour (accent done, amber gaps or approval, red no role or a personal account). */
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

/** The state word's colour for a tile's tone. */
const stateToneOf = (tone: Tone): 'ok' | 'wait' | 'stop' | undefined => (tone === 'done' ? 'ok' : (tone ?? undefined))

/** An action in one of the three weights, as the mockup assigns them. */
function Act({ action, onClick, href, loading, busy }: { action: Action; onClick?: () => void; href?: string; loading?: boolean; busy?: boolean }) {
  if (href) {
    return (
      <LinkButton href={href} variant={action.weight}>
        {action.label}
      </LinkButton>
    )
  }
  return (
    <Button variant={action.weight} onClick={onClick} loading={loading} busy={busy}>
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

/** A line's leading name in the tile's weight, the rest after it. */
function lead(name: string | null, line: string): ReactNode {
  return name && line.startsWith(name) ? (
    <>
      <strong>{name}</strong>
      {line.slice(name.length)}
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

/**
 * Tile 3, Scan, in both states: the scan's state in the heading, the
 * limitations collapsible, then the state's own body (the bar while scanning,
 * the account and the unread rows, the one ask for Global Reader) and its
 * buttons.
 */
function ScanTileView({ tile, upn, bar, actions }: { tile: ScanTile; upn: string | null; bar?: ReactNode; actions: ReactNode }) {
  return (
    <Tile n={3} title={tile.title} state={tile.state} tone={tile.tone} stateTone={stateToneOf(tile.tone)}>
      <details>
        <summary>{tile.limits.summary}</summary>
        <ul className="beats">
          {tile.limits.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="quiet">
          {tile.limits.more}{' '}
          <a className="lnk" href={tile.limits.link.href}>
            {tile.limits.link.label}
          </a>
        </p>
      </details>
      {bar}
      {tile.lead && <p>{lead(upn, tile.lead)}</p>}
      {tile.rows && (
        <ul className="tile-rows">
          {tile.rows.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span> <span>{roleSpan(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {tile.ask && (
        <p className="quiet">
          {roleSpan(tile.ask)}{' '}
          {tile.learn && (
            <a className="lnk" href={tile.learn.url} target="_blank" rel="noopener noreferrer">
              {tile.learn.label}
            </a>
          )}
        </p>
      )}
      {tile.note && <p className="quiet">{tile.note}</p>}
      {actions}
    </Tile>
  )
}

/** Tile 4, Plan: the state in the heading, the MFA readiness ladder's header and five tiles when the plan is ready (the sample's facts before sign-in), and the plan's button. */
function PlanTileView({ tile, actions }: { tile: PlanTile; actions: ReactNode }) {
  return (
    <Tile n={4} title={tile.title} state={tile.state} tone={tile.tone} stateTone={stateToneOf(tile.tone)}>
      {tile.lead && <p className="quiet">{tile.lead}</p>}
      {tile.ladder && <LadderTiles counts={tile.ladder} />}
      {tile.facts && (
        <ul className="facts">
          {tile.facts.map((f) => (
            <li key={f.label}>
              <b>{f.value}</b>
              {f.label}
            </li>
          ))}
        </ul>
      )}
      {actions}
    </Tile>
  )
}

/**
 * Before sign-in: the sign-in tile (no tenant connected, or one of three error
 * states from the MSAL error code), the baseline, what happens next for your
 * tenant, and what the sample tenant produced.
 */
function SignedOut({ error, baseline, baselineRestoreError, onBaseline, authorUpdate }: BaselineProps & { error: SignInError | null }) {
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
      // A personal account: the picker, so a work or school account can be chosen.
      const go = error?.kind === 'personal' ? signInAnother : signIn
      void go().catch(() => {
        firing.current = false
        setOpening(false)
      })
    }
  }, [signInReady, opening, error])
  const t1 = signInTile({ error })
  const t3 = scanTile({ kind: 'sample' })
  const t4 = planTile({ kind: 'sample', facts: SAMPLE_FACTS })
  return (
    <>
      <Tile n={1} title={t1.title} state={t1.state} tone={t1.tone} stateTone={stateToneOf(t1.tone)}>
        {t1.lead && <p>{lead(error?.kind === 'personal' ? (error.account ?? null) : null, t1.lead)}</p>}
        {t1.note && <p className="quiet">{t1.note}</p>}
        <div className="actions">
          <Act action={t1.actions[0]} loading={opening} busy={!signInReady} onClick={() => setOpening(true)} />
          <Act action={t1.actions[1]} href={demoUrl()} />
        </div>
        <details className="permissions">
          <summary>{t1.permissions.summary}</summary>
          <p className="quiet">{t1.permissions.lead}</p>
          <ul className="tile-rows">
            {t1.permissions.rows.map((r) => (
              <li key={r.scope}>
                <span>{r.name}</span> <span>{r.reads}</span>
              </li>
            ))}
          </ul>
          <p className="quiet">{t1.permissions.removal}</p>
        </details>
      </Tile>
      <BaselineTile baseline={baseline} restoreError={baselineRestoreError} onBaseline={onBaseline} locked={false} authorUpdate={authorUpdate} />
      <ScanTileView tile={t3} upn={null} actions={null} />
      <PlanTileView
        tile={t4}
        actions={
          <div className="actions">
            <Act action={t4.actions[0]} href={demoUrl()} />
          </div>
        }
      />
    </>
  )
}

function SignedIn({
  account,
  tenantName,
  baseline,
  baselineRestoreError,
  onBaseline,
  authorUpdate,
  lastScan,
  frozen,
  finished,
  getToken,
  onRunningChange,
  onComplete,
  returnTo,
  autoScan,
  onAutoScanConsumed,
  onDemoScan,
}: BaselineProps & {
  account: AccountInfo
  tenantName: string | null
  lastScan: ScanRecord | null
  frozen: Record<string, SectionRow> | null
  finished: TenantSnapshot | null
  getToken?: TokenSource
  onRunningChange: (running: boolean) => void
  onComplete: (snapshot: TenantSnapshot, at: string) => void
  returnTo: string | null
  autoScan: boolean
  onAutoScanConsumed: () => void
  onDemoScan: () => void
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
  // names the account's role, and tile 3 says so when none of them reads the
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
    // The demo has no worker: Scan again flips the sample to week two and back.
    if (isDemo()) {
      onDemoScan()
      return
    }
    if (first) hadScanRef.current = false
    void runner.start()
  }

  const t1 = accountTile({ tenant, upn, role: accountRole(roleIds) })
  // Tile 3's one state, in priority: no role, scanning, gaps, complete, ready.
  const scanInput: ScanInput = roleGap
    ? { kind: 'role', upn, gap: roleGap }
    : scanning
      ? { kind: 'scanning', lane: laneOf(runner).lane, elapsed: elapsedLabel(runner.startedAt ?? runner.nowTick, runner.nowTick) }
      : runner.gaps.length > 0
        ? { kind: 'gaps', unread: runner.unread, lastScan }
        : lastScan
          ? { kind: 'complete', at: lastScan.at }
          : { kind: 'ready' }
  const t3 = scanTile(scanInput)
  // Tile 4 follows: the plan is ready after a complete scan (its step counts
  // the way the Plan header counts them, once the plan has computed; read-only,
  // so opening Connect never creates or touches the plan record), the last
  // full plan stays after a scan with gaps, and otherwise it waits for the scan.
  const planScan = scanInput.kind === 'complete' ? lastScan : null
  const plan = usePlanData(planScan, baseline, operatorIdOf(planScan?.snapshot ?? null, account), true)
  const computed = plan.computed
  // The ladder's five numbers (derive/ladder.ts): the same as Today's and the Plan's, from the one stored scan.
  const planSnapshot = planScan?.snapshot ?? null
  const ladderNumbers = useMemo(() => (planSnapshot ? ladderCounts(ladder(planSnapshot, plan.mapping ?? EMPTY_MAPPING, planSnapshot.asOf)) : null), [planSnapshot, plan.mapping])
  const planInput: PlanInput =
    scanInput.kind === 'complete' && lastScan && ladderNumbers
      ? { kind: 'ready', at: lastScan.at, ladder: ladderNumbers, counts: computed ? (({ steps, inPlace }) => ({ steps, done: inPlace }))(planCounts(computed.steps, computed.schedule.cleanup ?? null)) : null }
      : scanInput.kind === 'gaps' && lastScan
        ? { kind: 'last', at: lastScan.at }
        : { kind: 'waiting' }
  const t4 = planTile(planInput)
  const scanActions = (): ReactNode => {
    switch (t3.kind) {
      case 'complete':
        return <Act action={t3.actions[0]} onClick={() => start(false)} />
      case 'gaps':
        return (
          <>
            <Act action={t3.actions[0]} onClick={() => void signInAnother()} />
            <Act action={t3.actions[1]} onClick={() => start(false)} />
          </>
        )
      case 'role':
        return <Act action={t3.actions[0]} onClick={() => void signInAnother()} />
      case 'scanning':
        return <Act action={t3.actions[0]} onClick={runner.stop} />
      default:
        return <Act action={t3.actions[0]} onClick={() => start(true)} />
    }
  }
  return (
    <>
      <Tile n={1} title={t1.title} state={t1.state} tone={t1.tone} stateTone="ok">
        <p>{lead(upn, t1.line)}</p>
        <p className="quiet">{t1.note}</p>
        <div className="actions">
          <Act action={t1.actions[0]} onClick={() => void signInAnother()} />
          <Act action={t1.actions[1]} onClick={() => void signOut()} />
        </div>
      </Tile>
      <BaselineTile baseline={baseline} restoreError={baselineRestoreError} onBaseline={onBaseline} locked={scanning} authorUpdate={authorUpdate} />
      <ScanTileView
        tile={t3}
        upn={upn}
        bar={t3.kind === 'scanning' ? <ScanBar runner={runner} /> : null}
        actions={
          <>
            {!scanning && runner.state === 'failed' && runner.error && <p className="quiet">{fillText(C.failed, { why: runner.error })}</p>}
            <div className="actions">{scanActions()}</div>
          </>
        }
      />
      <PlanTileView tile={t4} actions={t4.actions.length > 0 ? <div className="actions">{t4.actions.map((a) => <Act key={a.label} action={a} href={PLAN_HREF} />)}</div> : null} />
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
function useAuthorUpdate(mock: BaselineUpdate | null | undefined): BaselineUpdate | null {
  const [update, setUpdate] = useState<BaselineUpdate | null>(null)
  useEffect(() => {
    if (mock) {
      setUpdate(mock)
      return
    }
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
  }, [mock])
  return update
}

/**
 * Tile 2, in both states: the baseline's name and count as its state, the
 * approved sentences, the author-update rows (added / removed / changed ·
 * policy · the step that changes), and Change baseline, which opens the picker
 * with two choices. The default loads itself when nothing is saved.
 */
function BaselineTile({ baseline, restoreError, onBaseline, locked, authorUpdate }: { baseline: BaselineResult | null; restoreError: string | null; onBaseline: (r: BaselineResult) => void; locked: boolean; authorUpdate?: BaselineUpdate | null }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const update = useAuthorUpdate(authorUpdate)

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

  // A changed file names a package policy; the steps it stands behind come
  // through the baseline's goal map (derive/baselineDiff.ts). Absent means the pinned map.
  const policies = baseline?.pkg.policies ?? []
  const goalMap = baseline?.goalMap ?? PINNED_GOAL_MAP
  const labelFor = (file: string): string => policyLabel(file, policies)
  const stepsFor = (file: string): string[] => stepsChangedBy(file, policies, goalMap)
  const t2 = baselineTile({ name: baseline?.source ?? null, policyCount: policies.length, loading: busy, update, labelFor, stepsFor })
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
                <div className="change">
                  <span className="tag">{r.tag}</span>
                  <span className="policy">{r.policy}</span>
                </div>
                <ul className="steps">
                  {r.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
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
