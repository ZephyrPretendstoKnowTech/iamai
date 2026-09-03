// The Today table's cells, once (target-state §4): the state word from
// pages.today.show and the evidence line from app.today, read by the table on
// screen and by Today as CSV, so a row's CSV cells equal its screen cells. Pure.
import type { TodayRow, TodayState } from '../../derive/today.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate, relative } from '../../copy/dates.ts'
import { friendlyMethod } from '../format.ts'

// The Show list is pages.today.show, in the six-state model the table uses: All,
// the six states, Admins, Guests — keyed by position (derive/today.ts SHOW_KEYS).
import { SHOW_KEYS, TILE_STATES } from '../../derive/today.ts'
export { SHOW_KEYS } from '../../derive/today.ts'
export type { ShowKey } from '../../derive/today.ts'
const T = pages.today as unknown as { show: string[] }
const C = app.today

/** The state's word, from the Show list (the six states sit at positions 1 to 6). */
export function todayStateWord(state: TodayState): string {
  return T.show[SHOW_KEYS.indexOf(state)]
}

/** A tile's label: the states it groups, in the table's own words, joined ("Likely works · Never prompted · Possibly broken"). */
export function tileLabel(tile: keyof typeof TILE_STATES): string {
  return TILE_STATES[tile].map(todayStateWord).join(' · ')
}

/** The evidence line: the MFA method and when, or why there is none. */
export function todayEvidenceText(r: TodayRow): string {
  const e = r.evidence
  switch (e.kind) {
    case 'mfa': {
      const name = friendlyMethod(e.method)
      return name ? fillText(C.mfaVia, { method: name, when: relative(e.at) }) : fillText(C.mfaCompleted, { when: relative(e.at) })
    }
    case 'neverSignedIn':
      return C.neverSignedIn
    case 'inactive':
      return fillText(C.inactiveSince, { date: absoluteDate(e.since) })
    case 'signedInNow':
      return C.signedInNow
    case 'noMethod':
      return C.noMethodEvidence
    default:
      return e.reasons.join('; ')
  }
}
