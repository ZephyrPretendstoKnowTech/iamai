import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export type TabDef = { id: string; label: string; badge?: string | number; render: () => ReactNode }

// Sticky section tabs with count badges. Print renders every panel in order.
export function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id ?? '')
  const base = useId()
  return (
    <div>
      <div className="tabs no-print" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
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
