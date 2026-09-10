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
import { goalFamily, readinessFor, readyNeeded } from '../../roadmap/readiness.ts'
import { READINESS_THRESHOLD_MFA_PERCENT } from '../../roadmap/constants.ts'
import type { ReadinessState } from '../../scoring/phishingResistant.ts'
import { app, pages } from '../../content/content.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import { actionOf, detailOf, footerParts, methodsCell, proofLines, readinessWord, recommendedWord, roleWord, searchText, showWord, stateTitle } from './readinessCells.ts'
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
type PlanContext = { title: string; stepId: string; ids: string[] | null }

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
  const context: PlanContext | null = step && hold ? { title: contentTitle(step), stepId: step.id, ids: hold.ids } : null
  // The step the 90% MFA gate holds, where the plan holds one; Require MFA for Everyone otherwise, where the plan has it.
  const gateStepId = useMemo(() => {
    const all = data.computed?.steps ?? []
    const held = all.find((s) => goalFamily(s.goalId) === 'mfa' && s.action.readinessGate)
    return (held ?? all.find((s) => s.goalId === 'mfa-all-users'))?.id ?? null
  }, [data.computed])
  return <ReadinessPage snapshot={lastScan?.snapshot ?? null} context={context} gateStepId={gateStepId} />
}

function ReadinessPage({ snapshot, context, gateStepId }: { snapshot: TenantSnapshot | null; context: PlanContext | null; gateStepId: string | null }) {
  // The population's mapping (the detected emergency and service accounts, and every saved decision): the Plan's and Connect's.
  const mapping = useAppliedMapping(snapshot)
  const again = useAction()
  const view = useMemo(() => (snapshot && mapping ? readinessView(snapshot, snapshot.asOf, mapping) : null), [snapshot, mapping])
  // The Plan's own MFA gate measurement, over the same scored people the rows are (roadmap/readiness.ts).
  const gate = useMemo(() => (snapshot && view ? readinessFor('mfa-all-users', [...view.ladder.viability.keys()], [...view.ladder.viability.values()], snapshot) : null), [snapshot, view])
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
    () => (view?.rows ?? []).filter((r) => (!scoped || scoped.has(r.user.id)) && shows(r, show) && (!q || searchText(r).includes(q))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, show, q, context?.ids],
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
  const { facts, counts, passkeys } = view
  const summary = facts.active > 0 ? fillText(T.summary, { ready: counts.ready, active: facts.active }) : T.summaryNone
  const required = facts.active > 0 ? readyNeeded(facts.active, READINESS_THRESHOLD_MFA_PERCENT) : 0
  const more = Math.max(0, required - counts.ready)
  // A gate the scan could not measure is not stated as a shortfall (Step 7).
  const gateValue = gate?.unmeasured === 'unreadable' ? S.gateNotMeasured : more > 0 ? fillText(S.gateMore, { n: more }) : S.gateMet
  const source = snapshot?.sources.signInEvidence
  const records = source?.coveredWindow ? fillText(C.lineRecords, { from: monthDay(source.coveredWindow.from), to: monthDay(source.coveredWindow.to) }) : source?.status === 'disabled' && source.reason ? fillText(C.lineNoRecordsReason, { reason: source.reason }) : C.lineNoRecords
  const parts = footerParts(facts)
  // The toolbar's filters; a link that arrived on a population the toolbar does not offer keeps its own pill, so the control still says what is on screen.
  const pills: ShowKey[] = SHOW_KEYS.includes(show) || (SUMMARY_STATES as readonly string[]).includes(show) ? [...SHOW_KEYS] : [...SHOW_KEYS, show]

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
      csv: (r) => proofLines(r).map((l) => l.text).join('; '),
      render: (r) => (
        <ul className="proof-lines">
          {proofLines(r).map((l, i) => (
            <li key={i} className="proof-line">
              <span className={`proof-mark proof-mark-${l.mark}`} aria-hidden="true">
                {MARK[l.mark]}
              </span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'readiness',
      header: T.columns[4],
      csv: (r) => readinessWord(r),
      render: (r) => (r.state !== null ? <span className={`status status-${STATUS_TONE[r.state]}`}>{stateTitle(r.state)}</span> : <span className="not-person">{readinessWord(r)}</span>),
    },
    {
      key: 'action',
      header: T.columns[5],
      csv: (r) => actionOf(r)?.text ?? '',
      render: (r) => {
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
          {facts.active > 0 && <p className="sub">{T.summarySub}</p>}
        </div>
        {SUMMARY_STATES.map((s) => (
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
              <strong>{S.gate}</strong>
              <span>{fillText(S.gateLine, { required, active: facts.active })}</span>
            </div>
            <div className="progress-value">
              {gateValue}
              {gateStepId && (
                <>
                  {' · '}
                  <a href={stepHref(gateStepId)}>{S.gateLink}</a>
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
              {passkeys.without > 0 ? (
                <a
                  href={readinessHref('noPasskey')}
                  onClick={(e) => {
                    e.preventDefault()
                    select('noPasskey')
                    toolbar.current?.scrollIntoView({ block: 'center' })
                  }}
                >
                  {fillText(S.rolloutWithout, { n: passkeys.without })}
                </a>
              ) : (
                S.rolloutNone
              )}
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
            {showWord(k)}
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
