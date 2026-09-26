// The Accept panel in the step's action column (owner, 2026-09-26): each
// concrete difference between the tenant's policy and the plan's on its own
// line, marked Weaker, Stricter or Differs; what a weaker one leaves out, in
// one amber sentence; and, once accepted, when, why and what the acceptance
// covers. It replaced a lead that named only the settings ("who it applies to
// and session controls"), so accepting "who it applies to" signed off on two
// admin roles left out while the reason said "stricter".
//
// One reader: the pieces are tracking's (roadmap/differences.ts), the ones an
// acceptance is kept against, so the panel and the acceptance cannot disagree.
//
// Pure: no DOM, no network.

import type { Step } from '../../roadmap/types.ts'
import type { DifferencePiece } from '../../roadmap/differences.ts'
import { dimensionWords } from '../../roadmap/observation.ts'
import { PROCEDURE } from '../../roadmap/policyProcedure.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list, plural } from '../../copy/statements.ts'
import { fillText } from '../../content/render.ts'
import { roleNamesOf } from '../../roles.ts'
import { UNNAMED } from '../../names.ts'
import { CONTRACT } from './stepContract.ts'
import { NAMES_INLINE } from './whoBlocks.ts'
import { actionWordsOf } from './policyFact.ts'
import type { StepVarContext } from './stepVars.ts'

type Row = Record<string, unknown>
type Kind = NonNullable<DifferencePiece['kind']>
type Tag = 'stricter' | 'weaker' | 'differs' | 'required'

type PanelWords = {
  label: string
  tags: Record<Tag, string>
  kinds: Record<Kind, [string, string]>
  includeMissing: string
  includeExtra: string
  excludeExtra: string
  excludeMissing: string
  named: string
  more: string
  allUsersMissing: string
  allUsersExtra: string
  sessionMissing: string
  sessionExtra: string
  sessionChanged: string
  sessionValue: string
  controls: Record<string, string>
  everyTime: string
  neverPersistent: string
  alwaysPersistent: string
  grantBoth: string
  grant: string
  grantShort: string
  whole: string
  leavesRequires: string
  leavesBlocks: string
  leavesPlain: string
  leavesAnyoneIn: string
  leavesAnyoneHolding: string
  externalTenants: string
  externalTenantsShort: string
  leavesEveryone: string
  leavesGrant: string
  required: string
  prompt: string
  reason: string
  accept: string
  reasonFirst: string
  caption: string
  acceptedHead: string
  covers: string
  remove: string
}
export const ACCEPT_WORDS = (): PanelWords => CONTRACT.acceptDeviation as unknown as PanelWords

/** One difference as the panel draws it: its mark and its line. */
export type DifferenceLine = { tag: Tag; mark: string; text: string }

