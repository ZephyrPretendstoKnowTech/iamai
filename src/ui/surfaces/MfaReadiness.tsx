import type { Step } from '../../roadmap/types.ts'
import { reached } from '../../derive/population.ts'
// MFA Readiness (prompt 62): phishing-resistant sign-in for everyone, seamless
// on every device.
//
// The visual and interaction authority is
// docs/design/approved/anatomy/mfa-readiness-v3.html: the answer (one sentence,
// the Seamless goal, the progress since the last scan) over one bar of people by
// state; the worklist grouped by next action with the next check first and open,
// large groups split admins first; a rail of tenant setup, approved models, the
// uncounted and the evidence read; a non-modal person panel. It owns none of the
// words (pages.readiness) and none of the truth.
//
// The truth is one derivation. Every person's state, devices, credentials and
// next action is scoring/phishingResistant.ts `personReadiness`, carried on the
// row by derive/mfaReadiness.ts; the setup checks and the next check are
// derive/readinessSetup.ts; the progress is derive/readinessProgress.ts; the
// words are surfaces/readinessCells.ts. The Plan's gates follow each step's own
// policy requirement and never read this page's Ready: this page holds the
// higher bar.
//
// The Plan handoff: #/readiness/step/<id> scopes the worklist to the people one
// step is waiting on (derive/stepMfaReadiness.ts). The hash carries the step's
// id and nothing else; who it reaches is resolved from the plan computed here.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import { DEFAULT_SHOW, GROUP_ORDER, SHOW_KEYS, SUB_GROUP_AT, readinessView, showKeyOf, shows, subGroupsOf } from '../../derive/mfaReadiness.ts'
import type { ReadinessRow, ShowKey, SubGroup, SubGroupBy } from '../../derive/mfaReadiness.ts'
import { nextCheck, remainingChecks, tenantSetupChecks } from '../../derive/readinessSetup.ts'
import type { SetupCheck } from '../../derive/readinessSetup.ts'
import { progressOf } from '../../derive/readinessProgress.ts'
import { GUEST_STEP_ID, guestReadingOf } from '../../derive/guestReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { KINDS } from '../../derive/ladder.ts'
import { READINESS_STATES, isReady } from '../../scoring/phishingResistant.ts'
import type { ReadinessState } from '../../scoring/phishingResistant.ts'
import { app, pages } from '../../content/content.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import { checkWords, deviceChips, listWords, methodsCell, nextCell, osWord, panelDevices, panelMethods, rowCells, rowNote, searchText, stateTitle, whyLine, goalLine } from './readinessCells.ts'
import type { PanelItem } from './readinessCells.ts'
import { READINESS_CSV } from './inventoryTables.ts'
import { useAppliedMapping, usePlanData } from './planData.ts'
import { readinessHref, showFromReadinessHash, stepFromReadinessHash } from '../shell/routes.ts'
import { Button } from '../components/index.ts'
import { toCsv } from '../format.ts'
import { exportDownload, unredactedFrom } from '../exportGuard.ts'
import { scan } from '../actions.ts'
import { useAction } from '../useAction.ts'
import { signInProofRead } from '../../scoring/fromSnapshot.ts'

type Words = {
  h1: string
  eyebrow: string
  lead: string
  summaryLabel: string
  summary: string
  summaryNone: string
  summaryUnmeasured: string
  seamlessLine: string
  seamlessNone: string
  seamlessNotPossible: string
  define: string
  change: { title: string; ready: string; seamless: string; none: string; lapse: string; show: string }
  legendLabel: string
  worklist: string
  search: string
  exportCsv: string
  nextLabel: string
  nextSetupWho: string
  groups: Record<ReadinessState, { title: string; why: string; body?: string }>
  groupAction: string
  sub: { admins: string; adminsWhy: string; intro: string; groupBy: string; byDevices: string; byDepartment: string; noDepartment: string; noDevices: string; showing: string; showMore: string }
  columns: string[]
  csvColumns: string[]
  details: string
  detailsFor: string
  chip: { unread: string; noPhone: string }
  admin: string
  guest: string
  panel: { close: string; next: string; devices: string; methods: string; noneRegistered: string; noDevices: string }
  rail: { setup: string; remaining: string; nothing: string; completed: string; shownAbove: string; models: string; modelsFrom: string; counted: string; evidence: string }
  checks: { link: string; step3: { note: string } }
  counted: Record<string, string>
  evidence: { full: string; partial: string; none: string; unreadMethods: string; notCovered: string; individually: string }
  footer: { counted: string; plan: string }
  inventory: string
  empty: string
  emptyFilter: string
  planContext: { filtered: string; unknown: string; back: string; uncounted: string }
  show: Record<string, string>
  guests: { title: string; count: string; trustOn: string; trustOff: string; trustUnknown: string; policyInPlace: string; policyNotInPlace: string; policyLink: string; suggestion: string }
}
const T = pages.readiness as unknown as Words

