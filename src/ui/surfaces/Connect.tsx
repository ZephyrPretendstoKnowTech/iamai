// Connect answers one question: where am I in setup, and what do I do next?
//
// The anatomy is the approved pack's (docs/design/approved/anatomy/connect-v3.html,
// restored by task 032): an eyebrow, the heading and its lead; one status strip
// saying where setup stands; ONE contiguous staged flow holding the three setup
// steps — never three or four unrelated cards; and the Plan as a separate
// destination panel below the flow. Each step is the pack's three-zone row —
// number, content, action — so a step's action belongs to the step instead of
// floating under it.
//
// The steps, in both states, are drawn from connectView.ts. Signed out: Sign in
// (with the consent rows and, after a sign-in that did not succeed, one of three
// error states from the MSAL error code), Baseline, Scan (after sign-in), and
// the destination with what the sample tenant produced. Signed in: Signed in,
// Baseline, Scan (the limitations, then the scan in exactly one of its states:
// complete, finished with gaps, not started for want of a role, scanning, or
// ready for the first scan) and the destination (ready, the last full plan after
// a scan with gaps, or waiting for the scan).
//
// The progression is Microsoft tenant → Baseline → Tenant scan → Plan, and the
// four stages are not four equally loud tiles (task 016): stages() reads which
// of them are finished, the finished ones step back, and the one with the next
// action is drawn forward and marked with a word. connectStatus() projects that
// same reading into the strip — the strip has no state of its own. Plan is the
// destination — one way on and no readiness diagnostic in front of it, because
// MFA Readiness comes after the plan.
//
// The tenant's name and the scan's age render here and nowhere else, from the
// one stored scan timestamp. Every action is a button in one of three weights,
// and every one calls ui/actions.ts: the scan's state is the session's
// (ui/session.ts), so a scan started anywhere shows here as stage 3's progress;
// an action that fails renders its error in the stage that pressed it. Global
// Reader is the only role IAMAI names.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { authReady, getGraphToken } from '../../graph/auth.ts'
import type { SignInError } from '../../graph/authError.ts'
import { READ_EVERYTHING_ROLE } from '../../graph/collect/roles.ts'
import type { TokenSource } from '../../graph/collect/runScan.ts'
import { GLOBAL_ADMINISTRATOR, coreRoleGap, rolesInToken } from '../../graph/collect/tokenRoles.ts'
import type { BaselineFile } from '../../baseline/index.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { stepsForChange } from '../../derive/baselineDiff.ts'
import type { PolicyChange } from '../../derive/baselineDiff.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import type { ScanRecord } from '../scan/scanRecord.ts'
import { roleName } from '../../roles.ts'
import { demoUrl, exitDemoUrl, isDemo } from '../demoMode.ts'
// The sample tenant's four facts, computed from the demo fixture through the
// plan engine at build time (vite.config.ts demoFactsModule): the signed-out
// page reads four numbers and never loads the demo chunk.
import SAMPLE_FACTS from 'virtual:demo-facts'
import { elapsedLabel } from '../format.ts'
import { Button, LinkButton } from '../components/index.ts'
import { PINNED_BASELINE, baselineReview, checkAuthorHead, loadPinnedBaseline, loadUploadedBaseline } from '../baseline.ts'
import type { BaselineResult } from '../baseline.ts'
import { PLAN_HREF } from '../shell/AppShell.tsx'
import { ScanBar, ScanDevTools, laneOf } from '../scan/ScanProgress.tsx'
import { chooseBaseline, scan as runScan, signIn, signInAnother, signOut, stopScan } from '../actions.ts'
import { useAction } from '../useAction.ts'
import { useSession } from '../session.ts'
import { W, accountTile, baselineTile, connectStatus, planTile, sampleTile, scanTile, signInTile, stages } from '../scan/connectView.ts'
import type { Action, BaselinePin, BaselineUpdate, ConnectStatus, PlanInput, PlanTile, ScanCounts, ScanInput, ScanTile, Stage, Tone } from '../scan/connectView.ts'
import { facts, stepFacts } from '../../derive/facts.ts'
import { usePlanData } from './planData.ts'

