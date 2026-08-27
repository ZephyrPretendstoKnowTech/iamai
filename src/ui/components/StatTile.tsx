import { InfoTip } from './InfoTip.tsx'

export type StatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function StatTile({
  value,
  label,
  tone = 'neutral',
  tip,
  onClick,
  active,
}: {
  value: number | string
  label: string
  tone?: StatTone
  tip?: { title: string; text: string }
  onClick?: () => void
  active?: boolean
}) {
  const cls = `stat stat-${tone} ${onClick ? 'stat-clickable' : ''} ${active ? 'stat-active' : ''}`
  const body = (
    <>
      <div className="stat-num">{value}</div>
      <div className="stat-label">
        {label}
        {tip && <InfoTip title={tip.title} text={tip.text} />}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={active} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="stats">{children}</div>
}
