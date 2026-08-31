import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip.tsx'

// A number with its label and, when it carries one, its definition (prompt 47
// Part 5). Class names keep the `stat-num` / `stat-label` hooks the UI
// inventory reads: the label is the tile, the number is stripped before
// measuring.
export function Tile({ value, label, sub, tip }: { value: number | string; label: string; sub?: string; tip?: { title: string; text: string } }) {
  return (
    <div className="tile">
      <div className="stat-num">{value}</div>
      <div className="stat-label">
        {label}
        {tip && <InfoTip title={tip.title} text={tip.text} />}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className="tiles">{children}</div>
}