const C = app.connect
const PACKAGE_HREF = '#/how#package'
/** The baseline choices tile 2 opens in place; its button names it. */
const BASELINE_CHOICES_ID = 'baseline-choices'

type BaselineProps = {
  baseline: BaselineResult | null
  baselineRestoreError: string | null
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
  },
) {
  const { account } = props
  return (
    <section className="surface connect">
      <p className="eyebrow">{W.eyebrow}</p>
      <h1 className="display">{W.h1}</h1>
      <p className="lede">{W.intro}</p>
      {account ? <SignedIn {...props} account={account} /> : <SignedOut error={props.authError} baseline={props.baseline} baselineRestoreError={props.baselineRestoreError} authorUpdate={props.authorUpdate} />}
    </section>
  )
}

/**
 * The pack's status strip above the flow: an indicator, the state title and a
 * quiet line. The dot is decoration — the title is the state in words, so the
 * strip never depends on telling two colours apart.
 */
function StatusStrip({ status }: { status: ConnectStatus }) {
  return (
    <div className="connect-status">
      <span className={`dot${status.tone ? ` ${status.tone}` : ''}`} aria-hidden="true" />
      <p className="connect-status-copy">
        <strong>{status.title}</strong> <span className="quiet">{status.text}</span>
      </p>
    </div>
  )
}

/** The staged flow: one panel, the steps separated by a hairline, never a stack of cards. */
function Flow({ children }: { children: ReactNode }) {
  return <div className="connect-flow row-group">{children}</div>
}

/**
 * One numbered step of the flow, in the pack's three zones — number, content,
 * action. The badge carries the state colour (accent done, amber gaps or
 * approval, red no role or a personal account), and the step carries its place
 * in the progression (task 016): the stage with the next action is marked Next
 * and drawn forward, the ones behind it step back. The marker is a word, not a
 * colour, so the progression reads without seeing the accent. It sits beside
 * the heading rather than inside it: the heading is the step's title and its
 * state, and a progression marker inside the heading joins the heading's text,
 * so the step would announce and read as "Scan not started Next".
 *
 * The action zone is the third grid track and holds the step's own buttons. A
 * message an action produced stays in the content zone: it is a sentence, and a
 * sentence in an `auto` track is a column one word wide.
 */
