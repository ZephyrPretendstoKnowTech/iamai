import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ title, children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { title?: string; children: ReactNode }) {
  return (
    <div className={`card ${className ?? ''}`} {...rest}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  )
}

/** Expandable card — summary always visible, body on open. */
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
  return (
    <details className={`card ${className ?? ''}`} open={open} id={id}>
      <summary>{summary}</summary>
      {children}
    </details>
  )
}
