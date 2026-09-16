import type { Step } from '../../roadmap/types.ts'
import { reached } from '../../derive/population.ts'
// MFA Readiness (task 012; Step 7): who can meet phishing-resistant MFA, what
// IAMAI can actually prove, and what each person needs next.
//
// The visual and interaction authority is
// docs/design/approved/reference/iamai-mfa-readiness-final.html: one summary
// panel (the answer, and three counts that are filters), one strip for the Plan
// gate and the passkey rollout, the search and the filter pills, the six-zone
// worklist (Person / Role / Methods / Proof / Readiness / Action), a footer note,
// and a detail one level deep that answers Why and Next. It owns none of the
// words (pages.readiness) and none of the truth.
//
// The truth is one derivation. Every person's state, methods, proof and next
// action is scoring/phishingResistant.ts `personReadiness`, carried on the row
// by derive/mfaReadiness.ts; the cells are surfaces/readinessCells.ts. The
// summary counts are derive/facts.ts over the same partition the rows come from,
// and the passkey strip is counted from those rows. The Plan
// gate strip is roadmap/readiness.ts — the function the Plan's own 90% gate
// reads — over the same scored people, so "N of M must be Ready" and the step's
// "reaches 90% (now X%)" are the same measurement. Nothing here reads a method,
// a sign-in or a percentage a second time.
//
// Passkeys are promoted without becoming the requirement: No passkey is a filter
// and the rollout strip counts them, and somebody Ready without one gets a
// recommended action that never moves them out of Ready.
//
// The Plan handoff: #/readiness/step/<id> scopes the worklist to the people one
// step is waiting on (derive/stepMfaReadiness.ts). The hash carries the step's
// id and nothing else; who it reaches is resolved from the plan computed here.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import { DEFAULT_SHOW, SHOW_KEYS, SUMMARY_STATES, readinessView, showKeyOf, shows } from '../../derive/mfaReadiness.ts'
import type { ReadinessRow, ShowKey } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { goalFamily, readinessFor } from '../../roadmap/readiness.ts'
import type { ReadinessState } from '../../scoring/phishingResistant.ts'
import { app, pages } from '../../content/content.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import { actionOf, detailOf, footerParts, methodsCell, passkeyStripParts, proofLabel, proofLines, readinessWord, recommendedWord, roleWord, searchText, showWord, stateTitle } from './readinessCells.ts'
import type { ProofMark } from './readinessCells.ts'
import { READINESS_CSV } from './inventoryTables.ts'
import { useAppliedMapping, usePlanData } from './planData.ts'
import { readinessHref, showFromReadinessHash, stepFromReadinessHash } from '../shell/routes.ts'
import { Button, DataTable } from '../components/index.ts'
import type { Column } from '../components/index.ts'
import { scan } from '../actions.ts'
import { useAction } from '../useAction.ts'

type PageWords = {
  h1: string
  eyebrow: string
  lead: string
  summaryLabel: string
  summaryEyebrow: string
  summary: string
  summaryNone: string
  /** The headline where the gate could not be measured: no sign-in proof was read (never "0 of N"). */
  summaryUnmeasured: string
  summarySub: string
  states: Record<ReadinessState, { title: string; stat?: string; hint?: string; aria?: string }>
  strip: { label: string; gate: string; gateLine: string; gateMore: string; gateMet: string; gateNotMeasured: string; gateLink: string; rollout: string; rolloutLine: string; rolloutWithout: string; rolloutNone: string }
  search: string
  columns: string[]
  signInAddress: string
  guest: string
  empty: string
  footerLead: string
  inventory: string
  detail: { eyebrow: string; close: string; why: string; next: string; scanAgain: string }
  planContext: { filtered: string; unknown: string; back: string }
}
const T = pages.readiness as unknown as PageWords
const S = T.strip
const C = app.readiness

/** The shared status role's tone for each state (app.css `.status`): the word is always beside the dot. */
const STATUS_TONE: Record<ReadinessState, 'ok' | 'wait' | 'stop' | 'idle'> = { ready: 'ok', needsProof: 'wait', needsSetup: 'stop', unknown: 'idle' }
/** The glyph beside a proof line. It is `aria-hidden`: the line's own words say what it marks. */
const MARK: Record<ProofMark, string> = { good: '✓', warn: '?', bad: '×', unknown: '?', history: '!' }

