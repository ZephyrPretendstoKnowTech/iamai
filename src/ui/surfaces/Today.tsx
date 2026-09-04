// Today (docs/design/mockups/today-v2.html): the ledger line, the MFA readiness
// ladder as five boxed rows with the rule before the three to prioritise, the
// search, the Show list and Admins only, and the table with every account. An
// active person carries their rung; not active is outside the ladder; an account
// that is not a person is listed with a grey dash and its kind. Clicking a rung
// filters the table to it, and #/today/rung-N opens the page so filtered (the
// Plan strip's and Connect's tiles link here). Every number is derive/ladder.ts.
import { useEffect, useMemo, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { loadMappingState } from '../../mapping/store.ts'
import { PRIORITISE_FROM, RUNGS } from '../../derive/ladder.ts'
import type { Rung } from '../../derive/ladder.ts'
import { SHOW_KEYS, showKeyOf, shows, todayView } from '../../derive/today.ts'
import type { ShowKey, TodayRow } from '../../derive/today.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import { kindWord, ladderWords, ledgerText, methodWord, readinessWord, rungWords, showWord, todayEvidenceText } from './todayCells.ts'
import { LadderHead } from './LadderTiles.tsx'
import { showFromTodayHash, todayHref } from '../shell/routes.ts'
import { Button, DataTable, InfoTip, PageTip } from '../components/index.ts'
import type { Column } from '../components/index.ts'

type TodayCopy = { h1: string; adminsOnly: string; columns: string[]; notAPerson: string; inventory: string; tip: string }
const T = pages.today as unknown as TodayCopy
const C = app.today
const EMPTY_MAPPING = { breakGlassUserIds: [] as string[], serviceAccountUserIds: [] as string[] }

/** The rung's badge: the number in the rung's colour; a grey dash outside the ladder. */
function RungBadge({ rung }: { rung: Rung | null }) {
  return (
    <span className={`rung-badge rung-${rung ?? 0}`} title={rung ? rungWords(rung).title : undefined} aria-label={rung ? rungWords(rung).title : undefined}>
      {rung ?? '–'}
    </span>
  )
}

export function Today({ snapshot, tenantId }: { snapshot: TenantSnapshot; tenantId: string }) {
  const [mapping, setMapping] = useState<{ breakGlassUserIds: readonly string[]; serviceAccountUserIds: readonly string[] }>(EMPTY_MAPPING)
  useEffect(() => {
    // The emergency and service accounts are not people (derive/sets.ts notPeopleIds): Today's ledger and table read the plan's population.
    void loadMappingState(tenantId).then((m) => setMapping(m))
  }, [tenantId])
  const view = useMemo(() => todayView(snapshot, snapshot.asOf, mapping), [snapshot, mapping])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<ShowKey>(() => showKeyOf(showFromTodayHash(window.location.hash)) ?? 'all')
  const [adminsOnly, setAdminsOnly] = useState(false)
  useEffect(() => {
    const onHash = () => setShow(showKeyOf(showFromTodayHash(window.location.hash)) ?? 'all')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const select = (key: ShowKey): void => {
    setShow(key)
    window.history.replaceState(null, '', todayHref(key))
  }
  const source = snapshot.sources.signInEvidence
  const window_ = source?.coveredWindow ? fillText(C.lineRecords, { from: monthDay(source.coveredWindow.from), to: monthDay(source.coveredWindow.to) }) : source?.status === 'disabled' && source.reason ? fillText(C.lineNoRecordsReason, { reason: source.reason }) : C.lineNoRecords
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return view.rows.filter((r) => shows(r, show) && (!adminsOnly || r.admin) && (!q || `${r.user.displayName ?? ''} ${r.user.userPrincipalName ?? ''}`.toLowerCase().includes(q)))
  }, [view, query, show, adminsOnly])

  const columns: Column<TodayRow>[] = [
    {
      key: 'account',
      header: T.columns[0],
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
      sortValue: (r) => (r.kind !== 'person' ? -1 : r.rung ?? 0),
      csv: (r) => readinessWord(r),
      render: (r) => (
        <>
          <RungBadge rung={r.rung} />
          {r.kind !== 'person' && <span className="not-person">{T.notAPerson}</span>}
        </>
      ),
    },
    { key: 'method', header: T.columns[2], sortValue: (r) => methodWord(r.method), csv: (r) => methodWord(r.method), render: (r) => methodWord(r.method) },
    { key: 'evidence', header: T.columns[3], csv: (r) => todayEvidenceText(r), render: (r) => todayEvidenceText(r) },
  ]

  const { ledger, ladder } = view
  const pct = (n: number): string => (ledger.active > 0 ? `${Math.round((n / ledger.active) * 100)}%` : '0%')
  return (
    <section className="surface today">
      <h1>{T.h1}</h1>
      <p className="line ledger">
        {ledgerText(ledger)} <span className="quiet">{window_}</span>
      </p>
      <PageTip page="today" text={T.tip} />
      <LadderHead active={ledger.active} />
      <ul className="ladder">
        {RUNGS.map((r) => {
          const n = ladder.rungs[r].length
          const w = rungWords(r)
          const key: ShowKey = `rung-${r}`
          const on = show === key
          return [
            // The rule before the three to prioritise, between rungs 4 and 3.
            r === PRIORITISE_FROM ? (
              <li key="rule" className="ladder-divider">
                {ladderWords.prioritise}
              </li>
            ) : null,
            <li key={r} className={`ladder-row card${on ? ' on' : ''}`} data-rung={r} tabIndex={0} aria-pressed={on} onClick={() => select(on ? 'all' : key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(on ? 'all' : key) } }}>
              <span className={`rung-badge rung-${r}`}>{r}</span>
              <span className="rung-text">
                <span className="rung-title">
                  {w.title}
                  <InfoTip title={w.title} text={w.tip} />
                </span>
                <span className="rung-desc">{w.desc}</span>
              </span>
              <span className="rung-n">{n}</span>
              <span className="rung-bar">
                <i className={`rung-${r}`} style={{ width: pct(n) }} />
              </span>
            </li>,
          ]
        })}
      </ul>
      <div className="toolbar no-print">
        <input type="search" placeholder={C.search} aria-label={C.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <label>
          {C.showLabel}{' '}
          <select value={show} onChange={(e) => select(e.currentTarget.value as ShowKey)}>
            {SHOW_KEYS.map((k) => (
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
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.user.id} csvName="iamai-today.csv" empty={C.noMatch} />
      <p className="footer-link">
        <a href="#/inventory">{T.inventory}</a>
      </p>
    </section>
  )
}
