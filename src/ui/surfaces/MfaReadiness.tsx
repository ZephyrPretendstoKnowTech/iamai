// MFA Readiness (task 012): the surface that replaced Today.
//
// One job, and the page is arranged around it — see who is ready for passkeys,
// who still needs to prove one, and who still needs a stronger method. So it is
// a heading, one sentence, one summary of the active people, three counts under
// it, one filter row and one table. It is diagnostic before it is operational:
// the answer should be readable without opening a row.
//
// What it is not: the old five-tile ladder page. The rung a person stands on is
// still the truth and still shows, as the badge in their row and in the tooltip
// on it — Connect's Plan tile still links here filtered to a rung, and that
// filter still works. What the page counts is the three groupings
// (derive/mfaReadiness.ts), because "which of the five rungs is everyone on" is
// a different question from "who still needs a passkey".
//
// Every number is derive/facts.ts and derive/mfaReadiness.ts over the
// population's mapping (planData.ts useAppliedMapping), the same facts the Plan
// and Connect read, so the three surfaces cannot disagree.
//
// Remediation (task 014) is the operational half, and it stays behind a click:
// a person's Next step is a button, and the guidance for the method they need
// opens in one panel under the table. The guidance itself is
// content/methodGuides.ts over shared.methodGuides — the same lines the help
// desk copies and the campaign step's email points at — and which guide a
// person is offered follows their group, which is task 002's evidence and not a
// second reading of it. Nothing here proves a method or moves a rung.
//
// The Plan handoff: #/readiness/step/<id> filters to the people one step is
// waiting on. The hash carries the step's id and nothing else; who it reaches is
// resolved here from the plan this page computes, over the same rows the table
// shows (derive/stepMfaReadiness.ts). The counts above the table stay the whole
// tenant's — the callout says what the filter is.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { Rung } from '../../derive/ladder.ts'
import { READINESS_GROUPS, SHOW_KEYS, showKeyOf, shows, readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessGroup, ReadinessRow, ShowKey } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { app, pages } from '../../content/content.ts'
import { PASSKEY_TARGET, TENANT_PREREQUISITE, guideText, methodGuide, remediationFor } from '../../content/methodGuides.ts'
import type { MethodGuideId, Remediation } from '../../content/methodGuides.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import { groupWords, kindWord, ledgerParts, methodWord, nextStateWord, notActiveWord, readinessWord, rowEvidenceText, rungWords, showWord } from './readinessCells.ts'
import { READINESS_CSV } from './inventoryTables.ts'
import { useAppliedMapping, usePlanData } from './planData.ts'
import { readinessHref, showFromReadinessHash, stepFromReadinessHash } from '../shell/routes.ts'
import { Button, Callout, DataTable, InfoTip, PageTip } from '../components/index.ts'
import type { Column } from '../components/index.ts'
import { REDACTED, exportClipboard } from '../exportGuard.ts'
import { scan } from '../actions.ts'
import { useAction } from '../useAction.ts'
import { W as CONNECT_WORDS } from '../scan/connectView.ts'

type ReadinessCopy = {
  h1: string
  lead: string
  summary: string
  summaryNone: string
  adminsOnly: string
  columns: string[]
  notAPerson: string
  separate: string
  unknownMethods: string
  inventory: string
  tip: string
  planContext: { filtered: string; unknown: string; back: string }
  remediation: { heading: string; choose: string; other: string; copy: string; copied: string; close: string; learn: string }
}
const T = pages.readiness as unknown as ReadinessCopy
const C = app.readiness

/**
 * The rung's badge: the number in the rung's colour, its title as the
 * accessible name; a grey dash where nothing is set up on an uncounted account.
 *
 * `role="img"` is what makes the label carry (task 017): `aria-label` on a bare
 * span is ignored by most assistive technology, so the badge read as the bare
 * digit "3" beside the group word instead of the rung it names.
 */
