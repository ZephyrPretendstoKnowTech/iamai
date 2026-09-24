// What the sign-in records say about the two blocks in Turn On MFA for Everyone
// (walk list 4.x items 4, 5, 33 and 38): who signed in with legacy
// authentication or with device code in the last 30 days, and which accounts
// named in Confirm What You Use's mail-sending answer still used legacy
// authentication. The scan decides all of it; nobody records any of it.
//
// Legacy authentication is read from the per-person legacy clients the sign-in
// rows show (scenarioEvidence.legacyClients): the same rows Confirm What You Use
// suggests its mail senders from (direction.ts mailSenderIds) and Block Legacy
// Authentication's own "who" lines name (derive/contentLists.ts legacyUsers).
// Device code is read from the device-code sign-ins (evidenceUsage.deviceCode),
// the step's only reading of it. A sign-in the policy blocked is still one: a
// device that keeps trying has not moved.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { ConfigurationFinding, Step } from './types.ts'
import { mailDevicesOf } from './answers.ts'
import { setState } from './lifecycle.ts'
import { engine, shared } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { list } from '../copy/statements.ts'

/** Block Legacy Authentication, whose turn-on and completion the mail accounts decide. */
export const LEGACY_AUTH_STEP_ID = 's-goal-block-legacy-auth'
/** Block Device Code Sign-in. */
export const DEVICE_CODE_STEP_ID = 's-goal-block-device-code'
/** The readiness wait Block Legacy Authentication's turn-on carries while a named mail account has not moved (item 5; generate.ts). */
export const MAIL_ACCOUNTS_WAIT = 'mail-accounts'
/** The key of the sign-in card on either step (ConfigurationFinding.key). */
export const SIGN_INS_FINDING = 'sign-ins'

const W = engine.blockSignIns
/** How many names a card or a line states before "and N more". */
const NAMES_SHOWN = 5

type SignInRead = Pick<TenantSnapshot, 'sources' | 'scenarioEvidence' | 'evidenceUsage'>

const signInsRead = (snapshot: SignInRead): boolean => {
  const status = snapshot.sources?.signInEvidence?.status
  return status === 'ok' || status === 'partial'
}

/**
 * The accounts the sign-in records show signing in with legacy authentication
 * in the scan's window (the last 30 days), or null where the scan did not read
 * those records.
 */
export function legacySignInIds(snapshot: SignInRead): string[] | null {
  const legacy = signInsRead(snapshot) ? snapshot.scenarioEvidence?.legacyClients ?? null : null
  return legacy === null ? null : Object.keys(legacy.byPerson).sort()
}

/** The accounts the sign-in records show signing in with device code in the last 30 days, or null where the scan did not read them. */
export function deviceCodeSignInIds(snapshot: SignInRead): string[] | null {
  const usage = signInsRead(snapshot) ? snapshot.evidenceUsage?.deviceCode ?? null : null
  return usage === null ? null : [...usage.userIds].sort()
}

/**
 * The accounts named in the mail-sending answer that have not moved to a
 * supported mail route: each one the records show signing in with legacy
 * authentication in the last 30 days. Where the records were not read, every
 * named account, because nothing shows it has moved.
 */
export function mailAccountsToMove(snapshot: SignInRead, mapping: Pick<MappingState, 'questionAnswers'>): string[] {
  const named = mailDevicesOf(mapping)
  if (named.length === 0) return []
  const legacy = legacySignInIds(snapshot)
  if (legacy === null) return [...named]
  const seen = new Set(legacy.map((id) => id.toLowerCase()))
  return named.filter((id) => seen.has(id.toLowerCase()))
}

/**
 * Names, at most five, then "and N more": joined by commas for a card's detail,
 * or with "and" inside a sentence.
 */
export function namesOf(ids: readonly string[], nameOf: (id: string) => string, join: 'comma' | 'sentence' = 'comma'): string {
  const shown = ids.slice(0, NAMES_SHOWN).map(nameOf)
  const rest = ids.length - shown.length
  const items = rest > 0 ? [...shown, fillText(W.more, { n: rest })] : shown
  return join === 'comma' ? items.join(', ') : list(items)
}

/**
 * The step's sign-in card: who the records show, named, with where they move
 * before the turn-on, as an open card while the policy is not On (walk list 4.x
 * items 33 and 38). "Nobody" is Satisfied. Once the policy is On it blocks
 * whoever still tries, so the card goes: a Satisfied card naming people who
 * "signed in with legacy authentication" read as an open problem.
 */
