// UI helpers: dates come from src/copy/dates.ts (shared with the engine);
// CSV and download live here because they touch the DOM.
export { STALE_SCAN_DAYS, absolute, absoluteDate, dateRange, relative, relativeDays, scanAgeDays, setDisplayTimeZone, when, whenAt } from '../copy/dates.ts'

/**
 * The characters a spreadsheet treats as the start of a formula rather than
 * text. A cell beginning with one of these is evaluated on open — =HYPERLINK to
 * exfiltrate the row, =WEBSERVICE to fetch, or a DDE payload.
 *
 * Every value in these files is a tenant display name, sign-in address or
 * department, and in a default Entra tenant any member can create a group and
 * any guest sets their own display name (audit redact-01). The audience for
 * these exports is an admin opening the recipient list in Excel to work a mail
 * merge, which is the exact circumstance the attack needs.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/

/**
 * A formula character at the start of a piece a spreadsheet could split off the
 * value: after a ',' (this file's separator), a ';' (the list separator Excel
 * splits a double-clicked .csv at in most of continental Europe) or a tab, with
 * any whitespace before it (security audit, 2026-09-29).
 */
const SPLIT_FORMULA_LEAD = /(?:^|[;,\t])\s*[=+\-@]/

/**
 * A point inside a value where a formula character starts the next piece: after
 * a ';', a tab or a line break, with any whitespace. Where the list separator is
 * ';', Excel honours a double quote only as the first character of a ';'-piece,
 * so a value in any column after the first is split at its own ';' however it
 * is quoted, and the apostrophe at the start of the value never reaches the
 * piece split off. The piece is marked where it starts (security review,
 * 2026-09-29).
 */
const FORMULA_AT_SPLIT = /([;\t\r\n]\s*)(?=[=+\-@])/g

/** A value holding any of these is quoted, so no reader splits it or ends its line inside it. */
const NEEDS_QUOTES = /[",;\t\n\r]/

/** The dash a table shows in an empty cell. */
const EMPTY_CELL = '—'

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined): string => {
    // A cell the screen fills with a dash for "nothing" is blank in a file: the
    // inventory tables wrote "—" where MFA Readiness wrote nothing (F-127).
    let s = v === null || v === undefined || v === EMPTY_CELL ? '' : String(v)
    // An apostrophe is what every spreadsheet reads as "this is text"; it is
    // not rendered in the cell.
    if (FORMULA_LEAD.test(s) || SPLIT_FORMULA_LEAD.test(s)) s = `'${s}`
    s = s.replace(FORMULA_AT_SPLIT, "$1'")
    return NEEDS_QUOTES.test(s) ? `"${s.replaceAll('"', '""')}"` : s
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
