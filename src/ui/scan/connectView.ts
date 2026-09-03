// Connect's four tiles (docs/design/connect-mockup.html) as strings and button
// weights, in both states: signed out (the sign-in tile with its consent rows
// and its three error states, the sample tenant's facts) and signed in (the
// account, the scan in exactly one of its states); the baseline and what
// happens next in both. Pure, so each tile and each state renders in a test;
// Connect.tsx draws from it. Global Reader is the only role IAMAI names.
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate, monthDay, relative } from '../../copy/dates.ts'
import { list, lowerFirst } from '../../copy/statements.ts'
import { READ_EVERYTHING_ROLE } from '../../graph/collect/roles.ts'
import type { RoleGap } from '../../graph/collect/tokenRoles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { SignInError } from '../../graph/authError.ts'
import type { DemoFacts } from '../demoFacts.ts'

type Words = {
  h1: string
  intro: string
  signIn: {
    title: string
    state: string
    signIn: string
    demo: string
    workAccount: string
    permissionsSummary: string
    consentLead: string
    consent: { scope: string; name: string; reads: string }[]
    removal: string
    errors: {
      consent: { state: string; lead: string; thisTenant: string }
      personal: { state: string; lead: string; thatAccount: string }
      cancelled: { state: string }
      failed: { state: string; lead: string }
    }
  }
  account: { title: string; line: string; note: string; signInAnother: string; signOut: string }
  baseline: { title: string; state: string; loading: string; none: string; what: string; goal: string; updated: string; diff: { added: string; removed: string; changed: string }; diffStep: string; diffNoStep: string; change: string; howToMakeOne: string }
  next: { title: string; reads: string; readsLine: string; compares: string; comparesLine: string; writes: string; writesLine: string; readOnly: string; limitsSummary: string; limits: string[]; limitsMore: string; limitsLink: string; yourTenant: string }
  scan: {
    title: string
    complete: { state: string; people: string; policies: string; signIns: string; window: string; notRead: string; licence: string; licences: { p2: string; p1: string; free: string }; open: string; again: string }
    gaps: { state: string; lead: string; leadFirst: string; notRead: string; ask: string; learn: { label: string; url: string }; openLast: string }
    role: { state: string; lead: string; row: string; ask: string }
    ready: { state: string; note: string; start: string }
    scanning: { state: string; stop: string }
    sample: { state: string; lead: string; people: string; steps: string; inPlace: string; weeks: string; weeksValue: string; weeksOne: string }
  }
}
export const W = pages.connect as unknown as Words
const SECTIONS = app.scan.sections
export const HOW_HREF = '#/how'

export type Weight = 'primary' | 'secondary' | 'tertiary'
export type Action = { label: string; weight: Weight }
/** The number badge's colour: accent when done, amber for gaps, red for no role, none otherwise. */
export type Tone = 'done' | 'wait' | 'stop' | null

const sectionLabel = (source: string): string => SECTIONS[source] ?? source
/** A section label mid-sentence: "Conditional Access policies" keeps its capitals, "People" becomes "people". */
const midSentence = (label: string): string => (/^[A-Z][a-z]+ [A-Z]/.test(label) ? label : lowerFirst(label))

// ---- 1 Sign in (signed out) ----
export type SignInTile = {
  n: 1
  title: string
  state: string
  tone: Tone
  /** The error state's paragraph; it replaces the Global Reader line. */
  lead: string | null
  note: string | null
  actions: Action[]
  permissions: { summary: string; lead: string; rows: { scope: string; name: string; reads: string }[]; removal: string }
}
export function signInTile({ error }: { error: SignInError | null }): SignInTile {
  const S = W.signIn
  const signIn: Action = { label: S.signIn, weight: 'primary' }
  const demo: Action = { label: S.demo, weight: 'secondary' }
  const base = { n: 1 as const, title: S.title, permissions: { summary: S.permissionsSummary, lead: fillText(S.consentLead, { n: S.consent.length }), rows: S.consent, removal: S.removal } }
  if (!error) return { ...base, state: S.state, tone: null, lead: null, note: W.account.note, actions: [signIn, demo] }
  switch (error.kind) {
    case 'consent':
      return { ...base, state: S.errors.consent.state, tone: 'wait', lead: fillText(S.errors.consent.lead, { domain: error.domain ?? S.errors.consent.thisTenant }), note: null, actions: [signIn, demo] }
    case 'personal':
      return { ...base, state: S.errors.personal.state, tone: 'stop', lead: fillText(S.errors.personal.lead, { account: error.account ?? S.errors.personal.thatAccount }), note: null, actions: [{ label: S.workAccount, weight: 'primary' }, demo] }
    case 'cancelled':
      return { ...base, state: S.errors.cancelled.state, tone: null, lead: null, note: null, actions: [signIn, demo] }
    case 'failed':
      return { ...base, state: S.errors.failed.state, tone: 'stop', lead: fillText(S.errors.failed.lead, { message: error.message }), note: null, actions: [signIn, demo] }
  }
}