const stepHref = (stepId: string): string => `#/plan/${encodeURIComponent(stepId)}`

/** The one detail on the page: every row action that opens it names it. */
const DETAIL_ID = 'readiness-detail'

/** The Plan step this page is scoped to: the people it is waiting on, or null where this scan could not settle who. */
type PlanContext = { title: string; stepId: string; goalId: string; ids: string[] | null; preparation?: Step['preparation'] & { unknownIds?: string[] } }

export function MfaReadiness({ scan: lastScan, baseline }: { scan: { snapshot: TenantSnapshot; at: string } | null; baseline: BaselineResult | null }) {
  const [stepId, setStepId] = useState<string | null>(() => stepFromReadinessHash(window.location.hash))
  useEffect(() => {
    const onHash = () => setStepId(stepFromReadinessHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // The plan, computed read-only exactly as Connect's Plan tile does: the step
  // a scoped page names, and the step the gate strip links to.
  const data = usePlanData(lastScan, baseline, true)
  const steps = data.computed?.steps ?? []
  const scored = data.computed?.viability ?? []
  const step = stepId === null ? null : (steps.find((s) => s.id === stepId) ?? null)
  const hold = step && data.computed ? stepMfaHold(step, scored) : null
  const method = step?.methodPreparation
  const preparation = method?.completeScope ? { ids: method.ids, readyIds: method.readyIds, missingIds: method.ids.filter(id => !method.readyIds.includes(id)), unknownIds: method.unknownIds } : step?.preparation
  const context: PlanContext | null = step && (preparation || method || hold || step.id === 's-verify-mfa') ? { title: contentTitle(step), stepId: step.id, goalId: step.id === 's-verify-mfa' ? 'mfa-all-users' : step.goalId, ids: preparation?.ids ?? (method && !method.completeScope ? null : reached(step)?.ids ?? null), preparation } : null
  // Link the overview to preparation without presenting its tenant-wide metric as a policy rollout gate.
  const gateStepId = context?.stepId ?? steps.find(s => s.id === 's-verify-mfa')?.id ?? steps.find(s => s.goalId === 'mfa-all-users')?.id ?? null
  return <ReadinessPage snapshot={lastScan?.snapshot ?? null} context={context} gateStepId={gateStepId} />
}

function ReadinessPage({ snapshot, context, gateStepId }: { snapshot: TenantSnapshot | null; context: PlanContext | null; gateStepId: string | null }) {
  // The population's mapping (the detected emergency and service accounts, and every saved decision): the Plan's and Connect's.
  const mapping = useAppliedMapping(snapshot)
  const again = useAction()
  const view = useMemo(() => (snapshot && mapping ? readinessView(snapshot, snapshot.asOf, mapping) : null), [snapshot, mapping])
  // The Plan's own MFA gate measurement, over the same scored people the rows are (roadmap/readiness.ts).
  const gate = useMemo(() => (snapshot && view ? readinessFor(context?.goalId ?? 'mfa-all-users', context?.ids ?? [...view.ladder.viability.keys()], [...view.ladder.viability.values()], snapshot) : null), [snapshot, view, context?.goalId, context?.ids])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<ShowKey>(() => showKeyOf(showFromReadinessHash(window.location.hash)) ?? DEFAULT_SHOW)
  // The detail is held by the account id the row carries, never the display name.
  const [openId, setOpenId] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  // The control the detail was opened from, so closing it puts focus back there.
  const trigger = useRef<HTMLElement | null>(null)
  const toolbar = useRef<HTMLDivElement>(null)
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
  // A scan that changes who is listed closes the detail rather than leaving it over an account that is gone.
  const openRow = openId === null ? null : (view?.rows.find((r) => r.user.id === openId) ?? null)
  const detail = openRow ? detailOf(openRow) : null
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (detail && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!detail && d.open) d.close()
  }, [detail])
  const close = (): void => {
    setOpenId(null)
    trigger.current?.focus()
  }
  const q = query.trim().toLowerCase()
  const scoped = context?.ids ? new Set(context.ids) : null
  const rows = useMemo(
    () => (view?.rows ?? []).filter((r) => (!context || (scoped !== null && scoped.has(r.user.id))) && (context?.preparation && show === 'needsAction' ? context.preparation.missingIds.includes(r.user.id) : context?.preparation && show === 'ready' ? context.preparation.readyIds.includes(r.user.id) : context?.preparation && show === 'all' ? true : context?.preparation && show === 'admins' ? r.admin : shows(r, show)) && (!q || searchText(r).includes(q))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, show, q, context?.ids, context?.preparation],
  )

  const heading = (
    <>
      <div className="eyebrow">{T.eyebrow}</div>
      <h1 className="display">{T.h1}</h1>
    </>
  )
  if (!view) {
    return (
      <section className="surface readiness">
        {heading}
        <p className="reason">{app.shell.loading}</p>
      </section>
    )
  }
  const cohortRows = context ? view.rows.filter(row => scoped?.has(row.user.id)) : view.rows
  const countedRows = context?.preparation ? cohortRows : cohortRows.filter(row => row.state !== null)
  const facts = context ? { ...view.facts, active: countedRows.length } : view.facts
  const counts = scoped ? Object.fromEntries(Object.keys(view.counts).map(key => [key, countedRows.filter(row => row.state === key).length])) as typeof view.counts : view.counts
  const passkeys = scoped ? { have: countedRows.filter(row => row.readiness?.hasPasskey === true).length, without: countedRows.filter(row => row.readiness?.hasPasskey === false).length, unread: countedRows.filter(row => row.readiness?.hasPasskey == null).length } : view.passkeys
  // A gate this scan could not measure is not "0 of N are Ready": nobody's proof
  // was read, which is Unknown for everyone rather than Ready for no one.
  const summary = context && context.ids === null ? 'Resolve this step’s policy scope to identify the people who need preparation.' : context?.preparation ? `${context.preparation.readyIds.length} of ${context.preparation.ids.length} people have a method ready for this step` : facts.active === 0 ? T.summaryNone : gate?.unmeasured === 'unreadable' ? fillText(T.summaryUnmeasured, { active: facts.active }) : fillText(T.summary, { ready: counts.ready, active: facts.active })
  const more = context?.preparation ? context.preparation.missingIds.length : Math.max(0, facts.active - counts.ready)
  const unknownMethods = context?.preparation?.unknownIds?.length ?? 0
  const setupNeeded = Math.max(0, more - unknownMethods)
  // Keep unknown compatibility separate from a known setup defect.
  const gateValue = context?.preparation ? (more > 0 ? [setupNeeded > 0 ? `${setupNeeded} need method setup` : '', unknownMethods > 0 ? `${unknownMethods} need a compatibility check` : ''].filter(Boolean).join(' · ') : 'Required methods are ready') : gate?.unmeasured === 'unreadable' ? S.gateNotMeasured : more > 0 ? fillText(S.gateMore, { n: more }) : S.gateMet
  const source = snapshot?.sources.signInEvidence
  const records = source?.coveredWindow ? fillText(C.lineRecords, { from: monthDay(source.coveredWindow.from), to: monthDay(source.coveredWindow.to) }) : source?.status === 'disabled' && source.reason ? fillText(C.lineNoRecordsReason, { reason: source.reason }) : C.lineNoRecords
  const parts = context ? [] : footerParts(facts)
  const rollout = passkeyStripParts(passkeys)
  // The toolbar's filters; a link that arrived on a population the toolbar does not offer keeps its own pill, so the control still says what is on screen.
  const pills: ShowKey[] = context?.preparation ? ['needsAction', 'ready', 'all', 'admins', 'noPasskey'] : SHOW_KEYS.includes(show) || (SUMMARY_STATES as readonly string[]).includes(show) ? [...SHOW_KEYS] : [...SHOW_KEYS, show]

  const columns: Column<ReadinessRow>[] = [
    {
      key: 'person',
      header: T.columns[0],
      minWidth: '12rem',
      csv: (r) => r.user.displayName ?? r.user.userPrincipalName ?? '',
      // The name over the sign-in address; `.tenant-object` lets a long address break inside its column.
      render: (r) => (
        <>
          <strong className="person-name">{r.user.displayName ?? r.user.userPrincipalName}</strong>
          {r.user.displayName && r.user.userPrincipalName && <span className="person-upn tenant-object">{r.user.userPrincipalName}</span>}
        </>
      ),
    },
    { key: 'upn', header: T.signInAddress, hidden: true, render: () => null, csv: (r) => r.user.userPrincipalName ?? '' },
    { key: 'role', header: T.columns[1], csv: (r) => roleWord(r), render: (r) => <span className="role">{r.guest ? `${roleWord(r)} · ${T.guest}` : roleWord(r)}</span> },
    {
      key: 'methods',
      header: T.columns[2],
      minWidth: '9rem',
      csv: (r) => methodsCell(r).main,
      render: (r) => {
        const m = methodsCell(r)
        return (
          <>
            <strong className="methods-main">{m.main}</strong>
            {m.note && <span className="methods-note">{m.note}</span>}
          </>
        )
      },
    },
    {
      key: 'proof',
      header: T.columns[3],
      minWidth: '11rem',
      csv: (r) => proofLines(r).map(proofLabel).join('; '),
      render: (r) => (
        <ul className="proof-lines">
          {proofLines(r).map((l, i) => (
            <li key={i} className="proof-line">
              <span className={`proof-mark proof-mark-${l.mark}`} aria-hidden="true">
                {MARK[l.mark]}
              </span>
              <span>{proofLabel(l)}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'readiness',
      header: context?.preparation ? 'Preparation' : T.columns[4],
      csv: (r) => context?.preparation ? (context.preparation.readyIds.includes(r.user.id) ? 'Method Ready' : context.preparation.unknownIds?.includes(r.user.id) ? 'Check Compatibility' : 'Method Needed') : readinessWord(r),
      render: (r) => context?.preparation ? <span>{context.preparation.readyIds.includes(r.user.id) ? 'Method Ready' : context.preparation.unknownIds?.includes(r.user.id) ? 'Check Compatibility' : 'Method Needed'}</span> : (r.state !== null ? <span className={`status status-${STATUS_TONE[r.state]}`}>{stateTitle(r.state)}</span> : <span className="not-person">{readinessWord(r)}</span>),
    },
    {
      key: 'action',
      header: T.columns[5],
      csv: (r) => context?.preparation ? (context.preparation.missingIds.includes(r.user.id) ? (context.preparation.unknownIds?.includes(r.user.id) ? 'Review method compatibility in the plan step' : 'Register a method accepted by this step') : '') : actionOf(r)?.text ?? '',
      render: (r) => {
        if (context?.preparation?.unknownIds?.includes(r.user.id)) return <a href={stepHref(context.stepId)}>Review method compatibility in the plan step</a>
        if (context?.preparation) return context.preparation.missingIds.includes(r.user.id) ? <a href="https://mysignins.microsoft.com/security-info" target="_blank" rel="noreferrer">Register a method accepted by this step</a> : <span className="no-action" aria-hidden="true">&mdash;</span>
        const a = actionOf(r)
        // Nothing to do: the reference's em rule, a mark and not a word.
        if (!a) return <span className="no-action" aria-hidden="true">&mdash;</span>
        return (
          <>
            <Button
              variant="tertiary"
              className={`row-action${a.recommended ? ' recommended' : ''}`}
              aria-haspopup="dialog"
              aria-controls={DETAIL_ID}
              onClick={(e) => {
                trigger.current = e.currentTarget
                setOpenId(r.user.id)
              }}
            >
              {a.text}
              <span aria-hidden="true"> →</span>
            </Button>
            {a.recommended && <span className="rec-label">{recommendedWord()}</span>}
          </>
        )
      },
    },
  ]

  return (
    <section className="surface readiness">
      {heading}
      <p className="line intro">{T.lead}</p>
      <section className="readiness-summary panel" aria-label={T.summaryLabel}>
        <div className="summary-main">
          <div className="eyebrow">{T.summaryEyebrow}</div>
          <p className="headline display">{summary}</p>
          {facts.active > 0 && <p className="sub">{context?.preparation ? "Registration is checked against this step’s authentication requirements. Sign-in evidence is shown separately." : T.summarySub}</p>}
        </div>
        {!context?.preparation && (!context || context.ids !== null) && SUMMARY_STATES.map((s) => (
          <button key={s} type="button" className="summary-stat" aria-pressed={show === s} aria-label={T.states[s].aria} onClick={() => select(show === s ? DEFAULT_SHOW : s)}>
            <span className="stat-n">{counts[s]}</span>
            <span className="stat-k">{T.states[s].stat}</span>
            <span className="stat-hint">{T.states[s].hint}</span>
          </button>
        ))}
      </section>
      {facts.active > 0 && (
        <section className="progress-strip" aria-label={S.label}>
          <div className="progress-item">
            <div className="progress-label">
              <strong>{context?.preparation ? "Team Preparation" : S.gate}</strong>
              <span>{context?.preparation ? "Register a suitable method for each person in this step." : fillText(S.gateLine, { ready: counts.ready, active: facts.active })}</span>
            </div>
            <div className="progress-value">
              {gateValue}
              {gateStepId && (
                <>
                  {' · '}
                  <a href={stepHref(gateStepId)}>{context ? 'Back to this step →' : S.gateLink}</a>
                </>
              )}
            </div>
          </div>
          <div className="progress-item">
            <div className="progress-label">
              <strong>{S.rollout}</strong>
              <span>{fillText(S.rolloutLine, { have: passkeys.have, active: facts.active })}</span>
            </div>
            <div className="progress-value">
              {rollout.without !== null && (
                <a
                  href={readinessHref('noPasskey')}
                  onClick={(e) => {
                    e.preventDefault()
                    select('noPasskey')
                    toolbar.current?.scrollIntoView({ block: 'center' })
                  }}
                >
                  {rollout.without}
                </a>
              )}
              {rollout.rest.map((part, i) => (
                <span key={i}>
                  {(rollout.without !== null || i > 0) && ' · '}
                  {part}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
      {context && (
        <p className="line scope-line">
          {context.ids === null ? fillText(T.planContext.unknown, { step: context.title }) : fillText(T.planContext.filtered, { n: context.ids.length, step: context.title })}{' '}
          <a href={stepHref(context.stepId)}>{T.planContext.back}</a>
        </p>
      )}
      <div className="toolbar no-print" ref={toolbar}>
        <input type="search" placeholder={T.search} aria-label={T.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        {pills.map((k) => (
          <Button key={k} variant="tertiary" className="pill" aria-pressed={show === k} onClick={() => select(k)}>
            {context?.preparation && k === 'ready' ? 'Method Ready' : showWord(k)}
          </Button>
        ))}
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.user.id} csvName={READINESS_CSV} empty={T.empty} panel stacked />
      <div className="footer-note">
        <p className="line ledger">
          {parts.length > 0 && (
            <>
              {fillText(T.footerLead, { active: facts.active })}{' '}
              {parts.map((part, i) => (
                <span key={part.key}>
                  {i > 0 && ' · '}
                  <a href={readinessHref(part.show)}>{part.text}</a>
                </span>
              ))}{' '}
            </>
          )}
          <span className="quiet">{records}</span>
        </p>
        {/* The one way on to the raw tables the scan read: Inventory has no header tab. */}
        <p className="footer-link">
          <a href="#/inventory">{T.inventory}</a>
        </p>
      </div>
      <dialog
        ref={dialog}
        className="readiness-detail panel"
        id={DETAIL_ID}
        aria-labelledby="readiness-detail-title"
        onClose={() => {
          if (openId !== null) close()
        }}
      >
        {detail && (
          <>
            <div className="dialog-head">
              <div>
                <div className="eyebrow">{T.detail.eyebrow}</div>
                <h2 id="readiness-detail-title">{detail.title}</h2>
              </div>
              <Button variant="secondary" onClick={close}>
                {T.detail.close}
              </Button>
            </div>
            <div className="dialog-body">
              <div className="detail-block">
                <h3 className="key-label">{T.detail.why}</h3>
                {detail.why.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
              <div className="detail-block">
                <h3 className="key-label">{T.detail.next}</h3>
                {detail.next.map((n, i) => (
                  <p key={i} className={i === 0 ? 'detail-action' : 'detail-recommend'}>
                    {n}
                  </p>
                ))}
                {detail.rescan && (
                  <p className="detail-scan">
                    <Button variant="secondary" onClick={() => again.run(scan(readinessHref(show)))}>
                      {T.detail.scanAgain}
                    </Button>
                    {again.error && <span className="quiet" role="status">{again.error}</span>}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </dialog>
    </section>
  )
}
