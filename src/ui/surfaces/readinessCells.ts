// The MFA Readiness worklist's cells, once (task 012; Step 7): the role, the
// methods and their note, the proof lines, the readiness word, the action and
// the detail's Why and Next. The table on screen, its CSV, the Plan step's
// preview (MfaHandoff.tsx) and the inventory export read these functions, so a
// person reads the same wherever they are described.
//
// Every fact here is scoring/phishingResistant.ts `personReadiness`, carried on
// the row; this module only chooses its words. The words are pages.readiness.
// Pure.
import type { ReadinessRow, ShowKey } from '../../derive/mfaReadiness.ts'
import type { Facts } from '../../derive/facts.ts'
import type { Kind } from '../../derive/ladder.ts'
import { isQualifying } from '../../scoring/phishingResistant.ts'
import type { MethodClass, ProofLine, ReadinessState } from '../../scoring/phishingResistant.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'

type ReadinessWords = {
  states: Record<ReadinessState, { title: string }>
  show: Record<string, string>
  roles: { admin: string; person: string }
  kinds: Record<Kind, string>
  notAPerson: string
  methods: Record<MethodClass | 'none' | 'unknown' | 'join', string>
  methodsInSentence: Record<MethodClass, string>
  methodNotes: { registered: string; noPasskey: string; noQualifying: string; lost: string; unread: string; signInsUnread: string }
  proof: { line: string; lineRetained: string; anyPlatform: string; onPlatform: string; missing: string; notYetSeen: string; notQualifying: string; noQualifying: string; lost: string; unknown: string; signInsUnread: string }
  actions: { addPasskey: string; recommended: string; test: string; prove: string; setUp: string; restore: string; rescan: string }
  detail: Record<
    | 'title' | 'and'
    | 'whyReady' | 'whyReadyNoPlatform' | 'whyRetained' | 'whyProofMissing' | 'whyNoProof' | 'whySetUp' | 'whySetUpOther' | 'whyNoMethod' | 'whyLost' | 'whyUnknownMethods' | 'whyUnknownSignIns'
    | 'nextNone' | 'nextAddPasskey' | 'nextTest' | 'nextProve' | 'nextSetUp' | 'nextRestore' | 'nextRescan',
    string
  >
  ledger: Record<'notActive' | Kind, string>
}
const T = pages.readiness as unknown as ReadinessWords

/** A state's own word: Ready, Needs proof, Needs setup, Unknown. */
export function stateTitle(s: ReadinessState): string {
  return T.states[s].title
}

/** A method class as a cell names it. */
export function classWord(c: MethodClass): string {
  return T.methods[c]
}

/** A method class inside a sentence. */
function inSentence(c: MethodClass): string {
  return T.methodsInSentence[c]
}

