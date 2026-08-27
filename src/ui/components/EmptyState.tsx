import type { ReactNode } from 'react'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'

// One icon, one sentence, one action.
export function EmptyState({ icon = 'info', text, action }: { icon?: IconName; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div>
        <Icon name={icon} size={28} />
      </div>
      <p>{text}</p>
      {action}
    </div>
  )
}
