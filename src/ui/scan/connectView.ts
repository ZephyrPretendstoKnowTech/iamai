// Connect's four stages as strings and button weights, in both states: signed
// out (the sign-in tile with its consent rows and its three error states) and
// signed in (the account); the baseline in both; the Scan tile (the
// limitations, then the scan in exactly one of its states) and the Plan tile
// (ready, the last full plan after a scan with gaps, waiting for the scan, or
// the sample tenant's facts before sign-in).
//
// The progression is Microsoft tenant → Baseline → Tenant scan → Plan, and Plan
// is the destination (task 016): the Plan tile carries one Open the plan and no
// readiness diagnostic, because MFA Readiness comes after the plan, not before
// it. stages() says which stage the operator is on, so the finished ones can
// step back without the page keeping a state of its own.
//
// Pure, so each tile and each state renders in a test; Connect.tsx draws from
// it. The scan's age is one stored timestamp (lastScan.at) through one
// formatter, so the Scan and Plan tiles never disagree. Global Reader is the
// only role IAMAI names, and the consent rows are generated from GRAPH_SCOPES.
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate, monthDay, relative } from '../../copy/dates.ts'
import { list, lowerFirst } from '../../copy/statements.ts'
import { READ_EVERYTHING_ROLE } from '../../graph/collect/roles.ts'
import { consentRows } from '../../copy/permissions.ts'
import type { RoleGap } from '../../graph/collect/tokenRoles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { SignInError } from '../../graph/authError.ts'
import type { DemoFacts } from '../demoFacts.ts'
import type { ChangeKind, PolicyChange, SemanticDelta } from '../../derive/baselineDiff.ts'

type Words = {
  eyebrow: string
  h1: string
  intro: string
  next: string
  status: { ready: string; readyText: string; next: string }
  signIn: {
    title: string
    state: string
    signIn: string
    demo: string
    workAccount: string
    permissionsSummary: string
    consentLead: string
    removal: string
    errors: {
      consent: { state: string; lead: string; thisTenant: string }
      personal: { state: string; lead: string; thatAccount: string }
      cancelled: { state: string }
      failed: { state: string; lead: string }
    }
  }
  account: { title: string; line: string; note: string; signInAnother: string; signOut: string; sampleTitle: string; sampleNote: string }
  baseline: { title: string; loading: string; none: string; selected: string; count: string; versionPinned: string; versionUploaded: string; sourceSummary: string; sourceVersion: string; sourceUploaded: string; what: string; pinned: string; goal: string; updated: string; updatedPartial: string; incomplete: string; diff: Record<ChangeKind, string>; diffWas: string; diffAdded: string; diffRemoved: string; diffBoth: string; diffSet: string; diffCleared: string; diffChanged: string; diffUnreviewed: string; diffConflict: string; diffFields: Record<string, string>; diffStep: string; diffNoStep: string; change: string; howToMakeOne: string }
  scan: {
    title: string
    limitsSummary: string
    limits: string[]
    limitsMore: string
    limitsLink: string
    meta: { people: string; policies: string; steps: string }
    complete: { state: string; again: string }
    gaps: { state: string; lead: string; leadFirst: string; notRead: string; ask: string; learn: { label: string; url: string } }
    role: { state: string; lead: string; row: string; ask: string }
    ready: { state: string; note: string; start: string }
    scanning: { state: string; stop: string }
    sample: { state: string }
  }
  plan: {
    title: string
    ready: { state: string; stateCounted: string; lead: string; open: string }
    last: { state: string; open: string }
    waiting: { state: string }
    sample: { lead: string; people: string; steps: string; inPlace: string; weeks: string; weeksEstimate: string; weeksValue: string; weeksOne: string; open: string }
  }
}
export const W = pages.connect as unknown as Words
const SECTIONS = app.scan.sections
export const HOW_HREF = '#/how'

/**
 * Where a stage sits in the progression (task 016): 'settled' is behind the
 * operator and steps back, 'current' is the one with the next action, and
 * 'ahead' has not been reached. Connect derives it from the tiles themselves —
 * the first tile that is not done is the current one — so the page has no
 * second state machine of its own.
 */
export type Stage = 'settled' | 'current' | 'ahead'

/** The stage of each of the four tiles, in order, from whether each is done. */
export function stages(done: readonly boolean[]): Stage[] {
  const current = done.indexOf(false)
  return done.map((_, i) => (current === -1 ? 'settled' : i < current ? 'settled' : i === current ? 'current' : 'ahead'))
}

