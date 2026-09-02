// Today (prompt 47 Part 5, target-state §4): one line, four tiles, one table.
// Everything is counted over active people; not active is listed, not counted.
// No legend, no banner, no rollout tiles, no filter chips.
import { useEffect, useMemo, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { loadMappingState } from '../../mapping/store.ts'
import { todayView } from '../../derive/today.ts'
import type { TodayRow, TodayState } from '../../derive/today.ts'
import { TODAY as C } from '../../copy/today.ts'
import { pages } from '../../content/content.ts'
import { TODAY_LINE, TODAY_TILE, METHOD_TIER, MFA_STATE, ACTIVITY_STATE } from '../../copy/definitions.ts'
import { absoluteDate, monthDayRange, relative } from '../../copy/dates.ts'
import { friendlyMethod } from '../format.ts'
import { DataTable, InfoTip, Status, Tile, Tiles } from '../components/index.ts'
import type { Column, StatusTone } from '../components/index.ts'

type ShowKey = keyof typeof C.showOptions

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

function evidenceText(r: TodayRow): string {
  const e = r.evidence
  switch (e.kind) {
    case 'mfa': {
      const name = friendlyMethod(e.method)
      return name ? C.mfaVia(name, relative(e.at)) : C.mfaCompleted(relative(e.at))
    }
    case 'neverSignedIn':
      return C.neverSignedIn
    case 'inactive':
      return C.inactiveSince(absoluteDate(e.since))
    case 'noMethod':
      return C.noMethodEvidence
    default:
      return e.reasons.join('; ')
  }
}

function shows(r: TodayRow, key: ShowKey): boolean {
  switch (key) {
    case 'all':
      return true
    case 'proven':
    case 'unproven':
    case 'noMethod':
      return r.bucket === key
    case 'notActive':
      return r.state === 'notActive'
    case 'admins':
      return r.viability.isAdmin
    default:
      return r.user.userType === 'guest'
  }
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
  const window_ = source?.coveredWindow ? monthDayRange(source.coveredWindow.from, source.coveredWindow.to) : null
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return view.rows.filter((r) => shows(r, show) && (!q || `${r.user.displayName ?? ''} ${r.user.userPrincipalName ?? ''}`.toLowerCase().includes(q)))
  }, [view, query, show])

  const columns: Column<TodayRow>[] = [
    {
      key: 'person',
      header: C.columns.person,
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
    { key: 'upn', header: C.columns.signInAddress, hidden: true, render: () => null, csv: (r) => r.user.userPrincipalName ?? '' },
    {
      key: 'state',
      header: C.columns.state,
      sortValue: (r) => Object.keys(C.state).indexOf(r.state),
      csv: (r) => C.state[r.state],
      render: (r) => (
        <Status tone={TONE[r.state]} title={stateTip(r.state)}>
          {C.state[r.state]}
        </Status>
      ),
    },
    {
      key: 'method',
      header: C.columns.method,
      sortValue: (r) => Object.keys(METHOD_TIER).indexOf(r.strongest),
      csv: (r) => METHOD_TIER[r.strongest].title,
      render: (r) => <span title={METHOD_TIER[r.strongest].text}>{METHOD_TIER[r.strongest].title}</span>,
    },
    { key: 'evidence', header: C.columns.evidence, csv: (r) => evidenceText(r), render: (r) => evidenceText(r) },
  ]

  const { tiles, counts } = view
  return (
    <section className="surface today">
      <h1>{C.title}</h1>
      <p className="lede">{(pages.today as Record<string, string>).purpose}</p>
      <p className="line">
        {C.line(counts, window_, !window_ && source?.status === 'disabled' ? source.reason : null)}
        <InfoTip title={TODAY_LINE.active.title} text={TODAY_LINE.active.text} />
      </p>
      <Tiles>
        <Tile value={C.share(tiles.proven, tiles.active)} label={C.tiles.proven} tip={TODAY_TILE.proven} />
        <Tile value={C.share(tiles.unproven, tiles.active)} label={C.tiles.unproven} tip={TODAY_TILE.unproven} />
        <Tile value={C.share(tiles.noMethod, tiles.active)} label={C.tiles.noMethod} tip={TODAY_TILE.noMethod} />
        <Tile value={tiles.notActive.toLocaleString('en')} label={C.tiles.notActive} tip={TODAY_TILE.notActive} />
      </Tiles>
      <div className="toolbar no-print">
        <input type="search" placeholder={C.search} aria-label={C.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <label>
          {C.show}{' '}
          <select value={show} onChange={(e) => setShow(e.currentTarget.value as ShowKey)}>
            {(Object.keys(C.showOptions) as ShowKey[]).map((k) => (
              <option key={k} value={k}>
                {C.showOptions[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.user.id} csvName="iamai-today.csv" empty={C.noMatch} />
      <p className="footer-link">
        <a href="#/inventory">{C.everything}</a>
      </p>
    </section>
  )
}
