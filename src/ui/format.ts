// Date and CSV helpers. Dates render relative (with the absolute form on
// hover) via Intl in the browser's locale and time zone — nothing hand-rolled.

const REL = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// Display time zone is a Setup answer; storage stays UTC.
let displayTimeZone: string | undefined

export function setDisplayTimeZone(tz: string | null): void {
  displayTimeZone = tz ?? undefined
}

export function absolute(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: displayTimeZone,
  }).format(new Date(iso))
}

export function absoluteDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: displayTimeZone }).format(
    new Date(iso),
  )
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

// Plain names for Graph MFA method identifiers (mfaDetail.authMethod and
// authenticationDetails method strings). Returns null for the generic
// fallback so callers can say "MFA completed" instead of "MFA via MFA".
export function friendlyMethod(method: string): string | null {
  const m = method.toLowerCase()
  if (m === 'mfa') return null
  if (m.includes('passwordless')) return 'Authenticator passwordless'
  if (m.includes('notification') || m === 'phoneappnotification') return 'Microsoft Authenticator notification'
  if (m.includes('phoneapp') || m.includes('mobile app')) return 'Authenticator app code'
  if (m.includes('sms') || m.includes('text message')) return 'text message'
  if (m.includes('voice') || m.includes('phone call')) return 'phone call'
  if (m.includes('fido')) return 'FIDO2 security key'
  if (m.includes('windows hello')) return 'Windows Hello'
  if (m.includes('hardware')) return 'hardware OTP'
  if (m.includes('oath') || m.includes('verification code')) return 'software OTP'
  if (m.includes('temporary access')) return 'Temporary Access Pass'
  return method
}

export function elapsedLabel(startedAtMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
