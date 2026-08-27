// Ranked empty-state suggestions for the Setup wizard pickers (prompt 11 §1):
// (a) objects the tenant's own policy signatures infer for the question,
// (b) names/UPNs matching the well-known patterns, (c) for accounts,
// cloud-only Global Administrators. Each carries a "why suggested" line. Pure.
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembersCacheEntry } from '../graph/collect/cache.ts'
import { SETUP_PAGE } from '../copy/setup.ts'
import type { WizardQuestionId } from './wizard.ts'

const GA_ROLE = '62e90394-69f5-4237-9190-012177145e10'
const NAME_PATTERN = /break.?glass|emergency|admin|it[-_]|svc|service|exclusion|ca-/i

export type WizardSuggestion = {
  id: string
  name: string
  secondary?: string
  why: string
  rank: 0 | 1 | 2
}

export type WizardSuggestContext = {
  snapshot: TenantSnapshot
  tenantPolicies: unknown[]
  knownGroups: GroupMembersCacheEntry[]
}

function nameHit(text: string | null): string | null {
  const m = text?.match(NAME_PATTERN)
  return m ? m[0].toLowerCase() : null
}

export function suggestForWizard(id: WizardQuestionId, ctx: WizardSuggestContext): WizardSuggestion[] {
  const W = SETUP_PAGE.why
  const out = new Map<string, WizardSuggestion>()
  const add = (s: WizardSuggestion): void => {
    const cur = out.get(s.id)
    if (!cur || s.rank < cur.rank) out.set(s.id, s)
  }

  if (id === 'breakGlass' || id === 'highCare') {
    if (id === 'breakGlass') {
      const direct = new Set<string>()
      for (const raw of ctx.tenantPolicies) {
        const p = raw as { state?: string; conditions?: { users?: { excludeUsers?: string[] } } }
        if (p.state === 'disabled') continue
        for (const u of p.conditions?.users?.excludeUsers ?? []) if (!/^guestsorexternalusers$/i.test(u)) direct.add(u)
      }
      for (const u of ctx.snapshot.users) {
        if (direct.has(u.id)) add({ id: u.id, name: u.displayName ?? u.userPrincipalName ?? u.id, secondary: u.userPrincipalName ?? undefined, why: W.inferredBreakGlass, rank: 0 })
      }
    }
    for (const u of ctx.snapshot.users) {
      const hit = nameHit(u.displayName) ?? nameHit(u.userPrincipalName)
      if (hit) add({ id: u.id, name: u.displayName ?? u.userPrincipalName ?? u.id, secondary: u.userPrincipalName ?? undefined, why: W.nameMatch(hit), rank: 1 })
    }
    if (id === 'breakGlass') {
      for (const u of ctx.snapshot.users) {
        const ga = (ctx.snapshot.roles.active[u.id] ?? []).some((r) => r.toLowerCase() === GA_ROLE)
        if (ga && u.onPremisesSyncEnabled !== true) add({ id: u.id, name: u.displayName ?? u.userPrincipalName ?? u.id, secondary: u.userPrincipalName ?? undefined, why: W.cloudOnlyGa, rank: 2 })
      }
    }
  }

  if (id === 'globalExclusion' || id === 'serviceAccounts') {
    const nameOf = (gid: string) => ctx.knownGroups.find((g) => g.groupId === gid)?.displayName ?? gid
    const members = (gid: string) => {
      const g = ctx.knownGroups.find((x) => x.groupId === gid)
      return g ? SETUP_PAGE.members(g.memberCount) : undefined
    }
    for (const s of groupSignatures(ctx.tenantPolicies as CaPolicy[])) {
      const wantGlobal = id === 'globalExclusion' && (s.inferredRole === 'globalExclusion' || s.inferredRole === 'broadExclusion')
      const wantSvc = id === 'serviceAccounts' && s.inferredRole === 'serviceAccounts'
      if (wantGlobal || wantSvc) add({ id: s.id, name: nameOf(s.id), secondary: members(s.id), why: wantGlobal ? W.inferredExclusion : W.inferredServiceAccounts, rank: 0 })
    }
    for (const g of ctx.knownGroups) {
      const hit = nameHit(g.displayName)
      if (hit) add({ id: g.groupId, name: g.displayName ?? g.groupId, secondary: SETUP_PAGE.members(g.memberCount), why: W.nameMatch(hit), rank: 1 })
    }
  }

  if (id === 'trustedLocations') {
    for (const raw of (ctx.snapshot.config.namedLocations?.rows ?? []) as { id?: string; displayName?: string; isTrusted?: boolean }[]) {
      if (raw.isTrusted === true && raw.id) add({ id: raw.id, name: raw.displayName ?? raw.id, why: W.trusted, rank: 0 })
    }
  }

  return [...out.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
}
