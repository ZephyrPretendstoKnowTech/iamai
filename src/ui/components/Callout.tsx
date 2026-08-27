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
    <div className={`callout callout-${kind}`} role={kind === 'danger' ? 'alert' : undefined}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <Icon name={ICON[kind]} />
        <div style={{ minWidth: 0 }}>
          {title && <strong>{title} </strong>}
          {children}
        </div>
      </div>
    </div>
  )
}