function RungBadge({ rung }: { rung: Rung | null }) {
  return (
    <span className={`rung-badge rung-${rung ?? 0}`} role={rung ? 'img' : undefined} title={rung ? rungWords(rung).title : undefined} aria-label={rung ? rungWords(rung).title : undefined}>
      {rung ?? '–'}
    </span>
  )
}

/**
 * The Plan step this page is scoped to, once the plan has computed: the people
 * it is waiting on, resolved from the rows on screen.
 *
 * `ids: null` is unknown reach and stays unknown — a step whose readiness this
 * scan could not measure shows the callout with no number and no filter, never
 * an empty table claiming nobody is affected.
 */
type PlanContext = { title: string; stepId: string; ids: string[] | null }

export function MfaReadiness({ scan: lastScan, baseline }: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
}) {
  const [stepId, setStepId] = useState<string | null>(() => stepFromReadinessHash(window.location.hash))
  useEffect(() => {
    const onHash = () => setStepId(stepFromReadinessHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  if (!lastScan) return <ReadinessPage snapshot={null} context={null} />
  // One page implementation. The step context is the only thing the wrapper
  // adds, and it computes the plan read-only (never touching the plan record)
  // exactly as Connect's Plan tile does.
  return stepId === null ? (
    <ReadinessPage snapshot={lastScan.snapshot} context={null} />
  ) : (
    <ReadinessForStep scan={lastScan} baseline={baseline} stepId={stepId} />
  )
}

function ReadinessForStep({ scan: lastScan, baseline, stepId }: {
  scan: { snapshot: TenantSnapshot; at: string }
  baseline: BaselineResult | null
  stepId: string
}) {
  const data = usePlanData(lastScan, baseline, true)
  const snapshot = lastScan.snapshot
  const step = data.computed?.steps.find((s) => s.id === stepId) ?? null
  // The plan's own scoring, the one the readiness percentage that holds the step
  // was taken over (planData.ts): the people it names cannot disagree with it.
  const hold = step && data.computed ? stepMfaHold(step, data.computed.viability) : null
  // No callout where there is no relationship: a step that is not on this plan,
  // or one nothing about anybody's authentication method is holding.
  const context: PlanContext | null = step && hold ? { title: contentTitle(step), stepId: step.id, ids: hold.ids } : null
  return <ReadinessPage snapshot={snapshot} context={context} />
}

/**
 * Who the panel is open for and which guide is showing. The person is held by
 * the account id the row already carries — the display name is shown and never
 * relied on, so a rename or two people with the same name cannot move guidance
 * onto the wrong account.
 */
type OpenGuide = { userId: string; guideId: MethodGuideId | null }

/** The one remediation panel on the page: the row control that opens it names it. */
const GUIDE_PANEL_ID = 'readiness-guide-panel'

/** The guide's title as a choice: pressed shows it, pressed again puts it away. */
function GuideChoice({ id, on, onPick }: { id: MethodGuideId; on: boolean; onPick: (id: MethodGuideId | null) => void }) {
  return (
    <Button variant="tertiary" aria-pressed={on} onClick={() => onPick(on ? null : id)}>
      {methodGuide(id).title}
    </Button>
  )
}

/**
 * The remediation panel: one person, the action their evidence earns, and the
 * guidance for it.
 *
 * It reads `row.group` and asks content/methodGuides.ts what that group is
 * offered. It never looks at the methods, the records or the rung itself, so it
 * cannot come to a different answer from the table above it: somebody the page
 * calls "Needs proof" is asked to use what they already hold, never to register
 * a second passkey.
 *
 * The two guides that do not reach the page's target stand under their own line
 * (a Temporary Access Pass is a way in; Windows Hello for Business works on one
 * PC). They are offered, and they are not offered as finishing the job.
 *
 * It passes the row itself, because whether a guide applies is also the person:
 * a guest's methods are their home tenant's, so this tenant cannot issue them a
 * Temporary Access Pass and the panel says so instead of offering one.
 */
function RemediationPanel({ row, guideId, onPick, onClose }: {
  row: ReadinessRow
  guideId: MethodGuideId | null
  onPick: (id: MethodGuideId | null) => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const R = T.remediation
  const r: Remediation = remediationFor(row.group, row)
  if (r.kind === 'none' || r.kind === 'unknown') return null
  const guide = guideId === null ? null : methodGuide(guideId)
  const name = row.user.displayName ?? row.user.userPrincipalName ?? ''
  const copy = (): void => {
    if (!guide) return
    void exportClipboard(guideText(guide.id), REDACTED).then((ok) => {
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <section className="guide-panel card" id={GUIDE_PANEL_ID} tabIndex={-1}>
      <h3>{fillText(R.heading, { name })}</h3>
      <p className="reason">{PASSKEY_TARGET}</p>
      {r.kind === 'setUp' && (
        <>
          <p className="reason">{TENANT_PREREQUISITE}</p>
          <p className="line">{R.choose}</p>
          <p className="actions">{r.guides.map((id) => <GuideChoice key={id} id={id} on={id === guideId} onPick={onPick} />)}</p>
          <p className="line">{R.other}</p>
          <p className="actions">{r.other.map((id) => <GuideChoice key={id} id={id} on={id === guideId} onPick={onPick} />)}</p>
          {/* Why a choice the panel would otherwise offer is absent: a guest gets
              no Temporary Access Pass from this tenant. The sentence is the one
              the campaign step already carries (shared.methodGuides.guest). */}
          {r.note && <p className="reason">{r.note}</p>}
        </>
      )}
      {guide && (
        <div className="guide">
          <h4>{guide.title}</h4>
          <ol className="sections">{guide.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
          <p className="line">
            <a href={guide.learn.url} target="_blank" rel="noopener noreferrer">
              {R.learn}
            </a>
          </p>
          {/* The help desk gets the words on screen, not a second version of
              them: the copied text is this guide, and it carries no name. */}
          <p className="actions">
            <Button variant="secondary" onClick={copy}>
              {copied ? R.copied : R.copy}
            </Button>
          </p>
        </div>
      )}
      <p className="actions">
        <Button variant="tertiary" onClick={onClose}>
          {R.close}
        </Button>
      </p>
    </section>
  )
}

function ReadinessPage({ snapshot, context }: { snapshot: TenantSnapshot | null; context: PlanContext | null }) {
  // The population's mapping (the detected emergency and service accounts, and every saved decision): the Plan's and Connect's.
  const mapping = useAppliedMapping(snapshot)
  // Scan again, beside the heading (ui/actions.ts): the scan's line shows under the header, and it returns here with the filter kept.
  const again = useAction()
  const view = useMemo(() => (snapshot && mapping ? readinessView(snapshot, snapshot.asOf, mapping) : null), [snapshot, mapping])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<ShowKey>(() => showKeyOf(showFromReadinessHash(window.location.hash)) ?? 'all')
  const [adminsOnly, setAdminsOnly] = useState(false)
  // The remediation panel: closed until a person's Next step is pressed, so the
  // page's first screen stays the diagnostic it was built as.
  const [open, setOpen] = useState<OpenGuide | null>(null)
  // The control the panel was opened from, so Close puts focus back on it
  // instead of dropping it on the body at the top of the page.
  const trigger = useRef<HTMLElement | null>(null)
  const closeGuide = (): void => {
    setOpen(null)
    trigger.current?.focus()
  }
  useEffect(() => {
    const onHash = () => setShow(showKeyOf(showFromReadinessHash(window.location.hash)) ?? 'all')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const select = (key: ShowKey): void => {
    setShow(key)
    // A step-scoped view keeps its hash: the scope is what the URL means, and a
    // filter inside it narrows what is already narrowed. Leaving the scope is a
    // link (the quiet line below the table), which is navigation, not a filter.
    if (!context) window.history.replaceState(null, '', readinessHref(key))
  }
  const source = snapshot?.sources.signInEvidence
  const window_ = source?.coveredWindow ? fillText(C.lineRecords, { from: monthDay(source.coveredWindow.from), to: monthDay(source.coveredWindow.to) }) : source?.status === 'disabled' && source.reason ? fillText(C.lineNoRecordsReason, { reason: source.reason }) : C.lineNoRecords
  // A Plan step's people are a filter over the same rows, never a set of their
  // own: the ids came from these rows in the first place.
  const scoped = context?.ids ? new Set(context.ids) : null
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (view?.rows ?? []).filter(
      (r) =>
        (!scoped || scoped.has(r.user.id)) &&
        shows(r, show) &&
        (!adminsOnly || r.admin) &&
        (!q || `${r.user.displayName ?? ''} ${r.user.userPrincipalName ?? ''} ${methodWord(r.method)}`.toLowerCase().includes(q)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, query, show, adminsOnly, context?.ids])

  const columns: Column<ReadinessRow>[] = [
    {
      key: 'account',
      header: T.columns[0],
      minWidth: '14rem',
      sortValue: (r) => (r.user.displayName ?? r.user.userPrincipalName ?? '').toLowerCase(),
      csv: (r) => r.user.displayName ?? r.user.userPrincipalName ?? '',
      render: (r) => (
        <>
          {r.user.displayName ?? r.user.userPrincipalName}
          {r.admin && <span className="chip tag">{C.admin}</span>}
          {r.guest && <span className="chip tag">{C.guest}</span>}
          {r.kind !== 'person' && <span className="chip tag">{kindWord(r.kind)}</span>}
        </>
      ),
    },
    { key: 'upn', header: C.signInAddress, hidden: true, render: () => null, csv: (r) => r.user.userPrincipalName ?? '' },
    {
      key: 'readiness',
      header: T.columns[1],
      // Passkey-ready first, then the people with the most to do: the group is
      // the page's order and the rung breaks the tie inside it.
      sortValue: (r) => (r.kind !== 'person' ? -1 : !r.active ? 0 : r.rung ?? 0),
      csv: (r) => readinessWord(r),
      render: (r) => (
        <>
          <RungBadge rung={r.rung} />
          {r.group !== null ? (
            <span className="group-word">{readinessWord(r)}</span>
          ) : (
            <span className="not-person">{r.kind !== 'person' ? T.notAPerson : notActiveWord()}</span>
          )}
        </>
      ),
    },
    { key: 'method', header: T.columns[2], sortValue: (r) => methodWord(r.method), csv: (r) => methodWord(r.method), render: (r) => methodWord(r.method) },
    { key: 'proof', header: T.columns[3], csv: (r) => rowEvidenceText(r), render: (r) => rowEvidenceText(r) },
    {
      key: 'next',
      header: T.columns[4],
      csv: (r) => nextStateWord(r),
      // The state stays the words it always was; where there is remediation to
      // open, it is also the control that opens it. A person already
      // passkey-ready is asked for nothing, and an account whose methods this
      // scan could not read gets no setup path invented for it — the page's own
      // "scan again" is the action there.
      render: (r) => {
        const kind = remediationFor(r.group, r).kind
        if (kind === 'none' || kind === 'unknown') return nextStateWord(r)
        const on = open?.userId === r.user.id
        return (
          <Button
            variant="tertiary"
            aria-expanded={on}
            aria-controls={GUIDE_PANEL_ID}
            onClick={(e) => {
              // Where focus goes back to when the panel closes: the row's own
              // control, not the top of the document (task 017).
              trigger.current = e.currentTarget
              setOpen(on ? null : { userId: r.user.id, guideId: kind === 'prove' ? 'prove' : null })
            }}
          >
            {nextStateWord(r)}
            <span aria-hidden="true"> →</span>
          </Button>
        )
      },
    },
  ]
  // The person the panel is open for, found again among the rows on screen: a
  // scan that changes who is listed closes it rather than leaving guidance
  // standing over an account that is no longer there.
  const openRow = open === null ? null : (view?.rows.find((r) => r.user.id === open.userId) ?? null)

  const heading = (
    <div className="page-head">
      <h1>{T.h1}</h1>
      <span className="page-head-actions">
        <Button variant="tertiary" onClick={() => again.run(scan(readinessHref(show)))}>
          {CONNECT_WORDS.scan.complete.again}
        </Button>
        {again.error && <span className="quiet" role="status">{again.error}</span>}
      </span>
    </div>
  )
  if (!view) {
    return (
      <section className="surface readiness">
        {heading}
        <p className="reason">{app.shell.loading}</p>
      </section>
    )
  }
  const { facts, groups } = view
  const ledger = ledgerParts(facts)
  const summary = facts.active > 0 ? fillText(T.summary, { ready: groups.ready, active: facts.active }) : T.summaryNone
  return (
    <section className="surface readiness">
      {heading}
      <p className="line">{T.lead}</p>
      <PageTip page="readiness" text={T.tip} />
      {context && (
        <Callout kind="info">
          {context.ids === null ? fillText(T.planContext.unknown, { step: context.title }) : fillText(T.planContext.filtered, { n: context.ids.length, step: context.title })}{' '}
          <a href={`#/plan/${encodeURIComponent(context.stepId)}`}>{T.planContext.back}</a>
        </Callout>
      )}
      <p className="line summary">{summary}</p>
      <div className="group-counts">
        {READINESS_GROUPS.map((g: ReadinessGroup) => {
          const on = show === g
          const w = groupWords(g)
          // The tip sits beside the control, not inside it: a button inside a
          // button is not markup a browser or a screen reader can make sense of.
          return (
            <div key={g} className={`group-tile card${on ? ' on' : ''}`}>
              {/* Pressed is `aria-pressed` for a screen reader and, in CSS, a
                  check mark before the title as well as the accent border: the
                  filter that is on must not be the accent alone (task 017). */}
              <button type="button" className="group-count" aria-pressed={on} onClick={() => select(on ? 'all' : g)}>
                <span className="group-title">{w.title}</span>
                <b className={`group-n stat-num group-${g}`}>{groups[g]}</b>
              </button>
              <InfoTip title={w.title} text={w.tip} />
            </div>
          )
        })}
      </div>
      {/* Unknown stays a sentence, never a fourth count: the page will not put a
          number beside a state it could not establish. */}
      {groups.unknown > 0 && <p className="reason">{fillText(T.unknownMethods, { n: groups.unknown })}</p>}
      <div className="toolbar no-print">
        <input type="search" placeholder={C.search} aria-label={C.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <label>
          {C.showLabel}{' '}
          <select value={show} onChange={(e) => select(e.currentTarget.value as ShowKey)}>
            {/* A link arrived filtered to a rung or a separate population: the
                option is there so the control says what is on screen. */}
            {(SHOW_KEYS.includes(show) ? SHOW_KEYS : [...SHOW_KEYS, show]).map((k) => (
              <option key={k} value={k}>
                {showWord(k)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="tertiary" aria-pressed={adminsOnly} onClick={() => setAdminsOnly((v) => !v)}>
          {T.adminsOnly}
        </Button>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.user.id} csvName={READINESS_CSV} empty={C.noMatch} />
      {openRow && open && (
        <RemediationPanel
          row={openRow}
          guideId={open.guideId}
          onPick={(guideId) => setOpen({ userId: open.userId, guideId })}
          onClose={closeGuide}
        />
      )}
      {/* Quiet, under the table: every account once, then the populations the
          campaign does not count, each a link to itself. They stay reachable for
          context and never appear as a failed employee passkey adoption. */}
      <p className="line ledger">
        {ledger.lead} {ledger.parts.filter((part) => part.show === null).map((part) => part.text).join(' · ')}
        {ledger.parts.some((part) => part.show !== null) && (
          <>
            {' · '}
            <span className="quiet">{T.separate}</span>{' '}
            {ledger.parts
              .filter((part) => part.show !== null)
              .map((part, i) => (
                <span key={part.key}>
                  {i > 0 && ' · '}
                  <a href={readinessHref(part.show as ShowKey)}>{part.text}</a>
                </span>
              ))}
          </>
        )}{' '}
        <span className="quiet">{window_}</span>
      </p>
      <p className="footer-link">
        <a href="#/inventory">{T.inventory}</a>
      </p>
    </section>
  )
}