function Step({ n, title, state, tone, stateTone, stage, actions, children }: { n: number; title: string; state?: string; tone: Tone; stateTone?: 'ok' | 'wait' | 'stop'; stage?: Stage; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={`connect-step${tone ? ` ${tone}` : ''}${stage ? ` ${stage}` : ''}`}>
      <span className="n">{n}</span>
      <div className="connect-step-body">
        <div className="connect-step-head">
          <h2>
            {title}
            {state && (
              <>
                {' '}
                <span className={`state${stateTone ? ` ${stateTone}` : ''}`}>{state}</span>
              </>
            )}
          </h2>
          {stage === 'current' && <span className="next">{W.next}</span>}
        </div>
        {children}
      </div>
      <div className="connect-step-actions">{actions}</div>
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
function ScanTileView({ tile, upn, bar, actions, note, stage }: { tile: ScanTile; upn: string | null; bar?: ReactNode; actions: ReactNode; note?: ReactNode; stage: Stage }) {
  return (
    <Step n={3} title={tile.title} state={tile.state} tone={tile.tone} stateTone={stateToneOf(tile.tone)} stage={stage} actions={actions}>
      {tile.meta && (
        <ul className="meta-counts">
          {tile.meta.map((m) => (
            <li key={m.label}>
              <b>{m.value}</b> {m.label}
            </li>
          ))}
        </ul>
      )}
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
      {note}
    </Step>
  )
}

/**
 * The Plan: the destination, and the approved pack's own separate panel below
 * the flow rather than a fourth card inside it. The state in the heading, one
 * line saying what the scan produced (the sample tenant's four facts before
 * sign-in), and one way on in the panel's action zone. No readiness diagnostic:
 * MFA Readiness comes after the plan, and Connect never routes to it first
 * (task 016).
 *
 * The pack draws only the ready state. Production has three more that are real
 * — the last full plan after a scan with gaps, waiting for the scan, and the
 * sample before sign-in — so the panel takes the pack's brand-tinted treatment
 * ONLY when the plan is actually ready, and stays an ordinary panel otherwise.
 * A destination that always looks ready would be a readiness claim drawn in
 * CSS.
 */
function Destination({ tile, actions }: { tile: PlanTile; actions: ReactNode }) {
  const ready = tile.kind === 'ready'
  return (
    <section className={`connect-destination${ready ? ' ready' : ''}`}>
      <div className="connect-destination-copy">
        <h2 className="display">
          {tile.title}
          {tile.state && (
            <>
              {' '}
              <span className={`state${stateToneOf(tile.tone) ? ` ${stateToneOf(tile.tone)}` : ''}`}>{tile.state}</span>
            </>
          )}
        </h2>
        {tile.lead && <p className="quiet">{tile.lead}</p>}
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
      </div>
      <div className="connect-destination-action">{actions}</div>
    </section>
  )
}

/**
 * Before sign-in: the sign-in tile (no tenant connected, or one of three error
 * states from the MSAL error code), the baseline, what happens next for your
 * tenant, and what the sample tenant produced.
 */
function SignedOut({ error, baseline, baselineRestoreError, authorUpdate }: BaselineProps & { error: SignInError | null }) {
  // The redirect takes seconds to start; the button must not look inert.
  const [opening, setOpening] = useState(false)
  // MSAL is warming: until it is ready the button carries a spinner but stays
  // clickable; a click made now is queued and fires the moment it is ready, so
  // the first click always lands (prompt 50.1 item 7).
  const [signInReady, setSignInReady] = useState(false)
  const firing = useRef(false)
  // A sign-in that could not start renders under the button (ui/useAction.ts): nothing is swallowed.
  const { run, error: actionError } = useAction()
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
      run(
        go().catch((e: unknown) => {
          firing.current = false
          setOpening(false)
          throw e
        }),
      )
    }
  }, [signInReady, opening, error, run])
  const t1 = signInTile({ error })
  const t3 = scanTile({ kind: 'sample' })
  const t4 = planTile({ kind: 'sample', facts: SAMPLE_FACTS })
  // Nothing is connected yet, so the first stage is the one to act on and the
  // three after it are ahead. The baseline loads itself, and is still not a
  // stage anyone has finished until a tenant is behind it.
  const done = [false, false, false, false]
  const [s1, s2, s3] = stages(done)
  const t2 = baselineStrings(baseline)
  return (
    <>
      <StatusStrip status={connectStatus(done, [t1, t2, t3, t4])} />
      <Flow>
        <Step
          n={1}
          title={t1.title}
          state={t1.state}
          tone={t1.tone}
          stateTone={stateToneOf(t1.tone)}
          stage={s1}
          actions={
            <>
              <Act action={t1.actions[0]} loading={opening} busy={!signInReady} onClick={() => setOpening(true)} />
              <Act action={t1.actions[1]} href={demoUrl()} />
            </>
          }
        >
          {t1.lead && <p>{lead(error?.kind === 'personal' ? (error.account ?? null) : null, t1.lead)}</p>}
          {t1.note && <p className="quiet">{t1.note}</p>}
          {actionError && <p className="quiet" role="status">{actionError}</p>}
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
        </Step>
        <BaselineTile baseline={baseline} restoreError={baselineRestoreError} locked={false} authorUpdate={authorUpdate} stage={s2} />
        <ScanTileView tile={t3} upn={null} actions={null} stage={s3} />
      </Flow>
      <Destination tile={t4} actions={<Act action={t4.actions[0]} href={demoUrl()} />} />
    </>
  )
}

