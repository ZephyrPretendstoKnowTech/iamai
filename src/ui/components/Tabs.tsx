import { useId, useState, useRef } from 'react'
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
          {t.render()}
        </section>
      ))}
    </div>
  )
}
