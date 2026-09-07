// The MFA Readiness table's cells, once: the readiness word (the group's title,
// Not active, or not a person), the kind tag, the method word, the proof line and
// the next remediation state. The table on screen and the CSV read the same
// functions (inventoryTables.ts readinessTable), so a row's exported cells equal
// its rendered cells.
//
// A group's title is what the page calls the rung a person stands on; the rung
// itself stays the badge beside it, so nothing an operator could read here is
// lost when the label is coarser than the ladder. The next state is a state and
// not a workflow: task 014 owns the setup guidance, and until it exists this
// says what has to become true and offers no link that goes nowhere.
//
// The words are pages.readiness, pages.ladder and app.readiness. Pure.
import type { ReadinessGroup, ReadinessRow } from '../../derive/mfaReadiness.ts'
import type { Facts } from '../../derive/facts.ts'
import type { Kind, MethodWord, Rung } from '../../derive/ladder.ts'
import { app, pages, shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate, relative } from '../../copy/dates.ts'
import { friendlyMethod } from '../format.ts'
import { lowerFirst } from '../../copy/statements.ts'

export { SHOW_KEYS } from '../../derive/mfaReadiness.ts'
export type { ShowKey } from '../../derive/mfaReadiness.ts'
import type { ShowKey } from '../../derive/mfaReadiness.ts'

type ReadinessWords = {
  ledger: { lead: string } & Record<'active' | 'notActive' | Kind, string>
  show: Record<string, string>
  groups: Record<ReadinessGroup, { title: string; tip: string; next: string }>
  kinds: Record<Kind, string>
  notAPerson: string
  methods: Record<MethodWord, string>
  evidence: { windowsHello: string; phones: string; phonesSome: string; noPhones: string; lastSignIn: string }
}
type LadderWords = { header: string; of: string; prioritise: string; rungs: Record<`r${Rung}`, { title: string; tip: string; desc: string }> }
const T = pages.readiness as unknown as ReadinessWords
const L = pages.ladder as unknown as LadderWords
const C = app.readiness
const SIGNALS = shared.sharedDeviceSignals as Record<string, string>

/**
 * The ledger in parts: the accounts, then every part that is not zero, in the
 * content's order, the parts summing to the accounts (derive/facts.ts). `show`
 * is the filter that part opens, so the populations the campaign does not count
 * stay reachable from the quiet line under the table; the active people have no
 * filter of their own, because the whole page is about them.
 */
export function ledgerParts(f: Facts): { lead: string; parts: { key: string; text: string; show: ShowKey | null }[] } {
  const n = (k: 'active' | 'notActive' | Kind): number => (k === 'active' ? f.active : k === 'notActive' ? f.notActive : f.kinds[k])
  return {
    lead: fillText(T.ledger.lead, { accounts: f.accounts }),
    parts: (['active', 'notActive', 'emergency', 'service', 'shared', 'disabled'] as const)
      .filter((k) => n(k) > 0)
      .map((k) => ({ key: k, text: fillText(T.ledger[k], { n: n(k) }), show: k === 'active' ? null : (k as ShowKey) })),
  }
}

/** The ledger as one line: what the parts read when nothing is a link (the CSV, the walk, a test). */
export function ledgerText(f: Facts): string {
  const { lead, parts } = ledgerParts(f)
  return `${lead} ${parts.map((p) => p.text).join(' · ')}`
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

/** A group's words: the title the page and the table show, what it means, and the state that would clear it. */
export function groupWords(g: ReadinessGroup): { title: string; tip: string; next: string } {
  return T.groups[g]
}

/** The readiness cell's word: the group's title for an active person, Not active, or not a person. */
export function readinessWord(r: ReadinessRow): string {
  if (r.kind !== 'person') return T.notAPerson
  return r.group !== null ? groupWords(r.group).title : T.show.notActive
}

/**
 * The next state for this person, where there is one to name. Empty on anybody
 * already passkey-ready and on every account the campaign does not count: an
 * account that is not a person has no passkey to adopt.
 */
export function nextStateWord(r: ReadinessRow): string {
  return r.group === null ? '' : groupWords(r.group).next
}

/** The kind tag on an account that is not a person. */
export function kindWord(kind: Kind): string {
  return T.kinds[kind]
}

/** The Show option's word: a rung's title where a link filtered to one, the content's word for the rest. */
export function showWord(key: string): string {
  return key.startsWith('rung-') ? rungWords(Number(key.slice(5)) as Rung).title : T.show[key]
}

export function methodWord(m: MethodWord): string {
  return T.methods[m]
}

/** The evidence line: the MFA method and when, the one PC and the phones, or why there is none. */
export function rowEvidenceText(r: ReadinessRow): string {
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
