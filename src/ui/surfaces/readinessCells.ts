// The MFA Readiness worklist's cells, once (prompt 62): the device chips, the
// methods, the next step, the detail panel's facts and the CSV row. The page, its
// CSV, the Export bundle and the inventory read these functions, so a person
// reads the same wherever they are described.
//
// Every fact here is scoring/phishingResistant.ts `personReadiness`, carried on
// the row; this module only chooses its words. The words are pages.readiness.
// Pure.
import type { Explained, ReadinessRow } from '../../derive/mfaReadiness.ts'
import type { Kind } from '../../derive/ladder.ts'
import type { SetupCheck } from '../../derive/readinessSetup.ts'
import { AUTHENTICATOR_AAGUIDS, isQualifying } from '../../scoring/phishingResistant.ts'
import type { CredentialReading, DeviceReading, MethodClass, NextAction, Platform, ReadinessState, SignInOption } from '../../scoring/phishingResistant.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'

/** The computers seen in the tenant: they choose the words that name a computer's built-in option (owner, 2026-09-19). */
export type ComputersSeen = 'windows' | 'mac' | 'both' | 'none'
/** One sentence per set of computers seen. */
type ByComputers = Record<ComputersSeen, string>

type Words = {
  lead: ByComputers
  seamlessLine: string
  seamlessNone: string
  seamlessNotPossible: string
  methodsInline: Record<MethodClass, string>
  states: Record<ReadinessState, { title: string }>
  show: Record<string, string>
  groups: Record<ReadinessState, { title: string; why: string; body?: string | ByComputers }>
  chip: Record<'seamless' | 'confirmed' | 'covered' | 'notConfirmed' | 'notSetUp' | 'noPasskey' | 'blocked' | 'unread' | 'noPhone', string>
  sub: { noDevices: string }
  notReadCount: string
  methods: Record<MethodClass | 'none' | 'unread' | 'only' | 'notAllowed', string>
  lastConfirmed: string
  beforeWindow: string
  readyUntil: string
  usedRecently: string
  unusedKey: { never: string; stale: string }
  options: Record<SignInOption, string>
  next: {
    none: string; seamless: string; setUp: string; restore: string; confirm: string; returnConfirm: string; guest: string; addDevice: string; updateOs: string; confirmOn: string; replaceKey: string
    waitSetup: Record<string, string>; rescan: Record<string, string>
  }
  notes: { automated: string; onLeave: string }
  panel: {
    best: string
    now: string
    allowed: string
    lastConfirmed: string
    lastSeen: string
    trust: Record<'joined' | 'hybrid' | 'registered' | 'none' | 'unknown', string>
    whyNot: Record<string, string>
    proofNow: { seamless: string; confirmed: string; none: string; covered: string }
    verdict: Record<'yes' | 'no' | 'unknown', string>
    step3: Record<'yes' | 'no' | 'unknown', string>
    never: string
    lastUsed: string
    lastUsedDate: string
    unused: { never: string; stale: string }
    retained: string
    unlisted: string
    why: Record<string, string>
  }
  checks: Record<string, Record<string, string>>
  counted: Record<Explained | Kind | 'dormantLink', string>
  admin: string
  guest: string
  and: string
}
const T = pages.readiness as unknown as Words

/** A state's own word. */
export function stateTitle(s: ReadinessState): string {
  return T.states[s].title
}

/** A filter's word. */
export function showWord(key: string): string {
  return T.show[key] ?? key
}

/** A method class as a cell names it. */
export function classWord(c: MethodClass): string {
  return T.methods[c]
}

