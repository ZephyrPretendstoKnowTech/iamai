import { useId, useState, useRef, useEffect } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { usePrinting } from './usePrinting.ts'

export type TabDef = { id: string; label: string; badge?: string | number; render: () => ReactNode }

/** One tab in a `TabList`: what it says, and the panel it drives. */
export type TabItem = { id: string; label: ReactNode; badge?: string | number }

/**
 * The tab strip, and the keyboard behaviour `role="tablist"` promises (task 017).
 *
 * A tablist is one stop in the tab order, not one per tab: only the selected
 * tab is reachable with Tab, and Left/Right (Home/End) move between them and
 * select as they go. Every tab names the panel it controls, and the panel names
 * the tab that labels it, so a screen reader can move between the two.
 *
 * `panelId` is a function rather than a string because both shapes exist here:
 * `Tabs` below renders one panel per tab and keeps them all mounted, while the
 * Plan's step renders one panel and swaps its contents, so all three of its tabs
 * control the same element.
 */
export function TabList({
  base,
  tabs,
  active,
  onSelect,
  panelId,
  className = 'tabs no-print',
}: {
  /** The id prefix both the tabs and their panels are built from (`useId`). */
  base: string
  tabs: TabItem[]
  active: string
  onSelect: (id: string) => void
  panelId: (tabId: string) => string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: KeyboardEvent<HTMLDivElement>): void => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === active)
    const at = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    const next = tabs[at]
    if (!next) return
    onSelect(next.id)
    // Selection follows focus, so focus has to follow the selection: the tab
    // that just became selected is the one tab stop in the strip.
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[at]?.focus()
  }
  return (
    <div className={className} role="tablist" ref={ref} onKeyDown={move}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={tabId(base, t.id)}
          aria-selected={active === t.id}
          aria-controls={panelId(t.id)}
          tabIndex={active === t.id ? 0 : -1}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
          {t.badge !== undefined && t.badge !== '' && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

/** The DOM id of one tab button, so a panel can name the tab that labels it. */
export const tabId = (base: string, id: string): string => `${base}-tab-${id}`

/**
 * The panel attributes for a tab set with one panel element (the Plan's step):
 * every tab controls it, and it is labelled by whichever tab is selected.
 * `tabIndex` makes it reachable, because a panel of prose or a scrolling code
 * block holds nothing else a keyboard can land on.
 */
export const onePanelProps = (base: string, active: string) => ({
  role: 'tabpanel' as const,
  id: `${base}-panel`,
  'aria-labelledby': tabId(base, active),
  tabIndex: 0,
})

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
  const printing = usePrinting()
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
    <div ref={listRef}>
      <TabList base={base} tabs={tabs} active={active} onSelect={choose} panelId={(id) => `${base}-panel-${id}`} />
      {tabs.map((t) => (
        <section
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={tabId(base, t.id)}
          className={`tab-panel ${active === t.id ? 'active' : ''}`}
        >
          <h3 className="print-only">{t.label}</h3>
          {(printing || visited.has(t.id) || active === t.id) && t.render()}
        </section>
      ))}
    </div>
  )
}