/**
 * The status strip the approved pack sets above the staged flow
 * (docs/design/approved/anatomy/connect-v3.html): a state indicator, a state title and
 * a quiet line.
 *
 * It is a PROJECTION of the progression, not a second reading of it. It takes
 * the same `done` array stages() takes and the stages' own title, state and
 * tone, and says one of two things: nothing is left to do, or this is the stage
 * with the next action and here is that stage's own state line. So the strip
 * cannot disagree with the step it points at, and no readiness is calculated
 * here that is not already calculated by the tiles.
 */
export type ConnectStatus = { tone: Tone; title: string; text: string }
export function connectStatus(done: readonly boolean[], stagesOf: readonly { title: string; state: string; tone: Tone }[]): ConnectStatus {
  const current = done.indexOf(false)
  if (current === -1) return { tone: 'done', title: W.status.ready, text: W.status.readyText }
  const s = stagesOf[current]
  return { tone: s?.tone ?? null, title: fillText(W.status.next, { stage: s?.title ?? '' }), text: s?.state ?? '' }
}

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
  // The rows are generated from GRAPH_SCOPES crossed with SCOPE_COPY (src/copy/permissions.ts):
  // the disclosure and the consent screen cannot say different things.
  const rows = consentRows()
  const base = { n: 1 as const, title: S.title, permissions: { summary: S.permissionsSummary, lead: fillText(S.consentLead, { n: rows.length }), rows, removal: S.removal } }
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

/**
 * Tile 1 in the demo (task 026). The sample tenant is loaded; nobody is signed
 * in. The tile says exactly that, and the only thing it offers is the way out,
 * because the two actions the signed-in tile offers are Microsoft's: one starts
 * a real sign-in and the other clears the real sign-in cache, and neither has
 * anything to act on when the tenant on screen is a fixture. Leaving is the
 * canonical demo exit (ui/demoMode.ts), the same one the banner offers.
 */
export function sampleTile({ tenant, upn }: { tenant: string; upn: string }): AccountTile {
  return {
    n: 1,
    title: W.account.sampleTitle,
    state: tenant,
    tone: 'done',
    line: upn,
    note: W.account.sampleNote,
    actions: [{ label: app.shell.demoLeave, weight: 'secondary' }],
  }
}

// ---- 2 Baseline ----
/**
 * The author's update: the date of the head commit, and one entry per evolving
 * source policy (derive/baselineDiff.ts), never per changed file. `incomplete`
 * is set when IAMAI could not read enough of the author's source to establish
 * the whole diff — an incomplete review still renders, because "nothing to see"
 * is the one thing it must not say.
 */
export type BaselineUpdate = { date: string; changes: PolicyChange[]; incomplete?: boolean }
/** A review row: the change word, the policy as a person reads it, what it was called, what materially changed, and the plan steps under it. */
export type BaselineReviewRow = { tag: string; policy: string; was: string | null; deltas: string[]; steps: string[] }
/**
 * The baseline's own card, nested inside step 2 by the approved pack
 * (docs/design/approved/anatomy/connect-v3.html): the package's name, a quiet source
 * line, and the copy that explains what a baseline is and what this one aims
 * at. Every value is the loaded package's — the name it carries, how many
 * policies it holds, and whether it is the pinned version or one someone
 * uploaded. The pack also draws a credential pill beside the name; production
 * does not fill it, because a credential badge is a claim and the one
 * credential IAMAI states belongs to the author of ONE package, not to the
 * region. It stays where production already says it, inside `what`.
 */
export type BaselineCard = { name: string; source: string; paragraphs: string[] }
export type BaselineTile = {
  n: 2
  title: string
  state: string
  tone: Tone
  /** The nested card, once a package is loaded. */
  card: BaselineCard | null
  /**
   * The pack's source-and-version disclosure under the card. `text` is what a
   * pinned baseline means; `link` is where the package actually came from and
   * `version` is the revision IAMAI holds, both read from the loaded package's
   * own origin so there is no second version authority (task Step 1 C).
   */
  source: { summary: string; text: string; link: { label: string; url: string } | null; version: string | null } | null
  /** The explaining copy when there is no card to nest it in (nothing loaded yet, or a load that failed). */
  paragraphs: string[]
  update: { summary: string; note: string | null; rows: BaselineReviewRow[] } | null
  actions: Action[]
}