export type AcceptPanel = {
  /** The differences still open, each on its own line. */
  lines: DifferenceLine[]
  /** What the weaker ones leave out, in one sentence; null where none is weaker. */
  leaves: string | null
  /** The exclusions group missing: never accepted, always corrected. */
  required: string | null
  /** What Accept saves for each setting it may accept (MemberTracking.differsFields, less a setting with a required piece). */
  acceptable: Record<string, string>
  /** The acceptance already saved: when, why, and what it covers. */
  accepted: { date: string; reason: string; covers: string } | null
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** A name to print, or null for an id nobody resolved. */
const named = (ctx: Pick<StepVarContext, 'nameOf'>) => (id: string): string | null => {
  const n = ctx.nameOf(id)
  return n && n.toLowerCase() !== id.toLowerCase() && n !== UNNAMED && !/‹/.test(n) ? n : null
}

function namesOf(p: DifferencePiece, ctx: Pick<StepVarContext, 'nameOf'>): string[] {
  if (p.kind === 'role') return roleNamesOf(p.ids, named(ctx))
  if (p.kind === 'guestType') return p.ids.map((k) => (CONTRACT as unknown as { guestKinds: Record<string, string> }).guestKinds[k] ?? k)
  return p.ids.map((id) => ctx.nameOf(id))
}

/** "AI Reader and Entra Backup Administrator"; past five, "A, B, C, D, E and 75 more". */
function shownNames(names: readonly string[]): string {
  const W = ACCEPT_WORDS()
  return names.length > NAMES_INLINE ? fillText(W.more, { names: names.slice(0, NAMES_INLINE).join(', '), n: String(names.length - NAMES_INLINE) }) : list([...names])
}

const counted = (p: DifferencePiece): string => {
  const [one, many] = ACCEPT_WORDS().kinds[p.kind ?? 'user']
  return `${p.ids.length} ${plural(p.ids.length, one, many)}`
}

/** A sign-in frequency or persistent browser setting in words ("7 days", "never persistent"); null for a control with no value to state. */
function valueOf(control: string, value: string | undefined): string | null {
  const W = ACCEPT_WORDS()
  let v: Record<string, unknown>
  try { v = JSON.parse(value ?? 'null') as Record<string, unknown> } catch { return null }
  if (v === null || typeof v !== 'object') return null
  if (control === 'signInFrequency') {
    if (String(v.frequencyInterval ?? '').toLowerCase() === 'everytime') return W.everyTime
    const n = Number(v.value)
    if (!Number.isFinite(n) || n <= 0) return null
    const days = String(v.type ?? '').toLowerCase() === 'days'
    return days ? (n === 1 ? PROCEDURE.day : fillText(PROCEDURE.days, { n: String(n) })) : fillText(PROCEDURE.hours, { n: String(n) })
  }
  if (control === 'persistentBrowser') {
    const mode = String(v.mode ?? '').toLowerCase()
    return mode === 'never' ? W.neverPersistent : mode === 'always' ? W.alwaysPersistent : null
  }
  return null
}

/** The short form ("2 admin roles not included", "sign-in frequency"): what the acceptance covers. */
function shortOf(p: DifferencePiece): string {
  const W = ACCEPT_WORDS()
  if (p.control === 'externalTenants') return W.externalTenantsShort
  if (p.part === 'include') return fillText(p.change === 'missing' ? W.includeMissing : W.includeExtra, { count: counted(p) })
  if (p.part === 'exclude') return fillText(p.change === 'extra' ? W.excludeExtra : W.excludeMissing, { count: counted(p) })
  if (p.part === 'allUsers') return (p.change === 'missing' ? W.allUsersMissing : W.allUsersExtra).toLowerCase()
  if (p.part === 'control') return W.controls[p.control ?? ''] ?? p.control ?? ''
  if (p.dimension === 'grantControls') return W.grantShort
  return dimensionWords([p.dimension])
}

/** The line: the short form with the names, or the setting with its value. */
function lineOf(p: DifferencePiece, grant: { theirs: string; ours: string } | null, ctx: Pick<StepVarContext, 'nameOf'>): string {
  const W = ACCEPT_WORDS()
  if (p.control === 'externalTenants') return W.externalTenants
  if (p.part === 'include' || p.part === 'exclude') return fillText(W.named, { short: cap(shortOf(p)), names: shownNames(namesOf(p, ctx)) })
  if (p.part === 'allUsers') return p.change === 'missing' ? W.allUsersMissing : W.allUsersExtra
  if (p.part === 'control') {
    const control = W.controls[p.control ?? ''] ?? p.control ?? ''
    const value = valueOf(p.control ?? '', p.value)
    const setting = value !== null ? fillText(W.sessionValue, { control, value }) : control
    return fillText(p.change === 'missing' ? W.sessionMissing : p.change === 'extra' ? W.sessionExtra : W.sessionChanged, { control: setting })
  }
  if (p.dimension === 'grantControls') return grant !== null ? fillText(W.grantBoth, grant) : W.grant
  return fillText(W.whole, { dimension: dimensionWords([p.dimension]) })
}

/** The tenant's policy and the plan's, for one member: the grants' words and the plan's own. */
function policiesOf(step: Step, policyId: string | null, ctx: Pick<StepVarContext, 'snapshot'>): { tenant: Row | null; plan: Row | null } {
  const rows = (ctx.snapshot.config.caPolicies?.rows ?? []) as Row[]
  const tenant = policyId ? rows.find((r) => String(r.id).toLowerCase() === policyId.toLowerCase()) ?? null : null
  const ops = step.action.resolution?.policies ?? []
  const op = ops.find((o) => typeof o.policyId === 'string' && policyId !== null && o.policyId.toLowerCase() === policyId.toLowerCase()) ?? (ops.length === 1 ? ops[0] : undefined)
  const plan = (op ? (op.mode === 'update' ? op.intent ?? op.body : op.body) : step.action.intended) as Row | undefined
  return { tenant, plan: plan ?? null }
}

/**
 * The panel for one step; null where nothing differs and nothing was accepted.
 * `acceptable` leaves out a setting whose difference includes the exclusions
 * group missing: tracking never accepts it (roadmap/tracking.ts).
 */
export function acceptPanelOf(step: Step, ctx: Pick<StepVarContext, 'snapshot' | 'mapping' | 'nameOf'>): AcceptPanel | null {
  const W = ACCEPT_WORDS()
  const members = step.tracking?.members ?? []
  const saved = step.acceptedDeviation ?? null
  const open: { p: DifferencePiece; grant: { theirs: string; ours: string } | null }[] = []
  const covered: DifferencePiece[] = []
  const acceptable: Record<string, string> = {}
  const leftOut: string[] = []
  let leaves: { verb: 'blocks' | 'requires'; what: string } | null = null
  let weakerGrant: string | null = null
  const required: string[] = []
  for (const m of members) {
    const differs = m.differsFields ?? {}
    const pieces = m.differences ?? []
    const { tenant, plan } = policiesOf(step, m.policyId, ctx)
    const ours = plan ? actionWordsOf(plan, ctx) : null
    const theirs = tenant ? actionWordsOf(tenant, ctx) : null
    const grant = ours && theirs ? { theirs: theirs.what, ours: ours.what } : null
    for (const [dimension, key] of Object.entries(differs)) {
      const mine = pieces.filter((p) => p.dimension === dimension)
      if (mine.some((p) => p.required)) required.push(...mine.filter((p) => p.required).flatMap((p) => namesOf(p, ctx)))
      else acceptable[dimension] = key
      for (const p of mine) {
        open.push({ p, grant })
        if (p.direction !== 'weaker') continue
        if (p.part === 'include') leftOut.push(counted(p))
        // Who an extra exclusion leaves out, by what it names: anyone in a group,
        // anyone holding a role, the accounts and guest types themselves.
        if (p.part === 'exclude') leftOut.push(p.kind === 'group' ? fillText(W.leavesAnyoneIn, { names: shownNames(namesOf(p, ctx)) }) : p.kind === 'role' ? fillText(W.leavesAnyoneHolding, { names: shownNames(namesOf(p, ctx)) }) : shownNames(namesOf(p, ctx)))
        if (p.part === 'allUsers') leftOut.push(W.leavesEveryone)
        if (p.dimension === 'grantControls' && ours) weakerGrant = ours.what
        if (p.part === 'include' || p.part === 'exclude' || p.part === 'allUsers') leaves ??= ours
      }
    }
    for (const dimension of m.accepted ?? []) covered.push(...pieces.filter((p) => p.dimension === dimension))
  }
  if (open.length === 0 && saved === null) return null
  const lines = open.map(({ p, grant }): DifferenceLine => {
    const tag: Tag = p.required ? 'required' : p.direction
    return { tag, mark: W.tags[tag], text: lineOf(p, grant, ctx) }
  })
  const who = list(leftOut)
  const scope = leftOut.length === 0 ? null : leaves === null ? fillText(W.leavesPlain, { who }) : fillText(leaves.verb === 'requires' ? W.leavesRequires : W.leavesBlocks, { who, what: leaves.what })
  const sentence = [scope, weakerGrant !== null ? fillText(W.leavesGrant, { what: weakerGrant }) : null].filter((s): s is string => s !== null).join(' ')
  return {
    lines,
    leaves: sentence === '' ? null : sentence,
    required: required.length > 0 ? fillText(W.required, { names: list([...new Set(required)]) }) : null,
    acceptable,
    accepted: saved && saved.reason !== '' ? { date: absoluteDate(saved.at), reason: saved.reason, covers: covered.length > 0 ? fillText(W.covers, { items: list(covered.map(shortOf)) }) : '' } : null,
  }
}
