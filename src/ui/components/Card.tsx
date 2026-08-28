import { useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { usePrinting } from './usePrinting.ts'

export function Card({ title, children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { title?: string; children: ReactNode }) {
  return (
    <div className={`card ${className ?? ''}`} {...rest}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  )
}

/** Expandable card: summary always visible, body on open. */
export function ExpandCard({
  summary,
  open,
  className,
  id,
  children,
}: {
  summary: ReactNode
  open?: boolean
  className?: string
  id?: string
  children: ReactNode
}) {
  // The body mounts only once the card is opened (ux-review-06 §16): a page of
  // closed cards costs their summaries, not their contents. Printing mounts all.
  const [opened, setOpened] = useState(open === true)
  const printing = usePrinting()
  return (
    <details
      className={`card ${className ?? ''}`}
      open={open}
      id={id}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setOpened(true)
      }}
    >
      <summary>{summary}</summary>
      {(opened || open || printing) && children}
    </details>
  )
}
