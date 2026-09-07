import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button.tsx'
import { EmptyState } from './EmptyState.tsx'
import { toCsv } from '../format.ts'
import { REDACTED, exportDownload } from '../exportGuard.ts'
import { COMPONENTS } from '../../copy/components.ts'

const T = COMPONENTS.table

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  csv?: (row: T) => string | number | null
  /** CSV-only column: exported but never rendered. */
  hidden?: boolean
  /** Minimum column width so the header never breaks mid-word (ux-review-04 §3). */
  minWidth?: string
}

const PAGE_SIZE = 50

// Sticky header, sortable columns, row hover, optional expand, pagination at
// 50, CSV export, empty state.
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  expand,
  csvName,
  caption,
  empty = T.empty,
  initialSort,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  expand?: (row: T) => ReactNode
  csvName?: string
  /** A table's own title (prompt 47 Part 5): a caption, so a page with several tables carries one heading. */
  caption?: ReactNode
  empty?: string
  initialSort?: { key: string; dir: 1 | -1 }
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null)
  const [page, setPage] = useState(0)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const shown = columns.filter((c) => !c.hidden)
  const wrap = useRef<HTMLDivElement>(null)
  // A wide table scrolls inside its own box rather than widening the page
  // (task 017), and a region that scrolls has to be reachable by keyboard —
  // but only while it actually scrolls, or every table on How would be a tab
  // stop that goes nowhere.
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rows, columns])

  const toggleSort = useCallback(
    (key: string) => setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 })),
    [],
  )

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const f = col.sortValue
    return [...rows].sort((a, b) => {
      const va = f(a)
      const vb = f(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const slice = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const exportCsv = (): void => {
    const cols = columns.filter((c) => c.csv)
    exportDownload(
      csvName ?? 'export.csv',
      toCsv(
        cols.map((c) => c.header),
        sorted.map((r) => cols.map((c) => c.csv!(r))),
      ),
      'text/csv',
      REDACTED,
    )
  }

  if (rows.length === 0)
    return (
      <>
        {caption && <p className="reason">{caption}</p>}
        <EmptyState icon="search" text={empty} />
      </>
    )

  return (
    <div>
      <div className="datatable-wrap" ref={wrap} tabIndex={scrolls ? 0 : undefined}>
        <table className="datatable">
          {caption && <caption>{caption}</caption>}
          <thead>
            <tr>
              {shown.map((c) => (
                // A sortable column keeps being a column header: the control
                // goes *inside* the th (task 017), where before `role="button"`
                // on the th itself replaced the header semantic a screen reader
                // needs to say which column a cell belongs to. `aria-sort` stays
                // on the header, which is the element it describes.
                <th
                  key={c.key}
                  scope="col"
                  style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                  className={c.sortValue ? 'sortable' : ''}
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {sort?.key === c.key && (
                        <span className="icon" aria-hidden>
                          {sort.dir === 1 ? ' ▲' : ' ▼'}
                        </span>
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const k = rowKey(r)
              return (
                <RowGroup key={k}>
                  <tr
                    onClick={expand ? () => setOpenRow((o) => (o === k ? null : k)) : undefined}
                    onKeyDown={
                      expand
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setOpenRow((o) => (o === k ? null : k))
                            }
                          }
                        : undefined
                    }
                    tabIndex={expand ? 0 : undefined}
                    aria-expanded={expand ? openRow === k : undefined}
                    style={expand ? { cursor: 'pointer' } : undefined}
                  >
                    {shown.map((c) => (
                      <td key={c.key}>{c.render(r)}</td>
                    ))}
                  </tr>
                  {expand && openRow === k && (
                    <tr>
                      <td colSpan={shown.length}>{expand(r)}</td>
                    </tr>
                  )}
                </RowGroup>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="datatable-footer no-print">
        {/* R6: a row count on a table you can see all of tells you nothing you
            could not get by looking. It stays where it earns its place — on a
            table that pages, where the rest of the rows are off screen. */}
        <span>{pages > 1 ? `${T.rows(sorted.length)} · ${T.page(current + 1, pages)}` : ''}</span>
        {pages > 1 && (
          <>
            <Button size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={current === 0}>
              {T.previous}
            </Button>
            <Button size="sm" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={current >= pages - 1}>
              {T.next}
            </Button>
          </>
        )}
        {csvName && (
          <Button size="sm" icon="download" onClick={exportCsv}>
            {T.exportCsv}
          </Button>
        )}
      </div>
    </div>
  )
}

function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>
}
