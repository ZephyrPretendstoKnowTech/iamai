import type { ReactNode } from 'react'

export type ChipStatus = 'done' | 'ready' | 'blocked' | 'in-progress' | 'warning' | 'neutral'

export function Chip({ status = 'neutral', title, children }: { status?: ChipStatus; title?: string; children: ReactNode }) {
  return (
    <span className={`chip chip-${status}`} title={title}>
      {children}
    </span>
  )
}

/** Selectable filter chip — consistent 24px height, keyboard accessible. */
export function FilterChip({
  selected,
  onToggle,
  title,
  children,
}: {
  selected: boolean
  onToggle: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button type="button" className={`chip chip-select ${selected ? 'chip-selected' : ''}`} aria-pressed={selected} title={title} onClick={onToggle}>
      {children}
    </button>
  )
}
