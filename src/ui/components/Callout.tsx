import type { ReactNode } from 'react'
import { Icon } from './Icon.tsx'

export type CalloutKind = 'info' | 'warning' | 'danger' | 'success'

const ICON: Record<CalloutKind, 'info' | 'alert' | 'check'> = {
  info: 'info',
  warning: 'alert',
  danger: 'alert',
  success: 'check',
}

export function Callout({ kind = 'info', title, children }: { kind?: CalloutKind; title?: string; children: ReactNode }) {
  return (
    // The layout belongs to the `.callout` role in app.css (task 031). It used
    // to be an inner `row` div with two inline styles, and `.row` is declared
    // by no stylesheet in the product — so the icon stacked above its own
    // sentence instead of sitting beside it, and neither inline style did
    // anything without a `display` to apply to.
    <div className={`callout callout-${kind}`} role={kind === 'danger' ? 'alert' : undefined}>
      <Icon name={ICON[kind]} />
      <div className="callout-body">
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  )
}
