// How a tenant's policy differs from the plan's, piece by piece (owner,
// 2026-09-26): every control is exact, so each difference is either corrected
// or accepted with a reason, and none is accepted silently. A piece says what
// differs and in which direction, so the step can show it (stricter, weaker)
// and an acceptance can cover exactly the gaps it was given for.
//
// One reader for the pieces: the correction card, the Accept panel and the
// acceptance fingerprint (tracking.ts) all read this.
//
// Pure: no DOM, no network.

import { policyFacts } from '../coverage/facts.ts'
import { grantSatisfiesFloor } from '../coverage/strength.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { PolicyFacts, StrengthTier } from '../coverage/types.ts'
import { materialFieldsOf, sameDimension } from './observation.ts'

/** Which way a difference leans: the tenant's policy asks more (stricter), less (weaker), or something else. */
export type DifferenceDirection = 'stricter' | 'weaker' | 'differs'

export type DifferencePiece = {
  /** The dimension (observation.ts dimension key: `conditions.users`, `grantControls`, `sessionControls` …). */
  dimension: string
  /** Which part of it: who is included, who is excluded, a control, or the dimension as a whole. */
  part: 'include' | 'exclude' | 'allUsers' | 'control' | 'whole'
  /** The kind of object an include or exclude piece lists. */
  kind?: 'role' | 'group' | 'user' | 'guestType'
  /** A session control's name (sessionControls), or `externalTenants` for the guest tenants a users piece is about. */
  control?: string
  /** The plan has it and the tenant does not (missing), the tenant has it and the plan does not (extra), or both hold it differently (changed). */
  change: 'missing' | 'extra' | 'changed'
  /** The objects, sorted, lower case: role, group and user ids, or guest kinds. */
  ids: string[]
  direction: DifferenceDirection
  /** The exclusions group the plan excludes and the tenant does not: never accepted, always corrected. */
  required?: true
  /** The tenant's setting, fingerprinted, for a control or a whole dimension: a change to it reopens an acceptance. */
  value?: string
}

type Row = Record<string, unknown>
type Users = {
  includeUsers?: unknown[]; includeGroups?: unknown[]; includeRoles?: unknown[]
  excludeUsers?: unknown[]; excludeGroups?: unknown[]; excludeRoles?: unknown[]
  includeGuestsOrExternalUsers?: { guestOrExternalUserTypes?: string } | null
  excludeGuestsOrExternalUsers?: { guestOrExternalUserTypes?: string } | null
}