/** One material difference in the words the product uses; the field's own name comes from diffFields, or the path itself when the model does not cover it. */
function deltaLine(d: SemanticDelta): string {
  const B = W.baseline
  const field = B.diffFields[d.field] ?? d.field
  if (d.kind === 'added') return fillText(B.diffAdded, { field, n: d.n })
  if (d.kind === 'removed') return fillText(B.diffRemoved, { field, n: d.n })
  if (d.kind === 'both') return fillText(B.diffBoth, { field, added: d.added, removed: d.removed })
  if (d.kind === 'set') return fillText(B.diffSet, { field, value: d.value })
  if (d.kind === 'cleared') return fillText(B.diffCleared, { field })
  return fillText(B.diffChanged, { field })
}

/**
 * Where the loaded package came from and which revision of it IAMAI holds.
 * The pinned package names its repository and the commit it was read at — the
 * disclosure is only useful if a reader can go and check it. An uploaded
 * package names neither, because IAMAI did not fetch it and knows nothing about
 * where it came from; saying so is the honest version of "source and version".
 */
function sourceOf(version: 'pinned' | 'uploaded' | undefined, pin: BaselinePin | null | undefined): { link: { label: string; url: string } | null; version: string | null } {
  const B = W.baseline
  if (version === 'uploaded') return { link: null, version: B.sourceUploaded }
  if (!pin) return { link: null, version: null }
  return {
    link: { label: pin.repo, url: pin.url },
    // Seven characters is how GitHub itself names a commit; the full one is in
    // the link's own history, and the disclosure has to stay compact.
    version: fillText(B.sourceVersion, { commit: pin.commit.slice(0, 7), date: absoluteDate(pin.readAt) }),
  }
}

/** The pinned package's provenance, from its origin and `baselines/*.index.json`. */
export type BaselinePin = { repo: string; url: string; commit: string; readAt: string }

export function baselineTile({
  name,
  policyCount,
  version,
  pin,
  loading,
  update,
  stepsFor,
}: {
  name: string | null
  policyCount: number
  /** Where the loaded package came from (ui/baseline.ts BaselineResult.origin): the pinned index, or files someone uploaded. */
  version?: 'pinned' | 'uploaded'
  /**
   * The pinned package's provenance, for the source-and-version disclosure:
   * the repository it was read from and the commit it was read at. Connect
   * takes it from the loaded package's origin and `baselines/*.index.json`,
   * which are the only places either fact is written down. Absent for an
   * uploaded package, which has no source to name.
   */
  pin?: { repo: string; url: string; commit: string; readAt: string } | null
  loading: string | null
  update: BaselineUpdate | null
  /** The plan steps that policy stands behind, from the goal map by stable identity (derive/baselineDiff.ts stepsForChange). */
  stepsFor: (change: PolicyChange) => string[]
}): BaselineTile {
  const B = W.baseline
  // The step's state word is the STEP's state; the package's name and size are
  // the card's, where the approved pack puts them.
  const state = loading ? fillText(B.loading, { source: loading }) : name ? B.selected : B.none
  const card: BaselineCard | null = name === null || loading !== null ? null : { name, source: [fillText(B.count, { policyCount }), version === 'uploaded' ? B.versionUploaded : B.versionPinned].join(' · '), paragraphs: [B.what, B.goal] }
  const rows: BaselineReviewRow[] = (update?.changes ?? []).map((c) => {
    const steps = stepsFor(c)
    const deltas = c.deltas.map(deltaLine)
    if (c.reason === 'conflictingCopies') deltas.push(B.diffConflict)
    for (const path of c.unreviewed) deltas.push(fillText(B.diffUnreviewed, { field: B.diffFields[path] ?? path }))
    return {
      tag: B.diff[c.kind],
      policy: c.newName ?? c.oldName ?? '',
      was: c.renamed && c.oldName ? fillText(B.diffWas, { oldName: c.oldName }) : null,
      deltas,
      steps: steps.length > 0 ? steps.map((step) => fillText(B.diffStep, { step })) : [B.diffNoStep],
    }
  })
  const incomplete = update?.incomplete === true
  return {
    n: 2,
    title: B.title,
    state,
    tone: name ? 'done' : null,
    card,
    source: card ? { summary: B.sourceSummary, text: B.pinned, ...sourceOf(version, pin) } : null,
    paragraphs: card ? [] : [B.what, B.goal, B.pinned],
    update:
      update && (rows.length > 0 || incomplete)
        ? {
            summary: incomplete ? fillText(B.updatedPartial, { date: absoluteDate(update.date) }) : fillText(B.updated, { date: absoluteDate(update.date), n: rows.length }),
            note: incomplete ? B.incomplete : null,
            rows,
          }
        : null,
    actions: [{ label: B.change, weight: 'secondary' }],
  }
}

