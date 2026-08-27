import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button.tsx'
import { EmptyState } from './EmptyState.tsx'
import { downloadFile, toCsv } from '../format.ts'
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
  empty = T.empty,
  initialSort,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  expand?: (row: T) => ReactNode
  csvName?: string
  empty?: string
  initialSort?: { key: string; dir: 1 | -1 }
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null)
  const [page, setPage] = useState(0)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const shown = columns.filter((c) => !c.hidden)

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
    downloadFile(
      csvName ?? 'export.csv',
      toCsv(
        cols.map((c) => c.header),
        sorted.map((r) => cols.map((c) => c.csv!(r))),
      ),
      'text/csv',
    )
  }

  if (rows.length === 0) return <EmptyState icon="search" text={empty} />

  return (
    <div>
      <div className="datatable-wrap">
        <table className="datatable">
          <thead>
            <tr>
              {shown.map((c) => (
                <th
                  key={c.key}
                  className={c.sortValue ? 'sortable' : ''}
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                  onClick={() =>
                    c.sortValue && setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))
                  }
                >
                  {c.header}
                  {sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const k = rowKey(r)
              return (
                <RowGroup key={k}>
                  <tr onClick={expand ? () => setOpenRow((o) => (o === k ? null : k)) : undefined} style={expand ? { cursor: 'pointer' } : undefined}>
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
        <span>
          {T.rows(sorted.length)}
          {pages > 1 && ` · ${T.page(current + 1, pages)}`}
        </span>
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
