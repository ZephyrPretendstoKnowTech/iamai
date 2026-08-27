// Auto-suggestions for mapping questions (prompt 06 item 2). Pure — works
// over the snapshot, tenant policy signatures, and the group-members cache.
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import { strengthTier } from '../coverage/strength.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembersCacheEntry } from '../graph/collect/cache.ts'
import type { MappingQuestion, Suggestion } from './types.ts'

const BG_NAME = /break.?glass|emergency|glass/i
const EXCL_NAME = /exclusion|excluded|exempt/i

export type SuggestContext = {
  snapshot: TenantSnapshot
  tenantPolicies: unknown[]
  knownGroups: GroupMembersCacheEntry[] // groups already fetched (referenced by tenant policies)
}

export function suggestFor(q: MappingQuestion, ctx: SuggestContext): Suggestion[] {
  switch (q.group) {
    case 'breakGlass':
      return suggestBreakGlass(ctx)
    case 'globalExclusion':
    case 'exclusionGroups':
      return suggestExclusionGroup(ctx)
    case 'personaGroups':
      return suggestByName(ctx, q)
    case 'namedLocations':
      return suggestLocation(ctx)
    case 'customStrengths':
      return suggestStrength(ctx, q)
    default:
      return []
  }
}

function suggestBreakGlass(ctx: SuggestContext): Suggestion[] {
  const out: Suggestion[] = []
  const direct = new Set<string>()
  for (const raw of ctx.tenantPolicies) {
    const p = raw as { state?: string; conditions?: { users?: { excludeUsers?: string[] } } }
    if (p.state === 'disabled') continue
    for (const u of p.conditions?.users?.excludeUsers ?? []) {
      if (!/^guestsorexternalusers$/i.test(u)) direct.add(u)
    }
  }
  for (const u of ctx.snapshot.users) {
    const named = BG_NAME.test(u.displayName ?? '') || BG_NAME.test(u.userPrincipalName ?? '')
    const excluded = direct.has(u.id)
    if (named || excluded) {
      out.push({
        id: u.id,
        name: u.displayName ?? u.userPrincipalName ?? u.id,
        confidence: named && excluded ? 'high' : 'medium',
        why: [excluded ? 'directly excluded from policies' : null, named ? 'name suggests break-glass' : null]
          .filter(Boolean)
          .join('; '),
      })
    }
  }
  return out.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1))
}

function suggestExclusionGroup(ctx: SuggestContext): Suggestion[] {
  const out: Suggestion[] = []
  const sigs = groupSignatures(ctx.tenantPolicies as CaPolicy[])
  const nameOf = (id: string): string =>
    ctx.knownGroups.find((g) => g.groupId === id)?.displayName ?? id
  for (const s of sigs) {
    if (s.inferredRole === 'globalExclusion' || s.inferredRole === 'broadExclusion') {
      out.push({
        id: s.id,
        name: nameOf(s.id),
        confidence: s.confidence,
        why: s.evidence,
      })
    }
  }
  for (const g of ctx.knownGroups) {
    if (g.displayName !== null && (EXCL_NAME.test(g.displayName) || BG_NAME.test(g.displayName))) {
      if (!out.some((s) => s.id === g.groupId)) {
        out.push({ id: g.groupId, name: g.displayName, confidence: 'medium', why: 'name suggests an exclusion group' })
      }
    }
  }
  return out
}

function suggestByName(ctx: SuggestContext, q: MappingQuestion): Suggestion[] {
  // Persona groups: token overlap between the placeholder/evidence and known group names.
  const tokens = (q.evidence ?? q.key).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3)
  const out: Suggestion[] = []
  for (const g of ctx.knownGroups) {
    if (g.displayName === null) continue
    const name = g.displayName.toLowerCase()
    const hits = tokens.filter((t) => name.includes(t)).length
    if (hits > 0) {
      out.push({ id: g.groupId, name: g.displayName, confidence: hits > 1 ? 'medium' : 'low', why: 'name overlap' })
    }
  }
  return out
}

function suggestLocation(ctx: SuggestContext): Suggestion[] {
  const rows = (ctx.snapshot.config.namedLocations?.rows ?? []) as Record<string, unknown>[]
  return rows
    .filter((l) => l.isTrusted === true)
    .map((l) => ({
      id: String(l.id ?? ''),
      name: typeof l.displayName === 'string' ? l.displayName : String(l.id ?? ''),
      confidence: 'medium' as const,
      why: 'marked as trusted in the tenant',
    }))
}

function suggestStrength(ctx: SuggestContext, q: MappingQuestion): Suggestion[] {
  const rows = (ctx.snapshot.config.authStrengths?.rows ?? []) as {
    id?: string
    displayName?: string
    allowedCombinations?: string[]
  }[]
  // Identical combinations would need the baseline strength's combos; the Jon
  // Hope source omits them (SPEC §6 finding), so suggest by tier/builtin.
  const wanted = q.key
  const out: Suggestion[] = []
  for (const s of rows) {
    if (typeof s.id !== 'string') continue
    if (s.id === wanted) {
      out.push({ id: s.id, name: s.displayName ?? s.id, confidence: 'high', why: 'identical strength id exists in tenant' })
    } else if (Array.isArray(s.allowedCombinations)) {
      out.push({
        id: s.id,
        name: s.displayName ?? s.id,
        confidence: 'low',
        why: `tenant strength (${strengthTier(s.allowedCombinations)} tier)`,
      })
    }
  }
  return out
}