// ---- 3 Scan: the limitations, then exactly one of its states ----
/**
 * What a complete scan produced, for the meta row the approved pack draws in
 * the scan step. Every number is read from the authority that already owns it —
 * `people` from derive/facts.ts (the one denominator), `policies` from the
 * loaded package, `steps` from derive/facts.ts stepFacts (the count the Plan
 * header and the Plan destination already show). Absent until the plan has
 * computed: the row is never drawn from a placeholder.
 */
export type ScanCounts = { people: number; policies: number; steps: number }
export type ScanInput =
  | { kind: 'complete'; at: string; now?: number; counts?: ScanCounts | null }
  | { kind: 'gaps'; unread: string[]; lastScan: { at: string } | null }
  | { kind: 'role'; upn: string; gap: RoleGap }
  | { kind: 'scanning'; lane: string; elapsed: string }
  | { kind: 'ready' }
  /** Before sign-in: after sign-in · about a minute for a small tenant. */
  | { kind: 'sample' }
export type ScanTile = {
  n: 3
  kind: ScanInput['kind']
  title: string
  state: string
  tone: Tone
  limits: { summary: string; lines: string[]; more: string; link: { label: string; href: string } }
  /** The complete scan's compact counts, once the plan has computed. */
  meta?: { value: string; label: string }[]
  lead?: string
  rows?: { name: string; value: string }[]
  ask?: string
  learn?: { label: string; url: string }
  note?: string
  actions: Action[]
}

/** The scan's age, from the one stored timestamp: the Scan and Plan tiles both read this. */
export const scanAgeWords = (at: string, now?: number): string => relative(at, now)

export function scanTile(input: ScanInput): ScanTile {
  const S = W.scan
  const base = {
    n: 3 as const,
    title: S.title,
    limits: { summary: S.limitsSummary, lines: S.limits, more: S.limitsMore, link: { label: S.limitsLink, href: HOW_HREF } },
  }
  const signInAnother: Action = { label: W.account.signInAnother, weight: 'primary' }
  const again: Action = { label: S.complete.again, weight: 'secondary' }
  switch (input.kind) {
    case 'complete': {
      const c = input.counts
      return {
        ...base,
        kind: 'complete',
        state: fillText(S.complete.state, { age: scanAgeWords(input.at, input.now) }),
        tone: 'done',
        meta: c ? [{ value: String(c.people), label: S.meta.people }, { value: String(c.policies), label: S.meta.policies }, { value: String(c.steps), label: S.meta.steps }] : undefined,
        actions: [again],
      }
    }
    case 'gaps': {
      const G = S.gaps
      return {
        ...base,
        kind: 'gaps',
        state: G.state,
        tone: 'wait',
        lead: fillText(input.lastScan ? G.lead : G.leadFirst, { n: input.unread.length }),
        rows: input.unread.map((s) => ({ name: sectionLabel(s), value: G.notRead })),
        ask: fillText(G.ask, { role: READ_EVERYTHING_ROLE }),
        learn: G.learn,
        actions: [signInAnother, again],
      }
    }
    case 'role': {
      const R = S.role
      return {
        ...base,
        kind: 'role',
        state: R.state,
        tone: 'stop',
        lead: fillText(R.lead, { upn: input.upn, sections: list(input.gap.sources.map((s) => midSentence(sectionLabel(s)))) }),
        rows: [{ name: R.row, value: fillText(R.ask, { role: READ_EVERYTHING_ROLE }) }],
        actions: [signInAnother],
      }
    }
    case 'scanning':
      return { ...base, kind: 'scanning', state: fillText(S.scanning.state, { lane: lowerFirst(input.lane), elapsed: input.elapsed }), tone: null, actions: [{ label: S.scanning.stop, weight: 'tertiary' }] }
    case 'ready':
      return { ...base, kind: 'ready', state: S.ready.state, tone: null, note: S.ready.note, actions: [{ label: S.ready.start, weight: 'primary' }] }
    case 'sample':
      return { ...base, kind: 'sample', state: S.sample.state, tone: null, actions: [] }
  }
}

