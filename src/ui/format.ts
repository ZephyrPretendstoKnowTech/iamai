// Date and CSV helpers. Dates render relative (with the absolute form on
// hover) via Intl in the browser's locale and time zone — nothing hand-rolled.

const ABS = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const ABS_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const REL = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function absolute(iso: string): string {
  return ABS.format(new Date(iso))
}

export function absoluteDate(iso: string): string {
  return ABS_DATE.format(new Date(iso))
}

export function relative(iso: string): string {
  const diffMs = Date.parse(iso) - Date.now()
  const abs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (abs < hour) return REL.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return REL.format(Math.round(diffMs / hour), 'hour')
  if (abs < 60 * day) return REL.format(Math.round(diffMs / day), 'day')
  return REL.format(Math.round(diffMs / (30 * day)), 'month')
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
