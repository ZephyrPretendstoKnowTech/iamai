import { useState } from 'react'
import type { ReactNode } from 'react'

// Sticky section tabs within a page (2026-08-27 layout decision): one click to
// any section, no long scroll. In print every section renders in order.
export function SectionTabs({
  sections,
  initial,
}: {
  sections: { id: string; label: string; badge?: string | number; render: () => ReactNode }[]
  initial?: string
}) {
  const [active, setActive] = useState(initial ?? sections[0]?.id ?? '')
  return (
    <div>
      <div className="section-tabs no-print">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`section-tab ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
            {s.badge !== undefined && s.badge !== '' && <span className="badge">{s.badge}</span>}
          </button>
        ))}
      </div>
      {sections.map((s) => (
        <section key={s.id} className={`section-panel ${active === s.id ? 'active' : ''}`}>
          <h3 className="print-only">{s.label}</h3>
          {s.render()}
        </section>
      ))}
    </div>
  )
}