/** "a", "a and b", "a, b and c". */
function listWords(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} ${T.detail.and} ${xs[xs.length - 1]}`
}

/**
 * The accounts the page does not count, each a filter of its own: the not
 * active and the kinds that are not people, every part that is not zero.
 */
export function footerParts(f: Facts): { key: string; text: string; show: ShowKey }[] {
  const n = (k: 'notActive' | Kind): number => (k === 'notActive' ? f.notActive : f.kinds[k])
  return (['notActive', 'emergency', 'service', 'shared', 'disabled'] as const).filter((k) => n(k) > 0).map((k) => ({ key: k, text: fillText(T.ledger[k], { n: n(k) }), show: k }))
}

/** The Role cell: the account's kind where it is not a person, Admin where the directory gives it a role (roles.ts, through the row), Person otherwise. */
export function roleWord(r: ReadinessRow): string {
  if (r.kind !== 'person') return T.kinds[r.kind]
  return r.admin ? T.roles.admin : T.roles.person
}

/** The readiness word: the state for a counted person, Not active, or not a person. */
export function readinessWord(r: ReadinessRow): string {
  if (r.kind !== 'person') return T.notAPerson
  return r.state !== null ? stateTitle(r.state) : T.show.notActive
}

/** A filter's word. */
export function showWord(key: string): string {
  return T.show[key] ?? key
}

export type MethodsCell = { main: string; note: string }

/**
 * The Methods cell: the qualifying methods held now where there are any, the
 * others where there are none; and the one note that matters about them — a
 * qualifying method gone since an earlier scan, none held, no passkey beside a
 * Ready method, or that the inventory could not be read.
 */
export function methodsCell(r: ReadinessRow): MethodsCell {
  if (r.methods === null) return { main: T.methods.unknown, note: T.methodNotes.unread }
  const qualifying = r.methods.filter(isQualifying)
  const shown = qualifying.length > 0 ? qualifying : r.methods
  const main = shown.length > 0 ? shown.map(classWord).join(` ${T.methods.join} `) : T.methods.none
  const rd = r.readiness
  if (!rd) return { main, note: '' }
  if (rd.unknown === 'signIns') return { main, note: T.methodNotes.signInsUnread }
  if (rd.qualifying.length === 0 && rd.lost.length > 0) return { main, note: fillText(T.methodNotes.lost, { method: classWord(rd.lost[0].cls) }) }
  if (rd.qualifying.length === 0) return { main, note: T.methodNotes.noQualifying }
  if (rd.hasPasskey === false) return { main, note: T.methodNotes.noPasskey }
  return { main, note: T.methodNotes.registered }
}

/** How a proof line is marked: proven, missing on a platform, not qualifying, not known, or a change since an earlier scan. */
export type ProofMark = 'good' | 'warn' | 'bad' | 'unknown' | 'history'
export type ProofText = { mark: ProofMark; text: string }

function proofText(p: ProofLine): string {
  if (p.os === null) return fillText(T.proof.anyPlatform, { method: classWord(p.cls) })
  return fillText(p.retained ? T.proof.lineRetained : T.proof.line, { method: classWord(p.cls), platform: p.os, date: monthDay(p.at) })
}

/**
 * The Proof cell, a line each: qualifying proof as method · platform, a platform
 * the person uses with no proof of it, the non-phishing-resistant method a
 * person without a qualifying one was seen with, a qualifying method that has
 * gone, or that the evidence could not be read. Never a proof the records do not
 * hold, and never "no sign-in record" for somebody the records show.
 */
export function proofLines(r: ReadinessRow): ProofText[] {
  const rd = r.readiness
  if (!rd) return []
  if (rd.unknown === 'methods') return [{ mark: 'unknown', text: T.proof.unknown }]
  if (rd.unknown === 'signIns') return [{ mark: 'unknown', text: T.proof.signInsUnread }]
  if (rd.state === 'needsSetup') {
    if (rd.lost.length > 0) return rd.lost.map((l) => ({ mark: 'history' as const, text: fillText(T.proof.lost, { method: classWord(l.cls), date: monthDay(l.lastSeen) }) }))
    if (rd.other) return [{ mark: 'bad', text: fillText(T.proof.notQualifying, { method: classWord(rd.other.cls) }) }]
    return [{ mark: 'bad', text: T.proof.noQualifying }]
  }
  const lines: ProofText[] = rd.proof.map((p) => ({ mark: 'good' as const, text: proofText(p) }))
  for (const os of rd.missing) lines.push({ mark: 'warn', text: fillText(T.proof.missing, { platform: os }) })
  if (lines.length === 0) lines.push({ mark: 'warn', text: T.proof.notYetSeen })
  return lines
}

export type RowAction = { text: string; recommended: boolean; rescan: boolean }

/**
 * The Action cell: the baseline's next action, or — for somebody Ready without
 * a passkey — the passkey recommendation, marked as a recommendation. Nothing
 * for somebody Ready with one, and nothing for an account the page does not
 * count.
 */
export function actionOf(r: ReadinessRow): RowAction | null {
  const rd = r.readiness
  if (!rd || r.state === null) return null
  const n = rd.next
  if (n.kind === 'none') return rd.recommended === 'addPasskey' ? { text: T.actions.addPasskey, recommended: true, rescan: false } : null
  if (n.kind === 'test') return { text: fillText(T.actions.test, { platform: n.platform }), recommended: false, rescan: false }
  if (n.kind === 'prove') return { text: fillText(T.actions.prove, { method: inSentence(n.cls) }), recommended: false, rescan: false }
  if (n.kind === 'setUp') return { text: T.actions.setUp, recommended: false, rescan: false }
  if (n.kind === 'restore') return { text: fillText(T.actions.restore, { method: inSentence(n.cls) }), recommended: false, rescan: false }
  return { text: T.actions.rescan, recommended: false, rescan: true }
}

/** The recommendation's own label under a recommended action. */
export function recommendedWord(): string {
  return T.actions.recommended
}

export type Detail = { title: string; why: string[]; next: string[]; rescan: boolean }

/**
 * The detail one level deep: Why, and Next. For somebody Ready without a
 * passkey the baseline's answer (nothing) and the recommendation are two
 * separate lines, so the recommendation is never read as a requirement.
 */
export function detailOf(r: ReadinessRow): Detail | null {
  const rd = r.readiness
  if (!rd) return null
  const D = T.detail
  const name = r.user.displayName ?? r.user.userPrincipalName ?? ''
  const title = fillText(D.title, { name, state: stateTitle(r.state ?? rd.state) })
  const proofList = (lines: readonly ProofLine[]): string => listWords(lines.map((p) => (p.os === null ? classWord(p.cls) : fillText(T.proof.onPlatform, { method: classWord(p.cls), platform: p.os }))))
  const retained = rd.proof.filter((p) => p.retained)
  const earlier = retained.length > 0 ? [fillText(D.whyRetained, { proof: proofList(retained) })] : []
  if (rd.unknown === 'methods') return { title, why: [fillText(D.whyUnknownMethods, { name })], next: [D.nextRescan], rescan: true }
  if (rd.unknown === 'signIns') return { title, why: [fillText(D.whyUnknownSignIns, { methods: listWords(rd.qualifying.map(inSentence)) })], next: [D.nextRescan], rescan: true }
  if (rd.state === 'needsSetup') {
    if (rd.lost.length > 0) return { title, why: [fillText(D.whyLost, { method: inSentence(rd.lost[0].cls), date: monthDay(rd.lost[0].lastSeen) })], next: [fillText(D.nextRestore, { method: inSentence(rd.lost[0].cls) })], rescan: false }
    if ((rd.methods ?? []).length === 0) return { title, why: [D.whyNoMethod], next: [D.nextSetUp], rescan: false }
    const other = rd.other ? [fillText(D.whySetUpOther, { method: inSentence(rd.other.cls) })] : []
    return { title, why: [fillText(D.whySetUp, { methods: listWords((rd.methods ?? []).map(inSentence)) }), ...other], next: [D.nextSetUp], rescan: false }
  }
  if (rd.state === 'needsProof') {
    // No proof anywhere: the Next agrees with the row's action — a platform in use to test where one is seen, the method to use once where none is.
    if (rd.proof.length === 0) {
      const next = rd.missing.length > 0 ? fillText(D.nextTest, { platform: listWords(rd.missing) }) : fillText(D.nextProve, { method: inSentence(rd.qualifying[0]) })
      return { title, why: [fillText(D.whyNoProof, { methods: listWords(rd.qualifying.map(inSentence)) })], next: [next], rescan: false }
    }
    return { title, why: [fillText(D.whyProofMissing, { proof: proofList(rd.proof), name, missing: listWords(rd.missing) }), ...earlier], next: [fillText(D.nextTest, { platform: listWords(rd.missing) })], rescan: false }
  }
  const why = [fillText(rd.platforms.length > 0 ? D.whyReady : D.whyReadyNoPlatform, { proof: proofList(rd.proof), name }), ...earlier]
  return { title, why, next: rd.recommended === 'addPasskey' ? [D.nextNone, D.nextAddPasskey] : [D.nextNone], rescan: false }
}

/** What the search box matches: the person, their role, their methods, their proof and their state. */
export function searchText(r: ReadinessRow): string {
  return [r.user.displayName ?? '', r.user.userPrincipalName ?? '', roleWord(r), methodsCell(r).main, ...proofLines(r).map((l) => l.text), readinessWord(r)].join(' ').toLowerCase()
}

/** A row as its CSV writes it, in the columns' order after the name: role, methods, proof, readiness, action. */
export function rowCells(r: ReadinessRow): string[] {
  return [roleWord(r), methodsCell(r).main, proofLines(r).map((l) => l.text).join('; '), readinessWord(r), actionOf(r)?.text ?? '']
}
