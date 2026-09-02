// Today (prompt 47 Part 5, target-state §4): one line, four tiles, one table.
// Everything is counted over active people; not active is listed, not counted.
// No legend, no banner, no rollout tiles, no filter chips.
import { useEffect, useMemo, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { loadMappingState } from '../../mapping/store.ts'
import { todayView } from '../../derive/today.ts'
import { todayLine } from '../../derive/todayLine.ts'
import type { TodayRow, TodayState } from '../../derive/today.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { TODAY_LINE, METHOD_TIER, MFA_STATE, ACTIVITY_STATE } from '../../copy/definitions.ts'
import { absoluteDate, monthDay, relative } from '../../copy/dates.ts'
import { SHOW_KEYS, todayEvidenceText, todayStateWord } from './todayCells.ts'
import type { ShowKey } from './todayCells.ts'
import { DataTable, InfoTip, Status, Tile, Tiles, PageTip } from '../components/index.ts'
import type { Column, StatusTone } from '../components/index.ts'

// The Show list is pages.today.show (walk-51 item 10), in the six-state model
// the table uses: All, the six states, Admins, Guests — keyed by position, so
// the content file's words are the options and this maps each to its filter.
type TodayCopy = { h1: string; inventory: string; columns: string[]; show: string[]; tiles: Record<'proven' | 'unproven' | 'noMethod' | 'notActive', { label: string; value: string; heldBy: string | null; tip: string }> }
const T = pages.today as unknown as TodayCopy
const C = app.today

const TONE: Record<TodayState, StatusTone> = { proven: 'ok', likely: 'wait', neverPrompted: 'wait', possiblyBroken: 'stop', noMethod: 'stop', notActive: 'idle' }

/** The definition behind each state word, from the one MFA model. */
function stateTip(state: TodayState): string {
  switch (state) {
    case 'proven':
      return MFA_STATE.verified.text
    case 'likely':
      return MFA_STATE.likelyViable.text
    case 'neverPrompted':
      return MFA_STATE.notChallenged.text
    case 'possiblyBroken':
      return MFA_STATE.unverified.text
    case 'noMethod':
      return MFA_STATE.none.text
    default:
      return ACTIVITY_STATE.dormant.text
  }
}


function shows(r: TodayRow, key: ShowKey): boolean {
  switch (key) {
    case 'all':
      return true
    case 'admins':
      return r.viability.isAdmin
    case 'guests':
      return r.user.userType === 'guest'
    default:
      return r.state === key
  }
}

/** A tile's value from its content string: "{n} · {pct} of active"; the count alone when nobody is active. */
function tileValue(key: keyof TodayCopy['tiles'], n: number, active: number): string {
  const t = T.tiles[key]
  if (!/\{pct\}/.test(t.value) || active > 0) return fillText(t.value, { n: n.toLocaleString('en'), pct: active > 0 ? `${Math.round((n / active) * 100)}%` : '' })
  return n.toLocaleString('en')
}

export function Today({ snapshot, tenantId }: { snapshot: TenantSnapshot; tenantId: string }) {
  const [serviceIds, setServiceIds] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    void loadMappingState(tenantId).then((m) => setServiceIds(new Set(m.serviceAccountUserIds)))
  }, [tenantId])
  const view = useMemo(() => todayView(snapshot, snapshot.asOf, serviceIds), [snapshot, serviceIds])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<ShowKey>('all')
  const source = snapshot.sources.signInEvidence
  const window_ = source?.coveredWindow ? { from: monthDay(source.coveredWindow.from), to: monthDay(source.coveredWindow.to) } : null
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return view.rows.filter((r) => shows(r, show) && (!q || `${r.user.displayName ?? ''} ${r.user.userPrincipalName ?? ''}`.toLowerCase().includes(q)))
  }, [view, query, show])

  const columns: Column<TodayRow>[] = [
    {
      key: 'person',
      header: T.columns[0],
      sortValue: (r) => (r.user.displayName ?? r.user.userPrincipalName ?? '').toLowerCase(),
      csv: (r) => r.user.displayName ?? r.user.userPrincipalName ?? '',
      render: (r) => (
        <>
          {r.user.displayName ?? r.user.userPrincipalName}
          {r.viability.isAdmin && <span className="chip tag">{C.admin}</span>}
          {r.user.userType === 'guest' && <span className="chip tag">{C.guest}</span>}
        </>
      ),
    },
    { key: 'upn', header: C.signInAddress, hidden: true, render: () => null, csv: (r) => r.user.userPrincipalName ?? '' },
    {
      key: 'state',
      header: T.columns[1],
      sortValue: (r) => SHOW_KEYS.indexOf(r.state),
      csv: (r) => todayStateWord(r.state),
      render: (r) => (
        <Status tone={TONE[r.state]} title={stateTip(r.state)}>
          {todayStateWord(r.state)}
        </Status>
      ),
    },
    {
      key: 'method',
      header: T.columns[2],
      sortValue: (r) => Object.keys(METHOD_TIER).indexOf(r.strongest),
      csv: (r) => METHOD_TIER[r.strongest].title,
      render: (r) => <span title={METHOD_TIER[r.strongest].text}>{METHOD_TIER[r.strongest].title}</span>,
    },
    { key: 'evidence', header: T.columns[3], csv: (r) => todayEvidenceText(r), render: (r) => todayEvidenceText(r) },
  ]

  const { tiles, counts } = view
  return (
    <section className="surface today">
      <h1>{T.h1}</h1>
      <p className="lede">{(pages.today as Record<string, string>).purpose}</p>
      <p className="line">
        {todayLine(counts, window_, !window_ && source?.status === 'disabled' ? source.reason : null)}
        <InfoTip title={TODAY_LINE.active.title} text={TODAY_LINE.active.text} />
      </p>
      <PageTip page="today" text={(pages.today as Record<string, string>).tip} />
      {/* The four tiles from pages.today.tiles: the value, the label, the "held by" line
          naming the step that moves the number, and the definition (walk-51 item 10). */}
      <Tiles>
        {(['proven', 'unproven', 'noMethod', 'notActive'] as const).map((k) => (
          <Tile key={k} value={tileValue(k, tiles[k], tiles.active)} label={T.tiles[k].label} sub={T.tiles[k].heldBy ?? undefined} tip={{ title: T.tiles[k].label, text: T.tiles[k].tip }} />
        ))}
      </Tiles>
      <div className="toolbar no-print">
        <input type="search" placeholder={C.search} aria-label={C.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <label>
          {C.showLabel}{' '}
          <select value={show} onChange={(e) => setShow(e.currentTarget.value as ShowKey)}>
            {SHOW_KEYS.map((k, i) => (
              <option key={k} value={k}>
                {T.show[i]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.user.id} csvName="iamai-today.csv" empty={C.noMatch} />
      <p className="footer-link">
        <a href="#/inventory">{T.inventory}</a>
      </p>
    </section>
  )
}
