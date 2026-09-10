// The MFA method guidance, once (task 014).
//
// Every sentence is `shared.methodGuides` in docs/design/content.json. This
// module is the typed reader and the only place that decides which guide a
// person is offered. MFA Readiness's person panel, the help-desk text it
// copies, and the campaign step's pointer all come through here, so there is
// one version of "how a passkey gets registered" and not four.
//
// Two things it deliberately does not do.
//
// It scores nobody. What a person needs next is scoring/phishingResistant.ts's
// `next`, and MFA Readiness words it (surfaces/readinessCells.ts actionOf); a
// guide can never move somebody's readiness, prove a method, or turn Unknown
// into a state worth acting on.
//
// It claims nothing about the tenant. Setup guidance describes what an operator
// or a person does in Microsoft's own portals and apps. IAMAI issues no
// Temporary Access Pass, registers no method and writes nothing.
//
// Pure: no DOM, no network.
import { shared } from './content.ts'

export type MethodGuideId =
  | 'authenticator-iphone'
  | 'authenticator-android'
  | 'security-key'
  | 'windows-hello'
  | 'temporary-access-pass'
  | 'prove'

type GuideEntry = {
  id: MethodGuideId
  title: string
  /** The guide's own lines; an entry written "@key" is a line in `common`, so a sentence two platforms share is written once. */
  steps: string[]
  /** Lines after the shared closing pair, where a guide has one (the proof guide's "if it is refused"). */
  then?: string[]
  learn: { url: string }
}

type MethodGuideContent = {
  target: string
  prereq: string
  pointer: string
  userInstruction: string
  guest: string
  common: Record<string, string>
  guides: GuideEntry[]
}

const M = shared.methodGuides as unknown as MethodGuideContent

/** The one-line statement of what the page is asking for; said once, never inside each guide. */
export const PASSKEY_TARGET = M.target
/** Passkey (FIDO2) has to be enabled in the tenant before any of this works; said once, above the choices. */
export const TENANT_PREREQUISITE = M.prereq
/** What the Plan says instead of the setup instructions it used to carry: where the person-level work lives. */
export const GUIDE_POINTER = M.pointer
/** The one end-user sentence the campaign email carries ({passkeySetupShort}). */
export const USER_INSTRUCTION = M.userInstruction
/** Why a guest is offered no Temporary Access Pass, and what they do instead; the campaign's risk line is the same sentence ({guestNoTap}). */
export const GUEST_NOTE = M.guest

/**
 * The guides that end by using the method and scanning again — the two shared
 * closing lines. Windows Hello is not one of them: it never reaches the page's
 * target, so it must not end with the sentence that says a scan will read it as
 * proven. The proof guide is, because using the method is the whole of it.
 */
const CLOSES_WITH_USE = new Set<MethodGuideId>(['authenticator-iphone', 'authenticator-android', 'security-key', 'temporary-access-pass', 'prove'])

/**
 * The guides that satisfy the page's passkey target once the records prove
 * them. Windows Hello for Business stays at its canonical rung (derive/ladder.ts
 * rung 3: it works on one PC and nowhere else), and a Temporary Access Pass is
 * a way in, never an end state — neither is in here, and neither is ever
 * presented as completing the target.
 */
const REACHES_TARGET = new Set<MethodGuideId>(['authenticator-iphone', 'authenticator-android', 'security-key'])

/** True where finishing this guide can reach the page's passkey target — once the sign-in records prove it, never because the guide was followed. */
export function reachesTarget(id: MethodGuideId): boolean {
  return REACHES_TARGET.has(id)
}

export type MethodGuide = {
  id: MethodGuideId
  title: string
  /** The instruction lines, shared references resolved, in the order they are followed. */
  lines: string[]
  learn: { url: string }
  reachesTarget: boolean
}

const line = (s: string): string => (s.startsWith('@') ? (M.common[s.slice(1)] ?? '') : s)

function resolve(g: GuideEntry): MethodGuide {
  const close = CLOSES_WITH_USE.has(g.id) ? [M.common.useIt, M.common.scanAgain] : []
  return { id: g.id, title: g.title, lines: [...g.steps.map(line), ...close, ...(g.then ?? []).map(line)], learn: g.learn, reachesTarget: reachesTarget(g.id) }
}

/** Every guide the content file carries, in the order it writes them. */
export const METHOD_GUIDES: readonly MethodGuide[] = M.guides.map(resolve)

const BY_ID = new Map(METHOD_GUIDES.map((g) => [g.id, g]))

export function methodGuide(id: MethodGuideId): MethodGuide {
  const g = BY_ID.get(id)
  if (!g) throw new Error(`no method guide ${id}`)
  return g
}

/**
 * The guide as the help desk copies it: the title, the numbered lines, and the
 * Microsoft page. The same lines the panel shows, from the same source — the
 * operator hands somebody the text on screen, not a second version of it.
 */
export function guideText(id: MethodGuideId): string {
  const g = methodGuide(id)
  return [g.title, ...g.lines.map((l, i) => `${i + 1}. ${l}`), g.learn.url].join('\n')
}