/** "a", "a and b", "a, b and c". */
export function listWords(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} ${T.and} ${xs[xs.length - 1]}`
}

/** A platform family as people say it: an iPhone and an Android phone, the computers by name. */
export function osWord(os: Platform): string {
  return os === 'iOS' ? 'iPhone' : os === 'Android' ? 'Android' : os
}

/**
 * Which computers the tenant's people were seen signing in from: Windows, Mac,
 * both or neither. The words that name a computer's built-in option follow it,
 * so a Mac-only tenant is never told about Windows Hello. Every row's devices
 * count, counted or not: the words describe the tenant, not a filter.
 */
export function computersSeen(rows: readonly ReadinessRow[]): ComputersSeen {
  const seen = new Set(rows.flatMap((r) => (r.readiness?.devices ?? []).filter((d) => d.type === 'computer').map((d) => d.os)))
  const windows = seen.has('Windows')
  const mac = seen.has('macOS')
  return windows && mac ? 'both' : windows ? 'windows' : mac ? 'mac' : 'none'
}

/** The page's opening line, in the words for the computers seen. */
export function leadLine(seen: ComputersSeen): string {
  return T.lead[seen]
}

/** A group's body under its summary, where it has one, in the words for the computers seen. */
export function groupBodyLine(state: ReadinessState, seen: ComputersSeen): string | null {
  const body = T.groups[state].body
  return body === undefined ? null : typeof body === 'string' ? body : body[seen]
}

/**
 * The answer's second line: how many are Seamless; or, with nobody Seamless, how
 * to get there, but only when somebody's device offers a built-in option (a
 * personal PC never does, so a tenant of them is told so, not given a target).
 *
 * Empty when no device was read at all. Both of the nobody-Seamless lines are
 * claims about the devices these people sign in from — one offers a target on
 * them, the other says they rule it out — and neither survives a scan that saw
 * no device: "everyone signs in from a device with no built-in option" would be
 * explaining an absence the headline above it has just said it cannot measure
 * (S4-23). The page draws no line rather than assert a cause for it.
 */
export function goalLine(counted: readonly ReadinessRow[]): string {
  const seamless = counted.filter((r) => r.state === 'seamless').length
  if (seamless > 0) return fillText(T.seamlessLine, { seamless })
  const withDevices = counted.filter((r) => (r.readiness?.devices ?? []).length > 0)
  if (withDevices.length === 0) return ''
  // A person can become Seamless only when every device they use is, or could be: one personal PC rules them out.
  const couldBe = withDevices.some((r) => (r.readiness?.devices ?? []).every((d) => d.seamless || (d.builtIn && d.possible !== 'no')))
  return couldBe ? T.seamlessNone : T.seamlessNotPossible
}

/** A device's name with its version where the record gave one: Windows 10, iOS 17; otherwise the family's word. */
export function versionWord(os: Platform, version: string | null): string {
  // Sign-in records report Windows 11 as "Windows10", so a Windows version would mislead.
  if (os === 'Windows') return 'Windows'
  const major = /(\d+)/.exec(version ?? '')?.[1]
  const name = /^ipad/i.test(version ?? '') ? 'iPadOS' : os
  return major ? `${name} ${major}` : /^ipad/i.test(version ?? '') ? 'iPad' : osWord(os)
}

/** A device family in a sentence: the Windows computer, the Mac, the iPhone. */
export function deviceNoun(os: Platform): string {
  return os === 'iOS' ? 'the iPhone' : os === 'Android' ? 'the Android phone' : os === 'macOS' ? 'the Mac' : `the ${os} computer`
}

/** The Role word under the person. */
export function roleWord(r: ReadinessRow): string {
  if (r.kind !== 'person') return T.show[r.kind] ?? r.kind
  return r.admin ? T.admin : ''
}

export type Chip = { kind: 'computer' | 'phone'; os: string; word: string; tone: ReadinessState | 'unread'; title: string }

/** A device's chip: the device, and where it stands. A device whose type is proven on another device of that type reads Covered. */
export function deviceChip(d: DeviceReading, state: ReadinessState, holdsPasskey = false): Chip {
  const tone: Chip['tone'] = d.seamless ? 'seamless' : d.proof || d.covered ? 'ready' : state === 'blocked' ? 'blocked' : state === 'method' ? 'method' : state === 'unknown' ? 'unread' : d.type === 'phone' && state === 'device' && !holdsPasskey ? 'device' : 'confirm'
  // In Needs a device, a phone with no passkey reads No passkey; a device whose method the person already holds reads Not confirmed.
  const word = d.seamless ? T.chip.seamless : d.proof ? T.chip.confirmed : d.covered ? T.chip.covered : state === 'blocked' ? T.chip.blocked : state === 'method' ? T.chip.notSetUp : state === 'device' && d.type === 'phone' && !holdsPasskey ? T.chip.noPasskey : T.chip.notConfirmed
  const trust = d.trust ?? 'unknown'
  return { kind: d.type, os: osWord(d.os), word, tone, title: `${versionWord(d.os, d.version)}. ${T.panel.trust[trust]}` }
}

/** The row's chips: each device seen in the window, and a quiet note where no phone signed in. */
export function deviceChips(r: ReadinessRow): { chips: Chip[]; noPhone: boolean } {
  const rd = r.readiness
  if (!rd || r.state === null) return { chips: [], noPhone: false }
  // A phone's passkey is one in Microsoft Authenticator (or of unknown model); a security key held doesn't put one on the phone.
  const phonePasskey = rd.credentials.some((c) => c.cls === 'passkey' && c.allowedNow !== 'no' && (c.aaguid === null || AUTHENTICATOR_AAGUIDS.includes(c.aaguid)))
  const chips = rd.devices.map((d) => deviceChip(d, r.state as ReadinessState, phonePasskey))
  return { chips, noPhone: rd.devices.length > 0 && !rd.devices.some((d) => d.type === 'phone') }
}

/** The Methods cell: the phishing-resistant methods held, or what is held instead. */
export function methodsCell(r: ReadinessRow): { main: string; note: string } {
  if (r.methods === null) return { main: T.methods.unread, note: '' }
  const rd = r.readiness
  // Usable now where the readiness says so: a passkey the settings don't allow is not a method the person can use.
  const qualifying = rd ? rd.qualifying : r.methods.filter(isQualifying)
  const blocked = rd ? r.methods.filter((c) => isQualifying(c) && !rd.qualifying.includes(c)) : []
  const others = r.methods.filter((c) => !isQualifying(c))
  const main = qualifying.length > 0 ? listWords(qualifying.map(classWord)) : others.length > 0 ? fillText(T.methods.only, { method: listWords(others.map(classWord)) }) : T.methods.none
  if (blocked.length > 0) return { main, note: fillText(T.methods.notAllowed, { method: listWords(blocked.map(classWord)) }) }
  if (!rd) return { main, note: '' }
  // Microsoft's last-use date is supporting evidence only (owner item 2): it says "used recently", never Ready.
  if (rd.usedRecently) return { main, note: fillText(T.usedRecently, { date: monthDay(rd.usedRecently) }) }
  if (rd.onLeave) return { main, note: T.notes.onLeave }
  const last = rd.lastConfirmed
  // Not Ready, nothing confirmed, and a usable passkey Microsoft says is unused: it may be gone.
  const unused = !isReadyState(rd.state) && !last ? rd.credentials.find((c) => c.unused !== null && c.allowedNow !== 'no') : undefined
  if (unused) return { main, note: unused.unused === 'stale' && unused.lastUsed ? fillText(T.unusedKey.stale, { date: monthDay(unused.lastUsed) }) : T.unusedKey.never }
  const note = !last ? '' : last.retained ? fillText(T.beforeWindow, { date: monthDay(last.at) }) : isReadyState(rd.state) && rd.readyUntil ? fillText(T.readyUntil, { date: monthDay(rd.readyUntil) }) : fillText(T.lastConfirmed, { date: monthDay(last.at) })
  return { main, note }
}

const isReadyState = (s: ReadinessState): boolean => s === 'ready' || s === 'seamless'

/** The next step, in words. */
export function nextWords(n: NextAction): string {
  const N = T.next
  switch (n.kind) {
    case 'none': return N.none
    case 'seamless': return fillText(N.seamless, { option: T.options[n.option], device: deviceNoun(n.os) })
    case 'setUp': return fillText(N.setUp, { option: T.options[n.option] })
    // Method names keep their capitals mid-sentence (Windows Hello for Business, never "windows hello").
    case 'restore': return fillText(N.restore, { method: T.methodsInline[n.cls] })
    case 'confirm': return n.os ? fillText(N.confirmOn, { method: T.methodsInline[n.cls], device: deviceNoun(n.os) }) : fillText(N.confirm, { method: T.methodsInline[n.cls] })
    case 'returnConfirm': return N.returnConfirm
    case 'addDevice': return fillText(N.addDevice, { option: T.options[n.option], device: deviceNoun(n.os) })
    // A passkey in Authenticator needs iOS 17 or Android 14 (the eligibility floor).
    case 'updateOs': return fillText(N.updateOs, { device: deviceNoun(n.os), version: n.os === 'iOS' ? 'iOS 17' : 'Android 14' })
    case 'replaceKey': return N.replaceKey
    case 'waitSetup': return N.waitSetup[n.reason]
    case 'rescan': return N.rescan[n.reason]
  }
}

/**
 * A person the tenant's sign-in records can't speak for at all (no Entra ID P1,
 * or no permission to read them). That is the tenant's, said once on the page;
 * the row does not mark each of them "not read" (owner item 4, 2026-09-19).
 */
export function signInsUnavailableFor(r: ReadinessRow): boolean {
  const n = r.readiness?.next
  return r.state === 'unknown' && n?.kind === 'rescan' && n.reason === 'unavailable'
}

/**
 * The Needs action filter's count: the people with something to do, and apart
 * from them the people IAMAI couldn't read, whose next step is nothing ("Needs
 * action · 21, 1 not read"; owner item 4). Where the tenant has no sign-in
 * records at all the page says so once, so those people are not unread either.
 */
export function needsActionWords(counted: readonly ReadinessRow[]): string {
  const action = counted.filter((r) => r.state !== null && r.state !== 'unknown' && !isReadyState(r.state)).length
  const unread = counted.filter((r) => r.state === 'unknown' && !signInsUnavailableFor(r)).length
  const line = `${T.show.needsAction} · ${action}`
  // Filled directly: "read" here is a participle, and fillText would conjugate it after a count of one ("1 not reads").
  return unread > 0 ? `${line}, ${T.notReadCount.replace('{n}', String(unread))}` : line
}

/** The devices cell where no device was seen: not read, nothing (the page says why), or no sign-in in 30 days. */
export function noDevicesWord(r: ReadinessRow): string {
  if (signInsUnavailableFor(r)) return ''
  return r.readiness?.unknown === 'signIns' ? T.chip.unread : T.sub.noDevices
}

/** The next actions that ask a person to set up a passkey or another built-in method. */
const GUEST_SETUP: ReadonlySet<NextAction['kind']> = new Set(['seamless', 'setUp', 'addDevice', 'updateOs'])

/** The Next step cell: the baseline's next action, or, for somebody Ready, the Seamless recommendation. */
export function nextCell(r: ReadinessRow): string {
  const rd = r.readiness
  if (!rd || r.state === null) return ''
  // A guest is in the campaign (owner, 2026-09-19): Microsoft Authenticator works
  // for them and a passkey does not yet, so a guest is never asked to set one up.
  if (r.guest && GUEST_SETUP.has(rd.next.kind)) return T.next.guest
  // Records the tenant can't provide: nothing for this person to do, and the page says why once.
  if (signInsUnavailableFor(r)) return T.next.none
  if (rd.next.kind === 'none') return rd.recommended && !r.guest ? nextWords(rd.recommended) : T.next.none
  return nextWords(rd.next)
}

/** A note beside the next step: an account that looks automated. */
export function rowNote(r: ReadinessRow): string {
  return r.readiness?.automated ? T.notes.automated : ''
}

export type PanelItem = { icon: 'computer' | 'phone' | 'key'; name: string; sub: string; facts: [string, string][] }

/** The detail's devices: each device seen, its join state, its best option and where it stands now. */
export function panelDevices(r: ReadinessRow): PanelItem[] {
  const P = T.panel
  return (r.readiness?.devices ?? []).map((d) => {
    const trust = d.trust ?? 'unknown'
    const sub = `${d.type === 'computer' ? P.trust[trust] + ' ' : ''}${fillText(P.lastSeen, { date: monthDay(d.lastSeen) })}`
    const best = `${T.options[d.best].replace(/^a /, '')}${d.whyNot ? '. ' + P.whyNot[d.whyNot] : ''}`
    const now = d.seamless && d.proof ? fillText(P.proofNow.seamless, { date: monthDay(d.proof.at) }) : d.proof ? fillText(P.proofNow.confirmed, { date: monthDay(d.proof.at), method: classWord(d.proof.cls) }) : d.covered ? fillText(P.proofNow.covered, { type: d.type }) : P.proofNow.none
    return { icon: d.type, name: versionWord(d.os, d.version), sub, facts: [[P.best, capital(best)], [P.now, now]] }
  })
}

/** The detail's credentials: each phishing-resistant method, its model, whether it is allowed now and after Step 3, and its last use. */
export function panelMethods(r: ReadinessRow): PanelItem[] {
  const P = T.panel
  return (r.readiness?.credentials ?? []).map((c: CredentialReading) => {
    const model = c.model ?? (c.aaguid ? fillText(P.unlisted, { aaguid: `${c.aaguid.slice(0, 8)}…` }) : c.name ?? '')
    const allowed = c.afterStep3 !== null ? `${P.verdict[c.allowedNow]}. ${P.step3[c.afterStep3]}.` : `${P.verdict[c.allowedNow]}.`
    const last = c.lastConfirmed ? `${monthDay(c.lastConfirmed.at)}${c.lastConfirmed.os ? `, ${osWord(c.lastConfirmed.os)}` : ''}${c.lastConfirmed.retained ? ` (${P.retained})` : ''}` : P.never
    // Microsoft's last-use date, where it was read: supporting evidence, and the flag for a passkey that may be gone.
    const used = c.unused === 'never' ? P.unused.never : c.unused === 'stale' && c.lastUsed ? fillText(P.unused.stale, { date: monthDay(c.lastUsed) }) : c.lastUsed ? fillText(P.lastUsedDate, { date: monthDay(c.lastUsed) }) : null
    const facts: [string, string][] = [[P.allowed, allowed], [P.lastConfirmed, last], ...(used ? [[P.lastUsed, used] as [string, string]] : [])]
    return { icon: c.cls === 'passkey' && c.aaguid && !/authenticator/i.test(model) ? 'key' : c.cls === 'windowsHello' || c.cls === 'platformCredential' ? 'computer' : 'phone', name: classWord(c.cls), sub: model, facts }
  })
}

/** Why the person stands where they do, one sentence. */
export function whyLine(r: ReadinessRow): string {
  const rd = r.readiness
  if (!rd || r.state === null) return ''
  const W = T.panel.why
  if (rd.next.kind === 'replaceKey' || rd.recommended?.kind === 'replaceKey') return W.replaceKey
  if (rd.usedRecently) return fillText(W.usedRecently, { date: monthDay(rd.usedRecently) })
  if (rd.onLeave) return W.onLeave
  // Needs a device names the device the gap is on (a device type with no proof), whatever the next action there is.
  const gap = rd.devices.find((d) => !d.covered)
  if (r.state === 'device' && gap) return fillText(W.device, { device: deviceNoun(gap.os) })
  return W[r.state] ?? ''
}

const capital = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)

const SEARCH = new WeakMap<ReadinessRow, string>()
/** What the search box matches: the person, their devices, methods, state and next step. Built once per row. */
export function searchText(r: ReadinessRow): string {
  const held = SEARCH.get(r)
  if (held !== undefined) return held
  const text = [r.user.displayName ?? '', r.user.userPrincipalName ?? '', r.user.department ?? '', roleWord(r), methodsCell(r).main, ...deviceChips(r).chips.map((c) => `${c.os} ${c.word}`), r.state ? stateTitle(r.state) : '', nextCell(r)].join(' ').toLowerCase()
  SEARCH.set(r, text)
  return text
}

/** A setup check's words: the line, and what to do where it fails. */
export function checkWords(c: SetupCheck): { line: string; text: string } {
  const W = T.checks[c.key]
  // A check judged by its outcome names which outcome (Windows Hello: seen, not seen yet, no joined computer).
  if (c.reason && W[c.reason]) return { line: W[c.reason], text: '' }
  if (c.outcome === 'pass') return { line: W.pass, text: '' }
  if (c.outcome === 'note') return { line: W.note, text: '' }
  if (c.outcome === 'unknown') return { line: W.unknown ?? W.fail, text: '' }
  return { line: W.fail, text: W.failText ?? '' }
}

/** The CSV row, in the columns' order after the name: role, devices, methods, state, next step. */
export function rowCells(r: ReadinessRow): string[] {
  // Every chip the screen shows, the quiet ones included (no phone sign-ins, no sign-in in 30 days).
  const shown = deviceChips(r)
  const quiet = [...(shown.noPhone ? [T.chip.noPhone] : []), ...(shown.chips.length === 0 && r.state !== null && noDevicesWord(r) ? [noDevicesWord(r)] : [])]
  const devices = [...shown.chips.map((c) => `${c.os}: ${c.word}`), ...quiet].join('; ')
  const state = r.state !== null ? stateTitle(r.state) : r.explained ? T.counted[r.explained] : r.kind !== 'person' ? (T.show[r.kind] ?? r.kind) : ''
  return [roleWord(r), devices, methodsCell(r).main, state, nextCell(r)]
}
