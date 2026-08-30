// UI helpers: dates come from src/copy/dates.ts (shared with the engine);
// CSV and download live here because they touch the DOM.
export { STALE_SCAN_DAYS, absolute, absoluteDate, dateRange, relative, relativeDays, scanAgeDays, setDisplayTimeZone, when, whenAt } from '../copy/dates.ts'

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

// Downloads live in src/ui/exportGuard.ts, which applies redaction. This
// function was the choke point every export passed through while applying
// nothing (audit redact-06); it is deliberately not re-exported so nothing can
// reach a download without stating a disposition.
