import { useId, useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

export type TabDef = { id: string; label: string; badge?: string | number; render: () => ReactNode }

// Sticky section tabs with count badges. Print renders every panel in order.
export function Tabs({
  tabs,
  initial,
  active: controlled,
  onChange,
}: {
  tabs: TabDef[]
  initial?: string
  /** Controlled mode: the parent owns the active tab (deep links). */
  active?: string
  onChange?: (id: string) => void
}) {
  const [own, setOwn] = useState(initial ?? tabs[0]?.id ?? '')
  const active = controlled ?? own
  const setActive = (id: string): void => {
    setOwn(id)
    onChange?.(id)
  }
  const base = useId()
  const listRef = useRef<HTMLDivElement>(null)
  // Panels render once visited (ux-review-06 §16): the heavy Steps and
  // attention lists are not laid out while another tab is open. Printing
  // needs every panel, so beforeprint mounts them all.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([controlled ?? initial ?? tabs[0]?.id ?? '']))
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const on = () => setPrinting(true)
    const off = () => setPrinting(false)
    window.addEventListener('beforeprint', on)
    window.addEventListener('afterprint', off)
    return () => {
      window.removeEventListener('beforeprint', on)
      window.removeEventListener('afterprint', off)
    }
  }, [])
  useEffect(() => {
    setVisited((v) => (v.has(active) ? v : new Set([...v, active])))
  }, [active])
  // Switching tabs lands at the top of the panel, never mid-content (ux-review-05 §41).
  const choose = (id: string): void => {
    setActive(id)
    const list = listRef.current
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' })
  }
  return (
    <div>
      <div className="tabs no-print" role="tablist" ref={listRef}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => choose(t.id)}
          >
            {t.label}
            {t.badge !== undefined && t.badge !== '' && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <section
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          className={`tab-panel ${active === t.id ? 'active' : ''}`}
        >
          <h3 className="print-only">{t.label}</h3>
          {(printing || visited.has(t.id) || active === t.id) && t.render()}
        </section>
      ))}
    </div>
  )
}
