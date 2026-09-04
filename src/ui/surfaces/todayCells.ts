// The Today table's cells, once (docs/design/mockups/today-v2.html): the
// readiness word (the rung's title, Not active, or not a person), the kind tag,
// the method word and the evidence line, read by the table on screen and by
// Today as CSV (inventoryTables.ts todayTable), so a row's CSV cells equal its
// screen cells. The words are pages.today, pages.ladder and app.today. Pure.
import type { TodayRow } from '../../derive/today.ts'
import type { Facts } from '../../derive/facts.ts'
import type { Kind, MethodWord, Rung } from '../../derive/ladder.ts'
import { app, pages, shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate, relative } from '../../copy/dates.ts'
import { friendlyMethod } from '../format.ts'
import { lowerFirst } from '../../copy/statements.ts'

export { SHOW_KEYS } from '../../derive/today.ts'
export type { ShowKey } from '../../derive/today.ts'

type TodayWords = {
  ledger: { lead: string } & Record<'active' | 'notActive' | Kind, string>
  show: Record<string, string>
  kinds: Record<Kind, string>
  notAPerson: string
  methods: Record<MethodWord, string>
  evidence: { windowsHello: string; phones: string; phonesSome: string; noPhones: string; lastSignIn: string }
}
type LadderWords = { header: string; of: string; prioritise: string; rungs: Record<`r${Rung}`, { title: string; tip: string; desc: string }> }
const T = pages.today as unknown as TodayWords
const L = pages.ladder as unknown as LadderWords
const C = app.today
const SIGNALS = shared.sharedDeviceSignals as Record<string, string>

/** The ledger line: the accounts, then every part that is not zero, in the content's order, the parts summing to the accounts (derive/facts.ts). */
export function ledgerText(f: Facts): string {
  const n = (k: 'active' | 'notActive' | Kind): number => (k === 'active' ? f.active : k === 'notActive' ? f.notActive : f.kinds[k])
  const parts = (['active', 'notActive', 'emergency', 'service', 'shared', 'disabled'] as const).filter((k) => n(k) > 0).map((k) => fillText(T.ledger[k], { n: n(k) }))
  return `${fillText(T.ledger.lead, { accounts: f.accounts })} ${parts.join(' · ')}`
}

/** The word beside an uncounted person's badge: not active. */
export function notActiveWord(): string {
  return lowerFirst(T.show.notActive)
}

/** The rung's words: title, the tooltip, the one-line description. */
export function rungWords(rung: Rung): { title: string; tip: string; desc: string } {
  return L.rungs[`r${rung}`]
}

/** The ladder's header words. */
export const ladderWords = { header: L.header, of: (n: number): string => fillText(L.of, { n }), prioritise: L.prioritise }

/** The readiness cell's word: the rung's title for an active person, Not active, or not a person. */
export function readinessWord(r: TodayRow): string {
  if (r.kind !== 'person') return T.notAPerson
  return r.active && r.rung !== null ? rungWords(r.rung).title : T.show.notActive
}

/** The kind tag on an account that is not a person. */
export function kindWord(kind: Kind): string {
  return T.kinds[kind]
}

/** The Show option's word: a rung's title, or the content's word for the rest. */
export function showWord(key: string): string {
  return key.startsWith('rung-') ? rungWords(Number(key.slice(5)) as Rung).title : T.show[key]
}

export function methodWord(m: MethodWord): string {
  return T.methods[m]
}

/** The evidence line: the MFA method and when, the one PC and the phones, or why there is none. */
export function todayEvidenceText(r: TodayRow): string {
  const e = r.evidence
  switch (e.kind) {
    case 'mfa': {
      const name = friendlyMethod(e.method)
      return name ? fillText(C.mfaVia, { method: name, when: relative(e.at) }) : fillText(C.mfaCompleted, { when: relative(e.at) })
    }
    case 'windowsHello': {
      const phones = e.phones === null ? T.evidence.phonesSome : e.phones > 0 ? fillText(T.evidence.phones, { n: e.phones }) : T.evidence.noPhones
      return `${T.evidence.windowsHello} · ${phones}`
    }
    case 'neverSignedIn':
      return C.neverSignedIn
    case 'inactive':
      return fillText(C.inactiveSince, { date: absoluteDate(e.since) })
    case 'noMethod':
      return C.noMethodEvidence
    case 'lastSignIn':
      return fillText(T.evidence.lastSignIn, { when: relative(e.at) })
    case 'sharedDevice':
      return e.signals.map((s) => SIGNALS[s]).join(' · ')
    default:
      return e.reasons.join('; ')
  }
}