const usersOf = (p: Row): Users => (((p.conditions ?? {}) as { users?: Users }).users ?? {})
const ids = (a: unknown[] | undefined): Set<string> => new Set((a ?? []).map((x) => String(x).toLowerCase()).filter((x) => x !== ''))
const kinds = (g: { guestOrExternalUserTypes?: string } | null | undefined): Set<string> => new Set(String(g?.guestOrExternalUserTypes ?? '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))
const minus = (a: Set<string>, b: Set<string>): string[] => [...a].filter((x) => !b.has(x)).sort()

/**
 * Who the policy applies to, piece by piece. Leaving out someone the plan
 * includes, or excluding someone it does not, is weaker; including more, or
 * excluding less, is stricter. The exclusions group is the one exclusion that
 * is never optional (CLAUDE.md: exclusions go through the exclusions group).
 */
function usersPieces(intended: Row, deployed: Row, exclusionsGroupId: string | null): DifferencePiece[] {
  const I = usersOf(intended)
  const D = usersOf(deployed)
  const out: DifferencePiece[] = []
  const dimension = 'conditions.users'
  const planAll = ids(I.includeUsers).has('all')
  const tenantAll = ids(D.includeUsers).has('all')
  if (planAll && !tenantAll) out.push({ dimension, part: 'allUsers', change: 'missing', ids: [], direction: 'weaker' })
  if (tenantAll && !planAll) out.push({ dimension, part: 'allUsers', change: 'extra', ids: [], direction: 'stricter' })
  if (!planAll && !tenantAll) {
    const lists: [NonNullable<DifferencePiece['kind']>, Set<string>, Set<string>][] = [
      ['role', ids(I.includeRoles), ids(D.includeRoles)],
      ['group', ids(I.includeGroups), ids(D.includeGroups)],
      ['user', ids(I.includeUsers), ids(D.includeUsers)],
      ['guestType', kinds(I.includeGuestsOrExternalUsers), kinds(D.includeGuestsOrExternalUsers)],
    ]
    for (const [kind, plan, tenant] of lists) {
      const missing = minus(plan, tenant)
      const extra = minus(tenant, plan)
      if (missing.length > 0) out.push({ dimension, part: 'include', kind, change: 'missing', ids: missing, direction: 'weaker' })
      if (extra.length > 0) out.push({ dimension, part: 'include', kind, change: 'extra', ids: extra, direction: 'stricter' })
    }
  }
  // Which guest tenants a guest include or exclude reaches: not a list of ids
  // this reads piece by piece, so a change is one piece holding the tenant's.
  const external = (u: Users, side: 'include' | 'exclude'): string => JSON.stringify(((side === 'include' ? u.includeGuestsOrExternalUsers : u.excludeGuestsOrExternalUsers) as { externalTenants?: unknown } | null | undefined)?.externalTenants ?? null)
  for (const side of ['include', 'exclude'] as const) {
    if (external(I, side) !== external(D, side)) out.push({ dimension, part: side, control: 'externalTenants', change: 'changed', ids: [], direction: 'differs', value: external(D, side) })
  }
  const group = exclusionsGroupId?.toLowerCase() ?? null
  const excludes: [NonNullable<DifferencePiece['kind']>, Set<string>, Set<string>][] = [
    ['role', ids(I.excludeRoles), ids(D.excludeRoles)],
    ['group', ids(I.excludeGroups), ids(D.excludeGroups)],
    ['user', ids(I.excludeUsers), ids(D.excludeUsers)],
    ['guestType', kinds(I.excludeGuestsOrExternalUsers), kinds(D.excludeGuestsOrExternalUsers)],
  ]
  for (const [kind, plan, tenant] of excludes) {
    const extra = minus(tenant, plan)
    const missing = minus(plan, tenant)
    if (extra.length > 0) out.push({ dimension, part: 'exclude', kind, change: 'extra', ids: extra, direction: 'weaker' })
    const required = kind === 'group' && group !== null ? missing.filter((id) => id === group) : []
    const optional = missing.filter((id) => !required.includes(id))
    if (required.length > 0) out.push({ dimension, part: 'exclude', kind, change: 'missing', ids: required, direction: 'stricter', required: true })
    if (optional.length > 0) out.push({ dimension, part: 'exclude', kind, change: 'missing', ids: optional, direction: 'stricter' })
  }
  return out
}

/**
 * Which way one session control leans when a policy sets it: a control asks
 * more of a session (stricter), except the two settings that ask less than a
 * policy without them, an always-persistent browser and continuous access
 * evaluation switched off (weaker).
 */
export function sessionControlDirection(control: string, value: unknown): 'stricter' | 'weaker' {
  const mode = String((value as { mode?: unknown } | null)?.mode ?? '').toLowerCase()
  if (control === 'persistentBrowser' && mode === 'always') return 'weaker'
  if (control === 'continuousAccessEvaluation' && mode === 'disabled') return 'weaker'
  return 'stricter'
}

/** How strict one setting of a control is, where two can be ranked: a shorter sign-in frequency, a never-persistent browser. Null where they cannot. */
function sessionRank(control: string, value: unknown): number | null {
  const v = (value ?? {}) as { frequencyInterval?: unknown; type?: unknown; value?: unknown; mode?: unknown }
  if (control === 'signInFrequency') {
    if (String(v.frequencyInterval ?? '').toLowerCase() === 'everytime') return Number.MAX_SAFE_INTEGER
    const n = Number(v.value)
    if (!Number.isFinite(n) || n <= 0) return null
    return -(String(v.type ?? '').toLowerCase() === 'days' ? n * 24 : n)
  }
  if (control === 'persistentBrowser') return { never: 1, always: -1 }[String(v.mode ?? '').toLowerCase()] ?? null
  if (control === 'continuousAccessEvaluation') return { strictenforcement: 1, disabled: -1 }[String(v.mode ?? '').toLowerCase()] ?? null
  return null
}

/**
 * The session a policy leaves behind, control by control: a control the
 * tenant adds leans the way the control does (sessionControlDirection), one the
 * plan sets and the tenant does not the other way, and one both set
 * differently is stricter or weaker where the two can be ranked, else differs.
 */
function sessionPieces(intended: Row, deployed: Row, same: (a: unknown, b: unknown) => boolean): DifferencePiece[] {
  const set = (p: Row): Record<string, unknown> => Object.fromEntries(Object.entries((p.sessionControls ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && !(typeof v === 'object' && (v as { isEnabled?: unknown }).isEnabled === false)))
  const I = set(intended)
  const D = set(deployed)
  const out: DifferencePiece[] = []
  for (const control of [...new Set([...Object.keys(I), ...Object.keys(D)])].sort()) {
    const dimension = 'sessionControls'
    if (!(control in D)) out.push({ dimension, part: 'control', control, change: 'missing', ids: [], direction: sessionControlDirection(control, I[control]) === 'stricter' ? 'weaker' : 'stricter' })
    else if (!(control in I)) out.push({ dimension, part: 'control', control, change: 'extra', ids: [], direction: sessionControlDirection(control, D[control]), value: JSON.stringify(D[control]) })
    else if (!same(I[control], D[control])) {
      const plan = sessionRank(control, I[control])
      const tenant = sessionRank(control, D[control])
      const direction = plan === null || tenant === null || plan === tenant ? 'differs' : tenant > plan ? 'stricter' : 'weaker'
      out.push({ dimension, part: 'control', control, change: 'changed', ids: [], direction, value: JSON.stringify(D[control]) })
    }
  }
  return out
}

/** A grant control as the floor it stands for (coverage/strength.ts), or null for one no floor ranks (terms of use, a custom control). */
function floorOf(control: string, strength: StrengthTier | null): string | null {
  const c = control.toLowerCase()
  if (c === 'mfa') return strength ?? 'mfa'
  return ({ block: 'block', passwordchange: 'passwordChange', compliantdevice: 'compliantDevice', domainjoineddevice: 'compliantDevice', compliantapplication: 'compliantApplication', approvedapplication: 'approvedApplication' } as Record<string, string>)[c] ?? null
}

/** Whether a grant asks at least what another does: every control of an AND (one of an OR) as the floor it stands for. */
function meets(grant: PolicyFacts['grant'], other: PolicyFacts['grant']): boolean {
  if (!other || other.controls.size === 0) return true
  if (!grant || grant.controls.size === 0) return false
  const floors = [...other.controls].map((c) => floorOf(c, other.strength))
  if (floors.some((f) => f === null)) return false
  const ok = (f: string | null): boolean => grantSatisfiesFloor(grant, f as string, grant.strength)
  return other.operator === 'OR' && floors.length > 1 ? floors.some(ok) : floors.every(ok)
}

/**
 * Which way the tenant's grant leans against the plan's own grant, not the
 * goal's floor (review, 2026-09-26: a grant weaker than the baseline's but at
 * its floor read Stricter): a grant where the plan has none is stricter, none
 * where it has one weaker; otherwise whichever asks at least the other's
 * controls, and differs where each asks something the other does not.
 */
export function grantDirectionOf(intended: Row, deployed: Row, strengths: StrengthLookup): DifferenceDirection {
  const plan = policyFacts(intended, strengths).grant
  const tenant = policyFacts(deployed, strengths).grant
  const up = meets(tenant, plan)
  const down = meets(plan, tenant)
  return up && !down ? 'stricter' : down && !up ? 'weaker' : 'differs'
}

/**
 * The pieces of one differing dimension. `grant` is which way the tenant's
 * grant leans against the plan's (grantDirectionOf); `same` is the material
 * comparison observation.ts uses, so a piece exists only where the dimension
 * differs materially.
 */
export function differencePieces(dimension: string, intended: Row, deployed: Row, o: { exclusionsGroupId: string | null; grant?: DifferenceDirection; same: (a: unknown, b: unknown) => boolean; fingerprint?: string }): DifferencePiece[] {
  const whole = (direction: DifferenceDirection): DifferencePiece[] => [{ dimension, part: 'whole', change: 'changed', ids: [], direction, ...(o.fingerprint ? { value: o.fingerprint } : {}) }]
  if (dimension === 'conditions.users') {
    const pieces = usersPieces(intended, deployed, o.exclusionsGroupId)
    return pieces.length > 0 ? pieces : whole('differs')
  }
  if (dimension === 'sessionControls') {
    const pieces = sessionPieces(intended, deployed, o.same)
    return pieces.length > 0 ? pieces : whole('differs')
  }
  if (dimension === 'grantControls') return whole(o.grant ?? 'differs')
  // A condition the tenant adds narrows when the policy applies (weaker); one it
  // drops widens it (stricter); set both ways, it differs.
  if (dimension.startsWith('conditions.')) {
    const key = dimension.slice('conditions.'.length)
    const planHas = conditionSet(key, ((intended.conditions ?? {}) as Row)[key])
    const tenantHas = conditionSet(key, ((deployed.conditions ?? {}) as Row)[key])
    if (tenantHas && !planHas) return [{ dimension, part: 'whole', change: 'extra', ids: [], direction: 'weaker', ...(o.fingerprint ? { value: o.fingerprint } : {}) }]
    if (planHas && !tenantHas) return [{ dimension, part: 'whole', change: 'missing', ids: [], direction: 'stricter', ...(o.fingerprint ? { value: o.fingerprint } : {}) }]
  }
  return whole('differs')
}

/** Whether a policy sets a condition at all: a list with something in it, a filter with a rule; client apps "all" is none. */
function conditionSet(key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false
  // "All" on its own narrows nothing (coverage/classify.ts reads it the same way).
  const narrows = (v: unknown): boolean => String(v).trim() !== '' && !['all', 'none', 'any'].includes(String(v).trim().toLowerCase())
  if (Array.isArray(value)) return value.some(narrows)
  // A condition held as text: authentication flows' transfer methods, insider risk levels.
  if (typeof value === 'string') return value.split(',').some(narrows)
  if (typeof value !== 'object') return false
  const v = value as Row
  if (typeof (v.deviceFilter as Row | undefined)?.rule === 'string' && ((v.deviceFilter as Row).rule as string).trim() !== '') return true
  if (typeof v.rule === 'string' && v.rule.trim() !== '') return true
  return Object.entries(v).some(([, x]) => (Array.isArray(x) || typeof x === 'string' ? conditionSet(key, x) : x !== null && typeof x === 'object' ? conditionSet(key, x) : false))
}

/** FNV-1a over a text: short, stable, and carries no tenant value into the plan record. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * The gaps of one dimension, one fingerprint each: every object a list leaves
 * out or adds, and every setting with its value, less the lists the tenant has
 * made stricter (more people included, fewer excluded).
 */
function gapsOf(pieces: readonly DifferencePiece[]): string[] {
  const widens = (p: DifferencePiece): boolean => p.direction === 'stricter' && (p.part === 'include' || p.part === 'exclude' || p.part === 'allUsers') && p.control === undefined && p.required !== true
  const out = new Set<string>()
  for (const p of pieces.filter((x) => !widens(x))) {
    // A whole setting's gap is its value, whichever way it leans: keys saved before conditions leaned stay valid.
    const head = [p.part, p.kind ?? '', p.control ?? '', p.part === 'whole' ? 'changed' : p.change].join(':')
    if (p.ids.length > 0) for (const id of p.ids) out.add(hash(`${head}:${id}`))
    else out.add(hash(`${head}:${p.value ?? ''}`))
  }
  return [...out].sort()
}

/**
 * What an acceptance of one dimension is kept against (owner, 2026-09-26: only
 * a new gap reopens it): the fingerprint of each of its gaps (gapsOf). No
 * tenant value is carried into the plan record, only the hashes.
 */
/**
 * Which of the differences found between the plan's policy and the tenant's are
 * accepted with a reason: one reading, for generation (is the step's own policy
 * exact?) and tracking (is it still to correct?) alike (audit F5, 2026-10-05: the
 * two read it differently, so a step was done with nothing to hand over while
 * tracking reopened it). Accepted by the gaps' fingerprint (acceptanceKeyOf), or
 * one saved before that by the whole setting's; the exclusions group missing is
 * never accepted.
 */
export function acceptedDifferences(found: readonly string[], intended: Row, deployed: Row, saved: Readonly<Record<string, string>>, o: { exclusionsGroupId: string | null; strengths: StrengthLookup }): string[] {
  const grant = found.includes('grantControls') ? grantDirectionOf(intended, deployed, o.strengths) : undefined
  const now = materialFieldsOf(deployed)
  return found.filter((d) => {
    if (saved[d] === undefined) return false
    const pieces = differencePieces(d, intended, deployed, { exclusionsGroupId: o.exclusionsGroupId, grant, same: sameDimension, fingerprint: now[d] })
    return (acceptanceCovers(saved[d], pieces) || saved[d] === now[d]) && !pieces.some((p) => p.required)
  })
}

export function acceptanceKeyOf(pieces: readonly DifferencePiece[]): string {
  return `g2-${gapsOf(pieces).join('.')}`
}

/**
 * Whether a saved acceptance still covers a dimension: every gap it has now was
 * one of the gaps accepted. A gap closed since keeps it (the tenant tightened
 * the policy); a new gap, or a setting whose value moved, reopens it.
 */
export function acceptanceCovers(saved: string | undefined, pieces: readonly DifferencePiece[]): boolean {
  if (saved === undefined || !saved.startsWith('g2-')) return false
  const accepted = new Set(saved.slice(3).split('.').filter((g) => g !== ''))
  return gapsOf(pieces).every((g) => accepted.has(g))
}

/**
 * The plan's policy with each emergency account the tenant's policy excludes by
 * name kept excluded: the one exclusion no correction asks to remove (owner,
 * 2026-09-26). It comes out in Ongoing Checks and Cleanup's Remove Emergency
 * Accounts Excluded by Name, once the exclusions group covers the account.
 */
export function withEmergencyExclusions(intended: Row, deployed: Row, emergencyIds: readonly string[]): Row {
  const keep = new Set(emergencyIds.map((id) => id.toLowerCase()))
  const named = (usersOf(deployed).excludeUsers ?? []).map(String).filter((id) => keep.has(id.toLowerCase()))
  if (named.length === 0) return intended
  const out = structuredClone(intended) as { conditions?: { users?: Users } }
  const users = ((out.conditions ??= {}).users ??= {})
  const have = ids(users.excludeUsers)
  users.excludeUsers = [...(users.excludeUsers ?? []), ...named.filter((id) => !have.has(id.toLowerCase()))]
  return out as Row
}
