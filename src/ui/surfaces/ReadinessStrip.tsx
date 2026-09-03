// The readiness strip on the Plan (derive/readinessStrip.ts): five tiles under
// the header line, above the start. Clicking a tile opens it in place to the
// people in that bucket, one line each — a green dot when they meet the bar the
// plan needs, a grey dot when not, the name, the strongest method, the last MFA
// sign-in; a second click collapses it; one tile open at a time; the open tile
// is remembered in the browser.
import { useMemo, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { readinessStrip, STRIP_TILES } from '../../derive/readinessStrip.ts'
import type { StripTile } from '../../derive/readinessStrip.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { METHOD_TIER } from '../../copy/definitions.ts'
import { relative } from '../../copy/dates.ts'

type Words = { tiles: Record<StripTile, string>; value: string; of: string; row: string; last: string; never: string; empty: string; bar: { met: string; below: string } }
const R = (pages.plan as { readiness: Words }).readiness
const KEY = 'iamai.plan.readinessTile'

function readOpen(): StripTile | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return v && (STRIP_TILES as string[]).includes(v) ? (v as StripTile) : null
  } catch {
    return null
  }
}
function writeOpen(tile: StripTile | null): void {
  try {
    if (tile) window.localStorage.setItem(KEY, tile)
    else window.localStorage.removeItem(KEY)
  } catch {
    // no store: the tile is open for this visit only
  }
}

export function ReadinessStrip({ snapshot, mapping, nameOf }: { snapshot: TenantSnapshot; mapping: Pick<MappingState, 'breakGlassUserIds' | 'serviceAccountUserIds'>; nameOf: (id: string) => string }) {
  const strip = useMemo(() => readinessStrip(snapshot, mapping, snapshot.asOf), [snapshot, mapping])
  const [open, setOpen] = useState<StripTile | null>(() => readOpen())
  const toggle = (tile: StripTile): void => {
    const next = open === tile ? null : tile
    setOpen(next)
    writeOpen(next)
  }
  const value = (n: number): string => (strip.active > 0 ? fillText(R.value, { n, pct: `${Math.round((n / strip.active) * 100)}%` }) : String(n))
  const people = open ? strip.tiles[open] : []
  return (
    <div className="readiness">
      <div className="tiles tiles-5">
        {STRIP_TILES.map((k) => (
          <div key={k} className={`tile tile-open${open === k ? ' open' : ''}`} tabIndex={0} aria-expanded={open === k} onClick={() => toggle(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k) } }}>
            <div className="stat-num">{value(strip.tiles[k].length)}</div>
            <div className="stat-label">{R.tiles[k]}</div>
            <div className="stat-sub">{R.of}</div>
          </div>
        ))}
      </div>
      {open && people.length === 0 && <p className="reason">{R.empty}</p>}
      {open && people.length > 0 && (
        <ol className="names readiness-people">
          {people.map((p) => (
            <li key={p.id}>
              {/* The dot is the status idiom's, with no word: green when the bar is met, grey when not. */}
              <span className={`status ${p.meetsBar ? 'status-ok' : 'status-idle'}`} role="img" title={p.meetsBar ? R.bar.met : R.bar.below} aria-label={p.meetsBar ? R.bar.met : R.bar.below} />
              {fillText(R.row, { name: nameOf(p.id), method: METHOD_TIER[p.method].title, last: p.lastMfa ? fillText(R.last, { when: relative(p.lastMfa) }) : R.never })}
              {p.admin && <span className="chip tag">{app.today.admin}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
