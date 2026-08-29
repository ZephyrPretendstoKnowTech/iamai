// Empty states. Two shapes: the small one (one icon, one sentence, one
// action) for tables and lists, and the illustrated one (ux-review-07 §F):
// line art in the accent colour, no stock art, no emoji, for the four page-
// level scenes: no plan yet, nothing to watch, no danger areas, no scan yet.
import type { ReactNode } from 'react'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'

export type EmptyScene = 'noPlan' | 'nothingToWatch' | 'noDangers' | 'noScan'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function Scene({ scene }: { scene: EmptyScene }) {
  switch (scene) {
    case 'noPlan':
      // A calendar page with a ring waiting on it.
      return (
        <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
          <path d="M14 16 h92 a4 4 0 0 1 4 4 v46 a4 4 0 0 1 -4 4 h-92 a4 4 0 0 1 -4 -4 v-46 a4 4 0 0 1 4 -4 z" {...stroke} />
          <path d="M10 30 h100" {...stroke} />
          <path d="M34 10 v12 M86 10 v12" {...stroke} />
          <circle cx="60" cy="50" r="5" {...stroke} />
          <path d="M60 39 A11 11 0 1 1 49 50" {...stroke} />
          <path d="M60 33 A17 17 0 0 1 77 50" {...stroke} opacity="0.5" />
        </svg>
      )
    case 'nothingToWatch':
      // A clear horizon: a flat line, a small sun, no clouds.
      return (
        <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
          <path d="M8 62 h104" {...stroke} />
          <circle cx="60" cy="42" r="11" {...stroke} />
          <path d="M60 22 v-6 M60 68 v-2 M40 42 h-6 M86 42 h-6 M46 28 l-4 -4 M78 28 l4 -4" {...stroke} />
          <path d="M24 70 q6 -4 12 0 M84 70 q6 -4 12 0" {...stroke} opacity="0.5" />
        </svg>
      )
    case 'noDangers':
      // A shield with a tick, drawn in one line.
      return (
        <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
          <path d="M60 10 l26 8 v22 c0 16 -12 26 -26 32 c-14 -6 -26 -16 -26 -32 v-22 z" {...stroke} />
          <path d="M48 42 l8 8 l16 -18" {...stroke} />
        </svg>
      )
    case 'noScan':
      // A magnifier over an empty sheet.
      return (
        <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
          <path d="M30 8 h40 l14 14 v50 h-54 z" {...stroke} />
          <path d="M70 8 v14 h14" {...stroke} />
          <path d="M40 34 h30 M40 44 h20" {...stroke} opacity="0.5" />
          <circle cx="82" cy="56" r="11" {...stroke} />
          <path d="M90 64 l12 12" {...stroke} />
        </svg>
      )
  }
}

export function EmptyState({
  icon = 'info',
  scene,
  title,
  text,
  action,
}: {
  icon?: IconName
  /** An illustrated page-level scene; without it the small icon form renders. */
  scene?: EmptyScene
  title?: string
  text?: string
  action?: ReactNode
}) {
  if (scene) {
    return (
      <div className={`empty-state empty-${scene}`}>
        <div className="empty-art">
          <Scene scene={scene} />
        </div>
        <div>
          {title && <p className="empty-title">{title}</p>}
          {text && <p className="reason">{text}</p>}
          {action && <p className="no-print">{action}</p>}
        </div>
      </div>
    )
  }
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
