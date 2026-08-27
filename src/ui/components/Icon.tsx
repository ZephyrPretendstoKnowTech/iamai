// One inline SVG icon set: 20px grid, 1.5px stroke, currentColor. No emoji.
export type IconName =
  | 'shield'
  | 'user'
  | 'users'
  | 'key'
  | 'device'
  | 'location'
  | 'policy'
  | 'chart'
  | 'check'
  | 'alert'
  | 'info'
  | 'external-link'
  | 'download'
  | 'print'
  | 'copy'
  | 'refresh'
  | 'lock'
  | 'search'
  | 'chevron'
  | 'close'

const PATHS: Record<IconName, string> = {
  shield: 'M10 2.5l6 2.5v4.5c0 3.8-2.5 6.7-6 8-3.5-1.3-6-4.2-6-8V5l6-2.5z',
  user: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 17.5c.6-3 3.2-5 6.5-5s5.9 2 6.5 5',
  users: 'M7.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 17c.5-2.8 2.6-4.5 5-4.5s4.5 1.7 5 4.5M13 3.7a3 3 0 0 1 0 5.6M14.5 12.7c1.7.5 2.8 1.9 3 4.3',
  key: 'M12.5 2.5a5 5 0 0 0-4.7 6.7L2.5 14.5v3h3l1-1v-2h2v-2h2l1.3-1.3A5 5 0 1 0 12.5 2.5zM13.5 6.5h.01',
  device: 'M3 4.5h14v9H3zM7 17.5h6M10 13.5v4',
  location: 'M10 17.5s-5.5-5.2-5.5-9a5.5 5.5 0 0 1 11 0c0 3.8-5.5 9-5.5 9zM10 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  policy: 'M5 2.5h7l3 3v12H5zM12 2.5v3h3M7.5 9.5h5M7.5 12.5h5M7.5 15.5h3',
  chart: 'M3 17.5h14M5.5 14v-4M9.5 14V6M13.5 14v-7M17 14v-3',
  check: 'M4 10.5l4 4 8-9',
  alert: 'M10 3l7.5 13h-15L10 3zM10 8v4M10 14.5h.01',
  info: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10 9v5M10 6.5h.01',
  'external-link': 'M8.5 4.5H4.5v11h11v-4M11.5 3.5h5v5M16.5 3.5l-7 7',
  download: 'M10 3v10M6 9l4 4 4-4M3.5 16.5h13',
  print: 'M6 7V3h8v4M4 7h12v7h-2.5M6 12h8v5H6zM6 14H4V7',
  copy: 'M7.5 7.5h9v9h-9zM3.5 12.5v-9h9',
  refresh: 'M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v4h-4',
  lock: 'M5 9h10v8H5zM7 9V6.5a3 3 0 0 1 6 0V9',
  search: 'M9 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 13l4 4',
  chevron: 'M7 5l5 5-5 5',
  close: 'M5 5l10 10M15 5L5 15',
}

export function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  )
}