// ---- 1 Signed in ----
export type AccountTile = { n: 1; title: string; state: string; tone: Tone; line: string; note: string; actions: Action[] }
export function accountTile({ tenant, upn, role }: { tenant: string; upn: string; role: string | null }): AccountTile {
  return {
    n: 1,
    title: W.account.title,
    state: tenant,
    tone: 'done',
    line: role ? fillText(W.account.line, { upn, role }) : upn,
    note: W.account.note,
    actions: [
      { label: W.account.signInAnother, weight: 'secondary' },
      { label: W.account.signOut, weight: 'tertiary' },
    ],
  }
}

// ---- 2 Baseline ----
export type BaselineUpdate = { date: string; changes: { policy: string; change: string }[] }
export type BaselineTile = { n: 2; title: string; state: string; tone: Tone; paragraphs: string[]; update: { summary: string; rows: { tag: string; policy: string; step: string }[] } | null; actions: Action[] }
export function baselineTile({ name, policyCount, loading, update, stepFor }: { name: string | null; policyCount: number; loading: string | null; update: BaselineUpdate | null; stepFor: (policy: string) => string | null }): BaselineTile {
  const B = W.baseline
  const state = loading ? fillText(B.loading, { source: loading }) : name ? fillText(B.state, { baselineName: name, policyCount }) : B.none
  const tag = (change: string): string => (change === 'added' ? B.diff.added : change === 'removed' ? B.diff.removed : B.diff.changed)
  const rows = (update?.changes ?? []).map((c) => {
    const step = stepFor(c.policy)
    return { tag: tag(c.change), policy: c.policy, step: step ? fillText(B.diffStep, { step }) : B.diffNoStep }
  })
  return {
    n: 2,
    title: B.title,
    state,
    tone: name ? 'done' : null,
    paragraphs: [B.what, B.goal],
    update: update && rows.length > 0 ? { summary: fillText(B.updated, { date: absoluteDate(update.date), n: rows.length }), rows } : null,
    actions: [{ label: B.change, weight: 'secondary' }],
  }
}

// ---- 3 What happens next ----
export type NextTile = { n: 3; title: string; tone: Tone; beats: { label: string; text: string }[]; readOnly: string; limits: { summary: string; lines: string[]; more: string; link: { label: string; href: string } } }
export function nextTile({ tenant }: { tenant: string }): NextTile {
  const N = W.next
  return {
    n: 3,
    title: N.title,
    tone: 'done',
    beats: [
      { label: N.reads, text: fillText(N.readsLine, { tenant }) },
      { label: N.compares, text: fillText(N.comparesLine, { tenant }) },
      { label: N.writes, text: N.writesLine },
    ],
    readOnly: N.readOnly,
    limits: { summary: N.limitsSummary, lines: N.limits, more: N.limitsMore, link: { label: N.limitsLink, href: HOW_HREF } },
  }
}

// ---- 4 Scan: exactly one of its states ----
export type ScanInput =
  | { kind: 'complete'; snapshot: TenantSnapshot; at: string; now?: number }
  | { kind: 'gaps'; unread: string[]; lastScan: { at: string } | null }
  | { kind: 'role'; upn: string; gap: RoleGap }
  | { kind: 'scanning'; lane: string; elapsed: string }
  | { kind: 'ready' }
export type ScanTile = {
  n: 4
  kind: ScanInput['kind'] | 'sample'
  title: string
  state: string
  tone: Tone
  lead?: string
  facts?: { value: string; label: string }[]
  rows?: { name: string; value: string }[]
  ask?: string
  learn?: { label: string; url: string }
  note?: string
  actions: Action[]
}

function licenceWord(snapshot: TenantSnapshot): string {
  const L = W.scan.complete.licences
  if (snapshot.capabilities?.entraP2?.enabled) return L.p2
  if (snapshot.capabilities?.entraP1?.enabled) return L.p1
  return L.free
}

