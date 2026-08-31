// Today (prompt 47 Part 5, target-state §4): where things are now, in one
// screen, counted over active people. Nothing here asks for a decision.
import { count } from './statements.ts'
import type { TodayState } from '../derive/today.ts'

export const TODAY = {
  title: 'Today',
  /** "4 active people of 12 enabled · 2 admins · sign-ins Jul 30 → Aug 29"; branches for none enabled and no records. */
  line: (c: { active: number; enabled: number; admins: number }, window: string | null, noRecordsReason: string | null): string => {
    const people = c.enabled === 0 ? 'no enabled people' : `${count(c.active, 'active person', 'active people')} of ${c.enabled} enabled`
    const records = window ? `sign-ins ${window}` : noRecordsReason ? `no sign-in records (${noRecordsReason})` : 'no sign-in records'
    return `${people} · ${count(c.admins, 'admin')} · ${records}`
  },
  tiles: { proven: 'MFA proven', unproven: 'Registered, unproven', noMethod: 'No method', notActive: 'Not active' },
  /** "3 · 75%": the count, then its share of active people; a tenant with nobody active shows the count alone. */
  share: (n: number, active: number): string => (active === 0 ? String(n) : `${n.toLocaleString('en')} · ${Math.round((n / active) * 100)}%`),
  show: 'Show:',
  showOptions: {
    all: 'All',
    proven: 'MFA proven',
    unproven: 'Registered, unproven',
    noMethod: 'No method',
    notActive: 'Not active',
    admins: 'Admins',
    guests: 'Guests',
  },
  search: 'Search people',
  columns: { person: 'Person', state: 'State', method: 'Strongest method', evidence: 'Evidence', signInAddress: 'Sign-in address' },
  /** The six-state MFA model in plain words. */
  state: {
    proven: 'Proven',
    likely: 'Likely works',
    neverPrompted: 'Never prompted',
    possiblyBroken: 'Possibly broken',
    noMethod: 'No method',
    notActive: 'Not active',
  } satisfies Record<TodayState, string>,
  admin: 'Admin',
  guest: 'Guest',
  // Evidence: one clause per row.
  mfaVia: (method: string, when: string) => `MFA via ${method} ${when}`,
  mfaCompleted: (when: string) => `MFA completed ${when}`,
  neverSignedIn: 'no sign-in on record',
  inactiveSince: (date: string) => `inactive since ${date}`,
  noMethodEvidence: 'no MFA-capable method registered',
  noMatch: 'Nobody matches.',
  everything: 'Everything the scan read →',
  // Signed in, no scan yet.
  needsScan: 'Nothing to show until the first scan.',
  scanLink: 'Scan the tenant',
}