/**
 * The baseline stage's title and state for the status strip, from the same
 * baselineTile() the stage itself renders. The strip is drawn beside the flow
 * and cannot reach into the stage's own component, so this asks the view model
 * the one question the strip needs — never a second reading of the baseline.
 */
/**
 * Where the loaded package came from, for the source-and-version disclosure
 * (task Step 1 C). The commit is the loaded package's own (`origin.commit`),
 * the repository and the read date are the pinned index's — no third place
 * states either. An uploaded package has no origin to name, so it gets none.
 */
function baselinePin(baseline: BaselineResult | null): BaselinePin | null {
  if (!baseline || baseline.origin.kind !== 'github') return null
  const { owner, repo, commit } = baseline.origin
  // The URL is the owner and repo the package was actually fetched from, so the
  // link and the commit beside it can never name different repositories.
  return { repo: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}`, commit, readAt: PINNED_BASELINE.generatedAt }
}

function baselineStrings(baseline: BaselineResult | null): { title: string; state: string; tone: Tone } {
  const t = baselineTile({ name: baseline?.source ?? null, policyCount: baseline?.pkg.policies.length ?? 0, version: baseline?.origin.kind === 'upload' ? 'uploaded' : 'pinned', loading: null, update: null, stepsFor: () => [] })
  return { title: t.title, state: t.state, tone: t.tone }
}

function SignedIn({
  account,
  tenantName,
  baseline,
  baselineRestoreError,
  authorUpdate,
  lastScan,
}: BaselineProps & {
  account: AccountInfo
  tenantName: string | null
  lastScan: ScanRecord | null
}) {
  // The scan in flight, wherever it was started (ui/session.ts): tile 3 shows it.
  const { scan: runner, getToken } = useSession()
  const scanning = runner.state === 'running' || runner.state === 'paused'
  // What an action reported, rendered in the tile that pressed it (ui/useAction.ts).
  const tile1 = useAction()
  const tile3 = useAction()
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
  // A first scan stays here and offers the plan; Scan again returns to the Plan when it lands (target-state §2).
  const start = (first: boolean): void => tile3.run(runScan(first ? null : PLAN_HREF))

  // In the demo nobody is signed in: tile 1 is sample context, and its one
  // action is the way out. The signed-in tile's two actions are Microsoft's
  // (a real sign-in, and a clear of the real sign-in cache), so the demo must
  // not offer them over a tenant that is a fixture.
  const t1 = isDemo() ? sampleTile({ tenant, upn }) : accountTile({ tenant, upn, role: accountRole(roleIds) })
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
  // The plan follows: it is ready after a complete scan (its step counts the way
  // the Plan header counts them, once the plan has computed; read-only, so
  // opening Connect never creates or touches the plan record), the last full
  // plan stays after a scan with gaps, and otherwise it waits for the scan.
  const planScan = scanInput.kind === 'complete' ? lastScan : null
  const plan = usePlanData(planScan, baseline, true)
  const computed = plan.computed
  // The destination's own count, including the Cleanup rows the emergency-access
  // answers complete (derive/facts.ts): the tile and the Plan header state one number.
  const steps = computed ? stepFacts(computed.steps, computed.schedule.cleanup ?? null, plan.mapping?.breakGlassAnswers ?? null) : null
  // What the complete scan produced, for the step's meta row. Each number comes
  // from the authority that already owns it: derive/facts.ts for the people (the
  // one denominator the Plan and MFA Readiness count against), the loaded
  // package for the policies, and the same stepFacts the destination shows. A
  // count is rendered twice here; it is never computed twice.
  const snapshot = planScan?.snapshot ?? null
  const mapping = plan.mapping
  const scanCounts: ScanCounts | null = useMemo(() => {
    if (!snapshot || !mapping || !steps || !baseline) return null
    return { people: facts(snapshot, mapping).active, policies: baseline.pkg.policies.length, steps: steps.steps }
  }, [snapshot, mapping, steps?.steps, baseline])
  const t3 = scanTile(scanInput.kind === 'complete' ? { ...scanInput, counts: scanCounts } : scanInput)
  const planInput: PlanInput =
    scanInput.kind === 'complete' && lastScan
      ? { kind: 'ready', at: lastScan.at, counts: steps }
      : scanInput.kind === 'gaps' && lastScan
        ? { kind: 'last', at: lastScan.at }
        : { kind: 'waiting' }
  const t4 = planTile(planInput)
  // The progression, from the tiles themselves: a tenant is connected, a
  // baseline is loaded, the scan is complete, and the plan is ready. The first
  // one that is not finished is the one with the next action.
  const done = [true, baseline !== null, scanInput.kind === 'complete', planInput.kind === 'ready']
  const [s1, s2, s3] = stages(done)
  const scanActions = (): ReactNode => {
    switch (t3.kind) {
      case 'complete':
        return <Act action={t3.actions[0]} onClick={() => start(false)} />
      case 'gaps':
        return (
          <>
            <Act action={t3.actions[0]} onClick={() => tile3.run(signInAnother())} />
            <Act action={t3.actions[1]} onClick={() => start(false)} />
          </>
        )
      case 'role':
        return <Act action={t3.actions[0]} onClick={() => tile3.run(signInAnother())} />
      case 'scanning':
        return <Act action={t3.actions[0]} onClick={stopScan} />
      default:
        return <Act action={t3.actions[0]} onClick={() => start(true)} />
    }
  }
  return (
    <>
      <StatusStrip status={connectStatus(done, [t1, baselineStrings(baseline), t3, t4])} />
      <Flow>
        <Step
          n={1}
          title={t1.title}
          state={t1.state}
          tone={t1.tone}
          stateTone="ok"
          stage={s1}
          actions={
            isDemo() ? (
              <Act action={t1.actions[0]} href={exitDemoUrl()} />
            ) : (
              <>
                <Act action={t1.actions[0]} onClick={() => tile1.run(signInAnother())} />
                <Act action={t1.actions[1]} onClick={() => tile1.run(signOut())} />
              </>
            )
          }
        >
          <p>{lead(upn, t1.line)}</p>
          <p className="quiet">{t1.note}</p>
          {tile1.error && <p className="quiet" role="status">{tile1.error}</p>}
        </Step>
        <BaselineTile baseline={baseline} restoreError={baselineRestoreError} locked={scanning} authorUpdate={authorUpdate} stage={s2} />
        <ScanTileView
          tile={t3}
          upn={upn}
          stage={s3}
          bar={t3.kind === 'scanning' ? <ScanBar scan={runner} /> : null}
          note={
            <>
              {!scanning && runner.state === 'failed' && runner.error && <p className="quiet" role="status">{fillText(C.failed, { why: runner.error })}</p>}
              {tile3.error && <p className="quiet" role="status">{tile3.error}</p>}
            </>
          }
          actions={scanActions()}
        />
      </Flow>
      <Destination tile={t4} actions={t4.actions.map((a) => <Act key={a.label} action={a} href={PLAN_HREF} />)} />
      <ScanDevTools tenantId={account.tenantId} scan={runner} snapshot={lastScan?.snapshot ?? null} />
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
      const review = await baselineReview(head.head)
      // An incomplete review still renders: a compare IAMAI could not finish is
      // never reported as a baseline with nothing in it.
      if (!live || (review.changes.length === 0 && !review.incomplete)) return
      setUpdate({ date: head.date, changes: review.changes, incomplete: review.incomplete })
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
 * with two choices. The default loads itself when nothing is saved, and says
 * so: a default nobody picked is not a choice to record against the tenant.
 */
// The tile asks; the action reads the package, makes it the tenant's and
// records a pick (ui/actions.ts). Reading it there and not here is what lets
// Sign out and Forget this tenant take an unfinished read with them: a package
// that arrives after either action is applied to nothing and stored nowhere.
function BaselineTile({ baseline, restoreError, locked, authorUpdate, stage }: { baseline: BaselineResult | null; restoreError: string | null; locked: boolean; authorUpdate?: BaselineUpdate | null; stage: Stage }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const update = useAuthorUpdate(authorUpdate)

  const loadPinned = async (chosen: boolean) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setBusy(PINNED_BASELINE.label)
    setError(null)
    try {
      await chooseBaseline(() => loadPinnedBaseline(), chosen)
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
      await chooseBaseline(async () => {
        const files: BaselineFile[] = await Promise.all([...fileList].map(async (f) => ({ path: f.name, text: await f.text() })))
        return loadUploadedBaseline(files)
      }, true)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  // Nothing saved, nothing failed: the default loads itself, and is not a pick.
  useEffect(() => {
    if (baseline || restoreError || busy || error) return
    void loadPinned(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline, restoreError])

  // A changed source policy is named by its own stable identity; the steps it
  // stands behind come through the baseline's goal map, which keys by that same
  // identity (derive/baselineDiff.ts). Absent means the pinned map.
  const policies = baseline?.pkg.policies ?? []
  const goalMap = baseline?.goalMap ?? PINNED_GOAL_MAP
  const stepsFor = (change: PolicyChange): string[] => stepsForChange(change, goalMap)
  const t2 = baselineTile({ name: baseline?.source ?? null, policyCount: policies.length, version: baseline?.origin.kind === 'upload' ? 'uploaded' : 'pinned', pin: baselinePin(baseline), loading: busy, update, stepsFor })
  return (
    <Step
      n={2}
      title={t2.title}
      state={t2.state}
      tone={t2.tone}
      stage={stage}
      actions={
        !busy && (
          /* Held while a scan runs: the baseline it reads against must not change under it. */
          <Button variant="secondary" aria-expanded={open} aria-controls={BASELINE_CHOICES_ID} disabled={locked} onClick={() => setOpen((o) => !o)}>
            {t2.actions[0].label}
          </Button>
        )
      }
    >
      {/* The pack nests the package's own card inside the step: its name, a
          quiet source line, and the copy that says what a baseline is. */}
      {t2.card && (
        <div className="baseline-card">
          <strong className="baseline-name">{t2.card.name}</strong>
          <p className="baseline-source">{t2.card.source}</p>
          {t2.card.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      )}
      {t2.source && (
        <details>
          <summary>{t2.source.summary}</summary>
          <p className="quiet">{t2.source.text}</p>
          {/* The source, where it can be opened and checked, and the revision
              IAMAI holds of it. Both are the loaded package's own facts. */}
          {t2.source.link && (
            <p className="quiet">
              <a href={t2.source.link.url} target="_blank" rel="noopener noreferrer">
                {t2.source.link.label}
              </a>
            </p>
          )}
          {t2.source.version && <p className="quiet">{t2.source.version}</p>}
        </details>
      )}
      {t2.paragraphs.map((text) => (
        <p key={text}>{text}</p>
      ))}
      {error && <p className="quiet" role="status">{fillText(C.baselineFailed, { why: error })}</p>}
      {!error && !baseline && restoreError && <p className="quiet" role="status">{C.restoreFailed}</p>}
      {t2.update && (
        <details>
          <summary>{t2.update.summary}</summary>
          {t2.update.note && <p className="quiet" role="status">{t2.update.note}</p>}
          <ul className="diff">
            {t2.update.rows.map((r, i) => (
              <li key={`${i}-${r.policy}`}>
                <div className="change">
                  <span className="tag">{r.tag}</span>
                  <span className="policy">{r.policy}</span>
                </div>
                {r.was && <p className="was">{r.was}</p>}
                {r.deltas.length > 0 && (
                  <ul className="deltas">
                    {r.deltas.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                )}
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
      {open && !locked && (
        <div className="picker" id={BASELINE_CHOICES_ID} role="group" aria-label={C.pickerLabel}>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false)
              void loadPinned(true)
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
    </Step>
  )
}
