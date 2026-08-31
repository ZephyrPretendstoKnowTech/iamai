// How old the scan is (prompt 47 Part 3): the header's "Re-scan · scanned 24h
// ago" reads this. Pure: numbers only, the words live in src/copy.
export type ScanAge = { hours: number; days: number }

export function scanAge(iso: string, nowMs = Date.now()): ScanAge {
  const ms = nowMs - Date.parse(iso)
  const hours = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 3_600_000) : 0
  return { hours, days: Math.floor(hours / 24) }
}
