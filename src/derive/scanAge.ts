import { app } from '../content/content.ts'
import { fillText } from '../content/render.ts'
// How old the scan is (prompt 47 Part 3): the header's "Re-scan · scanned 24h
// ago" reads this. Pure: the numbers, and the header words from content.json.
export type ScanAge = { hours: number; days: number }

export function scanAge(iso: string, nowMs = Date.now()): ScanAge {
  const ms = nowMs - Date.parse(iso)
  const hours = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 3_600_000) : 0
  return { hours, days: Math.floor(hours / 24) }
}

/** "just now", "24h ago", "3d ago": the scan's age in the header's words. */
export function scanAgeWords(age: { hours: number; days: number }): string {
  const S = app.shell
  return age.hours < 1 ? S.justNow : age.hours < 48 ? fillText(S.hoursAgo, { hours: age.hours }) : fillText(S.daysAgo, { days: age.days })
}

/** "Scan to update the plan · scanned 24h ago": the header control, as target-state §2 writes it. */
export function rescanLabel(age: { hours: number; days: number }): string {
  return fillText(app.shell.rescanScanned, { age: scanAgeWords(age) })
}