const stepHref = (stepId: string): string => `#/plan/${encodeURIComponent(stepId)}`
/** The Plan step each setup check's change belongs to, where the plan holds it. */
const CHECK_STEP: Partial<Record<SetupCheck['key'], string>> = { passkeyOn: 's-prereq-passkey-settings', phonePasskey: 's-prereq-passkey-settings', step3: 's-prereq-passkey-settings', registration: 's-goal-register-info-protected' }
/** The Plan step whose Implementation holds the setup email and the registration campaign steps. */
const SETUP_STEP = 's-verify-mfa'
const PANEL_ID = 'readiness-panel'

/** The Plan step this page is scoped to: the people it is waiting on, or null where this scan could not settle who. */
type PlanContext = { title: string; stepId: string; ids: string[] | null }

export function MfaReadiness({ scan: lastScan, baseline }: { scan: { snapshot: TenantSnapshot; at: string } | null; baseline: BaselineResult | null }) {
  const [stepId, setStepId] = useState<string | null>(() => stepFromReadinessHash(window.location.hash))
  useEffect(() => {
    const onHash = () => setStepId(stepFromReadinessHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // The plan, computed read-only exactly as Connect's Plan tile does: the step a
  // scoped page names, and the steps the setup checks and group actions link to.
  const data = usePlanData(lastScan, baseline, true)
  const steps = data.computed?.steps ?? []
  const scored = data.computed?.viability ?? []
  const step = stepId === null ? null : (steps.find((s) => s.id === stepId) ?? null)
  const hold = step && data.computed ? stepMfaHold(step, scored) : null
  const cohort = step?.preparation?.ids ?? step?.methodPreparation?.ids ?? null
  const context: PlanContext | null = step && (hold || cohort || step.id === SETUP_STEP) ? { title: contentTitle(step), stepId: step.id, ids: hold ? hold.ids : (cohort ?? reached(step)?.ids ?? null) } : null
  const stepIds = new Set(steps.map((s) => s.id))
  const guestStep = steps.find((s) => s.id === GUEST_STEP_ID) ?? null
  return <ReadinessPage snapshot={lastScan?.snapshot ?? null} context={context} planSteps={stepIds} guestStep={guestStep} />
}

const Icon = ({ k }: { k: 'computer' | 'phone' | 'key' | 'chev' }): ReactNode => (
  <svg aria-hidden="true" className={k === 'chev' ? 'chev' : undefined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={k === 'chev' ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    {k === 'computer' && <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>}
    {k === 'phone' && <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>}
    {k === 'key' && <><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2 2M14 9l2 2" /></>}
    {k === 'chev' && <path d="M9 6l6 6-6 6" />}
  </svg>
)

/** The bar's and the legend's order: the done states first, then the work, as the pack draws it. */
const LEGEND_ORDER: readonly ReadinessState[] = ['seamless', 'ready', 'confirm', 'device', 'method', 'blocked', 'unknown']

function ReadinessPage({ snapshot, context, planSteps, guestStep }: { snapshot: TenantSnapshot | null; context: PlanContext | null; planSteps: ReadonlySet<string>; guestStep: { status: string } | null }) {
  // The population's mapping (the detected emergency and service accounts, and every saved decision): the Plan's and Connect's.
  const mapping = useAppliedMapping(snapshot)
  const again = useAction()
  const view = useMemo(() => (snapshot && mapping ? readinessView(snapshot, snapshot.asOf, mapping) : null), [snapshot, mapping])
  const checks = useMemo(() => (snapshot && view ? tenantSetupChecks(snapshot, view) : []), [snapshot, view])
  const progress = useMemo(() => (snapshot && view ? progressOf(view, snapshot) : null), [snapshot, view])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<ShowKey>(() => showKeyOf(showFromReadinessHash(window.location.hash)) ?? DEFAULT_SHOW)
  const [groupBy, setGroupBy] = useState<SubGroupBy>('devices')
  const [limits, setLimits] = useState<Record<string, number>>({})
  // Sub-groups the person has opened or closed; admins start open, the rest closed.
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})
  // The panel is held by the account id the row carries, never the display name.
  const [openId, setOpenId] = useState<string | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const groupsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onHash = () => setShow(showKeyOf(showFromReadinessHash(window.location.hash)) ?? DEFAULT_SHOW)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const select = (key: ShowKey): void => {
    setShow(key)
    // A step-scoped view keeps its hash: the scope is what the URL means.
    if (!context) window.history.replaceState(null, '', readinessHref(key))
  }
  // A scan that changes who is listed closes the panel rather than leaving it over an account that is gone.
  const openRow = openId === null ? null : (view?.rows.find((r) => r.user.id === openId) ?? null)
  const isOpen = openRow !== null
  useEffect(() => {
    if (openId !== null) closeRef.current?.focus()
  }, [openId])
  const close = (): void => {
    setOpenId(null)
    // The row that opened the panel, or, where a filter has since removed it, the worklist.
    if (trigger.current?.isConnected) trigger.current.focus()
    else groupsRef.current?.querySelector<HTMLElement>('summary, button')?.focus()
  }
  const closeRefFn = useRef(close)
  closeRefFn.current = close
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      const field = e.target instanceof HTMLElement && e.target.closest('input, textarea, select') !== null
      if (e.key === 'Escape' && !field) closeRefFn.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const heading = (
    <>
      <div className="eyebrow">{T.eyebrow}</div>
      <h1 className="display">{T.h1}</h1>
    </>
  )
  if (!view || !snapshot) {
    return (
      <section className="surface readiness">
        {heading}
        <p className="reason">{app.shell.loading}</p>
      </section>
    )
  }

  const q = query.trim().toLowerCase()
  const scoped = context?.ids ? new Set(context.ids) : null
  const inScope = (r: ReadinessRow): boolean => !context || scoped === null || scoped.has(r.user.id)
  // The step's people this page doesn't count: guests (spoken for at tenant level) and people outside the activity window.
  const uncountedInScope = scoped ? view.rows.filter((r) => scoped.has(r.user.id) && r.state === null).length : 0
  const counted = view.rows.filter((r) => r.state !== null && inScope(r))
  const counts = Object.fromEntries(READINESS_STATES.map((s) => [s, counted.filter((r) => r.state === s).length])) as Record<ReadinessState, number>
  // Scoped to the Plan step's people where the page was opened from one; guests are never counted.
  const active = counted.length
  const ready = counts.ready + counts.seamless
  // The one proof-read check Connect and the Plan's gate make (scoring/fromSnapshot.ts): records read AND carrying
  // proof. A scan that holds no proof is unmeasured, never "0 of N".
  const summary = active === 0 ? T.summaryNone : !signInProofRead(snapshot) ? fillText(T.summaryUnmeasured, { active }) : fillText(T.summary, { ready, active })
  const goal = goalLine(counted)
  // Scoped from a Plan step, the next check counts that step's people, not the tenant's.
  const scopedView = context ? { ...view, rows: view.rows.filter(inScope), counts } : { ...view, counts }
  const next = nextCheck(scopedView, context ? tenantSetupChecks(snapshot, scopedView) : checks)
  const remaining = remainingChecks(checks)
  const done = checks.filter((c) => c.outcome === 'pass' || c.outcome === 'note')
  const action = active - ready
  const matches = (r: ReadinessRow): boolean => inScope(r) && shows(r, show, view.lapsing) && (!q || searchText(r).includes(q))

  // The worklist: the next check's group first, the rest in the fixed order. The
  // done groups appear only where the filter asks for everyone (or for them).
  const lead = next.kind === 'group' ? next.state : null
  const order: ReadinessState[] = lead ? [lead, ...GROUP_ORDER.filter((s) => s !== lead)] : [...GROUP_ORDER]
  const groups = order
    .map((s) => ({ state: s, rows: view.rows.filter((r) => r.state === s && matches(r)) }))
    .filter((g) => g.rows.length > 0)
  const openAll = show !== 'needsAction' && show !== 'all'

  const rowView = (r: ReadinessRow): ReactNode => {
    const chips = deviceChips(r)
    const m = methodsCell(r)
    const note = rowNote(r)
    return (
      <div className="readiness-row" key={r.user.id}>
        <div className="person">
          <span className="person-name">
            {r.user.displayName ?? r.user.userPrincipalName}
            {r.admin && <span className="tag">{T.admin}</span>}
            {r.guest && <span className="tag">{T.guest}</span>}
          </span>
          {r.user.displayName && r.user.userPrincipalName && <span className="person-upn tenant-object">{r.user.userPrincipalName}</span>}
        </div>
        <div className="devices">
          {chips.chips.map((c, i) => (
            <span className="dev" key={i} title={c.title}>
              <Icon k={c.kind} />
              {c.os}
              <span className={`dev-word s-${c.tone}`}>{c.word}</span>
            </span>
          ))}
          {chips.noPhone && (
            <span className="dev off">
              <Icon k="phone" />
              {T.chip.noPhone}
            </span>
          )}
          {chips.chips.length === 0 && r.state !== null && (
            <span className="dev off">{r.readiness?.unknown === 'signIns' ? T.chip.unread : T.sub.noDevices}</span>
          )}
        </div>
        <div className="methods">
          {m.main}
          {m.note && <span className="cell-note">{m.note}</span>}
        </div>
        <div className="next-step">
          {nextCell(r)}
          {note && <span className="cell-note">{note}</span>}
        </div>
        <Button
          variant="tertiary"
          className="open"
          aria-haspopup="dialog"
          aria-label={fillText(T.detailsFor, { name: r.user.displayName ?? r.user.userPrincipalName ?? '' })}
          aria-expanded={openId === r.user.id}
          aria-controls={openId === r.user.id ? PANEL_ID : undefined}
          onClick={(e) => {
            trigger.current = e.currentTarget
            setOpenId(r.user.id)
          }}
        >
          {T.details}
        </Button>
      </div>
    )
  }
  const head = (
    <div className="readiness-row head" aria-hidden="true">
      {T.columns.map((c) => (
        <span key={c}>{c}</span>
      ))}
      <span />
    </div>
  )
  const limitOf = (key: string, fallback: number): number => limits[key] ?? fallback
  const moreLine = (key: string, shown: number, total: number): ReactNode =>
    shown < total ? (
      <p className="readiness-more">
        {fillText(T.sub.showing, { shown, n: total })}{' '}
        <Button variant="tertiary" onClick={() => setLimits((l) => ({ ...l, [key]: shown + SUB_GROUP_AT }))}>
          {fillText(T.sub.showMore, { n: Math.min(SUB_GROUP_AT, total - shown) })}
        </Button>
      </p>
    ) : null
  const subTitle = (g: SubGroup): string =>
    g.admins ? T.sub.admins : groupBy === 'devices' ? (g.platforms.length > 0 ? listWords(g.platforms.map(osWord)) : T.sub.noDevices) : (g.department ?? T.sub.noDepartment)
  const groupBody = (state: ReadinessState, rows: ReadinessRow[]): ReactNode => {
    if (rows.length <= SUB_GROUP_AT) return <div className="readiness-rows">{head}{rows.map(rowView)}</div>
    const subs = subGroupsOf(rows, groupBy)
    return (
      <>
        <div className="readiness-subbar">
          <span>{fillText(T.sub.intro, { n: rows.length })}</span>
          <label>
            {T.sub.groupBy}{' '}
            <select value={groupBy} onChange={(e) => setGroupBy(e.currentTarget.value as SubGroupBy)}>
              <option value="devices">{T.sub.byDevices}</option>
              <option value="department">{T.sub.byDepartment}</option>
            </select>
          </label>
        </div>
        {subs.map((g) => {
          const key = `${state}|${groupBy}|${g.key}`
          const shown = Math.min(g.rows.length, limitOf(key, g.admins ? 3 : SUB_GROUP_AT))
          const isOpen = openSubs[key] ?? g.admins
          return (
            <details className="readiness-sub" key={key} open={isOpen || undefined} onToggle={(e) => { const open = e.currentTarget.open; setOpenSubs((o) => (o[key] === open ? o : { ...o, [key]: open })) }}>
              <summary>
                <span>
                  <span className="group-title">{subTitle(g)}</span>
                  {g.admins && <span className="group-why">{T.sub.adminsWhy}</span>}
                </span>
                <span className="group-count">{g.rows.length}</span>
                <Icon k="chev" />
              </summary>
              {isOpen && (
                <>
                  <div className="readiness-rows">{head}{g.rows.slice(0, shown).map(rowView)}</div>
                  {moreLine(key, shown, g.rows.length)}
                </>
              )}
            </details>
          )
        })}
      </>
    )
  }
  const setupStep = planSteps.has(SETUP_STEP) ? SETUP_STEP : null
  const groupView = ({ state, rows }: { state: ReadinessState; rows: ReadinessRow[] }): ReactNode => {
    const G = T.groups[state]
    const isNext = state === lead && show !== 'lapsing'
    const quiet = isReady(state)
    return (
      <details key={state} className={`readiness-group panel${isNext ? ' next' : ''}${quiet ? ' quiet' : ''}`} open={isNext || openAll || undefined} data-state={state}>
        <summary>
          <span className={`state-dot s-${state}`} aria-hidden="true" />
          <span>
            {isNext && <span className="next-label">{T.nextLabel}</span>}
            <span className="group-title">{G.title}</span>
            <span className="group-why">{G.why}</span>
          </span>
          <span className="group-count">{rows.length}</span>
          <Icon k="chev" />
        </summary>
        {isNext && G.body && (
          <div className="next-body">
            <p>{G.body}</p>
            {setupStep && (
              <div className="next-actions">
                <a className="btn btn-primary" href={stepHref(setupStep)}>{T.groupAction}</a>
              </div>
            )}
          </div>
        )}
        {groupBody(state, rows)}
      </details>
    )
  }
  const setupNext = next.kind === 'setup' && show !== 'lapsing' && show !== 'admins' ? next.check : null
  const setupStepOf = (c: SetupCheck): string | null => {
    const id = CHECK_STEP[c.key]
    return id && planSteps.has(id) ? id : null
  }

  const exportCsv = (): void => {
    const rows = view.rows.filter(matches)
    exportDownload(READINESS_CSV, toCsv(T.csvColumns, rows.map((r) => [r.user.displayName ?? r.user.userPrincipalName ?? r.user.id, r.user.userPrincipalName ?? '', ...rowCells(r)])), 'text/csv', unredactedFrom('inventory-csv'))
  }

  const source = snapshot.sources.signInEvidence
  const covered = source?.coveredWindow
  const partial = source?.status === 'partial'
  const notCovered = counts.unknown > 0 ? counted.filter((r) => r.readiness?.unknown === 'notCovered').length : 0
  const unreadMethods = counted.filter((r) => r.readiness?.unknown === 'methods').length
  const days = covered ? Math.max(1, Math.round((Date.parse(covered.to) - Date.parse(covered.from)) / 86_400_000)) : 0
  const models = view.context.step3.models
  // Guests (option B): spoken for once, at tenant level, never as people.
  const guests = guestReadingOf(snapshot, view.explained.guest, guestStep)
  const G = T.guests
  const Cnt = T.counted

  const panelList = (items: PanelItem[], empty: string): ReactNode =>
    items.length === 0 ? (
      <p className="item-sub">{empty}</p>
    ) : (
      items.map((it, i) => (
        <div className="item" key={i}>
          <Icon k={it.icon} />
          <div>
            <div className="item-name">{it.name}</div>
            <div className="item-sub">{it.sub}</div>
          </div>
          <dl className="facts">
            {it.facts.map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))
    )

  return (
    <section className="surface readiness">
      {heading}
      <p className="line intro">{T.lead}</p>
      {context && (
        <p className="line scope-line">
          {context.ids === null ? fillText(T.planContext.unknown, { step: context.title }) : fillText(T.planContext.filtered, { n: context.ids.length, step: context.title })}{' '}
          {uncountedInScope > 0 && <>{fillText(T.planContext.uncounted, { n: uncountedInScope })}{' '}</>}
          <a href={stepHref(context.stepId)}>{T.planContext.back}</a>
        </p>
      )}

      <section className="readiness-answer panel" aria-label={T.summaryLabel}>
        <div className="answer-top">
          <div>
            <h2 className="headline">{summary}</h2>
            {active > 0 && <p className="goal">{goal}</p>}
          </div>
          {progress && !context && (
            <div className="readiness-change">
              <strong>{fillText(T.change.title, { date: monthDay(progress.since) })}</strong>
              <ul>
                <li>
                  <b className={progress.ready > 0 ? 'up' : undefined}>{progress.ready === 0 ? T.change.none : `${progress.ready > 0 ? '+' : ''}${progress.ready}`}</b> {T.change.ready}
                </li>
                <li>
                  <b className={progress.seamless > 0 ? 'up' : undefined}>{progress.seamless === 0 ? T.change.none : `${progress.seamless > 0 ? '+' : ''}${progress.seamless}`}</b> {T.change.seamless}
                </li>
                <li>
                  <b>{view.lapsing.length}</b> {T.change.lapse}
                  {view.lapsing.length > 0 && (
                    <>
                      {' '}
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          select('lapsing')
                          groupsRef.current?.scrollIntoView({ block: 'start' })
                        }}
                      >
                        {T.change.show}
                      </Button>
                    </>
                  )}
                </li>
              </ul>
            </div>
          )}
        </div>
        {active > 0 && (
          <>
            <div className="readiness-bar" aria-hidden="true">
              {LEGEND_ORDER.filter((s) => counts[s] > 0).map((s) => (
                <span key={s} className={`s-${s}`} style={{ flex: counts[s] }} />
              ))}
            </div>
            <ul className="readiness-legend" aria-label={T.legendLabel}>
              {LEGEND_ORDER.filter((s) => counts[s] > 0).map((s) => (
                <li key={s}>
                  <span className={`state-dot s-${s}`} aria-hidden="true" />
                  {stateTitle(s)} <b>{counts[s]}</b>
                </li>
              ))}
            </ul>
            <p className="define">{T.define}</p>
          </>
        )}
      </section>

      <div className="readiness-layout">
        <div ref={groupsRef}>
          <div className="toolbar no-print">
            <h2>{T.worklist}</h2>
            <input type="search" placeholder={T.search} aria-label={T.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            {SHOW_KEYS.map((k) => (
              <Button key={k} variant="tertiary" className="pill" aria-pressed={show === k} onClick={() => select(k)}>
                {k === 'needsAction' ? `${T.show.needsAction} · ${action}` : T.show[k]}
              </Button>
            ))}
            {!SHOW_KEYS.includes(show) && (
              <Button variant="tertiary" className="pill" aria-pressed={true} onClick={() => select(DEFAULT_SHOW)}>
                {T.show[show] ?? show}
              </Button>
            )}
            <Button variant="secondary" onClick={exportCsv}>
              {T.exportCsv}
            </Button>
          </div>
          {setupNext && (
            <section className="readiness-setup-next" aria-labelledby="readiness-setup-next">
              <span className="next-label">
                {T.nextLabel}
                <span className="who">{fillText(T.nextSetupWho, { n: setupNext.affects })}</span>
              </span>
              <h3 id="readiness-setup-next">{checkWords(setupNext).line}</h3>
              <p>{checkWords(setupNext).text}</p>
              {setupStepOf(setupNext) && (
                <div className="next-actions">
                  <a className="btn btn-primary" href={stepHref(setupStepOf(setupNext) as string)}>{T.checks.link}</a>
                </div>
              )}
            </section>
          )}
          {groups.length === 0 ? <p className="reason">{show === 'needsAction' && !q && active > 0 ? T.empty : T.emptyFilter}</p> : groups.map(groupView)}
        </div>

        <aside className="readiness-rail" aria-label={T.rail.setup}>
          <section className="readiness-tile panel" aria-labelledby="readiness-setup">
            <h3 id="readiness-setup">{T.rail.setup}</h3>
            <p className="remain">{remaining.length > 0 ? fillText(T.rail.remaining, { n: remaining.length }) : T.rail.nothing}</p>
            {remaining[0] && (
              <>
                <p className="check">{checkWords(remaining[0]).line}</p>
                {setupNext && setupNext.key === remaining[0].key ? <p>{T.rail.shownAbove}</p> : checkWords(remaining[0]).text && <p>{checkWords(remaining[0]).text}</p>}
                {remaining.slice(1).map((c) => (
                  <p key={c.key} className="check">{checkWords(c).line}</p>
                ))}
              </>
            )}
            <details open={remaining.length === 0 || undefined}>
              <summary>{fillText(T.rail.completed, { n: done.length })}</summary>
              <ul>
                {done.map((c) => (
                  <li key={c.key} className={c.outcome === 'note' ? 'note' : undefined}>
                    <span className={c.outcome === 'note' ? 'info' : 'ok'} aria-hidden="true">{c.outcome === 'note' ? 'i' : '✓'}</span>
                    {checkWords(c).line}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="readiness-tile panel" aria-labelledby="readiness-models">
            <h3 id="readiness-models">{T.rail.models}</h3>
            <p>{view.context.step3.applied ? T.rail.modelsFrom : T.checks.step3.note}</p>
            <p className="models">{models.map((m) => m.name).join(', ')}</p>
          </section>

          <section className="readiness-tile panel" aria-labelledby="readiness-counted">
            <h3 id="readiness-counted">{T.rail.counted}</h3>
            <dl className="ledger-list">
              {(['never', 'retired', 'new', 'unread'] as const).filter((e) => view.explained[e] > 0).map((e) => (
                <div key={e} style={{ display: 'contents' }}>
                  <dt>{view.explained[e]}</dt>
                  <dd>
                    <a href={readinessHref('notActive')}>{Cnt[e]}</a>
                    {(e === 'never' || e === 'retired') && planSteps.has('s-check-dormant-accounts') && (
                      <>
                        {' '}
                        <a href={stepHref('s-check-dormant-accounts')}>{Cnt.dormantLink}</a>
                      </>
                    )}
                  </dd>
                </div>
              ))}
              {view.explained.guest > 0 && (
                <div style={{ display: 'contents' }}>
                  <dt>{view.explained.guest}</dt>
                  <dd>{Cnt.guest}</dd>
                </div>
              )}
              {KINDS.filter((k) => view.facts.kinds[k] > 0).map((k) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{view.facts.kinds[k]}</dt>
                  <dd>
                    <a href={readinessHref(k)}>{Cnt[k]}</a>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {guests.active > 0 && (!context || context.stepId === GUEST_STEP_ID) && (
            <section className="readiness-tile panel" aria-labelledby="readiness-guests">
              <h3 id="readiness-guests">{G.title}</h3>
              <p>{fillText(G.count, { n: guests.active })}</p>
              <p>{guests.trust === 'on' ? G.trustOn : guests.trust === 'off' ? G.trustOff : G.trustUnknown}</p>
              {guests.policy !== 'absent' && (
                <p>
                  {guests.policy === 'inPlace' ? G.policyInPlace : G.policyNotInPlace}{' '}
                  {planSteps.has(GUEST_STEP_ID) && <a href={stepHref(GUEST_STEP_ID)}>{G.policyLink}</a>}
                </p>
              )}
              <p className="models">{G.suggestion}</p>
            </section>
          )}

          <section className="readiness-tile panel" aria-labelledby="readiness-evidence">
            <h3 id="readiness-evidence">{T.rail.evidence}</h3>
            <dl className="ledger-list">
              {covered ? (
                partial ? (
                  <div style={{ display: 'contents' }}>
                    <dt>{days}</dt>
                    <dd>{fillText(T.evidence.partial, { from: monthDay(covered.from), to: monthDay(covered.to) })}</dd>
                  </div>
                ) : (
                  <div style={{ display: 'contents' }}>
                    <dt>{days}</dt>
                    <dd>{fillText(T.evidence.full, { from: monthDay(covered.from), to: monthDay(covered.to) })}</dd>
                  </div>
                )
              ) : (
                <div style={{ display: 'contents' }}>
                  <dt>0</dt>
                  <dd>{source?.reason && source.status !== 'ok' ? fillText(app.readiness.lineNoRecordsReason, { reason: source.reason }) : T.evidence.none}</dd>
                </div>
              )}
              {(source?.targeted?.read ?? 0) > 0 && (
                <div style={{ display: 'contents' }}>
                  <dt>{source?.targeted?.read}</dt>
                  <dd>{T.evidence.individually}</dd>
                </div>
              )}
              {notCovered > 0 && (
                <div style={{ display: 'contents' }}>
                  <dt>{notCovered}</dt>
                  <dd>{T.evidence.notCovered}</dd>
                </div>
              )}
              {unreadMethods > 0 && (
                <div style={{ display: 'contents' }}>
                  <dt>{unreadMethods}</dt>
                  <dd>{T.evidence.unreadMethods}</dd>
                </div>
              )}
            </dl>
            {(notCovered > 0 || unreadMethods > 0) && (
              <p>
                <Button variant="secondary" onClick={() => again.run(scan(readinessHref(show)))}>
                  {app.readiness.scanLink}
                </Button>
                {again.error && <span className="quiet" role="status">{again.error}</span>}
              </p>
            )}
          </section>
        </aside>
      </div>

      <div className="footer-note">
        <span>{fillText(T.footer.counted, { active })}</span>
        <span>{T.footer.plan}</span>
        <a href="#/inventory">{T.inventory}</a>
      </div>

      {openRow && (
        <aside className="readiness-panel panel" id={PANEL_ID} role="dialog" aria-modal="false" aria-labelledby="readiness-panel-name">
          <div className="panel-head">
            <div>
              <h2 id="readiness-panel-name">{openRow.user.displayName ?? openRow.user.userPrincipalName}</h2>
              <p>{[openRow.user.userPrincipalName, openRow.admin ? T.admin : '', openRow.user.department ?? ''].filter(Boolean).join(', ')}</p>
              {openRow.state && (
                <span className="panel-state">
                  <span className={`state-dot s-${openRow.state}`} aria-hidden="true" />
                  {stateTitle(openRow.state)}
                </span>
              )}
            </div>
            <button type="button" className="btn btn-secondary" ref={closeRef} onClick={close}>
              {T.panel.close}
            </button>
          </div>
          <section>
            <h3>{T.panel.next}</h3>
            <div className="todo">
              <strong>{nextCell(openRow)}</strong>
              <p>{whyLine(openRow)}</p>
              {rowNote(openRow) && <p>{rowNote(openRow)}</p>}
            </div>
          </section>
          <section>
            <h3>{T.panel.devices}</h3>
            {panelList(panelDevices(openRow), T.panel.noDevices)}
          </section>
          <section>
            <h3>{T.panel.methods}</h3>
            {panelList(panelMethods(openRow), T.panel.noneRegistered)}
          </section>
        </aside>
      )}
    </section>
  )
}