function signInsCard(label: string, some: string, none: string, move: string, ids: readonly string[], nameOf: (id: string) => string, on: boolean): ConfigurationFinding | null {
  if (ids.length === 0) return { key: SIGN_INS_FINDING, label, value: none, detail: '', outcome: 'pass' }
  if (on) return null
  return { key: SIGN_INS_FINDING, label, value: fillText(some, { n: ids.length }), detail: fillText(move, { names: namesOf(ids, nameOf, 'sentence') }), outcome: 'fail' }
}

/** The key of Block Legacy Authentication's mail accounts card (ConfigurationFinding.key). */
export const MAIL_ACCOUNTS_FINDING = 'mail-accounts'
const MAIL = shared.mailDevices as unknown as Record<string, string>

/** The named mail accounts that still sign in with legacy authentication, and where they move. */
function mailAccountsCard(ids: readonly string[], nameOf: (id: string) => string, on: boolean): ConfigurationFinding {
  const one = ids.length === 1
  const names = namesOf(ids, nameOf, 'sentence')
  return { key: MAIL_ACCOUNTS_FINDING, label: MAIL.cardLabel, value: fillText(one ? MAIL.cardOne : MAIL.cardMany, { names }), detail: on ? (one ? MAIL.moveOne : MAIL.moveMany) : one ? MAIL.moveBeforeOne : MAIL.moveBeforeMany, outcome: 'fail' }
}

function withCard(step: Step, card: ConfigurationFinding | null): void {
  step.configurationFindings = [...(step.configurationFindings ?? []).filter((f) => f.key !== SIGN_INS_FINDING), ...(card ? [card] : [])]
}

/**
 * Block Legacy Authentication and Block Device Code Sign-in, from the sign-in
 * records, once each step knows whether its goal is delivered:
 *
 * - each names who used what it blocks in the last 30 days, or says nobody did
 *   (items 33 and 38). The emergency access accounts are left out: neither
 *   policy reaches them.
 * - Block Legacy Authentication's mail half (item 4): a named mail account still
 *   signing in with legacy authentication keeps the step open, even with the
 *   policy on; the step completes from the scan once none is left. Its turn-on
 *   waits for the same accounts (item 5, generate.ts sequence safety).
 */
export function settleBlockSignIns(steps: Step[], snapshot: SignInRead, mapping: Pick<MappingState, 'questionAnswers' | 'breakGlassUserIds'>, nameOf: (id: string) => string): void {
  const emergency = new Set(mapping.breakGlassUserIds.map((id) => id.toLowerCase()))
  const reached = (ids: readonly string[]): string[] => ids.filter((id) => !emergency.has(id.toLowerCase()))
  const legacy = steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)
  if (legacy && !legacy.state.setAside) {
    const delivered = legacy.state.satisfied
    const toMove = mailAccountsToMove(snapshot, mapping)
    if (toMove.length > 0) {
      legacy.mailAccountsToMove = toMove
      if (delivered) setState(legacy, { satisfied: false, inPlace: false })
    } else delete legacy.mailAccountsToMove
    // The named accounts still to move: one card, by name (items 5 and 36).
    const mailCard = toMove.length > 0 ? mailAccountsCard(toMove, nameOf, delivered || legacy.state.lifecycle === 'enforced') : null
    legacy.configurationFindings = [...(legacy.configurationFindings ?? []).filter((f) => f.key !== MAIL_ACCOUNTS_FINDING), ...(mailCard ? [mailCard] : [])]
    const ids = legacySignInIds(snapshot)
    // A named mail account still to move has its own card and task (item 36): not named twice.
    const moving = new Set(toMove.map((id) => id.toLowerCase()))
    const others = ids === null ? null : reached(ids).filter((id) => !moving.has(id.toLowerCase()))
    if (others !== null && !(others.length === 0 && toMove.length > 0)) withCard(legacy, signInsCard(W.legacyLabel, W.legacySome, W.legacyNone, W.legacyMove, others, nameOf, delivered || legacy.state.lifecycle === 'enforced'))
    else if (others !== null) withCard(legacy, null)
  }
  const device = steps.find((s) => s.id === DEVICE_CODE_STEP_ID)
  if (device && !device.state.setAside) {
    const ids = deviceCodeSignInIds(snapshot)
    if (ids !== null) withCard(device, signInsCard(W.deviceCodeLabel, W.deviceCodeSome, W.deviceCodeNone, W.deviceCodeMove, reached(ids), nameOf, device.state.satisfied || device.state.lifecycle === 'enforced'))
  }
}