export function scanTile(input: ScanInput): ScanTile {
  const S = W.scan
  const signInAnother: Action = { label: W.account.signInAnother, weight: 'primary' }
  switch (input.kind) {
    case 'complete': {
      const C = S.complete
      const w = input.snapshot.sources.signInEvidence?.coveredWindow ?? null
      return {
        n: 4,
        kind: 'complete',
        title: S.title,
        state: fillText(C.state, { age: relative(input.at, input.now) }),
        tone: 'done',
        facts: [
          { value: String(input.snapshot.users.length), label: C.people },
          { value: String(input.snapshot.config.caPolicies?.rows.length ?? 0), label: C.policies },
          { value: w ? fillText(C.window, { from: monthDay(w.from), to: monthDay(w.to) }) : C.notRead, label: C.signIns },
          { value: licenceWord(input.snapshot), label: C.licence },
        ],
        actions: [
          { label: C.open, weight: 'primary' },
          { label: C.again, weight: 'secondary' },
        ],
      }
    }
    case 'gaps': {
      const G = S.gaps
      return {
        n: 4,
        kind: 'gaps',
        title: S.title,
        state: G.state,
        tone: 'wait',
        lead: fillText(input.lastScan ? G.lead : G.leadFirst, { n: input.unread.length }),
        rows: input.unread.map((s) => ({ name: sectionLabel(s), value: G.notRead })),
        ask: fillText(G.ask, { role: READ_EVERYTHING_ROLE }),
        learn: G.learn,
        actions: [signInAnother, { label: S.complete.again, weight: 'secondary' }, ...(input.lastScan ? [{ label: fillText(G.openLast, { date: monthDay(input.lastScan.at) }), weight: 'tertiary' as const }] : [])],
      }
    }
    case 'role': {
      const R = S.role
      return {
        n: 4,
        kind: 'role',
        title: S.title,
        state: R.state,
        tone: 'stop',
        lead: fillText(R.lead, { upn: input.upn, sections: list(input.gap.sources.map((s) => midSentence(sectionLabel(s)))) }),
        rows: [{ name: R.row, value: fillText(R.ask, { role: READ_EVERYTHING_ROLE }) }],
        actions: [signInAnother],
      }
    }
    case 'scanning':
      return { n: 4, kind: 'scanning', title: S.title, state: fillText(S.scanning.state, { lane: lowerFirst(input.lane), elapsed: input.elapsed }), tone: null, actions: [{ label: S.scanning.stop, weight: 'tertiary' }] }
    case 'ready':
      return { n: 4, kind: 'ready', title: S.title, state: S.ready.state, tone: null, note: S.ready.note, actions: [{ label: S.ready.start, weight: 'primary' }] }
  }
}

/** Tile 4 before sign-in: what the sample tenant produced, computed from the demo fixture (demoFacts.ts); the facts wait for it. */
export function sampleScanTile(facts: DemoFacts | null): ScanTile {
  const S = W.scan.sample
  return {
    n: 4,
    kind: 'sample',
    title: W.scan.title,
    state: S.state,
    tone: null,
    lead: S.lead,
    facts: facts
      ? [
          { value: String(facts.people), label: S.people },
          { value: String(facts.steps), label: S.steps },
          { value: String(facts.inPlace), label: S.inPlace },
          { value: fillText(facts.weeks === 1 ? S.weeksOne : S.weeksValue, { n: facts.weeks }), label: S.weeks },
        ]
      : undefined,
    actions: [{ label: W.signIn.demo, weight: 'secondary' }],
  }
}

/** Every string a tile renders, in order, for the tests that keep the states apart. */
export function tileStrings(tile: SignInTile | AccountTile | BaselineTile | NextTile | ScanTile): string[] {
  const out: string[] = [tile.title]
  if ('state' in tile && tile.state) out.push(tile.state)
  if ('line' in tile) out.push(tile.line)
  if ('lead' in tile && tile.lead) out.push(tile.lead)
  if ('note' in tile && tile.note) out.push(tile.note)
  if ('paragraphs' in tile) {
    out.push(...tile.paragraphs)
    if (tile.update) out.push(tile.update.summary, ...tile.update.rows.flatMap((r) => [r.tag, r.policy, r.step]))
  }
  if ('beats' in tile) out.push(...tile.beats.flatMap((b) => [b.label, b.text]), tile.readOnly, tile.limits.summary, ...tile.limits.lines, tile.limits.more, tile.limits.link.label)
  if ('kind' in tile) {
    for (const f of tile.facts ?? []) out.push(f.value, f.label)
    for (const r of tile.rows ?? []) out.push(r.name, r.value)
    if (tile.ask) out.push(tile.ask)
    if (tile.learn) out.push(tile.learn.label)
  }
  if ('permissions' in tile) out.push(tile.permissions.summary, tile.permissions.lead, ...tile.permissions.rows.flatMap((r) => [r.name, r.reads]), tile.permissions.removal)
  if ('actions' in tile) out.push(...tile.actions.map((a) => a.label))
  return out
}
