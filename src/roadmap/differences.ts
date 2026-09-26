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

/** Which way a difference leans: the tenant's policy asks more (stricter), less (weaker), or something else. */
export type DifferenceDirection = 'stricter' | 'weaker' | 'differs'

export type DifferencePiece = {
  /** The dimension (observation.ts dimension key: `conditions.users`, `grantControls`, `sessionControls` …). */
  dimension: string
  /** Which part of it: who is included, who is excluded, a control, or the dimension as a whole. */
  part: 'include' | 'exclude' | 'allUsers' | 'control' | 'whole'
  /** The kind of object an include or exclude piece lists. */
  kind?: 'role' | 'group' | 'user' | 'guestType'
  /** A session control's name (sessionControls). */
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
 * The session a policy leaves behind, control by control: a control the
 * tenant adds is stricter, one the plan sets and the tenant does not is weaker,
 * and one both set differently differs.
 */
function sessionPieces(intended: Row, deployed: Row, same: (a: unknown, b: unknown) => boolean): DifferencePiece[] {
  const set = (p: Row): Record<string, unknown> => Object.fromEntries(Object.entries((p.sessionControls ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && !(typeof v === 'object' && (v as { isEnabled?: unknown }).isEnabled === false)))
  const I = set(intended)
  const D = set(deployed)
  const out: DifferencePiece[] = []
  for (const control of [...new Set([...Object.keys(I), ...Object.keys(D)])].sort()) {
    const dimension = 'sessionControls'
    if (!(control in D)) out.push({ dimension, part: 'control', control, change: 'missing', ids: [], direction: 'weaker' })
    else if (!(control in I)) out.push({ dimension, part: 'control', control, change: 'extra', ids: [], direction: 'stricter', value: JSON.stringify(D[control]) })
    else if (!same(I[control], D[control])) out.push({ dimension, part: 'control', control, change: 'changed', ids: [], direction: 'differs', value: JSON.stringify(D[control]) })
  }
  return out
}

/**
 * The pieces of one differing dimension. `strictEnough` is coverage's reading
 * that the tenant's grant meets the goal's floor (tracking.ts); `same` is the
 * material comparison observation.ts uses, so a piece exists only where the
 * dimension differs materially.
 */
export function differencePieces(dimension: string, intended: Row, deployed: Row, o: { exclusionsGroupId: string | null; strictEnough: boolean; same: (a: unknown, b: unknown) => boolean; fingerprint?: string }): DifferencePiece[] {
  const whole = (direction: DifferenceDirection): DifferencePiece[] => [{ dimension, part: 'whole', change: 'changed', ids: [], direction, ...(o.fingerprint ? { value: o.fingerprint } : {}) }]
  if (dimension === 'conditions.users') {
    const pieces = usersPieces(intended, deployed, o.exclusionsGroupId)
    return pieces.length > 0 ? pieces : whole('differs')
  }
  if (dimension === 'sessionControls') {
    const pieces = sessionPieces(intended, deployed, o.same)
    return pieces.length > 0 ? pieces : whole('differs')
  }
  if (dimension === 'grantControls') return whole(o.strictEnough ? 'stricter' : 'weaker')
  return whole('differs')
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
 * What an acceptance of one dimension is kept against (owner, 2026-09-26: only
 * a new gap reopens it): the fingerprint of its pieces, less the lists the
 * tenant has made stricter (more people included, fewer excluded). The tenant
 * including more still after a person accepted it keeps the acceptance; a new
 * gap, or a changed setting (a session control's value, a grant), reopens it.
 */
export function acceptanceKeyOf(pieces: readonly DifferencePiece[]): string {
  const widens = (p: DifferencePiece): boolean => p.direction === 'stricter' && (p.part === 'include' || p.part === 'exclude' || p.part === 'allUsers') && p.required !== true
  const gaps = pieces.filter((p) => !widens(p)).map((p) => [p.part, p.kind ?? '', p.control ?? '', p.change, p.ids.join(','), p.value ?? ''].join(':')).sort()
  return `g-${hash(JSON.stringify(gaps))}`
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