// ---- 4 Plan: ready, the last full plan, waiting for the scan, or the sample ----
export type PlanInput =
  /** A complete scan: the state with the step counts once the plan has computed, one line saying what was built, and Open the plan. The readiness ladder is MFA Readiness's, not Connect's (task 016). */
  | { kind: 'ready'; at: string; counts: { steps: number; done: number } | null; now?: number }
  /** A scan with gaps kept the last full plan. */
  | { kind: 'last'; at: string }
  /** Signed in, no plan yet: the scan has not run, is running, or ended with gaps and nothing before it. */
  | { kind: 'waiting' }
  /** Before sign-in: what the sample tenant produced. */
  | { kind: 'sample'; facts: DemoFacts | null }
export type PlanTile = {
  n: 4
  kind: PlanInput['kind']
  title: string
  state: string
  tone: Tone
  lead?: string
  /** The sample tenant's four facts, before sign-in. */
  facts?: { value: string; label: string }[]
  actions: Action[]
}

export function planTile(input: PlanInput): PlanTile {
  const P = W.plan
  switch (input.kind) {
    case 'ready': {
      const R = P.ready
      const age = scanAgeWords(input.at, input.now)
      return {
        n: 4,
        kind: 'ready',
        title: P.title,
        // The step counts arrive once the plan has computed; until then the state carries the scan's age alone, never a placeholder.
        state: input.counts ? fillText(R.stateCounted, { steps: input.counts.steps, done: input.counts.done, age }) : fillText(R.state, { age }),
        tone: 'done',
        lead: R.lead,
        actions: [{ label: R.open, weight: 'primary' }],
      }
    }
    case 'last':
      return { n: 4, kind: 'last', title: P.title, state: fillText(P.last.state, { date: monthDay(input.at) }), tone: null, actions: [{ label: fillText(P.last.open, { date: monthDay(input.at) }), weight: 'tertiary' }] }
    case 'waiting':
      return { n: 4, kind: 'waiting', title: P.title, state: P.waiting.state, tone: null, actions: [] }
    case 'sample': {
      const S = P.sample
      const f = input.facts
      return {
        n: 4,
        kind: 'sample',
        title: P.title,
        state: P.waiting.state,
        tone: null,
        lead: S.lead,
        facts: f
          ? [
              { value: String(f.people), label: S.people },
              { value: String(f.steps), label: S.steps },
              { value: String(f.inPlace), label: S.inPlace },
              // The Plan's own length (derive/finish.ts planWeeks); where the sample plan cannot finish yet it is the estimate, and labelled so.
              { value: fillText(f.weeks === 1 ? S.weeksOne : S.weeksValue, { n: f.weeks }), label: f.estimated ? S.weeksEstimate : S.weeks },
            ]
          : undefined,
        actions: [{ label: S.open, weight: 'secondary' }],
      }
    }
  }
}

/** Every string a tile renders, in order, for the tests that keep the states apart. */
export function tileStrings(tile: SignInTile | AccountTile | BaselineTile | ScanTile | PlanTile): string[] {
  const out: string[] = [tile.title]
  if ('state' in tile && tile.state) out.push(tile.state)
  if ('line' in tile) out.push(tile.line)
  if ('lead' in tile && tile.lead) out.push(tile.lead)
  if ('note' in tile && tile.note) out.push(tile.note)
  if ('paragraphs' in tile) {
    out.push(...tile.paragraphs)
    if (tile.card) out.push(tile.card.name, tile.card.source, ...tile.card.paragraphs)
    if (tile.source) out.push(tile.source.summary, tile.source.text)
    if (tile.update) out.push(tile.update.summary, ...tile.update.rows.flatMap((r) => [r.tag, r.policy, ...r.steps]))
  }
  if ('limits' in tile) {
    out.push(tile.limits.summary, ...tile.limits.lines, tile.limits.more, tile.limits.link.label)
    for (const m of tile.meta ?? []) out.push(m.value, m.label)
    for (const r of tile.rows ?? []) out.push(r.name, r.value)
    if (tile.ask) out.push(tile.ask)
    if (tile.learn) out.push(tile.learn.label)
  }
  if ('facts' in tile) for (const f of tile.facts ?? []) out.push(f.value, f.label)
  if ('permissions' in tile) out.push(tile.permissions.summary, tile.permissions.lead, ...tile.permissions.rows.flatMap((r) => [r.name, r.reads]), tile.permissions.removal)
  if ('actions' in tile) out.push(...tile.actions.map((a) => a.label))
  return out
}
